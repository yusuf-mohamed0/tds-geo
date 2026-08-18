# Client Profile: Boston Veterinary Pharmaceutical

---

## 1. Identity & Profile

| Field | Value |
|---|---|
| Name | Boston Veterinary Pharmaceutical |
| Trading As | Boston Vet, Boston Veterinary Care |
| Slug | boston-vet |
| Shop | boston-vet-wordpress |
| Industry | Veterinary pharmaceutical / Animal health |
| Platform | WordPress / WooCommerce |
| Timezone | Africa/Cairo |
| Service area | veterinary, Egypt |
| Parent | Boston Group (shared with Boston Pharma) |
| Group Founder | Dr. Abdalmonem Alanani |
| Website | https://boston-vet.com |
| Group Site | https://bostongroup-eg.com |
| Sister Sites | Boston Pharma (human pharma), Boston Food, Future Agriculture |
| Status | BLOCKED (Cloudflare WAF) |

**Brand Profile:** Created at `doc/clients/boston-vet/brand-profile.md`.
**Technical Reference:** Created at `doc/clients/boston-vet/technical-reference.md`.
**SEO Content Guide:** Created at `doc/clients/boston-vet/seo-content-guide.md`.
**Writer Role:** Created at `doc/clients/boston-vet/writer-role.md`.
**Contacts:** Created at `doc/clients/boston-vet/contacts.md`.

### Contact

No direct contact person identified for Boston Vet. Site is managed by the same team as Boston Pharma within Boston Group. Shared parent contact may apply:

| Contact | Detail |
|---|---|
| Group Email | info@bostongroup-eg.com |
| Export Email | export@bostongroup-eg.com |
| Group Phone | +20 15 01000681 |
| Group Address | Fifth Settlement, Cairo, Egypt |

---

## GEO Analysis / Citation Tracking

| Field | Value |
|---|---|
| Primary Domain | `boston-vet.com` |
| Site URL | `https://boston-vet.com` |
| Group Site | `https://bostongroup-eg.com` |
| Citation Search Domain | `boston-vet.com` |
| AI Engines to Track | ChatGPT, Perplexity, Gemini, Claude, Copilot, Grok, DeepSeek |
| Status | BLOCKED — cannot verify citations until Cloudflare is resolved |

---

## 2. Technical Details

### Kivo Geo Integration

| Parameter | Value |
|---|---|
| Client ID | 74a7bf73-315f-4ad5-a5ec-f4f1ba4ecd8d |
| API Key | <redacted — see local credential store> |
| Auth Header | X-TDS-Geo-Key |
| Publish Frequency | manual |
| Approval Mode | auto |
| Service Area | veterinary, Egypt |
| Brand Voice | Professional and compassionate veterinary care |

### WordPress Site

| Field | Value |
|---|---|
| Site URL | https://boston-vet.com |
| WP Admin | https://boston-vet.com/wp-admin |
| XML Sitemap | https://boston-vet.com/wp-sitemap.xml |
| Hosting | Cloudflare-protected |
| Firewall | Cloudflare WAF (challenge mode) |
| Theme | Likely Salient by ThemeNectar (same as Boston Pharma) |
| Page Builder | Likely WPBakery (same as Boston Pharma) |
| Expected CMS | WordPress (exact version unknown -- blocked) |
| Expected PHP | Unknown (blocked) |

### WordPress Admin Users

| Username | Display Name | Role |
|---|---|---|
| tdsgeo | TRAFFIC GEO | Administrator |

### Site Structure (estimated, based on Boston Pharma)

- Homepage with product category navigation
- WooCommerce product catalog (All Animals, Poultry, Ruminants, Equine, Rabbits, Pet Animals)
- Blog section for veterinary/animal health articles
- About Us page
- FAQ page
- Contact page

---

## 3. Content Status

| Item | Count | Notes |
|---|---|---|
| Published articles | 0 (estimated) | Minimal to no published content |
| Draft articles | Unknown | Some may exist from early pipeline runs |
| Products | Unknown | Likely same WooCommerce structure as Boston Pharma (76+ products) |
| Product descriptions | Unknown | Likely incomplete -- site appears to have placeholder content |
| Sitemap pages indexed | 0 | Cannot verify -- blocked by Cloudflare |
| Kivo Geo articles generated | Unknown | Writer role created but no evidence of published pipeline output |

Brand differentiation from Boston Pharma is lacking -- same visual identity, same parent company, same platform stack. Site may still show "Lorem ipsum" placeholder sections.

---

## 4. Weak Points & Improvements

### Critical

