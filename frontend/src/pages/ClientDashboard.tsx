import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Card, Text, Spinner, BlockStack, InlineStack, Badge, Divider, Select, Button } from '@shopify/polaris';
import { ArrowLeft, FileText, DollarSign, Target, Store, Palette, UsersRound, ShieldCheck, Clock3, BookOpen, Link2, Languages } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { apiFetch } from '../api/client';
import { SUPPORTED_LOCALES, getLocaleName } from '../api/locale';
import { getDemoStatus } from '../api/demo';
import type { ClientAnalyticsOverview } from '../types';
import type { DemoStatus } from '../api/demo';

function labelFor(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface ClientKeyword {
  id: string;
  keyword: string;
  intent: string;
  source: string;
  last_used_at: string | null;
}

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [data, setData] = useState<ClientAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localeValue, setLocaleValue] = useState('en');
  const [savingLocale, setSavingLocale] = useState(false);
  const [localeSaveMessage, setLocaleSaveMessage] = useState('');
  const [keywordListOpen, setKeywordListOpen] = useState(false);
  const [keywords, setKeywords] = useState<ClientKeyword[] | null>(null);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState('');
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    const load = async () => {
      try {
        const result = await apiFetch<ClientAnalyticsOverview>(`/api/analytics/${clientId}/overview`);
        if (active) {
          setData(result);
          setLocaleValue((result.client?.locale as string) || (result.client?.settings?.locale as string) || 'en');
          setError('');
        }
        try {
          const demo = await getDemoStatus(clientId);
          if (active) setDemoStatus(demo.is_demo ? demo : null);
        } catch {
          // demo status is optional; silently ignore
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load client intelligence.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const refresh = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
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
          <BlockStack gap="300" inlineAlign="center">
            <Store size={40} style={{ opacity: 0.4 }} />
            <Text as="p" variant="bodyMd" tone="subdued">{error || 'Client not found'}</Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  const { client, profile, team, connections, contentRules } = data;
  const articleStats = data.articles;
  const pipeline = {
    total: articleStats.total || 0,
    draft: articleStats.draft || 0,
    generated: articleStats.pending || 0,
    approved: articleStats.approved || 0,
    published: articleStats.published || 0,
  };
  const costTotal = Number(data.costs.total_cost || 0);
  const defaultBlog = connections.find((connection) => connection.default_blog_id)?.default_blog_id || (client.settings.shopifyBlogId as string | number | undefined);
  const presentation = profile.presentation;

  const saveLocale = async (newLocale: string) => {
    if (!clientId) return;
    setSavingLocale(true);
    setLocaleSaveMessage('');
    try {
      await apiFetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify({ locale: newLocale }),
      });
      setLocaleValue(newLocale);
      setLocaleSaveMessage('Language saved');
      setTimeout(() => setLocaleSaveMessage(''), 2500);
    } catch (err) {
      setLocaleSaveMessage(err instanceof Error ? err.message : 'Failed to save language');
      setTimeout(() => setLocaleSaveMessage(''), 4000);
    } finally {
      setSavingLocale(false);
    }
  };

  const openKeywordList = async () => {
    setKeywordListOpen(true);
    if (keywords !== null || keywordsLoading) return;

    setKeywordsLoading(true);
    setKeywordsError('');
    try {
      setKeywords(await apiFetch<ClientKeyword[]>(`/api/analytics/${client.id}/keywords`));
    } catch (err) {
      setKeywordsError(err instanceof Error ? err.message : 'Unable to load keywords.');
    } finally {
      setKeywordsLoading(false);
    }
  };

  return (
    <Page title={client.name} subtitle={`Live client intelligence · refreshed every minute`} backAction={{ content: 'Clients', url: '/admin/clients' }}>
      <BlockStack gap="400">
        {error && <div><Text as="p" tone="critical">{error}</Text></div>}

        {demoStatus && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(252,185,0,0.1), rgba(248,157,75,0.08))',
            border: '1px solid rgba(252,185,0,0.3)',
            borderRadius: 'var(--p-border-radius-200)',
            padding: 'var(--p-space-300) var(--p-space-400)',
          }}>
            <InlineStack wrap gap="300" blockAlign="center" align="space-between">
              <InlineStack gap="300" blockAlign="center" wrap>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: demoStatus.expired ? '#ef4444' : demoStatus.days_remaining <= 3 ? '#f59e0b' : '#22C55E',
                  flexShrink: 0,
                }} />
                <BlockStack gap="100">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {demoStatus.expired
                      ? 'Trial expired — upgrade to continue generating'
                      : `Free trial · ${demoStatus.days_remaining} day${demoStatus.days_remaining === 1 ? '' : 's'} remaining`}
                  </Text>
                  <InlineStack gap="200" wrap>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Articles: {demoStatus.articles_used} / {demoStatus.articles_limit}
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      · Tokens: {(demoStatus.tokens_used / 1000).toFixed(0)}k / {(demoStatus.tokens_limit / 1000).toFixed(0)}k
                    </Text>
                  </InlineStack>
                </BlockStack>
              </InlineStack>
              <Button
                variant="primary"
                url="/demo/upgrade"
              >
                Upgrade Now
              </Button>
            </InlineStack>
          </div>
        )}

        <Card>
          <div style={{ borderTop: `5px solid ${presentation.accent}`, margin: 'calc(var(--p-space-400) * -1)', marginBottom: 'var(--p-space-400)', borderRadius: 'var(--p-border-radius-200) var(--p-border-radius-200) 0 0' }} />
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="start" gap="300" wrap>
              <BlockStack gap="100">
                <Text as="h2" variant="headingLg">{profile.industry}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">{profile.summary}</Text>
              </BlockStack>
              <InlineStack gap="200" wrap>
                <Badge tone={client.is_active ? 'success' : 'critical'}>{client.is_active ? 'Active client' : 'Inactive client'}</Badge>
                <Badge tone={contentRules.requiresManualApproval ? 'attention' : 'info'}>{contentRules.requiresManualApproval ? 'Manual approval' : 'Auto approval'}</Badge>
              </InlineStack>
            </InlineStack>
            <InlineStack gap="400" wrap>
              <Text as="span" variant="bodySm" tone="subdued">Slug: {client.slug}</Text>
              {client.shopify_shop && <Text as="span" variant="bodySm" tone="subdued">Store: {client.shopify_shop}</Text>}
              <Text as="span" variant="bodySm" tone="subdued">Timezone: {client.timezone}</Text>
              <InlineStack gap="100" blockAlign="center">
                <Languages size={14} style={{ opacity: 0.5 }} />
                <Text as="span" variant="bodySm" tone="subdued">Locale: {getLocaleName(localeValue)}</Text>
              </InlineStack>
            </InlineStack>
            <Divider />
            <InlineStack gap="300" blockAlign="end" wrap>
              <div style={{ minWidth: 220, maxWidth: 300, flex: 1 }}>
                <Select
                  label="Content language"
                  labelHidden
                  value={localeValue}
                  onChange={(val) => setLocaleValue(val)}
                  options={SUPPORTED_LOCALES.map(l => ({ value: l.code, label: `${l.nativeName} (${l.name})` }))}
                  disabled={savingLocale}
                />
              </div>
              <Button
                variant="primary"
                size="slim"
                onClick={() => saveLocale(localeValue)}
                loading={savingLocale}
                disabled={savingLocale || localeValue === ((data?.client?.locale as string) || (data?.client?.settings?.locale as string) || 'en')}
              >
                Save Language
              </Button>
              {localeSaveMessage && (
                <Text as="span" variant="bodySm" tone={localeSaveMessage === 'Language saved' ? 'success' : 'critical'}>
                  {localeSaveMessage}
                </Text>
              )}
            </InlineStack>
          </BlockStack>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard icon={<FileText size={20} />} label="Total Articles" value={pipeline.total} color={presentation.accent} to={`/admin/articles?clientId=${client.id}`} />
          <MetricCard icon={<FileText size={20} />} label="Published" value={pipeline.published} color="#34D399" to={`/admin/articles?clientId=${client.id}&status=published`} />
          <MetricCard icon={<Target size={20} />} label="Keywords" value={data.keywords.total || 0} color="#F472B6" onClick={openKeywordList} />
          <MetricCard icon={<DollarSign size={20} />} label="MTD Costs" value={`$${costTotal.toFixed(2)}`} color="#FBBF24" to={`/admin/costs?clientId=${client.id}`} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center"><Palette size={18} color={presentation.accent} /><Text as="h3" variant="headingSm">Article Presentation</Text></InlineStack>
              <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 'var(--p-space-300)', alignItems: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {[presentation.accent, presentation.accentSoft, presentation.text, presentation.border].map((color) => <div key={color} style={{ height: 30, background: color, border: '1px solid rgba(0,0,0,.12)', borderRadius: presentation.radius }} />)}
                </div>
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">{presentation.id} article profile</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Headings: {presentation.headingFont}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Body: {presentation.bodyFont}</Text>
                </BlockStack>
              </div>
              <Text as="p" variant="bodySm" tone="subdued">Scoped inline presentation is applied to every new draft and final publish without changing the storefront theme.</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center"><BookOpen size={18} color={presentation.accent} /><Text as="h3" variant="headingSm">Content Direction</Text></InlineStack>
              <InlineStack gap="150" wrap>
                {profile.contentFocus.length > 0 ? profile.contentFocus.map((focus) => <Badge key={focus}>{focus}</Badge>) : <Text as="p" tone="subdued">Complete onboarding to add content focus areas.</Text>}
              </InlineStack>
              <Divider />
              <Text as="p" variant="bodySm"><strong>Brand voice:</strong> {client.brand_voice || 'Not configured'}</Text>
              <Text as="p" variant="bodySm"><strong>Service area:</strong> {client.service_area || 'Not configured'}</Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center"><ShieldCheck size={18} color={presentation.accent} /><Text as="h3" variant="headingSm">Publishing Controls</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span" tone="subdued">Minimum article length</Text><Text as="span" fontWeight="semibold">{contentRules.minimumWords.toLocaleString()} words</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span" tone="subdued">Source format</Text><Text as="span" fontWeight="semibold">{contentRules.sourceFormat}</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span" tone="subdued">Default blog</Text><Text as="span" fontWeight="semibold">{defaultBlog || 'Auto-detect'}</Text></InlineStack>
              <InlineStack align="space-between"><Text as="span" tone="subdued">Approval flow</Text><Text as="span" fontWeight="semibold">{contentRules.requiresManualApproval ? 'Editor approval required' : 'Automated'}</Text></InlineStack>
              <Divider />
              <BlockStack gap="100">{contentRules.safeguards.map((rule) => <Text key={rule} as="p" variant="bodySm" tone="subdued">{rule}</Text>)}</BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center"><UsersRound size={18} color={presentation.accent} /><Text as="h3" variant="headingSm">Client Roles</Text></InlineStack>
              {team.length > 0 ? team.map((role) => (
                <BlockStack key={role.role} gap="100">
                  <InlineStack align="space-between"><Text as="span" fontWeight="semibold">{labelFor(role.role)}</Text><Badge>{String(role.count)}</Badge></InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">{role.members.join(', ')}</Text>
                </BlockStack>
              )) : <Text as="p" tone="subdued">No assigned dashboard users yet.</Text>}
              <Divider />
              {connections.map((connection) => <InlineStack key={`${connection.provider}-${connection.default_blog_id || ''}`} align="space-between"><InlineStack gap="150"><Link2 size={15} /><Text as="span" variant="bodySm">{labelFor(connection.provider)}</Text></InlineStack><Badge tone={connection.is_active ? 'success' : 'critical'}>{connection.is_active ? 'Connected' : 'Inactive'}</Badge></InlineStack>)}
            </BlockStack>
          </Card>
        </div>

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center"><Clock3 size={18} color={presentation.accent} /><Text as="h3" variant="headingSm">Article Pipeline</Text></InlineStack>
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4" style={{ minHeight: 128 }}>
              {[
                { label: 'Draft', value: pipeline.draft, color: '#6B7280' },
                { label: 'Generated', value: pipeline.generated, color: '#CA8A04' },
                { label: 'Approved', value: pipeline.approved, color: '#3B82F6' },
                { label: 'Published', value: pipeline.published, color: '#22C55E' },
              ].map((stage) => {
                const max = Math.max(pipeline.draft, pipeline.generated, pipeline.approved, pipeline.published, 1);
                return <div key={stage.label} className="min-w-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--p-space-100)' }}><Text as="span" variant="headingLg" fontWeight="bold">{stage.value}</Text><div style={{ width: '100%', borderRadius: 'var(--p-space-100)', background: stage.color, height: `${Math.max((stage.value / max) * 100, 4)}%`, minHeight: 4, transition: 'height 0.3s' }} /><Text as="span" variant="bodyXs" tone="subdued">{stage.label}</Text></div>;
              })}
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
      <Modal open={keywordListOpen} onClose={() => setKeywordListOpen(false)} title={`${client.name} Keywords (${data.keywords.total})`} maxWidth={900}>
        {keywordsLoading && <div className="py-10 text-center"><Spinner accessibilityLabel="Loading keywords" size="large" /></div>}
        {keywordsError && <Text as="p" tone="critical">{keywordsError}</Text>}
        {keywords && (
          <div className="max-h-[60vh] overflow-y-auto border border-brand-border">
            {keywords.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-brand-border px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <Text as="p" variant="bodyMd" fontWeight="semibold" breakWord>{entry.keyword}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{labelFor(entry.intent)} · {labelFor(entry.source)}</Text>
                </div>
                <Badge tone={entry.last_used_at ? 'info' : 'success'}>{entry.last_used_at ? 'Used' : 'Unused'}</Badge>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Page>
  );
}
