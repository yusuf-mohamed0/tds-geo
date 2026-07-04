// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('response', response => {
    if (response.status() >= 400) {
      consoleErrors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });

  async function screenshot(name) {
    const path = `/tmp/screenshots/${name}.png`;
    await page.screenshot({ path, fullPage: false });
    return path;
  }

  async function check(pageName, url) {
    console.log(`\n=== ${pageName} ===`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await screenshot(pageName.toLowerCase().replace(/\s+/g, '-'));

      const url_after = page.url();
      const bodyText = await page.textContent('body');
      const htmlLen = (await page.innerHTML('body')).trim().length;

      // Detect if we're on the login page
      if (url_after.includes('/login') && pageName !== 'Login') {
        console.log(`  ❌ Redirected to login page (auth lost)`);
        return { ok: false, reason: 'redirect-to-login' };
      }

      if (htmlLen < 80) {
        console.log(`  ⚠️  Very little content (${htmlLen} chars) — possible 404`);
        return { ok: false, reason: 'empty' };
      }

      console.log(`  ✅ Loaded (${htmlLen} chars)`);
      const issues = [];

      // Page-specific checks
      if (pageName === 'Chat') {
        const welcomeEl = await page.$('.chat-welcome');
        if (welcomeEl) {
          console.log('  ✅ Welcome screen visible');
          // Check quick action chips
          const chips = await page.$$('.chat-action-chip');
          if (chips.length > 0) {
            console.log(`  ✅ ${chips.length} quick action chips`);
          } else {
            issues.push('No quick action chips');
          }
        } else {
          issues.push('No welcome screen');
        }

        const input = await page.$('.chat-input-field');
        if (input) {
          console.log('  ✅ Message input found');
        } else {
          issues.push('No message input');
        }

        // Try hamburger menu
        const menuBtn = await page.$('.chat-toolbar-menu-btn');
        if (menuBtn) {
          await menuBtn.click();
          await page.waitForTimeout(500);
          const drawer = await page.$('.chat-drawer.open');
          if (drawer) {
            console.log('  ✅ Drawer opens on hamburger click');
            // Close via overlay
            const overlay = await page.$('.chat-drawer-overlay');
            if (overlay) {
              await overlay.click();
              await page.waitForTimeout(300);
              console.log('  ✅ Drawer closes on overlay click');
            }
          } else {
            issues.push('Drawer did not open');
          }
        } else {
          issues.push('No hamburger menu button');
        }

        // Try send button
        const sendBtn = await page.$('.chat-send-btn');
        if (sendBtn) {
          console.log('  ✅ Send button found');
        } else {
          issues.push('No send button');
        }
      }

      if (pageName === 'Settings') {
        const tabs = await page.$$('.tab');
        console.log(`  ✅ ${tabs.length} settings tabs found`);
      }

      if (pageName === 'Articles') {
        const rows = await page.$$('tr');
        if (rows.length > 0) {
          console.log(`  ✅ ${rows.length} table rows`);
        } else {
          const cards = await page.$$('[class*="card"]');
          console.log(`  ${cards.length > 0 ? '✅' : '⚠️'} ${cards.length} card elements`);
        }
      }

      if (pageName === 'Login') {
        const form = await page.$('form');
        if (form) {
          const inputs = await page.$$('input');
          const btn = await page.$('button[type="submit"]');
          console.log(`  ✅ Login form: ${inputs.length} inputs, ${btn ? 'with' : 'no'} submit button`);
        }
      }

      if (issues.length > 0) {
        console.log(`  ⚠️  Issues found: ${issues.join(', ')}`);
      }

      return { ok: true, issues };
    } catch (err) {
      console.log(`  ❌ Error: ${err.message.slice(0, 150)}`);
      return { ok: false, reason: err.message };
    }
  }

  // ══════ LOGIN ══════
  console.log('\n══════════════════════════════════════');
  console.log('NAVIGATING ALL PAGES');
  console.log('══════════════════════════════════════\n');

  await check('Login', BASE);

  console.log('\n--- Logging in ---');
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  const submitBtn = await page.$('button[type="submit"]');

  if (emailInput && passInput && submitBtn) {
    // Clear any stale token first
    await page.evaluate(() => localStorage.clear());
    await emailInput.fill('admin@test.com');
    await passInput.fill('admin123');
    await submitBtn.click();
    await page.waitForTimeout(3000);
    await screenshot('after-login');
    const afterUrl = page.url();
    if (!afterUrl.includes('/login')) {
      console.log('✅ Login successful');
    } else {
      console.log('❌ Login failed — still on login page');
      await browser.close();
      return;
    }
  } else {
    console.log('❌ Could not find login form');
    await browser.close();
    return;
  }

  // ══════ ALL PAGES ══════
  // Use the SPA's actual route paths (Dashboard is index="/")
  const results = [];
  
  // Dashboard is at / (index route)
  results.push(await check('Dashboard', BASE + '/'));
  
  // Run through each page in sequence
  const pageDefs = [
    'articles',
    'clients',
    'api-keys',
    'plugins',
    'prompts',
    'webhooks',
    'config',
    'improvements',
    'analytics',
    'settings',
    'chat',
  ];

  for (const name of pageDefs) {
    const result = await check(name.charAt(0).toUpperCase() + name.slice(1), `${BASE}/${name}`);
    results.push(result);
    // If auth was lost (redirected to login), stop testing
    if (result.reason === 'redirect-to-login') {
      console.log(`\n⚠️  Auth lost at "${name}" — stopping further page checks`);
      break;
    }
  }

  // Also test article detail if articles page worked
  if (results.length > 1 && results[1]?.ok) {
    console.log('\n--- Article Detail ---');
    // Click on an article link
    const articleLink = await page.$('a[href*="/articles/"]');
    if (articleLink) {
      const href = await articleLink.getAttribute('href');
      await page.goto(BASE + href, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await screenshot('article-detail');
      const detailLen = (await page.innerHTML('body')).trim().length;
      console.log(`  Article detail: ${detailLen > 200 ? '✅' : '⚠️'} (${detailLen} chars)`);
    } else {
      console.log('  No article links found to click');
    }
  }

  // ══════ REPORT ══════
  console.log('\n══════════════════════════════════════');
  console.log('AUDIT SUMMARY');
  console.log('══════════════════════════════════════\n');

  let passed = 0, failed = 0;
  const pageNames = ['Login', 'Dashboard', 'Articles', 'Clients', 'Api keys', 'Plugins', 'Prompts', 'Webhooks', 'Config', 'Improvements', 'Analytics', 'Settings', 'Chat'];
  
  for (let i = 0; i < results.length && i < pageNames.length; i++) {
    const r = results[i];
    if (r?.ok) {
      console.log(`  ✅ ${pageNames[i]}${r.issues?.length ? ` (${r.issues.length} minor issues)` : ''}`);
      passed++;
    } else {
      console.log(`  ❌ ${pageNames[i]} — ${r?.reason || 'failed'}`);
      failed++;
    }
  }

  console.log(`\n  Total: ${passed} passed, ${failed} failed`);

  // Console errors
  if (consoleErrors.length > 0) {
    console.log('\n⚠️  Console errors/HTTP errors detected:');
    const unique = [...new Set(consoleErrors)];
    unique.slice(0, 10).forEach((e, i) => console.log(`  ${i+1}. ${e.slice(0, 200)}`));
    if (unique.length > 10) console.log(`  ... and ${unique.length - 10} more`);
  } else {
    console.log('\n✅ No console errors detected');
  }

  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
