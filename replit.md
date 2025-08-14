# MedLink Claims Hub

## Overview

MedLink Claims Hub is a secure, installable Progressive Web App (PWA) for healthcare providers to submit and track pre-authorizations and claims. The application provides a comprehensive claims management system with offline support, file attachments, status tracking, and role-based access control. Built as a full-stack TypeScript application, it features a React frontend with Vite bundling and an Express.js backend with PostgreSQL database integration.

**Recent Progress (August 2025)**: Successfully completed full application integration and testing. Migrated from SQLite to PostgreSQL (Neon) with complete Drizzle migration infrastructure. Implemented comprehensive UI components including ClaimWizard, DashboardKpis, ClaimsTable, and ClaimTimeline. Enhanced PWA features with push notifications, install prompts, and offline IndexedDB synchronization. All core pages integrated with proper data flow, error handling, and authentication. Added SSO handshake functionality for marketplace integration with JWT-based shared-secret authentication, CORS configuration, and audit logging. Application successfully tested and verified functional at http://localhost:5000.

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