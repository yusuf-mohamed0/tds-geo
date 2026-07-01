# Client Profiles — Context

This directory contains brand profiles for every client in the TDS Geo system.

## Current Clients

| Client | Slug | Directory | Industry |
|---|---|---|---|
| Boston Pharmaceutical Industries | `boston-pharma` | `boston-pharma/` | Pharmaceutical |
| Boston Veterinary Pharmaceutical | `boston-vet` | `boston-vet/` | Veterinary |
| Acme Maintenance Co. (Traffic Test) | `acme-maintenance` | `acme-maintenance/` | Home Maintenance |

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
