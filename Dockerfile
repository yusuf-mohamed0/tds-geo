# ─── Backend Build Stage ────────────────────────
FROM node:20.20-alpine AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps --ignore-scripts

# Copy source files
COPY tsconfig.json ./
COPY backend/ ./backend/

# Build TypeScript
RUN npm run build

# ─── Frontend Build Stage ──────────────────────
FROM node:20.20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy frontend source files
COPY frontend/ ./

# Build the SPA
RUN npm run build

# ─── Frontend (Nginx) Stage ────────────────────
FROM nginx:1.26-alpine AS frontend

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend SPA from frontend-builder
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Health dashboard (served at /health.html)
COPY frontend/public/health.html /usr/share/nginx/html/health.html

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# ─── Backend Production Stage ──────────────────
# Keep this stage last so plain `docker build` produces the API image used by Compose.
FROM node:20.20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts && \
    npm cache clean --force

# Copy compiled output from builders
COPY --chown=appuser:appgroup --from=backend-builder /app/dist ./dist
COPY --chown=appuser:appgroup --from=backend-builder /app/backend/database ./dist/backend/database
COPY --chown=appuser:appgroup --from=backend-builder /app/backend/prompts ./dist/backend/prompts
COPY --chown=appuser:appgroup --from=backend-builder /app/backend/public ./dist/backend/public
COPY --chown=appuser:appgroup --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create writable runtime directories
RUN mkdir -p /app/logs /app/outputs && chown appuser:appgroup /app/logs /app/outputs

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/backend/index.js"]
