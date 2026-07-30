#!/usr/bin/env python3
import csv
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent
RAW_DIR = OUT_DIR / "wayback-product-pages"
CDX_FILE = OUT_DIR / "wayback-products-cdx.json"
CSV_FILE = OUT_DIR / "shopify-products-recovered.csv"
SUMMARY_JSON = OUT_DIR / "wayback-recovery-summary.json"

CDX_URL = (
    "https://web.archive.org/cdx?url=joesventure.com/products/*"
    "&output=json&fl=timestamp,original,mimetype,statuscode,digest"
    "&filter=statuscode:200&collapse=urlkey&limit=5000"
)

CSV_HEADER = [
    "Handle",
    "Title",
    "Body (HTML)",
    "Vendor",
    "Product Category",
    "Type",
    "Tags",
    "Published",
    "Option1 Name",
    "Option1 Value",
    "Option2 Name",
    "Option2 Value",
    "Option3 Name",
    "Option3 Value",
    "Variant SKU",
    "Variant Grams",
    "Variant Inventory Tracker",
    "Variant Inventory Qty",
    "Variant Inventory Policy",
    "Variant Fulfillment Service",
    "Variant Price",
    "Variant Compare At Price",
    "Variant Requires Shipping",
    "Variant Taxable",
    "Variant Barcode",
    "Image Src",
    "Image Position",
    "Image Alt Text",
    "Gift Card",
    "SEO Title",
    "SEO Description",
    "Google Shopping / Google Product Category",
    "Google Shopping / Gender",
    "Google Shopping / Age Group",
    "Google Shopping / MPN",
    "Google Shopping / Condition",
    "Google Shopping / Custom Product",
    "Variant Image",
    "Variant Weight Unit",
    "Variant Tax Code",
    "Cost per item",
    "Status",
]


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": "tds-geo-archive-recovery/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def clean_text(value):
    if not value:
        return ""
    if not isinstance(value, str):
        return ""
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def strip_wayback_prefix(url):
    if not url:
        return ""
    match = re.search(r"https?://web\.archive\.org/web/\d+(?:[a-z_]+)?/(https?://.+)", url)
    return match.group(1) if match else url


def absolute_archive_safe_url(url):
    if isinstance(url, dict):
        url = url.get("url") or url.get("contentUrl") or ""
    if isinstance(url, list):
        url = url[0] if url else ""
    url = html.unescape(url or "").strip()
    if url.startswith("//"):
        url = "https:" + url
    return strip_wayback_prefix(url)


def extract_json_objects(source):
    objects = []
    for match in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', source, re.I):
        text = html.unescape(match.group(1)).strip()
        try:
            objects.append(json.loads(text))
        except json.JSONDecodeError:
            text = re.sub(r"/\*[\s\S]*?\*/", "", text)
            try:
                objects.append(json.loads(text))
            except json.JSONDecodeError:
                pass
    return objects


