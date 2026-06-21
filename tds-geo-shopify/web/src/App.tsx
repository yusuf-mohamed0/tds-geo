import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

type Page = 'dashboard' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  const shop = new URLSearchParams(window.location.search).get('shop') || '';

  return (
    <div className="tds-app">
      <nav className="tds-nav">
        <div className="tds-nav-logo">
          <img src="/assets/logos/tds-geo-white.png" alt="TDS Geo" />
        </div>
        <div className="tds-nav-title">TDS Geo</div>
        <div className="tds-nav-items">
          <button
            className={`tds-nav-item ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => setPage('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`tds-nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      <main className="tds-main">
        {page === 'dashboard' && <Dashboard shop={shop} token={token} />}
        {page === 'settings' && <Settings shop={shop} token={token} onTokenChange={setToken} />}
      </main>
    </div>
  );
}
