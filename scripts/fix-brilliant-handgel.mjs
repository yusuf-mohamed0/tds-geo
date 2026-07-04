// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import 'dotenv/config';
import { Ollama } from 'ollama';

const client = new Ollama({
  host: process.env.OLLAMA_BASE_URL,
  fetch: async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', 'Bearer ' + process.env.OLLAMA_API_KEY);
    return globalThis.fetch(input, { ...init, headers });
  },
});

function extractJSON(text) {
  text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const m = text.match(/{[\s\S]*}/);
  if (!m) return null;
  text = m[0];
  text = text.replace(/:\s*"([^"]*)"/g, (_, c) => ': "' + c.replace(/\n/g, ' ').replace(/\r/g, '') + '"');
  text = text.replace(/,\s*([}\]])/g, '$1');
  text = text.replace(/\n\s*/g, ' ');
  try { return JSON.parse(text); } catch { return null; }
}

const system = 'You are a senior pharmaceutical copywriter. Return ONLY valid JSON, no markdown:\n' + JSON.stringify({
  description: 'HTML product description. 300-500 words.',
  shortDescription: '2-3 sentence summary, HTML allowed'
});

const user = 'Generate product description for Brilliant hand gel, antiseptic hand sanitizer by Boston Pharmaceutical Industries, GMP-certified Egyptian manufacturer.';

const resp = await client.chat({
  model: process.env.OLLAMA_MODEL,
  messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  options: { num_predict: 2000, temperature: 0.7 },
  format: 'json',
});

const parsed = extractJSON(resp.message.content);
if (!parsed) {
  console.log('FAILED. Raw:', resp.message.content.slice(0, 1000));
  process.exit(1);
}

console.log('Description:', parsed.description.slice(0, 100), '...');
console.log('Short desc:', (parsed.shortDescription || '').slice(0, 100));

const update = await fetch('https://boston-pharma.com/wp-json/tds-geo/v1/posts/4792', {
  method: 'PUT',
  headers: { 'X-TDS-GEO-Key': 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1', 'Content-Type': 'application/json' },
  body: JSON.stringify({ post_type: 'product', content: parsed.description, excerpt: parsed.shortDescription }),
});
const result = await update.json();
console.log('Updated:', result.success ? 'OK' : 'FAIL');
