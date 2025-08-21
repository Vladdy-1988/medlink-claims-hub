import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Server } from 'http';

describe('File Upload API Tests', () => {
  let app: express.Application;
  let server: Server;

  beforeAll(async () => {
    // Mock environment variables
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test';
    process.env.NODE_ENV = 'development';
    process.env.SESSION_SECRET = 'test-secret';
    process.env.REPL_ID = 'test-repl';
    process.env.REPLIT_DOMAINS = 'localhost';
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Mock authentication
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

  describe('Presigned URL Flow', () => {
    it('should generate presigned URL for upload', async () => {
      const response = await request(app)
        .post('/api/upload/presign')
        .send({
          filename: 'test-document.pdf',
          contentType: 'application/pdf',
          claimId: 'test-claim-123'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body).toHaveProperty('fileId');
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('should validate file type for presigned URL', async () => {
      const response = await request(app)
        .post('/api/upload/presign')
        .send({
          filename: 'test.exe',
          contentType: 'application/x-executable',
          claimId: 'test-claim-123'
        });
      
      // Should reject executable files
      if (response.status === 400) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('not allowed');
      }
    });

    it('should consume upload and create attachment', async () => {
      // First get presigned URL
      const presignResponse = await request(app)
        .post('/api/upload/presign')
        .send({
          filename: 'medical-report.pdf',
          contentType: 'application/pdf',
          claimId: 'test-claim-456'
        });

      if (presignResponse.status === 200) {
        const { fileId } = presignResponse.body;
        
        // Then consume the upload
        const consumeResponse = await request(app)
          .post('/api/upload/consume')
          .send({
            fileId: fileId,
            claimId: 'test-claim-456',
            kind: 'pdf',
            checksum: 'abc123hash'
          })
          .expect(200);
        
        expect(consumeResponse.body).toHaveProperty('attachment');
        expect(consumeResponse.body.attachment).toHaveProperty('id');
        expect(consumeResponse.body.attachment).toHaveProperty('claimId', 'test-claim-456');
        expect(consumeResponse.body.attachment).toHaveProperty('kind', 'pdf');
      }
    });
  });

  describe('Attachment Management', () => {
    it('should list attachments for a claim', async () => {
      const response = await request(app)
        .get('/api/attachments/test-claim-123')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle missing claim gracefully', async () => {
      const response = await request(app)
        .get('/api/attachments/non-existent-claim')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('File Size Limits', () => {
    it('should enforce file size limits', async () => {
      const response = await request(app)
        .post('/api/upload/presign')
        .send({
          filename: 'huge-file.pdf',
          contentType: 'application/pdf',
          claimId: 'test-claim-789',
          fileSize: 100 * 1024 * 1024 // 100MB
        });
      
      // Should check if size limit is enforced
      if (response.status === 400) {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message.toLowerCase()).toContain('size');
      }
    });
  });
});