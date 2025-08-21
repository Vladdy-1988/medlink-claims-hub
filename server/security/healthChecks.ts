import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { claims } from '@shared/schema';

// Basic health check (no auth required)
export async function healthCheck(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'medlink-claims-hub',
    version: process.env.npm_package_version || '1.0.0',
  });
}

// Readiness check (checks DB connection)
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
  };
  
  try {
    // Test database connection
    const result = await db.execute(sql`SELECT 1 as test`);
    checks.database = result.rows.length > 0;
    
    // Overall status
    const isReady = checks.database;
    
    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      checks,
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'error',
      checks,
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Health check failed',
    });
  }
}

// Metrics endpoint (Prometheus format)
export async function metricsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    // Get job queue metrics
    const { jobQueue } = await import('../lib/jobs');
    const stats = await jobQueue.getStats();
    
    // Get claim counts from database
    const totalClaims = await db.select({ count: sql<number>`count(*)` }).from(claims);
    const pendingClaims = await db.select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(sql`status = 'pending'`);
    const submittedClaims = await db.select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(sql`status = 'submitted'`);
    const paidClaims = await db.select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(sql`status = 'paid'`);
    const deniedClaims = await db.select({ count: sql<number>`count(*)` })
      .from(claims)
      .where(sql`status = 'denied'`);
    
    // Format as Prometheus metrics
    const metrics = [
      '# HELP medlink_jobs_queued Number of queued jobs',
      '# TYPE medlink_jobs_queued gauge',
      `medlink_jobs_queued ${stats.queued}`,
      '',
      '# HELP medlink_jobs_running Number of running jobs',
      '# TYPE medlink_jobs_running gauge',
      `medlink_jobs_running ${stats.running}`,
      '',
      '# HELP medlink_jobs_failed Number of failed jobs',
      '# TYPE medlink_jobs_failed gauge',
      `medlink_jobs_failed ${stats.failed}`,
      '',
      '# HELP medlink_jobs_completed Number of completed jobs',
      '# TYPE medlink_jobs_completed counter',
      `medlink_jobs_completed ${stats.completed}`,
      '',
      '# HELP medlink_claims_total Total number of claims',
      '# TYPE medlink_claims_total gauge',
      `medlink_claims_total ${totalClaims[0]?.count || 0}`,
      '',
      '# HELP medlink_claims_pending Number of pending claims',
      '# TYPE medlink_claims_pending gauge',
      `medlink_claims_pending ${pendingClaims[0]?.count || 0}`,
      '',
      '# HELP medlink_claims_submitted Number of submitted claims',
      '# TYPE medlink_claims_submitted gauge',
      `medlink_claims_submitted ${submittedClaims[0]?.count || 0}`,
      '',
      '# HELP medlink_claims_paid Number of paid claims',
      '# TYPE medlink_claims_paid gauge',
      `medlink_claims_paid ${paidClaims[0]?.count || 0}`,
      '',
      '# HELP medlink_claims_denied Number of denied claims',
      '# TYPE medlink_claims_denied gauge',
      `medlink_claims_denied ${deniedClaims[0]?.count || 0}`,
      '',
      '# HELP medlink_up Application uptime status',
      '# TYPE medlink_up gauge',
      'medlink_up 1',
      '',
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
    ].join('\n');
    
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('# Error generating metrics\n');
  }
}