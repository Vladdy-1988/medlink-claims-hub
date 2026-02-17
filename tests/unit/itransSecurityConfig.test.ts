import { describe, it, expect } from 'vitest';
import {
  isPlaceholderSecretValue,
  requireStrongSecretEnv,
  validateItransProductionSecurityConfiguration,
} from '../../server/integrations/itransSecurityConfig';

function makeStrongSecret(prefix: string, length = 40): string {
  return `${prefix}-${'x'.repeat(Math.max(0, length - prefix.length - 1))}`;
}

function buildEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    SESSION_SECRET: makeStrongSecret('session'),
    ENCRYPTION_KEY: makeStrongSecret('encryption'),
    HASH_KEY: makeStrongSecret('hash'),
    ITRANS_AUTO_SUBMIT_ENABLED: 'false',
    ...overrides,
  };
}

describe('itransSecurityConfig', () => {
  it('detects placeholder secrets', () => {
    expect(isPlaceholderSecretValue('replace-with-strong-random-value')).toBe(true);
    expect(isPlaceholderSecretValue('example-secret-value')).toBe(true);
    expect(isPlaceholderSecretValue(makeStrongSecret('real-secret'))).toBe(false);
  });

  it('enforces minimum secret length and placeholder checks', () => {
    expect(() => requireStrongSecretEnv('TEST_SECRET', 'short', 16)).toThrow(
      /TEST_SECRET must be set and at least 16 characters/
    );
    expect(() =>
      requireStrongSecretEnv('TEST_SECRET', 'replace-with-strong-random-value', 16)
    ).toThrow(/TEST_SECRET must not use placeholder\/default values/);
  });

  it('is a no-op outside production', () => {
    const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
    expect(() => validateItransProductionSecurityConfiguration(env)).not.toThrow();
  });

  it('requires strong base secrets in production', () => {
    const env = buildEnv({
      SESSION_SECRET: 'replace-with-strong-random-value',
    });
    expect(() => validateItransProductionSecurityConfiguration(env)).toThrow(
      /SESSION_SECRET must not use placeholder\/default values/
    );
  });

  it('requires iTrans workflow secrets when auto-submit is enabled', () => {
    const env = buildEnv({
      ITRANS_AUTO_SUBMIT_ENABLED: 'true',
      ITRANS_API_URL: 'http://127.0.0.1:3002',
      ITRANS_CLAIMS_API_KEY: makeStrongSecret('claims-key', 24),
      ITRANS_WORKFLOW_API_KEY: makeStrongSecret('claims-key', 24),
      ITRANS_PROVIDER_SIGNATURE_HMAC_SECRET: makeStrongSecret('provider-signing', 48),
      ITRANS_WEBHOOK_SIGNING_SECRET: makeStrongSecret('webhook-signing', 48),
    });

    expect(() => validateItransProductionSecurityConfiguration(env)).toThrow(
      /ITRANS_WORKFLOW_API_KEY must be different from ITRANS_CLAIMS_API_KEY/
    );
  });

  it('requires webhook signing secret when webhook validation is active', () => {
    const env = buildEnv({
      ITRANS_WEBHOOK_SIGNING_SECRET: 'replace-with-strong-random-value-min-32-chars',
    });

    expect(() => validateItransProductionSecurityConfiguration(env)).toThrow(
      /ITRANS_WEBHOOK_SIGNING_SECRET must not use placeholder\/default values/
    );
  });

  it('accepts a strong production configuration', () => {
    const env = buildEnv({
      ITRANS_AUTO_SUBMIT_ENABLED: 'true',
      ITRANS_API_URL: 'http://127.0.0.1:3002',
      ITRANS_CLAIMS_API_KEY: makeStrongSecret('claims-key', 24),
      ITRANS_WORKFLOW_API_KEY: makeStrongSecret('workflow-key', 24),
      ITRANS_PROVIDER_SIGNATURE_HMAC_SECRET: makeStrongSecret('provider-signing', 48),
      ITRANS_WEBHOOK_SIGNING_SECRET: makeStrongSecret('webhook-signing', 48),
    });

    expect(() => validateItransProductionSecurityConfiguration(env)).not.toThrow();
  });
});
