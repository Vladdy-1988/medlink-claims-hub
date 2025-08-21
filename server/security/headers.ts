import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Configure Helmet with appropriate CSP for the application
export function configureSecurityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for React development
          "'unsafe-eval'", // Required for development (remove in production)
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline styles
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:",
        ],
        imgSrc: [
          "'self'",
          "data:", // For inline images
          "blob:", // For blob URLs
          "https:", // For external images (CDN, avatars, etc.)
        ],
        connectSrc: [
          "'self'",
          "wss:", // WebSocket connections
          "https:", // API calls
        ],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"], // Equivalent to X-Frame-Options: DENY
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // upgradeInsecureRequests directive removed due to compatibility issues
      },
    },
    crossOriginEmbedderPolicy: false, // May need to be false for external resources
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true, // X-Content-Type-Options: nosniff
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  });
}

// Additional security headers middleware
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Add additional security headers not covered by Helmet
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
}