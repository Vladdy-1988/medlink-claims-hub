/**
 * EDI Sandbox Gateway
 * Intercepts and mocks all EDI communications in sandbox mode
 * Provides network isolation to prevent production access
 */

import { logger } from '../security/logger';
import { storage } from '../storage';
import { getMockInsurerResponse } from './mockInsurers';
import { generateSandboxResponse } from './responses';
import type { Claim } from '@shared/schema';

// Production domains to block
const BLOCKED_DOMAINS = [
  'api.telus.com',
  'eclaims.telus.com',
  'cdanet.ca',
  'itrans.ca',
  'sunlife.ca',
  'manulife.ca',
  'bluecross.ca',
  'canadalife.com',
  'desjardins.com',
  'greenshield.ca',
  'empire.ca',
  'ia.ca',
  'equitable.ca',
  'rbc.com',
  'td.com',
  'ssq.ca',
  'medavie.ca',
  'pac.bluecross.ca',
  'ab.bluecross.ca',
  'sk.bluecross.ca',
  'mb.bluecross.ca',
  'wsib.ca',
  'worksafebc.com',
  'wcb.ab.ca',
  'cnesst.gouv.qc.ca',
  'wcb.mb.ca',
  'wcbsask.com',
  'workplacenl.ca',
];

// Network request interceptor
export class NetworkInterceptor {
  private static blockedAttempts: Array<{
    timestamp: Date;
    url: string;
    method: string;
    orgId: string;
    userId: string;
  }> = [];

  /**
   * Check if URL is production endpoint
   */
  static isProductionEndpoint(url: string): boolean {
    const urlLower = url.toLowerCase();
    return BLOCKED_DOMAINS.some(domain => 
      urlLower.includes(domain) || 
      urlLower.includes(domain.replace('.', '-'))
    );
  }

  /**
   * Block production request and log attempt
   */
  static async blockProductionRequest(
    url: string,
    method: string,
    orgId: string,
    userId: string
  ): Promise<void> {
    const attempt = {
      timestamp: new Date(),
      url,
      method,
      orgId,
      userId,
    };

    this.blockedAttempts.push(attempt);

    // Log security event
    logger.error('🚫 BLOCKED PRODUCTION EDI ATTEMPT', {
      ...attempt,
      severity: 'CRITICAL',
      alert: true,
    });

    // Create audit event
    await storage.createAuditEvent({
      orgId,
      actorUserId: userId,
      type: 'edi_production_blocked',
      details: {
        url,
        method,
        message: 'Production EDI endpoint access blocked in sandbox mode',
      },
      ip: '0.0.0.0',
      userAgent: 'EDI-Sandbox',
    });

    throw new Error(
      `SANDBOX SECURITY: Production endpoint access blocked. URL: ${url}. ` +
      'EDI_MODE is set to sandbox. Switch to production mode if needed.'
    );
  }

  /**
   * Get blocked attempts report
   */
  static getBlockedAttempts() {
    return this.blockedAttempts;
  }

  /**
   * Clear blocked attempts log
   */
  static clearBlockedAttempts() {
    this.blockedAttempts = [];
  }
}

/**
 * Sandbox EDI Gateway
 */
export class SandboxEDIGateway {
  private mode: string;
  private responseDelayMs: number;
  private errorRate: number;
  private sandboxPrefix: string;

  constructor() {
    this.mode = process.env.EDI_MODE || 'sandbox';
    this.responseDelayMs = parseInt(process.env.EDI_RESPONSE_DELAY_MS || '2000');
    this.errorRate = parseFloat(process.env.EDI_ERROR_RATE || '0.05'); // 5% error rate
    this.sandboxPrefix = process.env.EDI_SANDBOX_PREFIX || 'SANDBOX';
  }

  /**
   * Check if sandbox mode is enabled
   */
  isSandboxMode(): boolean {
    return this.mode === 'sandbox' || process.env.NODE_ENV === 'development';
  }

