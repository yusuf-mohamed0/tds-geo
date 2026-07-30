// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Pexels Image Service
// High-quality royalty-free image integration with semantic matching,
// caching, and alt-text generation
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';
import { PexelsImage, PexelsCacheEntry } from '../types';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
if (!PEXELS_API_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('PEXELS_API_KEY environment variable is required in production');
}

interface PexelsSearchResponse {
  photos: Array<{
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url: string;
    avg_color?: string;
    src: {
      original: string;
      large: string;
      medium: string;
      small: string;
      portrait: string;
      landscape: string;
    };
    alt?: string;
  }>;
  total_results: number;
  page: number;
  per_page: number;
}

interface SelectedImage {
  pexelsId: number;
  url: string;
  photographer: string;
  photographerUrl: string;
  altText: string;
  width: number;
  height: number;
  avgColor?: string;
}

class PexelsService {
  private pool: Pool | null = null;
  private readonly baseUrl = 'https://api.pexels.com/v1';

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Pexels Image Service initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // CORE API CALLS
  // ══════════════════════════════════════════════════════════════

  private async searchPexels(
    query: string,
    options: {
      perPage?: number;
      orientation?: 'landscape' | 'portrait' | 'square';
      size?: 'large' | 'medium' | 'small';
      color?: string;
    } = {}
  ): Promise<PexelsSearchResponse> {
    const params = new URLSearchParams({
      query,
      per_page: String(options.perPage || 5),
      ...(options.orientation ? { orientation: options.orientation } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.color ? { color: options.color } : {})
    });

    const response = await fetch(`${this.baseUrl}/search?${params}`, {
      headers: {
        Authorization: PEXELS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PexelsSearchResponse;
    return data;
  }

  private async getPexelsPhoto(photoId: number): Promise<PexelsSearchResponse['photos'][0]> {
    const response = await fetch(`${this.baseUrl}/photos/${photoId}`, {
      headers: { Authorization: PEXELS_API_KEY }
    });

    if (!response.ok) {
      throw new Error(`Pexels photo fetch error: ${response.status}`);
    }

    const data = await response.json() as PexelsSearchResponse['photos'][0];
    return data;
  }

  // ══════════════════════════════════════════════════════════════
  // SEMANTIC IMAGE SEARCH
  // ══════════════════════════════════════════════════════════════

  async findImagesForArticle(
    clientId: string,
    articleTitle: string,
    keyword: string,
    sections?: string[]
  ): Promise<{
    featuredImage: SelectedImage;
    sectionImages: SelectedImage[];
  }> {
    // Generate optimized search queries using LLM
    const searchQueries = await this.generateImageSearchQueries(articleTitle, keyword, sections);

    // Search for featured image
    const featuredQuery = searchQueries.featured;
    const featuredResult = await this.searchPexels(featuredQuery, { orientation: 'landscape', perPage: 5 });
    const featuredImage = await this.selectBestImage(featuredResult, clientId, featuredQuery);
    await this.cacheImage(clientId, featuredImage, featuredQuery, true);

    // Search for section images
    const sectionImages: SelectedImage[] = [];
    for (const query of searchQueries.sections) {
      const result = await this.searchPexels(query, { orientation: 'landscape', perPage: 3 });
      const image = await this.selectBestImage(result, clientId, query);
      if (image) {
        sectionImages.push(image);
        await this.cacheImage(clientId, image, query, false);
      }
    }

    logger.info(`Found ${1 + sectionImages.length} images for article`, {
      title: articleTitle,
      featuredQuery
    });

    return { featuredImage, sectionImages };
  }

  private async generateImageSearchQueries(
    title: string,
    keyword: string,
    sections?: string[]
  ): Promise<{ featured: string; sections: string[] }> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are an image search expert. Given article title and keyword, generate optimal Pexels search queries.
Queries should be:
- 2-4 words long
- Descriptive but not overly specific
- Focus on concepts, not people (unless relevant)
- Suitable for royalty-free stock photography
- Avoid: medical procedures, dangerous activities, specific brands

Respond with JSON:
{
  "featured": "main image search query",
  "sections": ["section image query 1", "section image query 2"]
}`
        },
        {
          role: 'user',
          content: `Title: "${title}"\nKeyword: "${keyword}"${sections ? `\nSections: ${sections.join(', ')}` : ''}`
        }
      ], { temperature: 0.3 });

      if (result) {
        const parsed = JSON.parse(result);
        return {
          featured: parsed.featured || keyword,
          sections: parsed.sections || []
        };
      }
    } catch (err) {
      logger.warn('Image search query generation failed', { error: (err as Error).message });
    }

    return { featured: keyword, sections: sections?.slice(0, 3) || [] };
  }

  private async selectBestImage(
    searchResult: PexelsSearchResponse,
    clientId: string,
    query: string
  ): Promise<SelectedImage> {
    if (!searchResult.photos || searchResult.photos.length === 0) {
      // Return placeholder if no images found
      return {
        pexelsId: 0,
        url: `https://via.placeholder.com/1200x800?text=${encodeURIComponent(query)}`,
        photographer: 'Placeholder',
        photographerUrl: '',
        altText: query,
        width: 1200,
        height: 800,
        avgColor: '#6B7280'
      };
    }

    // Check cache for duplicates
    const cachedIds = await this.getCachedImageIds(clientId);

    // Pick the first non-cached image, or first if all cached
    let photo = searchResult.photos[0];
    for (const p of searchResult.photos) {
      if (!cachedIds.includes(p.id)) {
        photo = p;
        break;
      }
    }

    const altText = await this.generateAltText(query, photo.alt);

    return {
      pexelsId: photo.id,
      url: photo.src.large || photo.src.medium,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      altText,
      width: photo.width,
      height: photo.height,
      avgColor: photo.avg_color
    };
  }

