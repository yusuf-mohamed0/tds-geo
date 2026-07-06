import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Text, Spinner, Banner, BlockStack, InlineStack, InlineGrid, Badge } from '@shopify/polaris';
import { apiFetch } from '../api/client';

interface ArticleDetail {
  id: string;
  title: string;
  content_md: string;
  content_html: string;
  meta_title: string;
  meta_description: string;
  tags: string[];
  word_count: number;
  status: string;
  seo_score: string | number;
  keyword: string;
  created_at: string;
  updated_at: string;
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiFetch<ArticleDetail>(`/api/articles/${id}`)
      .then(setArticle)
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Page title="Loading..." backAction={{ content: 'Articles', url: '/admin/articles' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
          <Spinner accessibilityLabel="Loading article" size="large" />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Error" backAction={{ content: 'Articles', url: '/admin/articles' }}>
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  if (!article) {
    return (
      <Page title="Not found" backAction={{ content: 'Articles', url: '/admin/articles' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
            <Text as="p" variant="bodyMd" tone="subdued">Article not found</Text>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={article.title}
      backAction={{ content: 'Articles', url: '/admin/articles' }}
      secondaryActions={[
        { content: 'View SEO Analysis' },
      ]}
    >
      <InlineGrid columns={{ xs: 1, md: '2fr 1fr' }} gap="400">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm" tone="subdued">Content</Text>
              <div
                className="prose prose-invert prose-sm max-w-none text-brand-text/80 leading-relaxed"
                style={{ color: 'var(--p-color-text)', fontSize: 'var(--p-font-size-325)', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: article.content_html || '<p>No content</p>' }}
              />
            </BlockStack>
          </Card>

          {article.meta_title && (
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">SEO Preview</Text>
                <Text as="p" variant="bodySm">https://example.com/{article.id}</Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">{article.meta_title}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{article.meta_description}</Text>
                {article.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--p-space-100)', flexWrap: 'wrap' }}>
                    {article.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                )}
              </BlockStack>
            </Card>
          )}
        </BlockStack>

        <BlockStack gap={{ xs: '400', md: '200' }}>
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm" tone="subdued">Details</Text>
              <InlineStack gap="200" align="start" blockAlign="center">
                <Badge tone={
                  article.status === 'published' ? 'success' :
                  article.status === 'approved' ? 'info' :
                  article.status === 'generated' ? 'warning' :
                  article.status === 'rejected' ? 'critical' : 'attention'
                }>{article.status}</Badge>
              </InlineStack>
              <div>
                <Text as="p" variant="bodySm" tone="subdued">SEO Score</Text>
                <Text as="p" variant="bodyMd" fontWeight="medium">{article.seo_score || '-'}</Text>
              </div>
              <div>
                <Text as="p" variant="bodySm" tone="subdued">Word Count</Text>
                <Text as="p" variant="bodyMd" fontWeight="medium">{article.word_count || '-'}</Text>
              </div>
              {article.keyword && (
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">Keyword</Text>
                  <Badge>{article.keyword}</Badge>
                </div>
              )}
              {article.created_at && (
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">Created</Text>
                  <Text as="p" variant="bodyMd">{new Date(article.created_at).toLocaleDateString()}</Text>
                </div>
              )}
              {article.updated_at && (
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">Updated</Text>
                  <Text as="p" variant="bodyMd">{new Date(article.updated_at).toLocaleDateString()}</Text>
                </div>
              )}
            </BlockStack>
          </Card>
        </BlockStack>
      </InlineGrid>
    </Page>
  );
}
