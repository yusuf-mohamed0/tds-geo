import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Text, Spinner, Banner, BlockStack, InlineStack, InlineGrid, Badge, Button } from '@shopify/polaris';
import { Calendar, Clock } from 'lucide-react';
import DOMPurify from 'dompurify';
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
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiFetch<ArticleDetail>(`/api/articles/${id}`)
      .then((data) => {
        setArticle(data);
        if (data.scheduled_at) {
          const d = new Date(data.scheduled_at);
          setScheduleDate(d.toISOString().split('T')[0]);
          setScheduleTime(d.toTimeString().slice(0, 5));
        }
      })
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSchedule = async () => {
    if (!id || !scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setScheduleError('');
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00Z`).toISOString();
      const updated = await apiFetch<ArticleDetail>(`/api/articles/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduledAt }),
      });
      setArticle((prev) => prev ? { ...prev, scheduled_at: updated.scheduled_at } : prev);
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!id) return;
    setScheduling(true);
    try {
      await apiFetch(`/api/articles/${id}/schedule`, { method: 'DELETE' });
      setArticle((prev) => prev ? { ...prev, scheduled_at: null } : prev);
      setScheduleDate('');
      setScheduleTime('');
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setScheduling(false);
    }
  };

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

  const safeArticleHtml = DOMPurify.sanitize(article.content_html || '<p>No content</p>');

  return (
    <Page
      title={article.title}
      backAction={{ content: 'Articles', url: '/admin/articles' }}
      secondaryActions={[
        {
          content: 'View SEO Analysis',
          onAction: () => {
            const target = document.getElementById('seo-preview') || document.getElementById('article-details');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          },
        },
      ]}
    >
      <InlineGrid columns={{ xs: 1, md: '2fr 1fr' }} gap="400">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm" tone="subdued">Content</Text>
              <div
                className="prose prose-sm max-w-none leading-relaxed"
                style={{ color: 'var(--p-color-text)', fontSize: 'var(--p-font-size-325)', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: safeArticleHtml }}
              />
            </BlockStack>
          </Card>

          {article.meta_title && (
            <div id="seo-preview">
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
            </div>
          )}
        </BlockStack>

        <BlockStack gap={{ xs: '400', md: '200' }}>
          <div id="article-details">
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
                {article.scheduled_at && (
                  <Badge tone="info">Scheduled</Badge>
                )}
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
          </div>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="start" gap="200">
                <Calendar size={16} style={{ opacity: 0.6 }} />
                <Text as="h3" variant="headingSm" tone="subdued">Schedule Publishing</Text>
              </InlineStack>
              {article.scheduled_at ? (
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Clock size={14} style={{ opacity: 0.6 }} />
                    <Text as="p" variant="bodyMd">
                      {new Date(article.scheduled_at).toLocaleDateString(undefined, {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </InlineStack>
                  <Button
                    variant="primary"
                    tone="critical"
                    onClick={handleCancelSchedule}
                    loading={scheduling}
                  >Cancel Schedule</Button>
                </BlockStack>
              ) : (
                <BlockStack gap="200">
                  <div style={{ display: 'flex', gap: 'var(--p-space-200)' }}>
                    <input
                      aria-label="Schedule date"
                      type="date"
                      className="input"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      style={{ flex: 1 }}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <input
                      aria-label="Schedule time"
                      type="time"
                      className="input"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{ width: 120 }}
                    />
                  </div>
                  {scheduleError && (
                    <Text as="p" variant="bodySm" tone="critical">{scheduleError}</Text>
                  )}
                  <Button
                    variant="primary"
                    onClick={handleSchedule}
                    loading={scheduling}
                    disabled={!scheduleDate || !scheduleTime}
                  >Schedule</Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </BlockStack>
      </InlineGrid>
    </Page>
  );
}
