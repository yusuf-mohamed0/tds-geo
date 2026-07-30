import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function getShopifyToken(): Promise<string | null> {
  const s = (window as any).shopify;
  if (s?.idToken) return s.idToken().catch(() => null);
  const fromUrl = new URLSearchParams(window.location.search).get('id_token');
  if (fromUrl) return Promise.resolve(fromUrl);
  return new Promise(resolve => {
    const check = setInterval(async () => {
      const shop = (window as any).shopify;
      if (shop?.idToken) {
        clearInterval(check);
        const t = await shop.idToken().catch(() => null);
        if (t) resolve(t);
      }
    }, 200);
    setTimeout(() => { clearInterval(check); resolve(null); }, 8000);
  });
}

export default function ShopifyEmbeddedPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ total: number; published: number; avgSeo: number | null } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    getShopifyToken().then(async token => {
      if (!token) return;
      try {
        const res = await fetch('/api/embedded/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const s = data.articles || {};
        setStats({
          total: s.total || 0,
          published: s.published || 0,
          avgSeo: s.avg_seo_score != null ? Math.round(Number(s.avg_seo_score)) : null
        });
      } catch {}
    });
  }, []);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <img src="/assets/Black Swype.png" alt="Swype" className="h-7 w-auto object-contain" />
        <div>
          <h1 className="text-base font-semibold text-gray-900">TDS Geo</h1>
          <p className="text-xs text-gray-500">AI Content Engine</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto mt-8 max-w-lg px-4 sm:mt-12 sm:px-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto p-3">
            <img src="/assets/Black Swype.png" alt="Swype" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-5">Connected</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            TDS Geo is active on your store. AI-powered content generation, SEO optimization, and GEO analysis are running.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats?.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Articles Generated</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats?.avgSeo != null ? stats.avgSeo : '—'}</p>
            <p className="text-xs text-gray-500 mt-1">GEO Score</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats?.published ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Published</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats != null ? (stats.total - stats.published) : '—'}</p>
            <p className="text-xs text-gray-500 mt-1">Pending</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          TDS Geo v2.0.1 — <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              navigate('/admin');
            }}
            className="text-gray-600 underline"
          >Admin Dashboard</a>
        </p>
      </div>
    </div>
  );
}
