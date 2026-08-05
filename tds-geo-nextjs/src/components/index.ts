// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * TDS Geo Next.js Integration — React Components
 *
 * Pre-built, customizable React components for rendering
 * TDS Geo blog content in your Next.js App Router site.
 *
 * @example
 *   import { KozmoCoreBlogList, KozmoCoreBlogPost } from '@tds-geo/nextjs-integration/components';
 */

export { TdsGeoBlogList, TdsGeoBlogList as KozmoCoreBlogList } from './KozmoCoreBlogList';
export { TdsGeoBlogPost, TdsGeoBlogPost as KozmoCoreBlogPost } from './KozmoCoreBlogPost';
export { TdsGeoContent, TdsGeoContent as KozmoCoreContent } from './KozmoCoreContent';

export type {
  TdsGeoBlogListProps,
  TdsGeoBlogPostProps,
  TdsGeoContentProps,
} from '../types';
