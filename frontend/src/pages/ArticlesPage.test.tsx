import { describe, expect, it } from 'vitest';
import { buildGenerateArticlePayload } from './ArticlesPage';

describe('ArticlesPage generation payload', () => {
  it('includes selected clientId when present', () => {
    expect(buildGenerateArticlePayload('  Cairo brass care  ', 'client-123')).toEqual({
      keyword: 'Cairo brass care',
      clientId: 'client-123',
    });
  });

  it('omits clientId when no client is selected', () => {
    expect(buildGenerateArticlePayload('Topic', null)).toEqual({ keyword: 'Topic' });
  });
});
