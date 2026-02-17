import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';

const webhookSecret = 'itrans-webhook-signing-secret-for-tests-1234567890';
const cleanupTargets: string[] = [];

function createTempStateFilePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'itrans-webhook-state-'));
  cleanupTargets.push(dir);
  return path.join(dir, 'state.json');
}

function buildWebhookPayload(eventId: string, requestIdHash: string) {
  return {
    eventId,
    eventType: 'REQUEST_ADJUDICATED',
    chainId: 31337,
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    blockNumber: 12,
    blockHash: '0xblockhash',
    txHash: '0xtxhash',
    logIndex: 0,
    requestIdHash,
    occurredAt: Date.now(),
    data: {
      decision: 'APPROVED',
      insurer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    },
  };
}

function computeRelaySignature(timestampMs: number, bodyRaw: string): string {
  return crypto.createHmac('sha256', webhookSecret).update(`${timestampMs}.${bodyRaw}`).digest('hex');
}

async function createWebhookApp(captureRawBody: boolean, stateFilePath: string) {
  vi.resetModules();
  vi.doMock('../../server/ai-assistant', () => ({
    aiAssistant: {
      analyzeDocument: vi.fn(),
      suggestICD10Codes: vi.fn(),
      validateClaim: vi.fn(),
      autoCompleteClaim: vi.fn(),
      submitFeedback: vi.fn(),
      getStats: vi.fn(),
    },
  }));
  process.env.NODE_ENV = 'development';
  process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
  process.env.ITRANS_WEBHOOK_SIGNING_SECRET = webhookSecret;
  process.env.ITRANS_WEBHOOK_STATE_FILE = stateFilePath;

  const app = express();
  if (captureRawBody) {
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf-8');
        },
      })
    );
  } else {
    app.use(express.json());
  }

  const { storage } = await import('../../server/storage');
  const { registerRoutes } = await import('../../server/routes');
  await registerRoutes(app);
  return { app, storage };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (cleanupTargets.length > 0) {
    const target = cleanupTargets.pop();
    if (target) {
      rmSync(target, { recursive: true, force: true });
    }
  }
});

describe('iTrans workflow webhook handler', () => {
  it('returns 500 when raw request body is unavailable', async () => {
    const stateFilePath = createTempStateFilePath();
    const { app } = await createWebhookApp(false, stateFilePath);

    const payload = buildWebhookPayload('evt-raw-missing', 'request-hash-raw-missing');
    const rawBody = JSON.stringify(payload);
    const timestampMs = Date.now();
    const signature = computeRelaySignature(timestampMs, rawBody);

    const response = await request(app)
      .post('/api/itrans/webhooks/workflow')
      .set('content-type', 'application/json')
      .set('idempotency-key', payload.eventId)
      .set('x-itrans-relay-timestamp', String(timestampMs))
      .set('x-itrans-relay-signature', `hmac-sha256=${signature}`)
      .send(payload)
      .expect(500);

    expect(response.body.message).toContain('Webhook raw body unavailable');
  });

  it('returns 404 for unresolved claim and does not treat retries as duplicates', async () => {
    const stateFilePath = createTempStateFilePath();
    const { app, storage } = await createWebhookApp(true, stateFilePath);

    const byReferenceSpy = vi.spyOn(storage, 'getClaimByReferenceNumber').mockResolvedValue(undefined);
    const byExternalSpy = vi.spyOn(storage, 'getClaimByExternalId').mockResolvedValue(undefined);
    const auditSpy = vi.spyOn(storage, 'createAuditEvent').mockResolvedValue({} as any);

    const payload = buildWebhookPayload('evt-unresolved-claim', 'request-hash-unresolved');
    const rawBody = JSON.stringify(payload);
    const timestampMs = Date.now();
    const signature = computeRelaySignature(timestampMs, rawBody);

    const sendWebhook = () =>
      request(app)
        .post('/api/itrans/webhooks/workflow')
        .set('content-type', 'application/json')
        .set('idempotency-key', payload.eventId)
        .set('x-itrans-relay-timestamp', String(timestampMs))
        .set('x-itrans-relay-signature', `hmac-sha256=${signature}`)
        .send(payload);

    const first = await sendWebhook();
    expect(first.status).toBe(404);
    expect(first.body.retryable).toBe(true);

    const second = await sendWebhook();
    expect(second.status).toBe(404);
    expect(second.body.retryable).toBe(true);

    expect(byReferenceSpy).toHaveBeenCalledTimes(2);
    expect(byExternalSpy).toHaveBeenCalledTimes(2);
    expect(auditSpy).not.toHaveBeenCalled();
  });
});
