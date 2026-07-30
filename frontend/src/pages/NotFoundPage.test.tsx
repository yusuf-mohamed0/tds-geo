import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import NotFoundPage from './NotFoundPage';

describe('NotFoundPage', () => {
  it('renders 404 heading', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders a link to home', () => {
    render(<NotFoundPage />);
    const link = screen.getByRole('link', { name: 'Go Home' });
    expect(link).toHaveAttribute('href', '/');
  });
});
