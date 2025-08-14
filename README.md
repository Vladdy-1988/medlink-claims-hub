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

The application is ready for deployment on Replit or any Node.js hosting platform. Ensure all environment variables are configured:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secure session encryption key
- `SSO_SHARED_SECRET`: Shared secret for marketplace SSO
- `ALLOWED_ORIGINS`: Comma-separated allowed CORS origins
- `VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`: Push notification keys

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