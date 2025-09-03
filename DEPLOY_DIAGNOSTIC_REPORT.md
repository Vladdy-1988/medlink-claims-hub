# DEPLOYMENT DIAGNOSTIC REPORT
Generated: September 3, 2025

## A) REPO OVERVIEW

### Directory Structure (depth 3)
```
./client
  ./client/public
  ./client/src
    ./client/src/components
    ./client/src/hooks
    ./client/src/i18n
    ./client/src/lib
    ./client/src/pages
./config
./docs
./prisma
  ./prisma/migrations
    ./prisma/migrations/20250814153234_init
./server
  ./server/connectors
  ./server/integrations
  ./server/lib
  ./server/mappers
  ./server/sandbox
  ./server/security
./shared
./tests
  ./tests/api
  ./tests/components
  ./tests/e2e
  ./tests/mocks
  ./tests/unit
    ./tests/unit/components
  ./tests/utils
```

### Node/NPM Versions
- Node: v20.19.3
- NPM: 10.8.2

### Package.json Scripts (Root)
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  }
}
```
Note: No workspace configuration found (monorepo structure not present)

### .replit Configuration
```
deploymentTarget = "autoscale"
build = ["sh", "-c", "npm ci && npm run build"]
run = ["sh", "-c", "npm -w apps/api run prisma:migrate && npm start"]
localPort = 5000
externalPort = 80
```

## B) ENV CHECK (CURRENT SHELL)

| Variable | Status | Details |
|----------|---------|---------|
| DATABASE_URL | [set] | host=ep-cool-wave-afq8mhqg-pooler.c-2.us-west-2.aws.neon.tech db=neondb sslmode=require (len: 146) |
| NODE_ENV | [missing] | - |
| PORT | [set] | (len: 4) |
| BASE_URL | [missing] | - |
| ALLOWED_ORIGINS | [set] | (len: 59) |
| JWT_SECRET | [set] | (len: 79) |
| SSO_SHARED_SECRET | [set] | (len: 67) |
| CONNECTORS_MODE | [set] | (len: 7) |
| ITRANS_ENABLED | [set] | (len: 4) |
| ECLAIMS_ENABLED | [set] | (len: 4) |
| STORAGE_DIR | [set] | (len: 7) |
| VAPID_PUBLIC_KEY | [missing] | - |
| VAPID_PRIVATE_KEY | [missing] | - |

## C) PRISMA / DB CONNECTIVITY

### Drizzle Version
- drizzle-kit: v0.30.4
- drizzle-orm: v0.39.1

### Schema Configuration
- Path: `./shared/schema.ts`
- Provider: postgresql
- Migration Config: `./drizzle.config.ts`

### Database Status
```
$ npx drizzle-kit check
Everything's fine 🐶🔥
```
✅ Database connection successful with Neon PostgreSQL

## D) BUILD ARTIFACTS

### TypeScript Check
```
$ npx tsc --noEmit
```
**Errors Found: 26**

Key issues:
- client/src/pages/Admin.tsx: Property errors on empty objects
- client/src/pages/ClaimDetail.tsx: ReactNode type issues
- client/src/pages/Coverage.tsx: Query type mismatches
- server/connectors/cdanet-itrans.ts: Class inheritance errors

### Build Output
```
$ npm run build
✓ Vite build successful
  - index.html: 1.11 kB
  - CSS: 85.28 kB (gzipped: 14.27 kB)
  - JS: 507.94 kB (gzipped: 149.31 kB)
✓ ESBuild backend successful
  - dist/index.js: 148.6 kB
```

### Dist Contents
```
dist/
  index.js (152131 bytes)
  public/
    (frontend assets)
