import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { claims, users, preAuths } from '@shared/schema';
import * as os from 'os';
import * as Sentry from '@sentry/node';

// Basic health check (no auth required)
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'medlink-claims-hub',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: process.memoryUsage().heapUsed / 1024 / 1024,
      total: process.memoryUsage().heapTotal / 1024 / 1024,
      rss: process.memoryUsage().rss / 1024 / 1024,
    },
    monitoring: {
      sentry: !!process.env.SENTRY_DSN,
      metrics: process.env.ENABLE_METRICS === 'true',
    },
  };
  
  res.status(200).json(healthStatus);
}

// Readiness check (checks DB connection and critical services)
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  const checks: Record<string, boolean | string | number> = {
    timestamp: new Date().toISOString(),
    database: false,
    storage: false,
    jobQueue: false,
    sentry: false,
  };
  
  let errorDetails: string[] = [];
  
  try {
    // Test database connection with timeout
    const dbPromise = db.execute(sql`SELECT 1 as test`);
    const dbTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    );
    
    try {
      const result = await Promise.race([dbPromise, dbTimeout]) as any;
      checks.database = result.rows.length > 0;
    } catch (dbError) {
      checks.database = false;
      errorDetails.push(`Database: ${(dbError as Error).message}`);
    }
    
    // Check storage availability
    try {
      const storage = await import('../storage');
      checks.storage = storage.default !== undefined;
    } catch (storageError) {
      checks.storage = false;
      errorDetails.push(`Storage: ${(storageError as Error).message}`);
    }
    
    // Check job queue
    try {
      const { jobQueue } = await import('../lib/jobs');
      const stats = await jobQueue.getStats();
      checks.jobQueue = stats !== undefined;
      checks.queuedJobs = stats.queued || 0;
      checks.failedJobs = stats.failed || 0;
    } catch (jobError) {
      checks.jobQueue = false;
      errorDetails.push(`JobQueue: ${(jobError as Error).message}`);
    }
    
    // Check Sentry availability
    checks.sentry = !!process.env.SENTRY_DSN && Sentry.getCurrentHub() !== undefined;
    
    // System resources check
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memoryUsagePercent = Math.round(memoryUsagePercent);
    
    // Overall readiness determination
    const criticalChecks = ['database'];
    const isReady = criticalChecks.every(check => checks[check] === true);
    const hasWarnings = !checks.storage || !checks.jobQueue || memoryUsagePercent > 90;
    
    res.status(isReady ? 200 : 503).json({
      status: isReady ? (hasWarnings ? 'ready_with_warnings' : 'ready') : 'not_ready',
      checks,
      ...(errorDetails.length > 0 && { errors: errorDetails }),
      ...(hasWarnings && {
        warnings: [
          !checks.storage && 'Storage service unavailable',
          !checks.jobQueue && 'Job queue service unavailable',
          memoryUsagePercent > 90 && 'High memory usage',
        ].filter(Boolean),
      }),
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    
    // Report to Sentry if available
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'health_check' },
      });
    }
    
    res.status(503).json({
      status: 'error',
      checks,
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Health check failed',
      errors: errorDetails,
    });
  }
}

