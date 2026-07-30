import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';

vi.mock('@shopify/polaris', () => ({
  Badge: ({ tone, children }: { tone: string; children: React.ReactNode }) => (
    <span data-testid="badge" data-tone={tone}>{children}</span>
  ),
}));

import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders with correct tone for "published"', () => {
    render(<StatusBadge status="published" />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('published');
    expect(badge).toHaveAttribute('data-tone', 'success');
  });

  it('renders with correct tone for "approved"', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-tone', 'info');
  });

  it('renders with correct tone for "error"', () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-tone', 'critical');
  });

  it('renders with attention tone for unknown statuses', () => {
    render(<StatusBadge status="unknown" />);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-tone', 'attention');
  });

  it('handles case-insensitive matching', () => {
    render(<StatusBadge status="PUBLISHED" />);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-tone', 'success');
  });
});
