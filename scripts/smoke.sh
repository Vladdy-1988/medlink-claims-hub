#!/bin/bash

# MedLink Claims Hub - Staging Smoke Tests
# Usage: ./scripts/smoke.sh [STAGING_BASE_URL]
# Example: ./scripts/smoke.sh https://staging.medlink.com
# Default: http://localhost:5000

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
BASE_URL="${1:-http://localhost:5000}"
TIMEOUT=10
VERBOSE="${VERBOSE:-false}"

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test results array
declare -a TEST_RESULTS

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} ${message}"
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗${NC} ${message}"
    elif [ "$status" = "INFO" ]; then
        echo -e "${BLUE}ℹ${NC} ${message}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} ${message}"
    else
        echo -e "${message}"
    fi
}

# Function to perform HTTP request and validate response
http_test() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local data="${4:-}"
    local description="${5:-$method $endpoint}"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    local url="${BASE_URL}${endpoint}"
    local response
    local http_status
    local response_body
    local test_start=$(date +%s%N)
    
    # Build curl command
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method"
    curl_cmd="$curl_cmd --connect-timeout $TIMEOUT"
    curl_cmd="$curl_cmd --max-time $((TIMEOUT * 2))"
    curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    # Execute request
    if [ "$VERBOSE" = "true" ]; then
        print_status "INFO" "Executing: $curl_cmd"
    fi
    
    response=$(eval $curl_cmd 2>/dev/null || echo "CURL_ERROR")
    
    # Calculate response time
    local test_end=$(date +%s%N)
    local response_time=$(( (test_end - test_start) / 1000000 ))
    
    if [ "$response" = "CURL_ERROR" ]; then
        print_status "FAIL" "$description - Connection error (${response_time}ms)"
        TEST_RESULTS+=("FAIL|$description|Connection error")
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    # Extract status code and body
    http_status=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    # Validate status code
    if [ "$http_status" = "$expected_status" ]; then
        print_status "PASS" "$description - Status: $http_status (${response_time}ms)"
        TEST_RESULTS+=("PASS|$description|$http_status")
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        if [ "$VERBOSE" = "true" ] && [ -n "$response_body" ]; then
            echo "  Response: $(echo $response_body | jq -c '.' 2>/dev/null || echo $response_body)"
        fi
        
        echo "$response_body"
        return 0
    else
        print_status "FAIL" "$description - Expected: $expected_status, Got: $http_status (${response_time}ms)"
        TEST_RESULTS+=("FAIL|$description|Expected $expected_status, got $http_status")
        TESTS_FAILED=$((TESTS_FAILED + 1))
        
        if [ "$VERBOSE" = "true" ] && [ -n "$response_body" ]; then
            echo "  Error Response: $(echo $response_body | jq -c '.' 2>/dev/null || echo $response_body)"
        fi
        
        return 1
    fi
}

# Function to validate JSON field
validate_json_field() {
    local json=$1
    local field=$2
    local expected_value=$3
    local description=$4
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    local actual_value=$(echo "$json" | jq -r "$field" 2>/dev/null)
    
    if [ "$actual_value" = "$expected_value" ]; then
        print_status "PASS" "$description - $field = $expected_value"
        TEST_RESULTS+=("PASS|$description|$field = $expected_value")
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_status "FAIL" "$description - Expected $field = $expected_value, Got: $actual_value"
        TEST_RESULTS+=("FAIL|$description|Expected $field = $expected_value, got $actual_value")
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to generate test data
generate_test_user() {
    echo '{
        "email": "smoketest_'$(date +%s)'@test.com",
        "password": "Test123!@#"
    }'
}

generate_test_claim() {
    echo '{
        "patientId": "TEST_PATIENT_'$(date +%s)'",
        "providerId": "TEST_PROVIDER_001",
        "serviceDate": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "serviceType": "general_consultation",
        "amount": 150.00,
        "insuranceId": "TEST_INS_001",
        "status": "draft",
        "items": [
            {
                "code": "99213",
                "description": "Office visit - established patient",
                "quantity": 1,
                "amount": 150.00
            }
        ]
    }'
}

