#!/usr/bin/env python3
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
"""
Vireon Client Website Intelligence Scraper
===========================================
Uses Scrapling to scan client websites and extract deep contextual data
for creating perfectly tailored articles.

Usage:
    python scrape_client.py <url> [--output json_file]
    python scrape_client.py https://example.com

Output: JSON with services, tone analysis, page structure, USP, terms, etc.
"""

import json
import re
import sys
import os
from urllib.parse import urljoin, urlparse

try:
    from scrapling.fetchers import Fetcher
    from scrapling.parser import Selector
    HAS_SCRAPLING = True
except ImportError:
    HAS_SCRAPLING = False
    import requests
    from bs4 import BeautifulSoup


# ══════════════════════════════════════════════════════════════════
# SCRAPER CONFIGURATION
# ══════════════════════════════════════════════════════════════════

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

MAX_PAGES = 15
TIMEOUT_SECONDS = 15

# Pages to crawl (relative paths)
PAGES_TO_CRAWL = [
    "/", "/about", "/about-us", "/services", "/industries",
    "/contact", "/contact-us", "/blog", "/team", "/careers",
    "/pricing", "/faq", "/testimonials", "/case-studies",
    "/portfolio", "/products",
]


# ══════════════════════════════════════════════════════════════════
# MAIN SCRAPER
# ══════════════════════════════════════════════════════════════════

