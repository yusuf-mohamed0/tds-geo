// <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
// (c) 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, expect, it } from 'vitest';
import { INTEGRATION_HARDENING_CONTRACT } from '../../orchestrators/IntegrationHardeningContract';

describe('INTEGRATION_HARDENING_CONTRACT', () => {
  it('keeps the contract side-effect-free and unwired', () => {
    expect(INTEGRATION_HARDENING_CONTRACT.runtimeWiring).toBe('not-wired');
    expect(INTEGRATION_HARDENING_CONTRACT.safetyRules.length).toBeGreaterThan(0);
  });

  it('models every required integration surface', () => {
    const ids = INTEGRATION_HARDENING_CONTRACT.surfaces.map((surface) => surface.id).sort();

    expect(ids).toEqual(
      [
        'shopify',
        'ads-reporting',
        'google-search-console',
        'nextcloud-backups',
        'credential-vault',
        'webhooks-compliance',
        'observability-health',
      ].sort(),
    );
  });

  it('keeps ads reporting internal-only with no client-facing delivery', () => {
    const ads = INTEGRATION_HARDENING_CONTRACT.surfaces.find((surface) => surface.id === 'ads-reporting');
    expect(ads?.approvalGates).toContain('admin-only-internal-only');
    expect(ads?.requiredInvariants.join(' ')).toMatch(/internal-only/i);
  });

  it('preserves Shopify hidden draft and scheduled publish invariants', () => {
    const shopify = INTEGRATION_HARDENING_CONTRACT.surfaces.find((surface) => surface.id === 'shopify');
    expect(shopify?.requiredInvariants.join(' ')).toMatch(/hidden draft/i);
    expect(shopify?.requiredInvariants.join(' ')).toMatch(/scheduled/i);
  });

  it('requires Nextcloud artifacts to exclude secret-bearing material', () => {
    const nextcloud = INTEGRATION_HARDENING_CONTRACT.surfaces.find((surface) => surface.id === 'nextcloud-backups');
    expect(nextcloud?.requiredInvariants.join(' ')).toMatch(/env|tokens|clients\.yaml|credential vault/i);
  });

  it('flags every surface as secret-bearing when credentials are present', () => {
    for (const surface of INTEGRATION_HARDENING_CONTRACT.surfaces) {
      for (const secret of surface.secrets) {
        expect(secret.exposureSurfaces.length).toBeGreaterThan(0);
      }
    }
  });

  it('forbids secret movement and provider calls from the contract', () => {
    const rules = INTEGRATION_HARDENING_CONTRACT.safetyRules.join(' ');
    expect(rules).toMatch(/Do not move, migrate, rotate, or decrypt secret values/i);
    expect(rules).toMatch(/Do not make provider calls/i);
  });
});