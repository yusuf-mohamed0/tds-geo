// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const githubActionsConfig = {
  id: "github-actions",
  displayName: "GitHub Actions",
  extensions: [],
  concepts: ["workflows", "jobs", "steps", "actions", "triggers", "secrets", "matrix strategy", "artifacts"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: [".github/workflows/*.yml"],
  },
} satisfies LanguageConfig;
