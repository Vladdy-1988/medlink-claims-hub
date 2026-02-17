import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express, Request, Response, NextFunction } from 'express';
import { logger } from '../security/logger';

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

    if (isPHI) {
      sanitized[key] = '[REDACTED_PHI]';
    } else {
      sanitized[key] = sanitizeData(value, depth + 1);
    }
  }

  return sanitized;
}

let sentryEnabled = false;

export function initSentry(_app?: Express): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    sentryEnabled = false;
    logger.info('Sentry monitoring disabled: SENTRY_DSN not provided');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'development',
      release: process.env.RELEASE_SHA || process.env.npm_package_version,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
      integrations: [nodeProfilingIntegration()],
      maxBreadcrumbs: 50,
      sendDefaultPii: false,
      ignoreErrors: ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'NetworkError', 'Failed to fetch'],
      beforeSend(event) {
        if (event.request) event.request = sanitizeData(event.request) as typeof event.request;

        if (event.user) {
          event.user = {
            id: event.user.id,
            username: event.user.username,
          };
        }

        if (event.contexts) event.contexts = sanitizeData(event.contexts) as typeof event.contexts;
        if (event.extra) event.extra = sanitizeData(event.extra) as typeof event.extra;
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
            ...breadcrumb,
            data: breadcrumb.data ? (sanitizeData(breadcrumb.data) as Record<string, unknown>) : undefined,
          }));
        }

        event.tags = {
          ...event.tags,
          service: 'medlink-backend',
          version: process.env.npm_package_version || '1.0.0',
        };

        return event;
      },
    });

    sentryEnabled = true;
    logger.info('Sentry monitoring initialized successfully', {
      environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
      release: process.env.RELEASE_SHA || process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    sentryEnabled = false;
    logger.error('Failed to initialize Sentry', error);
  }
}

export function getSentryMiddleware() {
  const noop = (_req: Request, _res: Response, next: NextFunction) => next();

  return {
    requestHandler: noop,
    tracingHandler: noop,
    errorHandler: (err: unknown, _req: Request, _res: Response, next: NextFunction) => {
      if (sentryEnabled) {
        Sentry.captureException(err);
      }
      next(err);
    },
  };
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

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export { Sentry };
