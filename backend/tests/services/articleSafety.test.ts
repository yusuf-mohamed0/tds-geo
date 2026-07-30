import { describe, expect, it } from 'vitest';
import { getArticleSafetyIssues } from '../../services/articleSafety';

describe('article safety', () => {
  it('accepts factual Markdown content', () => {
    const issues = getArticleSafetyIssues(
      '## A practical eyeliner routine\n\nUse short strokes and adjust the shape to suit your eye.',
      { name: 'Flaunt Cosmetics Global' },
    );

    expect(issues).toEqual([]);
  });

  it('rejects raw HTML, fabricated experience, and unapproved Flaunt products', () => {
    const issues = getArticleSafetyIssues(
      '<p>I have tested 50 product combinations in our studio with Flaunt Cosmetics Precision Liquid Liner.</p>',
      { name: 'Flaunt Cosmetics Global' },
    );

    expect(issues).toHaveLength(4);
  });
});
