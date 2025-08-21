import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

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