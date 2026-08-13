// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { stripHtmlTags } from '../../utils/stringUtils';

const INTERNAL_ARTICLE_MARKERS = [
  'GEO/AEO Answer Capsule',
  'Meta Draft',
  'FAQ Opportunities',
  'Publishing Checklist',
  'Do not publish',
  'connector repair',
  'token is repaired',
  'Shopify token',
  'WordPress write credentials',
  'CMS Publisher',
  'QA Operator',
  'Senior SEO Strategist',
  'Editorial Director',
  'Content Researcher',
  'EEAT Consultant',
  'GEO/AEO Specialist',
  'Compliance Reviewer',
];

export function findInternalArticleMarkers(contentHtml: string): string[] {
  const text = stripHtmlTags(contentHtml).toLowerCase();
  return INTERNAL_ARTICLE_MARKERS.filter(marker => text.includes(marker.toLowerCase()));
}

export function assertPublicArticleBody(contentHtml: string): void {
  const markers = findInternalArticleMarkers(contentHtml);
  if (markers.length > 0) {
    throw new Error(`Article body contains internal draft markers and cannot be sent to CMS: ${markers.join(', ')}`);
  }
}
