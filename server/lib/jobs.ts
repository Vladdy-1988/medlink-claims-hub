/**
 * Simple in-memory job queue for EDI connector operations
 * In production, this would use Redis or a dedicated job queue system
 */

interface Job {
  id: string;
  type: 'submit' | 'poll-status';
  claimId: string;
  connector: 'cdanet' | 'eclaims';
  data?: any;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastError?: string;
}

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private running: Set<string> = new Set();

  /**
   * Enqueue a new job
   */
  async enqueue(jobData: {
    type: 'submit' | 'poll-status';
    claimId: string;
    connector: 'cdanet' | 'eclaims';
    data?: any;
    scheduledAt?: Date;
  }): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job = {
      id: jobId,
      type: jobData.type,
      claimId: jobData.claimId,
      connector: jobData.connector,
      data: jobData.data,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      scheduledAt: jobData.scheduledAt || new Date(),
    };

    this.jobs.set(jobId, job);
    
    console.log(`[JobQueue] Enqueued job ${jobId} for claim ${jobData.claimId}`);
    
    // Process immediately if scheduled for now
    if (!jobData.scheduledAt || jobData.scheduledAt <= new Date()) {
      setTimeout(() => this.processJob(jobId), 100);
    }
    
    return jobId;
  }

  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Process a job
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || this.running.has(jobId) || job.status !== 'queued') {
      return;
    }

    if (job.scheduledAt && job.scheduledAt > new Date()) {
      // Reschedule for later
      setTimeout(() => this.processJob(jobId), job.scheduledAt.getTime() - Date.now());
      return;
    }

    this.running.add(jobId);
    job.status = 'running';
    job.attempts++;

    console.log(`[JobQueue] Processing job ${jobId} (attempt ${job.attempts}/${job.maxAttempts})`);

    try {
      // Import connector dynamically to avoid circular dependencies
      const { getConnector } = await import('../connectors/base');
      const { storage } = await import('../index');
      
      // Get the claim
      const claim = await storage.getClaim(job.claimId);
      if (!claim) {
        throw new Error(`Claim ${job.claimId} not found`);
      }

      // Get connector instance
      const connector = await getConnector(job.connector, claim.orgId);
      
      if (job.type === 'submit') {
        // Submit claim
        const result = await connector.submitClaim(claim);
        
        // Update claim with external ID if successful
        if (result.success && result.externalId) {
          await storage.updateClaim(job.claimId, { 
            externalId: result.externalId,
            status: 'submitted' 
          });
        }
        
        job.status = 'succeeded';
        console.log(`[JobQueue] Successfully submitted claim ${job.claimId} via ${job.connector}`);
        
      } else if (job.type === 'poll-status') {
        // Poll claim status
        if (!claim.externalId) {
          throw new Error('Claim has no external ID for status polling');
        }
        
        const result = await connector.pollStatus(claim.externalId);
        
        // Update claim status if changed
        if (result.status && result.status !== claim.status) {
          await storage.updateClaim(job.claimId, { status: result.status });
        }
        
        job.status = 'succeeded';
        console.log(`[JobQueue] Successfully polled status for claim ${job.claimId}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      job.lastError = errorMessage;
      
      console.error(`[JobQueue] Job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}):`, errorMessage);
      
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
        console.error(`[JobQueue] Job ${jobId} failed permanently after ${job.attempts} attempts`);
      } else {
        // Retry with exponential backoff
        job.status = 'queued';
        const delayMs = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s...
        setTimeout(() => this.processJob(jobId), delayMs);
        console.log(`[JobQueue] Retrying job ${jobId} in ${delayMs}ms`);
      }
    } finally {
      this.running.delete(jobId);
    }
  }

  /**
   * Get all jobs (for debugging/monitoring)
   */
  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Clear completed jobs older than specified time
   */
  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    let removed = 0;
    
    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'succeeded' || job.status === 'failed') && job.createdAt < cutoff) {
        this.jobs.delete(jobId);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[JobQueue] Cleaned up ${removed} old jobs`);
    }
    
    return removed;
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

// Cleanup old jobs every hour
setInterval(() => {
  jobQueue.cleanup().catch(console.error);
}, 60 * 60 * 1000);