import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'ai_seo_auth_token';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

/**
 * Detect if the app is running inside the Shopify admin iframe
 * by checking for the shopify global variable (set by App Bridge script).
 */
function isShopifyEmbedded(): boolean {
  return !!(window as any).shopify;
}

// Attach auth token to requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // If embedded, the ShopifyAppProvider handles OAuth redirect
      // Otherwise, redirect to login
      if (isShopifyEmbedded()) {
        // In embedded mode, the OAuth flow will be initiated by ShopifyAppProvider
        // Just clear the token and let the app re-initialize
        window.location.reload();
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ──────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),

  register: (data: { email: string; password: string; name: string; role?: string }) =>
    api.post('/auth/register', data).then(r => r.data),

  me: () => api.get('/auth/me').then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data),

  getUsers: () => api.get('/auth/users').then(r => r.data),

  updateUser: (id: string, data: any) =>
    api.put(`/auth/users/${id}`, data).then(r => r.data),

  deleteUser: (id: string) =>
    api.delete(`/auth/users/${id}`).then(r => r.data),

  toggleUser: (id: string) =>
    api.patch(`/auth/users/${id}/toggle`).then(r => r.data),

  resetPassword: (id: string, newPassword: string) =>
    api.post(`/auth/users/${id}/reset-password`, { newPassword }).then(r => r.data),
};

// ─── Clients API ───────────────────────────────

export const clientsApi = {
  list: () => api.get('/clients').then(r => r.data),

  get: (id: string) => api.get(`/clients/${id}`).then(r => r.data),

  create: (data: any) => api.post('/clients', data).then(r => r.data),

  update: (id: string, data: any) => api.put(`/clients/${id}`, data).then(r => r.data),

  delete: (id: string) => api.delete(`/clients/${id}`).then(r => r.data),

  testShopify: (id: string) => api.post(`/clients/${id}/test-shopify`).then(r => r.data),

  discoverKeywords: (clientId: string, data: any) =>
    api.post(`/clients/${clientId}/keywords/discover`, data).then(r => r.data),
};

// ─── Articles API ──────────────────────────────

export const articlesApi = {
  list: (params?: { status?: string; clientId?: string; limit?: number; offset?: number }) =>
    api.get('/articles', { params }).then(r => r.data),

  get: (id: string) => api.get(`/articles/${id}`).then(r => r.data),

  getPreview: (id: string) => api.get(`/articles/${id}/preview`).then(r => r.data),

  getSeo: (id: string) => api.get(`/articles/${id}/seo`).then(r => r.data),

  generate: (data: { keyword: string; publish?: boolean; blogId?: number; tone?: string; clientId?: string }) =>
    api.post('/articles/generate', data).then(r => r.data),

  update: (id: string, data: any) => api.put(`/articles/${id}`, data).then(r => r.data),

  approve: (id: string) => api.post(`/articles/${id}/approve`).then(r => r.data),

  reject: (id: string, reason?: string) => api.post(`/articles/${id}/reject`, { reason }).then(r => r.data),

  regenerate: (id: string) => api.post(`/articles/${id}/regenerate`).then(r => r.data),

  publish: (id: string, blogId: number) => api.post(`/articles/${id}/publish`, { blogId }).then(r => r.data),
};

// ─── Webhooks API ──────────────────────────────

export const webhooksApi = {
  list: (clientId: string) => api.get(`/clients/${clientId}/webhooks`).then(r => r.data),

  get: (clientId: string, webhookId: string) =>
    api.get(`/clients/${clientId}/webhooks/${webhookId}`).then(r => r.data),

  create: (clientId: string, data: any) =>
    api.post(`/clients/${clientId}/webhooks`, data).then(r => r.data),

  update: (clientId: string, webhookId: string, data: any) =>
    api.put(`/clients/${clientId}/webhooks/${webhookId}`, data).then(r => r.data),

  delete: (clientId: string, webhookId: string) =>
    api.delete(`/clients/${clientId}/webhooks/${webhookId}`).then(r => r.data),

  test: (clientId: string, webhookId: string) =>
    api.post(`/clients/${clientId}/webhooks/${webhookId}/test`).then(r => r.data),

  deliveries: (clientId: string, webhookId: string) =>
    api.get(`/clients/${clientId}/webhooks/${webhookId}/deliveries`).then(r => r.data),
};

