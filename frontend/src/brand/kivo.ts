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
    obsidian: '#071013',
    gold: '#22E6A8',
    cream: '#F4FBF8',
    graphite: '#25343A',
    muted: '#6D7E86',
    navy: '#0B1F3A',
    sky: '#3BB5FF',
    peach: '#C7B8FF',
    amber: '#B7FF4A',
    white: '#FFFFFF',
    border: '#D9E8E2',
  },
  status: {
    danger: '#ef4444',
  },
  gradients: {
    command: 'radial-gradient(circle at top left, rgba(34,230,168,.22), transparent 34%), radial-gradient(circle at 80% 20%, rgba(59,181,255,.16), transparent 28%), linear-gradient(135deg, #071013 0%, #0B1F3A 62%, #132E32 100%)',
    surface: 'linear-gradient(180deg, #FFFFFF 0%, #F4FBF8 100%)',
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
