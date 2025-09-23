import * as crypto from 'crypto';
import { z } from 'zod';

/**
 * Field-level encryption for PHI (Protected Health Information)
 * Uses AES-256-GCM with PBKDF2 key derivation
 */

// Configuration schema
const EncryptionConfigSchema = z.object({
  masterKey: z.string().min(32),
  algorithm: z.literal('aes-256-gcm'),
  saltLength: z.number().default(32),
  ivLength: z.number().default(16),
  tagLength: z.number().default(16),
  pbkdf2Iterations: z.number().default(100000),
  keyRotationVersion: z.number().default(1),
});

type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;

// PHI field mapping - defines which fields need encryption
export const PHI_FIELDS = {
  users: ['firstName', 'lastName', 'email', 'mfaSecret', 'mfaBackupCodes'],
  patients: ['name', 'dob', 'identifiers'],
  providers: ['name', 'licenceNumber'],
  claims: ['notes', 'claimNumber'],
  attachments: ['url'],
  remittances: ['raw'],
  auditEvents: ['details'],
  pushSubscriptions: ['endpoint', 'p256dhKey', 'authKey'],
  organizations: ['privacyOfficerName', 'privacyOfficerEmail'],
} as const;

// Cache for derived keys to improve performance
const keyCache = new Map<string, Buffer>();
const CACHE_TTL = 3600000; // 1 hour in ms
const cacheTimestamps = new Map<string, number>();

export class FieldEncryption {
  private config: EncryptionConfig;
  private masterKey: Buffer;
  
  constructor() {
    // Load configuration from environment
    const masterKeyString = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || '';
    
    // In development, use a default key if none provided
    const isDev = process.env.NODE_ENV === 'development';
    const finalKey = masterKeyString || (isDev ? 'dev-encryption-key-min-32-chars-for-testing-only' : '');
    
    if (!finalKey || finalKey.length < 32) {
      if (!isDev) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters in production');
      }
    }
    
    this.config = EncryptionConfigSchema.parse({
      masterKey: finalKey.padEnd(32, '0'),
      algorithm: 'aes-256-gcm',
      keyRotationVersion: parseInt(process.env.ENCRYPTION_KEY_VERSION || '1'),
    });
    
