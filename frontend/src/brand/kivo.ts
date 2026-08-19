export const KIVO_BRAND = {
  company: 'Kivo',
  os: 'Kivo OS',
  geo: 'Kivo Geo',
  pulse: 'Kivo Pulse',
  vault: 'Kivo Vault',
  tagline: 'Make search systems see you.',
  positioning: 'Technical visibility infrastructure for AI search, commerce content, telemetry, and automated recovery.',
  assets: {
    markWhite: '/assets/kivo-mark.svg',
    markBlack: '/assets/kivo-mark.svg',
    markSvg: '/assets/kivo-mark.svg',
    manifest: '/site.webmanifest',
  },
  colors: {
    obsidian: '#09060B',
    gold: '#B93CFC',
    cream: '#F3EBF5',
    graphite: '#222124',
    muted: '#222124',
    navy: '#09060B',
    sky: '#8109F5',
    peach: '#B93CFC',
    amber: '#B93CFC',
    white: '#FFFFFF',
    border: '#D8CEE0',
  },
  status: {
    danger: '#B93CFC',
  },
  gradients: {
    command: 'radial-gradient(circle at top left, rgba(185,60,252,.18), transparent 34%), radial-gradient(circle at 80% 20%, rgba(129,9,245,.16), transparent 28%), linear-gradient(135deg, #09060B 0%, #09060B 62%, #222124 100%)',
    surface: 'linear-gradient(180deg, #FFFFFF 0%, #F3EBF5 100%)',
  },
  icons: {
    system: 'Layers3',
    geo: 'Search',
    pulse: 'HeartPulse',
    vault: 'Archive',
    agents: 'Bot',
    commerce: 'Store',
    reports: 'BarChart3',
    infrastructure: 'Server',
  },
} as const;

export type KivoColorName = keyof typeof KIVO_BRAND.colors;