// Metrics endpoint (Prometheus format)
export async function metricsEndpoint(req: Request, res: Response): Promise<void> {
  try {
    // Collect all metrics concurrently for better performance
    const metricsPromises = await Promise.allSettled([
      // Job queue metrics
      (async () => {
        const { jobQueue } = await import('../lib/jobs');
        return jobQueue.getStats();
      })(),
      
      // Claims metrics
      db.select({ count: sql<number>`count(*)` }).from(claims),
      db.select({ count: sql<number>`count(*)` }).from(claims).where(sql`status = 'pending'`),
      db.select({ count: sql<number>`count(*)` }).from(claims).where(sql`status = 'submitted'`),
      db.select({ count: sql<number>`count(*)` }).from(claims).where(sql`status = 'paid'`),
      db.select({ count: sql<number>`count(*)` }).from(claims).where(sql`status = 'denied'`),
      
      // User metrics
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(users).where(sql`role = 'provider'`),
      db.select({ count: sql<number>`count(*)` }).from(users).where(sql`role = 'patient'`),
      db.select({ count: sql<number>`count(*)` }).from(users).where(sql`role = 'admin'`),
      
      // Pre-auth metrics
      db.select({ count: sql<number>`count(*)` }).from(preAuths),
      db.select({ count: sql<number>`count(*)` }).from(preAuths).where(sql`status = 'pending'`),
      db.select({ count: sql<number>`count(*)` }).from(preAuths).where(sql`status = 'approved'`),
    ]);
    
    // Extract results with fallbacks
    const stats = metricsPromises[0].status === 'fulfilled' ? metricsPromises[0].value : { queued: 0, running: 0, failed: 0, completed: 0 };
    const totalClaims = metricsPromises[1].status === 'fulfilled' ? metricsPromises[1].value : [{ count: 0 }];
    const pendingClaims = metricsPromises[2].status === 'fulfilled' ? metricsPromises[2].value : [{ count: 0 }];
    const submittedClaims = metricsPromises[3].status === 'fulfilled' ? metricsPromises[3].value : [{ count: 0 }];
    const paidClaims = metricsPromises[4].status === 'fulfilled' ? metricsPromises[4].value : [{ count: 0 }];
    const deniedClaims = metricsPromises[5].status === 'fulfilled' ? metricsPromises[5].value : [{ count: 0 }];
    const totalUsers = metricsPromises[6].status === 'fulfilled' ? metricsPromises[6].value : [{ count: 0 }];
    const providerUsers = metricsPromises[7].status === 'fulfilled' ? metricsPromises[7].value : [{ count: 0 }];
    const patientUsers = metricsPromises[8].status === 'fulfilled' ? metricsPromises[8].value : [{ count: 0 }];
    const adminUsers = metricsPromises[9].status === 'fulfilled' ? metricsPromises[9].value : [{ count: 0 }];
    const totalPreAuth = metricsPromises[10].status === 'fulfilled' ? metricsPromises[10].value : [{ count: 0 }];
    const pendingPreAuth = metricsPromises[11].status === 'fulfilled' ? metricsPromises[11].value : [{ count: 0 }];
    const approvedPreAuth = metricsPromises[12].status === 'fulfilled' ? metricsPromises[12].value : [{ count: 0 }];
    
    // System metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    // Format as Prometheus metrics
    const metrics = [
      '# HELP medlink_info Application information',
      '# TYPE medlink_info gauge',
      `medlink_info{version="${process.env.npm_package_version || '1.0.0'}",environment="${process.env.NODE_ENV || 'development'}",monitoring="${!!process.env.SENTRY_DSN ? 'enabled' : 'disabled'}"} 1`,
      '',
      '# Job Queue Metrics',
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
      '# Claims Metrics',
      '# HELP medlink_claims_total Total number of claims by status',
      '# TYPE medlink_claims_total gauge',
      `medlink_claims_total{status="all"} ${totalClaims[0]?.count || 0}`,
      `medlink_claims_total{status="pending"} ${pendingClaims[0]?.count || 0}`,
      `medlink_claims_total{status="submitted"} ${submittedClaims[0]?.count || 0}`,
      `medlink_claims_total{status="paid"} ${paidClaims[0]?.count || 0}`,
      `medlink_claims_total{status="denied"} ${deniedClaims[0]?.count || 0}`,
      '',
      '# User Metrics',
      '# HELP medlink_users_total Total number of users by role',
      '# TYPE medlink_users_total gauge',
      `medlink_users_total{role="all"} ${totalUsers[0]?.count || 0}`,
      `medlink_users_total{role="provider"} ${providerUsers[0]?.count || 0}`,
      `medlink_users_total{role="patient"} ${patientUsers[0]?.count || 0}`,
      `medlink_users_total{role="admin"} ${adminUsers[0]?.count || 0}`,
      '',
      '# Pre-Authorization Metrics',
      '# HELP medlink_preauth_total Total number of pre-auth requests',
      '# TYPE medlink_preauth_total gauge',
      `medlink_preauth_total{status="all"} ${totalPreAuth[0]?.count || 0}`,
      `medlink_preauth_total{status="pending"} ${pendingPreAuth[0]?.count || 0}`,
      `medlink_preauth_total{status="approved"} ${approvedPreAuth[0]?.count || 0}`,
      '',
      '# System Metrics',
      '# HELP medlink_up Application uptime status',
      '# TYPE medlink_up gauge',
      'medlink_up 1',
      '',
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '',
      '# HELP process_memory_heap_used_bytes Process heap memory usage',
      '# TYPE process_memory_heap_used_bytes gauge',
      `process_memory_heap_used_bytes ${memUsage.heapUsed}`,
      '',
      '# HELP process_memory_heap_total_bytes Process total heap memory',
      '# TYPE process_memory_heap_total_bytes gauge',
      `process_memory_heap_total_bytes ${memUsage.heapTotal}`,
      '',
      '# HELP process_memory_rss_bytes Process resident set size',
      '# TYPE process_memory_rss_bytes gauge',
      `process_memory_rss_bytes ${memUsage.rss}`,
      '',
      '# HELP process_memory_external_bytes Process external memory',
      '# TYPE process_memory_external_bytes gauge',
      `process_memory_external_bytes ${memUsage.external}`,
      '',
      '# HELP process_cpu_user_seconds_total User CPU time in seconds',
      '# TYPE process_cpu_user_seconds_total counter',
      `process_cpu_user_seconds_total ${cpuUsage.user / 1000000}`,
      '',
      '# HELP process_cpu_system_seconds_total System CPU time in seconds',
      '# TYPE process_cpu_system_seconds_total counter',
      `process_cpu_system_seconds_total ${cpuUsage.system / 1000000}`,
      '',
      '# HELP node_load1 1 minute load average',
      '# TYPE node_load1 gauge',
      `node_load1 ${loadAvg[0]}`,
      '',
      '# HELP node_load5 5 minute load average',
      '# TYPE node_load5 gauge',
      `node_load5 ${loadAvg[1]}`,
      '',
      '# HELP node_load15 15 minute load average',
      '# TYPE node_load15 gauge',
      `node_load15 ${loadAvg[2]}`,
    ].join('\n');
    
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    
    // Report to Sentry if available
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'metrics_endpoint' },
      });
    }
    
    // Return basic metrics even on error
    const fallbackMetrics = [
      '# Error generating full metrics',
      '# HELP medlink_up Application uptime status',
      '# TYPE medlink_up gauge',
      'medlink_up 0',
      '',
      '# HELP medlink_metrics_error Metrics generation error',
      '# TYPE medlink_metrics_error gauge',
      'medlink_metrics_error 1',
    ].join('\n');
    
    res.status(500).send(fallbackMetrics);
  }
}

