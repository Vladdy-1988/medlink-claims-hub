import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

// Generate a new CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

// Set CSRF token cookie
export function setCSRFTokenCookie(res: Response, token?: string): string {
  const csrfToken = token || generateCSRFToken();
  
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be false so JS can read it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  
  return csrfToken;
}

// CSRF protection middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for health checks
  if (req.path === '/healthz' || req.path === '/readyz') {
    return next();
  }

  // Skip CSRF for auth callbacks (OAuth flows)
  if (req.path === '/api/callback') {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  
  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] as string;
  
  // Validate tokens
  if (!cookieToken || !headerToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'Request requires CSRF token',
    });
  }
  
  if (cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'CSRF token invalid',
      message: 'CSRF token mismatch',
    });
  }
  
  // Rotate token on successful validation (optional, for extra security)
  // This can be enabled for critical operations
  if (req.path.includes('/auth/') || req.path.includes('/api/claims/submit')) {
    setCSRFTokenCookie(res);
  }
  
  next();
}

// Helper to issue/rotate tokens on login
export function issueCSRFToken(req: Request, res: Response): void {
  const token = setCSRFTokenCookie(res);
  
  // Log token issuance (without the actual token value)
  if (req.app.locals.auditLogger) {
    req.app.locals.auditLogger.log('csrf_token_issued', {
      userId: (req as any).user?.claims?.sub,
      ip: req.ip,
    });
  }
}

// Endpoint handler to fetch CSRF token for SPA
export function getCSRFToken(req: Request, res: Response): void {
  let token = req.cookies[CSRF_COOKIE_NAME];
  
  // Generate new token if none exists
  if (!token) {
    token = setCSRFTokenCookie(res);
  }
  
  res.json({ csrfToken: token });
}