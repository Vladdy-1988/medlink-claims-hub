#!/bin/bash

# Anonymize Staging Database Script
# WARNING: This will replace ALL PHI with synthetic test data!

echo "🚀 Starting Staging Database Anonymization"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will PERMANENTLY anonymize ALL data in the staging database!"
echo "⚠️  All PHI will be replaced with synthetic test data."
echo "⚠️  This action CANNOT be undone!"
echo ""
echo "Make sure you are connected to the STAGING database, not production."
echo ""

# Set environment to staging
export NODE_ENV=staging

# Run the anonymization script
tsx server/scripts/anonymize-staging.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Anonymization completed successfully!"
else
    echo ""
    echo "❌ Anonymization failed. Please check the errors above."
    exit 1
fi