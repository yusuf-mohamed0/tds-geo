// ══════════════════════════════════════════════════════════════════
// Department Managers — Barrel Exports
// ══════════════════════════════════════════════════════════════════

export { DepartmentManager } from './DepartmentManager';
export { AIContentManager } from './AIContentManager';
export { SeoManager } from './SeoManager';
export { ShopifyPublishingManager } from './ShopifyPublishingManager';
export { DataAnalyticsManager } from './DataAnalyticsManager';
export { ClientOperationsManager } from './ClientOperationsManager';
export { InfrastructureManager } from './InfrastructureManager';
export { CostOptimizationManager } from './CostOptimizationManager';
export { QualityAssuranceManager } from './QualityAssuranceManager';
export { OdooManager } from './OdooManager';

export * from './types';

// Default singleton instances
export { default as aiContentManager } from './AIContentManager';
export { default as seoManager } from './SeoManager';
export { default as shopifyPublishingManager } from './ShopifyPublishingManager';
export { default as dataAnalyticsManager } from './DataAnalyticsManager';
export { default as clientOperationsManager } from './ClientOperationsManager';
export { default as infrastructureManager } from './InfrastructureManager';
export { default as costOptimizationManager } from './CostOptimizationManager';
export { default as qualityAssuranceManager } from './QualityAssuranceManager';
export { default as odooManager } from './OdooManager';
