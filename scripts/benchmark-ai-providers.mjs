// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// AI Provider Benchmark — OpenAI vs Ollama
// Compares both providers on the same tasks to
// determine which is better for your use case.
// ──────────────────────────────────────────────

import 'dotenv/config';
import { Ollama } from 'ollama';
import OpenAI from 'openai';

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════

const TEST_KEYWORD = 'plumbing maintenance tips for homeowners';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://api.ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'ministral-3:14b';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

const ENABLED = {
  openai: !!OPENAI_API_KEY,
  ollama: !!OLLAMA_API_KEY || !!OLLAMA_BASE_URL,
};

// ══════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════

function createOpenAIClient() {
  return new OpenAI({ apiKey: OPENAI_API_KEY });
}

function createOllamaClient() {
  const originalFetch = globalThis.fetch;
  return new Ollama({
    host: OLLAMA_BASE_URL,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${OLLAMA_API_KEY}`);
      return originalFetch(input, { ...init, headers });
    },
  });
}

// ══════════════════════════════════════════════
// COST ESTIMATES (approximate per 1K tokens)
// ══════════════════════════════════════════════

const PRICING = {
  'gpt-4o':        { input: 0.005,  output: 0.015 },
  'gpt-4o-mini':   { input: 0.0015, output: 0.006 },
  'ministral-3:14b':  { input: 0.0008, output: 0.0025 },
  'deepseek-v4-flash': { input: 0.0003, output: 0.001 },
  'gemma3:12b':    { input: 0.0006, output: 0.002 },
  'gemma3:27b':    { input: 0.0012, output: 0.004 },
};

function estimateCost(model, promptTokens, outputTokens) {
  const p = PRICING[model] || PRICING['gpt-4o'];
  return ((promptTokens / 1000) * p.input + (outputTokens / 1000) * p.output);
}

// ══════════════════════════════════════════════
// BENCHMARK TEST SUITE
// ══════════════════════════════════════════════

const TESTS = {
  'title': async (client, provider, model) => {
    if (provider === 'openai') {
      const r = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'Generate one compelling blog title (max 60 chars). Respond with ONLY the title, no quotes.' },
          { role: 'user', content: `Keyword: "${TEST_KEYWORD}"` },
        ],
        max_tokens: 60, temperature: 0.7,
      });
      return {
        content: r.choices[0].message.content || '',
        promptTokens: r.usage?.prompt_tokens || 0,
        outputTokens: r.usage?.completion_tokens || 0,
      };
    } else {
      const r = await client.chat({
        model,
        messages: [
          { role: 'system', content: 'Generate one compelling blog title (max 60 chars). Respond with ONLY the title, no quotes.' },
          { role: 'user', content: `Keyword: "${TEST_KEYWORD}"` },
        ],
        options: { num_predict: 60, temperature: 0.7 },
      });
      return {
        content: r.message.content || '',
        promptTokens: r.prompt_eval_count || 0,
        outputTokens: r.eval_count || 0,
      };
    }
  },

  'faq': async (client, provider, model) => {
    if (provider === 'openai') {
      const r = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an FAQ creator. Generate 3 FAQs about plumbing maintenance. Respond in JSON: { "faqs": [{ "question": "...", "answer": "..." }] }' },
          { role: 'user', content: `Topic: ${TEST_KEYWORD}` },
        ],
        max_tokens: 500, temperature: 0.5,
        response_format: { type: 'json_object' },
      });
      return {
        content: r.choices[0].message.content || '{}',
        promptTokens: r.usage?.prompt_tokens || 0,
        outputTokens: r.usage?.completion_tokens || 0,
      };
    } else {
      const r = await client.chat({
        model,
        messages: [
          { role: 'system', content: 'You are an FAQ creator. Generate 3 FAQs about plumbing maintenance. Respond ONLY with the FAQs in markdown starting with "## Frequently Asked Questions".' },
          { role: 'user', content: `Topic: ${TEST_KEYWORD}` },
        ],
        options: { num_predict: 500, temperature: 0.5 },
      });
      return {
        content: r.message.content || '',
        promptTokens: r.prompt_eval_count || 0,
        outputTokens: r.eval_count || 0,
      };
    }
  },

  'blog_post': async (client, provider, model) => {
    const systemPrompt = `You are a senior content writer. Write a short SEO-optimized blog post.
Rules: 200-300 words, educational tone, include an H2 section structure, include a meta title and meta description.
Respond in JSON: { "title": "...", "metaTitle": "...", "metaDescription": "...", "tags": [...], "content": "..." }`;

    const userPrompt = `Keyword: "${TEST_KEYWORD}"

Write a blog post about the importance of plumbing maintenance for homeowners. Include:
- H2 sections with practical tips
- A short FAQ at the end
- Never give dangerous DIY instructions`;

    if (provider === 'openai') {
      const r = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500, temperature: 0.7,
        response_format: { type: 'json_object' },
      });
      return {
        content: r.choices[0].message.content || '{}',
        promptTokens: r.usage?.prompt_tokens || 0,
        outputTokens: r.usage?.completion_tokens || 0,
      };
    } else {
      const r = await client.chat({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { num_predict: 1500, temperature: 0.7 },
        format: 'json',
      });
      return {
        content: r.message.content || '{}',
        promptTokens: r.prompt_eval_count || 0,
        outputTokens: r.eval_count || 0,
      };
    }
  },

  'seo_analysis': async (client, provider, model) => {
    const articleContent = `# Why Plumbing Maintenance Matters

Plumbing issues can cause significant damage to your home if left unchecked. Regular maintenance helps prevent costly repairs and extends the life of your systems.

## Common Warning Signs
Watch for dripping faucets, slow drains, water stains, and unusual noises. These early indicators can save you thousands if addressed promptly.

## Preventative Tips
Inspect visible pipes monthly, clean drain traps, check water pressure, and know your main shutoff valve location.

## When to Call a Pro
For major leaks, sewer line issues, water heater problems, or any gas-related plumbing, always contact a licensed plumber.`;

    if (provider === 'openai') {
      const r = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an SEO expert. Analyze this content. Score 0-100. Respond in JSON: { "score": number, "keywordDensity": number, "readabilityScore": number, "suggestions": string[], "headingStructure": string[] }' },
          { role: 'user', content: `Keyword: "${TEST_KEYWORD}"\n\nContent:\n${articleContent}` },
        ],
        max_tokens: 500, temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      return {
        content: r.choices[0].message.content || '{}',
        promptTokens: r.usage?.prompt_tokens || 0,
        outputTokens: r.usage?.completion_tokens || 0,
      };
    } else {
      const r = await client.chat({
        model,
        messages: [
          { role: 'system', content: 'You are an SEO expert. Analyze this content. Score 0-100. Respond in JSON: { "score": number, "keywordDensity": number, "readabilityScore": number, "suggestions": string[], "headingStructure": string[] }' },
          { role: 'user', content: `Keyword: "${TEST_KEYWORD}"\n\nContent:\n${articleContent}` },
        ],
        options: { num_predict: 500, temperature: 0.3 },
        format: 'json',
      });
      return {
        content: r.message.content || '{}',
        promptTokens: r.prompt_eval_count || 0,
        outputTokens: r.eval_count || 0,
      };
    }
  },
};

// ══════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════

function qualityScore(provider, testName, result) {
  const content = result.content;
  if (!content || content === '{}' || content === '') return 0;

  let score = 0;

  if (testName === 'title') {
    const trimmed = content.replace(/["']/g, '').trim();
    if (trimmed.length > 10) score += 40;
    if (trimmed.length <= 60) score += 30;
    if (trimmed.toLowerCase().includes('plumb')) score += 30;
  }

  if (testName === 'faq') {
    try {
      const data = JSON.parse(content);
      const faqs = data.faqs || [];
      score += Math.min(faqs.length * 25, 100);
    } catch {
      // Count markdown headings as FAQ indicators
      const qCount = (content.match(/### /g) || []).length;
      score += Math.min(qCount * 25, 100);
    }
  }

  if (testName === 'blog_post') {
    try {
      const data = JSON.parse(content);
      if (data.title) score += 15;
      if (data.metaTitle) score += 10;
      if (data.metaDescription) score += 10;
      if (data.tags?.length > 0) score += 10;
      if (data.content) {
        const words = data.content.split(/\s+/).length;
        score += Math.min(words / 10, 40);
        if (data.content.includes('##')) score += 15;
      }
    } catch {
      score += 20; // Partial credit for non-JSON response
    }
  }

  if (testName === 'seo_analysis') {
    try {
      const data = JSON.parse(content);
      if (data.score !== undefined) score += 30;
      if (data.keywordDensity !== undefined) score += 20;
      if (data.suggestions?.length > 0) score += 25;
      if (data.headingStructure?.length > 0) score += 25;
    } catch {
      score += 10;
    }
  }

  return Math.min(Math.round(score), 100);
}

async function runBenchmark() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  AI PROVIDER BENCHMARK — OpenAI vs Ollama`);
  console.log(`  ${'─'.repeat(70)}`);
  console.log(`  Date:       ${new Date().toISOString().slice(0, 10)}`);
  console.log(`  Keyword:    "${TEST_KEYWORD}"`);
  console.log(`  OpenAI:     ${ENABLED.openai ? '✅ ' + OPENAI_MODEL : '❌ Not configured'}`);
  console.log(`  Ollama:     ${ENABLED.ollama ? '✅ ' + OLLAMA_MODEL : '❌ Not configured'}`);
  console.log(`${'═'.repeat(70)}\n`);

  if (!ENABLED.openai && !ENABLED.ollama) {
    console.log('  No AI providers configured. Set OPENAI_API_KEY and/or OLLAMA_API_KEY.\n');
    return;
  }

  const results = {};

  for (const [testName, testFn] of Object.entries(TESTS)) {
    console.log(`  ┌─ Test: ${testName.padEnd(20)}──────────────────────┐`);

    for (const [provider, enabled] of Object.entries(ENABLED)) {
      if (!enabled) continue;

      const model = provider === 'openai' ? OPENAI_MODEL : OLLAMA_MODEL;
      const client = provider === 'openai' ? createOpenAIClient() : createOllamaClient();

      const start = Date.now();
      let result, error;

      try {
        result = await testFn(client, provider, model);
      } catch (err) {
        error = err.message;
      }

      const elapsed = Date.now() - start;
      const qScore = result ? qualityScore(provider, testName, result) : 0;
      const cost = result
        ? estimateCost(model, result.promptTokens || 0, result.outputTokens || 0)
        : 0;

      if (!results[testName]) results[testName] = {};
      results[testName][provider] = { elapsed, qScore, cost, error, tokens: result ? (result.promptTokens + result.outputTokens) : 0 };

      const status = error ? '✖ FAIL' : `${qScore >= 70 ? '✅' : '⚠️'} ${qScore}%`;
      const timeStr = `${(elapsed / 1000).toFixed(1)}s`.padStart(7);
      const costStr = cost > 0 ? `$${cost.toFixed(6)}`.padStart(10) : '  free    ';
      const tokensStr = result ? `${result.promptTokens}+${result.outputTokens || 0}`.padStart(8) : '';
      const modelStr = model.padEnd(22);
      const providerStr = provider.padEnd(8);

      const contentPreview = result?.content
        ? result.content.replace(/\n/g, ' ').slice(0, 80).trim()
        : error?.slice(0, 80) || '';

      console.log(`  │ ${providerStr}│ ${modelStr}│ ${timeStr} │ ${costStr} │ ${status.padEnd(10)} │`);
      if (contentPreview) {
        console.log(`  │ ${''.padEnd(8)}│ ${contentPreview.slice(0, 55)}...`);
      }
    }
    console.log(`  └${'─'.repeat(58)}┘\n`);
  }

  // ════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  SUMMARY`);
  console.log(`${'═'.repeat(70)}`);

  const providers = Object.keys(ENABLED).filter(p => ENABLED[p]);

  let header = '  Test               ';
  for (const p of providers) header += `│ ${p.padEnd(14)} `;
  console.log(`  ${header}`);
  console.log(`  ${'─'.repeat(header.length - 2)}`);

  for (const [testName, testResults] of Object.entries(results)) {
    let row = `  ${testName.padEnd(20)}`;
    for (const p of providers) {
      const r = testResults[p];
      if (r.error) {
        row += `│ ${'ERR'.padEnd(14)} `;
      } else {
        row += `│ ${r.qScore}% ${(r.elapsed / 1000).toFixed(1)}s  `;
      }
    }
    console.log(row);
  }

  // ── Totals ──
  console.log(`  ${'─'.repeat(header.length - 2)}`);
  let totalRow = '  TOTAL               ';
  for (const p of providers) {
    const scores = Object.values(results).map(r => r[p]?.qScore || 0);
    const times = Object.values(results).map(r => r[p]?.elapsed || 0);
    const costs = Object.values(results).map(r => r[p]?.cost || 0);
    const avgQ = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const totalTime = times.reduce((a, b) => a + b, 0);
    const totalCost = costs.reduce((a, b) => a + b, 0);
    totalRow += `│ ${avgQ}% ${(totalTime / 1000).toFixed(1)}s   `;
  }
  console.log(totalRow);

  // ── Cost comparison ──
  console.log(`\n  ${'─'.repeat(header.length - 2)}`);
  for (const p of providers) {
    const costs = Object.values(results).map(r => r[p]?.cost || 0);
    const totalCost = costs.reduce((a, b) => a + b, 0);
    console.log(`  ${p.padEnd(20)}  Total cost: $${totalCost.toFixed(6)}`);
  }

  // ════════════════════════════════════════════
  // RECOMMENDATION
  // ════════════════════════════════════════════

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  RECOMMENDATION`);
  console.log(`${'═'.repeat(70)}`);

  if (providers.length === 1) {
    console.log(`\n  Only one provider configured — configure the other to compare.\n`);
  } else {
    const oaiTotals = Object.values(results).map(r => r['openai']);
    const ollTotals = Object.values(results).map(r => r['ollama']);

    const oaiAvgQ = Math.round(oaiTotals.reduce((a, r) => a + (r?.qScore || 0), 0) / oaiTotals.length);
    const ollAvgQ = Math.round(ollTotals.reduce((a, r) => a + (r?.qScore || 0), 0) / ollTotals.length);

    const oaiTotalTime = oaiTotals.reduce((a, r) => a + (r?.elapsed || 0), 0);
    const ollTotalTime = ollTotals.reduce((a, r) => a + (r?.elapsed || 0), 0);

    const oaiTotalCost = oaiTotals.reduce((a, r) => a + (r?.cost || 0), 0);
    const ollTotalCost = ollTotals.reduce((a, r) => a + (r?.cost || 0), 0);

    console.log(`\n                         OpenAI              Ollama`);
    console.log(`  ─────────────────────────────────────────────────────`);
    console.log(`  Avg Quality      ${String(oaiAvgQ).padStart(5)}%              ${String(ollAvgQ).padStart(5)}%`);
    console.log(`  Total Time       ${(oaiTotalTime / 1000).toFixed(1).padStart(5)}s              ${(ollTotalTime / 1000).toFixed(1).padStart(5)}s`);
    console.log(`  Total Cost       $${oaiTotalCost.toFixed(6).padStart(10)}      $${ollTotalCost.toFixed(6).padStart(10)}`);
    if (oaiTotalCost > 0 && ollTotalCost >= 0) {
      const savings = oaiTotalCost - ollTotalCost;
      const pct = oaiTotalCost > 0 ? Math.round((savings / oaiTotalCost) * 100) : 0;
      if (savings > 0) {
        console.log(`  Savings                    —               ${pct}% cheaper`);
      } else if (savings < 0) {
        console.log(`  Savings               ${Math.abs(pct)}% cheaper                —`);
      }
    }

    if (oaiAvgQ >= ollAvgQ - 5) {
      console.log(`\n  ✅ Both providers achieve similar quality.`);
    } else if (oaiAvgQ > ollAvgQ) {
      console.log(`\n  ⚠️  OpenAI produces higher quality results (+${oaiAvgQ - ollAvgQ}%).`);
    } else {
      console.log(`\n  ⚠️  Ollama produces higher quality results (+${ollAvgQ - oaiAvgQ}%).`);
    }
    if (ollTotalCost < oaiTotalCost && ollAvgQ >= oaiAvgQ - 10) {
      console.log(`  🏆 Ollama is the winner: similar quality at lower cost.`);
    } else if (oaiTotalCost <= ollTotalCost && oaiAvgQ >= ollAvgQ) {
      console.log(`  🏆 OpenAI is the winner: better quality at similar cost.`);
    } else {
      console.log(`  💡 Trade-off: ${oaiAvgQ > ollAvgQ ? 'OpenAI is higher quality' : 'Ollama is cheaper'} — choose based on your priority.`);
    }
  }

  console.log(`\n${'═'.repeat(70)}\n`);
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err.message);
  process.exit(1);
});
