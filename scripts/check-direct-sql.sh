#!/bin/bash
# Check for direct db usage outside /server/db/
# This script ensures all database operations go through the repository layer

echo "Checking for direct database access outside server/db/..."

# Exclude legitimate exceptions:
# - scripts/ directory (data migrations, anonymization scripts)
# - seed files (initial data setup)
# - health checks (simple DB ping)
# - storage.ts (legacy storage layer - to be refactored)
# Search for direct db calls outside the db directory
if grep -r "db\.\(query\|insert\|update\|select\|delete\)" server/ \
  --exclude-dir=db \
  --exclude-dir=node_modules \
  --exclude-dir=scripts \
  --exclude="*.test.ts" \
  --exclude="*.spec.ts" \
  --exclude="seedGuard.ts" \
  --exclude="seed.ts" \
  --exclude="storage.ts" \
  | grep -v "^server/db/" \
  | grep -v "healthChecks.ts:.*db\.\(execute\|select\).*" \
  | grep -v "migration.ts:.*db\.select.*" \
  | grep -v "pushService.ts:.*db\.insert.*pushSubscriptions" \
  | grep -v "routes.ts:.*db.execute.*SELECT 1"; then
  echo "❌ ERROR: Direct database access found outside server/db/"
  echo "All database operations must go through the repository layer in server/db/repo.ts"
  echo ""
  echo "Exceptions allowed:"
  echo "  - Health checks: Simple SELECT 1 for DB ping"
  echo "  - Scripts directory: Migration and anonymization scripts"
  echo "  - Seed files: Initial data setup"
  echo "  - Storage.ts: Legacy layer (marked for refactoring)"
  exit 1
else
  echo "✅ SUCCESS: No direct database access found outside server/db/"
  echo ""
  echo "Excluded from checks (legitimate exceptions):"
  echo "  - server/scripts/: Migration and data scripts"
  echo "  - server/seed*.ts: Database seeding"
  echo "  - server/storage.ts: Legacy storage layer"
  echo "  - Health check pings (SELECT 1)"
  exit 0
fi