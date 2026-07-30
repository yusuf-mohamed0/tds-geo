import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';

const MINIMUM_KEYWORD_POOL = 300;

type KeywordProfile = {
  industry: string;
  seeds: string[];
};

const PROFILES: Record<string, KeywordProfile> = {
  'flaunt-cosmetics-global': {
    industry: 'beauty and cosmetics',
    seeds: ['eyeliner stamp', 'winged eyeliner', 'eyeliner for beginners', 'hooded eyes eyeliner', 'easy office makeup', 'liquid liner comparison', 'eyeliner symmetry', 'eyeliner application tips', 'makeup routine UAE', 'beauty tips Egypt', 'eye makeup removal', 'eyeliner for unsteady hands', 'natural eyeliner look', 'graphic eyeliner ideas', 'makeup confidence'],
  },
  caravanserai: {
    industry: 'handmade furniture and home decor',
    seeds: ['Egyptian handmade furniture', 'Cairo home decor', 'artisan home accessories', 'brass home decor', 'wooden furniture care', 'Zamalek home stores', 'Moroccan decor Cairo', 'Indian decor Egypt', 'living room accessories', 'handcrafted furniture Egypt', 'interior styling Egypt', 'home decor gift ideas', 'traditional Egyptian craft', 'decorating with brass', 'small space decor'],
  },
  'boston-pharma': {
    industry: 'pharmaceutical manufacturing',
    seeds: ['pharmaceutical manufacturing Egypt', 'generic medicine Egypt', 'GMP pharmaceutical standards', 'dietary supplements MENA', 'medicine ingredient information', 'pharmaceutical quality control', 'drug manufacturing process', 'healthcare product education', 'medication storage guidance', 'pharmaceutical research Egypt', 'supplement label guide', 'medicine dosage safety', 'healthcare awareness Egypt', 'pharmaceutical supply chain', 'patient education resources'],
  },
  'boston-vet': {
    industry: 'veterinary pharmaceutical',
    seeds: ['veterinary medicine Egypt', 'poultry health management', 'animal feed formulation', 'pet oral health', 'livestock disease prevention', 'veterinary clinic supplies', 'poultry disease management', 'animal healthcare technology', 'farm biosecurity', 'pet wellness routine', 'veterinary product education', 'animal nutrition guide', 'cattle health management', 'poultry vaccination guide', 'veterinary pharmaceutical company'],
  },
  'alamein-2022': {
    industry: 'outdoor furniture',
    seeds: ['outdoor furniture Egypt', 'garden furniture Cairo', 'terrace furniture Egypt', 'balcony furniture ideas', 'wooden outdoor furniture', 'outdoor seating Egypt', 'playground equipment Egypt', 'outdoor fitness equipment', 'commercial outdoor furniture', 'outdoor furniture care', 'weather resistant furniture', 'patio furniture Egypt', 'garden design Cairo', 'outdoor table and chairs', 'street furniture Egypt'],
  },
  'acme-maintenance': {
    industry: 'home maintenance',
    seeds: ['home maintenance California', 'seasonal home care', 'home inspection checklist', 'gutter cleaning tips', 'roof maintenance guide', 'HVAC seasonal maintenance', 'plumbing emergency checklist', 'electrical safety at home', 'foundation repair signs', 'water heater maintenance', 'pressure washing services', 'drain cleaning solutions', 'preventive home maintenance', 'property care checklist', 'emergency home repairs'],
  },
};

const MODIFIERS = [
  'guide', 'tips', 'checklist', 'for beginners', 'best practices', 'common mistakes', 'how to choose', 'how to maintain', 'cost guide', 'questions and answers', 'comparison guide', 'professional advice', 'step by step', 'seasonal guide', 'care routine', 'planning guide', 'what to know', 'when to replace', 'safety guide', 'buyer guide', 'ideas', 'examples', 'near me', 'local guide',
];

