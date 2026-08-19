import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Page,
  Card,
  Text,
  Badge,
  Banner,
  BlockStack,
  InlineStack,
  Button,
  SkeletonPage,
  SkeletonBodyText,
  TextField,
  Select,
  ButtonGroup,
} from '@shopify/polaris';
import { Activity, Files, LayoutDashboard, RefreshCw } from 'lucide-react';
import {
  approveRegistryEntry,
  deliverRegistryEntry,
  dryRunAdsReport,
  fetchAdsRegistry,
  fetchAdsReportingStatus,
  generateInternalAdsReport,
  rejectRegistryEntry,
  runAllAdsReports,
  syncAdsRegistry,
  type AdsArtifactStatus,
  type AdsRegistryEntry,
  type AdsReportingStatus,
} from '../api/adsReports';

const ALL_CLIENTS = '__all__';

const STATUS_ORDER: AdsArtifactStatus[] = ['generated', 'in_review', 'approved', 'rejected', 'delivered'];

function statusTone(status: AdsArtifactStatus): 'info' | 'attention' | 'success' | 'critical' {
  switch (status) {
    case 'generated': return 'info';
    case 'in_review': return 'attention';
    case 'approved': return 'success';
    case 'rejected': return 'critical';
    case 'delivered': return 'success';
  }
}

function previousMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
}

function readinessTone(ready: boolean): 'success' | 'critical' {
  return ready ? 'success' : 'critical';
}

