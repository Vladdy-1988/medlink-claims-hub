/**
 * Field-Level Encryption Module
 * Uses AES-256-GCM with unique IV per record
 * Provides deterministic hashing for searchable fields
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  // Use first 32 bytes of key (256 bits)
  return Buffer.from(key.slice(0, 32), 'utf-8');
}

// Encrypt PHI data
export function encryptPHI(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and ciphertext into single base64 string
    const combined = Buffer.concat([iv, tag, encrypted]);
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

// Decrypt PHI data
export function decryptPHI(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  
  // Check if this looks like encrypted data
  if (!ciphertext.match(/^[A-Za-z0-9+/]+=*$/)) {
    // Not base64, might be plaintext (legacy data)
    console.warn('Attempting to decrypt non-base64 data, returning as-is');
    return ciphertext;
  }
  
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(ciphertext, 'base64');
    
    // Extract IV, tag, and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    // If decryption fails, might be legacy plaintext
    console.warn('Decryption failed, returning original value (might be legacy plaintext)');
    return ciphertext;
  }
}

// Create deterministic hash for searchable fields (email, phone)
export function hashForSearch(value: string): string {
  if (!value) return '';
  
  const key = getEncryptionKey();
  const normalized = value.toLowerCase().trim();
  
  // Use HMAC for deterministic hashing
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(normalized);
  return hmac.digest('hex');
}

// Verify encryption is working
export function verifyEncryption(): boolean {
  try {
    const testData = 'TEST_ENCRYPTION_CHECK';
    const encrypted = encryptPHI(testData);
    const decrypted = decryptPHI(encrypted);
    
    // Check that encrypted is different from plaintext
    if (encrypted === testData) {
      console.error('Encryption verification failed: data not encrypted');
      return false;
    }
    
    // Check that decryption works
    if (decrypted !== testData) {
      console.error('Encryption verification failed: decryption mismatch');
      return false;
    }
    
    // Check that encrypted data is base64 and has minimum length
    if (encrypted.length < 64) {
      console.error('Encryption verification failed: encrypted data too short');
      return false;
    }
    
    console.log('✅ Field-level encryption verified and working');
    return true;
  } catch (error) {
    console.error('Encryption verification failed:', error);
    return false;
  }
}

// Batch encrypt multiple fields
export function encryptFields(data: Record<string, any>, fields: string[]): Record<string, any> {
  const encrypted = { ...data };
  
  for (const field of fields) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[field] = encryptPHI(encrypted[field].toString());
    }
  }
  
  return encrypted;
}

// Batch decrypt multiple fields
export function decryptFields(data: Record<string, any>, fields: string[]): Record<string, any> {
  const decrypted = { ...data };
  
  for (const field of fields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decryptPHI(decrypted[field]);
      } catch (e) {
        // Field might be plaintext
        console.warn(`Could not decrypt field ${field}, might be legacy plaintext`);
      }
    }
  }
  
  return decrypted;
}

// Check if a value looks like it's already encrypted
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  // Check if it's base64 encoded
  if (!value.match(/^[A-Za-z0-9+/]+=*$/)) {
    return false;
  }
  
  // Check minimum length (IV + tag + some data)
  if (value.length < 64) {
    return false;
  }
  
  try {
    // Try to decode base64
    const decoded = Buffer.from(value, 'base64');
    // Should have at least IV + tag + 1 byte of data
    return decoded.length >= (IV_LENGTH + TAG_LENGTH + 1);
  } catch {
    return false;
  }
}

// Migrate plaintext to encrypted (for existing data)
export async function migrateToEncrypted(
  tableName: string,
  records: any[],
  phiFields: string[]
): Promise<{ migrated: number; failed: number }> {
  let migrated = 0;
  let failed = 0;
  
  for (const record of records) {
    try {
      let needsUpdate = false;
      const updates: Record<string, any> = {};
      
      for (const field of phiFields) {
        if (record[field] && !isEncrypted(record[field])) {
          // Found plaintext PHI, encrypt it
          updates[field] = encryptPHI(record[field]);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        // Update record with encrypted values
        // This would need to be connected to actual DB update
        console.log(`Would migrate record ${record.id} in ${tableName}`);
        migrated++;
      }
    } catch (error) {
      console.error(`Failed to migrate record ${record.id}:`, error);
      failed++;
    }
  }
  
  return { migrated, failed };
}

// Initialize and verify on startup
export function initializeEncryption(): void {
  // Check environment
  if (!process.env.ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ENCRYPTION_KEY is required in production');
    }
    console.warn('⚠️  WARNING: ENCRYPTION_KEY not set, using default (INSECURE!)');
    process.env.ENCRYPTION_KEY = 'INSECURE-DEFAULT-KEY-DO-NOT-USE-IN-PRODUCTION!!';
  }
  
  // Verify encryption works
  if (!verifyEncryption()) {
    throw new Error('FATAL: Encryption verification failed');
  }
}
