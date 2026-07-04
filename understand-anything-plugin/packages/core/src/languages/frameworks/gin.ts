// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { FrameworkConfig } from "../types.js";

export const ginConfig = {
  id: "gin",
  displayName: "Gin",
  languages: ["go"],
  detectionKeywords: ["github.com/gin-gonic/gin"],
  manifestFiles: ["go.mod"],
  promptSnippetPath: "./frameworks/gin.md",
  entryPoints: ["main.go", "cmd/server/main.go"],
  layerHints: {
    handlers: "api",
    routes: "api",
    models: "data",
    middleware: "middleware",
    services: "service",
    repository: "data",
  },
} satisfies FrameworkConfig;
