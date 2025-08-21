import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Standard 429 response handler
const standardLimitHandler = (req: Request, res: Response) => {
  // Log rate limit hit via audit
  if (req.app.locals.auditLogger) {
    req.app.locals.auditLogger.log('rate_limit_exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.claims?.sub,
    });
  }

  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
};

// Auth routes rate limiter (10 requests per minute)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler,
  skipSuccessfulRequests: false,
  // Use default keyGenerator which handles IPv6 properly
});

// Upload and connectors routes rate limiter (60 requests per minute)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many upload requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler,
  skipSuccessfulRequests: false,
  // Use default keyGenerator which handles IPv6 properly
});

// EDI connector rate limiter (60 requests per minute)
export const connectorLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many connector requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler,
  skipSuccessfulRequests: false,
  // Use default keyGenerator which handles IPv6 properly
});

// General API rate limiter (300 requests per minute)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler,
  skipSuccessfulRequests: false,
  // Use default keyGenerator which handles IPv6 properly
});

// Strict rate limiter for sensitive operations (5 requests per minute)
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many sensitive operation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardLimitHandler,
  skipSuccessfulRequests: false,
  // Use default keyGenerator which handles IPv6 properly
});