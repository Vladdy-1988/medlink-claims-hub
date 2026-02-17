import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { logger } from './logger';

interface MFAConfig {
  appName: string;
  issuer: string;
  window: number;
  step: number;
  backupCodeCount: number;
  rateLimit: {
    maxAttempts: number;
    windowMinutes: number;
  };
}

// MFA configuration
const MFA_CONFIG: MFAConfig = {
  appName: 'MedLink Claims Hub',
  issuer: 'MedLink',
  window: 1, // 30-second time window (1 period before and after)
  step: 30, // 30-second time step
  backupCodeCount: 10,
  rateLimit: {
    maxAttempts: 5,
    windowMinutes: 15,
  },
};

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { attempts: number; resetAt: Date }>();

/**
 * Check if user has exceeded rate limit
 */
export function checkRateLimit(userId: string): { allowed: boolean; attemptsRemaining: number } {
  const key = `mfa:${userId}`;
  const now = new Date();
  const limit = rateLimitStore.get(key);

  if (limit && limit.resetAt > now) {
    const attemptsRemaining = MFA_CONFIG.rateLimit.maxAttempts - limit.attempts;
    if (attemptsRemaining <= 0) {
      return { allowed: false, attemptsRemaining: 0 };
    }
    return { allowed: true, attemptsRemaining };
  }

  // Reset rate limit
  rateLimitStore.set(key, {
    attempts: 0,
    resetAt: new Date(now.getTime() + MFA_CONFIG.rateLimit.windowMinutes * 60 * 1000),
  });

  return { allowed: true, attemptsRemaining: MFA_CONFIG.rateLimit.maxAttempts };
}

/**
 * Record a rate limit attempt
 */
export function recordRateLimitAttempt(userId: string): void {
  const key = `mfa:${userId}`;
  const now = new Date();
  const limit = rateLimitStore.get(key);

  if (limit && limit.resetAt > now) {
    limit.attempts++;
  } else {
    rateLimitStore.set(key, {
      attempts: 1,
      resetAt: new Date(now.getTime() + MFA_CONFIG.rateLimit.windowMinutes * 60 * 1000),
    });
  }
}

/**
 * Generate a TOTP secret for a user
 */
export function generateSecret(userEmail: string): { secret: string; otpauth_url: string } {
  const secret = speakeasy.generateSecret({
    name: `${MFA_CONFIG.appName} (${userEmail})`,
    issuer: MFA_CONFIG.issuer,
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url || '',
  };
}

/**
 * Generate QR code data URL from otpauth URL
 */
export async function generateQRCode(otpauth_url: string): Promise<string> {
  try {
    const dataUrl = await qrcode.toDataURL(otpauth_url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (error) {
    logger.error('Failed to generate QR code', { error });
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP code
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: MFA_CONFIG.window,
      step: MFA_CONFIG.step,
    });
  } catch (error) {
    logger.error('Failed to verify TOTP', { error });
    return false;
  }
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < MFA_CONFIG.backupCodeCount; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(6).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 8)
      .toUpperCase();
    codes.push(code);
  }

  return codes;
}

/**
 * Hash backup codes for storage
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const hashedCodes = await Promise.all(
    codes.map(code => bcrypt.hash(code, 10))
  );
  return hashedCodes;
}

/**
 * Verify and invalidate a backup code
 */
export async function verifyBackupCode(
  inputCode: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remainingCodes?: string[] }> {
  const normalizedInput = inputCode.toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (let i = 0; i < hashedCodes.length; i++) {
    const isMatch = await bcrypt.compare(normalizedInput, hashedCodes[i]);
    if (isMatch) {
      // Remove the used code
      const remainingCodes = hashedCodes.filter((_, index) => index !== i);
      return { valid: true, remainingCodes };
    }
  }

  return { valid: false };
}

/**
 * Format backup codes for display
 */
export function formatBackupCodes(codes: string[]): string {
  return codes
    .map((code, index) => `${index + 1}. ${code.match(/.{1,4}/g)?.join('-') || code}`)
    .join('\n');
}

/**
 * Generate backup codes file content
 */
export function generateBackupCodesFile(codes: string[], userEmail: string): string {
  const timestamp = new Date().toISOString();
  return `MedLink Claims Hub - MFA Backup Codes
=====================================
User: ${userEmail}
Generated: ${timestamp}

IMPORTANT: Store these codes in a safe place.
Each code can only be used once.

Backup Codes:
${formatBackupCodes(codes)}

=====================================
If you lose access to your authenticator app,
you can use one of these codes to sign in.
`;
}

/**
 * Validate MFA session (for already authenticated users)
 */
export function validateMFASession(session: any): boolean {
  if (!session) return false;
  
  // Check if MFA verification timestamp exists and is recent (e.g., within 24 hours)
  if (!session.mfaVerifiedAt) return false;
  
  const verifiedAt = new Date(session.mfaVerifiedAt);
  const now = new Date();
  const hoursSinceVerification = (now.getTime() - verifiedAt.getTime()) / (1000 * 60 * 60);
  
  // MFA verification expires after 24 hours
  return hoursSinceVerification < 24;
}

/**
 * Set MFA verification in session
 */
export function setMFAVerification(session: any): void {
  session.mfaVerifiedAt = new Date().toISOString();
  session.mfaVerified = true;
}

/**
 * Clear MFA verification from session
 */
export function clearMFAVerification(session: any): void {
  delete session.mfaVerifiedAt;
  delete session.mfaVerified;
}

/**
 * Check if MFA should be enforced for user
 */
export function shouldEnforceMFA(user: any): boolean {
  // MFA is required for admin users
  if (user.role === 'admin') {
    return true;
  }
  
  // MFA is optional but available for other roles if they've enabled it
  return user.mfaEnabled === true;
}

/**
 * Generate MFA setup response
 */
export async function generateMFASetup(userEmail: string): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
}> {
  const { secret, otpauth_url } = generateSecret(userEmail);
  const qrCode = await generateQRCode(otpauth_url);
  const backupCodes = generateBackupCodes();

  return {
    secret,
    qrCode,
    backupCodes,
  };
}

/**
 * Log MFA event for audit trail
 */
export function logMFAEvent(
  type: 'mfa_setup' | 'mfa_verify' | 'mfa_disable' | 'mfa_backup_used' | 'mfa_failed',
  userId: string,
  details: Record<string, any>
): void {
  logger.info('MFA Event', {
    type,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  });
}
