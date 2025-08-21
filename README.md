# MedLink Claims Hub

A comprehensive healthcare claims management Progressive Web Application (PWA) designed to streamline medical claim processing and tracking for healthcare providers.

## Features

- **Claims Management**: Submit, track, and manage insurance claims and pre-authorizations
- **Role-Based Access Control**: Provider, billing, and admin roles with appropriate permissions
- **Offline Support**: Draft saving and background sync for seamless offline functionality
- **File Attachments**: Secure file upload and management for claim documentation
- **Real-Time Status Tracking**: Visual timeline and status updates for claim progression
- **PWA Capabilities**: Installable app with push notifications and offline caching
- **SSO Integration**: Marketplace deep-linking with shared-secret authentication

## Technology Stack

- **Frontend**: React with TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend**: Express.js with Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth with SSO marketplace integration
- **Storage**: Object storage for file attachments
- **Offline**: IndexedDB for draft storage and background sync

## SSO Marketplace Integration

MedLink Claims Hub supports deep-linking from marketplace applications using JWT-based shared-secret authentication.

### Environment Configuration

```bash
# Required for SSO functionality
SSO_SHARED_SECRET=your-shared-secret-here
ALLOWED_ORIGINS=https://mymedlink.ca,https://*.replit.dev
```

### Marketplace Integration Example

To generate an SSO token and redirect users from your marketplace:

```javascript
const jwt = require("jsonwebtoken");

// Generate SSO token
const token = jwt.sign({
  sub: "user123",           // Unique user ID
  email: "user@example.com", // User email
  name: "John Doe",         // Full name
  orgId: "org456",          // Organization ID
  role: "provider",         // User role (provider, billing, admin)
  exp: Math.floor(Date.now() / 1000) + 300 // Token expires in 5 minutes
}, process.env.SSO_SHARED_SECRET);

// Redirect to Claims Hub
window.location = `https://YOUR_CLAIMS_URL/?sso=1&token=${encodeURIComponent(token)}&next=/claims/new`;
```

### Deep-Link Prefilling

Support for appointment-based claim prefilling:

```javascript
// Deep-link to claims form with appointment data
const deepLinkUrl = `https://YOUR_CLAIMS_URL/?sso=1&token=${token}&next=/claims/new?appointmentId=apt789`;
```

The Claims Hub will automatically:
1. Authenticate the user via SSO
2. Create or update user/organization records
3. Navigate to the specified page
4. Prefill forms with appointment data if provided

### SSO Authentication Flow

1. **Token Generation**: Marketplace generates HS256 JWT with user/org data
2. **Redirect**: User redirected to Claims Hub with SSO parameters
3. **Token Verification**: Claims Hub verifies JWT signature and expiration
4. **User/Org Upsert**: User and organization records created/updated
5. **Session Creation**: Standard session established for continued access
6. **Audit Logging**: SSO login event recorded with IP and user agent
7. **Navigation**: User redirected to requested page or dashboard

### Security Features

- **CORS Protection**: Limited to configured allowed origins
- **JWT Verification**: HS256 signature validation with shared secret
- **Token Expiration**: Short-lived tokens (5 minutes recommended)
- **Audit Logging**: All SSO logins tracked with metadata
- **Secure Cookies**: HttpOnly, SameSite=Lax, Secure for HTTPS

## Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Update .env with your database and service configurations
   ```

3. **Database Setup**:
   ```bash
   npm run db:push
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Production Deployment

### Database Setup

1. **PostgreSQL (Neon)**:
   ```bash
   # Set your Neon database URL
   DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
   
   # Run migrations
   ./db-migrate.sh
   
   # Seed initial data (insurers, demo org)
   ./db-seed.sh
   ```

### Object Storage Configuration

The application supports both S3-compatible storage (AWS S3, Cloudflare R2) and local filesystem fallback.

**S3/R2 Configuration**:
```bash
# S3-compatible storage (AWS S3, Cloudflare R2)
S3_ENDPOINT=https://your-endpoint.r2.cloudflarestorage.com
S3_BUCKET=medlink-uploads
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=auto  # or us-east-1 for AWS

# Local storage fallback (used if S3 not configured)
STORAGE_DIR=./uploads
```

### Environment Variables

**Required**:
- `DATABASE_URL`: PostgreSQL connection string (Neon)
- `SESSION_SECRET`: Secure session encryption key (generate with `openssl rand -base64 32`)

**Optional**:
- `SSO_SHARED_SECRET`: Shared secret for marketplace SSO integration
- `ALLOWED_ORIGINS`: Comma-separated allowed CORS origins
- `VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`: Push notification keys (auto-generated on first run)
- `S3_*`: Object storage configuration (see above)

### Build & Start

1. **Build the application**:
   ```bash
   npm run build
   # Builds both frontend (Vite) and backend (ESBuild)
   ```

2. **Start in production**:
   ```bash
   npm start
   # Or directly: NODE_ENV=production node dist/index.js
   ```

### Docker Deployment

A multi-stage Dockerfile is provided for containerized deployment:

```bash
# Build the Docker image
docker build -t medlink-claims-hub .

# Run with environment variables
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e SESSION_SECRET=$SESSION_SECRET \
  -e S3_ENDPOINT=$S3_ENDPOINT \
  -e S3_BUCKET=$S3_BUCKET \
  -e S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID \
  -e S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY \
  medlink-claims-hub
```

### Health Checks & Monitoring

- **Health Check**: `GET /healthz` - Basic health status
- **Readiness Check**: `GET /readyz` - Database connectivity check
- **Metrics**: `GET /metrics` - Prometheus-format metrics including:
  - Job queue stats (queued, running, failed, completed)
  - Claim counts by status
  - Process uptime

### Static Asset Caching

The application implements intelligent caching for static assets:
- Fingerprinted assets (with hash in filename): `Cache-Control: public, max-age=31536000, immutable`
- Non-fingerprinted assets: `Cache-Control: public, max-age=3600`
- HTML files: `Cache-Control: no-cache, no-store, must-revalidate`

### Security Features

- **CSRF Protection**: Double-submit cookie pattern
- **Rate Limiting**: Tiered limits for auth, uploads, and API endpoints
- **Security Headers**: CSP, HSTS, X-Frame-Options via Helmet
- **PHI-Safe Logging**: Automatic redaction of sensitive data

## API Endpoints

### Authentication
- `GET /api/login` - Initiate Replit Auth login
- `GET /api/logout` - Logout and clear session
- `POST /auth/sso` - SSO marketplace authentication

### Claims Management
- `GET /api/claims` - List organization claims
- `POST /api/claims` - Create new claim
- `GET /api/claims/:id` - Get claim details
- `PUT /api/claims/:id` - Update claim
- `PUT /api/claims/:id/status` - Update claim status

### Supporting Data
- `GET /api/patients` - List organization patients
- `GET /api/providers` - List organization providers
- `GET /api/insurers` - List available insurers
- `GET /api/dashboard/stats` - Dashboard KPI statistics

## License

Copyright © 2025 MedLink Claims Hub. All rights reserved.