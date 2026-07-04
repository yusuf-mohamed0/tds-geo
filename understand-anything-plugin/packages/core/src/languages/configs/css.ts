// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const cssConfig = {
  id: "css",
  displayName: "CSS",
  extensions: [".css", ".scss", ".less"],
  concepts: ["selectors", "properties", "media queries", "flexbox", "grid", "variables", "animations", "specificity"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
