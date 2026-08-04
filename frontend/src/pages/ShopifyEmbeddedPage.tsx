import { useState, useEffect } from 'react';
import { Page, Card, Text, BlockStack, InlineStack, Banner, SkeletonPage, SkeletonBodyText } from '@shopify/polaris';
import { CheckCircle2 } from 'lucide-react';

interface ShopifyGlobal {
  idToken?: () => Promise<string>;
}

declare global {
  interface Window {
    shopify?: ShopifyGlobal;
  }
}

function getShopifyToken(): Promise<string | null> {
  const s = window.shopify;
  if (s?.idToken) return s.idToken().catch(() => null);
  const fromUrl = new URLSearchParams(window.location.search).get('id_token');
  if (fromUrl) return Promise.resolve(fromUrl);
  return new Promise(resolve => {
    const check = setInterval(async () => {
      const shop = window.shopify;
      if (shop?.idToken) {
        clearInterval(check);
        const t = await shop.idToken().catch(() => null);
        if (t) resolve(t);
      }
    }, 200);
    setTimeout(() => { clearInterval(check); resolve(null); }, 8000);
  });
}

interface EmbeddedStats {
  total: number;
  published: number;
  avgSeo: number | null;
}

export default function ShopifyEmbeddedPage() {
  const [stats, setStats] = useState<EmbeddedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getShopifyToken().then(async (token) => {
      if (!active) return;
      if (!token) {
        setError('Could not verify your store session. Reinstall the app from the Shopify admin to continue.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/embedded/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load stats');
        const data = await res.json();
        const s = data.articles || {};
        if (active) {
          setStats({
            total: s.total || 0,
            published: s.published || 0,
            avgSeo: s.avg_seo_score != null ? Math.round(Number(s.avg_seo_score)) : null,
          });
        }
      } catch {
        if (active) setError('Failed to load your store stats.');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <SkeletonPage title="TDS Geo">
        <SkeletonBodyText lines={4} />
        <div style={{ paddingTop: 'var(--p-space-400)' }} />
        <SkeletonBodyText lines={6} />
      </SkeletonPage>
    );
  }

  if (error) {
    return (
      <Page title="TDS Geo" subtitle="AI Content Engine">
        <Banner tone="critical" title="Could not load your dashboard">
          <p>{error}</p>
        </Banner>
      </Page>
    );
  }

  const pending = stats ? stats.total - stats.published : 0;

  return (
    <Page title="TDS Geo" subtitle="AI Content Engine">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200" inlineAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <CheckCircle2 size={20} style={{ color: 'var(--p-color-icon-success)' }} />
              <Text as="h2" variant="headingMd">Connected</Text>
            </InlineStack>
            <div style={{ textAlign: 'center' }}>
              <Text as="p" variant="bodyMd" tone="subdued">
                TDS Geo is active on your store. AI-powered content generation, SEO optimization, and GEO analysis are running.
              </Text>
            </div>
          </BlockStack>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <BlockStack gap="100" inlineAlign="center">
              <Text as="p" variant="heading2xl" fontWeight="bold">{stats?.total ?? 0}</Text>
              <Text as="p" variant="bodySm" tone="subdued">Articles Generated</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100" inlineAlign="center">
              <Text as="p" variant="heading2xl" fontWeight="bold">{stats?.avgSeo != null ? stats.avgSeo : '—'}</Text>
              <Text as="p" variant="bodySm" tone="subdued">GEO Score</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100" inlineAlign="center">
              <Text as="p" variant="heading2xl" fontWeight="bold">{stats?.published ?? 0}</Text>
              <Text as="p" variant="bodySm" tone="subdued">Published</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100" inlineAlign="center">
              <Text as="p" variant="heading2xl" fontWeight="bold">{pending}</Text>
              <Text as="p" variant="bodySm" tone="subdued">Pending</Text>
            </BlockStack>
          </Card>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Text as="p" variant="bodyXs" tone="subdued">TDS Geo v2.0.1</Text>
        </div>
      </BlockStack>
    </Page>
  );
}
