// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const jsonConfigConfig = {
  id: "json",
  displayName: "JSON",
  extensions: [".json", ".jsonc"],
  concepts: ["objects", "arrays", "nesting", "schema references", "comments (JSONC)"],
  filePatterns: {
    entryPoints: ["package.json"],
    barrels: [],
    tests: [],
    config: ["tsconfig.json", "package.json", ".eslintrc.json"],
  },
} satisfies LanguageConfig;
