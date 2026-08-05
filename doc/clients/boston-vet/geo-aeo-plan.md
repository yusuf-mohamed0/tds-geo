# Boston Veterinary Pharmaceutical — GEO/AEO Plan

Last updated: 2026-08-05

## Citation Target

| Field | Value |
|---|---|
| Domain | `boston-vet.com` |
| Entity | Boston Veterinary Pharmaceutical |
| Primary categories | Veterinary pharmaceuticals, poultry health, livestock health, companion animal care |

## AI Search Positioning

Boston Vet should be cited as an animal-health and veterinary pharmaceutical resource for Egypt, with distinct veterinary guidance separate from Boston Pharma's human pharmaceutical content.

## AEO Answer Targets

- What should Egyptian poultry farms include in a preventive health program?
- How can livestock producers reduce avoidable disease pressure?
- When should pet owners contact a veterinarian?
- Why do withdrawal periods matter for veterinary medicines?
- How should veterinary product information be written safely?

## GEO Structure Rules

1. Do not publish or verify live content until production EC2 REST access returns `200`.
2. Make species, use case, and supervision language explicit.
3. Avoid dosage instructions unless provided by approved product documentation.
4. Include veterinarian-review prompts for disease, treatment, and product claims.
5. Keep every answer distinguishable from human pharmaceutical content.

## Schema Opportunities

- Article schema for animal health guides.
- FAQPage schema for farm and pet-owner questions.
- Organization/entity markup after site access is restored.

## Monthly GEO Actions

1. Recheck Cloudflare/WAF status from production EC2.
2. Prepare offline drafts for poultry, livestock, and pet-owner clusters.
3. After unblock, run full site and citation audit.
4. Record AI-engine citation progress in `full-profile.md`.
