# Acme Maintenance Co. — Brand Profile

## Company Overview

| Field | Value |
|---|---|
| **Legal Name** | Acme Maintenance Co. |
| **Trading As** | Acme Maintenance, Traffic Test |
| **Parent Group** | — |
| **Industry** | Home Maintenance & Repair Services |
| **Type** | Sample/Development Client |
| **Founded** | — |
| **Employees** | — |
| **Headquarters** | California, USA |
| **Phone** | — |
| **Email** | — |
| **Website** | — |
| **Shopify Store** | https://acme-maintenance.myshopify.com |
| **Test Store** | https://traffic-test.myshopify.com |

## Brand Voice

> Professional and educational — we are trusted experts in home maintenance

## Service Area

California, USA (Timezone: America/Los_Angeles)

## Content Pillars (Home Maintenance)

1. **Seasonal Home Care** — HVAC maintenance, gutter cleaning, roof inspection
2. **Emergency Repairs** — Plumbing emergencies, electrical safety, drain cleaning
3. **Preventative Maintenance** — Foundation repair signs, home inspection checklists
4. **Home Improvement** — Pressure washing, water heater replacement, property care
5. **DIY & Safety** — Electrical safety tips, home repair guides

## Technical Setup

| Component | Technology |
|---|---|
| **E-commerce** | Shopify (shopify_shop: acme-maintenance.myshopify.com) |
| **CMS Integration** | TDS Geo backend via REST API |
| **Automation** | n8n workflow ("AI SEO Shopify Agent" — daily) |
| **Approval Mode** | Manual (editor reviews before publish) |
| **Publish Frequency** | Daily |
| **Timezone** | America/Los_Angeles |

## Seed Data Keywords
- gutter cleaning tips, roof maintenance guide, plumbing emergency checklist
- HVAC seasonal maintenance, foundation repair signs, pressure washing services
- drain cleaning solutions, electrical safety tips, water heater replacement cost
- home inspection checklist

## n8n Workflow

The "AI SEO Shopify Agent" workflow runs daily:
1. Discovers keywords via backend API
2. Generates 1 article per run via OpenAI GPT-4o
3. Auto-publishes to Shopify
4. Logs results

## Backend Config

| Field | Value |
|---|---|
| **Client ID** | `5a775480-1572-4017-a6a3-122bb8121ae9` (API), `38e6e8da-b1c7-436c-809d-03bb46b42a1d` (n8n) |
| **Slug** | `acme-maintenance` |
| **Brand Voice** | Professional and educational |
| **Service Area** | California, USA |
| **Timezone** | America/Los_Angeles |
| **Publish Frequency** | daily |
| **Approval Mode** | manual |

## Users

| Email | Role |
|---|---|
| `editor@tds-geo.internal` | Editor |
| `admin@tds-geo.internal` | Admin (n8n workflow login) |

## Notes
- This is a **sample/development client** created via seed data for testing the TDS Geo content pipeline
- The real dev Shopify store is `traffic-test.myshopify.com` where the TDS Geo app is installed
- No actual website exists — content is published directly to Shopify blog
- The n8n workflow handles fully automated daily content generation
- Articles are created in statuses: published, generated, approved, draft (for testing all pipeline states)

---
*See [Client Dashboard](../../DASHBOARD.md) for overall progress*
