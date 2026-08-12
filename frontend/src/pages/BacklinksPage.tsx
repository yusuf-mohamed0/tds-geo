import { useEffect, useState } from 'react';
import {
  Page, Card, Text, Button, Spinner, Banner, BlockStack, InlineStack, Tabs, Badge,
} from '@shopify/polaris';
import { Mail, Link as LinkIcon, FileText, RefreshCw, Target } from 'lucide-react';
import { apiFetch } from '../api/client';

interface Prospect {
  id: string;
  domain: string;
  domainRating: number;
  relevanceScore: number;
  estimatedTraffic: number;
  niche?: string;
  contactPage?: string;
  status: string;
}

interface OutreachItem {
  id: string;
  prospect_id: string;
  domain: string;
  email_subject: string;
  email_body: string;
  status: string;
  sent_at: string;
  replied_at: string;
  pitch_type: string;
  domain_rating: number;
}

interface BacklinkItem {
  id: string;
  source_url: string;
  target_url: string;
  anchor_text: string;
  link_type: string;
  status: string;
  domain_rating: number;
  prospect_domain: string;
  created_at: string;
  verified_at: string;
}

interface Client {
  id: string;
  name: string;
  is_active: boolean;
}

export default function BacklinksPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [targetDomain, setTargetDomain] = useState('');
  const [error, setError] = useState('');
  const [errorTone, setErrorTone] = useState<'critical' | 'warning'>('critical');
  const [generating, setGenerating] = useState(false);
  const [guestPostResult, setGuestPostResult] = useState('');
  const [prospectId, setProspectId] = useState('');
  const [guestTopic, setGuestTopic] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');

  const tabs = [
    { id: 'prospects', content: 'Prospects' },
    { id: 'outreach', content: 'Outreach' },
    { id: 'backlinks', content: 'Backlinks' },
    { id: 'guest-post', content: 'Guest Post' },
  ];

  const withClient = (path: string) => `${path}?clientId=${encodeURIComponent(clientId)}`;

  const normalizeDomain = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, '');
    } catch {
      return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    }
  };

  useEffect(() => {
    apiFetch<{ clients: Client[] }>('/api/clients')
      .then((res) => {
        const activeClients = (res.clients || []).filter((client) => client.is_active !== false);
        setClients(activeClients);
        setClientId(activeClients[0]?.id || '');
      })
      .catch(() => {
        setErrorTone('critical');
        setError('Unable to load clients.');
      });
  }, []);

  const fetchData = async (tab: number) => {
    if (!clientId) return;
    setLoading(true);
    setErrorTone('critical');
    setError('');
    try {
      if (tab === 0 || tab === 3) {
        const data = await apiFetch<{ prospects: Prospect[] }>(withClient('/api/backlinks/prospects'));
        setProspects(data.prospects || []);
      } else if (tab === 1) {
        const data = await apiFetch<{ outreach: OutreachItem[] }>(withClient('/api/backlinks/outreach'));
        setOutreach(data.outreach || []);
      } else if (tab === 2) {
        const data = await apiFetch<{ backlinks: BacklinkItem[] }>(withClient('/api/backlinks'));
        setBacklinks(data.backlinks || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(selectedTab); }, [selectedTab, clientId]);

  const handleDiscover = async () => {
    const normalizedDomain = normalizeDomain(targetDomain);
    if (!normalizedDomain || !clientId) return;
    setDiscovering(true);
    setErrorTone('critical');
    setError('');
    try {
      const data = await apiFetch<{ prospects: Prospect[]; count: number }>(withClient('/api/backlinks/discover'), {
        method: 'POST',
        body: JSON.stringify({ targetDomain: normalizedDomain, limit: 20 }),
      });
      setProspects(data.prospects || []);
      setSelectedTab(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Discovery failed';
      setErrorTone(message.includes('DataForSEO') ? 'warning' : 'critical');
      setError(message);
    } finally {
      setDiscovering(false);
    }
  };

  const handleCreateOutreach = async (prospectId: string) => {
    try {
      setErrorTone('critical');
      setError('');
      await apiFetch(withClient('/api/backlinks/outreach'), {
        method: 'POST',
        body: JSON.stringify({ prospectId, pitchType: 'guest_post' }),
      });
      fetchData(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create outreach');
    }
  };

  const handleGenerateGuestPost = async () => {
    if (!prospectId || !guestTopic.trim()) return;
    setGenerating(true);
    setErrorTone('critical');
    setError('');
    try {
      const result = await apiFetch<{ title: string; content: string; wordCount: number }>(withClient('/api/backlinks/generate-guest-post'), {
        method: 'POST',
        body: JSON.stringify({ prospectId, topic: guestTopic.trim() }),
      });
      setGuestPostResult(`# ${result.title}\n\n${result.content}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setErrorTone('critical');
    setError('');
    try {
      if (!clientId) return;
      const result = await apiFetch<{ checked: number; active: number; lost: number }>(withClient('/api/backlinks/verify'), {
        method: 'POST',
      });
      setVerifyResult(`Checked ${result.checked}: ${result.active} active, ${result.lost} lost`);
      fetchData(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Page
      title="Backlink Automation"
      subtitle="Discover, outreach, and track backlinks to improve domain authority"
      primaryAction={{
        content: verifying ? 'Verifying...' : 'Verify Backlinks',
        onAction: handleVerify,
        disabled: verifying,
      }}
    >
      <BlockStack gap="400">
        {error && <Banner tone={errorTone}>{error}</Banner>}
        {verifyResult && <Banner tone="success">{verifyResult}</Banner>}

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingSm">Client</Text>
            <select aria-label="Client" className="input" value={clientId} onChange={(e) => { setError(''); setClientId(e.target.value); }} disabled={discovering || verifying}>
              <option value="">Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
          <div style={{ display: 'flex', gap: 'var(--p-space-200)', alignItems: 'center' }}>
            <Target size={18} style={{ opacity: 0.6 }} />
            <Text as="h2" variant="headingSm">Competitor Backlink Discovery</Text>
          </div>
            <InlineStack gap="200">
              <div style={{ flex: 1 }}>
                <Text as="p" variant="bodySm" tone="subdued">Enter a competitor domain to find its backlink sources</Text>
                <input
                  aria-label="Competitor domain"
                  className="input"
                  placeholder="e.g. competitor.com"
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                  disabled={discovering}
                  autoFocus
                />
              </div>
              <div style={{ paddingTop: 20 }}>
                <Button
                  variant="primary"
                  onClick={handleDiscover}
                  loading={discovering}
                  disabled={!targetDomain.trim() || !clientId}
                >Discover</Button>
              </div>
            </InlineStack>
          </BlockStack>
        </Card>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
            <Spinner accessibilityLabel="Loading" size="large" />
          </div>
        ) : selectedTab === 0 ? (
          <Card padding="0">
            {prospects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--p-space-1600)' }}>
                <Text as="p" variant="bodyMd" tone="subdued">No prospects yet. Use Discovery to find them.</Text>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="polaris-table">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Relevance</th>
                      <th>DR</th>
                      <th>Traffic</th>
                      <th>Niche</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospects.map((p) => (
                      <tr key={p.id}>
                        <td><Text as="span" variant="bodyMd" fontWeight="medium">{p.domain}</Text></td>
                        <td>
                          <Badge tone={p.relevanceScore >= 70 ? 'success' : p.relevanceScore >= 40 ? 'warning' : 'attention'}>
                            {`${p.relevanceScore}%`}
                          </Badge>
                        </td>
                        <td><Text as="span" variant="bodySm">
                          {p.domainRating > 0 ? p.domainRating : '-'}
                        </Text></td>
                        <td><Text as="span" variant="bodySm">
                          {p.estimatedTraffic > 0 ? `${p.estimatedTraffic.toLocaleString()}/mo` : '-'}
                        </Text></td>
                        <td><Text as="span" variant="bodySm">{p.niche || '-'}</Text></td>
                        <td><Badge>{p.status}</Badge></td>
                        <td>
                          <InlineStack gap="100">
                            <Button
                              size="slim"
                              variant="primary"
                              onClick={() => handleCreateOutreach(p.id)}
                            >Pitch</Button>
                          </InlineStack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : selectedTab === 1 ? (
          <Card padding="0">
            {outreach.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--p-space-1600)' }}>
                <Text as="p" variant="bodyMd" tone="subdued">No outreach emails yet. Pitch a prospect to create one.</Text>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="polaris-table">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Subject</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Replied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreach.map((o) => (
                      <tr key={o.id}>
                        <td><Text as="span" variant="bodySm">{o.domain}</Text></td>
                        <td><Text as="span" variant="bodySm">{o.email_subject}</Text></td>
                        <td><Badge>{o.pitch_type}</Badge></td>
                        <td><Badge tone={o.status === 'sent' ? 'success' : o.status === 'replied' ? 'info' : 'attention'}>{o.status}</Badge></td>
                        <td><Text as="span" variant="bodySm">{o.sent_at ? new Date(o.sent_at).toLocaleDateString() : '-'}</Text></td>
                        <td><Text as="span" variant="bodySm">{o.replied_at ? new Date(o.replied_at).toLocaleDateString() : '-'}</Text></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : selectedTab === 2 ? (
          <Card padding="0">
            <BlockStack gap="200">
              {backlinks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--p-space-1600)' }}>
                  <Text as="p" variant="bodyMd" tone="subdued">No backlinks tracked yet. Track them from successful outreach.</Text>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="polaris-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Anchor</th>
                        <th>Type</th>
                        <th>DR</th>
                        <th>Status</th>
                        <th>Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backlinks.map((b) => (
                        <tr key={b.id}>
                          <td><Text as="span" variant="bodySm">{b.source_url}</Text></td>
                          <td><Text as="span" variant="bodySm">{b.target_url}</Text></td>
                          <td><Text as="span" variant="bodySm">{b.anchor_text}</Text></td>
                          <td><Badge>{b.link_type}</Badge></td>
                          <td><Text as="span" variant="bodySm">{b.domain_rating || '-'}</Text></td>
                          <td>
                            <Badge tone={b.status === 'active' ? 'success' : 'critical'}>
                              {b.status}
                            </Badge>
                          </td>
                          <td><Text as="span" variant="bodySm">
                            {b.verified_at ? new Date(b.verified_at).toLocaleDateString() : '-'}
                          </Text></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </BlockStack>
          </Card>
        ) : (
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" align="start">
                  <FileText size={18} style={{ opacity: 0.6 }} />
                  <Text as="h2" variant="headingSm">Generate Guest Post</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <div style={{ flex: 1 }}>
                    <Text as="p" variant="bodySm" tone="subdued">Select Prospect</Text>
                    <select
                      aria-label="Prospect"
                      className="input"
                      value={prospectId}
                      onChange={(e) => setProspectId(e.target.value)}
                      disabled={generating}
                    >
                      <option value="">-- Select --</option>
                      {prospects.map((p) => (
                        <option key={p.id} value={p.id}>{p.domain} ({p.relevanceScore}% relevance)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <Text as="p" variant="bodySm" tone="subdued">Topic</Text>
                    <input
                      aria-label="Guest post topic"
                      className="input"
                      placeholder="e.g. Modern HVAC maintenance best practices"
                      value={guestTopic}
                      onChange={(e) => setGuestTopic(e.target.value)}
                      disabled={generating}
                    />
                  </div>
                  <div style={{ paddingTop: 20 }}>
                    <Button
                      variant="primary"
                      onClick={handleGenerateGuestPost}
                      loading={generating}
                      disabled={!prospectId || !guestTopic.trim()}
                    >
                      Generate
                    </Button>
                  </div>
                </InlineStack>
              </BlockStack>
            </Card>
            {guestPostResult && (
              <Card>
                <BlockStack gap="200">
                  <InlineStack gap="200" align="start">
                    <FileText size={16} style={{ opacity: 0.6 }} />
                    <Text as="h2" variant="headingSm">Generated Guest Post</Text>
                  </InlineStack>
                  <div
                    className="prose prose-sm max-w-none"
                    style={{ fontSize: 'var(--p-font-size-325)', lineHeight: 1.7, maxHeight: 500, overflowY: 'auto' }}
                  >
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                      {guestPostResult}
                    </pre>
                  </div>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Page>
  );
}
