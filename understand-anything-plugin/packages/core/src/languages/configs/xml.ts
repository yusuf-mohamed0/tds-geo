// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { LanguageConfig } from "../types.js";

export const xmlConfig = {
  id: "xml",
  displayName: "XML",
  extensions: [".xml", ".xsl", ".xsd", ".svg", ".plist"],
  concepts: ["elements", "attributes", "namespaces", "DTD", "XPath", "XSLT", "schemas"],
  filePatterns: {
    entryPoints: [],
    barrels: [],
    tests: [],
    config: ["pom.xml", "web.xml", "AndroidManifest.xml"],
  },
} satisfies LanguageConfig;
