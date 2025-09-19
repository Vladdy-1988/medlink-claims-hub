import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Configure Helmet with strict healthcare-compliant security headers
export function configureSecurityHeaders() {
  // Production-grade security headers for both development and production
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Temporarily allow unsafe-inline for React development
          // TODO: Remove unsafe-inline and use nonces in production
          ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
        ],
        styleSrc: [
          "'self'",
          // Allow inline styles for styled components
          // TODO: Move to nonce-based approach
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://api.dicebear.com", // For avatars
          "https://*.storage.googleapis.com", // For uploaded files
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:*", // For Vite HMR in development
          "wss://localhost:*",
          ...(process.env.NODE_ENV === 'development' ? ["ws://*"] : []),
          "https://replit.com", // For OIDC
          "https://*.replit.com",
          "https://*.storage.googleapis.com", // For object storage
        ],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
      reportOnly: false, // Set to true initially to test, then false for enforcement
    },
    // Strict Transport Security (HSTS)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking
    frameguard: {
      action: 'deny',
    },
    // Hide X-Powered-By
    hidePoweredBy: true,
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS Protection (legacy but still useful)
    xssFilter: true,
    // Prevent IE from opening downloads
    ieNoOpen: true,
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false,
    },
    // Permissions Policy
    permittedCrossDomainPolicies: false,
  });
}

// Additional security headers middleware for healthcare compliance
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Add additional security headers not covered by Helmet
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Strict Permissions Policy for healthcare data protection
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), ' +
    'ambient-light-sensor=(), ' +
    'autoplay=(), ' +
    'battery=(), ' +
    'camera=(), ' +
    'cross-origin-isolated=(), ' +
    'display-capture=(), ' +
    'document-domain=(), ' +
    'encrypted-media=(), ' +
    'execution-while-not-rendered=(), ' +
    'execution-while-out-of-viewport=(), ' +
    'fullscreen=(self), ' +
    'geolocation=(), ' +
    'gyroscope=(), ' +
    'magnetometer=(), ' +
    'microphone=(), ' +
    'midi=(), ' +
    'navigation-override=(), ' +
    'payment=(), ' +
    'picture-in-picture=(), ' +
    'publickey-credentials-get=(), ' +
    'screen-wake-lock=(), ' +
    'sync-xhr=(), ' +
    'usb=(), ' +
    'web-share=(), ' +
    'xr-spatial-tracking=()'
  );
  
  // Security headers for healthcare compliance
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Cache control for sensitive data
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
}