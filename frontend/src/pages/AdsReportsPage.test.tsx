import { describe, expect, it, vi } from 'vitest';
import { AppProvider } from '@shopify/polaris';
import { render, screen, waitFor } from '../test/test-utils';
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
        googleCustomers: [],
      },
    ],
    roles: [
      { role: 'CEO / final approver', owns: 'Final approval before anything leaves Kivo Geo' },
    ],
    reviewGates: ['No client email from Kivo Geo without explicit approval'],
    artifacts: [],
  }),
  dryRunAdsReport: vi.fn(),
  generateInternalAdsReport: vi.fn(),
}));

describe('AdsReportsPage', () => {
  it('renders the ads reporting control room without crashing', async () => {
    renderWithPolaris(<AdsReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Generate Internal Report')).toBeInTheDocument();
    });

    expect(screen.getByText('Runner')).toBeInTheDocument();
    expect(screen.getByText('Alamein 2022')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dry-run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate PDF' })).toBeInTheDocument();
  });
});
