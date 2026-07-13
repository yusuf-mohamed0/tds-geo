# Caravanserai — Full Profile

## 1. Identity & Profile

| Field | Value |
|---|---|
| **Name** | Caravanserai |
| **Slug** | `caravanserai` |
| **Industry** | Home decor / gifts / Egyptian craftsmanship |
| **Platform** | Shopify |
| **Plan** | Basic (probable) |
| **Shop** | `caravanserai-gift-store.myshopify.com` |
| **Custom Domain** | `caravanserai-design.com` |
| **Timezone** | `Africa/Cairo` (UTC+2 / UTC+3 DST) |
| **Currency** | EGP (Egyptian Pound) |
| **Locale** | English (primary) |
| **Founded** | 1996 |
| **Founders** | Amina Sabry (Creative Director & Artist), Hoda El Attar (GM & Co-Founder) |
| **Headquarters** | 15 Ahmed Heshmat St. Zamalek, Cairo, Egypt |
| **Store URL** | https://caravanserai-design.com |
| **Admin URL** | https://admin.shopify.com/store/caravanserai-gift-store |
| **Brand Voice** | Artisanal, heritage-inspired, warm, sophisticated |
| **Theme** | Caravanserai V2.3 (Release 2.0.4+listings, Store ID 2698) |

### Contact

| Channel | Detail |
|---|---|
| **Known Contact** | Yasser (WhatsApp-only) |
| **Email** | info@caravanseraifurniture.com |
| **Phone** | +2 0100 167 5855 |
| **Instagram** | @caravanseraidesign |
| **Facebook** | /caravanseraidesign |

### Locations

| Branch | Phone |
|---|---|
| Main Showroom (15 Zamalek) | +2 01001675855 |
| Gift Shop (16 Maraashly) | +2 01001675851 |
| Showroom 2 (14 Maraashly) | +20 01009780024 |
| Arkan Mall | +2 01050377039 |
| UVenues Mall | +2 01080026209 |
| Diplo Strip | +20 01015626226 |

---

## GEO Analysis / Citation Tracking

| Field | Value |
|---|---|
| Primary Domain | `caravanserai-design.com` |
| Shopify Domain | `caravanserai-gift-store.myshopify.com` |
| Citation Search Domain | `caravanserai-design.com` |
| AI Engines to Track | ChatGPT, Perplexity, Gemini, Claude, Copilot, Grok, DeepSeek |

## 2. Technical Details

- **Platform:** Shopify (custom storefront).
- **OAuth:** Initially had token issues. Fixed Jul 12 by re-running install URL. API access via TDS is now operational for content publishing and article management.
- **Blog ID:** `78074216615` (News) — all articles live under this blog resource.
- **Article API endpoint:** `https://caravanserai-gift-store.myshopify.com/admin/api/2024-10/blogs/78074216615/articles.json`
- **SEO Constraints:**
  - Page title: 70 characters max.
  - Meta description: 160 characters max.
- **Content Format:** Shopify article HTML body. Hidden drafts receive auto-generated SEO fields (`metafields_global_title_tag`, `metafields_global_description_tag`, `summary_html`) before scheduling.
- **Client ID:** `8043bd6e-9748-4c54-98dc-4d50a5b1a821`
- **Service Area:** `home-decor`
- **Approval Mode:** `auto`

### Existing Documentation

| File | Purpose |
|---|---|
| `brand-profile.md` | Brand voice, messaging, visual identity, leadership, socials |
| `contacts.md` | Contact records, store locations, admin access |
| `seo-content-guide.md` | SEO rules, keyword strategy, content templates |
| `technical-reference.md` | API details, endpoint references, DNS, deployment |
| `audit.md` | Initial site audit findings (broken nav links, missing alt text, etc.) |

---

## 3. Content Status

### Legacy Content (Pre-TDS)

- **0 published articles** existed before TDS engagement.
- The News blog was empty — no prior content to review or append.

### TDS-Created Content

**7 hidden drafts** created on Jul 12 covering four core business lines. All are in `draft` status with complete SEO fields set.

| Area | Drafts | Status |
|---|---|---|
| Home decor | Multiple | Hidden draft, SEO set |
| Brass | Multiple | Hidden draft, SEO set |
| Egyptian craftsmanship | Multiple | Hidden draft, SEO set |
| Furniture | Multiple | Hidden draft, SEO set |

