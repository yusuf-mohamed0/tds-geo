import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Card, Text, Button, Spinner, Banner, BlockStack, InlineStack, Badge } from '@shopify/polaris';
import { Search, MousePointerClick, TrendingUp, BarChart3, Globe, Clock, Hash, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { fetchGscOverview, fetchGscStatus } from '../api/googleSearchConsole';
import type { GscOverview } from '../types';

function formatCtr(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function GscPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');

  const [overview, setOverview] = useState<GscOverview | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      setError('No client selected. Provide a clientId query parameter.');
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [status, overviewData] = await Promise.all([
          fetchGscStatus(clientId),
          fetchGscOverview(clientId),
        ]);
        if (!active) return;
        setConnected(status.connected);
        setOverview(overviewData);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load Google Search Console data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [clientId]);

  // --- Loading State ---
  if (loading) {
    return (
      <Page title="Google Search Console" subtitle="Search analytics & performance">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
          <Spinner accessibilityLabel="Loading Google Search Console data" size="large" />
        </div>
      </Page>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <Page title="Google Search Console" subtitle="Search analytics & performance">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  // --- Not Connected State ---
  if (connected === false) {
    const authUrl = clientId ? `/api/gsc/auth?clientId=${encodeURIComponent(clientId)}` : '#';

    return (
      <Page title="Google Search Console" subtitle="Search analytics & performance">
        <BlockStack gap="400">
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
              <Search size={48} style={{ margin: '0 auto', opacity: 0.4 }} />
              <div style={{ marginTop: 'var(--p-space-400)' }}>
                <Text as="h2" variant="headingLg">Connect Google Search Console</Text>
              </div>
              <div style={{ marginTop: 'var(--p-space-100)' }}>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Link your Google Search Console account to view search performance data, top queries, and site analytics.
                </Text>
              </div>
              <div style={{ marginTop: 'var(--p-space-400)' }}>
                <Button
                  variant="primary"
                  url={authUrl}
                  external
                  icon={ExternalLink}
                >
                  Connect Google Search Console
                </Button>
              </div>
            </div>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  // --- Connected State ---
  const stats = overview?.stats;
  const sites = overview?.sites || [];
  const dailyData = overview?.dailyData || [];
  const topQueries = overview?.topQueries || [];

  return (
    <Page
      title="Google Search Console"
      subtitle="Search analytics & performance"
    >
      <BlockStack gap="400">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card>
            <InlineStack gap="200" blockAlign="center">
              <div style={{ padding: 'var(--p-space-200)', borderRadius: 'var(--p-space-200)', backgroundColor: 'rgba(129, 140, 248, 0.15)' }}>
                <Search size={20} style={{ color: '#818CF8' }} />
              </div>
            </InlineStack>
            <div style={{ marginTop: 'var(--p-space-300)' }}>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {stats ? stats.totalImpressions.toLocaleString() : '—'}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">Total Impressions (30 days)</Text>
            </div>
          </Card>

          <Card>
            <InlineStack gap="200" blockAlign="center">
              <div style={{ padding: 'var(--p-space-200)', borderRadius: 'var(--p-space-200)', backgroundColor: 'rgba(52, 211, 153, 0.15)' }}>
                <MousePointerClick size={20} style={{ color: '#34D399' }} />
              </div>
            </InlineStack>
            <div style={{ marginTop: 'var(--p-space-300)' }}>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {stats ? stats.totalClicks.toLocaleString() : '—'}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">Total Clicks (30 days)</Text>
            </div>
          </Card>

          <Card>
            <InlineStack gap="200" blockAlign="center">
              <div style={{ padding: 'var(--p-space-200)', borderRadius: 'var(--p-space-200)', backgroundColor: 'rgba(251, 191, 36, 0.15)' }}>
                <TrendingUp size={20} style={{ color: '#FBBF24' }} />
              </div>
            </InlineStack>
            <div style={{ marginTop: 'var(--p-space-300)' }}>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {stats ? formatCtr(stats.avgCtr) : '—'}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">Average CTR (30 days)</Text>
            </div>
          </Card>

          <Card>
            <InlineStack gap="200" blockAlign="center">
              <div style={{ padding: 'var(--p-space-200)', borderRadius: 'var(--p-space-200)', backgroundColor: 'rgba(244, 114, 182, 0.15)' }}>
                <BarChart3 size={20} style={{ color: '#F472B6' }} />
              </div>
            </InlineStack>
            <div style={{ marginTop: 'var(--p-space-300)' }}>
              <Text as="p" variant="heading2xl" fontWeight="bold">
                {stats ? stats.avgPosition.toFixed(1) : '—'}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">Average Position (30 days)</Text>
            </div>
          </Card>
        </div>

        {/* Connected Sites */}
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Globe size={18} style={{ opacity: 0.6 }} />
              <Text as="h2" variant="headingSm">Connected Sites</Text>
            </InlineStack>
            {sites.length === 0 ? (
              <Text as="p" variant="bodyMd" tone="subdued">No sites connected yet.</Text>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="polaris-table">
                  <thead>
                    <tr>
                      <th>Site URL</th>
                      <th>Permission</th>
                      <th>Last Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((site) => (
                      <tr key={site.id}>
                        <td>
                          <Text as="span" variant="bodyMd" fontWeight="medium">{site.site_url}</Text>
                        </td>
                        <td>
                          <Badge>{site.permission_level}</Badge>
                        </td>
                        <td>
                          <InlineStack gap="100" blockAlign="center">
                            <Clock size={14} style={{ opacity: 0.5 }} />
                            <Text as="span" variant="bodySm" tone="subdued">
                              {formatSyncTime(site.last_sync_at)}
                            </Text>
                          </InlineStack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BlockStack>
        </Card>

        {/* Performance Chart */}
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <TrendingUp size={18} style={{ opacity: 0.6 }} />
              <Text as="h2" variant="headingSm">Daily Performance (30 days)</Text>
            </InlineStack>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2A2A" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    tickLine={false}
                    tickFormatter={formatDate}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F1B1B',
                      border: '1px solid #2D2A2A',
                      borderRadius: 8,
                      color: '#FCF6F2',
                      fontSize: 12,
                    }}
                    labelFormatter={formatDate}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Bar
                    dataKey="impressions"
                    name="Impressions"
                    fill="#818CF8"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="clicks"
                    name="Clicks"
                    fill="#34D399"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
                <Text as="p" variant="bodyMd" tone="subdued">No daily performance data available yet.</Text>
              </div>
            )}
          </BlockStack>
        </Card>

        {/* Top Queries */}
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Hash size={18} style={{ opacity: 0.6 }} />
              <Text as="h2" variant="headingSm">Top Queries (by impressions)</Text>
            </InlineStack>
            {topQueries.length === 0 ? (
              <Text as="p" variant="bodyMd" tone="subdued">No query data available yet.</Text>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="polaris-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                      <th>Avg. Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topQueries.slice(0, 10).map((q, idx) => (
                      <tr key={q.query + idx}>
                        <td>
                          <Text as="span" variant="bodyMd" fontWeight="medium">{q.query}</Text>
                        </td>
                        <td>
                          <Text as="span" variant="bodyMd">{q.impressions.toLocaleString()}</Text>
                        </td>
                        <td>
                          <Text as="span" variant="bodyMd">{q.clicks.toLocaleString()}</Text>
                        </td>
                        <td>
                          <Badge tone={q.ctr >= 0.05 ? 'success' : q.ctr >= 0.02 ? 'warning' : 'attention'}>
                            {formatCtr(q.ctr)}
                          </Badge>
                        </td>
                        <td>
                          <Text as="span" variant="bodyMd">{q.avgPosition.toFixed(1)}</Text>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </BlockStack>
        </Card>

        {/* Connected email badge */}
        {overview?.email && (
          <Card background="bg-surface-secondary">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="success">Connected</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                Google Search Console account: {overview.email}
              </Text>
            </InlineStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
