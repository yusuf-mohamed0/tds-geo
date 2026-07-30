import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Page, Card, Text, Banner, Spinner, BlockStack, InlineStack, Button, TextField } from '@shopify/polaris';
import { Store, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { upgradeDemo } from '../api/demo';

export default function DemoUpgradePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shopifyShop, setShopifyShop] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const clientId = user?.role === 'client' ? (user as any).clientId as string | undefined : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('No demo account found. Please sign in with your demo account.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await upgradeDemo(clientId, shopifyShop, shopifyToken);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || 'Failed to upgrade account.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Page title="Account Upgraded">
        <Card>
          <BlockStack gap="400" inlineAlign="center">
            <div style={{ textAlign: 'center', padding: 'var(--p-space-800) 0' }}>
              <Store size={48} style={{ color: '#22C55E' }} />
              <Text as="h2" variant="headingXl" fontWeight="bold">Welcome aboard!</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Your demo account has been upgraded to a full TDS Geo account connected to your Shopify store.
              </Text>
              <div style={{ marginTop: 'var(--p-space-400)' }}>
                <Button variant="primary" onClick={() => navigate('/admin')}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Upgrade from Demo"
      subtitle="Connect your Shopify store to unlock the full platform"
      backAction={{ content: 'Dashboard', url: '/admin' }}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError('')}>
            <p>{error}</p>
          </Banner>
        )}

        {!clientId && (
          <Banner tone="warning">
            <p>
              You must be signed in with a demo account to upgrade.{' '}
              <Link to="/login?redirect=/demo/upgrade">Sign in here</Link>.
            </p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <ArrowUpCircle size={24} color="#FCB900" />
              <Text as="h2" variant="headingMd">Shopify Connection</Text>
            </InlineStack>

            <Text as="p" variant="bodyMd" tone="subdued">
              Enter your Shopify store details to upgrade from the free trial. Once connected,
              all demo limits will be removed and you will have full access to article generation,
              analytics, and publishing.
            </Text>

            <form onSubmit={handleSubmit}>
              <BlockStack gap="300">
                <TextField
                  label="Shopify store domain"
                  value={shopifyShop}
                  onChange={setShopifyShop}
                  placeholder="mystore.myshopify.com"
                  autoComplete="off"
                  disabled={loading || !clientId}
                  helpText="Your Shopify store domain (e.g., mystore.myshopify.com)"
                />

                <TextField
                  label="Shopify API access token"
                  value={shopifyToken}
                  onChange={setShopifyToken}
                  placeholder="shpat_..."
                  autoComplete="off"
                  disabled={loading || !clientId}
                  helpText="Generate a private app access token or use the REST Admin API token"
                />

                <Button
                  variant="primary"
                  submit
                  loading={loading}
                  disabled={loading || !clientId || !shopifyShop || !shopifyToken}
                >
                  {loading ? 'Upgrading...' : 'Upgrade Account'}
                </Button>
              </BlockStack>
            </form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">What happens when you upgrade?</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              • All demo article and token limits are removed<br />
              • Your existing articles and data are preserved<br />
              • Full article generation, analytics, and publishing features are enabled<br />
              • Shopify connection allows publishing directly to your store<br />
              • You maintain the same dashboard and login
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
