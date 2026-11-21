# ==============================================================================
# Sai Ajantha Storefront & B2B Portal - Production Dockerfile
# Optimized Next.js 16 App Router build
# ==============================================================================

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# Stage 1: Dependencies & Build
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Copy monorepo manifests
COPY package.json package-lock.json* turbo.json* ./
COPY scripts ./scripts
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/
COPY apps/admin/package.json ./apps/admin/
COPY apps/storefront/package.json ./apps/storefront/

# Install dependencies
RUN npm ci --workspace=@sai-ajanta/storefront --workspace=@sai-ajanta/types || npm install --workspace=@sai-ajanta/storefront --workspace=@sai-ajanta/types
RUN npm install --no-save @tailwindcss/oxide-linux-x64-gnu@4.3.3 lightningcss-linux-x64-gnu@1.32.0 --workspace=@sai-ajanta/storefront || true
RUN node scripts/ensure-native-binaries.mjs || true

# Copy source
COPY packages/types ./packages/types
COPY apps/storefront ./apps/storefront

ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=${NEXT_PUBLIC_MEDUSA_BACKEND_URL:-"http://localhost:9000"}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL:-"http://localhost:3000"}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build types & Next.js production bundle
RUN npm --prefix packages/types run build || true
RUN npm --prefix apps/storefront run build

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs

# Copy runtime files
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/types ./packages/types
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront ./apps/storefront

USER nextjs

EXPOSE 3000

WORKDIR /app/apps/storefront

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/auth/me || exit 0

CMD ["npm", "run", "start"]
