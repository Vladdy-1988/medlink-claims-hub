/**
 * Sandbox Insurance Carrier Simulator
 * Provides deterministic behavior for testing EDI connectors
 */

import { ConnectorError } from '../lib/errors';

export interface SimulatorResult {
  status: 'pending' | 'infoRequested' | 'paid' | 'denied';
  message?: string;
  details?: any;
}

/**
 * CDAnet sandbox simulator with deterministic rules
 */
export function simulateCDAnetResponse(claimAmount: number, claimId: string): SimulatorResult {
  // Extract last two digits of amount for deterministic behavior
  const amountStr = claimAmount.toFixed(2);
  const lastTwoDigits = amountStr.slice(-2);

  switch (lastTwoDigits) {
    case '00':
      return {
        status: 'paid',
        message: 'Claim approved and paid',
        details: {
          paidAmount: claimAmount,
          paymentDate: new Date().toISOString(),
          referenceNumber: `CDANET-${claimId}-PAID`,
        },
      };

    case '13':
      return {
        status: 'infoRequested',
        message: 'Additional information required',
        details: {
          requiredInfo: ['Patient medical history', 'Treatment plan'],
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
          referenceNumber: `CDANET-${claimId}-INFO`,
        },
      };

    case '99':
      return {
        status: 'denied',
        message: 'Claim denied - treatment not covered',
        details: {
          denialCode: 'NC001',
          denialReason: 'Treatment not covered under current policy',
          referenceNumber: `CDANET-${claimId}-DENIED`,
        },
      };

    default:
      return {
        status: 'pending',
        message: 'Claim submitted and under review',
        details: {
          estimatedProcessingDays: 5,
          referenceNumber: `CDANET-${claimId}-PENDING`,
        },
      };
  }
}

/**
 * TELUS eClaims sandbox simulator with deterministic rules
 */
export function simulateEClaimsResponse(claimAmount: number, claimId: string): SimulatorResult {
  // Extract last two digits of amount for deterministic behavior
  const amountStr = claimAmount.toFixed(2);
  const lastTwoDigits = amountStr.slice(-2);

  switch (lastTwoDigits) {
    case '00':
      return {
        status: 'paid',
        message: 'Electronic claim processed and paid',
        details: {
          paidAmount: claimAmount,
          paymentDate: new Date().toISOString(),
          eobNumber: `EOB-${claimId}-${Date.now()}`,
          referenceNumber: `TELUS-${claimId}-PAID`,
        },
      };

    case '13':
      return {
        status: 'infoRequested',
        message: 'Provider review required',
        details: {
          reviewType: 'clinical_review',
          requiredDocuments: ['Clinical notes', 'Lab results'],
          submissionDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
          referenceNumber: `TELUS-${claimId}-REVIEW`,
        },
      };

    case '99':
      return {
        status: 'denied',
        message: 'Claim rejected - duplicate submission',
        details: {
          rejectionCode: 'DUP002',
          rejectionReason: 'Duplicate claim submission detected',
          originalClaimRef: `TELUS-${claimId.slice(0, 8)}-ORIG`,
          referenceNumber: `TELUS-${claimId}-REJECTED`,
        },
      };

    default:
      return {
        status: 'pending',
        message: 'Electronic claim queued for processing',
        details: {
          queuePosition: Math.floor(Math.random() * 100) + 1,
          estimatedProcessingHours: 24,
          referenceNumber: `TELUS-${claimId}-QUEUED`,
        },
      };
  }
}

/**
 * Validate mock token for sandbox OAuth simulation
 */
export function validateSandboxToken(token: string): boolean {
  // Simple sandbox token validation - accepts any token starting with 'sandbox_'
  return token?.startsWith('sandbox_') && token.length > 10;
}

/**
 * Generate sandbox OAuth token
 */
export function generateSandboxToken(clientId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `sandbox_${clientId}_${timestamp}_${random}`;
}

/**
 * Simulate processing delay for sandbox requests
 */
export function simulateProcessingDelay(): Promise<void> {
  const delay = Math.random() * 500 + 300; // 300-800ms delay
  return new Promise(resolve => setTimeout(resolve, delay));
}