class ClientWebsiteScraper:
    """Scrapes a client website to extract intelligence for article generation."""

    def __init__(self, base_url: str, stealth: bool = True):
        self.base_url = base_url.rstrip("/")
        self.domain = urlparse(base_url).netloc
        self.stealth = stealth
        self.pages: dict[str, str] = {}  # path -> html content
        self.results: dict = {}
        self._normalize_url()

    def _normalize_url(self):
        """Ensure URL has scheme."""
        if not self.base_url.startswith(("http://", "https://")):
            self.base_url = "https://" + self.base_url

    # ─── Fetching ─────────────────────────────────

    def fetch_all(self) -> bool:
        """Fetch the most important pages of the website."""
        page_urls = self._discover_pages()
        fetched = 0

        for path in page_urls:
            if fetched >= MAX_PAGES:
                break
            url = urljoin(self.base_url, path)
            try:
                html = self._fetch_url(url)
                if html and len(html) > 500:
                    self.pages[path] = html
                    fetched += 1
                else:
                    self._log("skip", f"{url} - too short or empty")
            except Exception as e:
                self._log("warn", f"{url} - {e}")

        return len(self.pages) > 0

    def _discover_pages(self) -> list[str]:
        """Discover page URLs from homepage links + default crawl list."""
        discovered = set()
        homepage_html = self._fetch_url(self.base_url)

        if homepage_html:
            # Extract all internal links from homepage
            if HAS_SCRAPLING:
                page = Selector(homepage_html)
                for link in page.css("a[href]"):
                    href = link.attrib.get("href", "")
                    self._add_internal_link(discovered, href)
            else:
                soup = BeautifulSoup(homepage_html, "html.parser")
                for a in soup.find_all("a", href=True):
                    self._add_internal_link(discovered, a["href"])

        # Merge with default crawl list, preserving order
        seen = set()
        ordered = []
        for path in PAGES_TO_CRAWL + list(discovered):
            if path not in seen:
                seen.add(path)
                ordered.append(path)

        return ordered

    def _add_internal_link(self, discovered: set, href: str):
        """Parse and add internal link if it's a relative path."""
        parsed = urlparse(href)
        if not parsed.netloc or parsed.netloc == self.domain:
            path = parsed.path or "/"
            if path.startswith("/") and not path.startswith(("/wp-", "/cdn-", "/_next")):
                # Remove fragments, limit depth
                clean_path = path.split("#")[0]
                if clean_path.count("/") <= 3:  # Only shallow pages
                    discovered.add(clean_path)

    def _fetch_url(self, url: str) -> str | None:
        """Fetch a URL using Scrapling (preferred) or requests fallback (no Scrapling)."""
        try:
            if HAS_SCRAPLING and self.stealth:
                page = Fetcher.get(url, stealthy_headers=True)
                return page.content if hasattr(page, 'content') else str(page)
            elif HAS_SCRAPLING:
                page = Fetcher.get(url)
                return page.content if hasattr(page, 'content') else str(page)
            else:
                headers = {"User-Agent": USER_AGENTS[0]}
                resp = requests.get(url, headers=headers, timeout=TIMEOUT_SECONDS)
                resp.raise_for_status()
                return resp.text
        except Exception:
            return None

    # ─── Extraction ───────────────────────────────

    def extract_intelligence(self) -> dict:
        """Extract all intelligence from fetched pages."""
        if not self.pages:
            return {"error": "No pages fetched", "url": self.base_url}

        self.results = {
            "url": self.base_url,
            "domain": self.domain,
            "pages_scanned": len(self.pages),
            "pages_found": list(self.pages.keys()),
            "site_name": self._extract_site_name(),
            "description": self._extract_meta_description(),
            "keywords_meta": self._extract_meta_keywords(),
            "services": self._extract_services(),
            "industries": self._extract_industries(),
            "target_audience": self._extract_target_audience(),
            "unique_selling_points": self._extract_usp(),
            "tone_analysis": self._analyze_tone(),
            "common_terms": self._extract_common_terms(),
            "cta_patterns": self._extract_cta_patterns(),
            "page_structure": self._analyze_page_structure(),
            "contact_info": self._extract_contact_info(),
            "social_links": self._extract_social_links(),
            "tech_stack_hints": self._extract_tech_stack(),
            "content_gaps": self._suggest_content_gaps(),
            "scraped_at": None,  # filled by backend
        }

        return self.results

    def _extract_site_name(self) -> str:
        """Extract site/business name from homepage."""
        homepage = self.pages.get("/", "")
        if HAS_SCRAPLING:
            page = Selector(homepage)
            og_title = page.css('meta[property="og:site_name"]::attr(content)').get()
            if og_title:
                return og_title
            title = page.css("title::text").get()
            return title.strip() if title else self.domain
        else:
            soup = BeautifulSoup(homepage, "html.parser")
            og = soup.find("meta", property="og:site_name")
            if og and og.get("content"):
                return og["content"]
            title = soup.find("title")
            return title.get_text(strip=True) if title else self.domain

    def _extract_meta_description(self) -> str:
        """Extract meta description from homepage."""
        homepage = self.pages.get("/", "")
        if HAS_SCRAPLING:
            page = Selector(homepage)
            desc = page.css('meta[name="description"]::attr(content)').get()
            return desc or ""
        else:
            soup = BeautifulSoup(homepage, "html.parser")
            tag = soup.find("meta", attrs={"name": "description"})
            return tag.get("content", "") if tag else ""

    def _extract_meta_keywords(self) -> list[str]:
        """Extract meta keywords."""
        homepage = self.pages.get("/", "")
        if HAS_SCRAPLING:
            page = Selector(homepage)
            kw = page.css('meta[name="keywords"]::attr(content)').get()
            return [k.strip() for k in kw.split(",")] if kw else []
        else:
            soup = BeautifulSoup(homepage, "html.parser")
            tag = soup.find("meta", attrs={"name": "keywords"})
            if tag and tag.get("content"):
                return [k.strip() for k in tag["content"].split(",")]
            return []

    def _extract_services(self) -> list[dict]:
        """Extract services/products mentioned across pages."""
        services = []
        seen_names = set()

        for path, html in self.pages.items():
            text = self._get_text(html)

            # Look for service-like headings and list items
            if HAS_SCRAPLING:
                page = Selector(html)
                # Service sections often have h2/h3 with service names
                for heading in page.css("h2, h3, h4"):
                    text_content = heading.css("::text").get()
                    if not text_content or len(text_content) > 10:
                        continue  # Skip None or long headings (not service names)
                    if text_content not in seen_names:
                        # Check if followed by a description paragraph
                        next_p = heading.css("~ p::text").get() or ""
                        services.append({
                            "name": text_content.strip(),
                            "description": next_p.strip()[:300],
                            "page": path,
                        })
                        seen_names.add(text_content)

        return services[:20]  # Limit to top 20

    def _extract_industries(self) -> list[str]:
        """Extract industries served."""
        industries = set()
        keywords = [
            "industry", "industries", "we serve", "sectors",
            "clients in", "healthcare", "ecommerce", "retail",
            "technology", "finance", "hospitality", "education",
            "real estate", "manufacturing", "logistics",
        ]

        for html in self.pages.values():
            text = self._get_text(html).lower()
            for kw in keywords:
                if kw in text:
                    # Extract the sentence containing the keyword
                    sentences = re.split(r'[.!?\n]', text)
                    for s in sentences:
                        if kw in s and len(s) < 200:
                            industries.add(s.strip())

        return list(industries)[:10]

    def _extract_target_audience(self) -> list[str]:
        """Extract target audience descriptions."""
        audience = []
        keywords = [
            "for businesses", "for companies", "for enterprises",
            "for startups", "for smbs", "for agencies",
            "we help", "our clients", "serving",
            "homeowners", "property", "professionals",
        ]

        for html in self.pages.values():
            text = self._get_text(html).lower()
            for kw in keywords:
                if kw in text:
                    sentences = re.split(r'[.!?\n]', text)
                    for s in sentences:
                        if kw in s and len(s) < 200:
                            audience.append(s.strip())

        return audience[:10]

    def _extract_usp(self) -> list[str]:
        """Extract unique selling points / value propositions."""
        usp = []
        indicators = [
            "why choose", "why us", "what sets us apart",
            "our advantage", "we are different",
            "we offer", "we provide", "our commitment",
            "trusted", "award-winning", "leading",
            "years of experience", "certified", "guaranteed",
        ]

        for path, html in self.pages.items():
            # Look for specific USP sections
            if HAS_SCRAPLING:
                page = Selector(html)
                for indicator in indicators:
                    # Find elements containing USP indicators
                    elements = page.css(f"*:has-text('{indicator}')")
                    for el in elements:
                        parent_text = el.css("::text").getall()
                        full = " ".join(parent_text).strip()
                        if full and len(full) < 500:
                            usp.append(full)

            # Text-based fallback
            text = self._get_text(html)
            for indicator in indicators:
                if indicator in text.lower():
                    idx = text.lower().index(indicator)
                    snippet = text[idx:idx + 400]
                    usp.append(snippet.strip())

        # Deduplicate
        seen = set()
        unique_usp = []
        for u in usp:
            if u not in seen:
                seen.add(u)
                unique_usp.append(u)

        return unique_usp[:10]

    def _analyze_tone(self) -> dict:
        """Analyze the writing tone of the website."""
        all_text = " ".join(self._get_text(html) for html in self.pages.values())

        tone_indicators = {
            "professional": ["expert", "professional", "certified", "trusted", "quality", "standards"],
            "friendly": ["welcome", "let us", "we love", "we care", "friendly", "supportive"],
            "authoritative": ["leading", "award", "industry", "recognized", "proven", "results"],
            "educational": ["learn", "guide", "tips", "how to", "understand", "resources"],
            "urgent": ["now", "today", "limited", "hurry", "don't wait", "act now"],
            "empathetic": ["we understand", "we know", "challenge", "struggle", "support"],
        }

        scores = {}
        for tone, indicators in tone_indicators.items():
            count = sum(1 for ind in indicators if ind in all_text.lower())
            scores[tone] = count

        # Determine primary and secondary tones
        sorted_tones = sorted(scores.items(), key=lambda x: -x[1])
        primary = sorted_tones[0][0] if sorted_tones else "professional"
        secondary = sorted_tones[1][0] if len(sorted_tones) > 1 else "educational"

        return {
            "primary_tone": primary,
            "secondary_tone": secondary,
            "tone_scores": scores,
            "formality_estimate": self._estimate_formality(all_text),
        }

    def _estimate_formality(self, text: str) -> float:
        """Estimate formality level (0-1)."""
        formal_indicators = ["therefore", "however", "furthermore", "nevertheless",
                            "consequently", "accordingly", "thus", "hence"]
        informal_indicators = ["gonna", "wanna", "awesome", "cool", "guys",
                              "hey", "check out", "stuff", "things"]

        text_lower = text.lower()
        formal_count = sum(1 for w in formal_indicators if w in text_lower)
        informal_count = sum(1 for w in informal_indicators if w in text_lower)
        total = formal_count + informal_count

        if total == 0:
            return 0.7  # Default: moderately formal

        return round(formal_count / total, 2)

    def _extract_common_terms(self) -> list[str]:
        """Extract industry-specific terms and jargon."""
        all_text = " ".join(self._get_text(html) for html in self.pages.values())
        words = re.findall(r'\b[A-Z][a-z]{2,}\b', all_text)  # Capitalized words

        # Count frequency
        from collections import Counter
        word_counts = Counter(words)

        # Filter out common words, keep industry-specific
        stop_words = {"The", "This", "That", "What", "When", "Where",
                     "How", "Why", "Our", "Your", "We", "They", "Are",
                     "Not", "But", "For", "All", "Will", "Can", "Has"}
        industry_terms = [
            word for word, count in word_counts.most_common(30)
            if word not in stop_words and len(word) > 3 and count >= 2
        ]

        return industry_terms[:20]

    def _extract_cta_patterns(self) -> list[dict]:
        """Extract call-to-action patterns."""
        ctas = []
        for path, html in self.pages.items():
            if HAS_SCRAPLING:
                page = Selector(html)
                # Buttons and links with CTA-like text
                for el in page.css("a, button, .btn, .cta, [class*=cta]"):
                    text = el.css("::text").get()
                    href = el.attrib.get("href", "") if hasattr(el, 'attrib') else ""
                    if text and len(text.strip()) < 100:
                        ctas.append({
                            "text": text.strip(),
                            "url": href,
                            "page": path,
                        })
            else:
                soup = BeautifulSoup(html, "html.parser")
                for el in soup.find_all(["a", "button"], class_=re.compile(r"cta|btn", re.I)):
                    text = el.get_text(strip=True)
                    href = el.get("href", "")
                    if text and len(text) < 100:
                        ctas.append({"text": text, "url": href, "page": path})

        return ctas[:10]

    def _analyze_page_structure(self) -> dict:
        """Analyze heading structure to understand content hierarchy."""
        h_structure = {"h1": [], "h2": [], "h3": []}

        for path, html in self.pages.items():
            if HAS_SCRAPLING:
                page = Selector(html)
                for tag in ["h1", "h2", "h3"]:
                    for el in page.css(tag):
                        text = el.css("::text").get()
                        if text:
                            h_structure[tag].append({
                                "text": text.strip(),
                                "page": path,
                            })
            else:
                soup = BeautifulSoup(html, "html.parser")
                for tag in ["h1", "h2", "h3"]:
                    for el in soup.find_all(tag):
                        text = el.get_text(strip=True)
                        if text:
                            h_structure[tag].append({"text": text, "page": path})

        # Deduplicate headings
        for tag in h_structure:
            seen = set()
            h_structure[tag] = [
                h for h in h_structure[tag]
                if h["text"] not in seen and not seen.add(h["text"])
            ]

        return h_structure

    def _extract_contact_info(self) -> dict:
        """Extract contact information."""
        info = {"email": [], "phone": [], "address": []}

        for html in self.pages.values():
            text = html

            # Email pattern
            emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
            info["email"] = list(set(emails))[:3]

            # Phone pattern (international and local)
            phones = re.findall(r'(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}', text)
            info["phone"] = [p.strip() for p in phones if p.strip()][:3]

            # Address (look for structured address patterns)
            address_indicators = ["street", "st.", "avenue", "ave", "road", "rd",
                                 "building", "floor", "cairo", "egypt"]
            sentences = re.split(r'[.!?\n]', text)
            for s in sentences:
                if any(ind in s.lower() for ind in address_indicators):
                    info["address"].append(s.strip())

        info["address"] = info["address"][:3]
        return info

    def _extract_social_links(self) -> list[dict]:
        """Extract social media links."""
        social_domains = {
            "facebook.com": "Facebook",
            "linkedin.com": "LinkedIn",
            "twitter.com": "X (Twitter)",
            "instagram.com": "Instagram",
            "youtube.com": "YouTube",
            "tiktok.com": "TikTok",
            "behance.net": "Behance",
        }

        links = []
        for html in self.pages.values():
            if HAS_SCRAPLING:
                page = Selector(html)
                for a in page.css("a[href]"):
                    href = a.attrib.get("href", "")
                    for domain, name in social_domains.items():
                        if domain in href and href not in [l["url"] for l in links]:
                            links.append({"platform": name, "url": href})
            else:
                soup = BeautifulSoup(html, "html.parser")
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    for domain, name in social_domains.items():
                        if domain in href and href not in [l["url"] for l in links]:
                            links.append({"platform": name, "url": href})

        return links

    def _extract_tech_stack(self) -> list[str]:
        """Detect technology stack hints from HTML."""
        hints = []
        for html in self.pages.values():
            if "/wp-content/" in html:
                hints.append("WordPress")
            if "shopify" in html or "myshopify.com" in html:
                hints.append("Shopify")
            if "/_next/" in html:
                hints.append("Next.js")
            if "webflow" in html:
                hints.append("Webflow")
            if "wix" in html:
                hints.append("Wix")
            if "squareup" in html or "squarespace" in html:
                hints.append("Squarespace")
            if "elementor" in html:
                hints.append("Elementor")
            if "wp-content/plugins/woocommerce" in html:
                hints.append("WooCommerce")

        return list(set(hints))[:5]

    def _suggest_content_gaps(self) -> list[str]:
        """Suggest potential content topics based on missing pages."""
        existing = set(self.pages.keys())
        gaps = []

        content_topics = [
            ("/blog", "Blog"),
            ("/faq", "FAQ page"),
            ("/testimonials", "Testimonials"),
            ("/case-studies", "Case studies"),
            ("/pricing", "Pricing"),
            ("/resources", "Resources hub"),
            ("/guides", "Guides library"),
        ]

        for path, name in content_topics:
            if path not in existing and not any(p.startswith(path) for p in existing):
                gaps.append(f"Missing: {name}")

        return gaps[:8]

    # ─── Utilities ────────────────────────────────

    def _get_text(self, html: str) -> str:
        """Extract readable text from HTML."""
        # Remove script and style tags
        cleaned = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        cleaned = re.sub(r'<style[^>]*>.*?</style>', '', cleaned, flags=re.DOTALL)
        # Get text content
        text = re.sub(r'<[^>]+>', ' ', cleaned)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _log(self, level: str, message: str):
        """Simple logging to stderr."""
        prefix = {"skip": "  ⏭", "warn": "  ⚠", "ok": "  ✅", "info": "  ℹ"}.get(level, "  •")
        print(f"{prefix} {message}", file=sys.stderr)

    # ─── Output ───────────────────────────────────

    def to_json(self, indent: int = 2) -> str:
        """Return results as JSON string."""
        return json.dumps(self.results, indent=indent, ensure_ascii=False, default=str)

    def save_to_file(self, filepath: str):
        """Save results to a JSON file."""
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(self.to_json())
        self._log("ok", f"Saved intelligence to {filepath}")


