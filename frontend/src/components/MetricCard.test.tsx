import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import MetricCard from './MetricCard';

function Icon({ className }: { className?: string }) {
  return <svg data-testid="icon" className={className} />;
}

describe('MetricCard', () => {
  const defaultProps = {
    icon: <Icon />,
    label: 'Total Articles',
    value: 42,
  };

  it('renders label and value', () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByText('Total Articles')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<MetricCard {...defaultProps} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<MetricCard {...defaultProps} subtitle="12 this week" />);
    expect(screen.getByText('12 this week')).toBeInTheDocument();
  });

  it('renders positive trend', () => {
    render(<MetricCard {...defaultProps} trend={{ value: 15, positive: true }} />);
    expect(screen.getByText('+15%')).toBeInTheDocument();
  });

  it('renders negative trend', () => {
    render(<MetricCard {...defaultProps} trend={{ value: 8, positive: false }} />);
    expect(screen.getByText((content) => content.includes('8') && content.includes('%'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('8') && content.includes('%'))).toHaveTextContent('8%');
  });

  it('wraps in a link when "to" is provided', () => {
    render(<MetricCard {...defaultProps} to="/articles" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/articles');
  });

  it('wraps in a button when "onClick" is provided', () => {
    const onClick = vi.fn();
    render(<MetricCard {...defaultProps} onClick={onClick} />);
    const button = screen.getByRole('button');
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as plain div when no to/onClick', () => {
    const { container } = render(<MetricCard {...defaultProps} />);
    expect(container.querySelector('a')).not.toBeInTheDocument();
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });

  it('applies custom color', () => {
    const { container } = render(<MetricCard {...defaultProps} color="#FF0000" />);
    const bar = container.querySelector('[style*="background-color"]');
    expect(bar).toBeInTheDocument();
  });
});
