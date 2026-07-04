// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const protobufConfig = {
  id: "protobuf",
  displayName: "Protocol Buffers",
  extensions: [".proto"],
  concepts: ["messages", "services", "enums", "oneof", "repeated fields", "maps", "packages", "imports"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: [],
  },
} satisfies LanguageConfig;