  /**
   * Simulate network delay
   */
  private async simulateDelay(): Promise<void> {
    const jitter = Math.random() * 1000; // 0-1 second jitter
    const delay = this.responseDelayMs + jitter;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Determine if request should simulate error
   */
  private shouldSimulateError(): boolean {
    return Math.random() < this.errorRate;
  }

  /**
   * Submit claim through sandbox
   */
  async submitClaim(
    claim: Claim,
    insurerName: string,
    connector: string,
    orgId: string,
    userId: string,
    url?: string
  ): Promise<any> {
    // Check if trying to reach production
    if (url && NetworkInterceptor.isProductionEndpoint(url)) {
      await NetworkInterceptor.blockProductionRequest(url, 'POST', orgId, userId);
    }

    // Log submission
    logger.info('📤 SANDBOX EDI Submission', {
      claimId: claim.id,
      insurerName,
      connector,
      orgId,
      mode: 'sandbox',
    });

    // Simulate processing delay
    await this.simulateDelay();

    // Simulate error scenario
    if (this.shouldSimulateError()) {
      const errorResponse = {
        status: 'error',
        externalId: `${this.sandboxPrefix}-ERR-${Date.now()}`,
        message: 'SANDBOX: Simulated network error',
        errorCode: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      };

      logger.warn('⚠️ SANDBOX Simulated Error', errorResponse);
      
      await storage.createAuditEvent({
        orgId,
        actorUserId: userId,
        type: 'edi_sandbox_error',
        details: errorResponse,
        ip: '0.0.0.0',
        userAgent: 'EDI-Sandbox',
      });

      throw new Error(errorResponse.message);
    }

    // Generate mock response
    const response = await getMockInsurerResponse(insurerName, claim, connector);
    
    // Add sandbox identifiers
    const sandboxResponse = {
      ...response,
      externalId: `${this.sandboxPrefix}-${response.externalId}`,
      environment: 'SANDBOX',
      warning: 'This is a SANDBOX response - not connected to production systems',
      timestamp: new Date().toISOString(),
    };

    // Log successful response
    logger.info('✅ SANDBOX EDI Response', {
      claimId: claim.id,
      externalId: sandboxResponse.externalId,
      status: sandboxResponse.status,
    });

    // Create audit event
    await storage.createAuditEvent({
      orgId,
      actorUserId: userId,
      type: 'edi_sandbox_submission',
      details: {
        claimId: claim.id,
        insurerName,
        connector,
        externalId: sandboxResponse.externalId,
        status: sandboxResponse.status,
      },
      ip: '0.0.0.0',
      userAgent: 'EDI-Sandbox',
    });

    return sandboxResponse;
  }

  /**
   * Poll claim status through sandbox
   */
  async pollStatus(
    externalId: string,
    insurerName: string,
    orgId: string,
    userId: string,
    url?: string
  ): Promise<any> {
    // Check if trying to reach production
    if (url && NetworkInterceptor.isProductionEndpoint(url)) {
      await NetworkInterceptor.blockProductionRequest(url, 'GET', orgId, userId);
    }

    // Simulate processing delay
    await this.simulateDelay();

    // Generate status response
    const statuses = ['pending', 'processing', 'paid', 'denied', 'infoRequested'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    const statusResponse = {
      externalId,
      status: randomStatus,
      environment: 'SANDBOX',
      message: `SANDBOX: Claim is ${randomStatus}`,
      lastUpdated: new Date().toISOString(),
      details: generateSandboxResponse(randomStatus, insurerName),
    };

    logger.info('🔄 SANDBOX Status Poll', {
      externalId,
      status: statusResponse.status,
      orgId,
    });

    return statusResponse;
  }

  /**
   * Validate EDI configuration
   */
  async validateConfiguration(config: any, orgId: string): Promise<boolean> {
    if (!this.isSandboxMode()) {
      throw new Error('Sandbox validation called in production mode');
    }

    logger.info('🔍 SANDBOX Configuration Validation', {
      orgId,
      config: { ...config, credentials: '[REDACTED]' },
    });

    // Always return valid in sandbox mode
    return true;
  }

  /**
   * Get sandbox statistics
   */
  getStatistics() {
    return {
      mode: this.mode,
      blockedAttempts: NetworkInterceptor.getBlockedAttempts().length,
      responseDelayMs: this.responseDelayMs,
      errorRate: this.errorRate,
      sandboxPrefix: this.sandboxPrefix,
      isSandbox: this.isSandboxMode(),
    };
  }

  /**
   * Create synthetic tracking number
   */
  generateTrackingNumber(type: string = 'CLAIM'): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${this.sandboxPrefix}-${type}-${timestamp}-${random}`;
  }

  /**
   * Check if network request is allowed
   */
  async isRequestAllowed(url: string): Promise<boolean> {
    if (!this.isSandboxMode()) {
      return true; // Allow all in production
    }

    // Check allowlist
    const allowlist = (process.env.EDI_NETWORK_ALLOWLIST || 'localhost,*.sandbox.test').split(',');
    const urlLower = url.toLowerCase();

    const isAllowed = allowlist.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(urlLower);
      }
      return urlLower.includes(pattern);
    });

    if (!isAllowed && !NetworkInterceptor.isProductionEndpoint(url)) {
      logger.warn('⚠️ SANDBOX Network Request to unlisted domain', { url });
    }

    return isAllowed;
  }
}

// Export singleton instance
export const sandboxGateway = new SandboxEDIGateway();

// Export for testing
export { NetworkInterceptor as TestNetworkInterceptor };