# MedLink Claims Hub - Staging Environment Runbook

## Table of Contents
1. [Deployment Procedures](#deployment-procedures)
2. [Rollback Procedures](#rollback-procedures)
3. [Feature Flag Management](#feature-flag-management)
4. [Monitoring and Alerts](#monitoring-and-alerts)
5. [Troubleshooting Common Issues](#troubleshooting-common-issues)
6. [Emergency Contacts](#emergency-contacts)

---

## Deployment Procedures

### Pre-Deployment Checklist
- [ ] All tests passing in CI/CD pipeline
- [ ] Database migrations reviewed and tested
- [ ] Environment variables configured in staging
- [ ] Security scan completed (no critical vulnerabilities)
- [ ] Load testing results acceptable
- [ ] Rollback plan documented

### Standard Deployment Process

1. **Prepare Environment Variables**
   ```bash
   # Copy and configure staging environment
   cp config/staging.env.example .env.staging
   # Edit .env.staging with actual values
   ```

2. **Database Migration**
   ```bash
   # Run database migrations
   npm run db:push
   
   # Verify migration success
   npm run db:check
   ```

3. **Build Application**
   ```bash
   # Install dependencies
   npm ci
   
   # Build production assets
   npm run build
   ```

4. **Deploy Application**
   ```bash
   # Deploy to staging
   ./deploy-staging.sh
   
   # Verify deployment
   ./scripts/smoke.sh https://staging.medlink.com
   ```

5. **Post-Deployment Verification**
   ```bash
   # Run smoke tests
   ./scripts/smoke.sh $STAGING_BASE_URL
   
   # Check application logs
   npm run logs:staging
   
   # Verify health endpoint
   curl -s $STAGING_BASE_URL/healthz | jq
   ```

### Blue-Green Deployment (Recommended)
1. Deploy to inactive environment (Blue/Green)
2. Run smoke tests against inactive environment
3. Switch load balancer to new environment
4. Monitor for 15 minutes
5. If issues detected, switch back immediately

---

## Rollback Procedures

### Immediate Rollback (< 5 minutes)
1. **Switch to Previous Version**
   ```bash
   # Revert to previous deployment
   git checkout [PREVIOUS_STABLE_TAG]
   
   # Redeploy previous version
   ./deploy-rollback.sh
   ```

2. **Verify Rollback**
   ```bash
   # Check version
   curl $STAGING_BASE_URL/api/version
   
   # Run smoke tests
   ./scripts/smoke.sh $STAGING_BASE_URL
   ```

### Database Rollback
1. **Check Migration Status**
   ```bash
   # View migration history
   npm run db:status
   ```

2. **Rollback Last Migration**
   ```bash
   # Rollback one migration
   npm run db:rollback
   
   # Verify database state
   npm run db:check
   ```

3. **Data Recovery (if needed)**
   ```bash
   # Restore from backup
   ./scripts/restore-db.sh staging [BACKUP_TIMESTAMP]
   ```

### Rollback Decision Matrix
| Issue Severity | User Impact | Action | Timeline |
|---------------|-------------|---------|----------|
| Critical | > 50% users | Immediate rollback | < 5 min |
| High | 20-50% users | Assess & rollback | < 15 min |
| Medium | < 20% users | Fix forward or rollback | < 30 min |
| Low | Minimal | Fix forward | Next release |

---

## Feature Flag Management

### Available Feature Flags
| Flag Name | Description | Default | Impact |
|-----------|-------------|---------|--------|
| `FEATURE_FLAG_NEW_UI` | New UI components | false | Frontend only |
| `FEATURE_FLAG_ADVANCED_ANALYTICS` | Advanced analytics dashboard | false | Performance impact |
| `FEATURE_FLAG_BULK_OPERATIONS` | Bulk claim operations | false | Backend load |

### Managing Feature Flags

1. **Enable Feature Flag**
   ```bash
   # Update .env.staging
   export FEATURE_FLAG_NEW_UI=true
   
   # Restart application
   npm run restart:staging
   ```

2. **Monitor Feature Impact**
   ```bash
   # Check feature usage
   npm run metrics:feature-flags
   
   # Monitor performance
   npm run metrics:performance
   ```

3. **Progressive Rollout**
   - Start with 5% of users
   - Monitor for 24 hours
   - Increase to 25%, 50%, 100%
   - Full rollout after 72 hours stable

---

## Monitoring and Alerts

### Health Checks
- **Endpoint**: `/healthz`
- **Frequency**: Every 30 seconds
- **Timeout**: 5 seconds
- **Failure Threshold**: 3 consecutive failures

### Key Metrics to Monitor
1. **Application Metrics**
   - Response time (p50, p95, p99)
   - Error rate (< 1% threshold)
   - Request rate
   - Active sessions

2. **Infrastructure Metrics**
   - CPU usage (< 80% threshold)
   - Memory usage (< 90% threshold)
   - Disk usage (< 85% threshold)
   - Network I/O

3. **Business Metrics**
   - Successful logins/hour
   - Claims processed/hour
   - EDI transactions/hour
   - Failed transactions

### Alert Configuration
| Alert | Threshold | Action | Escalation |
|-------|-----------|--------|------------|
| High Error Rate | > 5% for 5 min | Investigate logs | Page on-call |
| Response Time | p95 > 2s for 10 min | Check load | Email team |
| Database Connection | Failed for 2 min | Check DB status | Page DBA |
| Disk Space | > 85% | Clean logs/temp | Email ops |
| Memory Leak | Growth > 10%/hour | Restart app | Page on-call |

### Monitoring Commands
```bash
# View real-time logs
npm run logs:staging --follow

# Check application metrics
npm run metrics:app

# Database performance
npm run metrics:db

# Error tracking (Sentry)
npm run sentry:issues
```

---

## Troubleshooting Common Issues

### Issue: Application Won't Start
**Symptoms**: 502 Bad Gateway, service not responding
```bash
# Check logs
npm run logs:staging --lines=100

# Verify environment variables
npm run env:check

# Check port availability
lsof -i :5000

# Restart service
npm run restart:staging
```

### Issue: Database Connection Errors
**Symptoms**: "Cannot connect to database" errors
```bash
# Test database connection
npm run db:test

# Check connection pool
npm run db:pool-status

# Verify DATABASE_URL
echo $DATABASE_URL | sed 's/:[^:@]*@/:****@/'

# Reset connections
npm run db:reset-connections
```

### Issue: High Memory Usage
**Symptoms**: Application slow, memory warnings
```bash
# Check memory usage
npm run metrics:memory

# Generate heap dump
npm run heap:dump

# Analyze heap
npm run heap:analyze

# Restart with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npm run start
```

### Issue: Authentication Failures
**Symptoms**: Users cannot log in
```bash
# Check JWT configuration
npm run auth:verify-config

# Test authentication endpoint
curl -X POST $STAGING_BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Clear session store
npm run sessions:clear

# Verify MFA configuration
npm run mfa:status
```

### Issue: EDI Connection Problems
**Symptoms**: EDI transactions failing
```bash
# Check EDI mode
npm run edi:status

# Test EDI connectivity
npm run edi:test-connection

# View EDI logs
npm run logs:edi

# Reset EDI sandbox
npm run edi:reset-sandbox
```

### Issue: Performance Degradation
**Symptoms**: Slow response times, timeouts
```bash
# Run performance diagnostics
npm run perf:diagnose

# Check database queries
npm run db:slow-queries

# Review cache hit rates
npm run cache:stats

# Enable profiling
NODE_ENV=staging npm run profile:start
```

---

## Emergency Contacts

### Escalation Path
1. **Level 1 - Development Team**
   - Primary: [DEV_LEAD_PLACEHOLDER]
   - Secondary: [SR_DEV_PLACEHOLDER]
   - Slack: #medlink-dev-oncall
   - Response Time: < 15 minutes

2. **Level 2 - DevOps/Infrastructure**
   - Primary: [DEVOPS_LEAD_PLACEHOLDER]
   - Secondary: [INFRA_ENGINEER_PLACEHOLDER]
   - PagerDuty: staging-infrastructure
   - Response Time: < 10 minutes

3. **Level 3 - Management**
   - Engineering Manager: [ENG_MANAGER_PLACEHOLDER]
   - Product Owner: [PRODUCT_OWNER_PLACEHOLDER]
   - Email: medlink-escalation@company.com
   - Response Time: < 30 minutes

### External Support
- **Database Support**
  - Provider: Neon Database
  - Support Portal: [SUPPORT_URL_PLACEHOLDER]
  - Emergency: [PHONE_PLACEHOLDER]

- **Hosting/Infrastructure**
  - Provider: Replit
  - Support: support@replit.com
  - Status Page: status.replit.com

- **Security Incidents**
  - Security Team: security@company.com
  - Incident Hotline: [SECURITY_PHONE_PLACEHOLDER]
  - Follow: Security Incident Response Plan (SIR-001)

### Communication Channels
- **Incident Channel**: #incident-response
- **Status Page**: status.medlink.com
- **Customer Communication**: support@medlink.com

### Runbook Maintenance
- **Last Updated**: [DATE_PLACEHOLDER]
- **Review Schedule**: Monthly
- **Owner**: DevOps Team
- **Version**: 1.0.0

---

## Quick Reference Card

### Critical Commands
```bash
# Emergency restart
npm run restart:staging --force

# View errors (last hour)
npm run logs:errors --since="1 hour ago"

# Database health check
npm run db:health

# Full system diagnostic
npm run diagnose:all

# Generate incident report
npm run incident:report --output=./reports/
```

### Staging URLs
- Application: https://staging.medlink.com
- Health Check: https://staging.medlink.com/healthz
- Metrics: https://staging.medlink.com/metrics
- Admin Panel: https://staging.medlink.com/admin

### Environment Files
- Configuration: `/config/staging.env.example`
- Active Config: `.env.staging`
- Secrets: Managed via environment variables

### Log Locations
- Application: `/var/log/medlink/app.log`
- Error: `/var/log/medlink/error.log`
- Access: `/var/log/medlink/access.log`
- EDI: `/var/log/medlink/edi.log`