// ──────────────────────────────────────────────
// Cost Optimizer Model Routing Simulation
// Shows which model gets selected for different
// task types (draft, standard, premium)
// ──────────────────────────────────────────────

import 'dotenv/config';

// Replicate the routing logic from costOptimization.ts
const MODEL_CATALOG = [
  // OpenAI
  { model: 'gpt-4o', provider: 'openai', inputCostPer1K: 0.005, outputCostPer1K: 0.015, maxTokens: 16384, supportsReasoning: true, supportsImages: true, quality: 95, speedScore: 70 },
  { model: 'gpt-4o-mini', provider: 'openai', inputCostPer1K: 0.0015, outputCostPer1K: 0.006, maxTokens: 16384, supportsReasoning: true, supportsImages: true, quality: 85, speedScore: 85 },
  { model: 'gpt-4', provider: 'openai', inputCostPer1K: 0.03, outputCostPer1K: 0.06, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 90, speedScore: 50 },
  { model: 'gpt-3.5-turbo', provider: 'openai', inputCostPer1K: 0.001, outputCostPer1K: 0.002, maxTokens: 16384, supportsReasoning: false, supportsImages: false, quality: 70, speedScore: 95 },
  { model: 'text-embedding-3-small', provider: 'openai', inputCostPer1K: 0.00002, outputCostPer1K: 0, maxTokens: 8191, supportsReasoning: false, supportsImages: false, quality: 85, speedScore: 100 },

  // Ollama Local (free)
  { model: 'llama3.1:8b', provider: 'ollama', inputCostPer1K: 0, outputCostPer1K: 0, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 78, speedScore: 85 },
  { model: 'llama3.1:70b', provider: 'ollama', inputCostPer1K: 0, outputCostPer1K: 0, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 90, speedScore: 45 },
  { model: 'mistral:7b', provider: 'ollama', inputCostPer1K: 0, outputCostPer1K: 0, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 75, speedScore: 88 },
  { model: 'mixtral:8x7b', provider: 'ollama', inputCostPer1K: 0, outputCostPer1K: 0, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 85, speedScore: 55 },
  { model: 'codellama:7b', provider: 'ollama', inputCostPer1K: 0, outputCostPer1K: 0, maxTokens: 8192, supportsReasoning: false, supportsImages: false, quality: 70, speedScore: 85 },
  { model: 'llama3.2:3b', provider: 'ollama', inputCostPer1K: 0, outputCostPer1K: 0, maxTokens: 8192, supportsReasoning: false, supportsImages: false, quality: 65, speedScore: 95 },

  // Ollama Cloud
  { model: 'ministral-3:14b', provider: 'ollama', inputCostPer1K: 0.0008, outputCostPer1K: 0.0025, maxTokens: 16384, supportsReasoning: true, supportsImages: false, quality: 85, speedScore: 80 },
  { model: 'ministral-3:8b', provider: 'ollama', inputCostPer1K: 0.0005, outputCostPer1K: 0.0015, maxTokens: 16384, supportsReasoning: true, supportsImages: false, quality: 80, speedScore: 88 },
  { model: 'ministral-3:3b', provider: 'ollama', inputCostPer1K: 0.0002, outputCostPer1K: 0.0008, maxTokens: 8192, supportsReasoning: false, supportsImages: false, quality: 70, speedScore: 95 },
  { model: 'deepseek-v4-flash', provider: 'ollama', inputCostPer1K: 0.0003, outputCostPer1K: 0.001, maxTokens: 32768, supportsReasoning: true, supportsImages: false, quality: 88, speedScore: 92 },
  { model: 'gemma3:12b', provider: 'ollama', inputCostPer1K: 0.0006, outputCostPer1K: 0.002, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 83, speedScore: 82 },
  { model: 'gemma3:27b', provider: 'ollama', inputCostPer1K: 0.0012, outputCostPer1K: 0.004, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 90, speedScore: 60 },
  { model: 'deepseek-v3.2', provider: 'ollama', inputCostPer1K: 0.0025, outputCostPer1K: 0.0075, maxTokens: 32768, supportsReasoning: true, supportsImages: false, quality: 95, speedScore: 55 },
];

function estimateCost(model, estimatedTokens) {
  const inputTokens = Math.round(estimatedTokens * 0.75);
  const outputTokens = estimatedTokens - inputTokens;
  return (inputTokens / 1000) * model.inputCostPer1K + (outputTokens / 1000) * model.outputCostPer1K;
}

