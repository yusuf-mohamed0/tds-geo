import { describe, expect, it } from 'vitest';
import { convert } from '../../utils/markdownToHtml';

describe('markdownToHtml', () => {
  it('removes a duplicate title while preserving article section headings', () => {
    const html = convert('# Article\n\n## Section');

    expect(html).not.toContain('Article');
    expect(html).toContain('<h2>Section</h2>');
  });
});
