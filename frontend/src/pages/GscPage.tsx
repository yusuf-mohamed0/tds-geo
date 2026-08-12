import { Page, Card, Text, Badge, BlockStack, InlineStack } from '@shopify/polaris';
import { Lock, Clock } from 'lucide-react';
import { KIVO_BRAND } from '../brand/kivo';

export default function GscPage() {
  return (
    <Page title="Google Search Console" subtitle="Search analytics & performance">
      <Card>
        <div style={{ textAlign: 'center', padding: 'var(--p-space-1200)' }}>
          <div style={{ display: 'inline-flex', padding: 'var(--p-space-400)', borderRadius: '50%', background: 'rgba(252, 185, 0, 0.12)', marginBottom: 'var(--p-space-400)' }}>
            <Lock size={44} style={{ color: KIVO_BRAND.colors.gold }} />
          </div>
          <BlockStack gap="300" inlineAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Badge tone="attention">Coming soon</Badge>
              <Badge tone="info">Locked</Badge>
            </InlineStack>
            <Text as="h2" variant="headingLg">Google Search Console is being connected</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              This section will unlock after the Google OAuth credentials are added. The rest of {KIVO_BRAND.os} is ready to use.
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Clock size={16} style={{ opacity: 0.55 }} />
              <Text as="span" variant="bodySm" tone="subdued">Setup pending: Google OAuth Client Secret</Text>
            </InlineStack>
          </BlockStack>
        </div>
      </Card>
    </Page>
  );
}
