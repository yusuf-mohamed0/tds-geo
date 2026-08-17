import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Banner,
  Button,
  SkeletonPage,
  SkeletonBodyText,
} from '@shopify/polaris';
import {
  Activity,
  Archive,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Database,
  FileText,
  FolderTree,
  GitBranch,
  Globe2,
  HeartPulse,
  Layers3,
  Link as LinkIcon,
  Newspaper,
  Search,
  Server,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MetricCard from '../components/MetricCard';
import { fetchDashboard, fetchHealth } from '../api/admin';
import {
  fetchActivityFeed,
  fetchActivitySummary,
  fetchAutoFixSummary,
  fetchPendingAutoFixes,
  type ActivityEvent,
  type ActivitySummary,
  type AutoFixRun,
  type AutoFixSummary,
} from '../api/observability';
import type { AdminDashboard, HealthStatus } from '../types';
import { KIVO_BRAND } from '../brand/kivo';

const OPTIONAL_CHECKS = new Set(['turbovec', 'airllm', 'headroom', 'openseo', 'gsc']);

type OperatingAreaLink =
  | { label: string; route: string; href?: never }
  | { label: string; href: string; route?: never };

interface OperatingArea {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  route: string;
  cta: string;
  links: OperatingAreaLink[];
}

const operatingAreas: OperatingArea[] = [
  {
    title: 'Client Growth OS',
    eyebrow: 'clients, approvals, publishing',
    description: 'One client control layer for stores, websites, articles, keywords, approvals, schedules, and publishing history.',
    icon: Users,
    tone: KIVO_BRAND.colors.sky,
    route: '/admin/clients',
    cta: 'Open clients',
    links: [
      { label: 'Articles', route: '/admin/articles' },
      { label: 'Keywords', route: '/admin/keywords' },
      { label: 'Quality', route: '/admin/quality' },
    ],
  },
  {
    title: 'GEO Intelligence',
    eyebrow: 'AI search visibility',
    description: 'Analyze content for answer engines, track citations, prepare GSC, and turn research into stronger EEAT articles.',
    icon: Search,
    tone: KIVO_BRAND.colors.gold,
    route: '/admin/geo',
    cta: 'Run GEO audit',
    links: [
      { label: 'Citations', route: '/admin/citations' },
      { label: 'Search Console', route: '/admin/gsc' },
      { label: 'Backlinks', route: '/admin/backlinks' },
    ],
  },
  {
    title: 'Commerce Connectors',
    eyebrow: 'Shopify, WordPress, CMS',
    description: 'Keep Shopify, WordPress, Next.js, CMS connectors, webhooks, and embedded app flows under one operating umbrella.',
    icon: Store,
    tone: KIVO_BRAND.colors.amber,
    route: '/admin/clients',
    cta: 'Manage stores',
    links: [
      { label: 'CMS links', route: '/admin/clients' },
      { label: 'Articles', route: '/admin/articles' },
      { label: 'Costs', route: '/admin/costs' },
    ],
  },
  {
    title: 'Automation & Reports',
    eyebrow: 'n8n, ads reports, workflows',
    description: 'Monthly ads reports, n8n workflows, heartbeat alerts, and operational runbooks should feed back into the same client timeline.',
    icon: BarChart3,
    tone: KIVO_BRAND.colors.peach,
    route: '/admin/ads-reports',
    cta: 'Open reports',
    links: [
      { label: 'Reports', route: '/admin/ads-reports' },
      { label: 'Docs', href: '/documentation' },
      { label: 'Quality', route: '/admin/quality' },
    ],
  },
  {
    title: 'AI Runtime Layer',
    eyebrow: 'Ollama, workers, queues',
    description: 'OpenAI-compatible Ollama, BullMQ workers, Redis, vector memory, optional sidecars, and cost tracking in one runtime view.',
    icon: Bot,
    tone: KIVO_BRAND.colors.navy,
    route: '/admin/costs',
    cta: 'Inspect costs',
    links: [
      { label: 'GEO', route: '/admin/geo' },
      { label: 'Quality', route: '/admin/quality' },
      { label: 'Keywords', route: '/admin/keywords' },
    ],
  },
  {
    title: 'Infrastructure Control',
    eyebrow: 'TrueNAS, AWS, GitHub',
    description: 'Production health, Docker stack, backups, GitHub runner, AWS relay, tunnel status, and deploy readiness belong here.',
    icon: Server,
    tone: KIVO_BRAND.colors.graphite,
    route: '/admin',
    cta: 'Review health',
    links: [
      { label: 'Health', href: '/health' },
      { label: 'Metrics', href: '/metrics' },
      { label: 'Docs', href: '/documentation' },
    ],
  },
];

const storageBlueprint = [
  { label: 'Runtime source', path: '/opt/kivo/source', detail: 'build context for the running app image' },
  { label: 'Deployment config', path: '/opt/kivo/deploy/truenas', detail: 'compose, Caddy, backup and health scripts' },
  { label: 'Durable data root', path: '/mnt/kivo', detail: 'single VM data root for production state' },
  { label: 'Database files', path: '/mnt/kivo/postgres', detail: 'PostgreSQL and pgvector storage' },
  { label: 'Redis files', path: '/mnt/kivo/redis', detail: 'queue/cache persistence' },
  { label: 'Backups', path: '/mnt/kivo/backups', detail: 'database dumps and restore logs' },
  { label: 'Logs', path: '/mnt/kivo/logs', detail: 'api and worker operational logs' },
  { label: 'Recommended content vault', path: '/mnt/kivo/workspace/{clients,articles,reports,assets,exports,runbooks}', detail: 'best home for client files, reports, articles, and generated assets' },
];

const integrationMilestones = [
  { label: 'Production app unified under /admin', state: 'Live', icon: CheckCircle2 },
  { label: 'Shopify and embedded app flows', state: 'Connected in core', icon: Store },
  { label: 'WordPress and Next.js connectors', state: 'Available packages', icon: LinkIcon },
  { label: 'Paid ads reporting', state: 'Controlled in app', icon: Newspaper },
  { label: 'GSC OAuth', state: 'Waiting for secret', icon: BarChart3 },
  { label: 'Sidecar AI tools', state: 'Optional/offline', icon: Boxes },
];

function statusTone(status: string): 'success' | 'attention' | 'critical' | 'info' {
  if (status === 'healthy' || status === 'configured') return 'success';
  if (status === 'not_configured' || status === 'unreachable' || status === 'disabled') return 'attention';
  if (status === 'unknown') return 'info';
  return 'critical';
}

function StatusPill({ label, status, optional }: { label: string; status: string; optional: boolean }) {
  const tone = optional && ['not_configured', 'unreachable', 'disabled'].includes(status) ? 'attention' : statusTone(status);
  return (
    <div className="flex items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-1.5">
      <Badge tone={tone} size="small" />
      <Text as="span" variant="bodySm">{label}</Text>
      <Text as="span" variant="bodyXs" tone="subdued">{status}</Text>
    </div>
  );
}

function surfaceTone(surface: string): 'success' | 'attention' | 'critical' | 'info' {
  if (surface === 'shopify') return 'success';
  if (surface === 'connector' || surface === 'worker') return 'attention';
  if (surface === 'system') return 'info';
  return 'info';
}

function eventTime(event: ActivityEvent): string {
  if (!event.occurredAt) return 'now';
  return new Date(event.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [autoFixSummary, setAutoFixSummary] = useState<AutoFixSummary | null>(null);
  const [pendingFixes, setPendingFixes] = useState<AutoFixRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([fetchDashboard(), fetchHealth()])
      .then(async ([d, h]) => {
        setDashboard(d);
        setHealth(h);
        const [summary, feed, fixes, pending] = await Promise.allSettled([
          fetchActivitySummary(),
          fetchActivityFeed(),
          fetchAutoFixSummary(),
          fetchPendingAutoFixes(),
        ]);
        if (summary.status === 'fulfilled') setActivitySummary(summary.value);
        if (feed.status === 'fulfilled') setActivityFeed(feed.value);
        if (fixes.status === 'fulfilled') setAutoFixSummary(fixes.value);
        if (pending.status === 'fulfilled') setPendingFixes(pending.value);
      })
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
          <SkeletonBodyText lines={10} />
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

  const activity = dashboard.activity || [];
  const recentArticles = dashboard.recentArticles || [];
  const clients = dashboard.clients || { total: 0, active: 0, new_30d: 0 };
  const articles = dashboard.articles || { total: 0, published: 0, pending_review: 0, this_week: 0 };
  const keywords = dashboard.keywords || { total: 0, avg_relevance: '0' };
  const publishing = dashboard.publishing || { total: 0, this_week: 0 };
  const costs = dashboard.costs || { total_cost_mtd: '0', total_tokens_mtd: 0 };
  const checks = (health?.checks || {}) as Record<string, Record<string, string>>;
  const criticalChecks = Object.entries(checks).filter(([key]) => !OPTIONAL_CHECKS.has(key));
  const optionalChecks = Object.entries(checks).filter(([key]) => OPTIONAL_CHECKS.has(key));

  return (
    <Page
      title="Kivo Command Center"
      subtitle={KIVO_BRAND.positioning}
      primaryAction={{ content: 'Add client', onAction: () => navigate('/admin/clients') }}
      secondaryActions={[
        { content: 'Run GEO audit', onAction: () => navigate('/admin/geo') },
        { content: 'View articles', onAction: () => navigate('/admin/articles') },
      ]}
    >
      <BlockStack gap="500">
        <div className="overflow-hidden rounded-3xl border border-brand-border text-brand-bg shadow-sm" style={{ background: KIVO_BRAND.gradients.command }}>
          <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">Production live</Badge>
                <Badge tone="attention">Umbrella rebuild</Badge>
              </InlineStack>
              <div>
                <Text as="h1" variant="heading2xl" fontWeight="bold">{KIVO_BRAND.os}</Text>
                <div className="mt-3 max-w-3xl text-sm leading-6 text-brand-border">
                  Bring Shopify, WordPress, SEO content, AI search visibility, client files, ads reports, heartbeat, workers,
                  Ollama, backups, and GitHub deployment into one command surface instead of scattered tools.
                </div>
              </div>
              <InlineStack gap="300">
                <Button variant="primary" onClick={() => navigate('/admin/clients')}>Start from clients</Button>
                <Button onClick={() => navigate('/admin/articles')}>Review content</Button>
                <Button onClick={() => navigate('/admin/citations')}>Check AI citations</Button>
              </InlineStack>
            </BlockStack>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <ShieldCheck size={18} color={KIVO_BRAND.colors.gold} />
                  <Text as="h2" variant="headingMd">Today&apos;s control state</Text>
                </InlineStack>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-black/20 p-3"><span className="block text-brand-muted">Active clients</span><strong>{clients.active}</strong></div>
                  <div className="rounded-xl bg-black/20 p-3"><span className="block text-brand-muted">Published</span><strong>{articles.published}</strong></div>
                  <div className="rounded-xl bg-black/20 p-3"><span className="block text-brand-muted">Queued jobs</span><strong>{String((health as any)?.stats?.queued_jobs ?? 0)}</strong></div>
                  <div className="rounded-xl bg-black/20 p-3"><span className="block text-brand-muted">MTD cost</span><strong>${Number(costs.total_cost_mtd || 0).toFixed(2)}</strong></div>
                </div>
              </BlockStack>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<Users size={20} />} label="Clients" value={clients.total ?? 0} subtitle={`${clients.active ?? 0} active · ${clients.new_30d ?? 0} new`} color={KIVO_BRAND.colors.sky} />
          <MetricCard icon={<FileText size={20} />} label="Content Library" value={articles.total ?? 0} subtitle={`${articles.published ?? 0} published · ${articles.pending_review ?? 0} pending`} color={KIVO_BRAND.colors.gold} />
          <MetricCard icon={<Globe2 size={20} />} label="AI Search Readiness" value={`${keywords.avg_relevance ?? '0'}%`} subtitle={`${keywords.total ?? 0} keywords · ${publishing.this_week ?? 0} posts this week`} color={KIVO_BRAND.colors.amber} />
          <MetricCard icon={<CircleDollarSign size={20} />} label="AI Spend" value={`$${Number(costs.total_cost_mtd || 0).toFixed(2)}`} subtitle={`${costs.total_tokens_mtd ?? 0} tokens this month`} color={KIVO_BRAND.colors.peach} />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Activity size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                  <Text as="h2" variant="headingMd">Live Activity Feed</Text>
                </InlineStack>
                <Badge tone={activitySummary?.errors ? 'critical' : 'success'}>
                  {`${activitySummary?.total ?? 0} events / 24h`}
                </Badge>
              </InlineStack>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-brand-border bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Web</Text><Text as="p" variant="headingMd">{activitySummary?.web ?? 0}</Text></div>
                <div className="rounded-xl border border-brand-border bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Shopify</Text><Text as="p" variant="headingMd">{activitySummary?.shopify ?? 0}</Text></div>
                <div className="rounded-xl border border-brand-border bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Connectors</Text><Text as="p" variant="headingMd">{activitySummary?.connector ?? 0}</Text></div>
                <div className="rounded-xl border border-brand-border bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Errors</Text><Text as="p" variant="headingMd">{activitySummary?.errors ?? 0}</Text></div>
              </div>
              <BlockStack gap="200">
                {activityFeed.map((event, index) => (
                  <div key={`${event.action}-${event.occurredAt || index}`} className="rounded-xl border border-brand-border px-3 py-2">
                    <InlineStack align="space-between" blockAlign="start" gap="200">
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={event.success ? surfaceTone(event.surface) : 'critical'}>{event.surface}</Badge>
                          <Text as="span" variant="bodySm" fontWeight="semibold">{event.action}</Text>
                        </InlineStack>
                        <Text as="p" variant="bodyXs" tone="subdued">{event.method || 'EVENT'} {event.route || event.shop || 'browser event'}</Text>
                      </BlockStack>
                      <Text as="span" variant="bodyXs" tone="subdued">{eventTime(event)}</Text>
                    </InlineStack>
                  </div>
                ))}
                {activityFeed.length === 0 && <Text as="p" variant="bodySm" tone="subdued">No tracked activity yet. The feed fills as users move through web, Shopify, API, workers, and connectors.</Text>}
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Bot size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                  <Text as="h2" variant="headingMd">Sentinel Auto-Fix</Text>
                </InlineStack>
                <Button size="slim" onClick={load}>Refresh</Button>
              </InlineStack>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Fixed</Text><Text as="p" variant="headingMd">{autoFixSummary?.fixed ?? 0}</Text></div>
                <div className="rounded-xl bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Pending</Text><Text as="p" variant="headingMd">{autoFixSummary?.pending ?? 0}</Text></div>
                <div className="rounded-xl bg-brand-bg p-3"><Text as="p" variant="bodyXs" tone="subdued">Failed</Text><Text as="p" variant="headingMd">{autoFixSummary?.failed ?? 0}</Text></div>
              </div>
              <Banner tone={pendingFixes.length > 0 ? 'warning' : 'success'} title={pendingFixes.length > 0 ? 'Approval needed for risky fixes' : 'Safe fixes run automatically'}>
                <p>Safe recovery is automatic. Code changes, database mutations, credentials, auth, and payment fixes still require approval.</p>
              </Banner>
              <BlockStack gap="200">
                {pendingFixes.slice(0, 4).map((fix) => (
                  <div key={fix.id} className="rounded-xl border border-brand-border px-3 py-2">
                    <InlineStack align="space-between" blockAlign="center" gap="200">
                      <Text as="span" variant="bodySm" fontWeight="semibold">{fix.action || fix.category}</Text>
                      <Badge tone={fix.severity === 'critical' ? 'critical' : 'attention'}>{fix.severity}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyXs" tone="subdued">{fix.errorMessage || fix.outcome || 'Awaiting approval'}</Text>
                  </div>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Layers3 size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                    <Text as="h2" variant="headingMd">Umbrella Modules</Text>
                  </InlineStack>
                  <Text as="span" variant="bodySm" tone="subdued">Everything starts here, then drills into specialist pages.</Text>
                </InlineStack>
                <div className="grid gap-4 md:grid-cols-2">
                  {operatingAreas.map((area) => {
                    const Icon = area.icon;
                    return (
                      <div key={area.title} className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-accent/40 hover:shadow-md">
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="start" gap="300">
                            <div className="rounded-2xl p-3" style={{ background: `${area.tone}18`, color: area.tone }}><Icon size={22} /></div>
                            <Badge tone="info">{area.eyebrow}</Badge>
                          </InlineStack>
                          <div>
                            <Text as="h3" variant="headingMd">{area.title}</Text>
                            <div className="mt-1"><Text as="p" variant="bodySm" tone="subdued">{area.description}</Text></div>
                          </div>
                          <InlineStack gap="200">
                            <Button size="slim" onClick={() => navigate(area.route)}>{area.cta}</Button>
                            {area.links.map((link) => link.route ? (
                              <Button key={link.label} size="slim" variant="tertiary" onClick={() => navigate(link.route)}>{link.label}</Button>
                            ) : (
                              <Button key={link.label} size="slim" variant="tertiary" url={link.href} target="_blank">{link.label}</Button>
                            ))}
                          </InlineStack>
                        </BlockStack>
                      </div>
                    );
                  })}
                </div>
              </BlockStack>
            </Card>
          </div>

          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <HeartPulse size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                <Text as="h2" variant="headingMd">Health & Readiness</Text>
              </InlineStack>
              <BlockStack gap="300">
                {criticalChecks.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Core services</Text>
                    <div className="flex flex-wrap gap-2">
                      {criticalChecks.map(([key, val]) => <StatusPill key={key} label={key} status={val?.status || 'unknown'} optional={false} />)}
                    </div>
                  </BlockStack>
                )}
                {optionalChecks.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Optional modules</Text>
                    <div className="flex flex-wrap gap-2">
                      {optionalChecks.map(([key, val]) => <StatusPill key={key} label={key} status={val?.status || 'unknown'} optional />)}
                    </div>
                  </BlockStack>
                )}
                <Banner tone="info" title="Next backend step">
                  <p>Add an operations endpoint for GitHub runner, AWS tunnel, backup freshness, reports imports, and WordPress/Shopify connector health so this panel becomes live infrastructure control.</p>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Activity size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                <Text as="h2" variant="headingMd">30-Day Activity</Text>
              </InlineStack>
              {activity.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={activity}>
                    <CartesianGrid strokeDasharray="3 3" stroke={KIVO_BRAND.colors.border} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: KIVO_BRAND.colors.muted }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: KIVO_BRAND.colors.muted }} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: KIVO_BRAND.colors.obsidian, border: `1px solid ${KIVO_BRAND.colors.graphite}`, borderRadius: 8, color: KIVO_BRAND.colors.cream, fontSize: 12 }} />
                    <Bar dataKey="count" fill={KIVO_BRAND.colors.gold} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center"><Text as="p" variant="bodySm" tone="subdued">No activity data yet.</Text></div>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <FolderTree size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                  <Text as="h2" variant="headingMd">Professional File System Blueprint</Text>
                </InlineStack>
                <Badge tone="attention">recommended</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Keep code in Git, secrets in the root-only vault, and durable client work under one production workspace. This avoids scattering articles, PDFs, exports, and reports across `/root`, AWS, and ad-hoc folders.
              </Text>
              <div className="overflow-hidden rounded-2xl border border-brand-border">
                {storageBlueprint.map((item) => (
                  <div key={item.path} className="grid gap-2 border-b border-brand-border px-4 py-3 last:border-b-0 md:grid-cols-[0.28fr_0.38fr_0.34fr]">
                    <Text as="span" variant="bodySm" fontWeight="semibold">{item.label}</Text>
                    <code className="rounded bg-brand-bg px-2 py-1 text-xs text-brand-text">{item.path}</code>
                    <Text as="span" variant="bodySm" tone="subdued">{item.detail}</Text>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <Database size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                <Text as="h2" variant="headingMd">Data ownership rules</Text>
              </InlineStack>
              <div className="space-y-3 text-sm text-brand-muted">
                <p><strong className="text-brand-text">GitHub:</strong> source code, migrations, workflows, docs, integration packages.</p>
                <p><strong className="text-brand-text">TrueNAS VM:</strong> production runtime, database, Redis, backups, logs, generated operational outputs.</p>
                <p><strong className="text-brand-text">Client workspace:</strong> articles, briefs, PDFs, assets, reports, exports, and runbooks under `/mnt/kivo/workspace`.</p>
                <p><strong className="text-brand-text">Secrets vault:</strong> only `/root/.kivo-secrets` or locked production env files, never docs or reports.</p>
              </div>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center">
                <GitBranch size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                <Text as="h2" variant="headingMd">Integration roadmap</Text>
              </InlineStack>
              <div className="space-y-3">
                {integrationMilestones.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-brand-border px-3 py-2">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon size={16} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                        <Text as="span" variant="bodySm">{item.label}</Text>
                      </InlineStack>
                      <Badge tone={item.state === 'Live' ? 'success' : item.state.includes('Waiting') || item.state.includes('Optional') ? 'attention' : 'info'}>{item.state}</Badge>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Archive size={18} style={{ color: 'var(--p-color-bg-fill-brand)' }} />
                  <Text as="h2" variant="headingMd">Recent Articles</Text>
                </InlineStack>
                <Text as="span" variant="bodySm" tone="subdued">{recentArticles.length}</Text>
              </InlineStack>
              {recentArticles.slice(0, 6).map((article) => (
                <button
                  type="button"
                  key={article.id}
                  onClick={() => navigate(`/admin/articles/${article.id}`)}
                  className="w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-brand-border hover:bg-brand-bg"
                >
                  <InlineStack align="space-between" blockAlign="start" gap="200">
                    <Text as="span" variant="bodySm" fontWeight="medium" truncate>{article.title}</Text>
                    <Badge tone={article.status === 'published' ? 'success' : article.status === 'approved' ? 'info' : article.status === 'generated' ? 'warning' : 'attention'}>{article.status || 'draft'}</Badge>
                  </InlineStack>
                  {!!article.seo_score && <Text as="p" variant="bodyXs" tone="subdued">SEO: {String(article.seo_score)}</Text>}
                </button>
              ))}
              {recentArticles.length === 0 && <Text as="p" variant="bodySm" tone="subdued">No recent articles yet.</Text>}
              <Button onClick={() => navigate('/admin/articles')}>Open content library</Button>
            </BlockStack>
          </Card>
        </div>
      </BlockStack>
    </Page>
  );
}
