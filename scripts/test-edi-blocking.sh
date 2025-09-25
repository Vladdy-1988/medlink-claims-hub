#!/bin/bash

# ========================================
# EDI Sandbox Blocking Test Script
# ========================================
# Tests that production EDI domains are properly blocked
# when EDI_MODE=sandbox is set
#
# Usage: bash scripts/test-edi-blocking.sh
# ========================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:5000"
ENDPOINT="/api/test-edi-block"

# Counter for tests
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     EDI Sandbox Blocking Test Suite    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check that EDI_MODE is set to sandbox
echo -e "${YELLOW}Environment Check:${NC}"
if [ "$EDI_MODE" == "sandbox" ]; then
    echo -e "  EDI_MODE: ${GREEN}sandbox ✓${NC}"
else
    echo -e "  EDI_MODE: ${RED}${EDI_MODE:-not set} (should be 'sandbox')${NC}"
    echo -e "  ${YELLOW}WARNING: Set EDI_MODE=sandbox to enable blocking${NC}"
fi

if [ -n "$OUTBOUND_ALLOWLIST" ]; then
    echo -e "  OUTBOUND_ALLOWLIST: ${BLUE}${OUTBOUND_ALLOWLIST}${NC}"
else
    echo -e "  OUTBOUND_ALLOWLIST: ${BLUE}default (sandbox.,test.,mock.,dev.,staging.)${NC}"
fi
echo ""

# Function to test a URL
test_url() {
    local url=$1
    local expected=$2  # "blocked" or "allowed"
    local description=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}Test #${TOTAL_TESTS}:${NC} ${description}"
    echo -e "  URL: ${url}"
    echo -n "  Expected: ${expected} | Result: "
    
    # Make the API call
    response=$(curl -s "${API_BASE}${ENDPOINT}?url=${url}" 2>/dev/null || echo '{"error":"Failed to connect"}')
    
    # Parse the response
    if echo "$response" | grep -q '"error"'; then
        echo -e "${RED}ERROR${NC}"
        echo -e "  ${RED}Error: $(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    # Check verdict
    blocked=$(echo "$response" | grep -o '"blocked":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    
    if [ "$expected" == "blocked" ]; then
        if [ "$blocked" == "true" ]; then
            echo -e "${GREEN}BLOCKED ✓${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}NOT BLOCKED ✗${NC}"
            echo -e "  ${RED}FAIL: Production domain was NOT blocked!${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        if [ "$blocked" == "false" ]; then
            echo -e "${GREEN}ALLOWED ✓${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}BLOCKED ✗${NC}"
            echo -e "  ${RED}FAIL: Allowed domain was blocked!${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
    
    # Show reason
    reason=$(echo "$response" | grep -o '"reason":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$reason" ]; then
        echo -e "  Reason: ${reason}"
    fi
    echo ""
}

# ========================================
# PRODUCTION DOMAINS - MUST BE BLOCKED
# ========================================
echo -e "${RED}═══ PRODUCTION DOMAINS (MUST BE BLOCKED) ═══${NC}"
echo ""

test_url "https://www.manulife.ca/" "blocked" "Manulife Canada (insurance)"
test_url "https://www.sunlife.ca/" "blocked" "Sun Life Canada (insurance)"
test_url "https://www.telus.com/" "blocked" "TELUS (telecom/health)"
test_url "https://www.canadalife.com/" "blocked" "Canada Life (insurance)"
test_url "https://www.desjardins.com/" "blocked" "Desjardins (insurance/banking)"
test_url "https://www.bluecross.ca/" "blocked" "Blue Cross Canada"
test_url "https://provider.medavie.ca/" "blocked" "Medavie Blue Cross Provider"
test_url "https://claims.greenshield.ca/" "blocked" "Green Shield Canada Claims"
test_url "https://www.wsib.on.ca/" "blocked" "WSIB Ontario"
test_url "https://www.worksafebc.com/" "blocked" "WorkSafeBC"

# ========================================
# SANDBOX DOMAINS - MUST BE ALLOWED
# ========================================
echo -e "${GREEN}═══ SANDBOX DOMAINS (MUST BE ALLOWED) ═══${NC}"
echo ""

test_url "https://sandbox.test/" "allowed" "Generic sandbox domain"
test_url "https://test.example.com/" "allowed" "Test subdomain"
test_url "https://dev.api.com/" "allowed" "Dev subdomain"
test_url "https://staging.service.io/" "allowed" "Staging subdomain"
test_url "http://localhost:5000/" "allowed" "Localhost with port"
test_url "http://127.0.0.1:3000/" "allowed" "IP localhost"
test_url "https://mock.insurance.ca/" "allowed" "Mock subdomain"

# ========================================
# EDGE CASES
# ========================================
echo -e "${YELLOW}═══ EDGE CASES ═══${NC}"
echo ""

test_url "https://api.manulife.ca/" "blocked" "Subdomain of blocked domain"
test_url "https://secure.sunlife.ca/" "blocked" "Another subdomain of blocked"
test_url "https://sandbox.manulife.ca/" "allowed" "Sandbox subdomain of blocked (should be allowed)"
test_url "https://test.sunlife.ca/" "allowed" "Test subdomain of blocked (should be allowed)"

# ========================================
# SUMMARY
# ========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}              TEST SUMMARY              ${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}EDI Sandbox blocking is working correctly.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ ${FAILED_TESTS} TESTS FAILED!${NC}"
    echo -e "${RED}EDI Sandbox blocking has issues that need fixing.${NC}"
    
    if [ "$EDI_MODE" != "sandbox" ]; then
        echo ""
        echo -e "${YELLOW}NOTE: EDI_MODE is not set to 'sandbox'.${NC}"
        echo -e "${YELLOW}Set EDI_MODE=sandbox before running this test.${NC}"
    fi
    
    exit 1
fi