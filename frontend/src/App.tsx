import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link as ReactRouterLink, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DemoSignupPage from './pages/DemoSignupPage';
import DemoUpgradePage from './pages/DemoUpgradePage';
import AdminDashboard from './pages/AdminDashboard';
import ClientsPage from './pages/ClientsPage';
import ClientDashboard from './pages/ClientDashboard';
import ArticlesPage from './pages/ArticlesPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import GeoPage from './pages/GeoPage';
import CitationsPage from './pages/CitationsPage';
import CostsPage from './pages/CostsPage';
import QualityPage from './pages/QualityPage';
import KeywordResearchPage from './pages/KeywordResearchPage';
import BacklinksPage from './pages/BacklinksPage';
import NotFoundPage from './pages/NotFoundPage';
import ShopifyEmbeddedPage from './pages/ShopifyEmbeddedPage';
import { isEmbedded } from './lib/embedded';

const IS_EXTERNAL_LINK_REGEX = /^(?:[a-z][a-z\d+.-]*:|\/\/)/;

function Link({ children, url = '', external, ref: _, ...rest }: { children?: React.ReactNode; url?: string; external?: boolean; ref?: React.LegacyRef<HTMLAnchorElement> }) {
  if (external || IS_EXTERNAL_LINK_REGEX.test(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <ReactRouterLink to={url} {...rest}>
      {children}
    </ReactRouterLink>
  );
}

function RootPage() {
  const [isShopify, setIsShopify] = useState<boolean | null>(null);

  useEffect(() => {
    setIsShopify(isEmbedded());
  }, []);

  if (isShopify === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (isShopify) return <ShopifyEmbeddedPage />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider
        i18n={enTranslations}
        linkComponent={Link}
      >
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/demo/signup" element={<DemoSignupPage />} />
            <Route path="/demo/upgrade" element={<DemoUpgradePage />} />
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
              <Route path="keywords" element={<KeywordResearchPage />} />
              <Route path="backlinks" element={<BacklinksPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route index element={<RootPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
