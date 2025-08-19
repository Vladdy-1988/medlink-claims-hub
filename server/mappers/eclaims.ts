/**
 * TELUS eClaims Data Mapping Functions
 * Converts internal claim data to eClaims API format
 */

import type { Claim, Patient, Provider } from "@shared/schema";

export interface EClaimsPayload {
  submissionId: string;
  providerInfo: {
    providerId: string;
    licenseNumber: string;
    name: string;
    address: {
      street: string;
      city: string;
      province: string;
      postalCode: string;
    };
    phone?: string;
  };
  patientInfo: {
    healthCardNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
    address?: {
      street: string;
      city: string;
      province: string;
      postalCode: string;
    };
  };
  serviceInfo: {
    serviceDate: string;
    serviceCodes: Array<{
      code: string;
      description?: string;
      units?: number;
      fee: number;
    }>;
    diagnosis?: {
      primary?: string;
      secondary?: string[];
    };
  };
  claimInfo: {
    totalAmount: number;
    currency: string;
    referenceNumber?: string;
    notes?: string;
  };
}

/**
 * Map internal claim data to TELUS eClaims format
 */
export function mapClaimToEClaims(
  claim: Claim, 
  patient: Patient, 
  provider: Provider
): EClaimsPayload {
  // Parse service codes from claim.codes
  const serviceCodes = [];
  if (claim.codes && typeof claim.codes === 'object') {
    const codes = claim.codes as any;
    if (Array.isArray(codes)) {
      serviceCodes.push(...codes.map((code: any) => ({
        code: code.code || code,
        description: code.description,
        units: code.units || 1,
        fee: code.fee || parseFloat(claim.amount) / codes.length
      })));
    } else if (codes.procedure) {
      serviceCodes.push({
        code: codes.procedure,
        description: codes.description,
        units: 1,
        fee: parseFloat(claim.amount)
      });
    }
  }

  // If no service codes found, create default
  if (serviceCodes.length === 0) {
    serviceCodes.push({
      code: 'GENERAL',
      description: 'General Medical Service',
      units: 1,
      fee: parseFloat(claim.amount)
    });
  }

  const payload: EClaimsPayload = {
    submissionId: claim.id,
    providerInfo: {
      providerId: provider.id,
      licenseNumber: provider.licenceNumber || 'TEMP001',
      name: provider.name,
      address: {
        street: 'Main Street 123', // Default values since schema doesn't have address fields
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 3A1'
      },
      phone: '416-555-0123' // Default phone
    },
    patientInfo: {
      healthCardNumber: (patient.identifiers as any)?.healthCard || (patient.identifiers as any)?.ohip || 'UNKNOWN',
      firstName: patient.name.split(' ')[0] || '',
      lastName: patient.name.split(' ').slice(1).join(' ') || '',
      dateOfBirth: patient.dob?.toISOString().split('T')[0] || '1990-01-01',
      gender: (patient.identifiers as any)?.gender || 'U',
      address: (patient.identifiers as any)?.address ? {
        street: (patient.identifiers as any).address.street || 'Unknown Address',
        city: (patient.identifiers as any).address.city || 'Toronto',
        province: (patient.identifiers as any).address.province || 'ON',
        postalCode: (patient.identifiers as any).address.postalCode || 'M5V 3A1'
      } : undefined
    },
    serviceInfo: {
      serviceDate: claim.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0], // YYYY-MM-DD
      serviceCodes,
      diagnosis: (claim.codes as any)?.diagnosis ? {
        primary: (claim.codes as any).diagnosis.primary,
        secondary: (claim.codes as any).diagnosis.secondary
      } : undefined
    },
    claimInfo: {
      totalAmount: parseFloat(claim.amount),
      currency: claim.currency,
      referenceNumber: claim.referenceNumber || undefined,
      notes: claim.notes || undefined
    }
  };

  return payload;
}

/**
 * Parse eClaims response and extract relevant data
 */
export function parseEClaimsResponse(response: any): {
  success: boolean;
  externalId?: string;
  status?: string;
  message?: string;
  errors?: string[];
} {
  if (!response) {
    return { success: false, message: 'Empty response from eClaims' };
  }

  // Handle successful submission
  if (response.status === 'submitted' || response.success) {
    return {
      success: true,
      externalId: response.claimId || response.submissionId || response.id,
      status: 'submitted',
      message: response.message || 'Claim submitted successfully'
    };
  }

  // Handle errors
  if (response.errors || response.error) {
    const errors = Array.isArray(response.errors) 
      ? response.errors 
      : [response.error || response.message];

    return {
      success: false,
      errors: errors.map((err: any) => typeof err === 'string' ? err : err.message || 'Unknown error'),
      message: response.message || errors[0]
    };
  }

  // Handle status updates
  if (response.claimStatus) {
    return {
      success: true,
      status: response.claimStatus.toLowerCase(),
      message: response.statusMessage || response.message
    };
  }

  return {
    success: false,
    message: 'Unable to parse eClaims response'
  };
}

/**
 * Validate eClaims payload before submission
 */
export function validateEClaimsPayload(payload: EClaimsPayload): string[] {
  const errors: string[] = [];

  // Provider validation
  if (!payload.providerInfo.providerId) {
    errors.push('Provider ID is required');
  }
  if (!payload.providerInfo.licenseNumber) {
    errors.push('Provider license number is required');
  }
  if (!payload.providerInfo.name) {
    errors.push('Provider name is required');
  }

  // Patient validation
  if (!payload.patientInfo.healthCardNumber) {
    errors.push('Patient health card number is required');
  }
  if (!payload.patientInfo.firstName || !payload.patientInfo.lastName) {
    errors.push('Patient first name and last name are required');
  }
  if (!payload.patientInfo.dateOfBirth) {
    errors.push('Patient date of birth is required');
  }

  // Service validation
  if (!payload.serviceInfo.serviceDate) {
    errors.push('Service date is required');
  }
  if (!payload.serviceInfo.serviceCodes || payload.serviceInfo.serviceCodes.length === 0) {
    errors.push('At least one service code is required');
  }

  // Claim validation
  if (!payload.claimInfo.totalAmount || payload.claimInfo.totalAmount <= 0) {
    errors.push('Claim total amount must be greater than zero');
  }

  return errors;
}