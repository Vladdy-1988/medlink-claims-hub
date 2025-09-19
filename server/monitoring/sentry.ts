import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../security/logger';

// PHI fields that should never be sent to Sentry
const PHI_FIELDS = [
  'name',
  'patientName',
  'firstName',
  'lastName',
  'healthCardNumber',
  'dob',
  'dateOfBirth',
  'ssn',
  'socialSecurityNumber',
  'address',
  'email',
  'phone',
  'phoneNumber',
  'identifiers',
  'medicalRecordNumber',
  'mrn',
  'healthCard',
  'insuranceId',
  'policyNumber',
  'memberId',
];

// Redact PHI from error context
function sanitizeData(data: any, depth = 0): any {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';
  
  if (data === null || data === undefined) return data;
  
  if (typeof data !== 'object') {
    // Redact potential PHI in strings
    if (typeof data === 'string' && data.length > 0) {
      // Check for patterns that might be PHI
      if (/\d{9}/.test(data) || // SSN pattern
          /\d{10}/.test(data) || // Phone pattern
          /[A-Z]\d{9}/.test(data)) { // Health card pattern
        return '[REDACTED]';
      }
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }
  
  const sanitized: any = {};
  
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field name contains PHI indicators
      const isPHI = PHI_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isPHI) {
        sanitized[key] = '[REDACTED_PHI]';
      } else if (typeof data[key] === 'object') {
        sanitized[key] = sanitizeData(data[key], depth + 1);
      } else {
        sanitized[key] = data[key];
      }
    }
  }
  
  return sanitized;
}

// Initialize Sentry for backend
export function initSentry(app?: Express): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.info('Sentry monitoring disabled: SENTRY_DSN not provided');
    return;
  }
  
  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'development',
      
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      integrations: [
        // HTTP integration for Express
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration
        new Sentry.Integrations.Express({ app }),
        // Profiling integration
        nodeProfilingIntegration(),
        // Prisma integration
        new Sentry.Integrations.Prisma({ client: true }),
      ],
      
      // Data sanitization
      beforeSend(event, hint) {
        // Sanitize request data
        if (event.request) {
          event.request = sanitizeData(event.request);
        }
        
        // Sanitize user data
        if (event.user) {
          event.user = {
            id: event.user.id,
            // Only keep non-PHI user data
            username: event.user.username,
            // Remove email, ip_address, and other PII
          };
        }
        
        // Sanitize context data
        if (event.contexts) {
          event.contexts = sanitizeData(event.contexts);
        }
        
        // Sanitize extra data
        if (event.extra) {
          event.extra = sanitizeData(event.extra);
        }
        
        // Sanitize breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => ({
            ...breadcrumb,
            data: breadcrumb.data ? sanitizeData(breadcrumb.data) : undefined,
          }));
        }
        
        // Add custom tags
        event.tags = {
          ...event.tags,
          service: 'medlink-backend',
          version: process.env.npm_package_version || '1.0.0',
        };
        
        return event;
      },
      
      // Transaction name normalization
      beforeSendTransaction(event) {
        // Normalize transaction names to avoid high cardinality
        if (event.transaction) {
          // Replace IDs in paths with placeholders
          event.transaction = event.transaction
            .replace(/\/\d+/g, '/:id')
            .replace(/\/[a-f0-9-]{36}/gi, '/:uuid');
        }
        
        return event;
      },
      
      // Ignore certain errors
      ignoreErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'NetworkError',
        'Failed to fetch',
      ],
      
      // Set release version
      release: process.env.npm_package_version,
      
      // Enable auto session tracking
      autoSessionTracking: true,
      
      // Set max breadcrumbs
      maxBreadcrumbs: 50,
    });
    
    logger.info('Sentry monitoring initialized successfully', {
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', error);
  }
}

// Express middleware for Sentry
export function getSentryMiddleware() {
  if (!process.env.SENTRY_DSN) {
    return {
      requestHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
      tracingHandler: (_req: Request, _res: Response, next: NextFunction) => next(),
      errorHandler: (_err: any, _req: Request, _res: Response, next: NextFunction) => next(_err),
    };
  }
  
  return {
    // This should be the first middleware
    requestHandler: Sentry.Handlers.requestHandler({
      request: ['method', 'url', 'query_string', 'headers'],
      ip: false, // Don't capture IP addresses (PII)
      user: ['id'], // Only capture user ID, not email or other PII
    }),
    
    // This should be before request handlers
    tracingHandler: Sentry.Handlers.tracingHandler(),
    
    // This should be the last error handler
    errorHandler: Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture 400+ errors
        const status = error.status || error.statusCode || 500;
        return status >= 400;
      },
    }),
  };
}

// Helper to capture specific errors with context
export function captureError(error: Error, context?: Record<string, any>): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  const sanitizedContext = context ? sanitizeData(context) : undefined;
  
  Sentry.withScope((scope) => {
    if (sanitizedContext) {
      scope.setContext('error_context', sanitizedContext);
    }
    
    // Add error categorization
    if (error.message.includes('validation')) {
      scope.setTag('error.type', 'validation');
      scope.setLevel('warning');
    } else if (error.message.includes('auth')) {
      scope.setTag('error.type', 'authentication');
      scope.setLevel('error');
    } else if (error.message.includes('database')) {
      scope.setTag('error.type', 'database');
      scope.setLevel('error');
    } else if (error.message.includes('network')) {
      scope.setTag('error.type', 'network');
      scope.setLevel('warning');
    } else {
      scope.setTag('error.type', 'unknown');
      scope.setLevel('error');
    }
    
    Sentry.captureException(error);
  });
}

// Helper to track custom events
export function trackEvent(eventName: string, data?: Record<string, any>): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  const sanitizedData = data ? sanitizeData(data) : undefined;
  
  Sentry.addBreadcrumb({
    message: eventName,
    category: 'custom',
    level: 'info',
    data: sanitizedData,
  });
}

// Helper to measure performance
export function measurePerformance(name: string, fn: () => Promise<any>): Promise<any> {
  if (!process.env.SENTRY_DSN) {
    return fn();
  }
  
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  const span = transaction?.startChild({
    op: 'function',
    description: name,
  });
  
  return fn().finally(() => {
    span?.finish();
  });
}

// Helper to set user context (without PHI)
export function setUserContext(userId: string, role?: string): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  Sentry.setUser({
    id: userId,
    // Only set non-PHI attributes
    ...(role && { segment: role }),
  });
}

// Helper to clear user context
export function clearUserContext(): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  Sentry.setUser(null);
}

// Export Sentry for direct usage if needed
export { Sentry };