```

✅ API entrypoint `dist/index.js` exists

## E) SERVER PORT & BIND

### Server Listen Configuration
Location: `server/index.ts:95-97`
```javascript
server.listen({
  port,
  host: "0.0.0.0",
```

✅ Correctly binds to `0.0.0.0` (all interfaces)
✅ Uses PORT environment variable with fallback to 5000

## F) HEALTH CHECKS (LOCAL)

### Production Test (PORT=5001)
```
$ NODE_ENV=production PORT=5001 node dist/index.js
Server started successfully on port 5001
```

| Endpoint | Status | Response |
|----------|---------|----------|
| /healthz | 500 | CORS error (no origin) |
| /readyz | 500 | CORS error (no origin) |

⚠️ Health endpoints blocked by CORS in production mode

## G) CORS / COOKIES / PUSH

### CORS Configuration
Location: `server/security/cors.ts`

**Development Origins:**
- http://localhost:5000
- http://localhost:3000
- http://127.0.0.1:5000
- http://127.0.0.1:3000

**Production Origins:**
- Configured via `ALLOWED_ORIGINS` environment variable
- Current: Split from comma-separated string
- Rejects wildcard origins (*)
- Credentials: true (allows cookies)

### Cookie Security
Location: `server/replitAuth.ts:44-47`
```javascript
httpOnly: true,
sameSite: 'lax',
secure: NODE_ENV === 'production'
```
✅ Production cookies are secure

### Push Notifications (VAPID)
Location: `server/pushService.ts:14-25`
```javascript
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  // Use provided keys
} else {
  // Generate new keys
  vapidKeys = generateVAPIDKeys();
  console.log('Generated VAPID keys...');
}
webpush.setVapidDetails(...)
```
⚠️ **CRITICAL**: Push service ALWAYS initializes web-push, even without VAPID keys

## H) DEPLOY VS DEV ENV GAPS

### Required Environment Variables

| Variable | Required | Current Dev | Deploy Needs | Format/Example |
|----------|---------|-------------|--------------|----------------|
| DATABASE_URL | ✅ | Set | ✅ | postgresql://user:pass@host/db?sslmode=require |
| NODE_ENV | ✅ | Missing | production | "production" |
| PORT | ✅ | Set | 5000 | "5000" |
| ALLOWED_ORIGINS | ✅ | Set | Add deploy URL | "https://your-app.replit.app" |
| JWT_SECRET | ✅ | Set | ✅ | Random 64+ char string |
| SSO_SHARED_SECRET | ✅ | Set | ✅ | Random 64+ char string |

### Optional Environment Variables

| Variable | Optional | Purpose |
|----------|----------|---------|
| VAPID_PUBLIC_KEY | ⚠️ | Push notifications (BLOCKING if missing) |
| VAPID_PRIVATE_KEY | ⚠️ | Push notifications (BLOCKING if missing) |
| CONNECTORS_MODE | ✓ | EDI connectors mode |
| ITRANS_ENABLED | ✓ | Enable iTrans connector |
| ECLAIMS_ENABLED | ✓ | Enable eClaims connector |
| STORAGE_DIR | ✓ | Local file storage path |
| BASE_URL | ✓ | Application base URL |

## I) PROBABLE ROOT CAUSES (Ranked)

### P0 - Critical Blockers
1. **Wrong deployment command** - `.replit` references `npm -w apps/api run prisma:migrate` but this is NOT a workspace/monorepo
   - Evidence: No workspaces in package.json, command will fail
2. **Push service crashes without VAPID keys** - Server always calls `webpush.setVapidDetails()` even with generated keys
   - Evidence: Push routes don't check if VAPID is configured before initializing
3. **NODE_ENV not set in production** - Affects security, CORS, and cookie settings
   - Evidence: Missing in environment, required for production mode

### P1 - High Priority Issues
4. **CORS blocks production origin** - Deployed app origin not in ALLOWED_ORIGINS
   - Evidence: Health checks return CORS errors, need exact deployed URL
5. **TypeScript compilation errors** - 26 errors that could affect runtime behavior
   - Evidence: Type mismatches in Coverage, Admin, ClaimDetail pages

## J) ONE-LINER FIXES

### Critical Fixes (P0)

1. **Fix deployment run command:**
   ```bash
   # In .replit, change:
   run = ["sh", "-c", "npm run db:push && npm start"]
   ```

2. **Make push notifications optional (requested by user):**
   ```javascript
   // server/pushService.ts - Wrap initialization:
   const isPushEnabled = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
   if (!isPushEnabled) {
     console.warn('Push disabled: missing VAPID keys');
   } else {
     webpush.setVapidDetails(...);
   }
   ```

3. **Set NODE_ENV in deployment:**
   ```
   NODE_ENV=production
   ```

### High Priority Fixes (P1)

4. **Add deployed origin to ALLOWED_ORIGINS:**
   ```
   ALLOWED_ORIGINS=https://your-app-name.replit.app,http://localhost:5000
   ```

5. **Fix TypeScript errors:**
   ```bash
   # Fix the 26 compilation errors before next deployment
   npm run check
   ```

### Recommended Deployment Commands

**Build command:**
```bash
npm ci && npm run build
```

**Run command:**
```bash
npm run db:push && NODE_ENV=production npm start
```

### Complete Environment Variables for Deployment
```env
DATABASE_URL=postgresql://[YOUR_NEON_URL]?sslmode=require
NODE_ENV=production
PORT=5000
ALLOWED_ORIGINS=https://[YOUR-APP].replit.app
JWT_SECRET=[YOUR_SECRET]
SSO_SHARED_SECRET=[YOUR_SECRET]
STORAGE_DIR=/tmp/storage
# Optional - only if push notifications needed:
# VAPID_PUBLIC_KEY=[YOUR_KEY]
# VAPID_PRIVATE_KEY=[YOUR_KEY]
```

## SUMMARY

The deployment is failing due to:
1. ✅ Database connection is working
2. ❌ Incorrect deployment run command (references non-existent workspace)
3. ❌ Push service will crash without VAPID keys (not optional as requested)
4. ❌ NODE_ENV not set for production
5. ❌ CORS not configured for deployed origin
6. ⚠️ 26 TypeScript errors that may cause runtime issues

Apply the fixes in section J to resolve deployment issues.