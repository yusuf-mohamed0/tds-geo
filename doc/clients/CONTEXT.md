# Client Profiles — Context

This directory contains brand profiles for every client in the TDS Geo system.

## Current Clients

| Client | Slug | Directory | Industry |
|---|---|---|---|
| Alamein Outdoor Furniture | `alamein-2022` | `alamein-2022/` | Outdoor furniture, playgrounds, fitness, commercial furniture |
| Boston Pharmaceutical Industries | `boston-pharma` | `boston-pharma/` | Pharmaceutical |
| Boston Veterinary Pharmaceutical | `boston-vet` | `boston-vet/` | Veterinary |
| Caravanserai | `caravanserai` | `caravanserai/` | Home decor, gifts, Egyptian craftsmanship |
| Flaunt Cosmetics Global | `flaunt-cosmetics-global` | `flaunt-cosmetics-global/` | Cosmetics / beauty |

See `APP-PROCESSES.md` for the production app process index and per-client operating runbooks.

## Non-Production / Historical Profiles

| Client | Slug | Directory | Rule |
|---|---|---|---|
| Traffic Test | `traffic-test` | `traffic-test/` | Inactive/cancelled; do not publish. |
| Joe's Venture | `joes-venture` | `joes-venture/` | Documented only; OAuth/client row pending. |
| Acme Maintenance Co. | `acme-maintenance` | `acme-maintenance/` | Historical docs; production DB row was corrected away from this client. |

## Onboarding Process

When a new client is added:

1. **Create `doc/clients/{slug}/`** directory
2. **Copy `_template.md`** as starting point
3. **Research & populate** all sections:
   - Scrape website for brand/colors/fonts/logos
   - Research company on LinkedIn, social media, directories
   - Extract CSS color palette and typography
   - Document all tech stack (CMS, plugins, integrations)
   - Record all contacts, emails, phones
   - Define SEO content pillars and keywords
4. **Save as `doc/clients/{slug}/`** with files:
   - `brand-profile.md` — full brand intelligence
   - `technical-reference.md` — integration details
   - `seo-content-guide.md` — content strategy
   - `contacts.md` — people and access
5. **Commit and push** to GitHub
