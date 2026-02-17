const disallowedSecretValues = new Set([
  '',
  'changeme',
  'change-me',
  'replace-me',
  'replace_me',
  'replace-with-strong-random-value',
  'replace-with-strong-random-value-min-32-chars',
  'replace-with-real-value',
  'your-secret',
  'your-session-secret',
  'your-session-secret-min-32-chars',
  'your-shared-secret',
  'your-shared-secret-here',
  'secret',
  'password',
  'default',
]);

export function isPlaceholderSecretValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (disallowedSecretValues.has(normalized)) {
    return true;
  }
  return (
    normalized.startsWith('replace-with-') ||
    normalized.startsWith('your-') ||
    normalized.includes('example')
  );
}

export function requireStrongSecretEnv(
  name: string,
  value: string | undefined,
  minLength: number
): string {
  if (!value || value.length < minLength) {
    throw new Error(`${name} must be set and at least ${minLength} characters`);
  }
  if (isPlaceholderSecretValue(value)) {
    throw new Error(`${name} must not use placeholder/default values`);
  }
  return value;
}

export function validateItransProductionSecurityConfiguration(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  requireStrongSecretEnv('SESSION_SECRET', env.SESSION_SECRET, 32);
  requireStrongSecretEnv('ENCRYPTION_KEY', env.ENCRYPTION_KEY, 32);
  requireStrongSecretEnv('HASH_KEY', env.HASH_KEY, 32);

  const autoSubmitEnabled = env.ITRANS_AUTO_SUBMIT_ENABLED === 'true';
  const webhookSecret = env.ITRANS_WEBHOOK_SIGNING_SECRET || env.RELAY_WEBHOOK_SIGNING_SECRET || '';

  if (autoSubmitEnabled) {
    if (!(env.ITRANS_API_URL || '').trim()) {
      throw new Error('ITRANS_API_URL must be set when ITRANS_AUTO_SUBMIT_ENABLED=true');
    }

    const claimsApiKey = requireStrongSecretEnv('ITRANS_CLAIMS_API_KEY', env.ITRANS_CLAIMS_API_KEY, 16);
    const workflowApiKey = requireStrongSecretEnv(
      'ITRANS_WORKFLOW_API_KEY',
      env.ITRANS_WORKFLOW_API_KEY,
      16
    );
    requireStrongSecretEnv(
      'ITRANS_PROVIDER_SIGNATURE_HMAC_SECRET',
      env.ITRANS_PROVIDER_SIGNATURE_HMAC_SECRET || env.PROVIDER_SIGNATURE_HMAC_SECRET,
      32
    );

    if (claimsApiKey === workflowApiKey) {
      throw new Error('ITRANS_WORKFLOW_API_KEY must be different from ITRANS_CLAIMS_API_KEY');
    }
  }

  if (autoSubmitEnabled || webhookSecret.length > 0) {
    requireStrongSecretEnv('ITRANS_WEBHOOK_SIGNING_SECRET', webhookSecret, 32);
  }
}
