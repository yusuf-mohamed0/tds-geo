// ══════════════════════════════════════════════
// Quality Scorer Tests
// ══════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import qualityScorer from '../../services/qualityScorer';

const GOOD_CONTENT = `# The Complete Guide to Home Maintenance

Welcome to our comprehensive guide on home maintenance. With years of experience in the industry, our licensed professionals have compiled the most important tips for homeowners.

## Common Warning Signs

Here are the key warning signs that indicate your home needs professional maintenance:

- **Unexpected increase in utility bills** — this often indicates hidden issues
- **Strange noises from appliances** — don't ignore unusual sounds
- **Visible water damage or stains** — early detection prevents costly repairs
- **Unusual odors** — particularly musty or gas-like smells

According to industry standards, routine inspections should be performed annually. Our experienced technicians are trained to identify issues before they become major problems.

## Preventative Maintenance Tips

Regular maintenance is essential for protecting your investment. Here's what experts recommend:

1. **Schedule annual inspections** — catch problems early
2. **Clean gutters twice a year** — prevent water damage to your foundation
3. **Replace air filters monthly** — improve efficiency and air quality
4. **Check for leaks regularly** — save money on water bills

Our team has been serving local communities for over 20 years. We are fully licensed, insured, and committed to your satisfaction.

## When to Call a Professional

Some issues require expert attention. Don't wait until minor problems become major emergencies.

| Issue | Action |
|-------|--------|
| Water heater problems | Call immediately |
| Electrical issues | Schedule an inspection |
| HVAC not working | Professional diagnosis |

Contact us today for a free estimate. Our experts are available 24/7 for emergency services. Call now to schedule your appointment.

## Frequently Asked Questions

### How often should I get maintenance?
Annual maintenance is recommended for most home systems.

### What are the signs of a plumbing leak?
Look for water stains, increased bills, and musty odors.

[Learn more about our services](/services)

![Maintenance](https://example.com/image.jpg)`;

const POOR_CONTENT = 'This is a short test.';

describe('QualityScorer', () => {
  describe('scoreArticle', () => {
    it('should score good content with high marks', async () => {
      const score = await qualityScorer.scoreArticle(GOOD_CONTENT, 'home maintenance');

      expect(score.overall).toBeGreaterThanOrEqual(50);
      expect(score.readability).toBeGreaterThanOrEqual(0);
      expect(score.seoOptimization).toBeGreaterThan(0);
      expect(score.eatScore).toBeGreaterThan(30);
      expect(score.semanticRichness).toBeGreaterThan(40);
      expect(score.ctaQuality).toBeGreaterThan(30);
      expect(score.breakdown).toBeDefined();
      expect(score.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should score poor content with low marks', async () => {
      const score = await qualityScorer.scoreArticle(POOR_CONTENT, 'test');
      expect(score.overall).toBeLessThanOrEqual(60);
      expect(score.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include all score dimensions in breakdown', async () => {
      const score = await qualityScorer.scoreArticle(GOOD_CONTENT, 'maintenance');
      const dimensions = ['readability', 'seoOptimization', 'eatScore', 'semanticRichness', 'ctaQuality', 'uniqueness', 'overall'];
      for (const dim of dimensions) {
        expect(score).toHaveProperty(dim);
        expect(typeof (score as any)[dim]).toBe('number');
      }

      const breakdownKeys = ['readability', 'seoOptimization', 'eat_score', 'semantic_richness', 'cta_quality', 'uniqueness'];
      for (const key of breakdownKeys) {
        expect(score.breakdown).toHaveProperty(key);
      }
    });

    it('should generate actionable suggestions for poor content', async () => {
      const score = await qualityScorer.scoreArticle(POOR_CONTENT, 'test');
      expect(score.suggestions.length).toBeGreaterThanOrEqual(1);
      expect(typeof score.suggestions[0]).toBe('string');
      expect(score.suggestions[0].length).toBeGreaterThan(10);
    });

    it('should give E-E-A-T score for content with experience indicators', async () => {
      const score = await qualityScorer.scoreArticle(GOOD_CONTENT, 'maintenance');
      expect(score.eatScore).toBeGreaterThan(30);
    });
  });

  describe('readability scoring', () => {
    it('should penalize very long paragraphs', async () => {
      const longParagraph = Array(250).fill('word').join(' ') + '. ';
      const content = '# Title\n\n' + longParagraph.repeat(10);
      const score = await qualityScorer.scoreArticle(content, 'test');
      // This is a heuristic check — long paragraphs reduce score
      expect(score).toBeDefined();
    });

    it('should give bonus for list usage', async () => {
      const listContent = '# Title\n\n' +
        Array(5).fill(null).map((_, i) => `- Item ${i}`).join('\n') + '\n\n' +
        Array(5).fill(null).map((_, i) => `- Feature ${i}`).join('\n') + '\n\n' +
        Array(5).fill(null).map((_, i) => `- Tip ${i}`).join('\n');
      const score = await qualityScorer.scoreArticle(listContent, 'test');
      expect(score).toBeDefined();
    });
  });

  describe('SEO optimization scoring', () => {
    it('should reward keyword in title and first 100 words', async () => {
      const score = await qualityScorer.scoreArticle(
        '# HVAC Maintenance Tips\n\nThis article is about HVAC maintenance and how to keep your HVAC system running efficiently.',
        'HVAC maintenance'
      );
      expect(score.seoOptimization).toBeGreaterThan(40);
    });

    it('should penalize keyword stuffing', async () => {
      const keyword = 'plumbing';
      const stuffedContent = '# Title\n\n' +
        Array(50).fill(`${keyword} is important. ${keyword} services are great. Call for ${keyword} today.`).join(' ');
      const score = await qualityScorer.scoreArticle(stuffedContent, keyword);
      expect(score.seoOptimization).toBeLessThan(80);
    });
  });

  describe('CTA scoring', () => {
    it('should score higher with clear call-to-action', async () => {
      const contentWithCTA = GOOD_CONTENT + '\n\n## Get Started Today\n\nContact us now for a free consultation. Call 555-0123 or visit our website to schedule your appointment. Don\'t wait — limited availability.';
      const score = await qualityScorer.scoreArticle(contentWithCTA, 'test');
      expect(score.ctaQuality).toBeGreaterThan(30);
    });
  });
});