export default function AdsReportsPage() {
  const [status, setStatus] = useState<AdsReportingStatus | null>(null);
  const [registry, setRegistry] = useState<AdsRegistryEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'' | AdsArtifactStatus>('');
  const [month, setMonth] = useState(previousMonth());
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [syncing, setSyncing] = useState(false);

  const loadRegistry = useCallback(() => {
    fetchAdsRegistry({ status: statusFilter || undefined })
      .then(setRegistry)
      .catch(() => {});
  }, [statusFilter]);

  const load = useCallback(() => {
    setError('');
    fetchAdsReportingStatus()
      .then((next) => {
        setStatus(next);
        setSelectedClient((current) => current || next.clients[0]?.id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    loadRegistry();
  }, [load, loadRegistry]);

  const client = useMemo(
    () => status?.clients.find((entry) => entry.id === selectedClient),
    [selectedClient, status?.clients],
  );

  const clientOptions = useMemo(() => {
    const list = status?.clients.map((entry) => ({ label: entry.name, value: entry.id })) ?? [];
    return [{ label: 'All clients (combined portfolio)', value: ALL_CLIENTS }, ...list];
  }, [status?.clients]);

  const run = async (mode: 'dry-run' | 'generate' | 'run-all') => {
    setRunning(mode);
    setError('');
    setOutput('');
    try {
      const result = mode === 'run-all'
        ? await runAllAdsReports(month)
        : mode === 'dry-run' && selectedClient !== ALL_CLIENTS
          ? await dryRunAdsReport(selectedClient, month)
          : mode === 'dry-run'
            ? { stdout: 'Dry-run only applies to a single client. Use "Generate all clients" to build the combined report.', stderr: '' }
            : await generateInternalAdsReport(selectedClient, month);
      setOutput([result.stdout, result.stderr].filter(Boolean).join('\n'));
      await Promise.all([fetchAdsReportingStatus().then(setStatus), loadRegistry()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning('');
    }
  };

  const sync = async () => {
    setSyncing(true);
    setError('');
    try {
      const result = await syncAdsRegistry();
      setOutput(`Registry synced: ${result.inserted} inserted, ${result.updated} updated, ${result.total} total.`);
      await loadRegistry();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const approve = async (entry: AdsRegistryEntry) => {
    try {
      await approveRegistryEntry(entry.id);
      await loadRegistry();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reject = async (entry: AdsRegistryEntry) => {
    const reason = window.prompt(`Rejection reason for ${entry.fileName}`, 'Figures do not match platform UI');
    if (reason === null) return;
    try {
      await rejectRegistryEntry(entry.id, reason);
      await loadRegistry();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deliver = async (entry: AdsRegistryEntry) => {
    const recipient = window.prompt('Deliver to email', 'reports@trafficdigitalsolutions.com');
    if (recipient === null) return;
    try {
      await deliverRegistryEntry(entry.id, recipient.trim());
      await loadRegistry();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const filteredRegistry = useMemo(
    () => (statusFilter ? registry.filter((entry) => entry.status === statusFilter) : registry),
    [registry, statusFilter],
  );

  if (loading) {
    return (
      <SkeletonPage title="Ads Reports">
        <SkeletonBodyText lines={8} />
      </SkeletonPage>
    );
  }

  return (
    <Page title="Ads Reports" subtitle="Meta mediabuying control room — 33 clients, monthly combined report, strict review gates">
      <BlockStack gap="500">
        {error && <Banner tone="critical">{error}</Banner>}
        {status && !status.projectReady && (
          <Banner tone="warning">Reporting runner is not reachable on the server. Generation will fail until it is deployed.</Banner>
        )}

        {status && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Pipeline</Text>
                  <Activity size={20} />
                </InlineStack>
                <InlineStack gap="200">
                  <Badge tone={readinessTone(status.projectReady)}>Project</Badge>
                  <Badge tone={readinessTone(status.envReady)}>Secrets</Badge>
                  <Badge tone={readinessTone(status.clientConfigReady)}>Clients</Badge>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">{status.projectRoot}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Portfolio</Text>
                  <LayoutDashboard size={20} />
                </InlineStack>
                <Text as="p" variant="heading2xl" fontWeight="bold">{status.clients.length}</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {status.clients.reduce((sum, c) => sum + c.metaAccounts.length, 0)} Meta ad accounts · one monthly report
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Registry</Text>
                  <Files size={20} />
                </InlineStack>
                <Text as="p" variant="heading2xl" fontWeight="bold">{registry.length}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Artifacts tracked for approval and delivery</Text>
              </BlockStack>
            </Card>
          </div>
        )}

        {status && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Generate Monthly Report</Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Select
                  label="Client"
                  value={selectedClient}
                  onChange={setSelectedClient}
                  options={clientOptions}
                  disabled={!clientOptions.length}
                />
                <TextField label="Month" value={month} onChange={setMonth} autoComplete="off" helpText="Use YYYY-MM" />
                <div className="flex items-end">
                  <ButtonGroup>
                    <Button loading={running === 'dry-run'} disabled={selectedClient === ALL_CLIENTS} onClick={() => run('dry-run')}>Dry-run</Button>
                    <Button variant="primary" loading={running === 'generate'} disabled={selectedClient === ALL_CLIENTS} onClick={() => run('generate')}>Generate PDF</Button>
                    <Button tone="critical" loading={running === 'run-all'} onClick={() => run('run-all')}>Generate all clients</Button>
                  </ButtonGroup>
                </div>
              </div>
              {client && <Text as="p" variant="bodySm" tone="subdued">Platforms: {client.platforms.join(', ') || 'none'} | Meta: {client.metaAccounts.length}</Text>}
              {output && <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{output}</pre>}
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Artifact Registry</Text>
              <InlineStack gap="200">
                <Select
                  label="Status filter"
                  labelHidden
                  value={statusFilter || ''}
                  onChange={(value) => setStatusFilter((value || '') as '' | AdsArtifactStatus)}
                  options={[
                    { label: 'All statuses', value: '' },
                    ...STATUS_ORDER.map((s) => ({ label: s, value: s })),
                  ]}
                />
                <Button loading={syncing} onClick={sync} icon={<RefreshCw size={16} />}>Sync</Button>
              </InlineStack>
            </InlineStack>

            {filteredRegistry.length === 0 ? (
              <Text as="p" variant="bodySm" tone="subdued">No reports in the registry yet. Generate a report, then click Sync.</Text>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Report</th>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Approved by</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegistry.map((entry) => (
                      <tr key={entry.id} className="border-b border-brand-border">
                        <td className="px-3 py-2">
                          <Text as="p" variant="bodySm" fontWeight="semibold">{entry.fileName}</Text>
                          <Text as="p" variant="bodySm" tone="subdued">{(entry.sizeBytes / 1024).toFixed(1)} KB · {new Date(entry.updatedAt).toLocaleString()}</Text>
                        </td>
                        <td className="px-3 py-2">{entry.clientId || 'combined'}</td>
                        <td className="px-3 py-2">{entry.month}</td>
                        <td className="px-3 py-2"><Badge tone={statusTone(entry.status)}>{entry.status}</Badge></td>
                        <td className="px-3 py-2">
                          {entry.rejectionReason ? (
                            <Text as="span" variant="bodySm" tone="subdued">Rejected</Text>
                          ) : entry.approvedBy ? (
                            <Text as="span" variant="bodySm" tone="subdued">User {entry.approvedBy}</Text>
                          ) : (
                            <Text as="span" variant="bodySm" tone="subdued">—</Text>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <InlineStack gap="200" align="end">
                            {(entry.status === 'generated' || entry.status === 'in_review') && (
                              <>
                                <Button size="slim" onClick={() => approve(entry)}>Approve</Button>
                                <Button size="slim" tone="critical" onClick={() => reject(entry)}>Reject</Button>
                              </>
                            )}
                            {entry.status === 'approved' && (
                              <Button size="slim" onClick={() => deliver(entry)}>Deliver</Button>
                            )}
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

        {status && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Operating Roles</Text>
                {status.roles.map((role) => (
                  <div key={role.role} className="rounded-lg border border-brand-border p-3">
                    <Text as="p" variant="bodyMd" fontWeight="bold">{role.role}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">{role.owns}</Text>
                  </div>
                ))}
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Review Gates</Text>
                {status.reviewGates.map((gate) => (
                  <InlineStack key={gate} gap="200" blockAlign="start">
                    <Badge tone="attention">Gate</Badge>
                    <Text as="p" variant="bodySm">{gate}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </div>
        )}
      </BlockStack>
    </Page>
  );
}
