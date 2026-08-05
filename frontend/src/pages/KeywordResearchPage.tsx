import { useEffect, useState } from 'react';
import {
  Page, Card, Text, Button, Spinner, Banner, BlockStack, InlineStack, Badge,
} from '@shopify/polaris';
import { Lightbulb, TrendingUp, Target, Layers, Zap, Brain } from 'lucide-react';
import { apiFetch } from '../api/client';

interface KeywordCluster {
  topic: string;
  intent: string;
  totalVolume: number;
  avgDifficulty: number;
  opportunityScore: number;
  suggestedContentType: string;
  keywords: {
    keyword: string;
    searchVolume: number;
    difficulty: number;
    intent: string;
    opportunityScore: number;
    trend: 'rising' | 'stable' | 'declining' | 'unavailable';
    isQuestion: boolean;
    relatedQuestions: string[];
  }[];
}

interface ResearchResult {
  clusters: KeywordCluster[];
  keywords: unknown[];
  summary: {
    totalKeywords: number;
    clustersFound: number;
    avgOpportunity: number;
    topOpportunities: unknown[];
    recommendedContentPlan: { topic: string; contentType: string; priority: number }[];
  };
}

interface Client {
  id: string;
  name: string;
  is_active: boolean;
}

export default function KeywordResearchPage() {
  const [industry, setIndustry] = useState('');
  const [seeds, setSeeds] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    apiFetch<{ clients: Client[] }>('/api/clients')
      .then((res) => {
        const activeClients = (res.clients || []).filter((client) => client.is_active !== false);
        setClients(activeClients);
        setClientId(activeClients[0]?.id || '');
      })
      .catch(() => setError('Unable to load clients.'));
  }, []);

  const handleResearch = async () => {
    if (!industry.trim() || !clientId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const seedKeywords = seeds
        ? seeds.split(',').map(s => s.trim()).filter(Boolean)
        : [industry.trim() + ' services', industry.trim() + ' maintenance'];

      const data = await apiFetch<ResearchResult>(`/api/clients/${clientId}/keywords/discover`, {
        method: 'POST',
        body: JSON.stringify({ industry: industry.trim(), seedKeywords, count: 30 }),
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page
      title="Keyword Research"
      subtitle="Client-scoped keyword research using real SERP metrics only"
      primaryAction={{
        content: loading ? 'Researching...' : 'Start Research',
        onAction: handleResearch,
        disabled: loading || !industry.trim() || !clientId,
      }}
    >
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">Research Parameters</Text>
            <InlineStack gap="300" align="start">
              <div style={{ flex: 1 }}>
                <Text as="p" variant="bodySm" tone="subdued">Client</Text>
                <select aria-label="Client" className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={loading}>
                  <option value="">Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <Text as="p" variant="bodySm" tone="subdued">Industry / Niche</Text>
                <input
                  aria-label="Industry or niche"
                  className="input"
                  placeholder="e.g. HVAC, Solar, Plumbing, Roofing"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div style={{ flex: 2 }}>
                <Text as="p" variant="bodySm" tone="subdued">Seed Keywords (comma-separated, optional)</Text>
                <input
                  aria-label="Seed keywords"
                  className="input"
                  placeholder="e.g. furnace repair, ac maintenance, heat pump installation"
                  value={seeds}
                  onChange={(e) => setSeeds(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                  disabled={loading}
                />
              </div>
            </InlineStack>
          </BlockStack>
        </Card>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
            <Spinner accessibilityLabel="Researching keywords" size="large" />
          </div>
        )}

        {error && <Banner tone="critical">{error}</Banner>}

        {result && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--p-space-400)' }}>
              <Card>
                <BlockStack gap="100" align="center">
                  <Brain size={24} style={{ opacity: 0.6 }} />
                  <Text as="p" variant="heading2xl" fontWeight="bold">{result.summary.totalKeywords}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Keywords Found</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100" align="center">
                  <Layers size={24} style={{ opacity: 0.6 }} />
                  <Text as="p" variant="heading2xl" fontWeight="bold">{result.summary.clustersFound}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Topic Clusters</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100" align="center">
                  <Target size={24} style={{ opacity: 0.6 }} />
                  <Text as="p" variant="heading2xl" fontWeight="bold">{result.summary.avgOpportunity}%</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Avg Opportunity</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100" align="center">
                  <Zap size={24} style={{ opacity: 0.6 }} />
                  <Text as="p" variant="heading2xl" fontWeight="bold">{result.summary.recommendedContentPlan.length}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Content Ideas</Text>
                </BlockStack>
              </Card>
            </div>

            {/* Content Plan */}
            {result.summary.recommendedContentPlan.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="start" gap="200">
                    <Lightbulb size={18} style={{ opacity: 0.6 }} />
                    <Text as="h2" variant="headingSm">Recommended Content Plan</Text>
                  </InlineStack>
                  <div style={{ display: 'grid', gap: 'var(--p-space-200)' }}>
                    {result.summary.recommendedContentPlan.map((plan, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--p-space-300)',
                        padding: 'var(--p-space-200) var(--p-space-300)',
                        background: 'var(--p-color-bg-surface)',
                        borderRadius: 'var(--p-space-200)',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--p-color-bg-fill-brand)',
                          color: 'var(--p-color-text-brand-on-bg-fill)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--p-font-size-200)', fontWeight: 'bold',
                        }}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <Text as="p" variant="bodyMd" fontWeight="medium">{plan.topic}</Text>
                          <InlineStack gap="200">
                            <Badge>{plan.contentType}</Badge>
                            <Text as="span" variant="bodySm" tone="subdued">Priority: {plan.priority}/100</Text>
                          </InlineStack>
                        </div>
                      </div>
                    ))}
                  </div>
                </BlockStack>
              </Card>
            )}

            {/* Clusters */}
            {result.clusters.length > 0 ? result.clusters.map((cluster, i) => (
              <Card key={i}>
                <BlockStack gap="300">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text as="h2" variant="headingSm">{cluster.topic}</Text>
                      <InlineStack gap="200">
                        <Badge tone={cluster.intent === 'transactional' ? 'success' : cluster.intent === 'commercial' ? 'warning' : 'info'}>
                          {cluster.intent}
                        </Badge>
                        <Badge>{cluster.suggestedContentType}</Badge>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {cluster.totalVolume.toLocaleString()}/mo · {cluster.keywords.length} keywords
                        </Text>
                      </InlineStack>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text as="p" variant="headingLg" fontWeight="bold" tone="success">{Math.round(cluster.opportunityScore)}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Opportunity</Text>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 'var(--p-space-100)' }}>
                    {cluster.keywords.slice(0, 8).map((kw, j) => (
                      <div key={j} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--p-space-200)',
                        padding: 'var(--p-space-100) var(--p-space-200)',
                        borderRadius: 'var(--p-space-100)',
                        background: 'var(--p-color-bg-surface-hover)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <InlineStack gap="100" align="start">
                            <Text as="span" variant="bodyMd">{kw.keyword}</Text>
                            {kw.isQuestion && <Badge tone="info">Q</Badge>}
                            {kw.trend === 'rising' && <Badge tone="success">↑</Badge>}
                          </InlineStack>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--p-space-200)', alignItems: 'center' }}>
                          <Text as="span" variant="bodySm" tone="subdued">{kw.searchVolume}/mo</Text>
                          <div style={{
                            width: 60, height: 6, borderRadius: 3,
                            background: 'var(--p-color-bg-surface-tertiary)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.min(100, kw.difficulty)}%`,
                              height: '100%',
                              background: kw.difficulty < 40 ? 'var(--p-color-icon-success)' :
                                kw.difficulty < 70 ? 'var(--p-color-icon-warning)' : 'var(--p-color-icon-critical)',
                              borderRadius: 3,
                            }} />
                          </div>
                          <Text as="span" variant="bodySm" fontWeight="medium">{kw.opportunityScore}</Text>
                        </div>
                      </div>
                    ))}
                  </div>

                  {cluster.keywords.some(k => k.relatedQuestions.length > 0) && (
                    <div>
                      <Text as="p" variant="bodySm" tone="subdued">People also ask:</Text>
                      <InlineStack gap="100" wrap>
                        {[...new Set(cluster.keywords.flatMap(k => k.relatedQuestions))].slice(0, 4).map((q, j) => (
                          <Badge key={j}>{q}</Badge>
                        ))}
                      </InlineStack>
                    </div>
                  )}
                </BlockStack>
              </Card>
            )) : (
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
                  <Text as="p" variant="headingMd">No keyword clusters found</Text>
                  <div style={{ marginTop: 'var(--p-space-100)' }}>
                    <Text as="p" variant="bodySm" tone="subdued">Try a more specific industry, add seed keywords, or select a different client.</Text>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </BlockStack>
    </Page>
  );
}