def walk_json(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def first_meta(source, *names):
    for name in names:
        pattern = rf'<meta[^>]+(?:property|name)=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']*)["\']'
        match = re.search(pattern, source, re.I)
        if match:
            return html.unescape(match.group(1)).strip()
        pattern = rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']{re.escape(name)}["\']'
        match = re.search(pattern, source, re.I)
        if match:
            return html.unescape(match.group(1)).strip()
    return ""


def title_from_html(source):
    match = re.search(r"<title[^>]*>([\s\S]*?)</title>", source, re.I)
    if not match:
        return ""
    title = clean_text(match.group(1))
    title = re.sub(r"\s*[|–-]\s*Joe'?s Venture\s*$", "", title, flags=re.I).strip()
    return title


def handle_from_url(url):
    parsed = urllib.parse.urlparse(url)
    handle = parsed.path.rstrip("/").split("/")[-1]
    return urllib.parse.unquote(handle)


def price_to_decimal(value):
    if value in (None, ""):
        return ""
    if isinstance(value, (int, float)):
        return f"{float(value):.2f}"
    text = str(value)
    match = re.search(r"\d+(?:[.,]\d+)?", text.replace(" ", ""))
    return match.group(0).replace(",", ".") if match else ""


def cents_to_decimal(value):
    if value in (None, ""):
        return ""
    try:
        return f"{float(value) / 100:.2f}"
    except (TypeError, ValueError):
        return price_to_decimal(value)


def type_names(value):
    if isinstance(value, list):
        return {str(item).lower() for item in value}
    return {str(value).lower()} if value else set()


def add_image(product, image):
    if isinstance(image, list):
        for item in image:
            add_image(product, item)
        return
    image = absolute_archive_safe_url(image)
    if not image:
        return
    if "/cdn/shop/" not in image and "/s/files/" not in image:
        return
    if image not in product["images"]:
        product["images"].append(image)


def variant_from_offer(name, offer, image="", sku=""):
    if not isinstance(offer, dict):
        offer = {}
    return {
        "id": re.search(r"variant=(\d+)", offer.get("url", "") or "").group(1) if re.search(r"variant=(\d+)", offer.get("url", "") or "") else "",
        "sku": sku or "",
        "title": name or "Default Title",
        "price": price_to_decimal(offer.get("price") or offer.get("lowPrice")),
        "image": absolute_archive_safe_url(image),
    }


def image_from_variant(variant):
    featured = variant.get("featured_image") or variant.get("featured_media") or {}
    if isinstance(featured, dict):
        preview = featured.get("preview_image")
        if isinstance(preview, dict):
            return preview.get("src", "")
        return featured.get("src", "")
    return ""


def embedded_variant_from_json(variant):
    title = variant.get("public_title") or variant.get("title") or "Default Title"
    return {
        "id": str(variant.get("id", "")),
        "sku": variant.get("sku", "") or "",
        "title": title or "Default Title",
        "price": cents_to_decimal(variant.get("price")),
        "image": absolute_archive_safe_url(image_from_variant(variant)),
        "barcode": variant.get("barcode", "") or "",
        "inventory_management": variant.get("inventory_management", "") or "",
        "available": variant.get("available", ""),
        "weight": variant.get("weight", ""),
    }


def extract_embedded_variants(source):
    variants = []
    for match in re.finditer(r'<script\s+data-variant[^>]*type=["\']application/json["\'][^>]*>([\s\S]*?)</script>', source, re.I):
        try:
            variants.append(embedded_variant_from_json(json.loads(html.unescape(match.group(1)).strip())))
        except (json.JSONDecodeError, TypeError):
            pass
    for match in re.finditer(r'(\[\{"id":\d+,"title":"[\s\S]*?"selling_plan_allocations":\[\]\}\])', source):
        try:
            for variant in json.loads(html.unescape(match.group(1))):
                variants.append(embedded_variant_from_json(variant))
        except (json.JSONDecodeError, TypeError):
            pass
    deduped = []
    seen = set()
    for variant in variants:
        key = variant.get("id") or (variant.get("title"), variant.get("price"), variant.get("sku"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(variant)
    return deduped


def extract_product(source, original, timestamp):
    handle = handle_from_url(original)
    product = {
        "handle": handle,
        "title": first_meta(source, "og:title") or title_from_html(source) or handle.replace("-", " ").title(),
        "description": first_meta(source, "og:description", "description"),
        "price": first_meta(source, "product:price:amount", "og:price:amount"),
        "currency": first_meta(source, "product:price:currency", "og:price:currency"),
        "images": [],
        "variants": [],
        "timestamp": timestamp,
        "original": original,
    }

    for obj in extract_json_objects(source):
        for node in walk_json(obj):
            types = type_names(node.get("@type") or node.get("type"))
            is_product = "product" in types
            is_product_group = "productgroup" in types
            if not is_product and not is_product_group:
                continue
            if is_product and "#variant" in str(node.get("@id", "")):
                continue
            product["title"] = node.get("name") or product["title"]
            product["description"] = clean_text(node.get("description") or product["description"])
            product["type"] = node.get("category") or product.get("type", "")
            add_image(product, node.get("image"))
            variants = node.get("hasVariant") or []
            if isinstance(variants, dict):
                variants = [variants]
            for variant in variants:
                if not isinstance(variant, dict):
                    continue
                add_image(product, variant.get("image"))
                offers = variant.get("offers") or {}
                product["variants"].append(variant_from_offer(
                    variant.get("name", "").replace(product["title"], "").strip(" -") or variant.get("name", ""),
                    offers,
                    variant.get("image", ""),
                    variant.get("sku", ""),
                ))
            offers = node.get("offers") or []
            if isinstance(offers, dict):
                offers = [offers]
            for offer in offers:
                if isinstance(offer, dict):
                    price = price_to_decimal(offer.get("price") or offer.get("lowPrice"))
                    if price:
                        product["price"] = product["price"] or price
                        product["currency"] = product["currency"] or offer.get("priceCurrency", "")
                        product["variants"].append(variant_from_offer(offer.get("name") or "Default Title", offer, node.get("image", ""), offer.get("sku") or node.get("sku", "")))

    meta_match = re.search(r"ShopifyAnalytics\.meta\s*=\s*(\{[\s\S]*?\});", source)
    if meta_match:
        try:
            meta = json.loads(meta_match.group(1))
            meta_product = meta.get("product") or {}
            product["title"] = meta_product.get("title") or product["title"]
            product["type"] = meta_product.get("type") or ""
            product["vendor"] = meta_product.get("vendor") or "Joe's Venture"
            for variant in meta_product.get("variants", []) or []:
                product["variants"].append({
                    "id": variant.get("id", ""),
                    "sku": variant.get("sku", ""),
                    "title": variant.get("public_title") or variant.get("name") or "Default Title",
                    "price": cents_to_decimal(variant.get("price")),
                })
        except json.JSONDecodeError:
            pass

    embedded_variants = extract_embedded_variants(source)
    existing_titles = {variant.get("title") for variant in product["variants"]}
    should_replace_variants = embedded_variants and (
        len(embedded_variants) >= len(product["variants"])
        or (len(existing_titles) == 1 and "Default Title" in existing_titles and len(embedded_variants) > 1)
    )
    if should_replace_variants:
        product["variants"] = embedded_variants
        for variant in embedded_variants:
            add_image(product, variant.get("image"))

    product["price"] = price_to_decimal(product["price"])
    product["images"] = [img for img in product["images"] if img.startswith("http")]
    deduped_variants = []
    seen_variants = set()
    for variant in product["variants"]:
        key = (variant.get("id", ""), variant.get("title", ""), variant.get("price", ""), variant.get("sku", ""))
        if key in seen_variants:
            continue
        seen_variants.add(key)
        deduped_variants.append(variant)
    product["variants"] = deduped_variants
    if not product["variants"]:
        product["variants"] = [{"title": "Default Title", "price": product["price"], "sku": ""}]
    return product


def row_for(product, variant, image, image_position):
    option_value = variant.get("title") or "Default Title"
    if option_value == product["title"]:
        option_value = "Default Title"
    option_parts = [part.strip() for part in option_value.split(" / ") if part.strip()][:3]
    if not option_parts:
        option_parts = ["Default Title"]
    row = {key: "" for key in CSV_HEADER}
    row.update({
        "Handle": product["handle"],
        "Title": product["title"],
        "Body (HTML)": product["description"],
        "Vendor": product.get("vendor") or "Joe's Venture",
        "Type": product.get("type", ""),
        "Published": "FALSE",
        "Option1 Name": "Title" if option_parts == ["Default Title"] else "Option 1",
        "Option1 Value": option_parts[0],
        "Option2 Name": "Option 2" if len(option_parts) > 1 else "",
        "Option2 Value": option_parts[1] if len(option_parts) > 1 else "",
        "Option3 Name": "Option 3" if len(option_parts) > 2 else "",
        "Option3 Value": option_parts[2] if len(option_parts) > 2 else "",
        "Variant SKU": variant.get("sku", ""),
        "Variant Grams": str(variant.get("weight", "")) if variant.get("weight", "") != "" else "",
        "Variant Inventory Tracker": variant.get("inventory_management", ""),
        "Variant Inventory Policy": "deny",
        "Variant Fulfillment Service": "manual",
        "Variant Price": variant.get("price") or product.get("price", ""),
        "Variant Requires Shipping": "TRUE",
        "Variant Taxable": "TRUE",
        "Variant Barcode": variant.get("barcode", ""),
        "Image Src": image,
        "Image Position": str(image_position) if image else "",
        "Image Alt Text": product["title"] if image else "",
        "Gift Card": "FALSE",
        "SEO Title": product["title"],
        "SEO Description": product["description"][:320],
        "Google Shopping / Condition": "new",
        "Status": "draft",
    })
    return row


def main():
    RAW_DIR.mkdir(exist_ok=True)
    if CDX_FILE.exists():
        cdx = json.loads(CDX_FILE.read_text(encoding="utf-8"))
    else:
        cdx = json.loads(fetch(CDX_URL).decode("utf-8"))
        CDX_FILE.write_text(json.dumps(cdx, indent=2), encoding="utf-8")
    rows = cdx[1:]
    products = []
    failures = []
    for index, (timestamp, original, mimetype, status, digest) in enumerate(rows, start=1):
        archive_url = f"https://web.archive.org/web/{timestamp}id_/{original}"
        handle = handle_from_url(original)
        raw_path = RAW_DIR / f"{timestamp}-{handle}.html"
        try:
            if raw_path.exists():
                source = raw_path.read_text(encoding="utf-8", errors="ignore")
            else:
                source = fetch(archive_url).decode("utf-8", errors="ignore")
                raw_path.write_text(source, encoding="utf-8")
                time.sleep(0.2)
            products.append(extract_product(source, original, timestamp))
        except (Exception) as exc:
            failures.append({"timestamp": timestamp, "original": original, "error": str(exc)})
        if index % 25 == 0:
            print(f"processed {index}/{len(rows)}", flush=True)

    seen = set()
    deduped = []
    for product in products:
        if product["handle"] in seen:
            continue
        seen.add(product["handle"])
        deduped.append(product)

    csv_rows = []
    variant_count = 0
    image_count = 0
    for product in deduped:
        variants = product["variants"] or [{"title": "Default Title", "price": product.get("price", ""), "sku": ""}]
        images = product["images"] or [""]
        variant_count += len(variants)
        image_count += len(product["images"])
        first = True
        for variant in variants:
            csv_rows.append(row_for(product, variant, images[0], 1 if images[0] else ""))
            first = False
        for position, image in enumerate(images[1:], start=2):
            row = {key: "" for key in CSV_HEADER}
            row.update({
                "Handle": product["handle"],
                "Image Src": image,
                "Image Position": str(position),
                "Image Alt Text": product["title"],
            })
            csv_rows.append(row)

    with CSV_FILE.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
        writer.writeheader()
        writer.writerows(csv_rows)

    SUMMARY_JSON.write_text(json.dumps({
        "cdx_rows": len(rows),
        "products_recovered": len(deduped),
        "variants_recovered": variant_count,
        "images_recovered": image_count,
        "failures": failures,
        "products": deduped,
    }, indent=2), encoding="utf-8")
    print(json.dumps({
        "cdx_rows": len(rows),
        "products_recovered": len(deduped),
        "variants_recovered": variant_count,
        "images_recovered": image_count,
        "failures": len(failures),
    }, indent=2))


if __name__ == "__main__":
    main()
