import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage';

describe('Claims API', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('GET /api/claims', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/claims')
        .expect(401);

      expect(response.body).toEqual({ message: 'Unauthorized' });
    });

    it('should return claims when authenticated', async () => {
      // Mock authentication middleware
      const mockUser = {
        id: 'test-user-id',
        role: 'provider',
        claims: { sub: 'test-user-id' }
      };

      // Skip auth for testing
      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req: any, res, next) => {
        req.user = mockUser;
        req.isAuthenticated = () => true;
        next();
      });
      
      await registerRoutes(authenticatedApp);

      const response = await request(authenticatedApp)
        .get('/api/claims')
        .expect(200);

      expect(Array.isArray(response.body.claims)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });
  });

  describe('POST /api/claims', () => {
    it('should create a new claim when authenticated', async () => {
      const mockUser = {
        id: 'test-user-id',
        role: 'provider',
        claims: { sub: 'test-user-id' }
      };

      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req: any, res, next) => {
        req.user = mockUser;
        req.isAuthenticated = () => true;
        next();
      });
      
      await registerRoutes(authenticatedApp);

      const claimData = {
        patientFirstName: 'John',
        patientLastName: 'Doe',
        patientDateOfBirth: '1990-01-01',
        serviceDate: new Date().toISOString(),
        diagnosisCode: 'Z00.00',
        procedureCode: '99213',
        totalAmount: 150.00,
        providerName: 'Dr. Smith',
      };

      const response = await request(authenticatedApp)
        .post('/api/claims')
        .send(claimData)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.patientFirstName).toBe(claimData.patientFirstName);
      expect(response.body.status).toBe('draft');
    });

    it('should validate required fields', async () => {
      const mockUser = {
        id: 'test-user-id',
        role: 'provider',
        claims: { sub: 'test-user-id' }
      };

      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req: any, res, next) => {
        req.user = mockUser;
        req.isAuthenticated = () => true;
        next();
      });
      
      await registerRoutes(authenticatedApp);

      const invalidClaimData = {
        patientFirstName: 'John',
        // Missing required fields
      };

      const response = await request(authenticatedApp)
        .post('/api/claims')
        .send(invalidClaimData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/claims/:id', () => {
    it('should return a specific claim when authenticated', async () => {
      const mockUser = {
        id: 'test-user-id',
        role: 'provider',
        claims: { sub: 'test-user-id' }
      };

      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req: any, res, next) => {
        req.user = mockUser;
        req.isAuthenticated = () => true;
        next();
      });
      
      await registerRoutes(authenticatedApp);

      // First create a claim
      const claimData = {
        patientFirstName: 'Jane',
        patientLastName: 'Smith',
        patientDateOfBirth: '1985-05-15',
        serviceDate: new Date().toISOString(),
        diagnosisCode: 'M25.9',
        procedureCode: '99214',
        totalAmount: 200.00,
        providerName: 'Dr. Johnson',
      };

      const createResponse = await request(authenticatedApp)
        .post('/api/claims')
        .send(claimData)
        .expect(201);

      const claimId = createResponse.body.id;

      // Then retrieve it
      const response = await request(authenticatedApp)
        .get(`/api/claims/${claimId}`)
        .expect(200);

      expect(response.body.id).toBe(claimId);
      expect(response.body.patientFirstName).toBe(claimData.patientFirstName);
    });

    it('should return 404 for non-existent claim', async () => {
      const mockUser = {
        id: 'test-user-id',
        role: 'provider',
        claims: { sub: 'test-user-id' }
      };

      const authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req: any, res, next) => {
        req.user = mockUser;
        req.isAuthenticated = () => true;
        next();
      });
      
      await registerRoutes(authenticatedApp);

      const response = await request(authenticatedApp)
        .get('/api/claims/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Claim not found');
    });
  });
});