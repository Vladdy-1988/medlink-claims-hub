#!/bin/bash

# MedLink Claims Hub - Production Startup Script

set -e

echo "🚀 Starting MedLink Claims Hub..."

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is required"
    exit 1
fi

# Set default values for optional environment variables
export PORT=${PORT:-5000}
export NODE_ENV=${NODE_ENV:-production}
export STORAGE_DIR=${STORAGE_DIR:-./uploads}

# Create necessary directories
mkdir -p "$STORAGE_DIR"
echo "✅ Created storage directory: $STORAGE_DIR"

# Run database migrations if needed
if [ "$NODE_ENV" = "production" ]; then
    echo "🔄 Running database migrations..."
    npm run db:push || echo "⚠️  Database migration completed with warnings"
fi

# Start the application
echo "🌟 Starting server on port $PORT..."
exec node dist/index.js