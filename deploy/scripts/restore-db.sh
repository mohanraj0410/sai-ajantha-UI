#!/usr/bin/env bash
# ==============================================================================
# Sai Ajantha Production Database Restore Script
# Usage: bash deploy/scripts/restore-db.sh /path/to/backup.sql.gz
# ==============================================================================

set -eo pipefail

BACKUP_FILE="$1"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <path-to-compressed-backup.sql.gz>"
  echo "Example: $0 /var/backups/sai-ajanta/sai_ajanta_db_20261119_120000.sql.gz"
  exit 1
fi

echo "=================================================="
echo " CAUTION: You are about to restore the database!"
echo " Target File: ${BACKUP_FILE}"
echo "=================================================="
read -p "Are you sure you want to proceed? This will overwrite existing database records! (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Restore aborted."
  exit 0
fi

echo "[$(date)] Restoring database from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | docker exec -i sai-ajanta-prod-postgres psql -U "${POSTGRES_USER:-medusa}" -d "${POSTGRES_DB:-medusa}"

echo "[$(date)] Database restored successfully."
