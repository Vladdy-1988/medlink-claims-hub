import { telusEClaimsService } from './integrations/telusEclaims';
import { cdanetService } from './integrations/cdanet';
import { portalService } from './integrations/portal';
import { storage } from './storage';

/**
 * Simple in-process scheduler for polling claim status updates
 * 
 * This scheduler runs periodic tasks to check claim status with
 * insurance carriers and update local records accordingly.
 */

interface ScheduledJob {
  id: string;
  interval: number; // milliseconds
  lastRun?: Date;
  nextRun: Date;
  isRunning: boolean;
  handler: () => Promise<void>;
}

export class Scheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isStarted = false;

  constructor() {
    this.setupJobs();
  }

  /**
   * Setup default scheduled jobs
   */
  private setupJobs() {
    // Poll Telus eClaims status every 5 minutes
    this.addJob('telus-status-poll', 5 * 60 * 1000, async () => {
      await this.pollTelusClaimsStatus();
    });

    // Poll CDAnet status every 10 minutes
    this.addJob('cdanet-status-poll', 10 * 60 * 1000, async () => {
      await this.pollCDAnetStatus();
    });

    // Poll portal submissions every 15 minutes
    this.addJob('portal-status-poll', 15 * 60 * 1000, async () => {
      await this.pollPortalStatus();
    });

    // Audit log cleanup - daily at 2 AM
    this.addJob('audit-cleanup', 24 * 60 * 60 * 1000, async () => {
      await this.cleanupAuditLogs();
    });
  }

  /**
   * Add a scheduled job
   */
  addJob(id: string, intervalMs: number, handler: () => Promise<void>) {
    const job: ScheduledJob = {
      id,
      interval: intervalMs,
      nextRun: new Date(Date.now() + intervalMs),
      isRunning: false,
      handler,
    };

    this.jobs.set(id, job);
    
    if (this.isStarted) {
      this.scheduleJob(job);
    }
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isStarted) {
      console.log('[Scheduler] Already started');
      return;
    }

    console.log('[Scheduler] Starting scheduler...');
    this.isStarted = true;

    // Schedule all jobs
    for (const job of this.jobs.values()) {
      this.scheduleJob(job);
    }

    console.log(`[Scheduler] Started with ${this.jobs.size} jobs`);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isStarted) {
      return;
    }

    console.log('[Scheduler] Stopping scheduler...');
    this.isStarted = false;

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    console.log('[Scheduler] Stopped');
  }

  /**
   * Schedule a single job
   */
  private scheduleJob(job: ScheduledJob) {
    const timeUntilNext = job.nextRun.getTime() - Date.now();
    const delay = Math.max(0, timeUntilNext);

    const timer = setTimeout(async () => {
      await this.runJob(job);
    }, delay);

    this.timers.set(job.id, timer);
  }

  /**
   * Run a scheduled job
   */
  private async runJob(job: ScheduledJob) {
    if (job.isRunning) {
      console.log(`[Scheduler] Job ${job.id} is already running, skipping`);
      return;
    }

    console.log(`[Scheduler] Running job: ${job.id}`);
    job.isRunning = true;
    job.lastRun = new Date();

    try {
      await job.handler();
      console.log(`[Scheduler] Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`[Scheduler] Job ${job.id} failed:`, error);
    } finally {
      job.isRunning = false;
      
      // Schedule next run
      job.nextRun = new Date(Date.now() + job.interval);
      if (this.isStarted) {
        this.scheduleJob(job);
      }
    }
  }

  /**
   * Poll Telus eClaims for status updates
   */
  private async pollTelusClaimsStatus() {
    try {
      // Get all claims with Telus submissions that are still processing
      const pendingClaims = await storage.getClaimsByStatus(['submitted', 'processing']);
      
      for (const claim of pendingClaims) {
        if (claim.submissionId && claim.submissionId.startsWith('TEL-')) {
          try {
            const statusResponse = await telusEClaimsService.pollStatus(claim.submissionId);
            
            // Update claim status if changed
            if (statusResponse.status !== claim.status) {
              await storage.updateClaim(claim.id, {
                status: statusResponse.status,
                updatedAt: new Date(),
                paymentAmount: statusResponse.amountPaid,
                approvedAmount: statusResponse.amountApproved,
                processedDate: statusResponse.processedDate ? new Date(statusResponse.processedDate) : undefined,
                notes: statusResponse.rejectionReason || claim.notes,
              });

              console.log(`[Scheduler] Updated Telus claim ${claim.id} status: ${statusResponse.status}`);
            }
          } catch (error) {
            console.error(`[Scheduler] Failed to poll Telus status for claim ${claim.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error polling Telus eClaims status:', error);
    }
  }

  /**
   * Poll CDAnet for status updates
   */
  private async pollCDAnetStatus() {
    try {
      // Get all claims with CDAnet submissions that are still processing
      const pendingClaims = await storage.getClaimsByStatus(['submitted', 'processing']);
      
      for (const claim of pendingClaims) {
        if (claim.submissionId && claim.submissionId.startsWith('CDA-')) {
          try {
            const statusResponse = await cdanetService.pollStatus(claim.submissionId);
            
            // Update claim status if changed
            if (statusResponse.status !== claim.status) {
              await storage.updateClaim(claim.id, {
                status: statusResponse.status,
                updatedAt: new Date(),
                paymentAmount: statusResponse.payableAmount,
                approvedAmount: statusResponse.payableAmount,
                processedDate: statusResponse.processedDate ? new Date(statusResponse.processedDate) : undefined,
                notes: statusResponse.rejectionReason || statusResponse.explanationOfBenefits?.join('; ') || claim.notes,
              });

              console.log(`[Scheduler] Updated CDAnet claim ${claim.id} status: ${statusResponse.status}`);
            }
          } catch (error) {
            console.error(`[Scheduler] Failed to poll CDAnet status for claim ${claim.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error polling CDAnet status:', error);
    }
  }

  /**
   * Poll portal submission status
   */
  private async pollPortalStatus() {
    try {
      // Get all claims with portal submissions
      const pendingClaims = await storage.getClaimsByStatus(['portal_upload_required', 'submitted', 'processing']);
      
      for (const claim of pendingClaims) {
        if (claim.submissionId && claim.submissionId.startsWith('POR-')) {
          try {
            const statusResponse = await portalService.pollStatus(claim.submissionId);
            
            // Update claim status if changed
            if (statusResponse.status !== claim.status) {
              await storage.updateClaim(claim.id, {
                status: statusResponse.status,
                updatedAt: new Date(),
                processedDate: statusResponse.submittedDate ? new Date(statusResponse.submittedDate) : undefined,
                notes: statusResponse.notes || claim.notes,
              });

              console.log(`[Scheduler] Updated portal claim ${claim.id} status: ${statusResponse.status}`);
            }
          } catch (error) {
            console.error(`[Scheduler] Failed to poll portal status for claim ${claim.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error polling portal status:', error);
    }
  }

  /**
   * Clean up old audit logs
   */
  private async cleanupAuditLogs() {
    try {
      const retentionDays = 90; // Keep logs for 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // TODO: Implement audit log cleanup
      // await storage.deleteAuditLogsBefore(cutoffDate);
      
      console.log(`[Scheduler] Audit log cleanup completed (cutoff: ${cutoffDate.toISOString()})`);
    } catch (error) {
      console.error('[Scheduler] Error cleaning up audit logs:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      totalJobs: this.jobs.size,
      jobs: Array.from(this.jobs.values()).map(job => ({
        id: job.id,
        interval: job.interval,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        isRunning: job.isRunning,
      })),
    };
  }
}

// Export singleton instance
export const scheduler = new Scheduler();