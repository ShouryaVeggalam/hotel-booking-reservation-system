#!/usr/bin/env bash
# =====================================================================
# run_all.sh - build the local development database from scratch.
#
# It applies the project files in the order the database expects:
#   schema -> migrations -> indexes -> views -> procedures -> triggers
#   -> seed data
#
# Nothing is dropped, truncated or reset. Every statement is
# idempotent, so running the script twice leaves the database exactly
# as it was. The destructive DDL demonstration lives in
# 09_ddl_lab.sql and works on a separate throwaway database
# (hotel_booking_db_lab); it is NOT run by this script.
#
# Usage
#   bash database/run_all.sh              # apply everything
#   SKIP_SEED=1 bash database/run_all.sh  # apply the schema only
#   MYSQL_USER=root MYSQL_PASSWORD=... bash database/run_all.sh
# =====================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:=root}"
: "${MYSQL_PASSWORD:=}"
: "${MYSQL_DATABASE:=hotel_booking_db}"

MYSQL_ARGS=(
    --host="${MYSQL_HOST}"
    --port="${MYSQL_PORT}"
    --user="${MYSQL_USER}"
    --default-character-set=utf8mb4
    --show-warnings
)
[ -n "${MYSQL_PASSWORD}" ] && MYSQL_ARGS+=(--password="${MYSQL_PASSWORD}")
# No --database is passed on purpose: the SQL files create and select
# the database themselves with CREATE DATABASE / USE, so the script
# also works the very first time on an empty MySQL server.

echo "== Target: ${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"

apply() {
    local file="$1"
    echo "-- $(basename "${file}")"
    mysql "${MYSQL_ARGS[@]}" < "${file}"
}

apply "${SCRIPT_DIR}/01_schema.sql"
apply "${SCRIPT_DIR}/02_migrations.sql"
apply "${SCRIPT_DIR}/03_indexes.sql"
apply "${SCRIPT_DIR}/04_views.sql"
apply "${SCRIPT_DIR}/05_procedures.sql"
apply "${SCRIPT_DIR}/06_triggers.sql"

if [ "${SKIP_SEED:-0}" != "1" ]; then
    apply "${SCRIPT_DIR}/07_seed.sql"
fi

echo
echo "== Done. The database is ready."
echo "   Start the application with: npm start"
