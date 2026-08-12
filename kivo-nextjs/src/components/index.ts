// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * Kivo Geo Next.js Integration - React Components
 *
 * Pre-built, customizable React components for rendering
 * Kivo Geo blog content in your Next.js App Router site.
 *
 * @example
 *   import { KivoBlogList, KivoBlogPost } from '@tds/nextjs-integration/components';
 */

export { TdsGeoBlogList, TdsGeoBlogList as KivoBlogList } from './KivoBlogList';
export { TdsGeoBlogPost, TdsGeoBlogPost as KivoBlogPost } from './KivoBlogPost';
export { TdsGeoContent, TdsGeoContent as KivoContent } from './KivoContent';

export type {
  TdsGeoBlogListProps,
  TdsGeoBlogPostProps,
  TdsGeoContentProps,
} from '../types';
