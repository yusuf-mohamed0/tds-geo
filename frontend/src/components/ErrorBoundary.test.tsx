import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';

const mockCard = vi.fn();
const mockText = vi.fn();
const mockBlockStack = vi.fn();

vi.mock('@shopify/polaris', () => ({
  Card: ({ children }: { children: React.ReactNode }) => {
    mockCard();
    return <div data-testid="card">{children}</div>;
  },
  Text: ({ children, tone, as, variant }: { children: React.ReactNode; tone?: string; as: string; variant: string }) => {
    mockText({ tone, as, variant });
    return <p data-testid="text" data-tone={tone}>{children}</p>;
  },
  BlockStack: ({ children, gap }: { children: React.ReactNode; gap: string }) => {
    mockBlockStack({ gap });
    return <div data-testid="blockstack">{children}</div>;
  },
}));

import ErrorBoundary from './ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(<ErrorBoundary><span>Safe content</span></ErrorBoundary>);
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders error UI when a child throws', () => {
    const Bomb = () => { throw new Error('💥'); };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('💥')).toBeInTheDocument();
  });

  it('displays the error message text', () => {
    const Bomb = () => { throw new Error('Kaboom'); };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Kaboom')).toBeInTheDocument();
  });

  it('logs the error to console.error', () => {
    const Bomb = () => { throw new Error('Log me'); };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });
});
