import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertClaimSchema, insertAttachmentSchema, insertRemittanceSchema, insertPushSubscriptionSchema } from "@shared/schema";
import { z } from "zod";
import { PushNotificationService } from "./pushService";
import { handleSSOLogin, configureCORS } from "./ssoAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure CORS for SSO (only for SSO endpoint)
  app.use('/auth/sso', cors(configureCORS()));

  // SSO login endpoint (before regular auth middleware)
  app.post('/auth/sso', handleSSOLogin);

  // Auth middleware
  await setupAuth(app);

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

  // Connector endpoints (stubs)
  app.post('/api/connectors/submit', isAuthenticated, async (req: any, res) => {
    try {
      const { claimId, rail } = req.body;
      
      if (!claimId || !rail) {
        return res.status(400).json({ message: "claimId and rail are required" });
      }

      const claim = await storage.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ message: "Claim not found" });
      }

      // Simulate submission to external system
      const referenceNumber = `${rail.toUpperCase()}-${Date.now()}`;
      
      await storage.updateClaim(claimId, {
        status: 'submitted',
        referenceNumber,
      });

      await auditLog(req, 'claim_submitted', { claimId, rail, referenceNumber });

      res.json({ 
        success: true, 
        referenceNumber,
        message: `Claim submitted via ${rail}` 
      });
    } catch (error) {
      console.error("Error submitting claim:", error);
      res.status(500).json({ message: "Failed to submit claim" });
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
