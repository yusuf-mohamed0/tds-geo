// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const csvConfig = {
  id: "csv",
  displayName: "CSV",
  extensions: [".csv", ".tsv"],
  concepts: ["headers", "rows", "delimiters", "quoting", "escaping"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
