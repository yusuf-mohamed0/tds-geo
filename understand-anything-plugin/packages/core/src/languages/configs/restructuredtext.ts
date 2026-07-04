// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const restructuredtextConfig = {
  id: "restructuredtext",
  displayName: "reStructuredText",
  extensions: [".rst"],
  concepts: ["headings", "directives", "roles", "cross-references", "toctree", "code blocks", "admonitions"],
  filePatterns: {
    entryPoints: ["index.rst"],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
