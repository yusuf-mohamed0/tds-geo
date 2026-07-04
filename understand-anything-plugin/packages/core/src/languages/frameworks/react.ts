// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { FrameworkConfig } from "../types.js";

export const reactConfig = {
  id: "react",
  displayName: "React",
  languages: ["typescript", "javascript"],
  detectionKeywords: ["react", "react-dom", "@types/react"],
  manifestFiles: ["package.json"],
  promptSnippetPath: "./frameworks/react.md",
  entryPoints: ["src/App.tsx", "src/App.jsx", "src/index.tsx", "src/main.tsx"],
  layerHints: {
    components: "ui",
    hooks: "service",
    pages: "ui",
    contexts: "service",
    utils: "utility",
    lib: "service",
  },
} satisfies FrameworkConfig;
