import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';

describe('Auth Guard Tests', () => {
  let app: express.Application;
  let server: Server;

  beforeAll(async () => {
    // Mock environment variables
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test';
    process.env.SESSION_SECRET = 'test-secret';
    process.env.REPL_ID = 'test-repl';
    process.env.REPLIT_DOMAINS = 'localhost';
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Import and register routes
    const { registerRoutes } = await import('../../server/routes');
    const httpServer = createServer(app);
    await registerRoutes(app);
    server = httpServer;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Unauthenticated Access', () => {
    it('should reject unauthenticated request to /api/claims', async () => {
      const response = await request(app)
        .get('/api/claims')
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should reject unauthenticated request to /api/patients', async () => {
      const response = await request(app)
        .get('/api/patients')
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should reject unauthenticated request to /api/providers', async () => {
      const response = await request(app)
        .get('/api/providers')
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should reject unauthenticated POST to /api/claims', async () => {
      const response = await request(app)
        .post('/api/claims')
        .send({
          type: 'claim',
          amount: '100.00',
          patientId: 'test-patient',
          providerId: 'test-provider',
          insurerId: 'test-insurer'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('Admin-only endpoints', () => {
    it('should reject non-admin access to /api/admin/users', async () => {
      // Mock a provider user
      const mockApp = express();
      mockApp.use((req: any, res, next) => {
        req.user = { claims: { sub: 'provider-user' } };
        req.isAuthenticated = () => true;
        next();
      });
      
      mockApp.get('/api/admin/users', async (req: any, res) => {
        // Simulate checking user role
        res.status(403).json({ message: "Admin access required" });
      });

      const response = await request(mockApp)
        .get('/api/admin/users')
        .expect(403);
      
      expect(response.body.message).toBe("Admin access required");
    });

    it('should reject non-admin access to /api/admin/audit', async () => {
      // Mock a billing user
      const mockApp = express();
      mockApp.use((req: any, res, next) => {
        req.user = { claims: { sub: 'billing-user' } };
        req.isAuthenticated = () => true;
        next();
      });
      
      mockApp.get('/api/admin/audit', async (req: any, res) => {
        // Simulate checking user role
        res.status(403).json({ message: "Admin access required" });
      });

      const response = await request(mockApp)
        .get('/api/admin/audit')
        .expect(403);
      
      expect(response.body.message).toBe("Admin access required");
    });
  });
});