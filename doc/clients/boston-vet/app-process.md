# Boston Veterinary Pharmaceutical — App Process

Last updated: 2026-08-05

## Operating Goal

Prepare and operate a veterinary pharmaceutical content process that can start immediately after Cloudflare/WAF allows the production EC2 IP. Until then, TDS may draft and review content but must not assume production publishing works.

## Production State

| Item | Value |
|---|---|
| Slug | `boston-vet` |
| Platform | WordPress / WooCommerce |
| Site | `https://boston-vet.com` |
| Connector | Blocked from production EC2: WordPress REST returns `403` |
| External check | Public REST can return `200` outside EC2 |
| Required unblock | Allowlist production IP `16.192.29.174` in Cloudflare/WAF/security plugin |

## Full App Flow

1. Before any live operation, verify `https://boston-vet.com/wp-json/wp/v2/posts?...` returns `200` from production EC2.
2. If REST still returns `403`, stop live publishing work and only prepare offline drafts/audit notes.
3. Read `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, `technical-reference.md`, and `writer-role.md`.
4. Generate veterinary-specific content only: animal health, livestock, poultry, ruminants, equine, rabbits, and pet animals.
5. Keep claims conservative and reviewable; no fabricated disease treatment claims, dosage instructions, regulatory approvals, or clinical studies.
6. Once unblocked, run a full site audit: homepage, sitemap, REST, wp-admin, plugin status, product prices, placeholder content, mobile, metadata, and schema.
7. Confirm WordPress write credentials and TDS plugin status before first publish.
8. Publish one reviewed draft, verify live URL/status/metadata, then expand to weekly cadence.
9. Update the dashboard and client notes after every unblock/publish attempt.

## Quality Gates

- Production EC2 REST access must be `200` before live connector work.
- Veterinary content must be distinct from Boston Pharma human pharma content.
- Minimum 1,200 words for articles.
- Client review required for any product, disease, dosage, or treatment claim.
- No automated publishing while Cloudflare/WAF blocks production.

## Runbook

| Frequency | Action |
|---|---|
| Daily | Recheck production EC2 REST status while blocked. |
| Weekly | Prepare one draft article offline and keep it ready for review. |
| After unblock | Run full site audit and validate TDS plugin/write credentials. |
| Monthly | Audit veterinary category coverage and product/pricing state. |

## Blockers To Clear

1. Allowlist `16.192.29.174` in Cloudflare/WAF.
2. Verify TDS Geo plugin status and WordPress write credentials.
3. Check WooCommerce prices and placeholder content.
4. Establish a named Boston Vet contact or shared Boston Group approval owner.
