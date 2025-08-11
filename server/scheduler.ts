import { telusEClaimsService } from './integrations/telusEclaims';
import { cdanetService } from './integrations/cdanet';
import { portalService } from './integrations/portal';
import { storage } from './storage';
import { auditLogger } from './auditLogger';

/**
 * In-Process Scheduler for Claims Status Polling
 * 
 * This scheduler runs within the main application process and handles
 * periodic polling of claim statuses from various insurance systems.
 * 
 * In production, this should be replaced with a proper job queue system
 * like Bull, Agenda, or moved to a separate worker process.
 */

export interface ScheduledJob {
  id: string;
  type: 'poll_status' | 'retry_submission';
  claimId: string;
  submissionId: string;
  rail: 'telusEclaims' | 'cdanet' | 'portal';
  nextRunAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
}

export class ClaimsScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private pollIntervalMs: number = 5 * 60 * 1000) { // 5 minutes default
    console.log('[Scheduler] Claims scheduler initialized');
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting claims status polling');
    this.isRunning = true;
    
    // Run immediately on start
    this.processPendingJobs();
    
    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.processPendingJobs();
    }, this.pollIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[Scheduler] Stopping claims status polling');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Schedule a claim for status polling
   */
  scheduleStatusPoll(claimId: string, submissionId: string, rail: 'telusEclaims' | 'cdanet' | 'portal'): void {
    const jobId = `poll_${submissionId}`;
    const nextRunAt = new Date(Date.now() + this.pollIntervalMs);

    const job: ScheduledJob = {
      id: jobId,
      type: 'poll_status',
      claimId,
      submissionId,
      rail,
      nextRunAt,
      attempts: 0,
      maxAttempts: 10, // Stop polling after 10 attempts (about 50 minutes)
    };

    this.jobs.set(jobId, job);
    console.log(`[Scheduler] Scheduled status polling for ${submissionId} (${rail}) at ${nextRunAt.toISOString()}`);
  }

  /**
   * Process all pending jobs
   */
  private async processPendingJobs(): Promise<void> {
    const now = new Date();
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.nextRunAt <= now);

    if (pendingJobs.length === 0) {
      return;
    }

    console.log(`[Scheduler] Processing ${pendingJobs.length} pending jobs`);

    for (const job of pendingJobs) {
      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`[Scheduler] Error processing job ${job.id}:`, error);
        this.handleJobError(job, error as Error);
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: ScheduledJob): Promise<void> {
    console.log(`[Scheduler] Processing job ${job.id} (attempt ${job.attempts + 1})`);

    job.attempts++;

    try {
      if (job.type === 'poll_status') {
        await this.pollClaimStatus(job);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Poll status for a specific claim
   */
  private async pollClaimStatus(job: ScheduledJob): Promise<void> {
    let statusResponse: any;
    let shouldContinuePolling = true;

    // Poll the appropriate service based on rail
    switch (job.rail) {
      case 'telusEclaims':
        statusResponse = await telusEClaimsService.pollStatus(job.submissionId);
        shouldContinuePolling = !['paid', 'rejected', 'error'].includes(statusResponse.status);
        break;

      case 'cdanet':
        statusResponse = await cdanetService.pollStatus(job.submissionId);
        shouldContinuePolling = !['paid', 'rejected', 'error'].includes(statusResponse.status);
        break;

      case 'portal':
        statusResponse = await portalService.pollStatus(job.submissionId);
        shouldContinuePolling = !['paid', 'rejected'].includes(statusResponse.status);
        break;

      default:
        throw new Error(`Unknown rail: ${job.rail}`);
    }

    // Update claim status in database
    await this.updateClaimStatus(job.claimId, statusResponse, job.rail);

    // Log the status check
    await auditLogger.log({
      orgId: '', // Will be filled by the audit logger
      actorUserId: 'system',
      type: 'claim_status_polled',
      details: {
        claimId: job.claimId,
        submissionId: job.submissionId,
        rail: job.rail,
        status: statusResponse.status,
        attempt: job.attempts,
      },
      ip: '127.0.0.1',
      userAgent: 'Claims Scheduler',
    });

    if (shouldContinuePolling && job.attempts < job.maxAttempts) {
      // Reschedule for next poll
      job.nextRunAt = new Date(Date.now() + this.pollIntervalMs);
      console.log(`[Scheduler] Rescheduled ${job.id} for ${job.nextRunAt.toISOString()}`);
    } else {
      // Remove completed or failed job
      this.jobs.delete(job.id);
      const reason = shouldContinuePolling ? 'max attempts reached' : 'final status received';
      console.log(`[Scheduler] Removed job ${job.id} - ${reason}`);
    }
  }

  /**
   * Update claim status in database based on polling response
   */
  private async updateClaimStatus(claimId: string, statusResponse: any, rail: string): Promise<void> {
    try {
      // Map external status to internal status
      let internalStatus = 'submitted';
      
      switch (statusResponse.status) {
        case 'processing':
          internalStatus = 'submitted';
          break;
        case 'approved':
          internalStatus = 'approved';
          break;
        case 'paid':
          internalStatus = 'paid';
          break;
        case 'rejected':
        case 'denied':
          internalStatus = 'denied';
          break;
        case 'error':
          internalStatus = 'error';
          break;
      }

      // Update claim status
      await storage.updateClaimStatus(claimId, internalStatus);

      // Create remittance record if payment information is available
      if (statusResponse.amountPaid || statusResponse.payableAmount) {
        const amount = statusResponse.amountPaid || statusResponse.payableAmount;
        await storage.createRemittance({
          insurerId: '', // Will be filled from claim
          claimId,
          status: statusResponse.status,
          amountPaid: amount.toString(),
          raw: statusResponse,
        });
      }

      console.log(`[Scheduler] Updated claim ${claimId} status to ${internalStatus}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to update claim ${claimId} status:`, error);
      throw error;
    }
  }

  /**
   * Handle job processing errors
   */
  private handleJobError(job: ScheduledJob, error: Error): void {
    job.lastError = error.message;

    if (job.attempts < job.maxAttempts) {
      // Exponential backoff: 2^attempts * base interval (capped at 1 hour)
      const backoffMs = Math.min(
        Math.pow(2, job.attempts) * this.pollIntervalMs,
        60 * 60 * 1000 // 1 hour max
      );
      job.nextRunAt = new Date(Date.now() + backoffMs);
      console.log(`[Scheduler] Job ${job.id} failed, retrying in ${backoffMs}ms (attempt ${job.attempts})`);
    } else {
      // Remove failed job after max attempts
      this.jobs.delete(job.id);
      console.error(`[Scheduler] Job ${job.id} failed permanently after ${job.attempts} attempts: ${error.message}`);
    }
  }

  /**
   * Get current job statistics
   */
  getStats(): {
    totalJobs: number;
    pendingJobs: number;
    runningJobs: number;
    failedJobs: number;
  } {
    const now = new Date();
    const jobs = Array.from(this.jobs.values());

    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(job => job.nextRunAt <= now).length,
      runningJobs: jobs.filter(job => job.attempts > 0 && job.nextRunAt > now).length,
      failedJobs: jobs.filter(job => job.lastError).length,
    };
  }

  /**
   * Get all scheduled jobs (for debugging)
   */
  getJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear all jobs (for testing)
   */
  clearJobs(): void {
    this.jobs.clear();
    console.log('[Scheduler] All jobs cleared');
  }
}

// Export singleton instance
export const claimsScheduler = new ClaimsScheduler();

// Auto-start scheduler when module loads
if (process.env.NODE_ENV !== 'test') {
  claimsScheduler.start();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Scheduler] Received SIGTERM, stopping scheduler...');
    claimsScheduler.stop();
  });
  
  process.on('SIGINT', () => {
    console.log('[Scheduler] Received SIGINT, stopping scheduler...');
    claimsScheduler.stop();
  });
}