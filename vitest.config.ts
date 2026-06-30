// ════════════════════════════════════════════════════════════════
// Vitest Configuration
//
// - Unit/service tests exclude the E2E pipeline integration tests
//   to avoid double execution (E2E tests run via npm run test:e2e)
// - All test files are automatically discovered by Vitest
// ════════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Files to exclude from the default test run
    // E2E pipeline integration tests run separately via npm run test:e2e
    exclude: [
      'backend/tests/integration/pipeline-e2e.test.ts',
      '**/node_modules/**',
      '**/dist/**',
      'understand-anything-plugin/**',
    ],
  },
});
