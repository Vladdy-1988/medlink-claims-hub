/**
 * Mock Insurer Responses
 * Provides realistic mock responses for all 24 Canadian insurers
 */

import type { Claim } from '@shared/schema';
import { generateClaimResponse, generatePreAuthResponse } from './responses';

// Insurer-specific response configurations
const INSURER_CONFIGS = {
  // TELUS eClaims Rail Insurers
  'Manulife Financial': {
    rail: 'telusEclaims',
    processingTime: 3000,
    approvalRate: 0.85,
    requiresAdditionalInfo: 0.1,
    responseFormats: ['JSON', 'XML'],
    supportedClaimTypes: ['medical', 'dental', 'vision', 'drug'],
  },
  'Sun Life Financial': {
    rail: 'telusEclaims',
    processingTime: 2500,
    approvalRate: 0.82,
    requiresAdditionalInfo: 0.12,
    responseFormats: ['JSON'],
    supportedClaimTypes: ['medical', 'dental', 'drug'],
  },
  'Blue Cross Canada': {
    rail: 'telusEclaims',
    processingTime: 2000,
    approvalRate: 0.88,
    requiresAdditionalInfo: 0.08,
    responseFormats: ['JSON', 'XML'],
    supportedClaimTypes: ['medical', 'dental', 'vision', 'drug', 'travel'],
  },
  'Desjardins Group': {
    rail: 'telusEclaims',
    processingTime: 3500,
    approvalRate: 0.80,
    requiresAdditionalInfo: 0.15,
    responseFormats: ['JSON'],
    supportedClaimTypes: ['medical', 'dental', 'drug'],
  },
  'GreenShield Canada': {
    rail: 'telusEclaims',
    processingTime: 2200,
    approvalRate: 0.86,
    requiresAdditionalInfo: 0.09,
    responseFormats: ['JSON', 'XML'],
    supportedClaimTypes: ['medical', 'dental', 'vision', 'drug', 'paramedical'],
  },
  'Canada Life': {
    rail: 'telusEclaims',
    processingTime: 2800,
    approvalRate: 0.83,
    requiresAdditionalInfo: 0.11,
    responseFormats: ['JSON'],
    supportedClaimTypes: ['medical', 'dental', 'drug'],
  },
  'Empire Life': {
    rail: 'telusEclaims',
    processingTime: 3200,
    approvalRate: 0.79,
    requiresAdditionalInfo: 0.14,
    responseFormats: ['JSON'],
    supportedClaimTypes: ['medical', 'dental'],
  },
  'Industrial Alliance': {
    rail: 'telusEclaims',
    processingTime: 2600,
    approvalRate: 0.84,
    requiresAdditionalInfo: 0.10,
    responseFormats: ['JSON', 'XML'],
    supportedClaimTypes: ['medical', 'dental', 'drug', 'life'],
  },
  'Equitable Life': {
    rail: 'telusEclaims',
    processingTime: 3100,
    approvalRate: 0.81,
    requiresAdditionalInfo: 0.13,
    responseFormats: ['JSON'],
    supportedClaimTypes: ['medical', 'dental'],
  },
  'RBC Insurance': {
    rail: 'telusEclaims',
    processingTime: 2400,
    approvalRate: 0.87,
    requiresAdditionalInfo: 0.07,
    responseFormats: ['JSON', 'XML'],
    supportedClaimTypes: ['medical', 'dental', 'drug', 'travel'],
  },
  'TD Insurance': {
    rail: 'telusEclaims',
    processingTime: 2300,
    approvalRate: 0.88,
    requiresAdditionalInfo: 0.06,
    responseFormats: ['JSON', 'XML'],
    supportedClaimTypes: ['medical', 'dental', 'drug', 'travel'],
  },

  // CDAnet Rail Insurers
  'SSQ Insurance': {
    rail: 'cdanet',
    processingTime: 4000,
    approvalRate: 0.78,
    requiresAdditionalInfo: 0.16,
    responseFormats: ['CDAnet'],
    supportedClaimTypes: ['dental'],
  },
  'Medavie Blue Cross': {
    rail: 'cdanet',
    processingTime: 3800,
    approvalRate: 0.82,
    requiresAdditionalInfo: 0.12,
    responseFormats: ['CDAnet', 'XML'],
    supportedClaimTypes: ['dental', 'medical'],
  },
  'Pacific Blue Cross': {
    rail: 'cdanet',
    processingTime: 3600,
    approvalRate: 0.85,
    requiresAdditionalInfo: 0.10,
    responseFormats: ['CDAnet', 'XML'],
    supportedClaimTypes: ['dental', 'medical', 'vision'],
  },
  'Alberta Blue Cross': {
    rail: 'cdanet',
    processingTime: 3400,
    approvalRate: 0.86,
    requiresAdditionalInfo: 0.09,
    responseFormats: ['CDAnet', 'XML'],
    supportedClaimTypes: ['dental', 'medical', 'drug'],
  },
  'Saskatchewan Blue Cross': {
    rail: 'cdanet',
    processingTime: 3700,
    approvalRate: 0.83,
    requiresAdditionalInfo: 0.11,
    responseFormats: ['CDAnet'],
    supportedClaimTypes: ['dental', 'medical'],
  },
  'Manitoba Blue Cross': {
    rail: 'cdanet',
    processingTime: 3500,
    approvalRate: 0.84,
    requiresAdditionalInfo: 0.10,
    responseFormats: ['CDAnet'],
    supportedClaimTypes: ['dental', 'medical'],
  },

  // Portal Rail Insurers (Workers Compensation)
  'WSIB Ontario': {
    rail: 'portal',
    processingTime: 5000,
    approvalRate: 0.75,
    requiresAdditionalInfo: 0.20,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury', 'occupational_disease'],
  },
  'WorkSafeBC': {
    rail: 'portal',
    processingTime: 4800,
    approvalRate: 0.77,
    requiresAdditionalInfo: 0.18,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury', 'occupational_disease'],
  },
  'WCB Alberta': {
    rail: 'portal',
    processingTime: 4600,
    approvalRate: 0.78,
    requiresAdditionalInfo: 0.17,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury', 'occupational_disease'],
  },
  'CNESST Quebec': {
    rail: 'portal',
    processingTime: 5200,
    approvalRate: 0.74,
    requiresAdditionalInfo: 0.22,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury', 'occupational_disease'],
  },
  'WCB Manitoba': {
    rail: 'portal',
    processingTime: 4700,
    approvalRate: 0.76,
    requiresAdditionalInfo: 0.19,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury'],
  },
  'WCB Saskatchewan': {
    rail: 'portal',
    processingTime: 4900,
    approvalRate: 0.75,
    requiresAdditionalInfo: 0.20,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury'],
  },
  'WorkplaceNL': {
    rail: 'portal',
    processingTime: 5100,
    approvalRate: 0.73,
    requiresAdditionalInfo: 0.21,
    responseFormats: ['Portal', 'PDF'],
    supportedClaimTypes: ['workplace_injury', 'occupational_disease'],
  },
};

