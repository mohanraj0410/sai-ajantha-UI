# ==============================================================================
# Sai Ajantha Executive Admin Web App - Production Dockerfile
# Stage 1: Build static bundle with Vite
# Stage 2: Serve static files with high-performance Alpine Nginx
# ==============================================================================

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy monorepo configurations
COPY package.json package-lock.json* turbo.json* ./
COPY scripts ./scripts
COPY packages/types/package.json ./packages/types/
COPY apps/admin/package.json ./apps/admin/
COPY apps/backend/package.json ./apps/backend/
COPY apps/storefront/package.json ./apps/storefront/

# Install dependencies needed for Vite build
RUN npm ci --workspace=@sai-ajanta/admin --workspace=@sai-ajanta/types --workspace=@dtc/backend || npm install --workspace=@sai-ajanta/admin --workspace=@sai-ajanta/types --workspace=@dtc/backend

# Copy source
COPY packages/types ./packages/types
COPY apps/backend ./apps/backend
COPY apps/admin ./apps/admin

# Accept build-time environment variable for live API URL
ARG VITE_MEDUSA_BACKEND_URL
ENV VITE_MEDUSA_BACKEND_URL=${VITE_MEDUSA_BACKEND_URL:-""}

# Build production bundle
RUN npm --prefix packages/types run build || true
RUN npm --prefix apps/admin run build

# ------------------------------------------------------------------------------
# Stage 2: Static Nginx Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx SPA configuration
COPY apps/admin/nginx.conf /etc/nginx/conf.d/admin.conf

# Copy compiled static HTML/CSS/JS assets
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
