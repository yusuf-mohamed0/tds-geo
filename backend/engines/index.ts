export { orchestratorEngine } from './orchestrator';
export { researchEngine } from './research';
export { seoEngine } from './seo';
export { writingEngine } from './writing';
export { qualityEngine } from './quality';
export { memoryEngine } from './memory';
export { publisherEngine } from './publisher';
export { analyticsEngine } from './analytics';
export { learningEngine } from './learning';

import { orchestratorEngine } from './orchestrator';
import { researchEngine } from './research';
import { seoEngine } from './seo';
import { writingEngine } from './writing';
import { qualityEngine } from './quality';
import { memoryEngine } from './memory';
import { publisherEngine } from './publisher';
import { analyticsEngine } from './analytics';
import { learningEngine } from './learning';

export const engines = {
  orchestrator: orchestratorEngine,
  research: researchEngine,
  seo: seoEngine,
  writing: writingEngine,
  quality: qualityEngine,
  memory: memoryEngine,
  publisher: publisherEngine,
  analytics: analyticsEngine,
  learning: learningEngine,
};

export async function initializeEngines(pool: any): Promise<void> {
  const inits = Object.values(engines).map(e => e.initialize(pool));
  await Promise.all(inits);
}