  private async generateAltText(query: string, originalAlt?: string): Promise<string> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: 'Generate concise, SEO-optimized image alt text (max 125 characters). Respond with only the alt text.'
        },
        {
          role: 'user',
          content: `Generate alt text for an image searched with query: "${query}"${originalAlt ? `\nOriginal description: ${originalAlt}` : ''}`
        }
      ], { temperature: 0.2 });

      if (result) {
        return result.trim().slice(0, 125);
      }
    } catch (err) {
      logger.warn('Alt text generation failed', { error: (err as Error).message });
    }

    return originalAlt || query;
  }

  // ══════════════════════════════════════════════════════════════
  // CACHING
  // ══════════════════════════════════════════════════════════════

  async cacheImage(
    clientId: string,
    image: SelectedImage,
    searchQuery: string,
    isFeatured: boolean
  ): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO pexels_cache (client_id, search_query, pexels_id, url, photographer, photographer_url, alt_text, width, height, avg_color, is_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (client_id, pexels_id) DO UPDATE SET is_used = true`,
        [clientId, searchQuery, image.pexelsId, image.url, image.photographer, image.photographerUrl,
         image.altText, image.width, image.height, image.avgColor || null, true]
      );
    } catch (err) {
      logger.warn('Failed to cache pexels image', { error: (err as Error).message });
    }
  }

  async getCachedImageIds(clientId: string): Promise<number[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT pexels_id FROM pexels_cache WHERE client_id = $1 AND is_used = true',
      [clientId]
    );
    return result.rows.map(r => r.pexels_id);
  }

  async getImageAttribution(clientId: string, articleId: string): Promise<PexelsCacheEntry[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM pexels_cache WHERE client_id = $1 AND article_id = $2 ORDER BY created_at ASC',
      [clientId, articleId]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // BYPASS / FALLBACK
  // ══════════════════════════════════════════════════════════════

  async isPexelsAvailable(): Promise<boolean> {
    if (!PEXELS_API_KEY || PEXELS_API_KEY === 'placeholder') return false;
    try {
      const result = await this.searchPexels('test', { perPage: 1 });
      return result.total_results > 0;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new PexelsService();
