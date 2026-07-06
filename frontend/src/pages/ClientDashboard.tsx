import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Text, Spinner, Banner, BlockStack, InlineStack } from '@shopify/polaris';
import { ArrowLeft, FileText, DollarSign, Target, Store } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { apiFetch } from '../api/client';

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    apiFetch<Record<string, unknown>>(`/api/analytics/${clientId}/overview`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Page title="Client Dashboard" backAction={{ content: 'Clients', url: '/admin/clients' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
          <Spinner accessibilityLabel="Loading client data" size="large" />
        </div>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page title="Client not found" backAction={{ content: 'Clients', url: '/admin/clients' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
            <Store size={40} style={{ margin: '0 auto', opacity: 0.4 }} />
            <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="p" variant="bodyMd" tone="subdued">Client not found</Text></div>
          </div>
        </Card>
      </Page>
    );
  }

  const articleStats = (data.articleStats || data.articles || {}) as Record<string, number>;
  const allArticles = articleStats.total || 0;
  const pipeline = {
    total: allArticles,
    draft: Math.max(0, allArticles - (articleStats.published || 0) - (articleStats.approved || 0) - (articleStats.pending || 0) - (articleStats.rejected || 0) - (articleStats.failed || 0)),
    generated: articleStats.pending || 0,
    approved: articleStats.approved || 0,
    published: articleStats.published || 0,
  };

  const costs = (data.costs || {}) as Record<string, number | string>;
  const costTotal = parseFloat(String(costs.total_cost || costs.total_cost_mtd || costs.total || costs.mtd || '0'));
  const costOpenai = parseFloat(String(costs.openai || costs.openai_cost || '0'));
  const costSerp = parseFloat(String(costs.serp || costs.serpapi || '0'));
  const keywordStats = (data.keywordStats || data.keywords || {}) as Record<string, number>;

  return (
    <Page title="Client Dashboard" backAction={{ content: 'Clients', url: '/admin/clients' }}>
      <BlockStack gap="400">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard icon={<FileText size={20} />} label="Total Articles" value={pipeline.total} color="#818CF8" />
          <MetricCard icon={<FileText size={20} />} label="Published" value={pipeline.published} color="#34D399" />
          <MetricCard icon={<Target size={20} />} label="Keywords" value={keywordStats.total || 0} color="#F472B6" />
          <MetricCard icon={<DollarSign size={20} />} label="MTD Costs" value={`$${costTotal.toFixed(2)}`} color="#FBBF24" />
        </div>

        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm">Article Pipeline</Text>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--p-space-300)', height: 128 }}>
              {[
                { label: 'Draft', value: pipeline.draft, color: '#6B7280' },
                { label: 'Generated', value: pipeline.generated, color: '#CA8A04' },
                { label: 'Approved', value: pipeline.approved, color: '#3B82F6' },
                { label: 'Published', value: pipeline.published, color: '#22C55E' },
              ].map((stage) => {
                const max = Math.max(pipeline.draft, pipeline.generated, pipeline.approved, pipeline.published, 1);
                const height = (stage.value / max) * 100;
                return (
                  <div key={stage.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--p-space-100)' }}>
                    <Text as="span" variant="headingLg" fontWeight="bold">{stage.value}</Text>
                    <div style={{ width: '100%', borderRadius: 'var(--p-space-100)', background: stage.color, height: `${Math.max(height, 4)}%`, minHeight: 4, transition: 'height 0.3s' }} />
                    <Text as="span" variant="bodyXs" tone="subdued">{stage.label}</Text>
                  </div>
                );
              })}
            </div>
          </BlockStack>
        </Card>

        {(costOpenai > 0 || costSerp > 0) && (
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingSm">Cost Breakdown</Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">OpenAI</Text>
                <Text as="span" variant="bodyMd" fontWeight="medium">${costOpenai.toFixed(2)}</Text>
              </InlineStack>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--p-color-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'var(--p-color-bg-fill-brand)', transition: 'width 0.3s', width: `${costTotal > 0 ? (costOpenai / costTotal) * 100 : 0}%` }} />
              </div>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" tone="subdued">SerpAPI</Text>
                <Text as="span" variant="bodyMd" fontWeight="medium">${costSerp.toFixed(2)}</Text>
              </InlineStack>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--p-color-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: '#3B82F6', transition: 'width 0.3s', width: `${costTotal > 0 ? (costSerp / costTotal) * 100 : 0}%` }} />
              </div>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
