import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, afterEach } from 'vitest';
import { ItransAutoSubmitQueueStore } from '../../server/integrations/itransAutoSubmitQueueStore';

type CleanupTarget = string;

const cleanupTargets: CleanupTarget[] = [];

function createTempStateFilePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'itrans-auto-submit-store-'));
  cleanupTargets.push(dir);
  return path.join(dir, 'state.json');
}

afterEach(() => {
  while (cleanupTargets.length > 0) {
    const target = cleanupTargets.pop();
    if (target) {
      rmSync(target, { recursive: true, force: true });
    }
  }
});

describe('ItransAutoSubmitQueueStore', () => {
  it('persists jobs and reloads them from disk', () => {
    const stateFile = createTempStateFilePath();
    const now = Date.now();
    const store = new ItransAutoSubmitQueueStore(stateFile);

    store.saveJobs({
      job1: {
        jobId: 'job1',
        claimId: 'claim1',
        orgId: 'org1',
        claimType: 'claim',
        attempt: 1,
        maxAttempts: 4,
        nextAttemptAt: now,
        state: 'queued',
        createdAt: now,
        updatedAt: now,
      },
    });

    const reloaded = new ItransAutoSubmitQueueStore(stateFile).loadJobs(now + 1);
    expect(Object.keys(reloaded)).toEqual(['job1']);
    expect(reloaded.job1.claimId).toBe('claim1');
    expect(reloaded.job1.state).toBe('queued');
  });

  it('recovers running jobs to retrying on load', () => {
    const stateFile = createTempStateFilePath();
    const now = Date.now();
    const store = new ItransAutoSubmitQueueStore(stateFile);

    store.saveJobs({
      job2: {
        jobId: 'job2',
        claimId: 'claim2',
        orgId: 'org2',
        claimType: 'preauth',
        attempt: 2,
        maxAttempts: 4,
        nextAttemptAt: now - 10_000,
        state: 'running',
        createdAt: now - 20_000,
        updatedAt: now - 10_000,
      },
    });

    const reloaded = new ItransAutoSubmitQueueStore(stateFile).loadJobs(now + 1000);
    expect(reloaded.job2.state).toBe('retrying');
    expect(reloaded.job2.nextAttemptAt).toBe(now + 1000);
  });

  it('recovers exhausted running jobs to failed on load', () => {
    const stateFile = createTempStateFilePath();
    const now = Date.now();
    const store = new ItransAutoSubmitQueueStore(stateFile);

    store.saveJobs({
      job3: {
        jobId: 'job3',
        claimId: 'claim3',
        orgId: 'org3',
        claimType: 'claim',
        attempt: 4,
        maxAttempts: 4,
        nextAttemptAt: now - 10_000,
        state: 'running',
        createdAt: now - 20_000,
        updatedAt: now - 10_000,
      },
    });

    const reloaded = new ItransAutoSubmitQueueStore(stateFile).loadJobs(now + 1000);
    expect(reloaded.job3.state).toBe('failed');
  });
});
