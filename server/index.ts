import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry, getSentryMiddleware } from "./monitoring/sentry";

const app = express();

// Initialize Sentry before other middleware
initSentry(app);
const sentryMiddleware = getSentryMiddleware();

// Add Sentry request handler (must be first)
app.use(sentryMiddleware.requestHandler);

// Add Sentry tracing handler
app.use(sentryMiddleware.tracingHandler);

app.use(express.json());
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