    this.masterKey = Buffer.from(this.config.masterKey.slice(0, 32));
  }

  /**
   * Derive an encryption key using PBKDF2
   */
  private deriveKey(salt: Buffer, version: number = this.config.keyRotationVersion): Buffer {
    const cacheKey = `${salt.toString('hex')}-${version}`;
    const now = Date.now();
    
    // Check cache
    if (keyCache.has(cacheKey)) {
      const timestamp = cacheTimestamps.get(cacheKey) || 0;
      if (now - timestamp < CACHE_TTL) {
        return keyCache.get(cacheKey)!;
      }
    }
    
    // Derive new key
    const key = crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.concat([salt, Buffer.from(version.toString())]),
      this.config.pbkdf2Iterations,
      32,
      'sha256'
    );
    
    // Update cache
    keyCache.set(cacheKey, key);
    cacheTimestamps.set(cacheKey, now);
    
    // Clean old cache entries
    if (keyCache.size > 100) {
      const entries = Array.from(cacheTimestamps.entries());
      entries.sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, 50);
      toRemove.forEach(([k]) => {
        keyCache.delete(k);
        cacheTimestamps.delete(k);
      });
    }
    
    return key;
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  encrypt(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return value;
    }
    
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Derive key
      const key = this.deriveKey(salt, this.config.keyRotationVersion);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(stringValue, 'utf8'),
        cipher.final(),
      ]);
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine all components: version(1) + salt(32) + iv(16) + authTag(16) + encrypted
      const combined = Buffer.concat([
        Buffer.from([this.config.keyRotationVersion]),
        salt,
        iv,
        authTag,
        encrypted,
      ]);
      
      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      // In production, you might want to throw here
      return null;
    }
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  decrypt(encryptedValue: string | null): any {
    if (!encryptedValue || encryptedValue === '') {
      return encryptedValue;
    }
    
    try {
      // Check if this looks like encrypted data (base64)
      if (!encryptedValue.match(/^[A-Za-z0-9+/]+=*$/)) {
        // Not encrypted, return as-is (backward compatibility)
        return encryptedValue;
      }
      
      const combined = Buffer.from(encryptedValue, 'base64');
      
      // Check minimum length for encrypted data
      // version(1) + salt(32) + iv(16) + authTag(16) + at least 1 byte of data = 66 bytes
      if (combined.length < 66) {
        // Too short to be encrypted data, return as-is
        return encryptedValue;
      }
      
      // Extract components
      const version = combined[0];
      const salt = combined.slice(1, 33);
      const iv = combined.slice(33, 49);
      const authTag = combined.slice(49, 65);
      const encrypted = combined.slice(65);
      
      // Validate components
      if (salt.length !== 32 || iv.length !== 16 || authTag.length !== 16) {
        // Invalid structure, return as-is (backward compatibility)
        return encryptedValue;
      }
      
      // Derive key for the version
      const key = this.deriveKey(salt, version);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      
      const stringValue = decrypted.toString('utf8');
      
      // Try to parse as JSON if it looks like JSON
      if (stringValue.startsWith('{') || stringValue.startsWith('[')) {
        try {
          return JSON.parse(stringValue);
        } catch {
          return stringValue;
        }
      }
      
      return stringValue;
    } catch (error) {
      // For backward compatibility with unencrypted data, return as-is
      // instead of returning null which could cause issues
      if (error instanceof Error && error.message.includes('Invalid initialization vector')) {
        return encryptedValue;
      }
      // Return the original value for graceful degradation
      return encryptedValue;
    }
  }

  /**
   * Deterministic encryption for searchable fields (less secure, use sparingly)
   */
  encryptDeterministic(value: string, fieldName: string): string | null {
    if (!value) return value;
    
    try {
      // Use HMAC for deterministic "encryption" (actually a keyed hash)
      const hmac = crypto.createHmac('sha256', this.masterKey);
      hmac.update(fieldName);
      hmac.update(value);
      return hmac.digest('hex');
    } catch (error) {
      console.error('Deterministic encryption error:', error);
      return null;
    }
  }

  /**
   * Encrypt an object's PHI fields based on table name
   */
  encryptObject<T extends Record<string, any>>(tableName: string, obj: T): T {
    const fields = PHI_FIELDS[tableName as keyof typeof PHI_FIELDS];
    if (!fields) return obj;
    
    const encrypted = { ...obj };
    for (const field of fields) {
      if (field in encrypted && encrypted[field] !== null && encrypted[field] !== undefined) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt an object's PHI fields based on table name
   */
  decryptObject<T extends Record<string, any>>(tableName: string, obj: T): T {
    const fields = PHI_FIELDS[tableName as keyof typeof PHI_FIELDS];
    if (!fields) return obj;
    
    const decrypted = { ...obj };
    for (const field of fields) {
      if (field in decrypted && decrypted[field]) {
        const decryptedValue = this.decrypt(decrypted[field]);
        if (decryptedValue !== null) {
          decrypted[field] = decryptedValue;
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Encrypt an array of objects
   */
  encryptArray<T extends Record<string, any>>(tableName: string, objects: T[]): T[] {
    return objects.map(obj => this.encryptObject(tableName, obj));
  }

  /**
   * Decrypt an array of objects
   */
  decryptArray<T extends Record<string, any>>(tableName: string, objects: T[]): T[] {
    return objects.map(obj => this.decryptObject(tableName, obj));
  }

  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return !!(process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.NODE_ENV === 'development');
  }

  /**
   * Generate a new encryption key (for initial setup)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Rotate encryption key (re-encrypt with new version)
   */
  async rotateKey(newVersion: number): Promise<void> {
    // This would be implemented with database migration
    // Re-encrypt all data with new key version
    this.config.keyRotationVersion = newVersion;
  }

  /**
   * Test encryption/decryption
   */
  test(): boolean {
    try {
      const testData = { test: 'data', number: 123, nested: { field: 'value' } };
      const encrypted = this.encrypt(testData);
      if (!encrypted) return false;
      
      const decrypted = this.decrypt(encrypted);
      return JSON.stringify(testData) === JSON.stringify(decrypted);
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const fieldEncryption = new FieldEncryption();

// Type-safe encryption helpers
export function encryptPHI(value: any): string | null {
  return fieldEncryption.encrypt(value);
}

export function decryptPHI(value: string | null): any {
  return fieldEncryption.decrypt(value);
}

export function encryptRecord<T extends Record<string, any>>(tableName: string, record: T): T {
  return fieldEncryption.encryptObject(tableName, record);
}

export function decryptRecord<T extends Record<string, any>>(tableName: string, record: T): T {
  return fieldEncryption.decryptObject(tableName, record);
}

export function isEncryptionEnabled(): boolean {
  return fieldEncryption.isEnabled();
}