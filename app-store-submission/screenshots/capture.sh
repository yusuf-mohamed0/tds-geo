#!/usr/bin/env bash
# TDS Geo — Shopify App Store Screenshot Capture Script
#
# Requirements:
#   - node 18+
#   - npx playwright install chromium
#
# Usage:
#   chmod +x capture.sh
#   ./capture.sh
#
# Output: screenshots/ directory (1600x900 desktop, 375x812 mobile)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR"
APP_URL="https://traffic.16.192.29.174.nip.io"
SHOPIFY_STORE="traffic-test"
SHOPIFY_ADMIN="https://admin.shopify.com/store/${SHOPIFY_STORE}/apps/tds-geo"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}TDS Geo — App Store Screenshot Capture${NC}"
echo ""

# Check if playwright is installed
if ! npx playwright --version &>/dev/null; then
  echo "Installing Playwright..."
  npm init -y >/dev/null 2>&1
  npm install playwright >/dev/null 2>&1
  npx playwright install chromium >/dev/null 2>&1
fi

cat > /tmp/screenshot-script.mjs << 'ENDSCRIPT'
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT = process.argv[2] || '.';
const APP_URL = process.argv[3] || 'https://traffic.16.192.29.174.nip.io';
const TEST_EMAIL = process.argv[4] || 'admin@tds-geo.internal';
const TEST_PASSWORD = process.argv[5] || '';

async function shot(page, name, fullPage = false) {
  const filePath = path.join(OUTPUT, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  console.log(`  ✓ ${name}.png`);
}

async function login(page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 10000 });
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });

  // =============================================
  // DESKTOP SCREENSHOTS (1600×900)
  // =============================================
  console.log('\n=== Desktop Screenshots (1600×900) ===');

  // 1. Login page
  const page = await context.newPage();
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await shot(page, '01-login-page');
  await page.close();

  // 2. Dashboard
  const page2 = await context.newPage();
  await login(page2);
  await page2.waitForTimeout(2000);
  await shot(page2, '02-dashboard');

  // 3. Dashboard — full page
  await shot(page2, '03-dashboard-full', true);

  // 4. Articles page
  await page2.goto(`${APP_URL}/admin/articles`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  await shot(page2, '04-articles-list');

  // 5. Article detail (click first article)
  const firstArticle = await page2.$('table tbody tr a');
  if (firstArticle) {
    await firstArticle.click();
    await page2.waitForTimeout(1500);
    await shot(page2, '05-article-detail');
  }

  // 6. GEO Analysis — content mode
  await page2.goto(`${APP_URL}/admin/geo`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(500);
  await page2.fill('textarea', 'TDS Geo helps Shopify merchants optimize their content for Generative Engine Optimization (GEO), the practice of structuring content so AI search engines naturally cite your store as a source. AI-powered search engines are changing how customers discover products online.');
  await page2.click('button:has-text("Analyze")');
  await page2.waitForTimeout(3000);
  await shot(page2, '06-geo-analysis');

  // 7. GEO Analysis — URL mode
  await page2.goto(`${APP_URL}/admin/geo`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(500);
  await page2.click('button:has-text("Enter URL")');
  await page2.fill('input[placeholder*="https://"]', 'https://example.com');
  await page2.click('button:has-text("Audit")');
  await page2.waitForTimeout(5000);
  await shot(page2, '07-geo-url-audit');

  // 8. Citations page
  await page2.goto(`${APP_URL}/admin/citations`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(500);
  await page2.fill('input[placeholder="example.com"]', 'trafficdigitalsolutions.com');
  await page2.click('button:has-text("Check")');
  await page2.waitForTimeout(3000);
  await shot(page2, '08-citations');

  // 9. Clients page
  await page2.goto(`${APP_URL}/admin/clients`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  await shot(page2, '09-clients');

  // 10. Costs page
  await page2.goto(`${APP_URL}/admin/costs`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  await shot(page2, '10-costs');

  // 11. Quality page
  await page2.goto(`${APP_URL}/admin/quality`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  await shot(page2, '11-quality');

  // =============================================
  // MOBILE SCREENSHOTS (375×812)
  // =============================================
  console.log('\n=== Mobile Screenshots (375×812) ===');

  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
  });

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await shot(mobilePage, 'mobile-01-login');
  await login(mobilePage);
  await mobilePage.waitForTimeout(2000);
  await shot(mobilePage, 'mobile-02-dashboard');
  await mobilePage.goto(`${APP_URL}/admin/articles`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await shot(mobilePage, 'mobile-03-articles');
  await mobilePage.goto(`${APP_URL}/admin/geo`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(500);
  await shot(mobilePage, 'mobile-04-geo');
  await mobilePage.goto(`${APP_URL}/admin/citations`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(500);
  await shot(mobilePage, 'mobile-05-citations');

  await mobileContext.close();
  await page2.close();
  await browser.close();

  console.log('\n✓ All screenshots captured in', OUTPUT);
  console.log('Upload to Partner Dashboard:');
  console.log('  - 02-dashboard.png → Feature media (image)');
  console.log('  - 02-dashboard.png → Desktop Screenshot 1');
  console.log('  - 04-articles-list.png → Desktop Screenshot 2');
  console.log('  - 06-geo-analysis.png → Desktop Screenshot 3');
  console.log('  - mobile-* → Mobile screenshots');
})();
ENDSCRIPT

# Get password from user if not provided
PASSWORD="${1:-}"
if [ -z "$PASSWORD" ]; then
  echo -n "Enter test account password: "
  read -rs PASSWORD
  echo ""
fi

echo "Capturing screenshots..."
node /tmp/screenshot-script.mjs "$OUTPUT_DIR" "$APP_URL" "test@test.com" "$PASSWORD"

echo ""
echo -e "${GREEN}Done!${NC} Screenshots saved to: $OUTPUT_DIR"
echo ""
echo "Upload these to Partner Dashboard:"
echo "  File                          → Field"
echo "  ─────────────────────────────────────────────────────"
echo "  02-dashboard.png              → Feature media (image)"
echo "  02-dashboard.png              → Desktop Screenshot 1"
echo "  04-articles-list.png          → Desktop Screenshot 2"
echo "  06-geo-analysis.png           → Desktop Screenshot 3"
echo "  mobile-02-dashboard.png       → Mobile Screenshot 1"
echo "  mobile-03-articles.png        → Mobile Screenshot 2"
echo "  01-login-page.png             → (reference only)"
echo "  07-geo-url-audit.png          → (reference only)"
echo "  08-citations.png              → (reference only)"
echo ""
