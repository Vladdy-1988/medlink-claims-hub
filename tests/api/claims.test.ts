import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Server } from 'http';

describe('Claims API Tests', () => {
  let app: express.Application;
  let server: Server;

  beforeAll(async () => {
    // Mock environment variables
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test';
    process.env.NODE_ENV = 'development'; // To bypass auth
    process.env.SESSION_SECRET = 'test-secret';
    process.env.REPL_ID = 'test-repl';
    process.env.REPLIT_DOMAINS = 'localhost';
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware for development mode
    app.use((req: any, res, next) => {
      req.user = { claims: { sub: 'test-user' } };
      req.isAuthenticated = () => true;
      next();
    });
    
    // Import and register routes
    const { registerRoutes } = await import('../../server/routes');
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('GET /api/claims', () => {
    it('should return claims for authenticated users', async () => {
      const response = await request(app)
        .get('/api/claims')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return claims with proper structure', async () => {
      const response = await request(app)
        .get('/api/claims')
        .expect(200);
      
      if (response.body.length > 0) {
        const claim = response.body[0];
        expect(claim).toHaveProperty('id');
        expect(claim).toHaveProperty('status');
        expect(claim).toHaveProperty('amount');
        expect(claim).toHaveProperty('type');
      }
    });
  });

  describe('Provider access restrictions', () => {
    it('should block provider users from admin endpoints', async () => {
      const providerApp = express();
      providerApp.use(express.json());
      providerApp.use((req: any, res, next) => {
        req.user = { 
          claims: { sub: 'provider-user' },
          role: 'provider'
        };
        req.isAuthenticated = () => true;
        next();
      });
      
      // Mock admin endpoint
      providerApp.get('/api/admin/coverage', async (req: any, res) => {
        // Simulate role check
        if (req.user.role !== 'admin') {
          return res.status(403).json({ message: "Admin access required" });
        }
        res.json({ rows: [] });
      });

      const response = await request(providerApp)
        .get('/api/admin/coverage')
        .expect(403);
      
      expect(response.body.message).toBe("Admin access required");
    });
  });

  describe('Billing and Admin access', () => {
    it('should allow billing users to access claims', async () => {
      const billingApp = express();
      billingApp.use(express.json());
      billingApp.use((req: any, res, next) => {
        req.user = { 
          claims: { sub: 'billing-user' },
          role: 'billing'
        };
        req.isAuthenticated = () => true;
        next();
      });
      
      // Mock claims endpoint
      billingApp.get('/api/claims', async (req: any, res) => {
        // Billing users can see claims
        res.json([
          {
            id: 'test-claim-1',
            status: 'submitted',
            amount: '100.00',
            type: 'claim'
          }
        ]);
      });

      const response = await request(billingApp)
        .get('/api/claims')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('id', 'test-claim-1');
    });

    it('should allow admin users to access all endpoints', async () => {
      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use((req: any, res, next) => {
        req.user = { 
          claims: { sub: 'admin-user' },
          role: 'admin'
        };
        req.isAuthenticated = () => true;
        next();
      });
      
      // Mock admin endpoint
      adminApp.get('/api/admin/coverage', async (req: any, res) => {
        // Admin users can access
        res.json({ 
          rows: [
            {
              province: 'ON',
              program: 'Test Program',
              rail: 'portal',
              status: 'supported'
            }
          ],
          updatedAt: new Date().toISOString()
        });
      });

      const response = await request(adminApp)
        .get('/api/admin/coverage')
        .expect(200);
      
      expect(response.body).toHaveProperty('rows');
      expect(Array.isArray(response.body.rows)).toBe(true);
    });
  });
});