function normalize(keyword: string): string | null {
  const value = keyword.toLowerCase().replace(/[^a-z0-9&' -]/g, ' ').replace(/\s+/g, ' ').trim();
  return value.length >= 3 && value.length <= 180 ? value : null;
}

function classify(keyword: string) {
  const words = keyword.split(/\s+/).length;
  const isQuestion = /^(how|what|when|where|why|can|should|is|are|does|do)\b/.test(keyword);
  const isLocal = /\b(near me|egypt|cairo|uae|california|mena)\b/.test(keyword);
  const intent = /\b(buy|cost|price|service|company|near me)\b/.test(keyword)
    ? 'transactional'
    : /\b(best|vs|versus|comparison|review|choose|buyer)\b/.test(keyword)
      ? 'commercial'
      : 'informational';
  return {
    keywordType: isQuestion ? 'question' : isLocal ? 'local' : words <= 2 ? 'short_tail' : words <= 3 ? 'mid_tail' : 'long_tail',
    intent,
  };
}

function seedExpansions(seeds: string[]): string[] {
  return seeds.flatMap((seed) => [
    ...MODIFIERS.map((modifier) => `${seed} ${modifier}`),
    `how to ${seed}`,
    `what is ${seed}`,
    `best ${seed}`,
  ]);
}

export async function ensureClientKeywordPool(pool: Pool, client: { id: string; slug: string; name: string }): Promise<{ added: number; active: number; researchCount: number }> {
  const profile = PROFILES[client.slug];
  if (!profile) throw new Error(`No keyword profile is configured for ${client.slug}.`);

  const existingResult = await pool.query('SELECT keyword FROM keywords WHERE client_id = $1 AND is_active = true', [client.id]);
  const existing = new Set(existingResult.rows.map((row) => normalize(row.keyword)).filter(Boolean));
  const needed = Math.max(0, MINIMUM_KEYWORD_POOL - existing.size);
  if (needed === 0) return { added: 0, active: existing.size, researchCount: 0 };

  let research: string[] = [];
  try {
    research = await openaiService.generateKeywordResearchPool(profile.seeds, Math.max(needed + 50, 350));
  } catch (error) {
    logger.warn('AI keyword research failed; using approved seed expansions', { clientId: client.id, error: (error as Error).message });
  }

  const candidates = new Map<string, 'ai_research' | 'seed_expansion'>();
  for (const keyword of research) {
    const value = normalize(keyword);
    if (value && !existing.has(value)) candidates.set(value, 'ai_research');
  }
  for (const keyword of seedExpansions(profile.seeds)) {
    const value = normalize(keyword);
    if (value && !existing.has(value) && !candidates.has(value)) candidates.set(value, 'seed_expansion');
  }

  if (candidates.size < needed) throw new Error(`Keyword profile for ${client.slug} produced only ${candidates.size} unique candidates; ${needed} are required.`);

  const selected = [...candidates.entries()].slice(0, needed);
  for (const [keyword, source] of selected) {
    const classification = classify(keyword);
    await pool.query(
      `INSERT INTO keywords (client_id, keyword, relevance_score, keyword_type, intent, source, metadata, is_active)
       VALUES ($1, $2, 50, $3, $4, $5, $6, true)
       ON CONFLICT (client_id, keyword) DO UPDATE SET is_active = true, updated_at = NOW()`,
      [
        client.id,
        keyword,
        classification.keywordType,
        classification.intent,
        source,
        JSON.stringify({
          industry: profile.industry,
          metricsStatus: 'not_enriched',
          researchMethod: source,
          generatedAt: new Date().toISOString(),
        }),
      ],
    );
  }

  const active = existing.size + selected.length;
  logger.info('Keyword pool ensured', { clientId: client.id, client: client.name, added: selected.length, active, researchCount: research.length });
  return { added: selected.length, active, researchCount: research.length };
}

export async function ensureAllActiveKeywordPools(pool: Pool) {
  const clients = await pool.query('SELECT id, slug, name FROM clients WHERE is_active = true ORDER BY name');
  const results = [];
  for (const client of clients.rows) results.push({ client: client.slug, ...(await ensureClientKeywordPool(pool, client)) });
  return results;
}
