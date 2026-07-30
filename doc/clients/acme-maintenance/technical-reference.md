# ACME Facility Maintenance — Technical Reference

## Platform Overview

| Field | Value |
|---|---|
| **Website** | https://acme-maintenance.com |
| **CMS** | WordPress 6.9.5 |
| **Theme** | ColorMag v4.2.1 by ThemeGrill |
| **Page Builder** | SiteOrigin Panels v2.35.0 |
| **Hosting** | GoDaddy |
| **CDN** | None |
| **Caching Plugin** | None |
| **SSL** | Standard (GoDaddy-managed) |
| **Site Type** | Brochure / informational site (no e-commerce) |

## Active Plugins

| Plugin | Version | Purpose |
|---|---|---|
| SiteOrigin Page Builder | 2.35.0 | Drag-and-drop page layout builder |
| SiteOrigin Widgets Bundle | — | Widget library for Page Builder |
| Use Any Font | — | Custom font embedding |
| Responsive Client Logo Carousel Slider | — | Brand partner logo carousel on homepage |
| Fonts Plugin | — | Self-hosted Century Gothic delivery |
| GoDaddy Launch | — | GoDaddy hosting management |

## REST API

- **Endpoint:** https://acme-maintenance.com/wp-json/
- **Status:** Accessible (default WordPress REST API)
- **TDS Integration:** No API key configured yet
- **Authentication:** None currently configured (standard public REST API)

## Themes

- 1 active theme: ColorMag v4.2.1 (child theme modifications possible)
- No unused themes detected on the live site

## Content Architecture

- **Total Pages:** 5 informational pages
  - Homepage
  - Generators
  - Industrial Equipment
  - Industrial Tools
  - PPE & Safety Items
- **Blog Posts:** 0 (no blog enabled)
- **Media Library:** Logo, brand partner logos (65+), product images
- **Navigation:** Primary nav linking to all 5 pages, no dropdowns

## Performance Profile

| Metric | Assessment |
|---|---|
| Hosting | GoDaddy shared hosting (no VPS/cloud) |
| Cache | None — no server-side or browser caching plugin |
| CDN | None — all assets served directly from origin |
| Image Optimization | Not detected (likely unoptimized uploads) |
| JS/CSS Minification | Not detected |
| Page Speed | Likely slow due to no caching, no CDN, no optimization |

## Contact Details

| Channel | Value |
|---|---|
| Email | sales@acme-maintenance.com |
| Phone | 281-541-2181 |
| Address | 507 N. Sam Houston Parkway E., STE 600P, Houston, TX 77060 |
| Contact Form | Sales Inquiry form on website |

## OAuth / API Keys

| Service | Status |
|---|---|
| TDS Geo API Key | Not configured |
| WordPress REST API | Open (no auth) |
| Shopify | Not applicable (not a Shopify store) |
| Google Analytics | Not detected |
| Google Search Console | Not detected |

## Infrastructure Notes

- No e-commerce functionality — purely a lead generation / brochure site
- No membership, login, or user registration features
- No multilingual support (English only)
- Simple contact form on site (no third-party form builder detected — likely native WordPress form or embedded)
- No newsletter or email marketing integration detected
- No social media sharing features detected

## TDS Geo Integration Status

| Item | Status | Notes |
|---|---|---|
| Client Record | ✅ Created | slug: `acme-maintenance` |
| Brand Profile | ✅ Complete | `brand-profile.md` |
| Technical Ref | ✅ Complete | This file |
| SEO Guide | ✅ Complete | `seo-content-guide.md` |
| Contacts | ✅ Complete | `contacts.md` |
| Full Profile | ✅ Complete | `full-profile.md` |
| API Key Generated | ❌ Not yet | Needs manual key creation in TDS |
| Content Pipeline | ❌ Not started | No WordPress content plugin exists yet |
| Analytics Setup | ❌ Not started | GA4 + Search Console recommended |
| SEO Plugin Install | ❌ Not started | RankMath or Yoast needed |
