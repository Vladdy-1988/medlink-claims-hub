#!/bin/bash

# CI script to check for direct HTTP usage violations
# Exit with error if violations found

set -e

echo "================================================================"
echo "Checking for direct HTTP usage violations..."
echo "================================================================"

VIOLATIONS=0
VIOLATION_FILES=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "Checking for direct fetch() usage outside allowlist.ts..."
echo "----------------------------------------------------------------"

# Check for direct fetch() usage outside allowlist.ts
# Exclude:
# - server/net/allowlist.ts itself
# - server/index.ts (where we patch global fetch)
# - test files
# - node_modules
# - client files (frontend is allowed to use fetch)
# - public folder (contains client-side service workers)
FETCH_VIOLATIONS=$(grep -r "fetch(" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=client \
  --exclude-dir=tests \
  --exclude-dir=.git \
  --exclude-dir=public \
  server/ 2>/dev/null | \
  grep -v "server/net/allowlist.ts" | \
  grep -v "server/index.ts" | \
  grep -v "server/public" | \
  grep -v "safeFetch" | \
  grep -v "// CI-OK: fetch" || true)

if [ ! -z "$FETCH_VIOLATIONS" ]; then
  echo -e "${RED}❌ Found direct fetch() usage:${NC}"
  echo "$FETCH_VIOLATIONS"
  VIOLATIONS=$((VIOLATIONS + 1))
  VIOLATION_FILES="$VIOLATION_FILES
Direct fetch() usage:
$FETCH_VIOLATIONS"
else
  echo -e "${GREEN}✅ No direct fetch() usage found${NC}"
fi

echo ""
echo "Checking for direct axios imports outside httpClient.ts..."
echo "----------------------------------------------------------------"

# Check for direct axios imports outside httpClient.ts
# Look for: import axios, require('axios'), from 'axios'
AXIOS_VIOLATIONS=$(grep -r "from ['\"]axios['\"]" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=client \
  --exclude-dir=tests \
  --exclude-dir=.git \
  server/ 2>/dev/null | \
  grep -v "server/net/httpClient.ts" | \
  grep -v "// CI-OK: axios" || true)

AXIOS_REQUIRE_VIOLATIONS=$(grep -r "require(['\"]axios['\"])" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=client \
  --exclude-dir=tests \
  --exclude-dir=.git \
  server/ 2>/dev/null | \
  grep -v "server/net/httpClient.ts" | \
  grep -v "// CI-OK: axios" || true)

AXIOS_IMPORT_VIOLATIONS=$(grep -r "import axios" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=client \
  --exclude-dir=tests \
  --exclude-dir=.git \
  server/ 2>/dev/null | \
  grep -v "server/net/httpClient.ts" | \
  grep -v "// CI-OK: axios" || true)

ALL_AXIOS="$AXIOS_VIOLATIONS$AXIOS_REQUIRE_VIOLATIONS$AXIOS_IMPORT_VIOLATIONS"

if [ ! -z "$ALL_AXIOS" ]; then
  echo -e "${RED}❌ Found direct axios imports:${NC}"
  echo "$ALL_AXIOS"
  VIOLATIONS=$((VIOLATIONS + 1))
  VIOLATION_FILES="$VIOLATION_FILES
Direct axios imports:
$ALL_AXIOS"
else
  echo -e "${GREEN}✅ No direct axios imports found${NC}"
fi

echo ""
echo "Checking for direct http/https module usage..."
echo "----------------------------------------------------------------"

# Check for direct http/https module usage (Node.js built-in modules)
# Exclude allowlist.ts where we wrap these
HTTP_VIOLATIONS=$(grep -r "http\.request\|https\.request\|http\.get\|https\.get" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=client \
  --exclude-dir=tests \
  --exclude-dir=.git \
  server/ 2>/dev/null | \
  grep -v "server/net/allowlist.ts" | \
  grep -v "safeHttp" | \
  grep -v "// CI-OK: http" || true)

if [ ! -z "$HTTP_VIOLATIONS" ]; then
  echo -e "${YELLOW}⚠️  Found direct http/https module usage:${NC}"
  echo "$HTTP_VIOLATIONS"
  echo -e "${YELLOW}Consider using safeFetch or safeHttpRequest instead${NC}"
  # Not counting as violation since Node.js modules are harder to patch
else
  echo -e "${GREEN}✅ No direct http/https module usage found${NC}"
fi

echo ""
echo "================================================================"
echo "SUMMARY"
echo "================================================================"

if [ $VIOLATIONS -gt 0 ]; then
  echo -e "${RED}❌ FAILED: Found $VIOLATIONS violation type(s)${NC}"
  echo ""
  echo "Violations found:"
  echo "$VIOLATION_FILES"
  echo ""
  echo "To fix:"
  echo "1. Replace direct fetch() with safeFetch from './net/allowlist'"
  echo "2. Replace direct axios imports with httpClient from './net/httpClient'"
  echo "3. Add '// CI-OK: fetch' or '// CI-OK: axios' comment if usage is intentional"
  echo ""
  echo "Example fixes:"
  echo "  import { safeFetch } from './net/allowlist';"
  echo "  const response = await safeFetch(url);"
  echo ""
  echo "  import httpClient from './net/httpClient';"
  echo "  const response = await httpClient.get(url);"
  exit 1
else
  echo -e "${GREEN}✅ PASSED: No HTTP usage violations found${NC}"
  echo "All HTTP requests are properly controlled through allowlist"
fi

echo ""
echo "Note: This script checks server-side code only."
echo "Client-side code is not restricted."
echo ""