import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Configure Helmet with deployment-compatible settings
export function configureSecurityHeaders() {
  // Use minimal security headers for deployment compatibility
  if (process.env.NODE_ENV === 'production') {
    // Return a simple middleware that adds basic security headers without helmet complexity
    return (req: any, res: any, next: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.removeHeader('X-Powered-By');
      next();
    };
  }
  
  // Full security headers for development
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
        ],
        styleSrc: [
          "'self'",
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
          "https:",
        ],
        connectSrc: [
          "'self'",
          "wss:",
          "https:",
        ],
        mediaSrc: ["'self"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hidePoweredBy: true,
    noSniff: true,
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