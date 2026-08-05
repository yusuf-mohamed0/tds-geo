import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const { mockGetConnections, mockCreateWordPressClient, mockWpGet } = vi.hoisted(() => ({
  mockGetConnections: vi.fn(),
  mockCreateWordPressClient: vi.fn(),
  mockWpGet: vi.fn(),
}));

vi.mock('../../middleware/auth', () => {
  const mw = (req: any, _res: any, next: any) => { req.user = { userId: 'u1', role: 'admin', clientId: 'client-1' }; next(); };
  return { authenticate: mw, authorize: vi.fn(() => mw) };
});

vi.mock('../../middleware/rateLimiter', () => ({
  clientRateLimit: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../services/multiCmsPublisher', () => ({
  default: {
    initialize: vi.fn(),
    getConnections: mockGetConnections,
    createConnection: vi.fn(),
    getAvailableProviders: vi.fn(() => []),
    publishViaConnection: vi.fn(),
    publishToAll: vi.fn(),
    syncFromWordPress: vi.fn(),
    getAdapter: vi.fn(),
  },
}));

vi.mock('../../connectors/wordpress/client', () => ({
  createWordPressClient: mockCreateWordPressClient,
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createCmsRoutes } from '../../routes/cms';

describe('CMS routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWpGet.mockResolvedValue({ data: { success: true, data: { status: 'ok', version: '2.0.0', active_keys: 1 } } });
    mockCreateWordPressClient.mockReturnValue({ get: mockWpGet });
  });

  it('tests the selected stored WordPress connection config', async () => {
    mockGetConnections.mockResolvedValue([
      { id: 'stale', client_id: 'client-1', provider: 'wordpress', endpoint_url: 'https://stale.test', config: { apiKey: 'stale-key' }, is_active: true },
      { id: 'selected', client_id: 'client-1', provider: 'wordpress', endpoint_url: 'https://selected.test', config: { apiKey: 'selected-key' }, is_active: true },
    ]);

    const app = express();
    app.use(express.json());
    app.use('/api/cms', createCmsRoutes({ query: vi.fn() } as any));

    const res = await request(app).post('/api/cms/connections/selected/test').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { connected: true } });
    expect(mockCreateWordPressClient).toHaveBeenCalledWith('https://selected.test', 'selected-key');
    expect(mockCreateWordPressClient).not.toHaveBeenCalledWith('https://stale.test', 'stale-key');
  });
});