/**
 * Get mock insurer response
 */
export async function getMockInsurerResponse(
  insurerName: string,
  claim: Claim,
  connector: string
): Promise<any> {
  const config = INSURER_CONFIGS[insurerName as keyof typeof INSURER_CONFIGS];
  
  if (!config) {
    throw new Error(`Unknown insurer: ${insurerName}`);
  }

  // Simulate processing time with variance
  const processingTime = config.processingTime + (Math.random() * 1000 - 500);
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Determine response status
  const random = Math.random();
  let status: string;
  let response: any;

  if (random < config.approvalRate) {
    status = 'accepted';
  } else if (random < config.approvalRate + config.requiresAdditionalInfo) {
    status = 'infoRequested';
  } else {
    status = 'denied';
  }

  // Generate appropriate response based on claim type
  if (claim.type === 'preauth') {
    response = generatePreAuthResponse(status, insurerName, claim, config.rail);
  } else {
    response = generateClaimResponse(status, insurerName, claim, config.rail);
  }

  // Add insurer-specific details
  response = {
    ...response,
    insurer: {
      name: insurerName,
      rail: config.rail,
      responseFormat: config.responseFormats[0],
      processingTimeMs: Math.round(processingTime),
    },
    metadata: {
      supportedClaimTypes: config.supportedClaimTypes,
      requiresElectronicSignature: config.rail === 'portal',
      maxFileSize: config.rail === 'portal' ? '10MB' : '5MB',
      acceptedFileTypes: ['PDF', 'JPEG', 'PNG'],
    },
  };

  // Add rail-specific fields
  switch (config.rail) {
    case 'cdanet':
      response.cdanet = {
        transactionNumber: generateTransactionNumber('CDN'),
        networkStatus: 'ONLINE',
        version: '04',
        encryptionUsed: true,
      };
      break;
    case 'telusEclaims':
      response.telus = {
        batchNumber: generateTransactionNumber('TEL'),
        transmissionId: generateTransactionNumber('TX'),
        apiVersion: '2.0',
        region: 'CANADA',
      };
      break;
    case 'portal':
      response.portal = {
        caseNumber: generateTransactionNumber('WCB'),
        adjudicator: `Adjudicator-${Math.floor(Math.random() * 100)}`,
        priority: claim.amount && parseFloat(claim.amount) > 5000 ? 'HIGH' : 'NORMAL',
        reviewRequired: Math.random() > 0.7,
      };
      break;
  }

  return response;
}

/**
 * Generate transaction number with prefix
 */
function generateTransactionNumber(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `SANDBOX-${prefix}-${timestamp}-${random}`;
}

/**
 * Get all supported insurers
 */
export function getAllInsurers(): string[] {
  return Object.keys(INSURER_CONFIGS);
}

/**
 * Get insurers by rail
 */
export function getInsurersByRail(rail: string): string[] {
  return Object.entries(INSURER_CONFIGS)
    .filter(([_, config]) => config.rail === rail)
    .map(([name, _]) => name);
}

/**
 * Validate insurer support
 */
export function isInsurerSupported(insurerName: string): boolean {
  return insurerName in INSURER_CONFIGS;
}

/**
 * Get insurer configuration
 */
export function getInsurerConfig(insurerName: string) {
  return INSURER_CONFIGS[insurerName as keyof typeof INSURER_CONFIGS];
}

// Export for testing
export { INSURER_CONFIGS as TestInsurerConfigs };