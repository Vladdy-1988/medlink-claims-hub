/**
 * Base Connector Interface and Factory
 * Common interface for all EDI connectors (CDAnet, eClaims, Portal)
 */

import { ConnectorError } from '../lib/errors';
import { db } from '../db';
import { connectorConfigs, organizations } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export interface SubmitResult {
  externalId: string;
  status: 'submitted' | 'error';
  message?: string;
  raw?: any;
}

export interface PollResult {
  status: 'pending' | 'infoRequested' | 'paid' | 'denied';
  payload?: any;
}

export interface Connector {
  /**
   * Validate claim data before submission
   */
  validate(claim: any): Promise<void>;

  /**
   * Submit claim to external system
   */
  submitClaim(claim: any): Promise<SubmitResult>;

  /**
   * Poll status of submitted claim
   */
  pollStatus(externalId: string): Promise<PollResult>;
}

/**
 * Get connector instance for organization
 */
export async function getConnector(
  name: 'cdanet' | 'eclaims' | 'portal', 
  orgId: string
): Promise<Connector> {
  
  // Import connector implementations dynamically
  switch (name) {
    case 'cdanet': {
      const module = await import('./cdanet-itrans.js');
      return new module.CDAnetITransConnector(orgId);
    }
    case 'eclaims': {
      const module = await import('./telus-eclaims.js');
      return new module.TelusEClaimsConnector(orgId);
    }
    case 'portal': {
      const { PortalConnector } = await import('./portal');
      return new PortalConnector(orgId);
    }
    default:
      throw new ConnectorError('VALIDATION_ERROR', `Unknown connector: ${name}`);
  }
}

/**
 * Base connector class with common functionality
 */
export abstract class BaseConnector implements Connector {
  protected orgId: string;
  protected config: any = {};

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  /**
   * Load connector configuration for organization
   */
  protected async loadConfig(connectorName: 'cdanet' | 'eclaims'): Promise<any> {
    const [connectorConfig] = await db
      .select()
      .from(connectorConfigs)
      .where(
        and(
          eq(connectorConfigs.orgId, this.orgId),
          eq(connectorConfigs.name, connectorName)
        )
      );

    if (!connectorConfig || !connectorConfig.enabled) {
      throw new ConnectorError(
        'VALIDATION_ERROR', 
        `${connectorName} connector not enabled for organization`
      );
    }

    return {
      ...(connectorConfig.settings as any || {}),
      mode: connectorConfig.mode,
      enabled: connectorConfig.enabled,
    };
  }

  /**
   * Get organization details
   */
  protected async getOrganization() {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, this.orgId));

    if (!org) {
      throw new ConnectorError('VALIDATION_ERROR', `Organization ${this.orgId} not found`);
    }

    return org;
  }

  /**
   * Check if running in sandbox mode
   */
  protected isSandboxMode(): boolean {
    return process.env.CONNECTORS_MODE === 'sandbox';
  }

  /**
   * Log debug message if debug logging is enabled
   */
  protected debug(message: string, ...args: any[]): void {
    if (process.env.CONNECTOR_LOG_LEVEL === 'debug') {
      console.log(`[${this.constructor.name}] ${message}`, ...args);
    }
  }

  /**
   * Log info message
   */
  protected info(message: string, ...args: any[]): void {
    const logLevel = process.env.CONNECTOR_LOG_LEVEL || 'info';
    if (['debug', 'info'].includes(logLevel)) {
      console.log(`[${this.constructor.name}] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   */
  protected warn(message: string, ...args: any[]): void {
    const logLevel = process.env.CONNECTOR_LOG_LEVEL || 'info';
    if (['debug', 'info', 'warn'].includes(logLevel)) {
      console.warn(`[${this.constructor.name}] ${message}`, ...args);
    }
  }

  /**
   * Log error message
   */
  protected error(message: string, ...args: any[]): void {
    console.error(`[${this.constructor.name}] ${message}`, ...args);
  }

  // Abstract methods that must be implemented by subclasses
  abstract validate(claim: any): Promise<void>;
  abstract submitClaim(claim: any): Promise<SubmitResult>;
  abstract pollStatus(externalId: string): Promise<PollResult>;
}

