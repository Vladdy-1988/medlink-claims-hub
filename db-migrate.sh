#!/bin/bash
# Database migration script for production deployment

echo "Running database migrations..."
npx drizzle-kit generate
npx drizzle-kit migrate

echo "Migrations complete!"