#!/bin/bash
# scripts/restore-db.sh
# Restore database from a backup file.
#
# Usage:
#   ./scripts/restore-db.sh backup_20260507_030000.sql.gz
#
# Prerequisites:
#   - DATABASE_URL environment variable set
#   - postgresql-client installed
#   - The backup .sql.gz file (download from db-backups branch)

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Download backup files from the db-backups branch:"
  echo "  git checkout db-backups -- backup_20260507_030000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "WARNING: This will overwrite the current database with:"
echo "  File: $BACKUP_FILE"
echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
read -p "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
echo "Done. Database restored from $BACKUP_FILE"
