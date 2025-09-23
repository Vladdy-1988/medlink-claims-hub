/**
 * EDI Main Router
 * Routes EDI requests based on environment configuration
 */

import { sandboxGateway, NetworkInterceptor } from './sandbox';
import { getAllInsurers, isInsurerSupported } from './mockInsurers';
import { logger } from '../security/logger';
import { storage } from '../storage';
import type { Connector } from '../connectors/base';
import type { Claim } from '@shared/schema';

/**
 * EDI Mode Configuration
 */
export enum EDIMode {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

/**
 * Get current EDI mode
 */
export function getEDIMode(): EDIMode {
  const mode = process.env.EDI_MODE || 'sandbox';
  
  // Force sandbox in development
  if (process.env.NODE_ENV === 'development') {
    return EDIMode.SANDBOX;
  }
  
  // Force sandbox if block production is enabled
  if (process.env.EDI_BLOCK_PRODUCTION === 'true') {
    return EDIMode.SANDBOX;
  }
  
  return mode === 'production' ? EDIMode.PRODUCTION : EDIMode.SANDBOX;
}

/**
 * EDI Router - Main entry point for all EDI operations
 */
export class EDIRouter {
  private mode: EDIMode;
  private auditEnabled: boolean;

  constructor() {
    this.mode = getEDIMode();
    this.auditEnabled = process.env.EDI_AUDIT_ENABLED !== 'false';
    
    logger.info('🚀 EDI Router initialized', {
      mode: this.mode,
      auditEnabled: this.auditEnabled,
      blockProduction: process.env.EDI_BLOCK_PRODUCTION === 'true',
      sandboxPrefix: process.env.EDI_SANDBOX_PREFIX || 'SANDBOX',
    });
  }

  /**
   * Check if system is in sandbox mode
   */
  isSandboxMode(): boolean {
    return this.mode === EDIMode.SANDBOX;
  }

  /**
   * Submit claim through appropriate channel
   */
  async submitClaim(
    claim: Claim,
    connector: Connector,
    orgId: string,
    userId: string
  ): Promise<any> {
    try {
      // Get insurer information
      const insurer = await storage.getInsurer(claim.insurerId);
      if (!insurer) {
        throw new Error(`Insurer not found: ${claim.insurerId}`);
      }

      // Log submission attempt
      await this.logEDIAttempt('submit_claim', {
        claimId: claim.id,
        insurerName: insurer.name,
        connector: connector.constructor.name,
        orgId,
        userId,
        mode: this.mode,
      });

      // Route based on mode
      if (this.isSandboxMode()) {
        // Use sandbox gateway for all submissions
        return await sandboxGateway.submitClaim(
          claim,
          insurer.name,
          connector.constructor.name,
          orgId,
          userId
        );
      } else {
        // Production mode - use real connector
        logger.warn('⚠️ PRODUCTION MODE: Submitting real claim', {
          claimId: claim.id,
          insurerName: insurer.name,
        });
        
        // Additional production safety check
        if (process.env.EDI_PRODUCTION_CONFIRMED !== 'true') {
          throw new Error(
            'Production EDI submission blocked. Set EDI_PRODUCTION_CONFIRMED=true to enable.'
          );
        }
        
        return await connector.submitClaim(claim);
      }
    } catch (error) {
      // Log error
      await this.logEDIError('submit_claim_error', {
        claimId: claim.id,
        error: error instanceof Error ? error.message : String(error),
        orgId,
        userId,
      });
      
      throw error;
    }
  }

  /**
   * Poll claim status
   */
  async pollStatus(
    externalId: string,
    connector: Connector,
    insurerName: string,
    orgId: string,
    userId: string
  ): Promise<any> {
    try {
      // Log poll attempt
      await this.logEDIAttempt('poll_status', {
        externalId,
        insurerName,
        connector: connector.constructor.name,
        orgId,
        userId,
        mode: this.mode,
      });

      // Route based on mode
      if (this.isSandboxMode()) {
        return await sandboxGateway.pollStatus(
          externalId,
          insurerName,
          orgId,
          userId
        );
      } else {
        // Production mode
        logger.warn('⚠️ PRODUCTION MODE: Polling real status', {
          externalId,
          insurerName,
        });
        
        return await connector.pollStatus(externalId);
      }
    } catch (error) {
      // Log error
      await this.logEDIError('poll_status_error', {
        externalId,
        error: error instanceof Error ? error.message : String(error),
        orgId,
        userId,
      });
      
      throw error;
    }
  }

