# Traffic Digital Solutions GEO — Shopify Connector

Thin connector app that links your Shopify store to the **TDS Geo** AI content engine. Once installed, TDS Geo can create, optimize, and publish blog articles directly to your Shopify Online Store.

## How It Works

```
Your Shopify Store  ←→  TDS Geo Shopify App  ←→  TDS Geo Backend
   (blogs/pages)         (OAuth + webhooks)       (AI engine)
```

1. Install this app on your Shopify store
2. Grant content permissions (write blogs, manage articles)
3. The app registers webhooks that TDS Geo uses to publish content
4. TDS Geo's AI generates SEO-optimized articles and sends them to your store

## Quick Start

### Prerequisites
- A Shopify Partners account (or Shopify Plus store)
- Node.js 20+
- TDS Geo backend URL (provided by your account team)

### 1. Create a Shopify App

```bash
# In your Shopify Partners dashboard:
# 1. Go to Apps → Create App
# 2. Set the App URL to: https://your-app-domain.com
# 3. Set the Allowed Redirection URL(s) to:
#    https://your-app-domain.com/api/auth/callback
# 4. Copy the API Key and API Secret
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```env
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-app-domain.com
TDS_GEO_API_URL=https://your-tds-geo-backend.com
TDS_GEO_API_KEY=your_tds_geo_api_key
```

### 3. Deploy

```bash
npm install
npm run build
npm start
```

### 4. Install on a Store

Visit `https://your-app-domain.com/api/auth?shop=your-store.myshopify.com`

## Embedded Admin

Once installed, visit your Shopify Admin → Apps → TDS Geo to see:
- **Dashboard** — Connection status, recent articles, queue
- **Settings** — API key, blog selection, default publish status

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth` | Start OAuth installation |
| GET | `/api/auth/callback` | OAuth callback |
| POST | `/api/webhooks/articles/publish` | Receive article from TDS Geo |
| POST | `/api/webhooks/articles/update` | Update existing article |
| DELETE | `/api/webhooks/articles/:id` | Delete article |
| GET | `/api/health` | Health check |

## Brand

- **Primary**: `#171414` (dark), `#FCB900` (orange accent)
- **Text**: `#FCF6F2` (cream)
- **Secondary**: `#142444` (navy), `#769ACC` (blue)
- **Font**: Proxima Nova, Reenie Beanie (handwriting)

---

Built by Traffic Digital Solutions GEO — [trafficdigitalsolutions.com](https://trafficdigitalsolutions.com)
