import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ClientsPage from './pages/ClientsPage';
import ClientDashboard from './pages/ClientDashboard';
import ArticlesPage from './pages/ArticlesPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import GeoPage from './pages/GeoPage';
import CitationsPage from './pages/CitationsPage';
import CostsPage from './pages/CostsPage';
import QualityPage from './pages/QualityPage';
import NotFoundPage from './pages/NotFoundPage';
import ShopifyEmbeddedPage from './pages/ShopifyEmbeddedPage';

const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';

function isShopifyEmbedded(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('shop') && url.searchParams.has('host')) return true;
    if (window.top && window.top !== window.self) return true;
    if (url.searchParams.has('embedded')) return true;
    if (document.referrer.includes('myshopify.com') || document.referrer.includes('shopify.com')) return true;
  } catch {}
  return false;
}

function RootPage() {
  const [isShopify, setIsShopify] = useState<boolean | null>(null);
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    setHost(url.searchParams.get('host'));
    setIsShopify(isShopifyEmbedded());
  }, []);

  if (isShopify === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
      </div>
    );
  }

  if (isShopify && host && SHOPIFY_API_KEY) {
    return (
      <AppBridgeProvider config={{ apiKey: SHOPIFY_API_KEY, host }}>
        <ShopifyEmbeddedPage />
      </AppBridgeProvider>
    );
  }

  if (isShopify) return <ShopifyEmbeddedPage />;
  return <AdminDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<Layout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:clientId" element={<ClientDashboard />} />
            <Route path="articles" element={<ArticlesPage />} />
            <Route path="articles/:id" element={<ArticleDetailPage />} />
            <Route path="geo" element={<GeoPage />} />
            <Route path="citations" element={<CitationsPage />} />
            <Route path="costs" element={<CostsPage />} />
            <Route path="quality" element={<QualityPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route index element={<RootPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
