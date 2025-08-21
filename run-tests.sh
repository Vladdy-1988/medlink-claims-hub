#!/bin/bash

# MedLink Claims Hub - Test Runner Script
# This script runs all tests without modifying package.json

echo "🧪 MedLink Claims Hub - Test Suite Runner"
echo "========================================="

# Set test environment
export NODE_ENV=test

# Function to run API tests
run_api_tests() {
    echo ""
    echo "📋 Running API Tests with Vitest..."
    echo "-----------------------------------"
    npx vitest run --dir tests/api --reporter=verbose
    API_TEST_RESULT=$?
    echo "✅ API Tests completed with exit code: $API_TEST_RESULT"
    return $API_TEST_RESULT
}

# Function to run E2E tests
run_e2e_tests() {
    echo ""
    echo "🌐 Running E2E Tests with Playwright..."
    echo "---------------------------------------"
    npx playwright test --reporter=list
    E2E_TEST_RESULT=$?
    echo "✅ E2E Tests completed with exit code: $E2E_TEST_RESULT"
    return $E2E_TEST_RESULT
}

# Function to check TypeScript errors
check_typescript() {
    echo ""
    echo "📝 Checking TypeScript Compilation..."
    echo "-------------------------------------"
    npx tsc --noEmit
    TS_RESULT=$?
    echo "✅ TypeScript check completed with exit code: $TS_RESULT"
    return $TS_RESULT
}

# Main execution
case "${1:-all}" in
    api)
        run_api_tests
        ;;
    e2e)
        run_e2e_tests
        ;;
    ts)
        check_typescript
        ;;
    all)
        echo "Running complete test suite..."
        
        # Check TypeScript first
        check_typescript
        TS_EXIT=$?
        
        # Run API tests
        run_api_tests
        API_EXIT=$?
        
        # Run E2E tests
        run_e2e_tests
        E2E_EXIT=$?
        
        echo ""
        echo "========================================="
        echo "📊 Test Summary:"
        echo "  TypeScript: $([ $TS_EXIT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
        echo "  API Tests: $([ $API_EXIT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
        echo "  E2E Tests: $([ $E2E_EXIT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
        echo "========================================="
        
        # Exit with error if any test failed
        if [ $TS_EXIT -ne 0 ] || [ $API_EXIT -ne 0 ] || [ $E2E_EXIT -ne 0 ]; then
            exit 1
        fi
        ;;
    *)
        echo "Usage: ./run-tests.sh [api|e2e|ts|all]"
        echo "  api - Run API tests only"
        echo "  e2e - Run E2E tests only"
        echo "  ts  - Check TypeScript only"
        echo "  all - Run all tests (default)"
        exit 1
        ;;
esac