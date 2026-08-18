// <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
// (c) 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

export type IntegrationSurfaceId =
  | 'shopify'
  | 'ads-reporting'
  | 'google-search-console'
  | 'nextcloud-backups'
  | 'credential-vault'
  | 'webhooks-compliance'
  | 'observability-health';

export type SecretStorageKind = 'env' | 'db-column' | 'json-config' | 'external-runner' | 'encrypted-db' | 'none';

export type SecretFormat = 'encrypted' | 'masked' | 'plaintext' | 'unknown';

export type ApprovalGateKind =
  | 'hidden-draft-manual-approval'
  | 'scheduled-auto-publish'
  | 'admin-only-internal-only'
  | 'sanitized-export-only'
  | 'none';

export interface IntegrationSecretContract {
  readonly name: string;
  readonly storageLocation: SecretStorageKind;
  readonly format: SecretFormat;
  readonly exposureSurfaces: readonly string[];
}

export interface IntegrationSurfaceContract {
  readonly id: IntegrationSurfaceId;
  readonly manager: string;
  readonly sourceFiles: readonly string[];
  readonly routePrefixes: readonly string[];
  readonly scripts: readonly string[];
  readonly secrets: readonly IntegrationSecretContract[];
  readonly providerCallBoundary: readonly string[];
  readonly artifactBoundary: readonly string[];
  readonly approvalGates: readonly ApprovalGateKind[];
  readonly auditTrail: readonly string[];
  readonly rotationRevocation: readonly string[];
  readonly tenantScopeRule: string;
  readonly currentRisks: readonly string[];
  readonly requiredInvariants: readonly string[];
  readonly nextHardeningStep: string;
}

export interface IntegrationHardeningArchitectureContract {
  readonly runtimeWiring: 'not-wired';
  readonly sourceOfTruth: readonly string[];
  readonly surfaces: readonly IntegrationSurfaceContract[];
  readonly safetyRules: readonly string[];
}

const INTEGRATION_SAFETY_RULES = [
  'Do not move, migrate, rotate, or decrypt secret values in Phase 7 without a separate migration plan and rollback evidence.',
  'Do not make provider calls, enqueue jobs, send webhooks, publish content, or generate reports from this contract.',
  'Do not change Shopify publishing semantics: hidden drafts, manual approval, and scheduled publish controls remain intact.',
  'Do not add client-facing ads delivery, emails, or live publish automation from this contract.',
  'Do not include env files, keys, tokens, clients.yaml, or credential vault material in Nextcloud sync artifacts.',
  'Do not expose secret values through /health, /metrics, route responses, logs, generated docs, or reports.',
  'Backend authorization remains authoritative for every integration route; hiding links is not a security boundary.',
] as const;

