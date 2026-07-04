// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export function createSwaggerRoutes(): Router {
  const router = Router();

  const specPath = path.resolve(__dirname, '../public/swagger.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(spec);
  });

  router.get('/', (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${spec.info.title}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
      deepLinking: true,
      defaultModelsExpandDepth: -1,
    });
  </script>
</body>
</html>`);
  });

  return router;
}