// ─── Analytics API ─────────────────────────────

export const analyticsApi = {
  overview: (clientId: string) => api.get(`/analytics/${clientId}/overview`).then(r => r.data),

  logs: (clientId: string, params?: { level?: string; action?: string; limit?: number }) =>
    api.get(`/analytics/${clientId}/logs`, { params }).then(r => r.data),

  history: (clientId: string) => api.get(`/analytics/${clientId}/history`).then(r => r.data),

  costs: (clientId: string, period?: string) =>
    api.get(`/analytics/${clientId}/costs`, { params: { period } }).then(r => r.data),

  seo: (clientId: string, days?: number) =>
    api.get(`/analytics/${clientId}/seo`, { params: { days } }).then(r => r.data),

  keywordAnalytics: (clientId: string) =>
    api.get(`/analytics/${clientId}/keyword-analytics`).then(r => r.data),

  jobs: (clientId: string) => api.get(`/analytics/${clientId}/jobs`).then(r => r.data),

  apiUsage: (clientId: string, days?: number) =>
    api.get(`/analytics/${clientId}/api-usage`, { params: { days } }).then(r => r.data),
};

// ═══ Platform Expansion APIs ═══════════════════

export const apiKeysApi = {
  list: (clientId: string) => api.get(`/clients/${clientId}/api-keys`).then(r => r.data),
  create: (clientId: string, data: any) => api.post(`/clients/${clientId}/api-keys`, data).then(r => r.data),
  delete: (clientId: string, keyId: string) => api.delete(`/clients/${clientId}/api-keys/${keyId}`).then(r => r.data),
  toggle: (clientId: string, keyId: string) => api.patch(`/clients/${clientId}/api-keys/${keyId}/toggle`).then(r => r.data),
};

export const pluginsApi = {
  list: () => api.get('/plugins').then(r => r.data),
  getClientPlugins: (clientId: string) => api.get(`/plugins/clients/${clientId}`).then(r => r.data),
  register: (clientId: string, pluginSlug: string, config?: any) =>
    api.post(`/plugins/clients/${clientId}/register`, { pluginSlug, config }).then(r => r.data),
  toggle: (clientId: string, instanceId: string) =>
    api.patch(`/plugins/clients/${clientId}/instances/${instanceId}/toggle`).then(r => r.data),
  updateConfig: (clientId: string, instanceId: string, config: any) =>
    api.put(`/plugins/clients/${clientId}/instances/${instanceId}/config`, { config }).then(r => r.data),
  executeHook: (hookName: string, clientId?: string, data?: any) =>
    api.post(`/plugins/hooks/${hookName}/execute`, { clientId, data }).then(r => r.data),
};

