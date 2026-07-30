import { describe, expect, it } from 'vitest';
import { presentArticleHtml } from '../../services/articlePresentation';

describe('article presentation', () => {
  it('uses the Flaunt storefront typography and palette', () => {
    const result = presentArticleHtml('<p>Lead</p><h2>Routine</h2><p>Body</p>', { slug: 'flaunt-cosmetics-global' });

    expect(result).toContain('data-tds-article-style="flaunt"');
    expect(result).toContain("'Tenor Sans', serif");
    expect(result).toContain('#976750');
  });

  it('does not style an article twice', () => {
    const once = presentArticleHtml('<p>Body</p>', { slug: 'alamein-2022' });

    expect(presentArticleHtml(once, { slug: 'alamein-2022' })).toBe(once);
  });

  it.each([
    ['caravanserai', 'caravanserai'],
    ['boston-pharma', 'boston-pharma'],
    ['boston-vet', 'boston-vet'],
    ['alamein-2022', 'alamein'],
    ['acme-maintenance', 'acme-maintenance'],
  ])('uses the configured profile for %s', (slug, presentationId) => {
    expect(presentArticleHtml('<p>Body</p>', { slug })).toContain(
      `data-tds-article-style="${presentationId}"`,
    );
  });
});