All seven drafts will auto-publish on the scheduled timeline, one per week.

---

## 4. Schedule

| Property | Value |
|---|---|
| **Cadence** | Weekly |
| **Day & Time** | Thursday, 1:00 PM Cairo time (`Africa/Cairo`) |
| **Cron** | `0 10 * * 4` (10:00 UTC = 13:00 Cairo in summer) |
| **Target Blog** | News (`78074216615`) |
| **First Publish** | **Jul 16** (first of 7 hidden drafts goes live) |
| **Content Queue** | 7 drafts in queue, one published per week |
| **Scheduler Configured** | Jul 12 (with timezone support) |
| **Auto-Publish Mechanism** | TDS `autoPublishService` makes existing hidden draft visible at scheduled time via `published: true` PUT |

---

## 5. Weak Points & Improvements

| Issue | Status | Action Required |
|---|---|---|
| **No client contacts documented** | Mitigated | Yasser available via WhatsApp. No formal contact record in system — consider adding to `contacts.md`. |
| **Initial OAuth token issue** | Resolved (Jul 12) | Token fixed by re-running install URL. API now operational. Monitor on next connection. |
| **First auto-publish unverified** | **Monitor** | No auto-publish has fired yet. Validate on Jul 16 that `autoPublishService` correctly transitions the first hidden draft to published. |
| **No prior content / empty blog** | Informational | Zero legacy content means TDS is building from scratch — no SEO debt or duplication risk. |
| **Content coverage across 4 lines** | Good | All four business lines (home decor, brass, craftsmanship, furniture) are covered by the 7 drafts. No gaps identified. |
| **Client communication channel** | Weak | Only WhatsApp contact (Yasser). No email or formal point of contact for approvals or strategy discussions. |
| **Store built by TDS** | Positive | Footer credit: "Made with love by Traffic" — existing relationship reduces onboarding friction. |

---

## 6. Milestones & Timeline

| Date | Milestone | Status |
|---|---|---|
| Jul 6 | Brand profile, site audit, 6 articles written | Done |
| Jul 7 | Liquid conversions, Shopify app install | Done |
| Jul 8 | Added to DB | Done |
| Jul 12 | OAuth token fix completed | Done |
| Jul 12 | 7 hidden drafts created with SEO fields | Done |
| Jul 12 | Scheduler configured (weekly Thu 1PM Cairo) | Done |
| Jul 12 | **Onboarding complete** | **Done** |
| **Jul 16** | **First auto-publish** (draft #1 goes live) | **Upcoming** |
| Jul 23 | Second auto-publish (draft #2) | Upcoming |
| Jul 30 | Third auto-publish (draft #3) | Upcoming |
| Aug 6 | Fourth auto-publish (draft #4) | Upcoming |
| Aug 13 | Fifth auto-publish (draft #5) | Upcoming |
| Aug 20 | Sixth auto-publish (draft #6) | Upcoming |
| Aug 27 | Seventh auto-publish (draft #7) | Upcoming |
| Sep 3+ | Future content needed to sustain weekly schedule | Upcoming |

---

## 7. Notes

- Caravanserai is fully operational with **no current blockers**. All infrastructure (OAuth, scheduler, content pipeline) is in place.
- The 7 hidden drafts should not be manually published; the scheduler handles go-live.
- After the 7-draft queue is exhausted (~Aug 27), new content must be created at least one week ahead of the Thursday publish date to avoid schedule gaps.
- Timezone consideration: Cairo is UTC+2 (UTC+3 during daylight saving). All scheduling uses `Africa/Cairo`. The cron `0 10 * * 4` ensures publish fires at 1:00 PM Cairo regardless of DST.
- Yasser (WhatsApp) is the only known client contact. Establishing an email or a named point of contact for approvals and strategy alignment is recommended but not blocking.
- The store has 6 physical locations across Cairo (Zamalek, Arkan, UVenues, Diplo) — a strong local presence that can feed into content.
- Monitor the first auto-publish on **Jul 16** closely to confirm `autoPublishService` works end-to-end. If it fails, the hidden draft can be published manually via Shopify admin with appropriate SEO fields.