# Main test execution
main() {
    echo -e "${BOLD}================================================${NC}"
    echo -e "${BOLD}MedLink Claims Hub - Staging Smoke Tests${NC}"
    echo -e "${BOLD}================================================${NC}"
    echo ""
    print_status "INFO" "Target URL: $BASE_URL"
    print_status "INFO" "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo ""
    echo -e "${BOLD}Running Tests...${NC}"
    echo ""
    
    # Test 1: Health Check
    print_status "INFO" "Test Suite: Health Check"
    health_response=$(http_test "GET" "/healthz" "200" "" "Health check endpoint") || true
    
    if [ -n "$health_response" ] && [ "$health_response" != "CURL_ERROR" ]; then
        validate_json_field "$health_response" ".status" "healthy" "Health status validation" || true
        validate_json_field "$health_response" ".db.ok" "true" "Database connection validation" || true
    fi
    
    echo ""
    
    # Test 2: Authentication
    print_status "INFO" "Test Suite: Authentication"
    
    # First, try to create a test user (might fail if user exists, that's okay)
    test_user=$(generate_test_user)
    
    # Try login with test credentials
    auth_response=$(http_test "POST" "/api/auth/login" "200" "$test_user" "User login") || {
        # If login fails with 200, try with 401 (expected for non-existent user)
        print_status "WARN" "Login returned non-200, trying synthetic fallback user"
        fallback_user='{"email":"test@example.com","password":"TestPassword123!"}'
        auth_response=$(http_test "POST" "/api/auth/login" "200" "$fallback_user" "User login (fallback)") || {
            print_status "WARN" "Authentication test using fallback - endpoint may require valid credentials"
        }
    }
    
    echo ""
    
    # Test 3: Claims API
    print_status "INFO" "Test Suite: Claims API"
    
    # Create a test claim
    test_claim=$(generate_test_claim)
    claim_response=$(http_test "POST" "/api/claims" "201" "$test_claim" "Create claim") || {
        print_status "WARN" "Claim creation failed - may require authentication"
        claim_response=""
    }
    
    # If claim was created, try to retrieve it
    if [ -n "$claim_response" ] && [ "$claim_response" != "CURL_ERROR" ]; then
        claim_id=$(echo "$claim_response" | jq -r '.id' 2>/dev/null || echo "")
        
        if [ -n "$claim_id" ] && [ "$claim_id" != "null" ]; then
            http_test "GET" "/api/claims/$claim_id" "200" "" "Retrieve claim by ID" || true
        else
            print_status "WARN" "Could not extract claim ID from response"
            # Try with a synthetic ID
            http_test "GET" "/api/claims/test-claim-001" "200" "" "Retrieve claim (synthetic ID)" || {
                print_status "WARN" "Claim retrieval failed - endpoint may require valid claim ID"
            }
        fi
    else
        # Try to list claims as a fallback test
        http_test "GET" "/api/claims" "200" "" "List claims" || {
            print_status "WARN" "Claims listing failed - may require authentication"
        }
    fi
    
    echo ""
    echo -e "${BOLD}================================================${NC}"
    echo -e "${BOLD}Test Summary${NC}"
    echo -e "${BOLD}================================================${NC}"
    echo ""
    
    # Print summary statistics
    print_status "INFO" "Total Tests: $TESTS_TOTAL"
    print_status "INFO" "Passed: $TESTS_PASSED"
    print_status "INFO" "Failed: $TESTS_FAILED"
    
    # Calculate pass rate
    if [ $TESTS_TOTAL -gt 0 ]; then
        PASS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))
        echo ""
        if [ $PASS_RATE -ge 80 ]; then
            print_status "PASS" "Pass Rate: ${PASS_RATE}% ✓"
        elif [ $PASS_RATE -ge 60 ]; then
            print_status "WARN" "Pass Rate: ${PASS_RATE}% ⚠"
        else
            print_status "FAIL" "Pass Rate: ${PASS_RATE}% ✗"
        fi
    fi
    
    echo ""
    
    # Print detailed results if verbose
    if [ "$VERBOSE" = "true" ] && [ ${#TEST_RESULTS[@]} -gt 0 ]; then
        echo -e "${BOLD}Detailed Results:${NC}"
        for result in "${TEST_RESULTS[@]}"; do
            IFS='|' read -r status desc detail <<< "$result"
            if [ "$status" = "PASS" ]; then
                echo -e "  ${GREEN}✓${NC} $desc"
            else
                echo -e "  ${RED}✗${NC} $desc - $detail"
            fi
        done
        echo ""
    fi
    
    # Exit code based on test results
    if [ $TESTS_FAILED -eq 0 ]; then
        print_status "PASS" "All smoke tests passed! 🎉"
        exit 0
    else
        print_status "FAIL" "Some tests failed. Please review the results above."
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}Error: Missing required dependencies:${NC}"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo ""
        echo "Please install the missing dependencies and try again."
        exit 1
    fi
}

# Script entry point
check_dependencies

# Parse additional flags
while [[ $# -gt 1 ]]; do
    case "$2" in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --timeout|-t)
            TIMEOUT="$3"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Run main tests
main "$@"