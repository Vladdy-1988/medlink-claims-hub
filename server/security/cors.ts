import cors, { CorsOptions } from 'cors';
import { Request } from 'express';

// Get allowed origins from environment variable
function getAllowedOrigins(): string[] {
  const allowedOrigins = process.env.ALLOWED_ORIGINS || '';
  
  // In development, allow localhost origins
  if (process.env.NODE_ENV === 'development') {
    return [
      'http://localhost:5000',
      'http://localhost:3000',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:3000',
    ];
  }
  
  // In production, use exact origins from environment
  if (!allowedOrigins) {
    console.warn('ALLOWED_ORIGINS not set, CORS will be restrictive');
    return [];
  }
  
  // Parse comma-separated origins
  return allowedOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

// CORS configuration
export function configureCORS(): cors.CorsOptions {
  const allowedOrigins = getAllowedOrigins();
  
  const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (health checks, internal calls)
      if (!origin) {
        return callback(null, true);
      }
      
      // Reject wildcard origins
      if (origin === '*') {
        return callback(new Error('Wildcard origins are not allowed'));
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.length === 0) {
        return callback(new Error('CORS: Origin not allowed'));
      }
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Log rejected origin for debugging
      console.warn(`CORS: Rejected origin: ${origin}`);
      return callback(new Error('CORS: Origin not allowed'));
    },
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Current-Page',
      'X-Per-Page',
    ],
    maxAge: 600, // Preflight cache for 10 minutes (600 seconds)
    optionsSuccessStatus: 204,
  };
  
  return corsOptions;
}

// CORS middleware factory
export function getCORSMiddleware() {
  return cors(configureCORS());
}