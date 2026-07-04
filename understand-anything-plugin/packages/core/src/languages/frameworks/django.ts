// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { FrameworkConfig } from "../types.js";

export const djangoConfig = {
  id: "django",
  displayName: "Django",
  languages: ["python"],
  detectionKeywords: [
    "django",
    "djangorestframework",
    "django-rest-framework",
    "django-cors-headers",
    "django-filter",
  ],
  manifestFiles: [
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "Pipfile",
  ],
  promptSnippetPath: "./frameworks/django.md",
  entryPoints: ["manage.py", "wsgi.py", "asgi.py"],
  layerHints: {
    views: "api",
    models: "data",
    serializers: "api",
    urls: "api",
    templates: "ui",
    migrations: "data",
    management: "config",
    signals: "service",
    admin: "config",
    forms: "ui",
    templatetags: "utility",
  },
} satisfies FrameworkConfig;
