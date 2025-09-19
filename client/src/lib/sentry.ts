import * as Sentry from '@sentry/react';

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

// Sanitize data to remove PHI
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

// Initialize Sentry for frontend
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.log('[Sentry] Monitoring disabled: VITE_SENTRY_DSN not provided');
    return;
  }
  
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'development',
      
      integrations: [
        // Browser tracing
        new Sentry.BrowserTracing({
          // Set sampling rate for performance monitoring
          tracePropagationTargets: ['localhost', /^https:\/\/.*\.replit\.app/],
        }),
        // Replay sessions for errors
        new Sentry.Replay({
          // Mask all text and inputs by default
          maskAllText: true,
          maskAllInputs: true,
          // Don't record network request/response bodies (might contain PHI)
          networkDetailAllowUrls: [],
          // Block certain elements from replay
          blockSelector: '[data-sensitive], .sensitive, input[type=password]',
          // Ignore interactions on sensitive elements
          ignoreSelector: '[data-sensitive], .sensitive',
        }),
      ],
      
      // Performance monitoring
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      
      // Session replay sampling
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
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
          service: 'medlink-frontend',
          version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        };
        
        // Categorize errors
        const error = hint.originalException;
        if (error instanceof Error) {
          if (error.message.includes('Network') || error.message.includes('fetch')) {
            event.tags['error.type'] = 'network';
            event.level = 'warning';
          } else if (error.message.includes('Permission') || error.message.includes('401')) {
            event.tags['error.type'] = 'authentication';
            event.level = 'error';
          } else if (error.name === 'ValidationError') {
            event.tags['error.type'] = 'validation';
            event.level = 'warning';
          } else {
            event.tags['error.type'] = 'unknown';
            event.level = 'error';
          }
        }
        
        return event;
      },
      
      // Ignore certain errors
      ignoreErrors: [
        // Network errors
        'NetworkError',
        'Failed to fetch',
        'Load failed',
        // Browser extensions
        'Non-Error promise rejection captured',
        // ResizeObserver errors (common and usually harmless)
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Common third-party errors
        'top.GLOBALS',
        'Script error',
        // Service worker errors
        'Failed to update a ServiceWorker',
      ],
      
      // Don't send default PII
      sendDefaultPii: false,
      
      // Set release version
      release: import.meta.env.VITE_APP_VERSION,
      
      // Enable auto session tracking
      autoSessionTracking: true,
      
      // Set max breadcrumbs
      maxBreadcrumbs: 50,
    });
    
    console.log('[Sentry] Monitoring initialized successfully', {
      environment: import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE,
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    });
  } catch (error) {
    console.error('[Sentry] Failed to initialize monitoring:', error);
  }
}

// Helper to capture errors with context
export function captureError(error: Error, context?: Record<string, any>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return;
  }
  
  const sanitizedContext = context ? sanitizeData(context) : undefined;
  
  Sentry.withScope((scope) => {
    if (sanitizedContext) {
      scope.setContext('error_context', sanitizedContext);
    }
    
    Sentry.captureException(error);
  });
}

// Helper to track custom events
export function trackEvent(eventName: string, data?: Record<string, any>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) {
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
export function measurePerformance<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return fn();
  }
  
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
  const span = transaction?.startChild({
    op: 'function',
    description: name,
  });
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        span?.finish();
      });
    }
    
    span?.finish();
    return result;
  } catch (error) {
    span?.finish();
    throw error;
  }
}

// Helper to set user context (without PHI)
export function setUserContext(userId: string, role?: string): void {
  if (!import.meta.env.VITE_SENTRY_DSN) {
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
  if (!import.meta.env.VITE_SENTRY_DSN) {
    return;
  }
  
  Sentry.setUser(null);
}

// Error boundary component
export const ErrorBoundary = Sentry.ErrorBoundary;

// Profiler component for performance monitoring
export const Profiler = Sentry.Profiler;

// Export Sentry for direct usage if needed
export { Sentry };