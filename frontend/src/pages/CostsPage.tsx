import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Text, Spinner, Banner, BlockStack } from '@shopify/polaris';
import { DollarSign, TrendingUp } from 'lucide-react';
import { apiFetch } from '../api/client';

interface CostReport {
  total: number;
  daily: { date: string; cost: number }[];
  byProvider: { provider: string; cost: number }[];
}

interface ClientCostReport {
  totals: { total_cost: number | string };
  dailyBreakdown: { date: string; cost: number | string }[];
  byProvider: { provider: string; total_cost: number | string }[];
}

export default function CostsPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const [report, setReport] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    type ApiResponse = { success: boolean; data: CostReport };
    const request = clientId
      ? apiFetch<ClientCostReport>(`/api/analytics/${clientId}/costs`).then((res) => ({
          total: Number(res.totals.total_cost || 0),
          daily: res.dailyBreakdown.map((entry) => ({ ...entry, cost: Number(entry.cost || 0) })),
          byProvider: res.byProvider.map((entry) => ({ provider: entry.provider, cost: Number(entry.total_cost || 0) })),
        }))
      : apiFetch<ApiResponse>('/api/cost/report/global').then((res) => res.data || null);

    request
      .then(setReport)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Page title="Cost Tracking" subtitle={clientId ? 'Selected client AI service spending' : 'Monitor your AI service spending'}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
          <Spinner accessibilityLabel="Loading cost data" size="large" />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Cost Tracking" subtitle={clientId ? 'Selected client AI service spending' : 'Monitor your AI service spending'}>
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page title="Cost Tracking" subtitle={clientId ? 'Selected client AI service spending' : 'Monitor your AI service spending'}>
      <BlockStack gap="400">
        {report ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card>
              <DollarSign size={20} style={{ color: 'var(--p-color-icon-success)' }} />
                <div style={{ marginTop: 'var(--p-space-300)' }}><Text as="p" variant="heading2xl" fontWeight="bold">${Number(report.total).toFixed(2)}</Text></div>
              <div style={{ marginTop: 'var(--p-space-050)' }}><Text as="p" variant="bodySm" tone="subdued">Total (30 days)</Text></div>
            </Card>
            {report.byProvider?.map((p) => (
              <Card key={p.provider}>
                <TrendingUp size={20} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                <div style={{ marginTop: 'var(--p-space-300)' }}><Text as="p" variant="heading2xl" fontWeight="bold">${Number(p.cost).toFixed(2)}</Text></div>
                <div style={{ marginTop: 'var(--p-space-050)' }} className="capitalize"><Text as="p" variant="bodySm" tone="subdued">{p.provider}</Text></div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
              <DollarSign size={40} style={{ margin: '0 auto', opacity: 0.4 }} />
              <div style={{ marginTop: 'var(--p-space-400)' }}><Text as="p" variant="bodyMd" tone="subdued">No cost data available yet.</Text></div>
            </div>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
