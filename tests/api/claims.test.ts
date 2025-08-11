import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('Claims API', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = {
        claims: {
          sub: 'test-user-id'
        }
      };
      req.isAuthenticated = () => true;
      next();
    });

    server = await registerRoutes(app);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('GET /api/claims', () => {
    it('returns claims list', async () => {
      const response = await request(app)
        .get('/api/claims')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('claimNumber');
        expect(response.body[0]).toHaveProperty('status');
      }
    });

    it('supports filtering by status', async () => {
      const response = await request(app)
        .get('/api/claims?status=submitted')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        response.body.forEach((claim: any) => {
          expect(claim.status).toBe('submitted');
        });
      }
    });

    it('supports pagination', async () => {
      const response = await request(app)
        .get('/api/claims?page=1&limit=5')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/claims', () => {
    const validClaimData = {
      type: 'claim',
      patient: {
        name: 'John Doe',
        dateOfBirth: '1990-01-01',
        healthNumber: '1234567890'
      },
      insurer: {
        name: 'Health Insurance Co',
        planNumber: 'ABC123'
      },
      services: [
        {
          procedureCode: '01202',
          description: 'Comprehensive Oral Examination',
          amount: '150.00',
          date: '2024-01-01'
        }
      ]
    };

    it('creates a new claim with valid data', async () => {
      const response = await request(app)
        .post('/api/claims')
        .send(validClaimData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('claimNumber');
      expect(response.body.status).toBe('draft');
    });

    it('validates required fields', async () => {
      const invalidData = {
        type: 'claim'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/claims')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('validates patient data', async () => {
      const invalidPatientData = {
        ...validClaimData,
        patient: {
          name: '', // Empty name
          dateOfBirth: 'invalid-date',
          healthNumber: '123' // Too short
        }
      };

      const response = await request(app)
        .post('/api/claims')
        .send(invalidPatientData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('validates service data', async () => {
      const invalidServiceData = {
        ...validClaimData,
        services: [
          {
            procedureCode: '', // Empty code
            description: 'Test',
            amount: 'invalid-amount',
            date: 'invalid-date'
          }
        ]
      };

      const response = await request(app)
        .post('/api/claims')
        .send(invalidServiceData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/claims/:id', () => {
    it('returns claim details for valid ID', async () => {
      // First create a claim
      const createResponse = await request(app)
        .post('/api/claims')
        .send({
          type: 'claim',
          patient: {
            name: 'Test Patient',
            dateOfBirth: '1990-01-01',
            healthNumber: '1234567890'
          },
          insurer: {
            name: 'Test Insurer',
            planNumber: 'TEST123'
          },
          services: [
            {
              procedureCode: '01202',
              description: 'Test Service',
              amount: '100.00',
              date: '2024-01-01'
            }
          ]
        });

      const claimId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/claims/${claimId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', claimId);
      expect(response.body).toHaveProperty('patient');
      expect(response.body).toHaveProperty('insurer');
      expect(response.body).toHaveProperty('services');
    });

    it('returns 404 for non-existent claim', async () => {
      const response = await request(app)
        .get('/api/claims/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/claims/:id', () => {
    it('updates claim with valid data', async () => {
      // First create a claim
      const createResponse = await request(app)
        .post('/api/claims')
        .send({
          type: 'claim',
          patient: {
            name: 'Original Patient',
            dateOfBirth: '1990-01-01',
            healthNumber: '1234567890'
          },
          insurer: {
            name: 'Original Insurer',
            planNumber: 'ORIG123'
          },
          services: [
            {
              procedureCode: '01202',
              description: 'Original Service',
              amount: '100.00',
              date: '2024-01-01'
            }
          ]
        });

      const claimId = createResponse.body.id;

      const updateData = {
        patient: {
          name: 'Updated Patient',
          dateOfBirth: '1990-01-01',
          healthNumber: '1234567890'
        },
        services: [
          {
            procedureCode: '01203',
            description: 'Updated Service',
            amount: '150.00',
            date: '2024-01-02'
          }
        ]
      };

      const response = await request(app)
        .put(`/api/claims/${claimId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.patient.name).toBe('Updated Patient');
      expect(response.body.services[0].description).toBe('Updated Service');
    });

    it('returns 404 for non-existent claim', async () => {
      const response = await request(app)
        .put('/api/claims/non-existent-id')
        .send({
          patient: { name: 'Test' }
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/claims/:id', () => {
    it('deletes claim successfully', async () => {
      // First create a claim
      const createResponse = await request(app)
        .post('/api/claims')
        .send({
          type: 'claim',
          patient: {
            name: 'To Delete',
            dateOfBirth: '1990-01-01',
            healthNumber: '1234567890'
          },
          insurer: {
            name: 'Test Insurer',
            planNumber: 'DEL123'
          },
          services: [
            {
              procedureCode: '01202',
              description: 'To Delete',
              amount: '100.00',
              date: '2024-01-01'
            }
          ]
        });

      const claimId = createResponse.body.id;

      await request(app)
        .delete(`/api/claims/${claimId}`)
        .expect(200);

      // Verify claim is deleted
      await request(app)
        .get(`/api/claims/${claimId}`)
        .expect(404);
    });

    it('returns 404 for non-existent claim', async () => {
      const response = await request(app)
        .delete('/api/claims/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/claims/:id/submit', () => {
    it('submits claim to insurer', async () => {
      // First create a claim
      const createResponse = await request(app)
        .post('/api/claims')
        .send({
          type: 'claim',
          patient: {
            name: 'Submit Test',
            dateOfBirth: '1990-01-01',
            healthNumber: '1234567890'
          },
          insurer: {
            name: 'Health Insurance Co',
            planNumber: 'SUB123'
          },
          services: [
            {
              procedureCode: '01202',
              description: 'Submit Test',
              amount: '100.00',
              date: '2024-01-01'
            }
          ]
        });

      const claimId = createResponse.body.id;

      const response = await request(app)
        .post(`/api/claims/${claimId}/submit`)
        .send({ method: 'portal' })
        .expect(200);

      expect(response.body.status).toBe('submitted');
      expect(response.body).toHaveProperty('submissionId');
    });

    it('validates submission method', async () => {
      const createResponse = await request(app)
        .post('/api/claims')
        .send({
          type: 'claim',
          patient: {
            name: 'Method Test',
            dateOfBirth: '1990-01-01',
            healthNumber: '1234567890'
          },
          insurer: {
            name: 'Test Insurer',
            planNumber: 'MET123'
          },
          services: []
        });

      const claimId = createResponse.body.id;

      const response = await request(app)
        .post(`/api/claims/${claimId}/submit`)
        .send({ method: 'invalid-method' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});