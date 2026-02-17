import { faker } from '@faker-js/faker';
import * as crypto from 'crypto';

/**
 * Comprehensive PHI data anonymizer for staging/test environments
 * Provides deterministic anonymization (same input = same output) for maintaining referential integrity
 */
export class DataAnonymizer {
  private seedMap = new Map<string, string>();
  private counter = 0;
  
  constructor(private seed: string = 'test-anonymization-seed') {
    // Set faker seed for consistency
    faker.seed(this.hashToNumber(seed));
  }
  
  /**
   * Convert a string to a deterministic number for seeding
   */
  private hashToNumber(str: string): number {
    const hash = crypto.createHash('sha256').update(str).digest();
    return hash.readUInt32BE(0);
  }
  
  /**
   * Get or create deterministic seed for a specific value
   */
  private getDeterministicSeed(value: string, type: string): string {
    const key = `${type}:${value}`;
    if (!this.seedMap.has(key)) {
      const hash = crypto.createHash('sha256')
        .update(this.seed)
        .update(key)
        .digest('hex')
        .substring(0, 16);
      this.seedMap.set(key, hash);
    }
    return this.seedMap.get(key)!;
  }
  
  /**
   * Anonymize a person's first name
   */
  anonymizeFirstName(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'firstName'));
    faker.seed(seed);
    return 'TEST-' + faker.person.firstName();
  }
  
  /**
   * Anonymize a person's last name
   */
  anonymizeLastName(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'lastName'));
    faker.seed(seed);
    return faker.person.lastName();
  }
  
  /**
   * Anonymize a full name
   */
  anonymizeName(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'fullName'));
    faker.seed(seed);
    return 'TEST-' + faker.person.fullName();
  }
  
  /**
   * Anonymize an email address (deterministic but unique)
   */
  anonymizeEmail(original: string | null): string | null {
    if (!original) return original;
    const seed = this.getDeterministicSeed(original, 'email');
    const hash = seed.substring(0, 8);
    return `test.user.${hash}@staging.medlink.ca`;
  }
  
  /**
   * Anonymize a date of birth
   */
  anonymizeDOB(original: Date | null): Date | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original.toISOString(), 'dob'));
    faker.seed(seed);
    // Generate a DOB between 18 and 85 years ago
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 85);
    const maxAge = new Date();
    maxAge.setFullYear(maxAge.getFullYear() - 18);
    return faker.date.between({ from: minAge, to: maxAge });
  }
  
  /**
   * Generate a Canadian health card number (format varies by province)
   */
  anonymizeHealthCardNumber(original: string | null, province: string = 'ON'): string | null {
    if (!original) return original;
    const seed = this.getDeterministicSeed(original, 'healthCard');
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    
    switch (province) {
      case 'ON': // Ontario: 10 digits + 2 letters
        return 'TEST' + hash.substring(0, 6).toUpperCase() + hash.substring(6, 8).toUpperCase();
      case 'QC': // Quebec: 4 letters + 8 digits
        return 'TEST' + hash.substring(0, 8).toUpperCase();
      case 'BC': // BC: 10 digits
        return 'TEST' + hash.substring(0, 6);
      case 'AB': // Alberta: 9 digits
        return 'TEST' + hash.substring(0, 5);
      default:
        return 'TEST-' + hash.substring(0, 8).toUpperCase();
    }
  }
  
  /**
   * Anonymize a Canadian phone number
   */
  anonymizePhoneNumber(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'phone'));
    faker.seed(seed);
    // Canadian phone format: (XXX) XXX-XXXX
    const areaCode = 416 + (seed % 200); // Toronto-ish area codes
    const exchange = 200 + (seed % 800);
    const number = 1000 + (seed % 9000);
    return `(${areaCode}) ${exchange}-${number}`;
  }
  
  /**
   * Anonymize a Canadian postal code
   */
  anonymizePostalCode(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'postal'));
    faker.seed(seed);
    // Canadian postal code format: A1A 1A1
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    // Use different bit positions to ensure we get values
    const pc = 
      letters[seed % 26] +
      digits[Math.floor(seed / 26) % 10] +
      letters[Math.floor(seed / 260) % 26] +
      ' ' +
      digits[Math.floor(seed / 6760) % 10] +
      letters[Math.floor(seed / 67600) % 26] +
      digits[Math.floor(seed / 1757600) % 10];
    return pc;
  }
  
  /**
   * Anonymize an address
   */
  anonymizeAddress(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'address'));
    faker.seed(seed);
    return faker.location.streetAddress() + ', Toronto, ON';
  }
  
  /**
   * Anonymize a license number
   */
  anonymizeLicenseNumber(original: string | null): string | null {
    if (!original) return original;
    const seed = this.getDeterministicSeed(original, 'license');
    return 'TEST-LIC-' + seed.substring(0, 8).toUpperCase();
  }
  
  /**
   * Anonymize notes/text (preserve length and format)
   */
  anonymizeNotes(original: string | null): string | null {
    if (!original) return original;
    const seed = this.hashToNumber(this.getDeterministicSeed(original, 'notes'));
    faker.seed(seed);
    
    // Preserve approximate length
    const words = original.split(' ').length;
    const sentences = Math.max(1, Math.floor(words / 10));
    
    return '[ANONYMIZED TEST DATA] ' + faker.lorem.sentences(sentences);
  }
  
  /**
   * Anonymize claim number
   */
  anonymizeClaimNumber(original: string | null): string | null {
    if (!original) return original;
    const seed = this.getDeterministicSeed(original, 'claim');
    return 'TEST-CLM-' + seed.substring(0, 10).toUpperCase();
  }
  
  /**
   * Anonymize reference number
   */
  anonymizeReferenceNumber(original: string | null): string | null {
    if (!original) return original;
    const seed = this.getDeterministicSeed(original, 'reference');
    return 'TEST-REF-' + seed.substring(0, 10).toUpperCase();
  }
  
  /**
   * Anonymize URL (for attachments)
   */
  anonymizeUrl(original: string | null): string | null {
    if (!original) return original;
    const seed = this.getDeterministicSeed(original, 'url');
    const extension = original.split('.').pop() || 'pdf';
    return `https://test-storage.medlink.ca/anonymized/${seed}.${extension}`;
  }
  
  /**
   * Anonymize JSON identifiers (like insurance numbers)
   */
  anonymizeIdentifiers(original: any): any {
    if (!original) return original;
    
    if (typeof original === 'string') {
      try {
        original = JSON.parse(original);
      } catch {
        return this.anonymizeHealthCardNumber(original);
      }
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(original)) {
      if (typeof value === 'string') {
        result[key] = this.anonymizeHealthCardNumber(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  
  /**
   * Generate synthetic patient data
   */
  generatePatient(index: number) {
    faker.seed(this.hashToNumber(`patient-${index}`));
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
      name: `TEST-${firstName} ${lastName}`,
      dob: faker.date.birthdate({ min: 18, max: 85, mode: 'age' }),
      identifiers: {
        healthCard: this.anonymizeHealthCardNumber(`HC${index}`, 'ON'),
        insuranceNumber: `TEST-INS-${String(index).padStart(6, '0')}`,
        groupNumber: `TEST-GRP-${String(index % 100).padStart(3, '0')}`
      }
    };
  }
  
  /**
   * Generate synthetic provider data
   */
  generateProvider(index: number, discipline?: string) {
    faker.seed(this.hashToNumber(`provider-${index}`));
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const disciplines = ['Physiotherapy', 'Chiropractic', 'Massage Therapy', 'Occupational Therapy', 'Psychology'];
    
    return {
      name: `TEST-Dr. ${firstName} ${lastName}`,
      discipline: discipline || disciplines[index % disciplines.length],
      licenceNumber: `TEST-LIC-${String(index).padStart(6, '0')}`
    };
  }
  
  /**
   * Generate synthetic claim data
   */
  generateClaim(index: number, patientId: string, providerId: string, insurerId: string) {
    faker.seed(this.hashToNumber(`claim-${index}`));
    const statuses = ['draft', 'submitted', 'pending', 'paid', 'denied', 'infoRequested'];
    const types = ['claim', 'preauth'];
    
    return {
      patientId,
      providerId,
      insurerId,
      claimNumber: `TEST-CLM-${String(index).padStart(8, '0')}`,
      type: types[index % 2],
      status: statuses[index % statuses.length],
      amount: faker.number.float({ min: 50, max: 500, multipleOf: 0.01 }).toString(),
      currency: 'CAD',
      codes: {
        procedure: faker.helpers.arrayElement(['97110', '97112', '97116', '97124', '97140']),
        diagnosis: faker.helpers.arrayElement(['M25.561', 'M54.5', 'M79.3', 'S83.401A'])
      },
      notes: '[ANONYMIZED TEST DATA] ' + faker.lorem.sentences(2),
      referenceNumber: `TEST-REF-${String(index).padStart(8, '0')}`,
      externalId: `TEST-EXT-${String(index).padStart(8, '0')}`
    };
  }
  
  /**
   * Check if we're in a safe environment (not production)
   */
  isSafeEnvironment(): boolean {
    const env = process.env.NODE_ENV;
    const dbUrl = process.env.DATABASE_URL || '';
    
    // Check we're not in production
    if (env === 'production') {
      return false;
    }
    
    // Check database URL doesn't contain production keywords
    const dangerousKeywords = ['prod', 'production', 'live', 'master'];
    const lowerDbUrl = dbUrl.toLowerCase();
    
    for (const keyword of dangerousKeywords) {
      if (lowerDbUrl.includes(keyword)) {
        return false;
      }
    }
    
    // Must contain staging or dev keywords
    const safeKeywords = ['staging', 'test', 'dev', 'localhost'];
    for (const keyword of safeKeywords) {
      if (lowerDbUrl.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Reset the anonymizer (clear cached seeds)
   */
  reset() {
    this.seedMap.clear();
    this.counter = 0;
  }
}

// Export singleton instance
export const anonymizer = new DataAnonymizer();

// Export class for custom instances
export default DataAnonymizer;
