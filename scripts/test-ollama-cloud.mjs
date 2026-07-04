// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Ollama Cloud Connection Test
// Tests that the Ollama Cloud API key works by:
// 1. Connecting to the cloud API
// 2. Listing available models
// 3. Generating a simple chat completion
// ──────────────────────────────────────────────

import 'dotenv/config';
import { Ollama } from 'ollama';

const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const API_KEY  = process.env.OLLAMA_API_KEY || '';
const MODEL    = process.env.OLLAMA_MODEL || 'llama3.1:8b';

console.log('═'.repeat(50));
console.log('Ollama Cloud Connection Test');
console.log('═'.repeat(50));
console.log('');
console.log(`  Base URL: ${BASE_URL}`);
console.log(`  API Key:  ${API_KEY ? API_KEY.slice(0, 12) + '...' : '(none)'}`);
console.log(`  Model:    ${MODEL}`);
console.log('');

if (!API_KEY) {
  console.error('✖ No OLLAMA_API_KEY configured — test cannot proceed.');
  process.exit(1);
}

// Create client with auth headers
const originalFetch = globalThis.fetch;
const client = new Ollama({
  host: BASE_URL,
  fetch: async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${API_KEY}`);
    return originalFetch(input, { ...init, headers });
  },
});

// ── Step 1: List models ─────────────────────
console.log('── Step 1: List available models ──');

try {
  const models = await client.list();
  const modelNames = models.models?.map(m => m.name) || [];
  console.log(`  ✓ Success! Found ${modelNames.length} model(s):`);
  for (const name of modelNames.slice(0, 10)) {
    console.log(`    • ${name}`);
  }
  if (modelNames.length > 10) {
    console.log(`    ... and ${modelNames.length - 10} more`);
  }
  console.log('');
} catch (err) {
  console.error(`  ✖ Failed to list models: ${err.message}`);
  console.log('');
  console.log('  This usually means either:');
  console.log('    1. The base URL is wrong (trying https://api.ollama.com/api/...)');
  console.log('    2. The API key is invalid');
  console.log('    3. The cloud API uses a different endpoint structure');
  console.log('');
  console.log('  Trying fallback: OpenAI-compatible endpoint...');
  
  // Try the OpenAI-compatible endpoint path
  try {
    const resp = await originalFetch(`${BASE_URL.replace(/\/$/, '')}/v1/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      console.log(`  ✓ OpenAI-compatible endpoint works!`);
      console.log(`    Models: ${data.data?.map(m => m.id).join(', ') || 'unknown'}`);
    } else {
      console.log(`  ✖ Also failed: ${resp.status} ${resp.statusText}`);
    }
  } catch (err2) {
    console.error(`  ✖ Fallback also failed: ${err2.message}`);
  }
  console.log('');
}

// ── Step 2: Generate a title ────────────────
console.log('── Step 2: Generate a blog title ──');

try {
  const response = await client.chat({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an SEO title expert. Generate a single compelling blog title (max 60 chars). Respond with ONLY the title, no quotes.',
      },
      {
        role: 'user',
        content: 'Keyword: "plumbing maintenance tips"',
      },
    ],
    options: { num_predict: 100, temperature: 0.7 },
  });

  console.log(`  ✓ Success! Generated title:`);
  console.log(`    "${response.message.content.trim()}"`);
  console.log(`  Tokens: ${response.eval_count || 'N/A'} out, ${response.prompt_eval_count || 'N/A'} in`);
  console.log('');

  // ── Step 3: Generate FAQs (JSON mode) ─────
  console.log('── Step 3: Generate FAQ (JSON mode) ──');

  const faqResponse = await client.chat({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Generate 2 FAQs about plumbing maintenance. Respond as JSON: { "faqs": [{ "question": "...", "answer": "..." }] }',
      },
      {
        role: 'user',
        content: 'Topic: plumbing maintenance',
      },
    ],
    options: { num_predict: 500, temperature: 0.5 },
    format: 'json',
  });

  const faqData = JSON.parse(faqResponse.message.content);
  console.log(`  ✓ Success! Generated ${faqData.faqs?.length || 0} FAQ(s):`);
  for (const faq of faqData.faqs || []) {
    console.log(`    Q: ${faq.question?.slice(0, 60)}`);
    console.log(`    A: ${faq.answer?.slice(0, 80)}...`);
  }
  console.log('');

} catch (err) {
  console.error(`  ✖ Chat completion failed: ${err.message}`);
  console.log('');

  if (err.message.includes('format') || err.message.includes('json')) {
    console.log('  The cloud model may not support JSON-mode responses.');
    console.log('  This is a model-specific limitation, not a connection issue.');
  }
  if (err.message.includes('connect') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
    console.log('  Cannot reach the Ollama Cloud API at the configured base URL.');
    console.log('  The endpoint might be different — try contacting Ollama support.');
  }
  if (err.message.includes('401') || err.message.includes('unauthorized') || err.message.includes('forbidden')) {
    console.log('  The API key was rejected by the server.');
  }
}

console.log('═'.repeat(50));
console.log('Test complete.');
console.log('═'.repeat(50));