  /**
   * Validate claim before submission
   */
  async validateClaim(
    claim: Claim,
    connector: Connector
  ): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // Always validate through connector
      await connector.validate(claim);
      
      // Additional sandbox validations
      if (this.isSandboxMode()) {
        const insurer = await storage.getInsurer(claim.insurerId);
        if (insurer && !isInsurerSupported(insurer.name)) {
          return {
            valid: false,
            errors: [`Insurer ${insurer.name} not supported in sandbox mode`],
          };
        }
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Check if URL is allowed
   */
  async isURLAllowed(url: string): Promise<boolean> {
    if (!this.isSandboxMode()) {
      return true; // All URLs allowed in production
    }
    
    // Check if production endpoint
    if (NetworkInterceptor.isProductionEndpoint(url)) {
      logger.error('🚫 Production URL blocked in sandbox mode', { url });
      return false;
    }
    
    // Check against allowlist
    return await sandboxGateway.isRequestAllowed(url);
  }

  /**
   * Get list of supported insurers
   */
  getSupportedInsurers(): string[] {
    if (this.isSandboxMode()) {
      return getAllInsurers();
    }
    
    // In production, return all insurers from database
    // This would be fetched from storage in a real implementation
    return getAllInsurers(); // For now, return same list
  }

  /**
   * Get EDI statistics
   */
  async getStatistics(): Promise<any> {
    const stats = {
      mode: this.mode,
      isSandbox: this.isSandboxMode(),
      timestamp: new Date().toISOString(),
    };

    if (this.isSandboxMode()) {
      return {
        ...stats,
        sandbox: sandboxGateway.getStatistics(),
        supportedInsurers: this.getSupportedInsurers().length,
      };
    }

    return {
      ...stats,
      productionMode: true,
      warning: 'Production statistics not available in this view',
    };
  }

  /**
   * Generate tracking number
   */
  generateTrackingNumber(type: string = 'CLAIM'): string {
    if (this.isSandboxMode()) {
      return sandboxGateway.generateTrackingNumber(type);
    }
    
    // Production tracking number (without SANDBOX prefix)
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Log EDI attempt
   */
  private async logEDIAttempt(type: string, details: any): Promise<void> {
    if (!this.auditEnabled) return;

    logger.info(`📋 EDI Attempt: ${type}`, details);

    if (details.orgId && details.userId) {
      await storage.createAuditEvent({
        orgId: details.orgId,
        actorUserId: details.userId,
        type: `edi_${type}`,
        details,
        ip: '0.0.0.0',
        userAgent: 'EDI-Router',
      });
    }
  }

  /**
   * Log EDI error
   */
  private async logEDIError(type: string, details: any): Promise<void> {
    logger.error(`❌ EDI Error: ${type}`, details);

    if (details.orgId && details.userId) {
      await storage.createAuditEvent({
        orgId: details.orgId,
        actorUserId: details.userId,
        type: `edi_error_${type}`,
        details,
        ip: '0.0.0.0',
        userAgent: 'EDI-Router',
      });
    }
  }

  /**
   * Clear blocked attempts (for testing/admin)
   */
  clearBlockedAttempts(): void {
    if (this.isSandboxMode()) {
      NetworkInterceptor.clearBlockedAttempts();
      logger.info('🧹 Cleared blocked production attempts log');
    }
  }

  /**
   * Get blocked attempts report
   */
  getBlockedAttempts(): any[] {
    if (this.isSandboxMode()) {
      return NetworkInterceptor.getBlockedAttempts();
    }
    return [];
  }
}

// Export singleton instance
export const ediRouter = new EDIRouter();

// Re-export useful functions
export { sandboxGateway, NetworkInterceptor };
export { getAllInsurers, isInsurerSupported, getInsurersByRail } from './mockInsurers';
export { generateSandboxClaimNumber, generateSandboxReferenceNumber } from './responses';

// Export for testing
export { EDIRouter as TestEDIRouter };