import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '@shopify/polaris';
import { fireEvent, render, screen, waitFor } from '../test/test-utils';
import AdsReportsPage from './AdsReportsPage';

function renderWithPolaris(ui: React.ReactElement) {
  return render(<AppProvider i18n={{}}>{ui}</AppProvider>);
}

vi.mock('../api/adsReports', () => ({
  fetchAdsReportingStatus: vi.fn().mockResolvedValue({
    projectReady: true,
    envReady: true,
    clientConfigReady: true,
    projectRoot: '/root/tds-ads-reporting-automation',
    clients: [
      {
        id: 'alamein-2022',
        name: 'Alamein 2022',
        platforms: ['meta'],
        metaAccounts: ['act_272954367455662'],
      },
      {
        id: 'caravanserai',
        name: 'Caravanserai',
        platforms: ['meta'],
        metaAccounts: ['act_326559196172852'],
      },
    ],
    roles: [
      { role: 'CEO / final approver', owns: 'Final approval before anything leaves Kivo Geo' },
    ],
    reviewGates: ['No client email from Kivo Geo without explicit approval'],
    artifacts: [],
  }),
  fetchAdsRegistry: vi.fn().mockResolvedValue([
    {
      id: '1',
      clientId: 'alamein-2022',
      month: '2026-07',
      fileName: 'alamein-2022_2026-07.pdf',
      filePath: '/reports/alamein-2022_2026-07.pdf',
      sizeBytes: 102400,
      status: 'in_review',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    },
  ]),
  syncAdsRegistry: vi.fn().mockResolvedValue({ inserted: 1, updated: 0, total: 1 }),
  dryRunAdsReport: vi.fn(),
  generateInternalAdsReport: vi.fn(),
  runAllAdsReports: vi.fn(),
  approveRegistryEntry: vi.fn().mockResolvedValue({}),
  rejectRegistryEntry: vi.fn().mockResolvedValue({}),
  deliverRegistryEntry: vi.fn().mockResolvedValue({}),
}));

describe('AdsReportsPage', () => {
  it('renders the ads reporting control room without crashing', async () => {
    renderWithPolaris(<AdsReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Generate Monthly Report')).toBeInTheDocument();
    });

    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByLabelText('Client')).toHaveValue('alamein-2022');
    expect(screen.getByRole('button', { name: 'Dry-run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate all clients' })).toBeInTheDocument();
    expect(screen.getByText('Artifact Registry')).toBeInTheDocument();
  });

  it('shows registry entries with approve/reject actions', async () => {
    renderWithPolaris(<AdsReportsPage />);

    const fileName = await screen.findByText('alamein-2022_2026-07.pdf');
    expect(fileName).toBeInTheDocument();
    expect(screen.getAllByText('in_review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('updates the selected client from the client selector', async () => {
    renderWithPolaris(<AdsReportsPage />);

    const select = await screen.findByLabelText('Client');
    fireEvent.change(select, { target: { value: 'caravanserai' } });

    expect(screen.getByText('Platforms: meta | Meta: 1')).toBeInTheDocument();
  });
});
