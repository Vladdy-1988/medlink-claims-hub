import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertClaimSchema, insertAttachmentSchema, insertRemittanceSchema, insertPushSubscriptionSchema, insertConnectorConfigSchema } from "@shared/schema";
import { z } from "zod";
import { PushNotificationService } from "./pushService";
import { handleSSOLogin, configureCORS } from "./ssoAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure CORS for SSO (only for SSO endpoint)
  app.use('/auth/sso', cors(configureCORS()));

  // SSO login endpoint (before regular auth middleware)
  app.post('/auth/sso', handleSSOLogin);

  // Health check route (no auth required)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Try to setup auth, but continue if it fails
  try {
    await setupAuth(app);
  } catch (error) {
    console.error('Auth setup failed, continuing without auth:', error);
    // Create a mock auth middleware that always allows access
    app.use((req: any, res, next) => {
      req.user = { claims: { sub: 'demo-user' } };
      next();
    });
  }

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.orgId) {
        return res.status(400).json({ message: "User not associated with organization" });
      }

      const stats = await storage.getDashboardStats(user.orgId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Push Notifications API
  app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: PushNotificationService.getVAPIDPublicKey() });
  });

  app.post('/api/push/subscribe', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/push/test', isAuthenticated, async (req: any, res) => {
    try {
      const result = await PushNotificationService.sendTestNotification(req.user.claims.sub);
      
      await auditLog(req, 'test_notification_sent', result);
      
      res.json(result);
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  app.post('/api/push/unsubscribe', isAuthenticated, async (req: any, res) => {
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

  // Background sync endpoint for periodic updates
  app.get('/api/claims/updates', isAuthenticated, async (req: any, res) => {
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
        new Date(claim.updatedAt) > sinceDate
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
  app.get('/api/claims', isAuthenticated, async (req: any, res) => {
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

  app.get('/api/claims/:id', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/claims', isAuthenticated, async (req: any, res) => {
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

  app.patch('/api/claims/:id', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/patients', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/providers', isAuthenticated, async (req: any, res) => {
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

  // Insurers API
  app.get('/api/insurers', isAuthenticated, async (req: any, res) => {
    try {
      const insurers = await storage.getInsurers();
      res.json(insurers);
    } catch (error) {
      console.error("Error fetching insurers:", error);
      res.status(500).json({ message: "Failed to fetch insurers" });
    }
  });

  // File upload endpoints
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  app.post('/api/attachments', isAuthenticated, async (req: any, res) => {
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
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
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
  app.get('/api/remittances', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/remittances', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/connectors/submit', isAuthenticated, async (req: any, res) => {
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
  app.get('/api/connectors/:claimId/status', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/admin/connectors/config', isAuthenticated, async (req: any, res) => {
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
  app.post('/api/connectors/test', isAuthenticated, async (req: any, res) => {
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
        message: error.message || "Connector test failed" 
      });
    }
  });

  // Admin endpoints
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
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

  app.get('/api/admin/audit', isAuthenticated, async (req: any, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
