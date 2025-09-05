#!/bin/bash
set -e

echo "Building MedLink Claims Hub..."

# Build frontend and backend
echo "📦 Building frontend and backend..."
vite build
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Copy build files to server/public for production serving
echo "📁 Copying build files to server/public..."
mkdir -p server/public
cp -r dist/public/* server/public/

# Also copy to dist/server/public for path resolution in production
echo "📁 Copying build files to dist/server/public for production path resolution..."
mkdir -p dist/server/public
cp -r dist/public/* dist/server/public/

echo "✅ Build completed successfully!"
echo "Frontend: dist/public/"
echo "Backend: dist/index.js"
echo "Production files: server/public/"