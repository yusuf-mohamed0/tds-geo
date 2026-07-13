import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/admin" replace />;
  }

  return (
    <div className="h-screen flex bg-brand-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className="border-t border-brand-border px-6 py-2 text-xs text-brand-muted flex items-center justify-between shrink-0 bg-white">
          <span>TDS Geo</span>
          <div className="flex gap-4">
            <a href="/documentation" className="hover:text-brand-accent transition-colors" target="_blank" rel="noopener noreferrer">Docs</a>
            <a href="/tutorial" className="hover:text-brand-accent transition-colors" target="_blank" rel="noopener noreferrer">Tutorial</a>
            <a href="/faq" className="hover:text-brand-accent transition-colors" target="_blank" rel="noopener noreferrer">FAQ</a>
            <a href="/changelog" className="hover:text-brand-accent transition-colors" target="_blank" rel="noopener noreferrer">Changelog</a>
            <a href="/privacy" className="hover:text-brand-accent transition-colors" target="_blank" rel="noopener noreferrer">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
