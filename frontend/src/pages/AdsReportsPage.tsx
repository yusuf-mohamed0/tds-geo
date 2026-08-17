import { useEffect, useMemo, useState } from 'react';
import { Page, Card, Text, Badge, Banner, BlockStack, InlineStack, Button, SkeletonPage, SkeletonBodyText, TextField } from '@shopify/polaris';
import { ShieldCheck, FileText, PlayCircle, Users } from 'lucide-react';
import {
  dryRunAdsReport,
  fetchAdsReportingStatus,
  generateInternalAdsReport,
  type AdsReportingClient,
  type AdsReportingStatus,
} from '../api/adsReports';

function previousMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
}

function readinessTone(ready: boolean): 'success' | 'critical' {
  return ready ? 'success' : 'critical';
}

export default function AdsReportsPage() {
  const [status, setStatus] = useState<AdsReportingStatus | null>(null);
  const [month, setMonth] = useState(previousMonth());
  const [selectedClient, setSelectedClient] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');

  const load = () => {
    setError('');
    fetchAdsReportingStatus()
      .then((next) => {
        setStatus(next);
        setSelectedClient((current) => current || next.clients[0]?.id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const client = useMemo<AdsReportingClient | undefined>(
    () => status?.clients.find((entry) => entry.id === selectedClient),
    [selectedClient, status?.clients],
  );

  const run = async (mode: 'dry-run' | 'generate') => {
    if (!selectedClient) return;
    setRunning(mode);
    setError('');
    setOutput('');
    try {
      const result = mode === 'dry-run'
        ? await dryRunAdsReport(selectedClient, month)
        : await generateInternalAdsReport(selectedClient, month);
      setOutput([result.stdout, result.stderr].filter(Boolean).join('\n'));
      await fetchAdsReportingStatus().then(setStatus);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning('');
    }
  };

  if (loading) {
    return (
      <SkeletonPage title="Ads Reports">
        <SkeletonBodyText lines={8} />
      </SkeletonPage>
    );
  }

  return (
    <Page title="Ads Reports" subtitle="Internal Meta and Google Ads report control room with strict review gates">
      <BlockStack gap="500">
        {error && <Banner tone="critical">{error}</Banner>}

        {status && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Runner</Text>
                  <ShieldCheck size={20} />
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
                  <Text as="h2" variant="headingMd">Employees</Text>
                  <Users size={20} />
                </InlineStack>
                <Text as="p" variant="heading2xl" fontWeight="bold">{status.roles.length}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Strict operating roles before approval</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Internal PDFs</Text>
                  <FileText size={20} />
                </InlineStack>
                <Text as="p" variant="heading2xl" fontWeight="bold">{status.artifacts.length}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Saved locally, not emailed to clients</Text>
              </BlockStack>
            </Card>
          </div>
        )}

        {status && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Generate Internal Report</Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <Text as="span" variant="bodySm" tone="subdued">Client</Text>
                  <select className="mt-1 w-full rounded-md border border-brand-border bg-white px-3 py-2" value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}>
                    {status.clients.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                  </select>
                </label>
                <TextField label="Month" value={month} onChange={setMonth} autoComplete="off" helpText="Use YYYY-MM" />
                <div className="flex items-end gap-2">
                  <Button icon={PlayCircle} loading={running === 'dry-run'} onClick={() => run('dry-run')}>Dry-run</Button>
                  <Button variant="primary" loading={running === 'generate'} onClick={() => run('generate')}>Generate PDF</Button>
                </div>
              </div>
              {client && <Text as="p" variant="bodySm" tone="subdued">Platforms: {client.platforms.join(', ') || 'none'} | Meta: {client.metaAccounts.length} | Google Ads: {client.googleCustomers.length}</Text>}
              {output && <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{output}</pre>}
            </BlockStack>
          </Card>
        )}

        {status && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Strict Roles</Text>
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

        {status && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Generated Internal PDFs</Text>
              {status.artifacts.length ? status.artifacts.map((artifact) => (
                <InlineStack key={artifact.path} align="space-between">
                  <Text as="span" variant="bodySm">{artifact.fileName}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">{new Date(artifact.updatedAt).toLocaleString()}</Text>
                </InlineStack>
              )) : <Text as="p" variant="bodySm" tone="subdued">No reports generated yet.</Text>}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
