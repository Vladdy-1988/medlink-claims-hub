/**
 * Multi-Factor Authentication (MFA) Module
 * Implements TOTP-based MFA with backup codes
 */

import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { usersRepo } from '../db/repo';

// Rate limiting store (in production, use Redis)
const mfaAttempts = new Map<string, { count: number; resetAt: number }>();

// MFA configuration
const MFA_CONFIG = {
  issuer: 'MedLink Claims Hub',
  algorithm: 'sha256',
  digits: 6,
  period: 30,
  window: 2, // Accept codes from 2 periods before/after
  backupCodeCount: 10,
  maxAttempts: 5,
  lockoutMinutes: 15
};

// Generate MFA setup for a user
export async function generateMFASetup(userId: string, userEmail: string) {
  // Generate secret
  const secret = speakeasy.generateSecret({
    length: 32,
    name: `${MFA_CONFIG.issuer} (${userEmail})`,
    issuer: MFA_CONFIG.issuer
  });
  
  // Generate backup codes
  const backupCodes = generateBackupCodes();
  
  // Store encrypted secret and hashed backup codes
  await usersRepo.setMFASecret(userId, secret.base32, backupCodes);
  
  // Generate QR code
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
  
  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
    backupCodes,
    manual: {
      secret: secret.base32,
      issuer: MFA_CONFIG.issuer,
      account: userEmail
    }
  };
}

// Generate random backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < MFA_CONFIG.backupCodeCount; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

// Verify TOTP code
export async function verifyTOTP(userId: string, token: string): Promise<boolean> {
  // Check rate limiting
  if (!checkRateLimit(userId)) {
    throw new Error('Too many failed attempts. Please try again later.');
  }
  
  const user = await usersRepo.findById(userId);
  if (!user || !user.mfaSecret) {
    recordFailedAttempt(userId);
    return false;
  }
  
  // Decrypt the secret (handled by repo layer)
  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token,
    algorithm: MFA_CONFIG.algorithm as any,
    digits: MFA_CONFIG.digits,
    window: MFA_CONFIG.window
  });
  
  if (!verified) {
    recordFailedAttempt(userId);
    return false;
  }
  
  // Clear rate limit on success
  clearRateLimit(userId);
  return true;
}

// Verify backup code
export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  if (!checkRateLimit(userId)) {
    throw new Error('Too many failed attempts. Please try again later.');
  }
  
  const user = await usersRepo.findById(userId);
  if (!user || !user.mfaBackupCodes) {
    recordFailedAttempt(userId);
    return false;
  }
  
  // Parse backup codes from JSON string
  let backupCodes: string[];
  try {
    backupCodes = JSON.parse(user.mfaBackupCodes);
    if (!Array.isArray(backupCodes) || backupCodes.length === 0) {
      recordFailedAttempt(userId);
      return false;
    }
  } catch {
    recordFailedAttempt(userId);
    return false;
  }
  
  // Normalize the code
  const normalizedCode = code.replace(/\s+/g, '').toUpperCase();
  
  // Check if code matches any backup code
  let codeIndex = -1;
  for (let i = 0; i < backupCodes.length; i++) {
    // Backup codes are stored as hashes
    const isMatch = await bcrypt.compare(normalizedCode, backupCodes[i]);
    if (isMatch) {
      codeIndex = i;
      break;
    }
  }
  
  if (codeIndex === -1) {
    recordFailedAttempt(userId);
    return false;
  }
  
  // Remove used backup code
  const remainingCodes = [...backupCodes];
  remainingCodes.splice(codeIndex, 1);
  
  await usersRepo.update(userId, {
    mfaBackupCodes: JSON.stringify(remainingCodes)
  });
  
  clearRateLimit(userId);
  return true;
}

// Enable MFA after successful verification
export async function enableMFA(userId: string, token: string): Promise<boolean> {
  const verified = await verifyTOTP(userId, token);
  if (!verified) {
    return false;
  }
  
  await usersRepo.enableMFA(userId);
  return true;
}

// Disable MFA (requires password verification in production)
export async function disableMFA(userId: string): Promise<void> {
  await usersRepo.update(userId, {
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: null
  });
}

// Check if user should be prompted for MFA
export async function shouldRequireMFA(userId: string): Promise<boolean> {
  const user = await usersRepo.findById(userId);
  if (!user) return false;
  
  // MFA required for admin users
  return user.role === 'admin' && user.mfaEnabled === true;
}

// Get MFA token secret (use environment variable or fallback to app secret)
function getMFATokenSecret(): string {
  return process.env.MFA_TOKEN_SECRET || process.env.ENCRYPTION_KEY || 'mfa-temp-secret-key';
}

// Generate a temporary token for MFA challenge
export function generateTempToken(userId: string): string {
  const payload = {
    userId,
    purpose: 'mfa_challenge',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
  };
  
  // Sign with JWT for secure token generation
  return jwt.sign(payload, getMFATokenSecret(), { 
    algorithm: 'HS256'
  });
}

// Verify temporary token
export function verifyTempToken(token: string): { userId: string; valid: boolean } {
  try {
    const decoded = jwt.verify(token, getMFATokenSecret(), {
      algorithms: ['HS256'],
      clockTolerance: 5 // Allow 5 seconds clock skew
    }) as any;
    
    if (decoded.purpose !== 'mfa_challenge') {
      return { userId: '', valid: false };
    }
    
    if (!decoded.userId) {
      return { userId: '', valid: false };
    }
    
    return { userId: decoded.userId, valid: true };
  } catch (error) {
    // Log JWT verification errors for debugging
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn('MFA token verification failed:', error.message);
    }
    return { userId: '', valid: false };
  }
}

// Rate limiting functions
function checkRateLimit(userId: string): boolean {
  const attempts = mfaAttempts.get(userId);
  if (!attempts) return true;
  
  if (Date.now() > attempts.resetAt) {
    mfaAttempts.delete(userId);
    return true;
  }
  
  return attempts.count < MFA_CONFIG.maxAttempts;
}

function recordFailedAttempt(userId: string): void {
  const attempts = mfaAttempts.get(userId) || {
    count: 0,
    resetAt: Date.now() + (MFA_CONFIG.lockoutMinutes * 60 * 1000)
  };
  
  attempts.count++;
  mfaAttempts.set(userId, attempts);
}

function clearRateLimit(userId: string): void {
  mfaAttempts.delete(userId);
}

// Log MFA events for audit
export function logMFAEvent(
  userId: string,
  event: 'setup' | 'enable' | 'disable' | 'verify_success' | 'verify_fail',
  metadata?: any
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'audit',
    event: 'mfa',
    userId,
    action: event,
    metadata
  }));
}

// Check MFA setup on startup
export function initializeMFA(): void {
  console.log('✅ MFA module initialized with TOTP support');
  console.log(`   - Algorithm: ${MFA_CONFIG.algorithm}`);
  console.log(`   - Period: ${MFA_CONFIG.period}s`);
  console.log(`   - Max attempts: ${MFA_CONFIG.maxAttempts} per ${MFA_CONFIG.lockoutMinutes} minutes`);
}
