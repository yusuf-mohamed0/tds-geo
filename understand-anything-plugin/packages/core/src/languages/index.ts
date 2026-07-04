// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// Types
export type {
  LanguageConfig,
  TreeSitterConfig,
  FilePatternConfig,
  FrameworkConfig,
} from "./types.js";

export {
  LanguageConfigSchema,
  TreeSitterConfigSchema,
  FilePatternConfigSchema,
  FrameworkConfigSchema,
} from "./types.js";

// Registries
export { LanguageRegistry } from "./language-registry.js";
export { FrameworkRegistry } from "./framework-registry.js";

// Built-in configs
export { builtinLanguageConfigs } from "./configs/index.js";
export { builtinFrameworkConfigs } from "./frameworks/index.js";