export const promptsApi = {
  list: (params?: { category?: string; active?: boolean }) => api.get('/prompts', { params }).then(r => r.data),
  get: (id: string) => api.get(`/prompts/${id}`).then(r => r.data),
  create: (data: any) => api.post('/prompts', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/prompts/${id}`, data).then(r => r.data),
  rollback: (id: string, version: number) => api.post(`/prompts/${id}/rollback/${version}`).then(r => r.data),
  performance: (id: string) => api.get(`/prompts/${id}/performance`).then(r => r.data),
};

export const chatApi = {
  listSessions: () => api.get('/chat/sessions').then(r => r.data),
  createSession: (title?: string) => api.post('/chat/sessions', { title }).then(r => r.data),
  getSession: (id: string) => api.get(`/chat/sessions/${id}`).then(r => r.data),
  sendMessage: (sessionId: string, content: string) =>
    api.post(`/chat/sessions/${sessionId}/messages`, { content }).then(r => r.data),
  deleteSession: (id: string) => api.delete(`/chat/sessions/${id}`).then(r => r.data),
  quickCommand: (command: string) => api.post('/chat/command', { command }).then(r => r.data),

  bulkDeleteOldSessions: (days: number) =>
    api.delete(`/chat/sessions/bulk/old?days=${days}`).then(r => r.data),

  deleteUserSessions: (userId: string) =>
    api.delete(`/chat/sessions/user/${userId}`).then(r => r.data),
};

export const configApi = {
  list: (category?: string) => api.get('/config', { params: { category } }).then(r => r.data),
  get: (key: string) => api.get(`/config/${key}`).then(r => r.data),
  update: (key: string, value: any, description?: string) =>
    api.put(`/config/${key}`, { value, description }).then(r => r.data),
  create: (data: any) => api.post('/config', data).then(r => r.data),
  categories: () => api.get('/config/categories/list').then(r => r.data),
  public: () => api.get('/config/public').then(r => r.data),
};

export const improvementsApi = {
  list: () => api.get('/improvements').then(r => r.data),
  analyze: () => api.post('/improvements/analyze').then(r => r.data),
};

// ─── Admin API ─────────────────────────────────

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard').then(r => r.data),

  errors: () => api.get('/admin/errors').then(r => r.data),

  health: () => api.get('/admin/health').then(r => r.data),

  config: () => api.get('/admin/config').then(r => r.data),

  systemLogs: () => api.get('/admin/system-logs').then(r => r.data),

  notify: (message: string, level?: string) =>
    api.post('/admin/notify', { message, level }).then(r => r.data),

  recentSignups: (limit?: number) =>
    api.get('/admin/recent-signups', { params: { limit } }).then(r => r.data),
};

// ─── SEO API ───────────────────────────────────

export const seoApi = {
  analyze: (content: string, keyword: string) =>
    api.post('/seo/analyze', { content, keyword }).then(r => r.data),
};

// ═══ Enterprise Editorial Workflow API ════════

export const editorialApi = {
  getAssignments: () => api.get('/editorial/assignments').then(r => r.data),
  createAssignment: (data: any) => api.post('/editorial/assignments', data).then(r => r.data),
  submitReview: (data: any) => api.post('/editorial/reviews', data).then(r => r.data),
  getComments: (articleId: string) => api.get(`/editorial/articles/${articleId}/comments`).then(r => r.data),
  addComment: (articleId: string, data: any) => api.post(`/editorial/articles/${articleId}/comments`, data).then(r => r.data),
  resolveComment: (commentId: string) => api.patch(`/editorial/comments/${commentId}/resolve`).then(r => r.data),
  acquireLock: (articleId: string, ttlSeconds?: number) => api.post(`/editorial/articles/${articleId}/lock`, { ttlSeconds }).then(r => r.data),
  releaseLock: (articleId: string) => api.delete(`/editorial/articles/${articleId}/lock`).then(r => r.data),
  getVersions: (articleId: string) => api.get(`/editorial/articles/${articleId}/versions`).then(r => r.data),
  restoreVersion: (articleId: string, versionNumber: number) => api.post(`/editorial/articles/${articleId}/restore/${versionNumber}`).then(r => r.data),
  getCalendar: (clientId?: string, status?: string) => api.get('/editorial/calendar', { params: { clientId, status } }).then(r => r.data),
  createCalendarEntry: (data: any) => api.post('/editorial/calendar', data).then(r => r.data),
  advanceStatus: (articleId: string, status: string) => api.patch(`/editorial/articles/${articleId}/status`, { status }).then(r => r.data),
};

// ═══ Enterprise Fact Check API ═══════════════

export const factCheckApi = {
  verifyArticle: (articleId: string) => api.post(`/fact-check/verify/${articleId}`).then(r => r.data),
  extractClaims: (content: string, clientId: string) => api.post('/fact-check/extract-claims', { content, client_id: clientId }).then(r => r.data),
  verifyClaim: (claim: string, context?: string) => api.post('/fact-check/verify-claim', { claim, context }).then(r => r.data),
  getFactChecks: (articleId: string) => api.get(`/fact-check/articles/${articleId}/fact-checks`).then(r => r.data),
  getTrustedSources: (clientId: string) => api.get('/fact-check/trusted-sources', { params: { clientId } }).then(r => r.data),
  addTrustedSource: (data: any) => api.post('/fact-check/trusted-sources', data).then(r => r.data),
  getHighRiskTopics: (clientId: string) => api.get('/fact-check/high-risk-topics', { params: { clientId } }).then(r => r.data),
  addHighRiskTopic: (data: any) => api.post('/fact-check/high-risk-topics', data).then(r => r.data),
};

// ═══ Enterprise Brand Voice API ═══════════════

export const brandVoiceApi = {
  getProfile: (clientId: string) => api.get(`/brand-voice/${clientId}`).then(r => r.data),
  updateProfile: (clientId: string, data: any) => api.put(`/brand-voice/${clientId}`, data).then(r => r.data),
  getGuidance: (clientId: string) => api.get(`/brand-voice/${clientId}/guidance`).then(r => r.data),
  checkConsistency: (clientId: string, content: string) => api.post(`/brand-voice/${clientId}/consistency-check`, { content }).then(r => r.data),
  getFingerprint: (clientId: string) => api.get(`/brand-voice/${clientId}/fingerprint`).then(r => r.data),
  storeEmbedding: (clientId: string, contentSnippet: string, sourceType: string) =>
    api.post(`/brand-voice/${clientId}/embeddings`, { content_snippet: contentSnippet, source_type: sourceType }).then(r => r.data),
};

// ═══ Enterprise Multi-CMS API ═════════════════

export const cmsApi = {
  getConnections: (clientId: string) => api.get(`/cms/connections/${clientId}`).then(r => r.data),
  createConnection: (data: any) => api.post('/cms/connections', data).then(r => r.data),
  getProviders: () => api.get('/cms/providers').then(r => r.data),
  publishViaConnection: (articleId: string, connectionId: string, clientId: string) =>
    api.post('/cms/publish', { article_id: articleId, connection_id: connectionId, client_id: clientId }).then(r => r.data),
  publishToAll: (articleId: string, clientId: string) =>
    api.post('/cms/publish-all', { article_id: articleId, client_id: clientId }).then(r => r.data),
  testConnection: (connectionId: string, clientId: string) =>
    api.post(`/cms/connections/${connectionId}/test`, { client_id: clientId }).then(r => r.data),
};

// ═══ Enterprise Cost Optimization API ═════════

export const costApi = {
  getUsage: (clientId: string) => api.get(`/cost/usage/${clientId}`).then(r => r.data),
  getBudget: (clientId: string) => api.get(`/cost/budget/${clientId}`).then(r => r.data),
  getReport: (clientId: string, days?: number) => api.get(`/cost/report/${clientId}`, { params: { days } }).then(r => r.data),
  routeTask: (clientId: string, taskRequirements: any) => api.post('/cost/route', { client_id: clientId, task_requirements: taskRequirements }).then(r => r.data),
  setRoutingConfig: (data: any) => api.post('/cost/route-config', data).then(r => r.data),
};

// ═══ Enterprise Observability API ═════════════

export const observabilityApi = {
  getDashboard: (clientId?: string) => api.get('/observability/dashboard', { params: { clientId } }).then(r => r.data),
  getLatency: (hours?: number) => api.get('/observability/latency', { params: { hours } }).then(r => r.data),
  getTrace: (traceId: string) => api.get(`/observability/traces/${traceId}`).then(r => r.data),
  getAlerts: (severity?: string) => api.get('/observability/alerts', { params: { severity } }).then(r => r.data),
  acknowledgeAlert: (alertId: string) => api.patch(`/observability/alerts/${alertId}/acknowledge`).then(r => r.data),
  resolveAlert: (alertId: string) => api.patch(`/observability/alerts/${alertId}/resolve`).then(r => r.data),
  getHealth: () => api.get('/observability/health').then(r => r.data),
};

// ═══ Enterprise Security API ══════════════════

export const securityApi = {
  getAuditLog: (params?: { clientId?: string; userId?: string; action?: string; resourceType?: string; severity?: string; limit?: number; offset?: number }) =>
    api.get('/security/audit-log', { params }).then(r => r.data),
  getPermissions: (role?: string) => api.get('/security/permissions', { params: { role } }).then(r => r.data),
  setPermission: (data: any) => api.post('/security/permissions', data).then(r => r.data),
  getRateLimit: (clientId: string) => api.get(`/security/rate-limit/${clientId}`).then(r => r.data),
  setRateLimit: (clientId: string, data: any) => api.put(`/security/rate-limit/${clientId}`, data).then(r => r.data),
  checkPermission: (resource: string, action: string) => api.post('/security/check-permission', { resource, action }).then(r => r.data),
};

// ═══ Enterprise Content Intelligence API ══════

export const contentIntelApi = {
  detectCannibalization: (articleId: string, clientId: string) =>
    api.post('/content-intel/cannibalization/detect', { article_id: articleId, client_id: clientId }).then(r => r.data),
  getTopicSaturation: (clientId: string, topic: string) =>
    api.get(`/content-intel/saturation/${clientId}/${encodeURIComponent(topic)}`).then(r => r.data),
  getSaturatedTopics: (clientId: string) => api.get(`/content-intel/saturated/${clientId}`).then(r => r.data),
  getKnowledgeGraph: (clientId: string) => api.get(`/content-intel/knowledge-graph/${clientId}`).then(r => r.data),
  extractEntities: (content: string, clientId: string) => api.post('/content-intel/knowledge-graph/extract', { content, client_id: clientId }).then(r => r.data),
  buildContentGraph: (articleId: string) => api.post(`/content-intel/knowledge-graph/build/${articleId}`).then(r => r.data),
  getLinkingOpportunities: (clientId: string, content: string, excludeArticleId?: string) =>
    api.post('/content-intel/linking-opportunities', { client_id: clientId, content, exclude_article_id: excludeArticleId }).then(r => r.data),
};

// ═══ Enterprise AI Evaluation API ═════════════

export const evaluationApi = {
  evaluateContent: (content: string, keyword: string) => api.post('/evaluation/evaluate-content', { content, keyword }).then(r => r.data),
  generateQualityReport: (content: string, keyword: string, brandVoiceText?: string) =>
    api.post('/evaluation/quality-report', { content, keyword, brand_voice_text: brandVoiceText }).then(r => r.data),
  getEvaluationHistory: (targetType: string, targetId: string) =>
    api.get(`/evaluation/history/${targetType}/${targetId}`).then(r => r.data),
  createBenchmark: (data: any) => api.post('/evaluation/benchmarks', data).then(r => r.data),
  addTestCase: (datasetId: string, data: any) => api.post(`/evaluation/benchmarks/${datasetId}/test-cases`, data).then(r => r.data),
  runBenchmark: (datasetId: string) => api.post(`/evaluation/benchmarks/${datasetId}/run`).then(r => r.data),
  createAbTest: (data: any) => api.post('/evaluation/ab-tests', data).then(r => r.data),
  completeAbTest: (testId: string, winner: string, metrics: any) =>
    api.patch(`/evaluation/ab-tests/${testId}/complete`, { winner, metrics }).then(r => r.data),
};

// ═══ Enterprise Pexels API ════════════════════

export const pexelsApi = {
  findArticleImages: (clientId: string, articleTitle: string, keyword: string, sections?: string[]) =>
    api.post('/pexels/find-article-images', { client_id: clientId, article_title: articleTitle, keyword, sections }).then(r => r.data),
  isAvailable: () => api.get('/pexels/available').then(r => r.data),
  getCache: (clientId: string) => api.get(`/pexels/cache/${clientId}`).then(r => r.data),
  getAttribution: (clientId: string, articleId: string) => api.get(`/pexels/attribution/${clientId}/${articleId}`).then(r => r.data),
};

// ═══ Enterprise Pipeline API ══════════════════

export const pipelineApi = {
  run: (data: any) => api.post('/pipeline/run', data).then(r => r.data),
  getStatus: (pipelineId: string) => api.get(`/pipeline/status/${pipelineId}`).then(r => r.data),
  getHistory: (clientId: string) => api.get(`/pipeline/history/${clientId}`).then(r => r.data),
};

// ═══ Shopify API ════════════════════════════

export const shopifyApi = {
  /** Get store info for a connected Shopify shop */
  getStoreInfo: (shop: string) => api.get('/shopify/store-info', { params: { shop } }).then(r => r.data),

  /** Register a user account for a Shopify store (creates client + user) */
  shopRegister: (data: { email: string; password: string; name: string; shop?: string }) =>
    api.post('/shopify/register', data).then(r => r.data),
};

export { TOKEN_KEY };
export default api;
