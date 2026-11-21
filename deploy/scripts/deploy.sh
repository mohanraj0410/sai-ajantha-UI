#!/usr/bin/env bash
# ==============================================================================
# Sai Ajantha Automated Production Deployment Script (Option A)
# Usage: bash deploy/scripts/deploy.sh
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

echo "=================================================="
echo " Starting Sai Ajantha Production Deployment (Option A)..."
echo "=================================================="

# 1. Verify Docker & Compose
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed. Please install Docker first: https://get.docker.com"
    exit 1
fi

# 2. Check for .env.production
if [ ! -f .env.production ]; then
    echo "ERROR: .env.production file not found!"
    echo "Please copy deploy/.env.production.example to .env.production and configure your secrets."
    echo "Command: cp deploy/.env.production.example .env.production"
    exit 1
fi

# 3. Validate placeholder secrets in .env.production
if grep -q "YourStrongDatabasePasswordHere" .env.production; then
    echo "WARNING: Default POSTGRES_PASSWORD detected in .env.production!"
    echo "Please set a secure database password."
fi
if grep -q "replace_with_64_char_random_hex_string" .env.production; then
    echo "ERROR: JWT_SECRET or COOKIE_SECRET contains placeholder values!"
    echo "Please generate random secrets with: openssl rand -hex 32"
    exit 1
fi

# 4. Pull latest git changes if in repository
if [ -d .git ]; then
    echo "Fetching latest changes from origin..."
    git pull origin $(git rev-parse --abbrev-ref HEAD) --ff-only 2>/dev/null || echo "Notice: Continuing with local working copy."
fi

# 5. Build and launch production Docker Compose stack
echo "Building and launching production containers with docker-compose.prod.yaml..."
docker compose --env-file .env.production -f docker-compose.prod.yaml up -d --build --remove-orphans

# 6. Wait for PostgreSQL and Backend to become healthy
echo "Waiting for services to become healthy..."
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    BACKEND_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' sai-ajanta-prod-backend 2>/dev/null || echo '"unknown"')
    if [ "${BACKEND_STATUS}" = '"healthy"' ] || [ "${BACKEND_STATUS}" = '"running"' ]; then
        HEALTHY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "Waiting for backend service initialization ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 3
done

# 7. Run database setup and migrations
echo "Executing Medusa and DMS database migrations..."
docker compose --env-file .env.production -f docker-compose.prod.yaml exec -T backend npm run db:setup

echo ""
echo "=================================================="
echo " Sai Ajantha Production Stack Deployed Successfully!"
echo "=================================================="
docker compose --env-file .env.production -f docker-compose.prod.yaml ps
echo ""
echo "Access Points (once DNS is pointed):"
echo " - Storefront: https://${STOREFRONT_DOMAIN:-sai-ajanta.com}"
echo " - Admin Portal: https://${ADMIN_DOMAIN:-admin.sai-ajanta.com}"
echo " - Backend API: https://${API_DOMAIN:-api.sai-ajanta.com}/health"
echo "=================================================="
