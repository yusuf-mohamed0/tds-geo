import { useState, useEffect } from 'react';
import Logo from '../components/Logo';

export default function ShopifyEmbeddedPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">TDS Geo</h1>
          <p className="text-xs text-gray-500">AI Content Engine</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto mt-12 px-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="#FCB900" />
              <path d="M12 28V12H16.5L22 21.5L27.5 12H32V28H27.5V18.5L22.5 27.5H21.5L16.5 18.5V28H12Z" fill="#171414" />
            </svg>
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
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500 mt-1">Articles Generated</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-xs text-gray-500 mt-1">Status</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          TDS Geo v2.0.1 — <a href="https://traffic.16.192.29.174.nip.io/admin" className="text-gray-600 underline">Admin Dashboard</a>
        </p>
      </div>
    </div>
  );
}
