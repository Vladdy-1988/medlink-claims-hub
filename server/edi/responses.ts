/**
 * EDI Response Templates
 * Generates realistic mock responses for different claim scenarios
 */

import type { Claim } from '@shared/schema';
import crypto from 'node:crypto';

/**
 * Generate unique sandbox claim number
 */
export function generateSandboxClaimNumber(): string {
  const prefix = process.env.EDI_SANDBOX_PREFIX || 'SANDBOX';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-CLM-${timestamp}-${random}`;
}

/**
 * Generate sandbox reference number
 */
export function generateSandboxReferenceNumber(type: string = 'REF'): string {
  const prefix = process.env.EDI_SANDBOX_PREFIX || 'SANDBOX';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `${prefix}-${type}-${timestamp}-${random}`;
}

/**
 * Generate claim response based on status
 */
export function generateClaimResponse(
  status: string,
  insurerName: string,
  claim: Claim,
  rail: string
): any {
  const claimNumber = generateSandboxClaimNumber();
  const referenceNumber = generateSandboxReferenceNumber();
  const amount = claim.amount ? parseFloat(claim.amount) : 0;

  const baseResponse = {
    claimNumber,
    referenceNumber,
    status,
    externalId: referenceNumber,
    submittedAt: new Date().toISOString(),
    insurerName,
    environment: 'SANDBOX',
  };

  switch (status) {
    case 'accepted':
    case 'paid':
      return {
        ...baseResponse,
        status: 'paid',
        approvedAmount: amount.toFixed(2),
        paidAmount: (amount * 0.8).toFixed(2), // 80% coverage
        deductibleApplied: (amount * 0.1).toFixed(2),
        coinsurance: (amount * 0.1).toFixed(2),
        paymentMethod: 'EFT',
        paymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        remittanceAdvice: generateRemittanceAdvice(claim, insurerName, amount),
        explanationOfBenefits: {
          coveragePercentage: 80,
          deductibleMet: true,
          outOfPocketMax: '5000.00',
          outOfPocketUsed: '1250.00',
          benefitPeriod: new Date().getFullYear().toString(),
        },
      };

    case 'denied':
    case 'rejected':
      return {
        ...baseResponse,
        status: 'denied',
        denialReason: generateDenialReason(),
        denialCode: generateDenialCode(),
        appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        appealInstructions: 'To appeal this decision, submit additional documentation within 30 days.',
        alternativeBenefits: 'You may be eligible for alternative coverage. Contact member services.',
      };

    case 'infoRequested':
    case 'pending':
      return {
        ...baseResponse,
        status: 'infoRequested',
        requestedInformation: generateInfoRequest(claim.type),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        submissionInstructions: 'Submit requested documentation through the provider portal.',
        contactInfo: {
          phone: '1-800-SANDBOX',
          email: 'sandbox@medlinkclaims.test',
          portal: 'https://sandbox.medlinkclaims.test/submit-docs',
        },
      };

    case 'processing':
      return {
        ...baseResponse,
        status: 'processing',
        estimatedCompletionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        currentStage: 'Medical Review',
        percentComplete: Math.floor(Math.random() * 70) + 20, // 20-90%
        lastUpdated: new Date().toISOString(),
      };

    default:
      return {
        ...baseResponse,
        status: 'pending',
        message: 'Claim received and queued for processing',
        queuePosition: Math.floor(Math.random() * 100) + 1,
        estimatedProcessingTime: '24-48 hours',
      };
  }
}

/**
 * Generate pre-authorization response
 */
export function generatePreAuthResponse(
  status: string,
  insurerName: string,
  claim: Claim,
  rail: string
): any {
  const authNumber = generateSandboxReferenceNumber('AUTH');
  const response = generateClaimResponse(status, insurerName, claim, rail);

  return {
    ...response,
    authorizationNumber: authNumber,
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    authorizedServices: claim.codes ? [claim.codes] : [],
    restrictions: status === 'accepted' ? [] : ['Requires specialist referral'],
    maxAuthorizedAmount: claim.amount,
  };
}

/**
 * Generate remittance advice
 */
function generateRemittanceAdvice(claim: Claim, insurerName: string, amount: number): any {
  const claimCodes = Array.isArray(claim.codes) ? (claim.codes as Array<Record<string, unknown>>) : [];
  const procedureCode =
    typeof claimCodes[0]?.procedure === 'string' ? (claimCodes[0].procedure as string) : 'UNKNOWN';

  return {
    statementDate: new Date().toISOString(),
    statementNumber: generateSandboxReferenceNumber('RMT'),
    provider: {
      name: 'SANDBOX Provider',
      number: 'PROV-12345',
      taxId: 'XXX-XX-XXXX',
    },
    patient: {
      name: 'SANDBOX Patient',
      memberId: 'MEMBER-' + Math.floor(Math.random() * 999999),
      groupNumber: 'GROUP-' + Math.floor(Math.random() * 9999),
    },
    serviceDetails: {
      dateOfService: claim.createdAt || new Date().toISOString(),
      procedureCode,
      description: 'SANDBOX Medical Service',
      billedAmount: amount.toFixed(2),
      allowedAmount: (amount * 0.9).toFixed(2),
      deductible: (amount * 0.1).toFixed(2),
      coinsurance: (amount * 0.1).toFixed(2),
      copayment: '0.00',
      paidAmount: (amount * 0.8).toFixed(2),
    },
    totals: {
      totalBilled: amount.toFixed(2),
      totalAllowed: (amount * 0.9).toFixed(2),
      totalPaid: (amount * 0.8).toFixed(2),
      totalPatientResponsibility: (amount * 0.2).toFixed(2),
    },
    paymentInfo: {
      checkNumber: 'SANDBOX-CHK-' + Math.floor(Math.random() * 999999),
      paymentDate: new Date().toISOString(),
      paymentMethod: 'Electronic Funds Transfer',
    },
  };
}

/**
 * Generate denial reasons
 */
function generateDenialReason(): string {
  const reasons = [
    'Service not covered under current plan',
    'Pre-authorization required but not obtained',
    'Benefit maximum reached for the period',
    'Duplicate claim submission',
    'Service date outside coverage period',
    'Provider not in network',
    'Medical necessity not established',
    'Experimental or investigational treatment',
    'Coordination of benefits required',
    'Member not eligible on date of service',
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

/**
 * Generate denial codes
 */
function generateDenialCode(): string {
  const codes = [
    'COV001', // Coverage issue
    'AUTH001', // Authorization issue
    'MAX001', // Maximum reached
    'DUP001', // Duplicate
    'ELIG001', // Eligibility
    'NET001', // Network
    'MED001', // Medical necessity
    'EXP001', // Experimental
    'COB001', // Coordination of benefits
    'DOC001', // Documentation
  ];
  return codes[Math.floor(Math.random() * codes.length)];
}

/**
 * Generate information request
 */
function generateInfoRequest(claimType?: string): string[] {
  const baseRequests = [
    'Medical records for date of service',
    'Itemized invoice from provider',
    'Prescription details from pharmacy',
  ];

  const specificRequests = claimType === 'preauth' 
    ? [
        'Letter of medical necessity from treating physician',
        'Treatment plan and expected duration',
        'Previous treatment history',
      ]
    : [
        'Proof of payment or receipt',
        'Explanation of benefits from primary insurer',
        'Accident report if applicable',
      ];

  return [...baseRequests.slice(0, 2), ...specificRequests.slice(0, 1)];
}

/**
 * Generate sandbox response for status
 */
export function generateSandboxResponse(status: string, insurerName: string): any {
  const baseResponse = {
    timestamp: new Date().toISOString(),
    environment: 'SANDBOX',
    testMode: true,
    warning: 'This is a SANDBOX response - not connected to production systems',
  };

  switch (status) {
    case 'paid':
      return {
        ...baseResponse,
        message: `SANDBOX: Claim approved and paid by ${insurerName}`,
        paymentInfo: {
          amount: (Math.random() * 1000 + 100).toFixed(2),
          method: 'EFT',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

    case 'denied':
      return {
        ...baseResponse,
        message: `SANDBOX: Claim denied by ${insurerName}`,
        denialInfo: {
          reason: generateDenialReason(),
          code: generateDenialCode(),
          appealable: true,
        },
      };

    case 'infoRequested':
      return {
        ...baseResponse,
        message: `SANDBOX: Additional information requested by ${insurerName}`,
        requestInfo: {
          items: generateInfoRequest(),
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

    case 'processing':
      return {
        ...baseResponse,
        message: `SANDBOX: Claim being processed by ${insurerName}`,
        processingInfo: {
          stage: 'Review',
          percentComplete: Math.floor(Math.random() * 80) + 10,
          estimatedCompletion: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

    default:
      return {
        ...baseResponse,
        message: `SANDBOX: Claim in ${status} status with ${insurerName}`,
        statusInfo: {
          current: status,
          lastUpdated: new Date().toISOString(),
        },
      };
  }
}

// Export for testing
export const TestResponses = {
  generateSandboxClaimNumber,
  generateSandboxReferenceNumber,
  generateDenialReason,
  generateDenialCode,
  generateInfoRequest,
};
