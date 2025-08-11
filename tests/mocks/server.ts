import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Mock API responses for testing
export const handlers = [
  // Auth endpoints
  rest.get('/api/auth/user', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'provider',
        profileImageUrl: null,
      })
    );
  }),

  // Claims endpoints
  rest.get('/api/claims', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'claim-1',
          claimNumber: 'CLM-001',
          type: 'claim',
          status: 'submitted',
          amount: '150.00',
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
          patient: {
            id: 'patient-1',
            name: 'John Doe',
            dateOfBirth: '1990-01-01',
            healthNumber: '1234567890',
          },
          insurer: {
            id: 'insurer-1',
            name: 'Health Insurance Co',
            planNumber: 'ABC123',
          },
          services: [
            {
              id: 'service-1',
              procedureCode: '01202',
              description: 'Comprehensive Oral Examination',
              amount: '150.00',
              date: '2024-01-01',
              tooth: null,
              surface: null,
            },
          ],
          attachments: [],
        },
      ])
    );
  }),

  rest.post('/api/claims', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-claim-id',
        claimNumber: 'CLM-002',
        status: 'draft',
      })
    );
  }),

  rest.get('/api/claims/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        id,
        claimNumber: 'CLM-001',
        type: 'claim',
        status: 'submitted',
        amount: '150.00',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
        patient: {
          id: 'patient-1',
          name: 'John Doe',
          dateOfBirth: '1990-01-01',
          healthNumber: '1234567890',
        },
        insurer: {
          id: 'insurer-1',
          name: 'Health Insurance Co',
          planNumber: 'ABC123',
        },
        services: [
          {
            id: 'service-1',
            procedureCode: '01202',
            description: 'Comprehensive Oral Examination',
            amount: '150.00',
            date: '2024-01-01',
            tooth: null,
            surface: null,
          },
        ],
        attachments: [],
      })
    );
  }),

  // Pre-auth endpoints
  rest.get('/api/preauths', (req, res, ctx) => {
    return res(ctx.json([]));
  }),

  rest.post('/api/preauths', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'new-preauth-id',
        claimNumber: 'PRE-001',
        status: 'draft',
      })
    );
  }),

  // Dashboard stats
  rest.get('/api/dashboard/stats', (req, res, ctx) => {
    return res(
      ctx.json({
        totalClaims: 25,
        pendingClaims: 8,
        successRate: 85.5,
        monthlyRevenue: 12750,
      })
    );
  }),

  // Insurers
  rest.get('/api/insurers', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'insurer-1',
          name: 'Health Insurance Co',
          type: 'private',
          supportedMethods: ['portal', 'telus'],
        },
        {
          id: 'insurer-2',
          name: 'Provincial Health',
          type: 'government',
          supportedMethods: ['cdanet'],
        },
      ])
    );
  }),

  // File upload
  rest.post('/api/attachments/upload', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'attachment-1',
        url: '/uploads/test-file.pdf',
        filename: 'test-file.pdf',
        size: 1024,
        contentType: 'application/pdf',
      })
    );
  }),

  // Error case handlers
  rest.get('/api/error-test', (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
  }),

  rest.get('/api/unauthorized-test', (req, res, ctx) => {
    return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
  }),
];

export const server = setupServer(...handlers);