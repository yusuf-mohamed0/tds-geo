import { useEffect, useState } from 'react';
import { Page, Card, Text, Spinner, Banner, DataTable, BlockStack, InlineStack } from '@shopify/polaris';
import { CheckSquare, TrendingDown, TrendingUp } from 'lucide-react';
import { apiFetch } from '../api/client';

interface Evaluation {
  id: string;
  title?: string;
  score: number;
  dimensions: Record<string, number>;
  summary?: string;
  evaluatedAt: string;
}

export default function QualityPage() {
  const [lowQuality, setLowQuality] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<unknown>('/api/quality/low-quality')
      .then((res) => {
        const r = res as Record<string, unknown>;
        const items = (r.data || r.evaluations || r.results || []) as Evaluation[];
        setLowQuality(Array.isArray(items) ? items : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    <Page title="Quality Scores" subtitle="Article quality evaluation and scoring">
      <BlockStack gap="400">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
            <Spinner accessibilityLabel="Loading quality scores" size="large" />
          </div>
        ) : lowQuality.length > 0 ? (
          <Card padding="0">
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text']}
              headings={['Article ID', 'Score', 'Dimensions', 'Date']}
              rows={rows}
            />
          </Card>
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
              <CheckSquare size={40} style={{ margin: '0 auto', color: 'var(--p-color-icon-success)', opacity: 0.4 }} />
              <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="p" variant="headingMd" tone="success">All articles are healthy</Text></div>
              <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">No low-quality scores detected</Text></div>
            </div>
          </Card>
        )}

        <Card background="bg-surface-secondary">
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <CheckSquare size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
              <Text as="h3" variant="headingSm">Evaluate Content</Text>
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">Use the API to evaluate content quality programmatically:</Text>
            <div style={{ background: 'var(--p-color-bg)', padding: 'var(--p-space-300)', borderRadius: 'var(--p-space-200)', fontSize: 'var(--p-font-size-200)', fontFamily: 'monospace' }}>
              POST /api/quality/evaluate {'{'} "articleId": "...", "content": "..." {'}'}
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
