// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ════════════════════════════════════════════════════════════════
// Vitest E2E Configuration
//
// Dedicated config for E2E pipeline integration tests.
// Excludes all unit/service tests to keep runs focused and fast.
// ════════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/tests/integration/pipeline-e2e.test.ts'],
  },
});
