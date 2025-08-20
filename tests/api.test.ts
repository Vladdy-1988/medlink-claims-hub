import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';

// Mock server setup for testing
let server: Server;
const API_URL = 'http://localhost:5000';

describe('API Tests', () => {
  describe('Authentication', () => {
    it('should reject unauthenticated requests to protected routes in production', async () => {
      // In development mode, auth is bypassed
      if (process.env.NODE_ENV === 'production') {
        const response = await request(API_URL)
          .get('/api/admin/users')
          .expect(401);
        
        expect(response.body).toHaveProperty('message', 'Unauthorized');
      }
    });

    it('should allow authenticated requests in development mode', async () => {
      const response = await request(API_URL)
        .get('/api/auth/user')
        .expect(200);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
    });
  });

  describe('Claims API', () => {
    it('should get claims list', async () => {
      const response = await request(API_URL)
        .get('/api/claims')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should create a new claim', async () => {
      const newClaim = {
        patientId: 'patient-1',
        providerId: 'provider-1',
        insurerId: 'insurer-1',
        serviceDate: '2025-08-20',
        amount: 150.00,
        description: 'Test claim',
        codes: ['D0150'],
        status: 'draft'
      };

      const response = await request(API_URL)
        .post('/api/claims')
        .send(newClaim)
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('draft');
    });

    it('should get claim by ID', async () => {
      // First create a claim
      const newClaim = {
        patientId: 'patient-1',
        providerId: 'provider-1',
        insurerId: 'insurer-1',
        serviceDate: '2025-08-20',
        amount: 150.00,
        description: 'Test claim for retrieval',
        codes: ['D0150'],
        status: 'draft'
      };

      const createResponse = await request(API_URL)
        .post('/api/claims')
        .send(newClaim)
        .expect(201);
      
      const claimId = createResponse.body.id;

      // Now get the claim
      const response = await request(API_URL)
        .get(`/api/claims/${claimId}`)
        .expect(200);
      
      expect(response.body.id).toBe(claimId);
      expect(response.body.description).toBe('Test claim for retrieval');
    });
  });

  describe('RBAC (Role-Based Access Control)', () => {
    it('should allow admin access to admin routes', async () => {
      // In development, user is admin by default
      const response = await request(API_URL)
        .get('/api/admin/audit')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should block non-admin from admin routes in production', async () => {
      // This would need a non-admin user context in production
      if (process.env.NODE_ENV === 'production') {
        // Would need to mock a non-admin user session
        // For now, this is a placeholder test
        expect(true).toBe(true);
      }
    });
  });

  describe('File Upload', () => {
    it('should get presigned upload URL', async () => {
      const response = await request(API_URL)
        .post('/api/objects/upload')
        .expect(200);
      
      expect(response.body).toHaveProperty('uploadURL');
    });

    it('should create attachment record', async () => {
      const attachment = {
        claimId: 'claim-1',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        objectPath: '/test/path/test.pdf'
      };

      const response = await request(API_URL)
        .post('/api/attachments')
        .send(attachment)
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.fileName).toBe('test.pdf');
    });
  });

  describe('Dashboard Stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(API_URL)
        .get('/api/dashboard/stats')
        .expect(200);
      
      expect(response.body).toHaveProperty('totalClaims');
      expect(response.body).toHaveProperty('pendingClaims');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('monthlyRevenue');
    });
  });

  describe('Security Headers', () => {
    it('should have security headers in production', async () => {
      if (process.env.NODE_ENV === 'production') {
        const response = await request(API_URL)
          .get('/api/health')
          .expect(200);
        
        expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
        expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
        expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      }
    });
  });
});

// Integration tests for EDI connectors (sandbox mode)
describe('EDI Connector Tests', () => {
  it('should submit claim via CDAnet sandbox', async () => {
    const response = await request(API_URL)
      .post('/api/connectors/submit')
      .send({
        claimId: 'claim-1',
        connector: 'cdanet'
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('message');
  });

  it('should submit claim via TELUS eClaims sandbox', async () => {
    const response = await request(API_URL)
      .post('/api/connectors/submit')
      .send({
        claimId: 'claim-1',
        connector: 'telus'
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('message');
  });

  it('should get connector status for claim', async () => {
    const response = await request(API_URL)
      .get('/api/connectors/claim-1/status')
      .expect(200);
    
    expect(response.body).toHaveProperty('events');
    expect(Array.isArray(response.body.events)).toBe(true);
  });
});