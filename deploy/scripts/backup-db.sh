#!/bin/bash
# ==============================================================================
# Sai Ajantha Production Database Backup Script
# Creates compressed pg_dump archives with 14-day automated rotation
# Run daily via cron: 0 3 * * * /path/to/monorepo/deploy/scripts/backup-db.sh
# ==============================================================================

set -eo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sai-ajanta}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="sai_ajanta_db_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting Sai Ajantha PostgreSQL backup..."

docker exec -t sai-ajanta-prod-postgres pg_dump -U "${POSTGRES_USER:-medusa}" "${POSTGRES_DB:-medusa}" | gzip -9 > "${BACKUP_DIR}/${FILENAME}"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date)] Backup completed successfully: ${FILENAME} (${BACKUP_SIZE})"

# Remove backups older than retention window
echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "sai_ajanta_db_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup lifecycle maintenance complete."
