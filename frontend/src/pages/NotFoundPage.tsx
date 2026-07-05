import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <h2 className="text-2xl font-bold">404</h2>
      <p className="text-brand-muted">Page not found</p>
      <Link to="/" className="btn-primary">Go Home</Link>
    </div>
  );
}
