import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Card, Text, BlockStack } from '@shopify/polaris';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.dispatchEvent(new CustomEvent('tds:frontend-error', { detail: { error, info } }));
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 'var(--p-space-800)' }}>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd" tone="critical">Something went wrong</Text>
              <Text as="p" variant="bodyMd">{this.state.error.message}</Text>
              <pre style={{ fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
                {this.state.error.stack}
              </pre>
            </BlockStack>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
