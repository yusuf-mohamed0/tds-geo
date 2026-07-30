import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Card, CardHeader, CardBody, CardFooter } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies default and custom class names', () => {
    render(<Card className="custom">Content</Card>);
    const div = screen.getByText('Content');
    expect(div.className).toContain('card');
    expect(div.className).toContain('custom');
  });

  it('applies inline style', () => {
    render(<Card style={{ marginTop: 10 }}>Styled</Card>);
    expect(screen.getByText('Styled')).toHaveStyle({ marginTop: '10px' });
  });
});

describe('CardHeader', () => {
  it('renders children inside h3', () => {
    render(<CardHeader>Title</CardHeader>);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Title');
  });

  it('renders action element when provided', () => {
    render(<CardHeader action={<button>Action</button>}>Title</CardHeader>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('does not render action when not provided', () => {
    const { container } = render(<CardHeader>Title</CardHeader>);
    expect(container.querySelector('.card-actions')).not.toBeInTheDocument();
  });
});

describe('CardBody', () => {
  it('renders children', () => {
    render(<CardBody>Body Content</CardBody>);
    expect(screen.getByText('Body Content')).toBeInTheDocument();
  });

  it('applies no-padding class when padding is false', () => {
    const { container } = render(<CardBody padding={false}>No Padding</CardBody>);
    expect(container.querySelector('.card-body-no-padding')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});
