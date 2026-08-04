import { useCallback, useEffect, useState } from 'react';
import { Page, Card, Text, Banner, DataTable, BlockStack, InlineStack, SkeletonPage, SkeletonBodyText } from '@shopify/polaris';
import { CheckSquare, TrendingDown, TrendingUp, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { apiFetch } from '../api/client';

interface Evaluation {
  id: string;
  title?: string;
  score: number;
  dimensions: Record<string, number>;
  summary?: string;
  evaluatedAt: string;
}

interface QualitySummary {
  total_articles: number;
  evaluated_articles: number;
  healthy_articles: number;
  low_quality_articles: number;
  pending_articles: number;
  threshold: number;
}

export default function QualityPage() {
  const [lowQuality, setLowQuality] = useState<Evaluation[]>([]);
  const [summary, setSummary] = useState<QualitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResult, lowQualityResult] = await Promise.all([
        apiFetch<QualitySummary>('/api/quality/summary'),
        apiFetch<{ data: Evaluation[] }>('/api/quality/low-quality'),
      ]);
      setSummary(summaryResult);
      setLowQuality(lowQualityResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load quality audit results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runAudit = async () => {
    setAuditing(true);
    setError('');
    try {
      await apiFetch('/api/quality/evaluate-all', { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run the quality audit.');
    } finally {
      setAuditing(false);
    }
  };

  const rows = lowQuality.map((e) => [
    <Text as="span" variant="bodySm" tone="subdued">{e.id.slice(0, 8)}...</Text>,
    <InlineStack gap="100" blockAlign="center">
      {e.score < 50 ? (
        <TrendingDown size={14} style={{ color: 'var(--p-color-icon-critical)' }} />
      ) : (
        <TrendingUp size={14} style={{ color: 'var(--p-color-text-warning)' }} />
      )}
      <Text as="span" variant="bodyMd" fontWeight="medium" tone={e.score < 50 ? 'critical' : undefined}>{e.score}/100</Text>
    </InlineStack>,
    <Text as="span" variant="bodySm" tone="subdued">
      {e.dimensions ? Object.entries(e.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}
    </Text>,
    <Text as="span" variant="bodySm" tone="subdued">{new Date(e.evaluatedAt).toLocaleDateString()}</Text>,
  ]);

  return (
    <Page
      title="Quality Scores"
      subtitle="Persisted article audits across readability, SEO, E-E-A-T, semantic coverage, CTA, and uniqueness"
      primaryAction={{ content: auditing ? 'Auditing articles...' : 'Audit all articles', onAction: runAudit, loading: auditing, disabled: loading || auditing }}
    >
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError('')}>{error}</Banner>}
        {loading ? (
          <SkeletonPage title="Quality Scores">
            <SkeletonBodyText lines={6} />
          </SkeletonPage>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: 'Articles', value: summary.total_articles },
                  { label: 'Audited', value: summary.evaluated_articles },
                  { label: 'Meet threshold', value: summary.healthy_articles },
                  { label: 'Needs review', value: summary.low_quality_articles },
                  { label: 'Pending audit', value: summary.pending_articles },
                ].map((metric) => (
                  <Card key={metric.label}>
                    <Text as="p" variant="heading2xl" fontWeight="bold">{metric.value}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{metric.label}</Text>
                  </Card>
                ))}
              </div>
            )}

            {lowQuality.length > 0 ? (
              <Card padding="0">
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text']}
                  headings={['Article', 'Score', 'Dimensions', 'Audited']}
                  rows={rows.map((row, index) => [
                    <Text as="span" variant="bodyMd" fontWeight="medium">{lowQuality[index].title || lowQuality[index].id.slice(0, 8)}</Text>,
                    ...row.slice(1),
                  ])}
                />
              </Card>
            ) : summary?.pending_articles ? (
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
                  <ClipboardCheck size={40} style={{ margin: '0 auto', color: 'var(--p-color-icon-warning)', opacity: 0.6 }} />
                  <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="p" variant="headingMd">Quality audit is incomplete</Text></div>
                  <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">{summary.pending_articles} article{summary.pending_articles === 1 ? '' : 's'} need{summary.pending_articles === 1 ? 's' : ''} an audit before a quality status can be reported.</Text></div>
                </div>
              </Card>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
                  <CheckSquare size={40} style={{ margin: '0 auto', color: 'var(--p-color-icon-success)', opacity: 0.6 }} />
                  <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="p" variant="headingMd" tone="success">All audited articles meet the quality threshold</Text></div>
                  <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">Every active article has a persisted score of at least {summary?.threshold || 65}/100.</Text></div>
                </div>
              </Card>
            )}
          </>
        )}

        <Card background="bg-surface-secondary">
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <AlertTriangle size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
              <Text as="h3" variant="headingSm">Audit rules</Text>
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">Scores are persisted and refreshed by the audit action. Articles below {summary?.threshold || 65}/100 are listed above for review; unevaluated articles are never reported as healthy.</Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
