# ==============================================================================
# Sai Ajantha Medusa 2.0 Commerce Engine - Production Dockerfile
# Multi-stage build optimized for caching and minimal attack surface
# ==============================================================================

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# Stage 1: Dependencies & Build
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy monorepo package definitions
COPY package.json package-lock.json* turbo.json* ./
COPY scripts ./scripts
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/
COPY apps/admin/package.json ./apps/admin/
COPY apps/storefront/package.json ./apps/storefront/

# Install workspace dependencies
RUN npm ci --workspace=@dtc/backend --workspace=@sai-ajanta/types || npm install --workspace=@dtc/backend --workspace=@sai-ajanta/types

# Copy source code
COPY packages/types ./packages/types
COPY apps/backend ./apps/backend

# Build shared types and backend
RUN npm --prefix packages/types run build || true
RUN npm --prefix apps/backend run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9000
ENV MEDUSA_TELEMETRY_DISABLED=1

# Install runtime utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user for security
RUN groupadd -g 1001 nodejs && useradd -m -u 1001 -g nodejs medusa \
    && mkdir -p /home/medusa/.config \
    && chown -R medusa:nodejs /home/medusa

# Create directory for persistent local NAS assets
RUN mkdir -p /app/local-nas && chown -R medusa:nodejs /app/local-nas

# Copy built application and node_modules from builder
COPY --from=builder --chown=medusa:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=medusa:nodejs /app/package.json ./package.json
COPY --from=builder --chown=medusa:nodejs /app/packages/types ./packages/types
COPY --from=builder --chown=medusa:nodejs /app/apps/backend ./apps/backend

USER medusa

EXPOSE 9000

WORKDIR /app/apps/backend

# Liveness probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

CMD ["npx", "medusa", "start"]
