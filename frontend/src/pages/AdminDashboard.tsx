import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Card, Text, Badge, BlockStack, InlineStack, Banner, Button, SkeletonPage, SkeletonBodyText } from '@shopify/polaris';
import { Users, FileText, Target, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MetricCard from '../components/MetricCard';
import { fetchDashboard, fetchHealth } from '../api/admin';
import type { AdminDashboard, HealthStatus } from '../types';

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([fetchDashboard(), fetchHealth()])
      .then(([d, h]) => { setDashboard(d); setHealth(h); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Page title="Dashboard">
        <SkeletonPage title="Dashboard">
          <SkeletonBodyText lines={4} />
          <div style={{ paddingTop: 'var(--p-space-400)' }} />
          <SkeletonBodyText lines={8} />
        </SkeletonPage>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Dashboard">
        <Banner tone="critical" title="Could not load the dashboard">
          <p>{error}</p>
          <div style={{ paddingTop: 'var(--p-space-200)' }}>
            <Button onClick={load}>Try again</Button>
          </div>
        </Banner>
      </Page>
    );
  }

  if (!dashboard) {
    return (
      <Page title="Dashboard">
        <Banner tone="critical" title="Dashboard unavailable">
          <p>No dashboard data was returned. Please try again.</p>
          <div style={{ paddingTop: 'var(--p-space-200)' }}>
            <Button onClick={load}>Try again</Button>
          </div>
        </Banner>
      </Page>
    );
  }

  const activity = dashboard?.activity as unknown as Array<Record<string, unknown>> || [];
  const recentArticles = dashboard?.recentArticles as unknown as Array<Record<string, unknown>> || [];
  const clients = (dashboard?.clients || {}) as Record<string, number>;
  const articles = (dashboard?.articles || {}) as Record<string, number>;
  const keywords = (dashboard?.keywords || {}) as Record<string, number | string>;
  const publishing = (dashboard?.publishing || {}) as Record<string, number>;
  const costs = (dashboard?.costs || {}) as Record<string, number | string>;
  const checks = (health?.checks || {}) as Record<string, Record<string, string>>;

  return (
    <Page title="Dashboard" subtitle="Overview of your platform performance and activity">
      <BlockStack gap="400">
        {Object.keys(checks).length > 0 && (
          <Card padding="300">
            <BlockStack gap="200">
              <InlineStack gap="100" blockAlign="center">
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--p-color-icon-success)' }} />
                <Text as="span" variant="bodySm" tone="subdued">System Status</Text>
              </InlineStack>
              <div style={{ display: 'flex', gap: 'var(--p-space-300)', flexWrap: 'wrap' }}>
                {Object.entries(checks).map(([key, val]) => {
                  const status = val?.status || 'unknown';
                  const isHealthy = status === 'healthy' || status === 'configured';
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--p-space-200)', padding: 'var(--p-space-100) var(--p-space-300)', borderRadius: 'var(--p-space-200)', background: 'var(--p-color-bg-surface-secondary)' }}>
                      <Badge tone={isHealthy ? 'success' : 'critical'} size="small" />
                      <Text as="span" variant="bodySm">{key}</Text>
                      <Text as="span" variant="bodyXs" tone="subdued">{status}</Text>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard icon={<Users size={20} />} label="Total Clients" value={clients.total ?? 0} subtitle={`${clients.active ?? 0} active · ${clients.new_30d ?? 0} new`} color="#818CF8" />
          <MetricCard icon={<FileText size={20} />} label="Articles" value={articles.total ?? 0} subtitle={`${articles.published ?? 0} published · ${articles.pending_review ?? 0} pending`} color="#34D399" />
          <MetricCard icon={<Target size={20} />} label="Avg Keyword Relevance" value={`${keywords.avg_relevance ?? '0'}%`} subtitle={`${keywords.total ?? 0} keywords tracked`} color="#F472B6" />
          <MetricCard icon={<DollarSign size={20} />} label="MTD Costs" value={`$${parseFloat(String(costs.total_cost_mtd || '0')).toFixed(2)}`} subtitle={`${publishing.this_week ?? 0} published this week`} color="#FBBF24" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">30-Day Activity</Text>
                  <InlineStack gap="100" blockAlign="center">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--p-color-bg-fill-brand)' }} />
                    <Text as="span" variant="bodySm" tone="subdued">Events</Text>
                  </InlineStack>
                </InlineStack>
                {activity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={activity as Array<{ date: string; count: number }>}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D2A2A" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1F1B1B', border: '1px solid #2D2A2A', borderRadius: 8, color: '#FCF6F2', fontSize: 12 }} />
                      <Bar dataKey="count" fill="#FCB900" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: 'var(--p-space-800)', textAlign: 'center' }}>
                    <Text as="p" variant="bodySm" tone="subdued">No activity data yet.</Text>
                  </div>
                )}
              </BlockStack>
            </Card>
          </div>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Recent Articles</Text>
                <Text as="span" variant="bodySm" tone="subdued">{recentArticles.length}</Text>
              </InlineStack>
              {recentArticles.slice(0, 8).map((article) => {
                const a = article as Record<string, unknown>;
                return (
                  <button
                    type="button"
                    key={String(a.id)}
                    onClick={() => navigate(`/admin/articles/${a.id}`)}
                    style={{ width: '100%', textAlign: 'left', padding: 'var(--p-space-300)', borderRadius: 'var(--p-space-200)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    className="hover:bg-brand-border/60 group"
                  >
                    <InlineStack align="space-between" blockAlign="start" gap="200">
                      <Text as="span" variant="bodyMd" fontWeight="medium" truncate>{String(a.title)}</Text>
                    </InlineStack>
                    <div style={{ marginTop: 'var(--p-space-100)' }}>
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone={String(a.status) === 'published' ? 'success' : String(a.status) === 'approved' ? 'info' : String(a.status) === 'generated' ? 'warning' : 'attention'}>
                          {String(a.status || 'draft')}
                        </Badge>
                        {!!a.seo_score && (
                          <Text as="span" variant="bodyXs" tone="subdued">SEO: {String(a.seo_score)}</Text>
                        )}
                      </InlineStack>
                    </div>
                  </button>
                );
              })}
              {recentArticles.length > 0 && (
                <button type="button" onClick={() => navigate('/admin/articles')} style={{ width: '100%', textAlign: 'left', padding: 'var(--p-space-200)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--p-color-text-link)', fontSize: 'var(--p-font-size-300)' }}>
                  View all articles →
                </button>
              )}
            </BlockStack>
          </Card>
        </div>
      </BlockStack>
    </Page>
  );
}
