import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';

export type ItransAutoSubmitPersistedJobState =
  | 'queued'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'failed';

export type ItransAutoSubmitPersistedJob = {
  jobId: string;
  claimId: string;
  orgId: string;
  claimType: 'claim' | 'preauth';
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: number;
  state: ItransAutoSubmitPersistedJobState;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
  lastUpstreamStatus?: number;
  requestId?: string;
  requestIdHash?: string;
};

type ItransAutoSubmitQueueState = {
  version: 1;
  jobs: Record<string, ItransAutoSubmitPersistedJob>;
};

function isValidPersistedJob(value: unknown): value is ItransAutoSubmitPersistedJob {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const job = value as Record<string, unknown>;
  const validState =
    job.state === 'queued' ||
    job.state === 'running' ||
    job.state === 'retrying' ||
    job.state === 'succeeded' ||
    job.state === 'failed';
  const validClaimType = job.claimType === 'claim' || job.claimType === 'preauth';
  return (
    typeof job.jobId === 'string' &&
    typeof job.claimId === 'string' &&
    typeof job.orgId === 'string' &&
    validClaimType &&
    typeof job.attempt === 'number' &&
    typeof job.maxAttempts === 'number' &&
    typeof job.nextAttemptAt === 'number' &&
    validState &&
    typeof job.createdAt === 'number' &&
    typeof job.updatedAt === 'number'
  );
}

export class ItransAutoSubmitQueueStore {
  private state: ItransAutoSubmitQueueState;

  constructor(private readonly filePath: string) {
    this.state = this.loadOrCreate();
  }

  loadJobs(nowMs = Date.now()): Record<string, ItransAutoSubmitPersistedJob> {
    const jobs: Record<string, ItransAutoSubmitPersistedJob> = {};
    let mutated = false;

    for (const [jobId, rawJob] of Object.entries(this.state.jobs)) {
      if (!isValidPersistedJob(rawJob)) {
        mutated = true;
        continue;
      }

      const job: ItransAutoSubmitPersistedJob = { ...rawJob };

      // Recover in-flight jobs after restart by retrying immediately.
      if (job.state === 'running') {
        if (job.attempt >= job.maxAttempts) {
          job.state = 'failed';
          job.lastError = job.lastError || 'Recovered running job exceeded max attempts';
        } else {
          job.state = 'retrying';
          job.nextAttemptAt = nowMs;
        }
        job.updatedAt = nowMs;
        mutated = true;
      }

      if ((job.state === 'queued' || job.state === 'retrying') && job.attempt >= job.maxAttempts) {
        job.state = 'failed';
        job.lastError = job.lastError || 'Recovered queued/retrying job exceeded max attempts';
        job.updatedAt = nowMs;
        mutated = true;
      }

      jobs[jobId] = job;
    }

    if (mutated) {
      this.state.jobs = jobs;
      this.persist();
    }

    return jobs;
  }

  saveJobs(jobs: Record<string, ItransAutoSubmitPersistedJob>): void {
    this.state.jobs = jobs;
    this.persist();
  }

  private loadOrCreate(): ItransAutoSubmitQueueState {
    if (!existsSync(this.filePath)) {
      const initialState: ItransAutoSubmitQueueState = {
        version: 1,
        jobs: {},
      };
      this.ensureDirectory();
      writeFileSync(this.filePath, JSON.stringify(initialState, null, 2), 'utf-8');
      return initialState;
    }

    const raw = readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ItransAutoSubmitQueueState;
    if (
      parsed.version !== 1 ||
      typeof parsed.jobs !== 'object' ||
      parsed.jobs === null
    ) {
      throw new Error(`Invalid iTrans auto-submit queue state file: ${this.filePath}`);
    }

    return parsed;
  }

  private persist(): void {
    this.ensureDirectory();
    const tmpFile = `${this.filePath}.tmp`;
    writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8');
    renameSync(tmpFile, this.filePath);
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
