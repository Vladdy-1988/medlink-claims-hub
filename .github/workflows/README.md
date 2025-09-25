# GitHub Actions CI/CD Pipeline

This directory contains the GitHub Actions workflows for continuous integration and deployment with security gates.

## Workflows

### 1. CI Workflow (`ci.yml`)
**Trigger:** Push to main/master/develop branches and pull requests

**Jobs:**
- **Test Job:**
  - Sets up Node.js v20
  - Installs dependencies with `npm ci`
  - Runs TypeScript type checking (`npx tsc --noEmit`)
  - Runs test suite (`npx vitest run`)
  - Checks for direct SQL usage outside approved locations
  - Builds the application
  - Uploads build artifacts

- **Security Checks Job:**
  - Runs npm audit for dependency vulnerabilities
  - Scans for exposed secrets with TruffleHog

### 2. CodeQL Security Analysis (`codeql.yml`)
**Trigger:** Push to main/master, pull requests, and weekly scheduled scan

**Features:**
- Analyzes JavaScript/TypeScript code for security vulnerabilities
- Uses extended security queries for comprehensive scanning
- Dependency review on pull requests
- License compliance checking
- Optional Semgrep security scanning

### 3. Deployment Readiness (`deployment-readiness.yml`)
**Trigger:** Manual workflow dispatch or push to main affecting core files

**Checks:**
- Type checking
- Database security layer verification
- Production build
- Health check validation using `scripts/uptime.sh`
- Vulnerability scanning with Trivy

## Scripts

### `scripts/check-direct-sql.sh`
Ensures all database operations go through the repository layer (`server/db/repo.ts`).

**Allowed exceptions:**
- Health checks (SELECT 1)
- Scripts directory (migrations, anonymization)
- Seed files
- Legacy storage.ts (marked for refactoring)

### `scripts/uptime.sh`
Health check script for the application.

**Usage:**
```bash
./scripts/uptime.sh
# or with custom URL
SERVICE_URL=https://myapp.com ./scripts/uptime.sh
```

**Exit codes:**
- 0: Service is healthy (HTTP 200)
- 1: Service is unhealthy or unreachable

## Setup Requirements

1. **GitHub Secrets** (optional but recommended):
   - `DATABASE_URL`: PostgreSQL connection string for deployment tests
   - `SEMGREP_APP_TOKEN`: Token for Semgrep security scanning (optional)

2. **Branch Protection** (recommended):
   - Require CI workflow to pass before merging
   - Require CodeQL security checks for main branch
   - Enable automatic security alerts

## Local Testing

Test the scripts locally:

```bash
# Test SQL security check
./scripts/check-direct-sql.sh

# Test health check
./scripts/uptime.sh

# Run tests
npx vitest run

# Type checking
npx tsc --noEmit
```

## Security Gates

The pipeline implements multiple security gates:

1. **Code Quality**: TypeScript type checking
2. **Test Coverage**: Automated test suite
3. **Database Security**: Prevents direct SQL access outside approved locations
4. **Dependency Security**: npm audit and dependency review
5. **Code Security**: CodeQL analysis for vulnerabilities
6. **Secret Detection**: TruffleHog scanning
7. **Container Security**: Trivy vulnerability scanning
8. **Health Validation**: Endpoint health checks

All gates must pass for successful CI/CD pipeline execution.