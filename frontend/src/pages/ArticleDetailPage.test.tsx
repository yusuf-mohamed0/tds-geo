import { describe, expect, it } from 'vitest';
import { cairoDateTimeToIso, formatCairoDateTimeForInputs } from './ArticleDetailPage';

describe('ArticleDetailPage scheduling helpers', () => {
  it('converts Cairo wall time to the correct UTC ISO instant', () => {
    expect(cairoDateTimeToIso('2026-08-06', '13:00')).toBe('2026-08-06T10:00:00.000Z');
  });

  it('formats stored UTC schedule values as Cairo input values', () => {
    expect(formatCairoDateTimeForInputs('2026-08-06T10:00:00.000Z')).toEqual({
      date: '2026-08-06',
      time: '13:00',
    });
  });
});
