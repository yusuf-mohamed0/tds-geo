// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { chromium } from 'playwright';

const TOKEN = process.env.KIVO_TEST_TOKEN;
if (!TOKEN) {
  throw new Error('KIVO_TEST_TOKEN is required. Do not hard-code auth tokens in source.');
}

const browser = await chromium.launch({ 
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'
});
const page = await browser.newPage();

// Capture console messages
const consoleLogs = [];
page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => consoleLogs.push(`[PAGE ERROR] ${err.message}`));

// Set token before navigating
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.evaluate((token) => { localStorage.setItem('ai_seo_auth_token', token); }, TOKEN);

// Reload to pick up token
await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(3000);

console.log('URL after reload:', page.url());
console.log('\n=== CONSOLE LOGS ===');
for (const log of consoleLogs) {
  console.log(log);
}

// Check page content
const html = await page.content();
console.log('\n=== PAGE HTML (first 3000 chars) ===');
console.log(html.substring(0, 3000));

const text = await page.evaluate(() => document.body.innerText);
console.log('\n=== VISIBLE TEXT ===');
console.log(text.substring(0, 1000));

await page.screenshot({ path: '/tmp/after-login.png', fullPage: true });
console.log('\nScreenshot saved to /tmp/after-login.png');
await browser.close();