# ══════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ══════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Usage: python scrape_client.py <url> [--output file.json] [--no-stealth]")
        sys.exit(1)

    url = sys.argv[1]
    output = None
    stealth = True

    # Parse optional args
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output = sys.argv[idx + 1]
    if "--no-stealth" in sys.argv:
        stealth = False

    print(f"\n🔍 Scanning: {url}", file=sys.stderr)
    print(f"   Scrapling: {'✅ v' + __import__('scrapling').__version__ if HAS_SCRAPLING else '❌ not found (using requests/bs4)'}", file=sys.stderr)

    scraper = ClientWebsiteScraper(url, stealth=stealth)

    print(f"   Fetching pages...", file=sys.stderr)
    success = scraper.fetch_all()

    if not success:
        print(f"   ❌ Failed to fetch any pages from {url}", file=sys.stderr)
        print(json.dumps({"error": "No pages fetched", "url": url}))
        sys.exit(1)

    print(f"   ✅ Fetched {len(scraper.pages)} pages: {', '.join(list(scraper.pages.keys())[:5])}...", file=sys.stderr)

    print(f"   Extracting intelligence...", file=sys.stderr)
    results = scraper.extract_intelligence()

    if output:
        scraper.save_to_file(output)
    else:
        # Print JSON to stdout for piping
        print(scraper.to_json())


if __name__ == "__main__":
    main()
