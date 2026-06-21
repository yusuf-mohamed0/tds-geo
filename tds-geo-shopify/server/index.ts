import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './utils/config';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    app: 'tds-geo-shopify',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use(express.static(path.join(__dirname, '../web/dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
});

app.listen(config.port, () => {
  console.log(`TDS Geo Shopify app running on port ${config.port}`);
});

export default app;