function calculateCostScore(model, estimatedTokens) {
  const estimatedCost = estimateCost(model, estimatedTokens);
  const maxCost = 0.05;
  return Math.max(0, 100 - (estimatedCost / maxCost) * 100);
}

function routeTask(taskRequirements) {
  const { estimatedTokens, requiresReasoning, requiresImageGeneration, requiredQuality } = taskRequirements;

  let candidates = [...MODEL_CATALOG];
  if (requiresImageGeneration) candidates = candidates.filter(m => m.supportsImages);
  if (requiresReasoning) candidates = candidates.filter(m => m.supportsReasoning);

  if (candidates.length === 0) candidates = [MODEL_CATALOG[0]];

  // Filter to active provider's models if AI_PROVIDER is set
  const activeProvider = (process.env.AI_PROVIDER || '').toLowerCase();
  if (activeProvider) {
    candidates = candidates.filter(m => m.provider === activeProvider);
  }

  const scored = candidates.map(m => {
    const costScore = calculateCostScore(m, estimatedTokens);
    const compositeScore = requiredQuality === 'premium'
      ? m.quality * 0.6 + costScore * 0.4
      : requiredQuality === 'draft'
        ? m.speedScore * 0.6 + costScore * 0.4
        : m.quality * 0.4 + m.speedScore * 0.3 + costScore * 0.3;
    return { ...m, compositeScore, costScore, estimatedCost: estimateCost(m, estimatedTokens) };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored.slice(0, 5);
}

function showResults(taskDesc, results) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  ${taskDesc}`);
  console.log(`${'═'.repeat(65)}`);
  console.log(`  Rank │ Model                          │ Provider │ Quality  │ Speed  │ Cost/1K  │ Score`);
  console.log(`  ─────┼─────────────────────────────────┼──────────┼─────────┼───────┼──────────┼───────`);

  results.forEach((r, i) => {
    const rank = (i + 1).toString().padStart(4);
    const model = r.model.padEnd(31);
    const provider = r.provider.padEnd(8);
    const quality = r.quality.toString().padStart(5);
    const speed = r.speedScore.toString().padStart(5);
    const cost = `$${(r.estimatedCost * 1000).toFixed(4)}`.padStart(8);
    const score = r.compositeScore.toFixed(1).padStart(5);
    console.log(`  ${rank}  │ ${model}│ ${provider}│ ${quality}  │ ${speed}  │ ${cost}  │ ${score}`);
  });
}

console.log(`\n${'═'.repeat(65)}`);
console.log(`  COST OPTIMIZER — MODEL ROUTING SIMULATION`);
console.log(`${'═'.repeat(65)}`);
console.log(`  AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
console.log(`  Ollama Cloud model: ${process.env.OLLAMA_MODEL || '—'}`);
console.log(`  Total models in catalog: ${MODEL_CATALOG.length}`);

// ── Scenario 1: Premium blog generation ─────
showResults('SCENARIO 1: Premium blog generation (4K tokens, requires reasoning)', routeTask({
  estimatedTokens: 4000,
  requiresReasoning: true,
  requiresImageGeneration: false,
  requiredQuality: 'premium',
}));

// ── Scenario 2: Draft / Outline ─────────────
showResults('SCENARIO 2: Draft outline generation (500 tokens, no reasoning needed)', routeTask({
  estimatedTokens: 500,
  requiresReasoning: false,
  requiresImageGeneration: false,
  requiredQuality: 'draft',
}));

// ── Scenario 3: SEO analysis ────────────────
showResults('SCENARIO 3: SEO analysis (1.5K tokens, standard quality)', routeTask({
  estimatedTokens: 1500,
  requiresReasoning: true,
  requiresImageGeneration: false,
  requiredQuality: 'standard',
}));

// ── Scenario 4: Image generation ────────────
showResults('SCENARIO 4: Image generation (only OpenAI models support images)', routeTask({
  estimatedTokens: 2000,
  requiresReasoning: true,
  requiresImageGeneration: true,
  requiredQuality: 'standard',
}));

// ── Scenario 5: FAQ generation ──────────────
showResults('SCENARIO 5: FAQ generation (800 tokens, draft quality, cheap)', routeTask({
  estimatedTokens: 800,
  requiresReasoning: false,
  requiresImageGeneration: false,
  requiredQuality: 'draft',
}));

console.log(`\n${'═'.repeat(65)}`);
console.log('');
