import { Request, Response, NextFunction } from 'express';
import path from 'path';

// Middleware to add caching headers for static assets
export function staticCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  const filepath = req.path;
  
  // Check if this is a static asset
  if (filepath.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
    // Check if file has fingerprint (hash in filename)
    if (filepath.includes('.') && filepath.match(/\.[a-f0-9]{8,}\./)) {
      // Fingerprinted assets are immutable
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // Non-fingerprinted assets get shorter cache
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  } else if (filepath.endsWith('.html') || filepath === '/') {
    // HTML files should not be cached aggressively
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  next();
}

// Add caching headers for specific routes
export function addCacheHeaders(maxAge: number = 3600) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    next();
  };
}