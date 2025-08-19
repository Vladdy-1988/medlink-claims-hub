/**
 * CDAnet Claim Mapping Functions
 * Maps MedLink claims to CDAnet format and parses responses
 */

import type { Claim, Patient, Provider } from '../../shared/schema';

export interface CDAnetPayload {
  segments: string[];
}

export interface CDAnetResponse {
  status: 'submitted' | 'error' | 'paid' | 'denied' | 'infoRequested';
  details: any;
  externalId?: string;
}

/**
 * Map MedLink claim to CDAnet format
 */
export function mapClaimToCDAnet(
  claim: Claim, 
  patient: Patient, 
  provider: Provider
): CDAnetPayload {
  
  const segments: string[] = [];
  
  // A01 - Transaction Header
  segments.push(`A01${provider.licenceNumber || ''}${formatDate(new Date())}${claim.id}`);
  
  // A02 - Provider Information
  segments.push(`A02${provider.name}${provider.licenceNumber || ''}`);
  
  // A03 - Software Information
  segments.push(`A03MEDLINK001${getCurrentVersion()}`);
  
  // A04 - Patient Information
  const patientName = patient.name.split(' ');
  const firstName = patientName[0] || '';
  const lastName = patientName.slice(1).join(' ') || '';
  segments.push(`A04${firstName} ${lastName}${formatDate(patient.dob || new Date())}U`);
  
  // A05 - Patient Address (if available from identifiers)
  const identifiers = patient.identifiers as any || {};
  if (identifiers.address) {
    segments.push(`A05${identifiers.address}${identifiers.city || ''}${identifiers.province || ''}${identifiers.postalCode || ''}`);
  }
  
  // A06 - Insurance Information
  segments.push(`A06${claim.insurerId}${identifiers.policyNumber || ''}${identifiers.certificateNumber || ''}`);
  
  // A07 - Claim Information
  const totalAmount = parseFloat(claim.amount.toString());
  const serviceCount = claim.codes ? (Array.isArray(claim.codes) ? claim.codes.length : 1) : 1;
  segments.push(`A07${formatDate(claim.createdAt || new Date())}${totalAmount.toFixed(2)}${serviceCount}`);
  
  // A08-A15 - Service Lines (up to 8 services per claim)
  if (claim.codes && Array.isArray(claim.codes)) {
    (claim.codes as any[]).slice(0, 8).forEach((service: any, index: number) => {
      const segmentCode = `A${(8 + index).toString().padStart(2, '0')}`;
      segments.push(`${segmentCode}${service.code || ''}${service.description || ''}${(totalAmount / serviceCount).toFixed(2)}`);
    });
  }
  
  return { segments };
}

/**
 * Parse CDAnet response
 */
export function parseCDAnetResponse(rawResponse: any): CDAnetResponse {
  
  // Handle sandbox responses
  if (rawResponse.sandbox) {
    return {
      status: rawResponse.status || 'submitted',
      details: rawResponse,
      externalId: rawResponse.externalId,
    };
  }
  
  // Handle actual CDAnet responses
  if (typeof rawResponse === 'string') {
    // Parse response string format
    const lines = rawResponse.split('\n');
    const acknowledgment = lines.find(line => line.startsWith('ACK'));
    
    if (acknowledgment) {
      const ackCode = acknowledgment.substring(3, 5);
      switch (ackCode) {
        case 'AA':
          return {
            status: 'submitted',
            details: { acknowledgment: ackCode, message: 'Application Accept' },
            externalId: extractExternalId(rawResponse),
          };
        case 'AE':
          return {
            status: 'error',
            details: { acknowledgment: ackCode, message: 'Application Error', errors: extractErrors(rawResponse) },
          };
        case 'AR':
          return {
            status: 'error',
            details: { acknowledgment: ackCode, message: 'Application Reject', errors: extractErrors(rawResponse) },
          };
        default:
          return {
            status: 'error',
            details: { acknowledgment: ackCode, message: 'Unknown response code' },
          };
      }
    }
  }
  
  // Handle JSON responses
  if (typeof rawResponse === 'object') {
    return {
      status: mapCDAnetStatus(rawResponse.status),
      details: rawResponse,
      externalId: rawResponse.transactionId || rawResponse.externalId,
    };
  }
  
  // Default fallback
  return {
    status: 'error',
    details: { message: 'Unable to parse CDAnet response', raw: rawResponse },
  };
}

/**
 * Helper functions
 */

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

function getCurrentVersion(): string {
  return '1.0.0'; // MedLink Claims Hub version
}

function calculateTotalAmount(claim: Claim): number {
  return parseFloat(claim.amount.toString() || '0');
}

function extractExternalId(response: string): string {
  // Extract transaction ID from response
  const idMatch = response.match(/TXN(\d+)/);
  return idMatch ? idMatch[1] : '';
}

function extractErrors(response: string): string[] {
  // Extract error messages from response
  const errorLines = response.split('\n').filter(line => line.startsWith('ERR'));
  return errorLines.map(line => line.substring(3));
}

function mapCDAnetStatus(status: string): CDAnetResponse['status'] {
  switch (status?.toLowerCase()) {
    case 'accepted':
    case 'submitted':
      return 'submitted';
    case 'paid':
    case 'approved':
      return 'paid';
    case 'denied':
    case 'rejected':
      return 'denied';
    case 'info_requested':
    case 'pending':
      return 'infoRequested';
    default:
      return 'error';
  }
}