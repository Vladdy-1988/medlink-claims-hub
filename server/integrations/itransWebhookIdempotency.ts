import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';

interface ItransWebhookIdempotencyState {
  version: 1;
  processed: Record<string, number>;
}

export class ItransWebhookIdempotencyStore {
  private state: ItransWebhookIdempotencyState;

  constructor(private readonly filePath: string) {
    this.state = this.loadOrCreate();
  }

  has(eventId: string): boolean {
    return Boolean(this.state.processed[eventId]);
  }

  markProcessed(eventId: string, timestampMs = Date.now()): void {
    this.state.processed[eventId] = timestampMs;
  }

  prune(retentionMs: number, nowMs = Date.now()): void {
    const threshold = nowMs - retentionMs;
    for (const [eventId, processedAt] of Object.entries(this.state.processed)) {
      if (processedAt < threshold) {
        delete this.state.processed[eventId];
      }
    }
  }

  persist(): void {
    this.ensureDirectory();
    const tmpFile = `${this.filePath}.tmp`;
    writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8');
    renameSync(tmpFile, this.filePath);
  }

  private loadOrCreate(): ItransWebhookIdempotencyState {
    if (!existsSync(this.filePath)) {
      const initialState: ItransWebhookIdempotencyState = {
        version: 1,
        processed: {},
      };
      this.ensureDirectory();
      writeFileSync(this.filePath, JSON.stringify(initialState, null, 2), 'utf-8');
      return initialState;
    }

    const raw = readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ItransWebhookIdempotencyState;

    if (parsed.version !== 1 || typeof parsed.processed !== 'object' || parsed.processed === null) {
      throw new Error(`Invalid iTrans webhook idempotency state file: ${this.filePath}`);
    }

    return parsed;
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