// Extended metrics endpoint with JSON format (for dashboards)
export async function extendedMetrics(req: Request, res: Response): Promise<void> {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      service: 'medlink-claims-hub',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      monitoring: {
        sentry: {
          enabled: !!process.env.SENTRY_DSN,
          environment: process.env.SENTRY_ENV || 'not_set',
        },
        metrics: process.env.ENABLE_METRICS === 'true',
      },
      system: {
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          heapUsagePercent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
        },
        cpu: {
          user: process.cpuUsage().user / 1000000,
          system: process.cpuUsage().system / 1000000,
        },
        load: os.loadavg(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
    };
    
    // Try to get application metrics
    try {
      const { jobQueue } = await import('../lib/jobs');
      const stats = await jobQueue.getStats();
      
      const [claimsData, usersData, preAuth] = await Promise.all([
        db.select({ 
          total: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where status = 'pending')`,
          submitted: sql<number>`count(*) filter (where status = 'submitted')`,
          paid: sql<number>`count(*) filter (where status = 'paid')`,
          denied: sql<number>`count(*) filter (where status = 'denied')`,
        }).from(claims),
        
        db.select({ 
          total: sql<number>`count(*)`,
          providers: sql<number>`count(*) filter (where role = 'provider')`,
          patients: sql<number>`count(*) filter (where role = 'patient')`,
          admins: sql<number>`count(*) filter (where role = 'admin')`,
        }).from(users),
        
        db.select({ 
          total: sql<number>`count(*)`,
          pending: sql<number>`count(*) filter (where status = 'pending')`,
          approved: sql<number>`count(*) filter (where status = 'approved')`,
        }).from(preAuths),
      ]);
      
      (metrics as any).application = {
        jobQueue: stats,
        claims: claimsData[0] || {},
        users: usersData[0] || {},
        preAuthRequests: preAuth[0] || {},
      };
    } catch (appError) {
      (metrics as any).application = {
        error: 'Unable to fetch application metrics',
      };
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('Error generating extended metrics:', error);
    
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'extended_metrics' },
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate metrics',
      timestamp: new Date().toISOString(),
    });
  }
}