import { useState } from 'react';
import { Page, Card, Text, Button, Spinner, Banner, BlockStack, InlineStack, Badge } from '@shopify/polaris';
import { Globe, Search, CheckCircle, XCircle, Lightbulb, Clock, Monitor } from 'lucide-react';
import { apiFetch } from '../api/client';

interface Engine {
  name: string;
  cited: boolean;
  url: string;
  snippet: string;
}

interface CitationData {
  clientId: string;
  domain: string;
  timestamp: string;
  engines: Engine[];
  citationCount: number;
  recommendations: string[];
}

interface CitationResponse {
  success: boolean;
  data: CitationData;
}

const engineColors: Record<string, string> = {
  ChatGPT: '#14b8a6',
  Perplexity: '#3b82f6',
  'Google AI Overviews': '#eab308',
  Gemini: '#ec4899',
  Claude: '#f97316',
  Copilot: '#22c55e',
  Grok: '#a855f7',
  DeepSeek: '#06b6d4',
};

export default function CitationsPage() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<CitationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const check = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch<CitationResponse>(`/api/ai-seo/citations/${encodeURIComponent(domain)}`);
      setResult(res);
    } catch {
      setError('Citation check failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const data = result?.data;

  return (
    <Page title="AI Citation Tracking" subtitle="Check if your domain is cited across 7 AI engines">
      <div style={{ maxWidth: 900 }}><BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text as="span" variant="bodyMd" fontWeight="medium">Domain</Text>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full min-w-0 sm:max-w-[400px] sm:flex-1">
                <Globe size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--p-color-text-secondary)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                  onKeyDown={(e) => e.key === 'Enter' && check()}
                />
              </div>
              <Button variant="primary" onClick={check} disabled={loading || !domain.trim()} loading={loading}>
                Check
              </Button>
            </div>
            <Text as="p" variant="bodyXs" tone="subdued">Powered by 7 AI engines: ChatGPT, Perplexity, Gemini, Claude, Copilot, Grok, DeepSeek</Text>
          </BlockStack>
        </Card>

        {loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800)' }}>
              <Spinner accessibilityLabel="Checking citations" size="large" />
              <div style={{ marginTop: 'var(--p-space-300)' }}><Text as="p" variant="bodySm" tone="subdued">Scanning AI engines...</Text></div>
            </div>
          </Card>
        )}

        {error && (
          <Banner tone="critical">{error}</Banner>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--p-space-200)' }}>
                  <Text as="p" variant="heading2xl" fontWeight="bold" tone="critical">{
                    data.citationCount === 0 ? (
                      <span style={{ color: 'var(--p-color-text-critical)' }}>{data.citationCount}</span>
                    ) : (
                      <span style={{ color: 'var(--p-color-bg-fill-brand)' }}>{data.citationCount}</span>
                    )
                  }</Text>
                  <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">Engines citing you</Text></div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--p-space-200)' }}>
                  <Text as="p" variant="heading2xl" fontWeight="bold">{data.engines.length}</Text>
                  <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">Engines checked</Text></div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: 'center', padding: 'var(--p-space-200)' }}>
                  <Text as="p" variant="heading2xl" fontWeight="bold" tone="success">{data.recommendations.length}</Text>
                  <div style={{ marginTop: 'var(--p-space-100)' }}><Text as="p" variant="bodySm" tone="subdued">Recommendations</Text></div>
                </div>
              </Card>
            </div>

            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Monitor size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                  <Text as="h3" variant="headingSm">Engine Results</Text>
                </InlineStack>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.engines.map((engine) => (
                    <div
                      key={engine.name}
                      style={{
                        display: 'flex', gap: 'var(--p-space-300)', padding: 'var(--p-space-300)',
                        borderRadius: 'var(--p-space-200)', border: '1px solid',
                        borderColor: engine.cited ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        background: engine.cited ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                      }}
                    >
                      {engine.cited ? (
                        <CheckCircle size={18} style={{ color: 'var(--p-color-icon-success)', flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <XCircle size={18} style={{ color: 'var(--p-color-icon-critical)', flexShrink: 0, marginTop: 2 }} />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <Text as="p" variant="bodyMd" fontWeight="medium">{engine.name}</Text>
                        <Text as="p" variant="bodySm" tone="subdued" truncate>{engine.snippet || (engine.cited ? 'Cited' : 'Not cited')}</Text>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--p-space-400)', paddingTop: 'var(--p-space-300)', borderTop: '1px solid var(--p-color-border)', fontSize: 'var(--p-font-size-200)' }}>
                  <InlineStack gap="100" blockAlign="center">
                    <Clock size={12} />
                    <Text as="span" variant="bodyXs" tone="subdued">{new Date(data.timestamp).toLocaleString()}</Text>
                  </InlineStack>
                  <InlineStack gap="100" blockAlign="center">
                    <Globe size={12} />
                    <Text as="span" variant="bodyXs" tone="subdued">{data.domain}</Text>
                  </InlineStack>
                </div>
              </BlockStack>
            </Card>

            {data.recommendations.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Lightbulb size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                    <Text as="h3" variant="headingSm">Recommendations</Text>
                  </InlineStack>
                  <ul style={{ margin: 0, paddingLeft: 'var(--p-space-400)' }}>
                    {data.recommendations.map((rec, i) => (
                      <li key={i} style={{ marginBottom: 'var(--p-space-200)' }}>
                        <Text as="span" variant="bodyMd">{rec}</Text>
                      </li>
                    ))}
                  </ul>
                </BlockStack>
              </Card>
            )}
          </>
        )}
      </BlockStack></div>
    </Page>
  );
}
