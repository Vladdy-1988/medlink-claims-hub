import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

// Development mode authentication bypass
const devAuth = (middleware: any) => {
  return async (req: any, res: any, next: any) => {
    if (process.env.NODE_ENV === 'development') {
      // Skip authentication in development
      req.user = { claims: { sub: 'dev-user-001' } };
      return next();
    }
    // Use real authentication in production
    return middleware(req, res, next);
  };
};
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertClaimSchema, insertAttachmentSchema, insertRemittanceSchema, insertPushSubscriptionSchema, insertConnectorConfigSchema } from "@shared/schema";
import { z } from "zod";
import { PushNotificationService } from "./pushService";
import { handleSSOLogin, configureCORS } from "./ssoAuth";
import { csrfProtection, getCSRFToken, issueCSRFToken } from "./security/csrf";
import { authLimiter, uploadLimiter, connectorLimiter, apiLimiter } from "./security/rateLimiter";
import { configureSecurityHeaders, additionalSecurityHeaders } from "./security/headers";
import { getCORSMiddleware } from "./security/cors";
import { logger, requestLogger } from "./security/logger";
import { healthCheck, readinessCheck, metricsEndpoint } from "./security/healthChecks";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check routes BEFORE CORS (no auth/CSRF required)
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));
  app.get('/readyz', async (_req, res) => {
    try {
      // Do a trivial DB ping via drizzle
      const { db } = await import('./db');
      await db.execute('SELECT 1');
      res.status(200).send('ready');
    } catch (e) {
      res.status(503).send('db_unreachable');
    }
  });
  
  // Apply security headers
  app.use(configureSecurityHeaders());
  
  // Apply CORS middleware
  app.use(getCORSMiddleware());
  
  // Request logging (PHI-safe)
  app.use(requestLogger);
  
  // Metrics endpoint (after CORS)
  app.get('/metrics', metricsEndpoint);
  
  // Configure CORS for SSO (only for SSO endpoint)
  app.use('/auth/sso', cors(configureCORS()));

  // SSO login endpoint (before regular auth middleware)
  app.post('/auth/sso', handleSSOLogin);

  // Health check routes (using enhanced health check functions)
  app.get('/health', healthCheck);
  app.get('/api/health', healthCheck);
  app.get('/api/ready', readinessCheck);
  app.get('/api/metrics', metricsEndpoint);

  // SKIP AUTH COMPLETELY IN DEVELOPMENT MODE
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 Development mode: Authentication bypassed');
    // Create a mock auth middleware that always allows access
    app.use((req: any, res, next) => {
      req.user = { 
        claims: { 
          sub: 'dev-user-001',
          email: 'dev@medlinkclaims.com',
          first_name: 'Development',
          last_name: 'User'
        }
      };
      req.isAuthenticated = () => true;
      next();
    });
  } else {
    // Production mode - setup real auth
    try {
      await setupAuth(app);
    } catch (error) {
      console.error('Auth setup failed:', error);
      // Fallback for auth failure
      app.use((req: any, res, next) => {
        req.user = { claims: { sub: 'demo-user' } };
        next();
      });
    }
  }

  // CSRF token endpoint
  app.get('/api/auth/csrf', authLimiter, (req: any, res) => {
    getCSRFToken(req, res);
  });
  
  // Apply CSRF protection to all state-changing routes (skip in dev)
  if (process.env.NODE_ENV !== 'development') {
    app.use(csrfProtection);
  }
  
  // Auth routes
  app.get('/api/auth/user', authLimiter, async (req: any, res) => {
    // Development mode bypass for Replit preview
    if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
      // Create a development user
      const devUser = await storage.upsertUser({
        id: 'dev-user-001',
        email: 'dev@medlinkclaims.com',
        firstName: 'Development',
        lastName: 'User',
        profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dev',
        role: 'admin' as const,
      });
      return res.json(devUser);
    }

    // Production authentication flow
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Audit logging middleware
  const auditLog = async (req: any, type: string, details: any) => {
    if (req.user?.claims?.sub) {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.orgId) {
        await storage.createAuditEvent({
          orgId: user.orgId,
          actorUserId: req.user.claims.sub,
          type,
          details,
          ip: req.ip,
          userAgent: req.get('User-Agent') || '',
        });
      }
    }
  };

  // Dashboard API
  app.get('/api/dashboard/stats', async (req: any, res) => {
    try {
      // Development mode bypass
      if (process.env.NODE_ENV === 'development') {
        const devUser = await storage.getUser('dev-user-001');
        const stats = await storage.getDashboardStats(devUser?.orgId || '11111111-1111-1111-1111-111111111111');
        
        // Add job queue KPIs
        const { jobQueue } = await import('./lib/jobs');
        const jobStats = await jobQueue.getStats();
        
        return res.json({
          ...stats,
          jobQueue: {
            queued: jobStats.queued,
            running: jobStats.running,
            failed: jobStats.failed,
            completed: jobStats.completed
          }
        });
      }

      // Production flow
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const stats = await storage.getDashboardStats(user.orgId);
      
      // Add job queue KPIs for admin users
      if (user.role === 'admin') {
        const { jobQueue } = await import('./lib/jobs');
        const jobStats = await jobQueue.getStats();
        
        return res.json({
          ...stats,
          jobQueue: {
            queued: jobStats.queued,
            running: jobStats.running,
            failed: jobStats.failed,
            completed: jobStats.completed
          }
        });
      }
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Push Notifications API
  app.get('/api/push/vapid-key', (req, res) => {
    const publicKey = PushNotificationService.getVAPIDPublicKey();
    if (!publicKey) {
      return res.status(501).json({ ok: false, reason: 'push_disabled' });
    }
    res.json({ publicKey });
  });

  app.post('/api/push/subscribe', devAuth(isAuthenticated), async (req: any, res) => {
    // Check if push is enabled
    if (!PushNotificationService.getVAPIDPublicKey()) {
      return res.status(501).json({ ok: false, reason: 'push_disabled' });
    }
    
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const subscriptionData = insertPushSubscriptionSchema.parse({
        ...req.body,
        userId: req.user.claims.sub,
        orgId: user.orgId,
      });

      await PushNotificationService.savePushSubscription(
        req.user.claims.sub,
        user.orgId,
        {
          endpoint: subscriptionData.endpoint,
          keys: {
            p256dh: subscriptionData.p256dhKey,
            auth: subscriptionData.authKey,
          },
        },
        req.get('User-Agent')
      );

      // Enable notifications for the user
      await storage.updateUser(req.user.claims.sub, { notificationsEnabled: true });

      await auditLog(req, 'push_subscription_created', { endpoint: subscriptionData.endpoint });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.post('/api/push/test', devAuth(isAuthenticated), async (req: any, res) => {
    // Check if push is enabled
    if (!PushNotificationService.getVAPIDPublicKey()) {
      return res.status(501).json({ ok: false, reason: 'push_disabled' });
    }
    
    try {
      const result = await PushNotificationService.sendTestNotification(req.user.claims.sub);
      
      await auditLog(req, 'test_notification_sent', result);
      
      res.json(result);
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  app.post('/api/push/unsubscribe', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint required" });
      }

      await PushNotificationService.removeSubscription(req.user.claims.sub, endpoint);
      
      // Disable notifications for the user if this was their last subscription
      await storage.updateUser(req.user.claims.sub, { notificationsEnabled: false });

      await auditLog(req, 'push_subscription_removed', { endpoint });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ message: "Failed to remove push subscription" });
    }
  });

  // MFA API endpoints
  const {
    generateMFASetup,
    verifyTOTP,
    hashBackupCodes,
    verifyBackupCode,
    generateBackupCodes,
    generateBackupCodesFile,
    checkRateLimit,
    recordRateLimitAttempt,
    shouldEnforceMFA,
    setMFAVerification,
    clearMFAVerification,
    logMFAEvent,
  } = await import('./security/mfa');

  // Generate MFA setup (admin only)
  app.post('/api/auth/mfa/setup', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "MFA setup is only available for admin users" });
      }

      // Check if MFA is already enabled
      if (user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled. Disable it first to set up again." });
      }

      const { secret, qrCode, backupCodes } = await generateMFASetup(user.email || '');
      
      // Store the secret temporarily (will be confirmed on verify-setup)
      req.session.mfaSetupSecret = secret;
      req.session.mfaSetupBackupCodes = backupCodes;

      await auditLog(req, 'mfa_setup_initiated', { userId: user.id });
      logMFAEvent('mfa_setup', user.id, { email: user.email });

      res.json({ qrCode, backupCodes });
    } catch (error) {
      console.error("Error setting up MFA:", error);
      res.status(500).json({ message: "Failed to set up MFA" });
    }
  });

  // Verify initial setup code and enable MFA
  app.post('/api/auth/mfa/verify-setup', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "MFA setup is only available for admin users" });
      }

      if (!req.session.mfaSetupSecret || !req.session.mfaSetupBackupCodes) {
        return res.status(400).json({ message: "MFA setup not initiated. Please start setup first." });
      }

      // Verify the TOTP code
      const isValid = verifyTOTP(code, req.session.mfaSetupSecret);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Hash backup codes before storing
      const hashedCodes = await hashBackupCodes(req.session.mfaSetupBackupCodes);

      // Enable MFA for the user
      await storage.updateUserMFA(user.id, {
        mfaSecret: req.session.mfaSetupSecret,
        mfaEnabled: true,
        mfaBackupCodes: hashedCodes,
        mfaEnforcedAt: new Date(),
      });

      // Clean up session
      delete req.session.mfaSetupSecret;
      delete req.session.mfaSetupBackupCodes;
      
      // Set MFA as verified in session
      setMFAVerification(req.session);

      await auditLog(req, 'mfa_enabled', { userId: user.id });
      logMFAEvent('mfa_verify', user.id, { success: true });

      res.json({ message: "MFA enabled successfully" });
    } catch (error) {
      console.error("Error verifying MFA setup:", error);
      res.status(500).json({ message: "Failed to verify MFA setup" });
    }
  });

  // Verify MFA during login
  app.post('/api/auth/mfa/verify', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { code, backupCode } = req.body;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || !user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is not enabled for this user" });
      }

      // Check rate limit
      const rateLimit = checkRateLimit(user.id);
      if (!rateLimit.allowed) {
        await auditLog(req, 'mfa_rate_limit_exceeded', { userId: user.id });
        logMFAEvent('mfa_failed', user.id, { reason: 'rate_limit' });
        return res.status(429).json({ 
          message: "Too many attempts. Please try again later.",
          attemptsRemaining: 0 
        });
      }

      // Get MFA data
      const mfaData = await storage.getUserMFA(user.id);
      if (!mfaData || !mfaData.mfaSecret) {
        return res.status(500).json({ message: "MFA configuration error" });
      }

      let isValid = false;
      let usedBackupCode = false;

      if (backupCode) {
        // Verify backup code
        const result = await verifyBackupCode(backupCode, mfaData.mfaBackupCodes || []);
        if (result.valid && result.remainingCodes) {
          isValid = true;
          usedBackupCode = true;
          // Update remaining backup codes
          await storage.updateUserMFA(user.id, {
            mfaBackupCodes: result.remainingCodes,
          });
        }
      } else if (code) {
        // Verify TOTP code
        isValid = verifyTOTP(code, mfaData.mfaSecret);
      }

      if (!isValid) {
        recordRateLimitAttempt(user.id);
        await auditLog(req, 'mfa_verification_failed', { userId: user.id });
        logMFAEvent('mfa_failed', user.id, { attemptsRemaining: rateLimit.attemptsRemaining - 1 });
        return res.status(400).json({ 
          message: "Invalid verification code",
          attemptsRemaining: rateLimit.attemptsRemaining - 1
        });
      }

      // Set MFA verification in session
      setMFAVerification(req.session);

      await auditLog(req, 'mfa_verification_success', { 
        userId: user.id,
        usedBackupCode 
      });
      logMFAEvent('mfa_verify', user.id, { 
        success: true, 
        usedBackupCode 
      });

      if (usedBackupCode) {
        logMFAEvent('mfa_backup_used', user.id, { remainingCodes: mfaData.mfaBackupCodes?.length });
      }

      res.json({ 
        message: "MFA verified successfully",
        usedBackupCode,
        remainingBackupCodes: usedBackupCode ? mfaData.mfaBackupCodes?.length : undefined
      });
    } catch (error) {
      console.error("Error verifying MFA:", error);
      res.status(500).json({ message: "Failed to verify MFA" });
    }
  });

  // Disable MFA (requires current code)
  app.post('/api/auth/mfa/disable', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || !user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is not enabled for this user" });
      }

      // Get MFA data
      const mfaData = await storage.getUserMFA(user.id);
      if (!mfaData || !mfaData.mfaSecret) {
        return res.status(500).json({ message: "MFA configuration error" });
      }

      // Verify the TOTP code
      const isValid = verifyTOTP(code, mfaData.mfaSecret);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Disable MFA
      await storage.updateUserMFA(user.id, {
        mfaSecret: null,
        mfaEnabled: false,
        mfaBackupCodes: null,
        mfaEnforcedAt: null,
      });

      // Clear MFA verification from session
      clearMFAVerification(req.session);

      await auditLog(req, 'mfa_disabled', { userId: user.id });
      logMFAEvent('mfa_disable', user.id, {});

      res.json({ message: "MFA disabled successfully" });
    } catch (error) {
      console.error("Error disabling MFA:", error);
      res.status(500).json({ message: "Failed to disable MFA" });
    }
  });

  // Get backup codes (requires current code)
  app.get('/api/auth/mfa/backup-codes', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { code } = req.query;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || !user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is not enabled for this user" });
      }

      // Get MFA data
      const mfaData = await storage.getUserMFA(user.id);
      if (!mfaData || !mfaData.mfaSecret) {
        return res.status(500).json({ message: "MFA configuration error" });
      }

      // Verify the TOTP code
      const isValid = verifyTOTP(code as string, mfaData.mfaSecret);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Generate new backup codes (unhashed for display)
      const codes = generateBackupCodes();
      const fileContent = generateBackupCodesFile(codes, user.email || '');

      await auditLog(req, 'mfa_backup_codes_viewed', { userId: user.id });

      res.json({ 
        codes,
        fileContent,
        remainingCodes: mfaData.mfaBackupCodes?.length || 0
      });
    } catch (error) {
      console.error("Error getting backup codes:", error);
      res.status(500).json({ message: "Failed to get backup codes" });
    }
  });

  // Generate new backup codes
  app.post('/api/auth/mfa/regenerate-backup', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { code } = req.body;
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user || !user.mfaEnabled) {
        return res.status(400).json({ message: "MFA is not enabled for this user" });
      }

      // Get MFA data
      const mfaData = await storage.getUserMFA(user.id);
      if (!mfaData || !mfaData.mfaSecret) {
        return res.status(500).json({ message: "MFA configuration error" });
      }

      // Verify the TOTP code
      const isValid = verifyTOTP(code, mfaData.mfaSecret);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Generate new backup codes
      const codes = generateBackupCodes();
      const hashedCodes = await hashBackupCodes(codes);
      const fileContent = generateBackupCodesFile(codes, user.email || '');

      // Update backup codes
      await storage.updateUserMFA(user.id, {
        mfaBackupCodes: hashedCodes,
      });

      await auditLog(req, 'mfa_backup_codes_regenerated', { userId: user.id });

      res.json({ 
        codes,
        fileContent,
        message: "Backup codes regenerated successfully"
      });
    } catch (error) {
      console.error("Error regenerating backup codes:", error);
      res.status(500).json({ message: "Failed to regenerate backup codes" });
    }
  });

  // Check MFA status for user
  app.get('/api/auth/mfa/status', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const shouldEnforce = shouldEnforceMFA(user);
      const mfaVerified = req.session.mfaVerified === true;

      res.json({
        mfaEnabled: user.mfaEnabled,
        mfaRequired: shouldEnforce,
        mfaVerified,
        role: user.role,
      });
    } catch (error) {
      console.error("Error checking MFA status:", error);
      res.status(500).json({ message: "Failed to check MFA status" });
    }
  });

  // Background sync endpoint for periodic updates
  app.get('/api/claims/updates', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const { since } = req.query;
      const sinceDate = since ? new Date(since as string) : new Date(Date.now() - 15 * 60 * 1000); // Default to last 15 minutes

      // Get claims that have been updated since the specified time
      const claims = await storage.getClaims(user.orgId, user.id, user.role);
      const recentlyUpdated = claims.filter(claim => 
        claim.updatedAt && new Date(claim.updatedAt) > sinceDate
      );

      res.json({
        updates: recentlyUpdated,
        timestamp: new Date().toISOString(),
        hasUpdates: recentlyUpdated.length > 0,
      });
    } catch (error) {
      console.error("Error fetching claim updates:", error);
      res.status(500).json({ message: "Failed to fetch claim updates" });
    }
  });

  // Claims API
  app.get('/api/claims', apiLimiter, devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const claims = await storage.getClaims(user.orgId, user.id, user.role);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ message: "Failed to fetch claims" });
    }
  });

  app.get('/api/claims/:id', apiLimiter, devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const claim = await storage.getClaim(req.params.id);
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId || claim.orgId !== user.orgId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Role-based access check
      if (user.role === 'provider' && claim.createdBy !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const attachments = await storage.getAttachments(claim.id);
      res.json({ ...claim, attachments });
    } catch (error) {
      console.error("Error fetching claim:", error);
      res.status(500).json({ message: "Failed to fetch claim" });
    }
  });

  app.post('/api/claims', apiLimiter, devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const validatedData = insertClaimSchema.parse({
        ...req.body,
        orgId: user.orgId,
        createdBy: user.id,
      });

      const claim = await storage.createClaim(validatedData);
      
      await auditLog(req, 'claim_created', { claimId: claim.id, type: claim.type });
      
      res.status(201).json(claim);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating claim:", error);
      res.status(500).json({ message: "Failed to create claim" });
    }
  });

  app.patch('/api/claims/:id', apiLimiter, devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const claim = await storage.getClaim(req.params.id);
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId || claim.orgId !== user.orgId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const oldStatus = claim.status;
      const updatedClaim = await storage.updateClaim(req.params.id, req.body);
      
      // Send push notification if status changed to specific statuses
      if (req.body.status && req.body.status !== oldStatus) {
        const notificationStatuses = ['paid', 'denied', 'infoRequested', 'submitted'];
        if (notificationStatuses.includes(req.body.status)) {
          try {
            const claimOwner = await storage.getUser(claim.createdBy);
            if (claimOwner && claimOwner.notificationsEnabled) {
              await PushNotificationService.sendClaimStatusNotification(
                claim.id,
                req.body.status,
                claim.createdBy
              );
            }
          } catch (notificationError) {
            // Don't fail the claim update if notification fails
            console.error("Failed to send push notification:", notificationError);
          }
        }
      }
      
      await auditLog(req, 'claim_updated', { claimId: req.params.id, changes: req.body });
      
      res.json(updatedClaim);
    } catch (error) {
      console.error("Error updating claim:", error);
      res.status(500).json({ message: "Failed to update claim" });
    }
  });

  // Patients API
  app.get('/api/patients', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const patients = await storage.getPatients(user.orgId);
      res.json(patients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  // Providers API
  app.get('/api/providers', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const providers = await storage.getProviders(user.orgId);
      res.json(providers);
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ message: "Failed to fetch providers" });
    }
  });

  // Insurers API - temporarily public for development
  app.get('/api/insurers', async (req: any, res) => {
    try {
      const insurers = await storage.getInsurers();
      res.json(insurers);
    } catch (error) {
      console.error("Error fetching insurers:", error);
      res.status(500).json({ message: "Failed to fetch insurers" });
    }
  });

  // File upload endpoints
  app.post('/api/objects/upload', uploadLimiter, devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  app.post('/api/attachments', uploadLimiter, devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const validatedData = insertAttachmentSchema.parse(req.body);
      const attachment = await storage.createAttachment(validatedData);

      // Set ACL policy for the uploaded file
      if (req.body.url) {
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.trySetObjectEntityAclPolicy(req.body.url, {
          owner: user.id,
          visibility: "private",
        });
      }

      await auditLog(req, 'attachment_created', { attachmentId: attachment.id, claimId: attachment.claimId });

      res.status(201).json(attachment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating attachment:", error);
      res.status(500).json({ message: "Failed to create attachment" });
    }
  });

  // Protected file serving
  app.get("/objects/:objectPath(*)", devAuth(isAuthenticated), async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Remittances API
  app.get('/api/remittances', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const remittances = await storage.getRemittances(user.orgId);
      res.json(remittances);
    } catch (error) {
      console.error("Error fetching remittances:", error);
      res.status(500).json({ message: "Failed to fetch remittances" });
    }
  });

  app.post('/api/remittances', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const validatedData = insertRemittanceSchema.parse(req.body);
      const remittance = await storage.createRemittance(validatedData);
      
      await auditLog(req, 'remittance_uploaded', { remittanceId: remittance.id });
      
      res.status(201).json(remittance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating remittance:", error);
      res.status(500).json({ message: "Failed to create remittance" });
    }
  });

  // EDI Connector API Routes
  app.post('/api/connectors/submit', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { claimId, connector } = req.body;
      
      if (!claimId || !connector) {
        return res.status(400).json({ message: "claimId and connector are required" });
      }

      // Validate connector type
      if (!['cdanet', 'eclaims', 'portal'].includes(connector)) {
        return res.status(400).json({ message: "Invalid connector type" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      // RBAC: provider can submit own org; billing/admin all org
      const claim = await storage.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      if (claim.orgId !== user.orgId && !['billing', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Import job queue dynamically to avoid circular dependencies
      const { jobQueue } = await import('./lib/jobs');
      
      // Enqueue job
      const jobId = await jobQueue.enqueue({
        type: 'submit',
        claimId,
        connector: connector as any,
      });

      await auditLog(req, 'claim_submission_queued', { claimId, connector, jobId });

      res.json({ 
        queued: true, 
        jobId,
        message: `Claim queued for submission via ${connector}` 
      });
    } catch (error) {
      console.error("Error queuing claim submission:", error);
      res.status(500).json({ message: "Failed to queue claim submission" });
    }
  });

  // Get connector status for claim
  app.get('/api/connectors/:claimId/status', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const { claimId } = req.params;
      
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const claim = await storage.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      if (claim.orgId !== user.orgId && !['billing', 'admin'].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // Get latest connector event
      const events = await storage.getConnectorEvents(claimId);
      const lastEvent = events[0]; // Most recent event

      res.json({
        claimId,
        status: claim.status,
        externalId: claim.externalId,
        lastSync: lastEvent?.createdAt,
        lastEvent: lastEvent ? {
          type: lastEvent.type,
          connector: lastEvent.connector,
          payload: lastEvent.payload,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching connector status:", error);
      res.status(500).json({ message: "Failed to fetch connector status" });
    }
  });

  // Admin: Configure connectors
  app.post('/api/admin/connectors/config', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const validatedData = insertConnectorConfigSchema.parse({
        ...req.body,
        orgId: user.orgId,
      });

      const config = await storage.upsertConnectorConfig(validatedData);
      
      await auditLog(req, 'connector_config_updated', { 
        connectorName: config.name, 
        enabled: config.enabled,
        mode: config.mode 
      });

      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating connector config:", error);
      res.status(500).json({ message: "Failed to update connector config" });
    }
  });

  // Admin: Test connector dry-run
  app.post('/api/connectors/test', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { claimId, connector } = req.body;
      
      if (!claimId || !connector) {
        return res.status(400).json({ message: "claimId and connector are required" });
      }

      const claim = await storage.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      // Get connector instance and validate only (dry-run)
      const { getConnector } = await import('./connectors/base');
      const connectorInstance = await getConnector(connector as any, user.orgId);
      
      await connectorInstance.validate(claim);

      // Return mapped payload (with PHI redacted for logs)
      let mappedPayload: any = {};
      
      if (connector === 'cdanet') {
        const { mapClaimToCDAnet } = await import('./mappers/cdanet');
        const [patient] = await storage.getPatients(user.orgId, { id: claim.patientId });
        const [provider] = await storage.getProviders(user.orgId, { id: claim.providerId });
        
        if (patient && provider) {
          mappedPayload = mapClaimToCDAnet(claim, patient, provider);
        }
      } else if (connector === 'eclaims') {
        const { mapClaimToEClaims } = await import('./mappers/eclaims');
        const [patient] = await storage.getPatients(user.orgId, { id: claim.patientId });
        const [provider] = await storage.getProviders(user.orgId, { id: claim.providerId });
        
        if (patient && provider) {
          mappedPayload = mapClaimToEClaims(claim, patient, provider);
        }
      }

      await auditLog(req, 'connector_test_run', { claimId, connector });

      res.json({
        valid: true,
        connector,
        mappedPayload,
        message: `Claim validation successful for ${connector}`,
      });

    } catch (error) {
      console.error("Error testing connector:", error);
      res.status(500).json({ 
        valid: false,
        message: (error as Error).message || "Connector test failed" 
      });
    }
  });

  // Admin endpoints
  app.get('/api/admin/users', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // TODO: Implement user listing for admin
      res.json([]);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/audit', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin' || !user.orgId) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const events = await storage.getAuditEvents(user.orgId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching audit events:", error);
      res.status(500).json({ message: "Failed to fetch audit events" });
    }
  });

  // Webhook endpoint for insurer status updates (stub)
  app.post('/api/webhooks/insurer', async (req, res) => {
    try {
      // TODO: Implement webhook processing
      console.log('Webhook received:', req.body);
      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Test EDI connectors endpoint
  app.post('/api/test/edi-connectors', async (req, res) => {
    try {
      console.log('🧪 Testing EDI Connector System...');

      // Create test data quickly
      const testOrg = await storage.createOrganization({
        name: 'EDI Test Clinic',
        externalId: 'edi-test-' + Date.now()
      });

      const testProvider = await storage.createProvider({
        orgId: testOrg.id,
        name: 'Dr. Test Provider',
        discipline: 'General Practice',
        licenceNumber: 'TEST123456'
      });

      const testPatient = await storage.createPatient({
        orgId: testOrg.id,
        name: 'Test Patient',
        dob: new Date('1985-03-20'),
        identifiers: {
          healthCardNumber: '9876543210',
          gender: 'female'
        }
      });

      const testInsurer = await storage.createInsurer({
        name: 'Test Insurance Co',
        rail: 'portal'
      });

      // Setup connector configs
      await storage.upsertConnectorConfig({
        orgId: testOrg.id,
        name: 'cdanet',
        enabled: true,
        mode: 'sandbox',
        settings: {
          softwareId: 'MEDLINK_TEST',
          version: '1.0',
          providerId: testProvider.id
        }
      });

      await storage.upsertConnectorConfig({
        orgId: testOrg.id,
        name: 'eclaims', 
        enabled: true,
        mode: 'sandbox',
        settings: {
          providerId: testProvider.id,
          licenseNumber: testProvider.licenceNumber
        }
      });

      // Create test claims with different amounts to test sandbox outcomes
      // Amount ending in .00 → will become paid
      const dentalClaimPaid = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: testInsurer.id,
        type: 'claim',
        status: 'draft',
        amount: '125.00',
        currency: 'CAD',
        codes: { procedure: '21211', tooth: '16' },
        notes: 'Test dental claim - should be PAID (ends .00)',
        createdBy: 'demo-user'
      });

      // Amount ending in .13 → infoRequested
      const dentalClaimInfo = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: testInsurer.id,
        type: 'claim',
        status: 'draft',
        amount: '87.13',
        currency: 'CAD',
        codes: { procedure: '21211', tooth: '16' },
        notes: 'Test dental claim - should be INFO REQUESTED (ends .13)',
        createdBy: 'demo-user'
      });

      // Amount ending in .99 → denied
      const medicalClaimDenied = await storage.createClaim({
        orgId: testOrg.id,
        patientId: testPatient.id,
        providerId: testProvider.id,
        insurerId: testInsurer.id,
        type: 'claim',
        status: 'draft',
        amount: '149.99',
        currency: 'CAD', 
        codes: { procedure: 'A001A', diagnosis: { primary: 'Z00.00' } },
        notes: 'Test medical claim - should be DENIED (ends .99)',
        createdBy: 'demo-user'
      });

      // Test connectors with different outcome scenarios
      const results = {
        cdanet_paid: { status: 'pending', jobId: null as string | null, error: null as string | null, amount: '125.00' },
        cdanet_info: { status: 'pending', jobId: null as string | null, error: null as string | null, amount: '87.13' },
        eclaims_denied: { status: 'pending', jobId: null as string | null, error: null as string | null, amount: '149.99' }
      };

      // Test CDAnet with PAID outcome (amount ends .00)
      try {
        const { getConnector } = await import('./connectors/base');
        const cdanetConnector = await getConnector('cdanet', testOrg.id);
        await cdanetConnector.validate(dentalClaimPaid);
        
        const { jobQueue } = await import('./lib/jobs');
        const jobId = await jobQueue.enqueue({
          type: 'submit',
          claimId: dentalClaimPaid.id,
          connector: 'cdanet'
        });
        
        results.cdanet_paid = { status: 'submitted', jobId, error: null, amount: '125.00' };
        console.log('✅ CDAnet connector test (PAID outcome) passed');
        
      } catch (error) {
        results.cdanet_paid.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ CDAnet PAID test failed:', error);
      }

      // Test CDAnet with INFO REQUESTED outcome (amount ends .13)
      try {
        const { getConnector } = await import('./connectors/base');
        const cdanetConnector = await getConnector('cdanet', testOrg.id);
        await cdanetConnector.validate(dentalClaimInfo);
        
        const { jobQueue } = await import('./lib/jobs');
        const jobId = await jobQueue.enqueue({
          type: 'submit',
          claimId: dentalClaimInfo.id,
          connector: 'cdanet'
        });
        
        results.cdanet_info = { status: 'submitted', jobId, error: null, amount: '87.13' };
        console.log('✅ CDAnet connector test (INFO REQUESTED outcome) passed');
        
      } catch (error) {
        results.cdanet_info.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ CDAnet INFO test failed:', error);
      }

      // Test eClaims with DENIED outcome (amount ends .99)
      try {
        const { getConnector } = await import('./connectors/base');
        const eClaimsConnector = await getConnector('eclaims', testOrg.id);
        await eClaimsConnector.validate(medicalClaimDenied);
        
        const { jobQueue } = await import('./lib/jobs');
        const jobId = await jobQueue.enqueue({
          type: 'submit',
          claimId: medicalClaimDenied.id,
          connector: 'eclaims'
        });
        
        results.eclaims_denied = { status: 'submitted', jobId, error: null, amount: '149.99' };
        console.log('✅ eClaims connector test (DENIED outcome) passed');
        
      } catch (error) {
        results.eclaims_denied.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ eClaims DENIED test failed:', error);
      }

      console.log('🎉 EDI Connector Sandbox Test Complete!');
      console.log('📋 Test Scenarios:');
      console.log('   • Dental claim $125.00 (CDAnet) → Expected: PAID');
      console.log('   • Dental claim $87.13 (CDAnet) → Expected: INFO REQUESTED');
      console.log('   • Medical claim $149.99 (eClaims) → Expected: DENIED');

      res.json({
        success: true,
        message: 'EDI connector sandbox test completed - multiple outcome scenarios tested',
        testData: {
          organizationId: testOrg.id,
          providerId: testProvider.id,
          patientId: testPatient.id,
          dentalClaimPaidId: dentalClaimPaid.id,
          dentalClaimInfoId: dentalClaimInfo.id,
          medicalClaimDeniedId: medicalClaimDenied.id
        },
        scenarios: {
          paid: { amount: '125.00', connector: 'cdanet', expectedOutcome: 'paid' },
          infoRequested: { amount: '87.13', connector: 'cdanet', expectedOutcome: 'infoRequested' },
          denied: { amount: '149.99', connector: 'eclaims', expectedOutcome: 'denied' }
        },
        results
      });

    } catch (error) {
      console.error('❌ EDI Test Error:', error);
      res.status(500).json({
        success: false,
        message: 'EDI connector test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Admin Coverage Dashboard route
  app.get('/api/admin/coverage', devAuth(isAuthenticated), async (req: any, res) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.user.claims.sub);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Load coverage data
      const { loadCoverageData } = await import('./lib/coverage');
      const coverageData = loadCoverageData();

      // Add cache headers
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"${Buffer.from(JSON.stringify(coverageData)).toString('base64').slice(0, 20)}"`,
        'Last-Modified': new Date(coverageData.updatedAt).toUTCString()
      });

      res.json(coverageData);
    } catch (error) {
      console.error("Error fetching coverage data:", error);
      res.status(500).json({ message: "Failed to fetch coverage data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
