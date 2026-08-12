# Kivo Geo — Frequently Asked Questions

## General

### What is Kivo Geo?

An AI-powered SEO content automation platform. Enter a keyword → it researches, writes, fact-checks, and publishes SEO-optimized articles to your Shopify or WordPress site automatically.

### Who built it?

Kivo — a digital agency.

### Who is it for?

Two audiences:
1. **Shopify merchants** — automated SEO blog content without hiring writers
2. **Kivo (you)** — manage clients, monitor quality, control the platform

---

## Shopify App

### Why does the app URL hang when I open it in a browser?

Because it's a **Shopify embedded app** — it only works inside the Shopify admin (in an iframe). The App Bridge library waits for a Shopify session that doesn't exist when you open the URL directly. This is normal for all Shopify embedded apps.

### How do I actually use the app?

Install it through a Shopify store:
```
https://traffic-test.myshopify.com/admin → Apps → Kivo Geo
```
Or use the install URL:
```
https://16.192.29.174.nip.io/api/shopify/install?shop=traffic-test.myshopify.com
```

### What's the difference between Partner Dashboard and Dev Dashboard?

| Dashboard | URL | Purpose |
|---|---|---|
| Partner Dashboard | `partners.shopify.com/4956362` | App Store listing, submission status, revenue |
| Dev Dashboard | `dev.shopify.com/dashboard/220584008/apps/387411705857` | App config, versions, webhooks, monitoring |

### What version is active?

Version `kivo-17` was the last deployed (July 1, 2026). The app is submitted for review (Reference 121207).

### Is the app free?

Currently free. Billing API is set up in the code but no pricing plan is active yet.

---

## Architecture

### How does content go from idea to published article?

```
1. User enters keyword in dashboard
2. 24-stage AI pipeline runs:
   Research → Outline → Write → Fact-check →
   Safety check → Brand voice → SEO optimize →
   Quality score → Generate image
3. If quality is good enough (auto) or editor approves (manual):
4. Published to Shopify / WordPress / Next.js
5. Cost tracked in database
```

### Where does the AI get its knowledge about each client?

Three sources:
1. **Website scraping** — crawls client's website (15+ pages) for services, tone, audience, terminology
2. **Brand voice profile** — manually configured tone, vocabulary, and formatting preferences
3. **Knowledge base (RAG)** — uploaded documents (PDFs, guidelines) that are chunked and searchable

### Is everything per-client?

Almost everything:

| Feature | Per-Client? |
|---|---|
| Brand voice profile | ✅ Yes |
| Knowledge bases | ✅ Yes (multiple per client) |
| Website intelligence | ✅ Yes (one record) |
| Articles | ✅ Yes |
| Content generation config | ✅ Yes |
| Prompt templates | ❌ Global (shared) |
| Users | ✅ Yes (per-client roles) |

---

## Infrastructure

### What happens if the server crashes?

PM2 auto-restarts the app within 5 seconds. If it crashes more than 10 times, PM2 stops trying and the app stays down until manually restarted.

### What happens if the server reboots?

PM2 is registered as a systemd service — it auto-starts on boot and launches the app automatically.

### Where is the code?

GitHub: `github.com/yusuf-mohamed0/kivo` (branch: `main`)

### How do I deploy changes?

```bash
ssh -i kivo.pem ubuntu@16.192.29.174
cd /home/ubuntu/kivo
git pull origin main
pm2 restart kivo-backend
```

For TOML/Shopify config changes:
```bash
npx @shopify/cli@latest app deploy --config shopify.app.kivo.toml --allow-updates
```

### Can I turn off my device?

Yes. Everything runs on the EC2 server — your device is just a remote control.

---

## WordPress Integration

### What does the WordPress plugin do?

It's a **thin REST connector** — it only:
- Receives article content from the backend
- Creates WordPress posts
- Uploads featured images
- Returns the post URL

All AI intelligence stays in the backend.

### Does the WordPress plugin have any AI?

No. The "Core is the only brain" architecture means all AI lives in `backend/`. The WordPress plugin is pure REST CRUD.

### How does the WordPress plugin authenticate?

Via API keys sent in the `X-Kivo-Key` header. Keys are generated in the WordPress admin.

---

## Content Pipeline

### How long does it take to generate an article?

2-5 minutes depending on article length and number of pipeline stages.

### What does the pipeline check for?

- ✅ Safety (8+ hazard categories)
- ✅ Factual accuracy
- ✅ Brand voice consistency
- ✅ SEO optimization
- ✅ Readability
- ✅ Internal linking opportunities
- ✅ FAQ generation
- ✅ Meta data (title, description, OG tags)

### Can I approve articles before they're published?

Yes. Each client can be set to:
- **Auto mode** — articles with high quality score are published automatically
- **Manual mode** — every article goes to draft for editor review

---

## Troubleshooting

### The health endpoint returns 502

The app is restarting. Wait 10 seconds and try again. If it persists, check PM2 logs:
```bash
pm2 logs kivo-backend --lines 20
```

### Webhooks are failing with 401

That's correct — compliance webhooks should return 401 for invalid HMAC signatures. This is what Shopify requires for App Store approval.

### I can't SSH into the server

Use the `kivo.pem` key. If it fails:
- Try EC2 Instance Connect (AWS Console → EC2 → Instance → Connect)
- Try tmate (interactive terminal session)

### Redis is down

That's fine. The app degrades gracefully without Redis. Queue jobs won't process but the API still works.
