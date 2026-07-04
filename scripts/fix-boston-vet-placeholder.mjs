#!/usr/bin/env node
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
// ══════════════════════════════════════════════════════════════════
// Boston Vet — Lorem Ipsum Fixer
// Replaces placeholder content with proper brand copy via TDS Geo API
// ══════════════════════════════════════════════════════════════════

const BASE = 'https://boston-vet.com/wp-json/tds-geo/v1';
const API_KEY = process.env.BV_API_KEY || 'kai_46f0d5d6cf30f13fd45463d8082e645323ead5c731b1b58f';
const HEADERS = { 'X-TDS-Geo-Key': API_KEY, 'Content-Type': 'application/json' };

const PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum[\s\S]{0,500}/gi,
  /placeholder\s+text/gi,
  /coming\s+soon/gi,
  /under\s+construction/gi,
  /sample\s+(text|content|page)/gi,
  /this\s+is\s+a\s+(sample|draft|test)/gi,
];

const REPLACEMENTS = {
  generic_intro: 'Boston Veterinary Pharmaceutical is dedicated to advancing animal health through innovative, GMP-certified veterinary products. Our commitment to quality ensures every product meets the highest standards of safety and efficacy for poultry, livestock, companion animals, and equine health.',
  product_intro: 'Boston Veterinary Pharmaceutical offers a comprehensive range of veterinary products formulated to support animal health and productivity. Each product is developed under strict GMP guidelines and undergoes rigorous quality control testing.',
  about_intro: 'As part of the Boston Group, Boston Veterinary Pharmaceutical brings decades of pharmaceutical expertise to the animal health sector. Founded by Dr. Abdalmonem Alanani, we serve veterinarians, farmers, and pet owners across Egypt and the MENA region.',
  contact_intro: 'We are here to support your animal health needs. Contact our team of veterinary professionals for product information, technical support, or partnership inquiries.',
  cta: 'Contact our veterinary team today for product information and technical support.',
  disclaimer: 'For veterinary use only. Always consult a veterinarian before administering any veterinary medicinal product. Observe withdrawal periods as specified.',
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('Just a moment') || text.includes('challenges.cloudflare')) {
      throw new Error('CLOUDFLARE_BLOCKED');
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fixLoremIpsum() {
  console.log('🔍 Scanning Boston Vet for placeholder content...\n');

  // Step 1: Get all posts and pages
  const allContent = [];
  for (const type of ['posts', 'pages', 'product']) {
    try {
      const res = await fetchJSON(`${BASE}/${type}?per_page=100`);
      const items = res.data || res || [];
      allContent.push(...items.map(i => ({ ...i, type })));
      console.log(`  ${type}: ${items.length} found`);
    } catch (err) {
      if (err.message === 'CLOUDFLARE_BLOCKED') {
        console.log(`  ${type}: ❌ BLOCKED — Cloudflare still active`);
        return;
      }
      console.log(`  ${type}: ⚠️ ${err.message}`);
    }
  }

  console.log(`\n📋 Total items: ${allContent.length}\n`);

  // Step 2: Find placeholder content
  const fixable = [];
  for (const item of allContent) {
    const title = item.title?.rendered || item.title || 'Untitled';
    const content = ((item.content?.rendered || item.content || '') + ' ' + (item.excerpt?.rendered || '')).toLowerCase();

    for (const pattern of PLACEHOLDER_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        fixable.push({
          id: item.id,
          title,
          type: item.type,
          match: match[0].slice(0, 100),
          original: item.content?.rendered || item.content || '',
        });
        break;
      }
    }
  }

  console.log(`🚩 Items with placeholder content: ${fixable.length}\n`);

  // Step 3: Fix each one
  for (const item of fixable) {
    console.log(`  Fixing [${item.type}] "${item.title}"...`);

    // Build replacement content based on title/type
    let newContent = item.original;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      // Determine which replacement to use
      let replacement = REPLACEMENTS.generic_intro;
      const titleLower = item.title.toLowerCase();
      if (titleLower.includes('about') || titleLower.includes('company')) replacement = REPLACEMENTS.about_intro;
      else if (titleLower.includes('contact') || titleLower.includes('support')) replacement = REPLACEMENTS.contact_intro;
      else if (titleLower.includes('product') || titleLower.includes('category') || item.type === 'product') replacement = REPLACEMENTS.product_intro;

      newContent = newContent.replace(pattern, `<p>${replacement}</p>`);
    }

    // Add CTA and disclaimer
    if (!newContent.includes(REPLACEMENTS.cta.slice(0, 20))) {
      newContent += `\n<p>${REPLACEMENTS.cta}</p>`;
    }
    if (!newContent.includes(REPLACEMENTS.disclaimer.slice(0, 20))) {
      newContent += `\n<p><em>${REPLACEMENTS.disclaimer}</em></p>`;
    }

    // Update via API
    try {
      const updateRes = await fetch(`${BASE}/${item.type === 'pages' ? 'posts' : item.type}/${item.id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ content: newContent }),
      });
      const result = await updateRes.json();
      if (result.success) {
        console.log(`    ✅ Updated`);
      } else {
        console.log(`    ❌ Update failed: ${result.message}`);
      }
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
  }

  // Step 4: Fix homepage if needed (check site settings/description)
  console.log(`\n📝 Checking site tagline and description...`);
  try {
    const settings = await fetchJSON(`${BASE}/settings`);
    console.log(`  Current settings:`, JSON.stringify(settings).slice(0, 200));
  } catch (err) {
    console.log(`  Settings check: ${err.message}`);
  }

  console.log(`\n✅ Done. Fixed ${fixable.length} items.`);
  if (fixable.length === 0) {
    console.log('No placeholder content found — site is clean!');
  }
}

fixLoremIpsum().catch(err => {
  if (err.message === 'CLOUDFLARE_BLOCKED') {
    console.log('\n❌ CLOUDFLARE BLOCKING: Cannot reach Boston Vet.');
    console.log('   Run this script AFTER whitelisting IP 16.192.29.174');
    console.log('   in Cloudflare → Security → WAF → IP Access Rules');
    process.exit(1);
  }
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
