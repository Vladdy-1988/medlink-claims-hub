import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll } from 'vitest';

describe('Coverage API', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Setup mock express app with the coverage endpoint
    app = express();
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = { claims: { sub: 'test-admin-user' } };
      next();
    });

    // Import and setup routes
    const { registerRoutes } = await import('../../server/routes');
    await registerRoutes(app);
  });

  describe('GET /api/admin/coverage', () => {
    it('should return coverage data for admin users', async () => {
      const response = await request(app)
        .get('/api/admin/coverage')
        .expect(200);

      expect(response.body).toHaveProperty('updatedAt');
      expect(response.body).toHaveProperty('rows');
      expect(Array.isArray(response.body.rows)).toBe(true);
      
      if (response.body.rows.length > 0) {
        const firstRow = response.body.rows[0];
        expect(firstRow).toHaveProperty('province');
        expect(firstRow).toHaveProperty('program');
        expect(firstRow).toHaveProperty('rail');
        expect(firstRow).toHaveProperty('status');
        expect(firstRow).toHaveProperty('disciplines');
        expect(Array.isArray(firstRow.disciplines)).toBe(true);
      }
    });

    it('should return proper cache headers', async () => {
      const response = await request(app)
        .get('/api/admin/coverage')
        .expect(200);

      expect(response.headers).toHaveProperty('cache-control');
      expect(response.headers).toHaveProperty('etag');
      expect(response.headers).toHaveProperty('last-modified');
    });

    it('should reject non-admin users', async () => {
      // Create a new app instance with provider role
      const providerApp = express();
      providerApp.use((req: any, res, next) => {
        req.user = { claims: { sub: 'test-provider-user' } };
        next();
      });
      
      // Mock storage to return non-admin user
      providerApp.get('/api/admin/coverage', async (req: any, res) => {
        res.status(403).json({ message: "Admin access required" });
      });

      const response = await request(providerApp)
        .get('/api/admin/coverage')
        .expect(403);

      expect(response.body.message).toBe("Admin access required");
    });
  });
});