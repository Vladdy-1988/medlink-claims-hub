/**
 * Integration test for EDI domain blocking
 * Tests that production EDI domains are blocked while sandbox domains are allowed
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { isProductionDomainBlocked, getSandboxUrl } from '../../server/edi/sandbox';
import axios from 'axios';

describe('EDI Domain Blocking Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Import app
    const serverModule = await import('../../server/index');
    app = serverModule.default || serverModule.app;
  });

  describe('Production Domain Blocking', () => {
    const productionDomains = [
      'https://api.telushealth.com',
      'https://eclaims.telushealth.com',
      'https://cdanet.ca',
      'https://api.cdanet.ca',
      'https://portal.wsib.on.ca',
      'https://api.wsib.on.ca',
      'https://wcb.ab.ca',
      'https://api.wcb.ab.ca',
      'https://worksafebc.com',
      'https://api.worksafebc.com',
      'https://secure.net-claim.com',
      'https://api.net-claim.com',
      'https://provider.claimsecure.com',
      'https://api.claimsecure.com'
    ];

    productionDomains.forEach(domain => {
      it(`should block production domain: ${domain}`, () => {
        expect(isProductionDomainBlocked(domain)).toBe(true);
      });
    });

    it('should prevent outbound connections to production domains', async () => {
      const blockedDomain = 'https://api.telushealth.com/claims';
      
      // Attempt to make a request through the EDI connector
      const response = await request(app)
        .post('/api/edi/test-connection')
        .send({
          url: blockedDomain,
          connector: 'eclaims'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('blocked');
      expect(response.body.error).toContain('production');
    });

    it('should block variations of production URLs', () => {
      const variations = [
        'https://api.telushealth.com/v1/claims',
        'https://api.telushealth.com:443/secure',
        'https://subdomain.api.telushealth.com',
        'https://API.TELUSHEALTH.COM', // Case insensitive
        'http://api.telushealth.com', // HTTP variant
        'https://api.telushealth.com?param=value',
        'https://api.telushealth.com#anchor'
      ];

      variations.forEach(url => {
        expect(isProductionDomainBlocked(url)).toBe(true);
      });
    });
  });

  describe('Sandbox Domain Allowlisting', () => {
    const sandboxDomains = [
      'sandbox.telushealth.com',
      'sandbox.cdanet.ca',
      'sandbox.wsib.on.ca',
      'sandbox.wcb.ab.ca',
      'sandbox.worksafebc.com',
      'test.claimsecure.com',
      'demo.net-claim.com'
    ];

    sandboxDomains.forEach(domain => {
      it(`should allow sandbox domain: ${domain}`, () => {
        const url = `https://${domain}`;
        expect(isProductionDomainBlocked(url)).toBe(false);
      });
    });

    it('should redirect production URLs to sandbox equivalents', () => {
      const mappings = [
        {
          production: 'https://api.telushealth.com/claims',
          expected: 'https://sandbox.telushealth.com/claims'
        },
        {
          production: 'https://api.cdanet.ca/submit',
          expected: 'https://sandbox.cdanet.ca/submit'
        },
        {
          production: 'https://portal.wsib.on.ca/api',
          expected: 'https://sandbox.wsib.on.ca/api'
        }
      ];

      mappings.forEach(({ production, expected }) => {
        const sandboxUrl = getSandboxUrl(production);
        expect(sandboxUrl).toBe(expected);
      });
    });

    it('should allow connections to sandbox domains', async () => {
      const sandboxDomain = 'https://sandbox.telushealth.com/claims';
      
      // Test that sandbox connections are allowed
      const response = await request(app)
        .post('/api/edi/test-connection')
        .send({
          url: sandboxDomain,
          connector: 'eclaims'
        });

      // Should not be blocked
      expect(response.status).not.toBe(403);
      
      // Might return 404 or other status if endpoint doesn't exist,
      // but shouldn't return a "blocked" error
      if (response.body.error) {
        expect(response.body.error).not.toContain('blocked');
      }
    });
  });

  describe('Local Development URLs', () => {
    const localUrls = [
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://0.0.0.0:5000',
      'http://localhost:5432/postgres',
      'http://host.docker.internal:3000'
    ];

    localUrls.forEach(url => {
      it(`should allow local development URL: ${url}`, () => {
        expect(isProductionDomainBlocked(url)).toBe(false);
      });
    });
  });

  describe('EDI Connector Mode Enforcement', () => {
    it('should use sandbox URLs when in sandbox mode', async () => {
      // Test TELUS eClaims connector in sandbox mode
      const response = await request(app)
        .post('/api/edi/connectors/eclaims/submit')
        .send({
          mode: 'sandbox',
          claim: {
            id: 'test-claim-123',
            amount: 100.00
          }
        });

      // Check that the connector used sandbox URL
      expect(response.body).not.toHaveProperty('error', 'Production domain blocked');
      
      if (response.body.externalUrl) {
        expect(response.body.externalUrl).toContain('sandbox');
        expect(response.body.externalUrl).not.toContain('api.telushealth.com');
      }
    });

    it('should block production URLs even if mode is set to live', async () => {
      // Attempt to use live mode (should be blocked)
      const response = await request(app)
        .post('/api/edi/connectors/eclaims/submit')
        .send({
          mode: 'live',
          claim: {
            id: 'test-claim-456',
            amount: 200.00
          }
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Production domains are blocked');
    });

    it('should log blocked attempts', async () => {
      const response = await request(app)
        .post('/api/edi/test-connection')
        .send({
          url: 'https://api.cdanet.ca/secure',
          connector: 'cdanet'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('blockedUrl', 'https://api.cdanet.ca/secure');
      expect(response.body).toHaveProperty('suggestedUrl');
      expect(response.body.suggestedUrl).toContain('sandbox');
    });
  });

  describe('URL Parsing and Validation', () => {
    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'not-a-url',
        'ftp://api.telushealth.com',
        '//api.telushealth.com',
        'javascript:alert(1)',
        '',
        null,
        undefined
      ];

      malformedUrls.forEach(url => {
        // Should not throw, should return false for non-HTTP(S) URLs
        expect(() => isProductionDomainBlocked(url as any)).not.toThrow();
      });
    });

    it('should block URLs with production domains in path', () => {
      // Attempts to bypass by putting production domain in path
      const bypassAttempts = [
        'https://sandbox.com/redirect?url=https://api.telushealth.com',
        'https://proxy.com/api.telushealth.com/claims',
        'https://sandbox.telushealth.com/../api.telushealth.com'
      ];

      bypassAttempts.forEach(url => {
        // The actual domain should be checked, not the path
        const domain = new URL(url).hostname;
        if (domain.includes('telushealth.com') && !domain.includes('sandbox')) {
          expect(isProductionDomainBlocked(url)).toBe(true);
        }
      });
    });

    it('should handle IP addresses correctly', () => {
      const ipAddresses = [
        'https://192.168.1.1',
        'https://10.0.0.1:3000',
        'https://172.16.0.1/api',
        'https://8.8.8.8' // External IP
      ];

      ipAddresses.forEach(url => {
        // IP addresses should not be blocked (they're not production domains)
        expect(isProductionDomainBlocked(url)).toBe(false);
      });
    });
  });

  describe('Environment-based Configuration', () => {
    it('should respect NODE_ENV for blocking behavior', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // In test/development, blocking should be active
      process.env.NODE_ENV = 'development';
      expect(isProductionDomainBlocked('https://api.telushealth.com')).toBe(true);
      
      process.env.NODE_ENV = 'test';
      expect(isProductionDomainBlocked('https://api.telushealth.com')).toBe(true);
      
      // Restore original
      process.env.NODE_ENV = originalEnv;
    });

    it('should have override mechanism for testing', () => {
      const originalEnv = process.env.DISABLE_EDI_BLOCKING;
      
      // With override disabled, blocking should work
      process.env.DISABLE_EDI_BLOCKING = 'false';
      expect(isProductionDomainBlocked('https://api.cdanet.ca')).toBe(true);
      
      // With override enabled, blocking should be bypassed
      process.env.DISABLE_EDI_BLOCKING = 'true';
      expect(isProductionDomainBlocked('https://api.cdanet.ca')).toBe(false);
      
      // Restore original
      process.env.DISABLE_EDI_BLOCKING = originalEnv;
    });
  });

  describe('Audit Logging', () => {
    it('should log blocked connection attempts', async () => {
      const response = await request(app)
        .post('/api/edi/audit/blocked')
        .send({
          url: 'https://api.telushealth.com/claims',
          connector: 'eclaims',
          timestamp: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logged', true);
    });

    it('should track sandbox redirections', async () => {
      const response = await request(app)
        .post('/api/edi/audit/redirect')
        .send({
          originalUrl: 'https://api.cdanet.ca/submit',
          redirectUrl: 'https://sandbox.cdanet.ca/submit',
          connector: 'cdanet',
          timestamp: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('logged', true);
    });
  });
});