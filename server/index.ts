import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry, getSentryMiddleware } from "./monitoring/sentry";
import { safeFetch } from "./net/allowlist";

const disallowedSecretValues = new Set([
  '',
  'changeme',
  'change-me',
  'replace-me',
  'replace_me',
  'replace-with-strong-random-value',
  'replace-with-strong-random-value-min-32-chars',
  'replace-with-real-value',
  'your-secret',
  'your-session-secret',
  'your-session-secret-min-32-chars',
  'your-shared-secret',
  'your-shared-secret-here',
  'secret',
  'password',
  'default',
]);

function isPlaceholderSecretValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (disallowedSecretValues.has(normalized)) {
    return true;
  }
  return (
    normalized.startsWith('replace-with-') ||
    normalized.startsWith('your-') ||
    normalized.includes('example')
  );
}

function requireStrongSecretInProduction(name: string, value: string | undefined, minLength: number): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!value || value.length < minLength) {
    throw new Error(`${name} must be set and at least ${minLength} characters in production`);
  }
  if (isPlaceholderSecretValue(value)) {
    throw new Error(`${name} must not use placeholder/default values in production`);
  }
}

// Store the original fetch for reference
const originalFetch = globalThis.fetch;

// Patch global fetch to enforce allowlist IMMEDIATELY
console.log('🔐 Patching global fetch for EDI sandbox protection...');
globalThis.fetch = safeFetch;
console.log('✅ Global fetch patched successfully');
console.log(`   Original fetch type: ${originalFetch ? originalFetch.constructor.name : 'none'}`);
console.log(`   New fetch type: safeFetch from ./net/allowlist`);

const app = express();

// Initialize Sentry before other middleware
initSentry(app);
const sentryMiddleware = getSentryMiddleware();

// Add Sentry request handler (must be first)
app.use(sentryMiddleware.requestHandler);

// Add Sentry tracing handler
app.use(sentryMiddleware.tracingHandler);

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf-8');
  },
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  requireStrongSecretInProduction('SESSION_SECRET', process.env.SESSION_SECRET, 32);
  requireStrongSecretInProduction('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, 32);
  requireStrongSecretInProduction('HASH_KEY', process.env.HASH_KEY, 32);

  // Check and verify encryption key on startup
  if (!process.env.ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      // HARD FAIL in production - no fallback allowed
      console.error('❌ CRITICAL: ENCRYPTION_KEY environment variable is REQUIRED in production');
      console.error('❌ Application startup aborted for security. Please set ENCRYPTION_KEY.');
      process.exit(1);
    } else {
      // Development mode - allow with warning but still set a dev key
      console.warn('⚠️  WARNING: ENCRYPTION_KEY not set - using development key');
      console.warn('⚠️  This is ONLY acceptable in development mode');
      process.env.ENCRYPTION_KEY = 'DEV_ONLY_KEY_DO_NOT_USE_IN_PRODUCTION_32CHARS';
    }
  }
  
  // Verify field-level encryption is working
  try {
    const { verifyEncryption } = await import("./security/field-encryption");
    if (!verifyEncryption()) {
      console.error('❌ Field-level encryption verification failed');
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ CRITICAL: Encryption verification failed in production');
        process.exit(1);
      } else {
        console.warn('⚠️  Encryption verification failed in development - continuing anyway');
      }
    } else {
      console.log('✅ Field-level encryption verified and working');
    }
  } catch (error) {
    console.error('❌ Failed to initialize field-level encryption:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CRITICAL: Cannot start production without working encryption');
      process.exit(1);
    } else {
      console.warn('⚠️  Encryption initialization failed in development - continuing anyway');
    }
  }
  
  // Run one-time seed guard on boot
  const { runSeedGuard } = await import("./seedGuard");
  await runSeedGuard();
  
  // Initialize EDI job queue
  try {
    const { jobQueue } = await import("./lib/jobs");
    console.log('✅ EDI job queue initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize EDI job queue:', error);
  }
  
  // Verify sandbox mode configuration
  const { verifySandboxMode, testDomain } = await import("./net/allowlist");
  verifySandboxMode();
  
  // Confirm fetch patching is active
  console.log('\n🔍 Verifying EDI sandbox blocking configuration:');
  console.log(`   EDI_MODE: ${process.env.EDI_MODE || 'not set (all domains allowed)'}`);
  console.log(`   OUTBOUND_ALLOWLIST: ${process.env.OUTBOUND_ALLOWLIST || 'default (sandbox.,test.,mock.,dev.,staging.)'}`);
  console.log(`   globalThis.fetch: ${globalThis.fetch === safeFetch ? '✅ Patched with safeFetch' : '⚠️ NOT patched'}`);
  
  // Test a few domains to confirm blocking is working
  if (process.env.EDI_MODE === 'sandbox') {
    console.log('\n🧪 Testing domain blocking (in sandbox mode):');
    const testDomains = [
      'manulife.ca',
      'sunlife.ca', 
      'sandbox.test',
      'localhost'
    ];
    for (const domain of testDomains) {
      const result = testDomain(domain);
      console.log(`   ${domain}: ${result.allowed ? '✅ ALLOWED' : '🚫 BLOCKED'} - ${result.reason}`);
    }
  }
  
  console.log('\n✨ EDI sandbox protection is active and configured');
  
  const server = await registerRoutes(app);

  // Add Sentry error handler (must be before other error handlers)
  app.use(sentryMiddleware.errorHandler);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Don't interfere with static asset serving
    if (req.path.startsWith('/assets/') || req.path.startsWith('/icons/') || req.path.endsWith('.css') || req.path.endsWith('.js')) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Add test route
  app.get('/test', (req, res) => {
    res.send(`
      <html>
        <head><title>MedLink Test</title></head>
        <body>
          <h1>✅ MedLink Claims Hub Server is Running!</h1>
          <p>✅ Server is operational on port ${process.env.PORT || 5000}</p>
          <p><a href="/">Go to Main Application</a></p>
          <script>
            console.log('Server test successful');
            fetch('/api/auth/user').then(r => console.log('API Status:', r.status));
          </script>
        </body>
      </html>
    `);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // In production, add a middleware to skip static serving for API routes
    app.use((req, res, next) => {
      // Skip static file serving for API and other JSON endpoints
      if (req.path.startsWith('/api/') || 
          req.path === '/healthz' || 
          req.path === '/readyz' || 
          req.path === '/metrics' ||
          req.path.startsWith('/auth/') ||
          req.path.startsWith('/upload/')) {
        // Let these requests pass through to the API routes registered earlier
        return next('route');
      }
      // For all other requests, continue to static file serving
      next();
    });
    
    // Now serve static files for non-API routes
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    log(`environment: ${process.env.NODE_ENV || 'development'}`);
    log(`database connected: ${!!process.env.DATABASE_URL}`);
    log(`🌟 MedLink Claims Hub is ready!`);
  });
})();
