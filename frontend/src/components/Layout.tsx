import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from './ErrorBoundary';
import { isEmbedded } from '../lib/embedded';

export default function Layout() {
  const { isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-bg">
        <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent" />
      </div>
    );
  }

  if (isEmbedded()) {
    // Embedded users authenticate through their Shopify idToken, not the JWT
    // login. The embedded dashboard lives at the app root, so send them there
    // instead of the JWT login — which is a dead end inside the Shopify admin.
    return <Navigate to="/" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/admin" replace />;
  }

  return (
    <div className="h-screen flex bg-brand-bg">
      {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className="border-t border-brand-border px-4 py-3 text-xs text-brand-muted flex flex-col items-start gap-2 shrink-0 bg-white sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-2">
          <span>Kivo</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a href="/documentation" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Docs</a>
            <a href="/tutorial" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Tutorial</a>
            <a href="/faq" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">FAQ</a>
            <a href="/changelog" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Changelog</a>
            <a href="/privacy" className="inline-block transition-all hover:-translate-y-0.5 hover:text-brand-accent" target="_blank" rel="noopener noreferrer">Privacy</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
