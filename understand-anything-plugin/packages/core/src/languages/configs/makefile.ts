// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const makefileConfig = {
  id: "makefile",
  displayName: "Makefile",
  extensions: [".mk"],
  filenames: ["Makefile", "GNUmakefile", "makefile"],
  concepts: ["targets", "dependencies", "recipes", "variables", "pattern rules", "phony targets", "includes"],
  filePatterns: {
    entryPoints: ["Makefile"],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
