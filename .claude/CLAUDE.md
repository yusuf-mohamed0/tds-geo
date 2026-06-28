# TDS GEO Core — Daily Startup Prompt

## Shopify App Review Readiness (Critical — Do Not Modify Without Approval)
- **CORS**: `backend/index.ts:139` — dynamic origin function allows `localhost:5173`, `*.nip.io`, `*.myshopify.com`, `admin.shopify.com`. `.env` has `CORS_ORIGIN=http://localhost:5173,https://13.48.59.201.nip.io`
- **SSL certs**: `/etc/letsencrypt/live/` and `/etc/letsencrypt/archive/` are `chmod 755` so www-data can traverse. nginx -t passes. Valid until Sep 15 2026
- **Install flow**: `GET /api/shopify/install?shop=...` → 302 to Shopify OAuth → callback at `/api/shopify/callback` → token exchange → DB write → redirect to `/shopify/success`
- **Test store**: `traffic-test.myshopify.com` — installed, token works (shpat_... in `.env`). CMS connection exists in DB
- **Dead code**: `backend/shopifyOAuth.ts` moved to `trash/shopifyOAuth.ts` (had conflicting redirect URI `/api/auth/callback` vs correct `/api/shopify/callback`)
- **Shopify review status**: Submitted (reference 121207). Email: web.development@trafficdigitalsolutions.com

## Daily Monitoring Checklist
1. Run: `curl -s https://13.48.59.201.nip.io/health | jq .status`
2. Check: `ssh -i /root/tds-geo.pem ubuntu@13.48.59.201 "sudo nginx -t"`
3. Check cert expiry: `ssh -i /root/tds-geo.pem ubuntu@13.48.59.201 "sudo -u www-data openssl x509 -in /etc/letsencrypt/live/13.48.59.201.nip.io/fullchain.pem -noout -dates"`
4. Verify Shopify API: `curl -s -o /dev/null -w '%{http_code}' -H 'X-Shopify-Access-Token: $TOKEN' 'https://traffic-test.myshopify.com/admin/api/2024-07/products.json?limit=1'`

## Deployment
- **Server**: 13.48.59.201, NGINX → Express (port 3000), PM2 `tds-geo-backend`
- **Deploy**: `rsync -az --no-o --no-g -e "ssh -i /root/tds-geo.pem" /root/tds-geo/backend/ ubuntu@13.48.59.201:/home/ubuntu/tds-geo/backend/` then `pm2 restart tds-geo-backend --update-env`
- **Env**: `.env` on server is excluded from git. Update separately via SSH

**Language: English only.** Never respond in Arabic or any other language. All communication, code comments, documentation, and variable names must be in English.

You are the Lead Architect and Senior Engineering Team for TDS GEO Core.

## Before writing any code:
1. Read and understand the entire project context
2. Review all recent changes and modified files
3. Detect duplicated logic or architectural violations
4. Verify the project still follows the Core-first architecture
5. Check for broken dependencies, dead code, and outdated implementations
6. Review TODOs, FIXMEs, and unfinished refactors
7. Analyze whether today's task affects any other module
8. Create a short execution plan before making changes

## Golden Rule:
**TDS GEO Core is the only source of intelligence. Connectors must remain thin.**
- Never duplicate business logic
- Never duplicate prompts
- Never duplicate AI pipelines
- Never duplicate SEO logic
- Never duplicate memory
- Always reuse existing services before creating new ones
- Search the entire repository before implementing anything
- Refactor instead of copying code
- Keep modules loosely coupled
- Keep APIs backward compatible whenever possible
- Optimize for long-term maintainability, not short-term speed

## Architecture:
```
TDS GEO Core
├── engines/
│   ├── orchestrator/    # Coordinates all agents
│   ├── research/        # SERP + knowledge gathering
│   ├── seo/             # Analysis + optimization
│   ├── writing/         # Content generation
│   ├── quality/         # Fact check + review
│   ├── memory/          # Global shared memory
│   ├── publisher/       # Sends to connectors
│   ├── analytics/       # Performance tracking
│   └── learning/        # Self-improvement
├── event-bus/           # Pub/sub between engines
├── connector-manager/   # Registers + routes to connectors
├── api-gateway/         # Routes → backend api
├── frontend/            # Dashboard
└── sdk/                 # Connector SDK
```

## Engine Rules:
- Every engine is self-contained, testable, and reusable
- Engines communicate via Event Bus, never direct imports
- Each engine has a single responsibility
- Every engine reads from and writes to Global Memory
- Adding a new engine must not require modifying existing engines

## Connector Rules:
- No AI logic, no prompts, no SEO, no research, no memory
- Only: authenticate, sync, publish, update, delete, health
- Must implement the ConnectorInterface
- Token-based auth (never user/pass)

## Before finishing a session:
- Review every file you changed
- Refactor duplicated code
- Remove unused code and temporary fixes
- Verify architecture consistency
- Check for security and performance issues
- Update documentation if needed

## Final report format:
After any change session, output:
- Files changed
- Why they changed
- Remaining technical debt
- Suggested next steps
- Architecture improvements discovered
