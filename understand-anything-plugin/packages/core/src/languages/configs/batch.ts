// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const batchConfig = {
  id: "batch",
  displayName: "Batch Script",
  extensions: [".bat", ".cmd"],
  concepts: ["commands", "variables", "labels", "goto", "call", "echo", "set", "for loops", "if conditions"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
