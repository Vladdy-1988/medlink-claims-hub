/**
 * Integration test for Multi-Factor Authentication (MFA)
 * Tests TOTP generation, verification, and backup codes
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import speakeasy from 'speakeasy';
import { db } from '../../server/db';
import { users, organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { encryptPHI } from '../../server/security/field-encryption';

describe('MFA Integration Tests', () => {
  let app: any;
  let testOrgId: string;
  let adminUserId: string;
  let adminEmail = 'admin@mfa-test.com';
  let mfaSecret: string;
  let backupCodes: string[];
  let sessionCookie: string;

  beforeAll(async () => {
    // Import app after setting environment variables
    const serverModule = await import('../../server/index');
    app = serverModule.default || serverModule.app;
    
    // Create test organization
    const [org] = await db.insert(organizations).values({
      name: 'MFA Test Org',
      province: 'ON',
      preferredLanguage: 'en-CA'
    }).returning();
    testOrgId = org.id;

    // Generate MFA secret and backup codes
    const secret = speakeasy.generateSecret({
      name: 'MedLink Claims Hub',
      issuer: 'MedLink',
      length: 32
    });
    mfaSecret = secret.base32;

    // Generate backup codes
    backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Create admin user with MFA enabled
    const [user] = await db.insert(users).values({
      email: adminEmail,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      orgId: testOrgId,
      mfaEnabled: true,
      mfaSecret: encryptPHI(mfaSecret),
      mfaBackupCodes: encryptPHI(JSON.stringify(backupCodes)),
      mfaEnforcedAt: new Date()
    }).returning();
    adminUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.delete(users).where(eq(users.id, adminUserId));
      await db.delete(organizations).where(eq(organizations.id, testOrgId));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  it('should require MFA for admin login', async () => {
    // Attempt login without MFA token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'test-password'
      });

    // Should return MFA required status
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('requiresMFA', true);
    expect(loginResponse.body).toHaveProperty('mfaSessionToken');
    
    // Should not have full session yet
    expect(loginResponse.body).not.toHaveProperty('user');
  });

  it('should verify valid TOTP code', async () => {
    // Generate a valid TOTP token
    const validToken = speakeasy.totp({
      secret: mfaSecret,
      encoding: 'base32',
      window: 2
    });

    // First, initiate login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'test-password'
      });

    const mfaSessionToken = loginResponse.body.mfaSessionToken;

    // Verify MFA with valid TOTP
    const mfaResponse = await request(app)
      .post('/api/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: validToken
      });

    expect(mfaResponse.status).toBe(200);
    expect(mfaResponse.body).toHaveProperty('success', true);
    expect(mfaResponse.body).toHaveProperty('user');
    expect(mfaResponse.body.user.id).toBe(adminUserId);

    // Store session for further tests
    sessionCookie = mfaResponse.headers['set-cookie']?.[0];
  });

  it('should reject invalid TOTP code', async () => {
    const invalidToken = '000000';

    // First, initiate login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'test-password'
      });

    const mfaSessionToken = loginResponse.body.mfaSessionToken;

    // Try to verify with invalid TOTP
    const mfaResponse = await request(app)
      .post('/api/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: invalidToken
      });

    expect(mfaResponse.status).toBe(401);
    expect(mfaResponse.body).toHaveProperty('error');
    expect(mfaResponse.body.error).toContain('Invalid');
  });

  it('should accept valid backup code', async () => {
    const backupCode = backupCodes[0];

    // First, initiate login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'test-password'
      });

    const mfaSessionToken = loginResponse.body.mfaSessionToken;

    // Verify with backup code
    const mfaResponse = await request(app)
      .post('/api/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: backupCode,
        isBackupCode: true
      });

    expect(mfaResponse.status).toBe(200);
    expect(mfaResponse.body).toHaveProperty('success', true);
    expect(mfaResponse.body).toHaveProperty('user');
    expect(mfaResponse.body).toHaveProperty('backupCodeUsed', true);
  });

  it('should not allow reuse of backup code', async () => {
    const usedBackupCode = backupCodes[0];

    // First, initiate login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'test-password'
      });

    const mfaSessionToken = loginResponse.body.mfaSessionToken;

    // Try to use the same backup code again
    const mfaResponse = await request(app)
      .post('/api/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: usedBackupCode,
        isBackupCode: true
      });

    expect(mfaResponse.status).toBe(401);
    expect(mfaResponse.body).toHaveProperty('error');
    expect(mfaResponse.body.error).toContain('already been used');
  });

  it('should generate new MFA secret for setup', async () => {
    // Create a user without MFA
    const [regularUser] = await db.insert(users).values({
      email: 'regular@mfa-test.com',
      firstName: 'Regular',
      lastName: 'User',
      role: 'provider',
      orgId: testOrgId,
      mfaEnabled: false
    }).returning();

    // Request MFA setup (would normally require authentication)
    const setupResponse = await request(app)
      .post('/api/auth/mfa/setup')
      .set('Cookie', `session=test-session-${regularUser.id}`)
      .send({
        userId: regularUser.id
      });

    expect(setupResponse.status).toBe(200);
    expect(setupResponse.body).toHaveProperty('qrCode');
    expect(setupResponse.body).toHaveProperty('secret');
    expect(setupResponse.body).toHaveProperty('backupCodes');
    expect(setupResponse.body.backupCodes).toHaveLength(10);

    // Cleanup
    await db.delete(users).where(eq(users.id, regularUser.id));
  });

  it('should enforce MFA for admin role', async () => {
    // Try to access admin endpoint without MFA verification
    const response = await request(app)
      .get('/api/admin/users')
      .set('Cookie', `session=invalid-session`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  it('should handle MFA time window correctly', async () => {
    // Generate token from past time window (should fail)
    const pastToken = speakeasy.totp({
      secret: mfaSecret,
      encoding: 'base32',
      time: Date.now() / 1000 - 300 // 5 minutes ago
    });

    // First, initiate login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'test-password'
      });

    const mfaSessionToken = loginResponse.body.mfaSessionToken;

    // Try to verify with expired TOTP
    const mfaResponse = await request(app)
      .post('/api/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: pastToken
      });

    expect(mfaResponse.status).toBe(401);
    expect(mfaResponse.body).toHaveProperty('error');
    expect(mfaResponse.body.error).toContain('Invalid');
  });

  it('should disable MFA when requested', async () => {
    // Create a user with MFA enabled
    const [mfaUser] = await db.insert(users).values({
      email: 'disable-mfa@test.com',
      firstName: 'Disable',
      lastName: 'MFA',
      role: 'provider',
      orgId: testOrgId,
      mfaEnabled: true,
      mfaSecret: encryptPHI(mfaSecret),
      mfaBackupCodes: encryptPHI(JSON.stringify(backupCodes))
    }).returning();

    // Generate valid TOTP for verification
    const validToken = speakeasy.totp({
      secret: mfaSecret,
      encoding: 'base32'
    });

    // Disable MFA (requires current TOTP for security)
    const disableResponse = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Cookie', `session=test-session-${mfaUser.id}`)
      .send({
        userId: mfaUser.id,
        code: validToken
      });

    expect(disableResponse.status).toBe(200);
    expect(disableResponse.body).toHaveProperty('success', true);

    // Verify MFA is disabled in database
    const [updatedUser] = await db.select()
      .from(users)
      .where(eq(users.id, mfaUser.id));

    expect(updatedUser.mfaEnabled).toBe(false);
    expect(updatedUser.mfaSecret).toBeNull();
    expect(updatedUser.mfaBackupCodes).toBeNull();

    // Cleanup
    await db.delete(users).where(eq(users.id, mfaUser.id));
  });
});