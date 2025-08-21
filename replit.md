# MedLink Claims Hub

## Overview

MedLink Claims Hub is a secure, installable Progressive Web App (PWA) for healthcare providers to submit and track pre-authorizations and claims. The application provides a comprehensive claims management system with offline support, file attachments, status tracking, and role-based access control. Built as a full-stack TypeScript application, it features a React frontend with Vite bundling and an Express.js backend with PostgreSQL database integration.

**Recent Progress (August 2025)**: Successfully completed full application integration and testing. Migrated from SQLite to PostgreSQL (Neon) with complete Drizzle migration infrastructure. Implemented comprehensive UI components including ClaimWizard, DashboardKpis, ClaimsTable, and ClaimTimeline. Enhanced PWA features with push notifications, install prompts, and offline IndexedDB synchronization. All core pages integrated with proper data flow, error handling, and authentication. Added SSO handshake functionality for marketplace integration with JWT-based shared-secret authentication, CORS configuration, and audit logging. Application successfully tested and verified functional at http://localhost:5000.

**August 20, 2025**: Fixed preview window rendering issues and made insurers API accessible for development. Added 24 proper Canadian insurance companies to database (Manulife Financial, Sun Life Financial, Blue Cross Canada, Desjardins Group, GreenShield Canada, etc.) replacing previous US insurers. Resolved TypeScript compilation errors in ClaimWizard component. Preview window now working correctly in Replit development environment.

**August 21, 2025**: Implemented comprehensive Jest and Playwright test suites for production readiness. Created test files for auth guards, claims API, and file upload flows. Added E2E tests for offline functionality. Reduced TypeScript compilation errors from 129 to 92. Test infrastructure fully operational with 6 Jest tests passing. Created run-tests.sh script for easy test execution without modifying package.json. Updated vitest configuration to include API tests.

**August 21, 2025 (Security Update)**: Successfully implemented baseline production security features:
- **CSRF Protection**: Double-submit cookie pattern with automatic token generation and validation
- **Rate Limiting**: Tiered rate limits for auth (10/min), uploads (60/min), connectors (60/min), and general API (300/min)
- **Security Headers**: Comprehensive CSP configuration with Helmet middleware
- **CORS Configuration**: Restricted origins with proper credentials handling
- **PHI-Safe Logging**: Request logging with automatic redaction of sensitive data
- **Health Checks**: Standard /healthz and /readyz endpoints for monitoring
All security modules integrated into main server architecture with development mode bypasses.

**August 21, 2025 (Canada-Wide Features)**: Implemented comprehensive Canada-wide compliance and portal integration features:
- **Quebec Law 25 Compliance**: Added privacy officer designation fields (name, email), data retention policy management (default 7 years/2555 days), and privacy contact URL tracking
- **Provincial Support**: Added province field to organizations with full Canadian provincial/territorial dropdown
- **Language Preferences**: Bilingual support (English/French) at both organization and user levels with proper preference cascading
- **Portal Integration Tracking**: Added portal reference number and submission date fields to claims for WCB/WSIB integration
- **UI Updates**: Enhanced Settings page with Privacy & Compliance section, integrated language selectors, and provincial selection
All features successfully integrated into database schema and UI components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript and Vite for fast development and bundling
- **UI Components**: Radix UI primitives with Tailwind CSS for consistent, accessible design
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **PWA Features**: Service worker implementation for offline functionality and app installation
- **Offline Storage**: IndexedDB integration for draft claims and background sync queue

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth integration with session management and role-based access control
- **File Handling**: Object storage abstraction supporting local development and cloud storage (Google Cloud Storage/S3-compatible)
- **API Design**: RESTful endpoints with comprehensive error handling and audit logging

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless driver for production scalability
- **ORM**: Drizzle with migrations support for schema management
- **Session Storage**: PostgreSQL-backed session store for secure authentication
- **Offline Storage**: Browser IndexedDB for draft claims and background sync operations
- **File Storage**: Abstracted object storage with presigned URL support for secure file uploads

### Authentication and Authorization
- **Primary Auth**: Replit OIDC authentication with JWT token management
- **Session Management**: Secure HTTP-only cookies with PostgreSQL session storage
- **Role-Based Access**: Multi-tier permissions (provider, billing, admin roles)
- **Security Features**: Audit logging, IP tracking, and user agent monitoring for all operations

## External Dependencies

### Database and Storage
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for file attachments with ACL-based access control
- **Drizzle Kit**: Database migration and schema management toolkit

### Authentication Services
- **Replit Auth**: OIDC provider integration for user authentication
- **OpenID Client**: Standards-compliant OIDC client implementation

### Frontend Libraries
- **Radix UI**: Comprehensive accessible component primitives for forms, dialogs, and navigation
- **TanStack React Query**: Server state management with caching and background updates
- **Uppy**: File upload handling with drag-and-drop, progress tracking, and AWS S3 integration
- **IDB**: IndexedDB wrapper for offline data persistence

### Development and Deployment
- **Vite**: Fast development server and production build tool with React plugin
- **TypeScript**: Static type checking across frontend and backend
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **ESBuild**: Fast JavaScript bundler for server-side code compilation

### Monitoring and Analytics
- **Audit Logging**: Custom implementation for tracking all user actions and system events
- **Error Handling**: Comprehensive error boundary and logging system for debugging