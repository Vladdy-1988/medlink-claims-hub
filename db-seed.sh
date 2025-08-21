#!/bin/bash
# Database seeding script for production deployment

echo "Running database seed..."
npx tsx server/seed.ts

echo "Seeding complete!"