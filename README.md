# MedLink Claims Hub

A comprehensive healthcare claims management system built as a secure, installable PWA. Supports verified healthcare providers with role-based access, claims and pre-authorization management, file upload capabilities, offline functionality, and integration with insurance systems.

## Features

- 🏥 **Healthcare Provider Management**: Role-based access control (provider, billing, admin)
- 📋 **Claims Management**: Complete workflow from creation to payment tracking
- 🔐 **Pre-Authorization**: Support for treatment pre-approvals
- 📎 **File Attachments**: Secure document upload and management
- 🌐 **Offline Support**: PWA with offline capability and sync
- 🔌 **Insurance Integration**: Telus eClaims, CDAnet, and portal submission
- 📊 **Dashboard & Analytics**: Real-time KPIs and performance metrics
- 🔍 **Audit Logging**: Comprehensive compliance tracking
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile

## Tech Stack

### Frontend
- **React 18** with TypeScript and Vite for fast development
- **Radix UI** primitives with Tailwind CSS for consistent, accessible design
- **TanStack React Query** for server state management and caching
- **Wouter** for lightweight client-side routing
- **PWA** features with service worker for offline functionality
- **IndexedDB** integration for offline data persistence

### Backend
- **Node.js** with Express.js server framework
- **PostgreSQL** with Drizzle ORM for type-safe database operations
- **Replit Auth** integration with session management
- **Object Storage** abstraction for file handling
- **RESTful API** design with comprehensive error handling

### Infrastructure
- **PostgreSQL** with Neon serverless driver
- **Google Cloud Storage** for file attachments
- **Replit** deployment platform

## Quick Start on Replit

1. **Fork/Import this repository** to your Replit workspace

2. **Environment Setup**: The app will automatically configure required environment variables on Replit. For local development, copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Database Setup**:
   ```bash
   npm run db:push     # Push schema to database
   npm run db:seed     # Seed with sample data
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

The application will be available at the Replit URL or `http://localhost:5000` for local development.

## Available Scripts

### Root Level
- `npm run dev` - Start both web and API development servers
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run all tests (unit + API + e2e)
- `npm run lint` - Lint all code
- `npm run format` - Format code with Prettier

### Web (Frontend)
- `npm run web:dev` - Start frontend development server
- `npm run web:build` - Build frontend for production
- `npm run web:preview` - Preview production build
- `npm run web:test` - Run frontend unit tests

### API (Backend)
- `npm run api:dev` - Start backend development server with watch
- `npm run api:build` - Build backend for production
- `npm run api:start` - Start production backend server
- `npm run api:test` - Run API tests

### Database
- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes directly
- `npm run db:seed` - Seed database with sample data

### Testing
- `npm run test:unit` - Run unit tests
- `npm run test:api` - Run API integration tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:e2e:ui` - Run e2e tests with UI

## Project Structure

```
├── client/                 # Frontend React application
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── main.tsx       # Application entry point
│   └── index.html
├── server/                # Backend Express application
│   ├── integrations/      # Insurance system integrations
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database abstraction layer
│   ├── scheduler.ts       # Background job scheduler
│   ├── auditLogger.ts     # Compliance audit logging
│   └── index.ts           # Server entry point
├── shared/                # Shared TypeScript definitions
│   └── schema.ts          # Database schema and types
├── tests/                 # Test suites
│   ├── api/              # API integration tests
│   ├── unit/             # Unit tests
│   └── e2e/              # End-to-end tests
└── package.json
```

## Key Features

### Claims Management
- 3-step wizard interface for claim creation
- Real-time status tracking and updates
- File attachment support with auto-crop/deskew
- Multiple submission methods (API, portal upload)

### Insurance Integrations
- **Telus eClaims**: Direct API integration (stub implementation with TODOs)
- **CDAnet**: Dental claims processing (stub implementation with TODOs)
- **Portal Upload**: Manual submission workflow tracking

### Offline Functionality
- PWA with offline claim creation
- IndexedDB for local storage
- Background sync when connection restored
- Offline banner with sync status

### Security & Compliance
- Role-based access control
- Comprehensive audit logging
- PHI data protection and redaction
- Session management with secure cookies

### Testing
- **Unit Tests**: Component and utility function testing
- **API Tests**: Integration testing with Supertest
- **E2e Tests**: Complete workflow testing with Playwright

## Development Guidelines

### Adding New Features
1. Define data models in `shared/schema.ts`
2. Create database operations in `server/storage.ts`
3. Add API routes in `server/routes.ts`
4. Build UI components in `client/src/components/`
5. Add comprehensive tests

### Insurance Integration
The system includes stub implementations for major insurance providers:
- See `server/integrations/` for implementation templates
- Replace TODO comments with actual API integrations
- Follow the established patterns for error handling and audit logging

### Database Changes
```bash
# Make schema changes in shared/schema.ts
npm run db:push    # Push to development database
npm run db:generate # Generate migration files for production
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run the full test suite
5. Submit a pull request

## Security Considerations

- All PHI data is properly redacted in audit logs
- File uploads are secured with object storage ACLs
- API endpoints require authentication
- Role-based access controls are enforced
- Session data is encrypted and stored securely

## Support

For technical support or questions:
- Check the issue tracker
- Review the documentation
- Contact the development team

## License

MIT License - see LICENSE file for details.