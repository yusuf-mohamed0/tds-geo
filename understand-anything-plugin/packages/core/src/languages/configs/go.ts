// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const goConfig = {
  id: "go",
  displayName: "Go",
  extensions: [".go"],
  treeSitter: {
    wasmPackage: "tree-sitter-go",
    wasmFile: "tree-sitter-go.wasm",
  },
  concepts: [
    "goroutines",
    "channels",
    "interfaces",
    "struct embedding",
    "error handling patterns",
    "defer/panic/recover",
    "slices",
    "pointers",
    "concurrency patterns",
  ],
  filePatterns: {
    entryPoints: ["main.go", "cmd/*/main.go"],
    barrels: [],
    tests: ["*_test.go"],
    config: ["go.mod", "go.sum"],
  },
} satisfies LanguageConfig;