| # | Issue | Detail | Fix | Priority |
|---|---|---|---|---|
| BV-1 | **FULLY BLOCKED by Cloudflare** | Production server IP (16.192.29.174) returns 403 on all endpoints: homepage, API, wp-admin, Kivo Geo plugin, sitemap.xml. No automated or manual publishing possible. | Add IP 16.192.29.174 to Cloudflare WAF Allow list under Security -> WAF -> Tools -> IP Access Rules -> Allow. | Critical |
| BV-2 | **Cannot verify site health** | Zero diagnostic data available. Unknown: WP version, PHP version, plugin status, active theme, security patches, DB health. | After IP whitelisting, run full site audit. | Critical |

### High

| # | Issue | Detail | Fix | Priority |
|---|---|---|---|---|
| BV-3 | **Likely $0 product pricing** | Built by same team as Boston Pharma on same WooCommerce setup. Boston Pharma has 76 products at $0 price. Same issue expected here. | Log into wp-admin -> WooCommerce -> Products -> check prices. Fix per Boston Pharma playbook. | High |
| BV-4 | **No direct client contact** | No phone, email, or named contact for Boston Vet specifically. Site owner contact is unknown. | Check wp-admin -> Users for admin email. Check site footer/contact page. | High |
| BV-5 | **Kivo Geo plugin status unknown** | Plugin may not be installed, activated, or configured. No way to verify until Cloudflare is resolved. | After IP whitelisted, check Plugins -> Kivo Geo is active. Re-install if needed. | High |
| BV-6 | **No content published** | Zero published articles. Unlike Boston Pharma (20+ articles), Boston Vet has no content foundation. SEO is nonexistent. | Generate and publish 12-24 articles per month using the writer role and content guide. | High |

### Medium

| # | Issue | Detail | Fix | Priority |
|---|---|---|---|---|
| BV-7 | **No brand differentiation from Boston Pharma** | Same parent company (Boston Group), same visual identity, same logo family. Site does not establish a distinct veterinary identity. | Use green/animal-health color accents. Keep all content 100% veterinary-focused. Consider distinct tagline. | Medium |
| BV-8 | **Site health unknown** | Cannot assess: TTFB, caching, security headers, SSL config, mobile responsiveness, Core Web Vitals. | Run full Lighthouse/GTmetrix audit after unblock. | Medium |
| BV-9 | **Placeholder content likely present** | Sister site Boston Pharma had "Lorem ipsum" sections. Same may apply here, damaging credibility. | After unblock, review all pages for placeholder text and replace with real copy. | Medium |

### Low

| # | Issue | Detail | Fix | Priority |
|---|---|---|---|---|
| BV-10 | **No analytics visibility** | Cannot confirm GA4, Meta Pixel, or any tracking is installed. | Check plugins and site footer for analytics snippets. Install GA4 if missing. | Low |
| BV-11 | **Shared hosting scalability** | Likely same Bluehost/Endurance shared hosting as Boston Pharma. Limited resources. | Monitor traffic post-launch. Upgrade to VPS if traffic exceeds 500 visitors/day. | Low |

---

## 5. Next Actions

| # | Action | Owner | Depends On |
|---|---|---|---|
| 1 | Get IP 16.192.29.174 whitelisted in Cloudflare WAF | TDS / Client | Client action on Cloudflare dashboard |
| 2 | Run full site audit (Lighthouse, GTmetrix, SEO audit) | TDS | After #1 |
| 3 | Check Kivo Geo plugin status -- install/activate if missing | TDS | After #1 |
| 4 | Check product pricing in WooCommerce | TDS | After #1 |
| 5 | Verify WP version, PHP version, active plugins | TDS | After #1 |
| 6 | Review site for placeholder/lorem content | TDS | After #1 |
| 7 | Start content generation per SEO content guide | TDS | After #1, #3 |
| 8 | Establish distinct brand identity vs Boston Pharma | TDS / Client | After #1 |
| 9 | Set up analytics tracking | TDS | After #1 |
| 10 | Schedule recurring weekly publishing (Thu 1PM Cairo) | TDS | After #7 |

---

## 6. Notes

- This client is fully blocked by Cloudflare WAF as of Jul 8, 2026. No progress can be made on content, SEO, or site maintenance until the production server IP is whitelisted.
- Boston Vet is the veterinary/animal health arm of Boston Group, sharing infrastructure, team, and likely hosting with Boston Pharma.
- The Kivo Geo backend is fully configured for this client (client ID, API key, service area, brand voice) and ready to publish as soon as the plugin is verified and the firewall is resolved.
- All existing documentation (brand profile, technical reference, SEO content guide, writer role, contacts) was created proactively in Jul 2026 and is ready for execution.
- The site structure is assumed to mirror Boston Pharma based on shared parent company and same development team.
- Update `doc/DASHBOARD.md` after each session with this client.
- See `doc/clients/weak-points.md` for the full cross-client remediation matrix.
