import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { AppProvider } from '@shopify/polaris';
import ClientDashboard from './ClientDashboard';

function renderWithPolaris(ui: React.ReactElement) {
  return render(<AppProvider i18n={{}}>{ui}</AppProvider>);
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ clientId: 'test-client-1' }),
  };
});

const apiFetchMock = vi.fn();
vi.mock('../api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe('ClientDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    apiFetchMock.mockReturnValue(new Promise(() => {}));

    renderWithPolaris(<ClientDashboard />);
    expect(screen.getByText('Client Dashboard')).toBeInTheDocument();
  });

  it('shows not found state when API rejects', async () => {
    apiFetchMock.mockRejectedValue(new Error('Not found'));

    renderWithPolaris(<ClientDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Client not found')).toBeInTheDocument();
    });
  });
});
