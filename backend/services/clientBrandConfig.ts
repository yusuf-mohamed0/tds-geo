export type BrandSafetyConfig = {
  allowedProducts?: Set<string>;
  blockedProductPatterns?: RegExp[];
  forbiddenPhrases?: string[];
  preferredTerminology?: Record<string, string>;
  disallowedClaims?: string[];
  requiredDisclaimers?: string[];
};

const normalizeName = (value: string): string =>
  value.replace(/^(?:the|flaunt(?:\s+cosmetics(?:\s+global)?)?)\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();

const BRAND_SAFETY: Record<string, BrandSafetyConfig> = {
  'flaunt-cosmetics-global': {
    allowedProducts: new Set(['no hassle eyeliner stamp set']),
    blockedProductPatterns: [
      /\b(?:No-Fuss Skin Perfector|Precision Liquid Liner|Smudge[- ]Proof Mascara|Stay Put Mist|Peach Whisper|Office Ready)\b/i,
    ],
    forbiddenPhrases: [
      'medical grade', 'dermatologist tested', 'clinical study', 'our lab',
    ],
    preferredTerminology: {
      'eyeliner': 'eyeliner stamp',
      'makeup': 'beauty routine',
      'beginner': 'makeup beginner',
    },
    disallowedClaims: [
      'medical', 'dermatological', 'unsupported performance',
    ],
  },
  caravanserai: {
    forbiddenPhrases: [
      'mass produced', 'factory made', 'imported', 'machine crafted',
      'mass production', 'assembly line',
    ],
    preferredTerminology: {
      'furniture': 'handcrafted furniture',
      'decor': 'Egyptian home decor',
      'materials': 'solid wood, brass, and mother of pearl',
      'craftsmanship': 'Egyptian craftsmanship',
    },
    requiredDisclaimers: [
      'Each piece is handcrafted, so slight variations make every item unique.',
    ],
    disallowedClaims: [
      'antique', 'vintage', 'generic design',
    ],
  },
  'boston-pharma': {
    forbiddenPhrases: [
      'guaranteed results', 'miracle cure', 'proven to work', '100% effective',
      'better than prescription', 'natural alternative to medicine',
    ],
    preferredTerminology: {
      'medicine': 'pharmaceutical formulation',
      'drugs': 'medicinal products',
      'factory': 'manufacturing facility',
      'quality': 'pharmaceutical grade quality',
    },
    requiredDisclaimers: [
      'Always consult a healthcare professional before starting any medication.',
      'Boston Pharmaceutical Industries manufactures products in compliance with EDA regulations.',
    ],
    disallowedClaims: [
      'cure', 'guaranteed', 'treats all', 'miracle',
    ],
  },
  'boston-vet': {
    forbiddenPhrases: [
      'guaranteed to work', 'cures all animals', 'one size fits all',
      'magic cure', 'instant results',
    ],
    preferredTerminology: {
      'medicine': 'veterinary pharmaceutical',
      'animals': 'livestock and companion animals',
      'treatment': 'veterinary treatment',
    },
    requiredDisclaimers: [
      'Always consult a veterinarian before administering any animal health product.',
      'Dosage should be determined by a qualified veterinary professional.',
    ],
    disallowedClaims: [
      'cure all', 'guaranteed cure', 'works for every animal',
    ],
  },
  'alamein-2022': {
    forbiddenPhrases: [
      'indoor use only', 'not weather resistant', 'temporary',
    ],
    preferredTerminology: {
      'furniture': 'outdoor furniture',
      'durable': 'weather-resistant and durable',
      'garden': 'outdoor living space',
    },
    disallowedClaims: [
      'indoor only', 'not for outdoor',
    ],
  },
  'joes-venture': {
    forbiddenPhrases: [
      'vegan leather', 'faux leather', 'pleather', 'synthetic leather',
      'genuine leather', 'bonded leather',
    ],
    preferredTerminology: {
      'leather': 'full-grain leather',
      'made': 'handcrafted in France',
      'quality': 'artisan quality',
    },
    requiredDisclaimers: [
      'Each piece is individually handcrafted, which may result in slight variations in color and texture.',
    ],
    disallowedClaims: [
      'machine made', 'mass produced',
    ],
  },
  'acme-maintenance': {
    forbiddenPhrases: [
      'guaranteed safe', 'unbreakable', 'indestructible',
      'fits all applications',
    ],
    preferredTerminology: {
      'tools': 'industrial-grade tools',
      'equipment': 'heavy-duty equipment',
      'delivery': 'JIT delivery',
    },
    requiredDisclaimers: [
      'Always follow manufacturer safety guidelines and OSHA standards when using industrial equipment.',
    ],
  },
};

export function getBrandSafetyConfig(slug?: string | null): BrandSafetyConfig {
  const resolved = (slug === 'flaunt-egypt' || slug === 'flaunt-cosmetics-global')
    ? BRAND_SAFETY['flaunt-cosmetics-global']
    : (slug === 'alamein-egypt')
      ? BRAND_SAFETY['alamein-2022']
      : BRAND_SAFETY[slug || ''];
  return resolved || {};
}

export function checkBrandProductSafety(
  content: string,
  slug?: string | null,
): string[] {
  const config = getBrandSafetyConfig(slug);
  const issues: string[] = [];

  if (config.allowedProducts && config.allowedProducts.size > 0) {
    const productPattern = /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,5}\s+(?:Set|Liner|Mascara|Mist|Perfector|Tint|Blush))/g;
    const mentions = content.match(/\b[A-Z][\w-]+(?:\s+[A-Z][\w-]+){0,5}\b/g) || [];
    for (const mention of mentions) {
      const normalName = normalizeName(mention);
      if (normalName.length > 5 && !config.allowedProducts.has(normalName)) {
        issues.push(`Mentions potentially unapproved product: "${mention}"`);
      }
    }
  }

  if (config.blockedProductPatterns) {
    for (const pattern of config.blockedProductPatterns) {
      const match = content.match(pattern);
      if (match) {
        issues.push(`Contains blocked product reference: "${match[0]}"`);
      }
    }
  }

  return issues;
}
