# Kivo Geo - Shopify App Store Submission Kit

## What's here

| File | Purpose |
|---|---|
| `SUBMISSION_DATA.md` | All form fields filled — copy/paste into Partner Dashboard |
| `screenshots/capture.sh` | Script to auto-capture all 1600×900 desktop + 375×812 mobile screenshots |
| `screenshots/app-icon-square.png` | Kivo mark - upload as App Icon (1024x1024) |
| `screenshots/app-icon-square-dark.png` | Kivo mark on dark background - alternative |
| `screenshots/app-icon.png` | Compact Kivo wordmark for listing/support surfaces |
| `screenshots/app-icon-white.png` | Compact Kivo wordmark on dark background |

## Steps

### 1. Fill the form
Open `SUBMISSION_DATA.md` and copy each field into:
https://partners.shopify.com -> Apps -> Kivo Geo -> App Store listing

The Shopify CLI deploy command updates app configuration and extensions only. It
does not upload the Partner Dashboard app icon used in Shopify Admin sidebars or
app listings, so upload `screenshots/app-icon-square.png` manually under App
setup/App Store listing whenever the sidebar icon needs refreshing.

### 2. Capture screenshots
```bash
cd app-store-submission/screenshots
chmod +x capture.sh
./capture.sh
# (enter test account password when prompted)
```
This uses Playwright to auto-capture each page.

### 3. Upload to Partner Dashboard

| Screenshot | Upload to |
|---|---|
| `02-dashboard.png` | Feature Media (image) |
| `02-dashboard.png` | Desktop Screenshot 1 |
| `04-articles-list.png` | Desktop Screenshot 2 |
| `06-geo-analysis.png` | Desktop Screenshot 3 |
| `mobile-02-dashboard.png` | Mobile Screenshot 1 |
| `mobile-03-articles.png` | Mobile Screenshot 2 |
| `app-icon-square.png` | App Icon (in Partner Dashboard -> App setup) |

### 4. Verify credentials
- **API secret** in Partner Dashboard matches server's `.env` -> `SHOPIFY_API_SECRET`
- **Allowed redirection URL**: `https://ai.trafficdigitalsolutions.com/api/shopify/callback`
- **OAuth scopes**: `write_products,read_products,write_content,read_content,write_script_tags,read_script_tags,write_themes,read_themes`
