// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// SEO Service Tests
// ══════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/openai', () => ({
  default: {
    analyzeSEO: vi.fn().mockRejectedValue(new Error('API unavailable')),
    moderateContent: vi.fn().mockResolvedValue({ safe: true, flags: [], summary: 'safe' })
  }
}));

import seoService from '../../services/seo';

describe('SeoService', () => {
  describe('analyzeContent', () => {
    it('should return heuristic analysis when AI is unavailable', async () => {
      const result = await seoService.analyzeContent(
        '# Test Article\n\n## Section One\n\nContent about plumbing maintenance. Plumbers fix pipes.\n\n## Section Two\n\nMore content here about water heaters.\n\n## Section Three\n\nPreventative tips for your home plumbing system.',
        'plumbing maintenance'
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.keywordDensity).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
      expect(result.headingStructure).toBeDefined();
      expect(result.headingStructure.h2).toBeGreaterThanOrEqual(3);
    });

    it('should detect keyword stuffing', async () => {
      const keyword = 'plumbing';
      const content = Array(50).fill(
        'Plumbing is important. Plumbing services are great. Call for plumbing today.'
      ).join(' ');

      const result = await seoService.analyzeContent(content, keyword);
      expect(result.keywordDensity).toBeGreaterThan(2.5);
    });

    it('should detect missing keyword in intro', async () => {
      const result = await seoService.analyzeContent(
        '# About Our Company\n\n## History\n\nWe have been in business since 1990.\n\n## Services\n\nWe offer various services.',
        'keyword not in content'
      );

      const hasIntroSuggestion = result.suggestions.some(s =>
        s.toLowerCase().includes('first 100 words') ||
        s.toLowerCase().includes('within the first')
      );
      expect(hasIntroSuggestion || result.score < 60).toBe(true);
    });

    it('should handle very short content gracefully', async () => {
      const result = await seoService.analyzeContent('Short content.', 'test');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateSlug', () => {
    it('should generate clean URLs', () => {
      expect(seoService.generateSlug('10 Plumbing Tips for Homeowners'))
        .toBe('10-plumbing-tips-for-homeowners');
    });

    it('should handle special characters', () => {
      expect(seoService.generateSlug('What\'s the Best HVAC Service? 2024!'))
        .toBe('whats-the-best-hvac-service-2024');
    });

    it('should handle leading/trailing spaces', () => {
      expect(seoService.generateSlug('  Trimmed Title  ')).toBe('trimmed-title');
    });

    it('should return empty string for empty input', () => {
      expect(seoService.generateSlug('')).toBe('');
    });
  });

  describe('validateContent', () => {
    it('should validate good content', () => {
      const result = seoService.validateContent({
        title: '10 Tips for Home Maintenance',
        content: Array(300).fill('word ').join(''),
        metaTitle: 'Home Maintenance Tips',
        metaDescription: 'Learn about home maintenance with these professional tips.',
        tags: ['maintenance', 'home', 'tips']
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch short title', () => {
      const result = seoService.validateContent({
        title: 'Short',
        content: 'valid content here',
        metaTitle: 'Meta',
        metaDescription: 'Desc',
        tags: ['tag1']
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Title'))).toBe(true);
    });

    it('should catch missing tags', () => {
      const result = seoService.validateContent({
        title: 'Valid Title Here',
        content: Array(300).fill('word ').join(''),
        metaTitle: 'Meta Title',
        metaDescription: 'Description here'
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tags'))).toBe(true);
    });

    it('should catch short content', () => {
      const result = seoService.validateContent({
        title: 'Valid Title Here',
        content: 'Short content.',
        metaTitle: 'Meta Title',
        metaDescription: 'Description here',
        tags: ['tag1', 'tag2']
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('content'))).toBe(true);
    });
  });

  describe('generateSocialPreview', () => {
    it('should truncate long content', () => {
      const longText = 'A'.repeat(200);
      const preview = seoService.generateSocialPreview(longText, 100);
      expect(preview.length).toBeLessThanOrEqual(103);
      expect(preview.endsWith('...')).toBe(true);
    });

    it('should return short content as-is', () => {
      const shortText = 'Short preview text';
      expect(seoService.generateSocialPreview(shortText)).toBe(shortText);
    });

    it('should strip markdown formatting', () => {
      const mdContent = '# Heading\n\n**Bold** and *italic* [link](url)';
      const preview = seoService.generateSocialPreview(mdContent);
      expect(preview).not.toContain('#');
      expect(preview).not.toContain('**');
      expect(preview).not.toContain('[');
    });
  });
});
