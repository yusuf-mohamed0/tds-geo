import { connectorManager } from '../connector-manager';
import { shopifyConnector } from './shopify';
import { wordpressConnector } from './wordpress';
import { webflowConnector } from './webflow';
import { ghostConnector } from './ghost';
import { woocommerceConnector } from './woocommerce/index';

export function registerBuiltinConnectors(pool: any): void {
  shopifyConnector.setPool(pool);
  connectorManager.register('shopify', shopifyConnector as any, {
    provider: 'shopify',
    capabilities: [
      { name: 'publish', supported: true },
      { name: 'read', supported: true },
      { name: 'media', supported: true },
      { name: 'sync', supported: true },
    ],
  });

  connectorManager.register('wordpress', wordpressConnector as any, {
    provider: 'wordpress',
    capabilities: [
      { name: 'publish', supported: true },
      { name: 'read', supported: true },
      { name: 'media', supported: true },
      { name: 'sync', supported: true },
    ],
  });

  connectorManager.register('webflow', webflowConnector as any, {
    provider: 'webflow',
    capabilities: [
      { name: 'publish', supported: false },
      { name: 'read', supported: true },
      { name: 'media', supported: false },
      { name: 'sync', supported: false },
    ],
  });

  connectorManager.register('ghost', ghostConnector as any, {
    provider: 'ghost',
    capabilities: [
      { name: 'publish', supported: false },
      { name: 'read', supported: true },
      { name: 'media', supported: false },
      { name: 'sync', supported: false },
    ],
  });

  connectorManager.register('woocommerce', woocommerceConnector as any, {
    provider: 'woocommerce',
    capabilities: [
      { name: 'publish', supported: true },
      { name: 'read', supported: true },
      { name: 'media', supported: true },
      { name: 'sync', supported: true },
    ],
  });
}

export { shopifyConnector } from './shopify';
export { wordpressConnector } from './wordpress';
export { webflowConnector } from './webflow';
export { ghostConnector } from './ghost';
export { woocommerceConnector } from './woocommerce/index';
