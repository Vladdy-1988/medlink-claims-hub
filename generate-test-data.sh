#!/bin/bash

# Generate Test Data Script
# Creates synthetic test data for development and testing

echo "🚀 Starting Test Data Generation"
echo "================================="
echo ""
echo "This will generate synthetic test data in your database."
echo "All generated data will be prefixed with 'TEST-' for easy identification."
echo ""

# Set environment to development
export NODE_ENV=development

# Parse command line arguments
ARGS=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --organizations)
      ARGS="$ARGS --organizations $2"
      shift 2
      ;;
    --usersPerOrg)
      ARGS="$ARGS --usersPerOrg $2"
      shift 2
      ;;
    --patientsPerOrg)
      ARGS="$ARGS --patientsPerOrg $2"
      shift 2
      ;;
    --providersPerOrg)
      ARGS="$ARGS --providersPerOrg $2"
      shift 2
      ;;
    --claimsPerPatient)
      ARGS="$ARGS --claimsPerPatient $2"
      shift 2
      ;;
    --help)
      echo "Usage: ./generate-test-data.sh [options]"
      echo ""
      echo "Options:"
      echo "  --organizations <n>     Number of organizations to generate (default: 2)"
      echo "  --usersPerOrg <n>      Number of users per organization (default: 5)"
      echo "  --patientsPerOrg <n>   Number of patients per organization (default: 20)"
      echo "  --providersPerOrg <n>  Number of providers per organization (default: 10)"
      echo "  --claimsPerPatient <n> Number of claims per patient (default: 3)"
      echo "  --help                 Show this help message"
      echo ""
      echo "Example:"
      echo "  ./generate-test-data.sh --organizations 3 --patientsPerOrg 50"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Run the test data generation script
tsx server/scripts/generate-test-data.ts $ARGS

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Test data generation completed successfully!"
else
    echo ""
    echo "❌ Test data generation failed. Please check the errors above."
    exit 1
fi