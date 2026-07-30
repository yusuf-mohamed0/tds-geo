#!/usr/bin/env python3
import csv
import hashlib
import html
import json
import mimetypes
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
REPO = BASE.parents[1]
MANIFEST = BASE / "media-url-manifest.csv"
SOURCE_CSV = BASE / "shopify-products-recovered.csv"
OUT_CSV = BASE / "shopify-products-recovered-hosted-media.csv"
OUT_MANIFEST = BASE / "hosted-media-manifest.csv"
CDX_IMAGE_CACHE = BASE / "wayback-image-cdx-cache.json"
DOWNLOAD_DIR = REPO / "backend/public/assets/recovery/joes-venture/images"
PUBLIC_BASE = "https://16.192.29.174.nip.io/assets/recovery/joes-venture/images"

IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": ".jpg",
    b"\x89PNG\r\n\x1a\n": ".png",
    b"GIF87a": ".gif",
    b"GIF89a": ".gif",
    b"RIFF": ".webp",
}


def slug(value):
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "image"


def fetch(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 tds-geo-media-recovery/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "")
        return response.read(), content_type


def wayback_url(url):
    return "https://web.archive.org/web/0if_/" + url


def image_cdx_candidates(url, cache):
    parsed = urllib.parse.urlparse(url)
    no_query = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
    key = no_query
    if key not in cache:
        cdx_url = (
            "https://web.archive.org/cdx?url="
            + urllib.parse.quote(no_query + "*", safe="")
            + "&output=json&fl=timestamp,original,statuscode,mimetype,digest"
            + "&filter=statuscode:200&collapse=digest&limit=20"
        )
        try:
            body, _ = fetch(cdx_url, timeout=10)
            rows = json.loads(body.decode("utf-8"))
            cache[key] = rows[1:] if len(rows) > 1 else []
        except Exception:
            cache[key] = []
        CDX_IMAGE_CACHE.write_text(json.dumps(cache, indent=2), encoding="utf-8")
        time.sleep(0.1)
    candidates = []
    for timestamp, original, status, mimetype, digest in cache.get(key, []):
        if str(mimetype).startswith("image/"):
            candidates.append(f"https://web.archive.org/web/{timestamp}if_/{original}")
    return candidates


def extension_for(content, content_type, source_url):
    for sig, ext in IMAGE_SIGNATURES.items():
        if content.startswith(sig):
            if ext == ".webp" and content[8:12] != b"WEBP":
                continue
            return ext
    guessed = mimetypes.guess_extension(content_type.split(";")[0].strip()) if content_type else ""
    if guessed in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return ".jpg" if guessed == ".jpeg" else guessed
    path_ext = Path(urllib.parse.urlparse(source_url).path).suffix.lower()
    if path_ext in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return ".jpg" if path_ext == ".jpeg" else path_ext
    return ""


def is_valid_image(content):
    if len(content) < 128:
        return False
    return bool(extension_for(content, "", ""))


def download_image(row, cdx_cache):
    source = row["Image Src"]
    handle = row["Handle"]
    position = row["Image Position"] or "1"
    digest = hashlib.sha1(source.encode("utf-8")).hexdigest()[:10]
    base_name = f"{slug(handle)}-{int(position):02d}-{digest}"
    existing = sorted(DOWNLOAD_DIR.glob(base_name + ".*"))
    if existing:
        path = existing[0]
        return {
            "Handle": handle,
            "Original Image Src": source,
            "Hosted Image Src": f"{PUBLIC_BASE}/{path.name}",
            "Local Path": str(path.relative_to(REPO)),
            "Bytes": str(path.stat().st_size),
            "Status": "downloaded",
            "Fetch Source": "cached",
            "Error": "",
        }
    candidates = [source, wayback_url(source)] + image_cdx_candidates(source, cdx_cache)
    errors = []
    for candidate in candidates:
        try:
            content, content_type = fetch(candidate)
            ext = extension_for(content, content_type, source)
            if not ext or not is_valid_image(content):
                continue
            path = DOWNLOAD_DIR / f"{base_name}{ext}"
            path.write_bytes(content)
            return {
                "Handle": handle,
                "Original Image Src": source,
                "Hosted Image Src": f"{PUBLIC_BASE}/{path.name}",
                "Local Path": str(path.relative_to(REPO)),
                "Bytes": str(len(content)),
                "Status": "downloaded",
                "Fetch Source": "original" if candidate == source else "wayback",
                "Error": "",
            }
        except Exception as exc:
            errors.append(str(exc))
    return {
        "Handle": handle,
        "Original Image Src": source,
        "Hosted Image Src": "",
        "Local Path": "",
        "Bytes": "0",
        "Status": "failed",
        "Fetch Source": "",
        "Error": " | ".join(errors[-3:]) if errors else "unknown error",
    }


def main():
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    cdx_cache = json.loads(CDX_IMAGE_CACHE.read_text(encoding="utf-8")) if CDX_IMAGE_CACHE.exists() else {}
    media_rows = list(csv.DictReader(MANIFEST.open(newline="", encoding="utf-8")))
    results = []
    source_to_hosted = {}
    for index, row in enumerate(media_rows, start=1):
        result = download_image(row, cdx_cache)
        results.append(result)
        if result["Hosted Image Src"]:
            source_to_hosted[result["Original Image Src"]] = result["Hosted Image Src"]
        if index % 25 == 0:
            print(f"downloaded {index}/{len(media_rows)}", flush=True)
        time.sleep(0.05)

    source_rows = list(csv.DictReader(SOURCE_CSV.open(newline="", encoding="utf-8")))
    fields = list(source_rows[0].keys())
    seen_first_image = set()
    output_rows = []
    for row in source_rows:
        image = row.get("Image Src", "")
        if image:
            hosted = source_to_hosted.get(image, "")
            if not hosted:
                row["Image Src"] = ""
                row["Image Position"] = ""
                row["Image Alt Text"] = ""
                row["Variant Image"] = ""
                if not row.get("Title"):
                    continue
                output_rows.append(row)
                continue
            row["Image Src"] = hosted
            row["Variant Image"] = ""
            if row.get("Title"):
                key = (row["Handle"], hosted)
                if key in seen_first_image:
                    row["Image Src"] = ""
                    row["Image Position"] = ""
                    row["Image Alt Text"] = ""
                else:
                    seen_first_image.add(key)
            output_rows.append(row)
        else:
            output_rows.append(row)

    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(output_rows)

    with OUT_MANIFEST.open("w", newline="", encoding="utf-8") as fh:
        fields = ["Handle", "Original Image Src", "Hosted Image Src", "Local Path", "Bytes", "Status", "Fetch Source", "Error"]
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)

    summary = {
        "media_rows": len(media_rows),
        "downloaded": sum(1 for item in results if item["Status"] == "downloaded"),
        "failed": sum(1 for item in results if item["Status"] == "failed"),
        "hosted_csv_rows": len(output_rows),
        "hosted_image_values": sum(1 for row in output_rows if row.get("Image Src")),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
