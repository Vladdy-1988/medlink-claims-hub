import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testDomain, isDomainAllowed, getAllowedPrefixes } from '../../server/net/allowlist';

describe('EDI Sandbox Allowlist', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment to clean state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Production domain blocking', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'sandbox';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.,test.,mock.';
    });

    it('should block manulife.ca in sandbox mode', () => {
      const result = testDomain('manulife.ca');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });

    it('should block sunlife.ca in sandbox mode', () => {
      const result = testDomain('sunlife.ca');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });

    it('should block telus.com in sandbox mode', () => {
      const result = testDomain('telus.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });

    it('should block canadalife.com in sandbox mode', () => {
      const result = testDomain('canadalife.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });

    it('should block desjardins.com in sandbox mode', () => {
      const result = testDomain('desjardins.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });

    it('should block subdomains of production domains', () => {
      const result = testDomain('api.manulife.ca');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });

    it('should block provider.canadalife.com specifically', () => {
      const result = testDomain('provider.canadalife.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Production domain explicitly blocked');
    });
  });

  describe('Sandbox domain allowing', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'sandbox';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.,test.,mock.,dev.,staging.';
    });

    it('should allow sandbox.example.com', () => {
      const result = testDomain('sandbox.example.com');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Matches allowed prefix');
    });

    it('should allow test.api.com', () => {
      const result = testDomain('test.api.com');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Matches allowed prefix');
    });

    it('should allow mock.service.net', () => {
      const result = testDomain('mock.service.net');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Matches allowed prefix');
    });

    it('should allow dev.environment.com', () => {
      const result = testDomain('dev.environment.com');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Matches allowed prefix');
    });

    it('should allow staging.app.io', () => {
      const result = testDomain('staging.app.io');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Matches allowed prefix');
    });

    it('should allow api.sandbox.example.com', () => {
      const result = testDomain('api.sandbox.example.com');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Matches allowed prefix');
    });
  });

  describe('Localhost allowing', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'sandbox';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.,test.';
    });

    it('should allow localhost', () => {
      const result = testDomain('localhost');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Localhost is always allowed');
    });

    it('should allow 127.0.0.1', () => {
      const result = testDomain('127.0.0.1');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Localhost is always allowed');
    });

    it('should allow localhost:3000', () => {
      const result = testDomain('localhost:3000');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Localhost is always allowed');
    });

    it('should allow 127.0.0.1:5000', () => {
      const result = testDomain('127.0.0.1:5000');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Localhost is always allowed');
    });
  });

  describe('Strict mode blocking', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'sandbox';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.,test.';
    });

    it('should block random.domain.com not in allowlist', () => {
      const result = testDomain('random.domain.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Domain not in allowed list (strict mode)');
    });

    it('should block example.com not in allowlist', () => {
      const result = testDomain('example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Domain not in allowed list (strict mode)');
    });

    it('should block google.com not in allowlist', () => {
      const result = testDomain('google.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Domain not in allowed list (strict mode)');
    });
  });

  describe('Production mode (EDI_MODE not sandbox)', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'production';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.';
    });

    it('should allow all domains in production mode', () => {
      expect(testDomain('manulife.ca').allowed).toBe(true);
      expect(testDomain('sunlife.ca').allowed).toBe(true);
      expect(testDomain('random.com').allowed).toBe(true);
      expect(testDomain('example.org').allowed).toBe(true);
    });

    it('should indicate not in sandbox mode', () => {
      const result = testDomain('manulife.ca');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Not in sandbox mode');
    });
  });

  describe('Environment variable parsing', () => {
    it('should parse comma-separated OUTBOUND_ALLOWLIST', () => {
      process.env.OUTBOUND_ALLOWLIST = 'sandbox., test., mock.';
      const prefixes = getAllowedPrefixes();
      expect(prefixes).toEqual(['sandbox.', 'test.', 'mock.']);
    });

    it('should handle OUTBOUND_ALLOWLIST with extra spaces', () => {
      process.env.OUTBOUND_ALLOWLIST = ' sandbox. ,  test. , mock. ';
      const prefixes = getAllowedPrefixes();
      expect(prefixes).toEqual(['sandbox.', 'test.', 'mock.']);
    });

    it('should use default prefixes if OUTBOUND_ALLOWLIST not set', () => {
      delete process.env.OUTBOUND_ALLOWLIST;
      const prefixes = getAllowedPrefixes();
      expect(prefixes).toContain('sandbox.');
      expect(prefixes).toContain('test.');
      expect(prefixes).toContain('mock.');
      expect(prefixes).toContain('dev.');
      expect(prefixes).toContain('staging.');
    });

    it('should handle empty OUTBOUND_ALLOWLIST', () => {
      process.env.OUTBOUND_ALLOWLIST = '';
      const prefixes = getAllowedPrefixes();
      expect(prefixes).toEqual([]);
    });
  });

  describe('isDomainAllowed internal function', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'sandbox';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.,test.';
    });

    it('should correctly identify allowed domains', () => {
      expect(isDomainAllowed('localhost')).toBe(true);
      expect(isDomainAllowed('127.0.0.1')).toBe(true);
      expect(isDomainAllowed('sandbox.api.com')).toBe(true);
      expect(isDomainAllowed('test.service.net')).toBe(true);
    });

    it('should correctly identify blocked domains', () => {
      expect(isDomainAllowed('manulife.ca')).toBe(false);
      expect(isDomainAllowed('sunlife.ca')).toBe(false);
      expect(isDomainAllowed('random.com')).toBe(false);
      expect(isDomainAllowed('example.org')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isDomainAllowed('MANULIFE.CA')).toBe(false);
      expect(isDomainAllowed('SANDBOX.API.COM')).toBe(true);
      expect(isDomainAllowed('LOCALHOST')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      process.env.EDI_MODE = 'sandbox';
      process.env.OUTBOUND_ALLOWLIST = 'sandbox.';
    });

    it('should handle domains with multiple subdomains', () => {
      const result = testDomain('api.v2.sandbox.example.com');
      expect(result.allowed).toBe(true);
    });

    it('should not allow partial matches', () => {
      const result = testDomain('sandboxapi.com'); // starts with 'sandbox' but no dot
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Domain not in allowed list');
    });

    it('should handle ports in domain names', () => {
      expect(testDomain('sandbox.api.com:8080').allowed).toBe(true);
      expect(testDomain('production.com:443').allowed).toBe(false);
    });
  });
});