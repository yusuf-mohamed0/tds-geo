// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const dockerfileConfig = {
  id: "dockerfile",
  displayName: "Dockerfile",
  extensions: [],
  filenames: ["Dockerfile", "Dockerfile.dev", "Dockerfile.prod", "Dockerfile.test"],
  concepts: ["multi-stage builds", "layers", "base images", "COPY/ADD", "EXPOSE", "ENTRYPOINT", "CMD", "ARG", "ENV"],
  filePatterns: {
    entryPoints: ["Dockerfile"],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
