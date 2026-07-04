// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const swiftConfig = {
  id: "swift",
  displayName: "Swift",
  extensions: [".swift"],
  concepts: [
    "optionals",
    "protocols",
    "extensions",
    "generics",
    "closures",
    "property wrappers",
    "result builders",
    "actors",
    "structured concurrency",
    "value types vs reference types",
  ],
  filePatterns: {
    entryPoints: ["Sources/*/main.swift", "App.swift", "AppDelegate.swift"],
    barrels: [],
    tests: ["*Tests.swift", "Tests/**/*.swift"],
    config: ["Package.swift"],
  },
} satisfies LanguageConfig;
