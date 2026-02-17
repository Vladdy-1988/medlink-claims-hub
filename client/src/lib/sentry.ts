import * as Sentry from '@sentry/react';

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

function sanitizeData(data: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';
  if (data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    if (typeof data === 'string' && data.length > 0) {
      if (/\d{9}/.test(data) || /\d{10}/.test(data) || /[A-Z]\d{9}/.test(data)) {
        return '[REDACTED]';
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, depth + 1));
  }

  const source = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    const lowerKey = key.toLowerCase();
    const isPHI = PHI_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()));
    sanitized[key] = isPHI ? '[REDACTED_PHI]' : sanitizeData(value, depth + 1);
  }

  return sanitized;
}

let sentryEnabled = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    sentryEnabled = false;
    console.log('[Sentry] Monitoring disabled: VITE_SENTRY_DSN not provided');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'development',
      release: import.meta.env.VITE_RELEASE_SHA || import.meta.env.VITE_APP_VERSION,
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1,
      sendDefaultPii: false,
      maxBreadcrumbs: 50,
      ignoreErrors: [
        'NetworkError',
        'Failed to fetch',
        'Load failed',
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Script error',
      ],
      beforeSend(event, hint) {
        if (event.request) event.request = sanitizeData(event.request) as typeof event.request;
        if (event.contexts) event.contexts = sanitizeData(event.contexts) as typeof event.contexts;
        if (event.extra) event.extra = sanitizeData(event.extra) as typeof event.extra;

        if (event.user) {
          event.user = {
            id: event.user.id,
            username: event.user.username,
          };
        }

        event.tags = {
          ...event.tags,
          service: 'medlink-frontend',
          version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        };

        const original = hint.originalException;
        if (original instanceof Error) {
          if (original.message.includes('Network') || original.message.includes('fetch')) {
            event.tags.error_type = 'network';
            event.level = 'warning';
          } else if (original.message.includes('Permission') || original.message.includes('401')) {
            event.tags.error_type = 'authentication';
            event.level = 'error';
          }
        }

        return event;
      },
    });

    sentryEnabled = true;
    console.log('[Sentry] Monitoring initialized successfully');
  } catch (error) {
    sentryEnabled = false;
    console.error('[Sentry] Failed to initialize monitoring:', error);
  }
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!sentryEnabled) {
    return;
  }

  const sanitizedContext = context ? (sanitizeData(context) as Record<string, unknown>) : undefined;

  Sentry.withScope((scope) => {
    if (sanitizedContext) {
      scope.setContext('error_context', sanitizedContext);
    }
    Sentry.captureException(error);
  });
}

export function trackEvent(eventName: string, data?: Record<string, unknown>): void {
  if (!sentryEnabled) {
    return;
  }

  const sanitizedData = data ? (sanitizeData(data) as Record<string, unknown>) : undefined;

  Sentry.addBreadcrumb({
    message: eventName,
    category: 'custom',
    level: 'info',
    data: sanitizedData,
  });
}

export async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!sentryEnabled) {
    return fn();
  }

  return Sentry.startSpan(
    {
      name,
      op: 'function',
    },
    async () => fn()
  );
}

export function setUserContext(userId: string, role?: string): void {
  if (!sentryEnabled) {
    return;
  }

  Sentry.setUser({
    id: userId,
    ...(role ? { segment: role } : {}),
  });
}

export function clearUserContext(): void {
  if (!sentryEnabled) {
    return;
  }

  Sentry.setUser(null);
}

export const ErrorBoundary = Sentry.ErrorBoundary;
export const Profiler = Sentry.Profiler;
export { Sentry };
