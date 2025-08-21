# Multi-stage Dockerfile for MedLink Claims Hub

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .
COPY --from=frontend-builder /app/dist ./dist

# Build backend
RUN npx esbuild server/index.ts \
    --platform=node \
    --packages=external \
    --bundle \
    --format=esm \
    --outdir=dist

# Stage 3: Production runtime
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built assets
COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-builder /app/dist/index.js ./dist/

# Copy necessary files
COPY drizzle.config.ts ./
COPY public ./public

# Create uploads directory for local storage fallback
RUN mkdir -p uploads

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "dist/index.js"]