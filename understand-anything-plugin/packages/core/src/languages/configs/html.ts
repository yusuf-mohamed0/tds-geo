// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const htmlConfig = {
  id: "html",
  displayName: "HTML",
  extensions: [".html", ".htm"],
  concepts: ["elements", "attributes", "semantic tags", "forms", "meta tags", "scripts", "stylesheets", "accessibility"],
  filePatterns: {
    entryPoints: ["index.html"],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
