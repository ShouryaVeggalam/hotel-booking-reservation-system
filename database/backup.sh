#!/usr/bin/env bash
# =====================================================================
# backup.sh - write a consistent dump of the hotel database.
#
# The dump is written to database/_backup/ with the date in the file
# name. The folder is listed in .gitignore, so a backup never ends up
# in a Git repository.
#
# Usage
#   bash database/backup.sh
#   MYSQL_USER=root MYSQL_PASSWORD=secret bash database/backup.sh
#   MYSQL_HOST=... MYSQL_PORT=3306 MYSQL_DATABASE=hotel_booking_db \
#     bash database/backup.sh
# =====================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/_backup"

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:=root}"
: "${MYSQL_PASSWORD:=}"
: "${MYSQL_DATABASE:=hotel_booking_db}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="${BACKUP_DIR}/${MYSQL_DATABASE}_backup_${STAMP}.sql"

MYSQL_ARGS=(
    --host="${MYSQL_HOST}"
    --port="${MYSQL_PORT}"
    --user="${MYSQL_USER}"
    --default-character-set=utf8mb4
)
[ -n "${MYSQL_PASSWORD}" ] && MYSQL_ARGS+=(--password="${MYSQL_PASSWORD}")

echo "== Backing up ${MYSQL_DATABASE} to ${TARGET}"
mysqldump "${MYSQL_ARGS[@]}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-table \
    "${MYSQL_DATABASE}" > "${TARGET}"

SIZE="$(du -h "${TARGET}" | cut -f1)"
echo "== Done: ${TARGET} (${SIZE})"
