// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const tomlConfig = {
  id: "toml",
  displayName: "TOML",
  extensions: [".toml"],
  concepts: ["tables", "inline tables", "arrays of tables", "key-value pairs", "dotted keys"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: ["Cargo.toml", "pyproject.toml", "netlify.toml"],
  },
} satisfies LanguageConfig;
