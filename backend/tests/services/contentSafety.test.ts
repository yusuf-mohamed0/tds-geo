// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Content Safety Service Tests
// ══════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

// Mock the OpenAI service
vi.mock('../../services/openai', () => ({
  default: {
    moderateContent: vi.fn().mockResolvedValue({
      safe: true,
      flags: [],
      summary: 'Content is safe'
    })
  }
}));

import contentSafetyService from '../../services/contentSafety';

describe('ContentSafetyService', () => {
  describe('checkContent', () => {
    it('should return safe for normal content', async () => {
      const result = await contentSafetyService.checkContent(
        'Professional maintenance services for your home. Call us for a free estimate.',
        'home maintenance'
      );

      expect(result.safe).toBe(true);
      expect(result.flags).toHaveLength(0);
      expect(result.needsHumanReview).toBe(false);
    });

    it('should flag electrical hazard content', async () => {
      const result = await contentSafetyService.checkContent(
        'You can replace an electrical panel yourself by following these steps. First, disconnect the main breaker...',
        'electrical panel replacement'
      );

      const electricalFlags = result.flags.filter(f => f.category === 'electrical_hazard');
      expect(electricalFlags.length).toBeGreaterThan(0);
      expect(electricalFlags[0].severity).toBe('critical');
      expect(result.safe).toBe(false);
    });

    it('should flag gas line DIY instructions', async () => {
      const result = await contentSafetyService.checkContent(
        'How to repair a gas line yourself. Cut the gas supply pipe and replace with new fitting.',
        'gas line repair'
      );

      const gasFlags = result.flags.filter(f => f.category === 'gas_hazard');
      expect(gasFlags.length).toBeGreaterThan(0);
      expect(result.safe).toBe(false);
    });

    it('should flag medical claims', async () => {
      const result = await contentSafetyService.checkContent(
        'Our service can cure your allergies and treat respiratory conditions caused by poor indoor air quality.',
        'air quality'
      );

      const medicalFlags = result.flags.filter(f => f.category === 'medical_claim');
      expect(medicalFlags.length).toBeGreaterThan(0);
      expect(result.safe).toBe(false);
    });

    it('should flag overpromises', async () => {
      const result = await contentSafetyService.checkContent(
        'We guarantee 100% satisfaction or your money back. Our solution always works.',
        'satisfaction guarantee'
      );

      const overpromiseFlags = result.flags.filter(f => f.category === 'overpromise');
      expect(overpromiseFlags.length).toBeGreaterThan(0);
    });

    it('should flag structural hazards', async () => {
      const result = await contentSafetyService.checkContent(
        'You can remove a load-bearing wall by installing a temporary support beam yourself.',
        'wall removal'
      );

      const structuralFlags = result.flags.filter(f => f.category === 'structural_hazard');
      expect(structuralFlags.length).toBeGreaterThan(0);
      expect(result.safe).toBe(false);
    });

    it('should flag asbestos DIY', async () => {
      const result = await contentSafetyService.checkContent(
        'Guide to asbestos removal yourself: Follow these DIY steps for safe asbestos abatement.',
        'asbestos removal'
      );

      const toxicFlags = result.flags.filter(f => f.category === 'toxic_hazard');
      expect(toxicFlags.length).toBeGreaterThan(0);
      expect(result.safe).toBe(false);
    });

    it('should detect hallucinated statistics', async () => {
      const result = await contentSafetyService.checkContent(
        '75% of homes have this issue. 60% of customers report improvement. 90% of houses need maintenance.\n\nAccording to a study by Research Institute, these findings are conclusive.',
        'home maintenance'
      );

      const hallucinatedFlags = result.flags.filter(f => f.category === 'hallucinated_stat');
      expect(hallucinatedFlags.length).toBeGreaterThan(0);

      const citationFlags = result.flags.filter(f => f.category === 'unsubstantiated_citation');
      expect(citationFlags.length).toBeGreaterThan(0);
    });

    it('should handle empty content gracefully', async () => {
      const result = await contentSafetyService.checkContent('', 'test');
      expect(result.safe).toBe(true);
      expect(result.flags).toHaveLength(0);
    });
  });
});
