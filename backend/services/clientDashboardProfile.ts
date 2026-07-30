import { getArticlePresentationDetails } from './articlePresentation';

type ClientProfile = {
  industry: string;
  summary: string;
  contentFocus: string[];
};

const PROFILES: Record<string, ClientProfile> = {
  'flaunt-cosmetics-global': {
    industry: 'Beauty and cosmetics',
    summary: 'Beginner-friendly eyeliner education for UAE and Egypt audiences.',
    contentFocus: ['Eyeliner tutorials', 'Eye-shape guides', 'Easy makeup routines', 'UAE and Egypt beauty context'],
  },
  caravanserai: {
    industry: 'Handmade furniture and decor',
    summary: 'Egyptian craftsmanship, artisanal home decor, and considered interiors.',
    contentFocus: ['Craft stories', 'Home decor guides', 'Material care', 'Cairo and Egyptian design'],
  },
  'boston-pharma': {
    industry: 'Pharmaceutical manufacturing',
    summary: 'Educational, regulation-aware content for Egyptian pharmaceutical products.',
    contentFocus: ['Product education', 'Ingredient information', 'Healthcare literacy', 'Category landing pages'],
  },
  'boston-vet': {
    industry: 'Veterinary pharmaceutical',
    summary: 'Veterinary health education for clinics, farmers, and pet owners.',
    contentFocus: ['Animal health', 'Poultry care', 'Feed formulation', 'Pet wellbeing'],
  },
  'alamein-2022': {
    industry: 'Outdoor furniture',
    summary: 'Outdoor living, commercial furniture, and maintenance guidance for Egypt.',
    contentFocus: ['Outdoor furniture', 'Playgrounds', 'Terrace living', 'Care and maintenance'],
  },
  'acme-maintenance': {
    industry: 'Home maintenance',
    summary: 'Service-led maintenance education for California homeowners.',
    contentFocus: ['Seasonal care', 'Preventive maintenance', 'Home safety', 'Service checklists'],
  },
};

export function getClientDashboardProfile(client: { slug?: string | null; name?: string | null }) {
  const profile = PROFILES[client.slug || ''] || {
    industry: 'Client profile pending',
    summary: 'Complete client onboarding to add brand and content guidance.',
    contentFocus: [],
  };

  return {
    ...profile,
    presentation: getArticlePresentationDetails(client),
  };
}