export const INTEGRATION_HARDENING_CONTRACT: IntegrationHardeningArchitectureContract = {
  runtimeWiring: 'not-wired',
  sourceOfTruth: [
    'doc/architecture/INTEGRATION-CREDENTIAL-MATRIX.md',
    'doc/architecture/STORAGE-WORKFLOW-CONTRACT.md',
    'backend/routes/adsReports.ts',
    'backend/routes/connectors.ts',
    'backend/routes/cms.ts',
    'backend/routes/credentialVault.ts',
    'backend/routes/complianceWebhooks.ts',
    'backend/routes/embedded.ts',
    'backend/routes/googleSearchConsole.ts',
    'backend/routes/shopifyInstall.ts',
    'backend/routes/webhooks.ts',
    'backend/routes/apiKeys.ts',
    'backend/services/adsReporting.ts',
    'backend/services/credentialEncryption.ts',
    'backend/services/googleSearchConsole.ts',
    'backend/services/metricsService.ts',
    'backend/services/observability.ts',
    'backend/services/shopify/auth.ts',
    'backend/services/shopify/client.ts',
    'backend/services/shopify/content.ts',
    'backend/services/autoPublishService.ts',
    'backend/services/webhooks.ts',
    'backend/utils/logger.ts',
    'backend/utils/shopifyWebhook.ts',
    'backend/middleware/activity.ts',
    'backend/index.ts',
    'scripts/sync-nextcloud-safe.sh',
    'scripts/backup-db.sh',
    'deploy/truenas/SECURITY.md',
    'doc/PRODUCTION-CONTRACT.md',
  ],
  surfaces: [
    {
      id: 'shopify',
      manager: 'Integration Manager',
      sourceFiles: [
        'backend/routes/shopifyInstall.ts',
        'backend/routes/embedded.ts',
        'backend/services/shopify/client.ts',
        'backend/services/shopify/auth.ts',
        'backend/services/shopify/content.ts',
        'backend/services/autoPublishService.ts',
        'backend/engines/publisher/index.ts',
        'backend/services/multiCmsPublisher.ts',
        'backend/services/content/publicArticleGuard.ts',
      ],
      routePrefixes: ['/api/shopify', '/api/embedded'],
      scripts: ['backend/scripts/update-webhooks.ts', 'backend/scripts/syncRepairedFlauntToShopify.ts', 'backend/scripts/replaceFlauntDrafts.ts', 'backend/scripts/moveFlauntDraftsToBeautyTips.ts'],
      secrets: [
        {
          name: 'clients.shopify_token / refresh token / expiry',
          storageLocation: 'db-column',
          format: 'plaintext',
          exposureSurfaces: ['Legacy token columns on clients; refreshIfExpired reads and writes them; must never appear in responses, logs, docs, or reports.'],
        },
        {
          name: 'cms_connections.config accessToken JSON',
          storageLocation: 'json-config',
          format: 'plaintext',
          exposureSurfaces: ['Shopify install and refreshIfExpired write raw accessToken JSON; config JSON must be treated as secret-bearing.'],
        },
        {
          name: 'SHOPIFY_API_KEY / SHOPIFY_API_SECRET / SHOPIFY_DEFAULT_ACCESS_TOKEN / SHOPIFY_DEFAULT_SHOP',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['Used by buildClient, OAuth HMAC, embedded session verification, and webhook HMAC; values stay in env only.'],
        },
      ],
      providerCallBoundary: [
        'buildClient sends X-Shopify-Access-Token through ShopifyRateLimitedQueue for rate limits and retries.',
        'shopifyInstall OAuth callback exchanges code and writes tokens into clients and cms_connections.config.',
        'embedded session token verified with SHOPIFY_API_SECRET; /publish-all publishes only approved rows.',
        'autoPublishService only flips hidden drafts live for status=approved and scheduled_at<=NOW().',
        'publishArticleLive in content.ts is the only live-publish flip; publicArticleGuard blocks internal markers before CMS publish.',
      ],
      artifactBoundary: ['Hidden Shopify drafts with SEO metafields; published URLs and external IDs stored in publishing_history.'],
      approvalGates: ['hidden-draft-manual-approval', 'scheduled-auto-publish'],
      auditTrail: ['publishing_history', 'activity_logs'],
      rotationRevocation: ['Token refresh on expiry via refreshIfExpired; compliance uninstall flow removes store data.'],
      tenantScopeRule: 'Every Shopify route and worker must keep client_id and shop domain scoping from backend auth and route loaders.',
      currentRisks: [
        'Shopify OAuth callback logs a tokenPrefix (masked) and no longer writes raw token JSON into cms_connections.config.',
        'Legacy token columns remain on clients alongside vault surfaces (encrypted at rest; vault policy rows are masked-only anchors).',
        'Defined but unregistered queues (default, cost-optimization, observability, odoo-*) must not be assumed executable.',
      ],
      requiredInvariants: [
        'Hidden draft, manual approval, and scheduled publish semantics remain unchanged.',
        'Scheduled articles must not publish before scheduled_at.',
        'Token values must never be exposed in responses, logs, docs, or Nextcloud artifacts.',
      ],
      nextHardeningStep: 'Add an on-demand OAuth-refresh rotate endpoint (POST /api/shopify/rotate) and a scheduled rotation-policy check flagging tokens older than rotation_days.',
    },
    {
      id: 'ads-reporting',
      manager: 'Ads Manager',
      sourceFiles: ['backend/routes/adsReports.ts', 'backend/services/adsReporting.ts'],
      routePrefixes: ['/api/ads-reports'],
      scripts: ['/root/tds-ads-reporting-automation (external reporting runner)'],
      secrets: [
        {
          name: 'ADS_REPORTING_PROJECT / ADS_REPORTING_PYTHON / ADS_REPORTING_RECIPIENT',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['Point to the external Python reporting project and recipient; no values in code.'],
        },
        {
          name: 'META_SYSTEM_USER_TOKEN / META_PAGE_ACCESS_TOKEN',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['External Meta tokens for ads reporting runner; must not be committed or uploaded.'],
        },
        {
          name: 'configs/clients.yaml',
          storageLocation: 'external-runner',
          format: 'plaintext',
          exposureSurfaces: ['Held by the external reporting runner and explicitly excluded from Nextcloud safe sync.'],
        },
      ],
      providerCallBoundary: [
        'adsReporting wraps the external Python reporting project only; the backend does not call Meta directly.',
        'adsReports routes support status, dry-run, generate, and the artifact approval/delivery registry behind authenticated admin-only access.',
      ],
      artifactBoundary: ['Generated PDF artifacts listed from reports/ and tracked in the ads_artifact_registry; internal until approved; delivery is recorded manually, never emailed or pushed client-side from the backend.'],
      approvalGates: ['admin-only-internal-only'],
      auditTrail: ['route auth and activity_logs for generate/dry-run calls; ads_artifact_registry tracks approval/rejection/delivery state with actor and timestamp'],
      rotationRevocation: ['External Meta token rotation lives in the reporting runner env; no backend rotation path yet.'],
      tenantScopeRule: 'Ads report generation is keyed by clientId and restricted to admin/super_admin; no client-facing delivery.',
      currentRisks: ['Registry exists but approval decisions still rely on human review of the PDF; delivery marks state only and does not enforce an external delivery audit.'],
      requiredInvariants: ['Keep ads reporting internal-only with no email or client delivery until explicit approval.'],
      nextHardeningStep: 'Add an on-demand OAuth-refresh rotate endpoint (POST /api/shopify/rotate) and a scheduled rotation-policy check flagging tokens older than rotation_days.',
    },
    {
      id: 'google-search-console',
      manager: 'Integration Manager',
      sourceFiles: ['backend/routes/googleSearchConsole.ts', 'backend/services/googleSearchConsole.ts'],
      routePrefixes: ['/api/gsc'],
      scripts: [],
      secrets: [
        {
          name: 'gsc_auth.access_token / refresh_token',
          storageLocation: 'db-column',
          format: 'unknown',
          exposureSurfaces: ['Stored in gsc_auth table and cached in memory; must never appear in responses, logs, docs, or reports.'],
        },
        {
          name: 'GSC_CLIENT_ID / GSC_CLIENT_SECRET / GSC_REDIRECT_URI',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['OAuth client credentials used to authorize Google APIs; env only.'],
        },
      ],
      providerCallBoundary: ['OAuth flows, status, overview, sync, and disconnect use Google OAuth/Webmasters APIs with readonly scope.'],
      artifactBoundary: ['GSC site and query rows synced into storage; no external artifact output.'],
      approvalGates: ['none'],
      auditTrail: ['activity_logs for OAuth/sync/disconnect actions'],
      rotationRevocation: ['Disconnect revokes tokens; client/admin access checks gate routes.'],
      tenantScopeRule: 'Admin/super_admin or matching client access required for each GSC route.',
      currentRisks: ['Tokens stored in gsc_auth table and cached in memory; no centralized rotation policy.'],
      requiredInvariants: ['Token values must never be exposed in responses, logs, docs, or Nextcloud artifacts.'],
      nextHardeningStep: 'Route GSC credential setup and rotation through the unified integration boundary.',
    },
    {
      id: 'nextcloud-backups',
      manager: 'Storage Manager',
      sourceFiles: ['scripts/sync-nextcloud-safe.sh', 'scripts/backup-db.sh', 'docker-compose.yml'],
      routePrefixes: [],
      scripts: ['scripts/sync-nextcloud-safe.sh', 'scripts/backup-db.sh'],
      secrets: [
        {
          name: 'NEXTCLOUD_URL / NEXTCLOUD_USER / NEXTCLOUD_PASSWORD',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['Required by sync script; account master password is currently used - app password preferred; never committed.'],
        },
        {
          name: 'DATABASE_URL / DB_USER / DB_NAME / AWS/S3 env',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['Used by backup-db.sh for pg_dump and optional S3 upload; env only.'],
        },
      {
          name: 'doc/clients/*/technical-reference.md | contacts.md | full-profile.md | brand-profile.md',
          storageLocation: 'none',
          format: 'plaintext',
          exposureSurfaces: ['Client doc files can embed live API keys and token values; they are staged wholesale by sync-nextcloud-safe.sh and must be excluded or scrubbed before upload.'],
        },
      ],
      providerCallBoundary: ['WebDAV MKCOL and PUT uploads via curl; pg_dump/pg_restore for backups.'],
      artifactBoundary: [
        'Staged docs/outputs/reports and ads-reporting PDFs; optional sanitized DB CSV (clients only, non-secret columns).',
        'Before upload, find -delete removes .env, *.pem, *.key, *token*, clients.yaml, and credential_vault paths.',
      ],
      approvalGates: ['sanitized-export-only'],
      auditTrail: ['manifest-*.txt uploaded alongside archive; excluded-sensitive-files.txt records stripped paths'],
      rotationRevocation: ['Backup rotation by BACKUP_RETENTION_DAYS; S3 upload optional.'],
      tenantScopeRule: 'Sanitized DB export only includes non-secret client columns; no tenant secrets or cross-tenant data.',
      currentRisks: [
        'Account master password is used by sync scripts instead of an app password.',
        'doc/clients/*/technical-reference.md, contacts.md, full-profile.md, and brand-profile.md are credential-bearing; the safe-sync exclusion list was extended to strip them before upload (verified 2026-08-17).',
      ],
      requiredInvariants: ['Nextcloud artifacts must never contain env, keys, tokens, clients.yaml, credential vault material, or credential-bearing client doc files.'],
      nextHardeningStep: 'Switch sync to a Nextcloud app password and keep the safe-sync exclusion list under test.',
    },
    {
      id: 'credential-vault',
      manager: 'Credential Owner / Integration Manager',
      sourceFiles: [
        'backend/routes/credentialVault.ts',
        'backend/routes/apiKeys.ts',
        'backend/routes/connectors.ts',
        'backend/services/credentialEncryption.ts',
        'backend/scripts/importAllCredentials.ts',
        'backend/scripts/importCredentials.ts',
        'backend/scripts/vault.ts',
        'backend/scripts/rotateVaultKey.ts',
      ],
      routePrefixes: ['/api/vault', '/api/connector'],
      scripts: ['backend/scripts/importAllCredentials.ts', 'backend/scripts/importCredentials.ts', 'backend/scripts/vault.ts', 'backend/scripts/rotateVaultKey.ts'],
      secrets: [
        {
          name: 'credential_vault encrypted rows',
          storageLocation: 'encrypted-db',
          format: 'encrypted',
          exposureSurfaces: ['AES-256-GCM via CREDENTIAL_VAULT_KEY or ENCRYPTION_KEY; vault GET and rotate return plaintext to callers.'],
        },
        {
          name: 'api_keys.key_value',
          storageLocation: 'encrypted-db',
          format: 'encrypted',
          exposureSurfaces: ['Local AES-GCM with ENCRYPTION_KEY; masked value stored, no decrypt/read endpoint observed.'],
        },
        {
          name: 'connected_sites.encrypted_credentials raw value',
          storageLocation: 'db-column',
          format: 'plaintext',
          exposureSurfaces: ['connectors route normalizes and stores raw apiKey/accessToken in cms_connections.config and connected_sites.encrypted_credentials.'],
        },
        {
          name: 'CREDENTIAL_VAULT_KEY / ENCRYPTION_KEY',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['Encryption keys; production requires CREDENTIAL_VAULT_KEY, non-prod falls back to ephemeral key.'],
        },
      ],
      providerCallBoundary: ['No provider calls; vault routes encrypt/decrypt/rotate/export/import credentials locally.'],
      artifactBoundary: ['Encrypted vault export rows; masked values in responses.'],
      approvalGates: ['none'],
      auditTrail: ['credential_access_log for dedicated vault route reads/writes/rotations'],
      rotationRevocation: ['rotateVaultKey re-encrypts vault rows; vault rotate endpoint issues new plaintext password.'],
      tenantScopeRule: 'Vault and connector credentials must stay tenant-scoped by client and never be returned to other clients.',
      currentRisks: [
        'Admin routes, import/vault CLI, and rotation scripts mutate vault rows outside dedicated credential_access_log coverage.',
        'connectors stores raw apiKey/accessToken in cms_connections.config and connected_sites.encrypted_credentials.',
        'Vault GET and rotate return plaintext in response bodies.',
      ],
      requiredInvariants: [
        'Secret values remain encrypted at rest and never generated into docs or logs.',
        'Route-level credential access stays audited; scripted mutation remains a documented audit gap.',
      ],
      nextHardeningStep: 'Add operator audit events for scripted/admin credential mutation and move raw connector tokens behind encryption.',
    },
    {
      id: 'webhooks-compliance',
      manager: 'Integration Manager',
      sourceFiles: ['backend/routes/complianceWebhooks.ts', 'backend/routes/webhooks.ts', 'backend/services/webhooks.ts', 'backend/utils/shopifyWebhook.ts'],
      routePrefixes: ['/api/webhooks'],
      scripts: ['backend/scripts/update-webhooks.ts'],
      secrets: [
        {
          name: 'SHOPIFY_API_SECRET',
          storageLocation: 'env',
          format: 'unknown',
          exposureSurfaces: ['Used for webhook and OAuth HMAC verification with timing-safe compare; env only.'],
        },
        {
          name: 'webhook secrets (encrypted)',
          storageLocation: 'encrypted-db',
          format: 'encrypted',
          exposureSurfaces: ['Customer webhook management stores encrypted webhook secrets.'],
        },
      ],
      providerCallBoundary: [
        'Shopify compliance webhooks capture raw body and verify HMAC before GDPR and uninstall handling.',
        'Webhook receiver verifies Shopify HMAC and stores full incoming event JSON in activity_logs.metadata.',
        'Outbound webhook deliveries sign and store payloads plus response/error status in webhook_deliveries.',
      ],
      artifactBoundary: ['webhook_deliveries payloads/status; activity_logs.metadata event JSON.'],
      approvalGates: ['none'],
      auditTrail: ['activity_logs', 'webhook_deliveries'],
      rotationRevocation: ['Compliance uninstall flow removes store data and deletes publishing_queue/article_images on redact.'],
      tenantScopeRule: 'Webhook events and compliance deletions must be scoped by shop/client; full event JSON can include sensitive payloads.',
      currentRisks: [
        'Full incoming event JSON stored in activity_logs.metadata may include sensitive payloads.',
        'Subscribe endpoint accepts raw accessToken in body to register compliance webhooks.',
      ],
      requiredInvariants: [
        'HMAC verification must remain mandatory before any webhook-triggered effect.',
        'Compliance GDPR and uninstall semantics remain unchanged.',
      ],
      nextHardeningStep: 'Redact sensitive fields from stored webhook event JSON while preserving verification integrity.',
    },
    {
      id: 'observability-health',
      manager: 'System Manager / Operations Manager',
      sourceFiles: ['backend/index.ts', 'backend/routes/observability.ts', 'backend/services/observability.ts', 'backend/services/metricsService.ts', 'backend/utils/logger.ts', 'backend/middleware/activity.ts'],
      routePrefixes: ['/health', '/metrics', '/api/observability'],
      scripts: [],
      secrets: [
        {
          name: 'None exposed',
          storageLocation: 'none',
          format: 'unknown',
          exposureSurfaces: ['Public /health checks DB/Redis/OpenAI/Ollama/sidecars/GSC config without token values; /metrics emits Prometheus text without secrets.'],
        },
      ],
      providerCallBoundary: ['/health and /metrics are public operational surfaces; deeper observability routes are admin-only.'],
      artifactBoundary: ['Prometheus metrics; observability span/metric buffering to DB tables.'],
      approvalGates: ['none'],
      auditTrail: ['activity middleware records request activity and strips query strings to avoid token/credential capture; Winston logs to logs/*.log.'],
      rotationRevocation: ['n/a'],
      tenantScopeRule: 'Observability data must not expose per-client secret values or credential material.',
      currentRisks: ['/health and /metrics are unauthenticated; docs must not present them as role-enforced. Only /api/observability routes are admin-only.'],
      requiredInvariants: ['/health and /metrics must never expose token values or secret material.'],
      nextHardeningStep: 'Keep public health/metrics redaction guarantees under test while admin observability stays authenticated.',
    },
  ],
  safetyRules: [...INTEGRATION_SAFETY_RULES],
};