// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const sqlConfig = {
  id: "sql",
  displayName: "SQL",
  extensions: [".sql"],
  concepts: ["tables", "columns", "indexes", "foreign keys", "views", "stored procedures", "triggers", "migrations"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
