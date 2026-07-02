# Boston Vet — Technical Reference

## TDS Geo Integration

| Parameter | Value |
|---|---|
| **Client ID** | `74a7bf73-315f-4ad5-a5ec-f4f1ba4ecd8d` |
| **Slug** | `boston-vet` |
| **Service Area** | `veterinary, Egypt` |
| **Brand Voice** | Professional and compassionate veterinary care |
| **Timezone** | `Africa/Cairo` |
| **Publish Frequency** | `manual` |
| **Approval Mode** | `auto` |
| **API Key** | `kai_46f0d5d6cf30f13fd45463d8082e645323ead5c731b1b58f` |
| **Auth Header** | `X-TDS-Geo-Key` |

## WordPress Site Details

| Field | Value |
|---|---|
| **Site URL** | https://boston-vet.com |
| **WP Admin** | https://boston-vet.com/wp-admin |
| **Hosting** | Cloudflare-protected |
| **Firewall** | Cloudflare WAF (challenge mode) |

## WordPress Admin Access

| Username | Role |
|---|---|
| `tdsgeo` | Administrator |
| `TRAFFIC GEO` (display) | Administrator |

## Site Structure
- Homepage with product categories (All Animals, Poultry, Ruminants, Equine, Rabbits, Pet Animals)
- WooCommerce product catalog
- Blog with veterinary/animal health articles
- FAQ page
- About Us page
- Contact page

## Content Already Published
- Pet oral health article
- Veterinary feed formulation article
- Advancements in animal healthcare article
- Product pages (Bost Active, Bost C 100%, etc.)
- Multiple poultry feed formulations

## Notes
- This is a **WordPress-only client** (no Shopify). Shopify fields on the backend are placeholders.
- Part of Boston Group (sister site to Boston Pharma)
- Site appears to have placeholder content ("Lorem ipsum" sections) suggesting ongoing development
- Cloudflare challenge mode blocks automated API access — all plugin setup must be done via WordPress admin
