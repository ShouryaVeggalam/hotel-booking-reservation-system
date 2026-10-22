#!/usr/bin/env bash
# =====================================================================
# apply_remote.sh
#
# Applies the project schema to a REMOTE MySQL 8 server (Aiven) over
# TLS. The SQL files in this project are the single source of truth;
# this script only strips the two statements that a managed host does
# not allow:
#
#     CREATE DATABASE ...   the host creates the database for you
#     USE <database>        the client selects it with --database
#
# Nothing is dropped, truncated or reset. Every statement in the
# project is idempotent (CREATE ... IF NOT EXISTS, guarded ALTER,
# INSERT ... WHERE NOT EXISTS), so re-running this script is safe and
# leaves existing rows untouched.
#
# Usage
#   DB_HOST=... DB_NAME=... DB_USER=avnadmin DB_PASSWORD=... \
#   DB_SSL=true DB_SSL_CA=./ca.crt bash database/deploy/apply_remote.sh
#
# Optional
#   DB_SSL=false           plain TCP (only for a local test server)
#   SKIP_SEED=1            do not load the demonstration data
#   SEED_FILE=path         an extra seed file to run afterwards
# =====================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=3306}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_SSL:=true}"
: "${DB_SSL_REJECT_UNAUTHORIZED:=true}"

# A temporary option file keeps the password out of the process list.
CREDENTIALS_FILE="$(mktemp)"
chmod 600 "${CREDENTIALS_FILE}"
cleanup() { rm -f "${CREDENTIALS_FILE}"; }
trap cleanup EXIT

cat > "${CREDENTIALS_FILE}" <<EOF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${DB_USER}
password=${DB_PASSWORD}
database=${DB_NAME}
default-character-set=utf8mb4
EOF

MYSQL_ARGS=(--defaults-extra-file="${CREDENTIALS_FILE}" --batch --show-warnings)

if [ "${DB_SSL}" = "true" ]; then
    MYSQL_ARGS+=(--ssl-mode=REQUIRED)
    if [ -n "${DB_SSL_CA:-}" ]; then
        MYSQL_ARGS+=(--ssl-ca="${DB_SSL_CA}")
    fi
    if [ "${DB_SSL_REJECT_UNAUTHORIZED}" = "false" ]; then
        MYSQL_ARGS+=(--ssl-verify-server-cert=FALSE)
    fi
fi

echo "== Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} (TLS=${DB_SSL})"

# Remove CREATE DATABASE / USE so that a managed host is happy.
strip_host_statements() {
    awk '
        /^CREATE DATABASE/            { skip = 1 }
        skip && /;[[:space:]]*$/       { skip = 0; next }
        skip                          { next }
        /^USE /                       { next }
        { print }
    '
}

apply_file() {
    local file="$1"
    local label="$2"
    echo
    echo "== ${label}: $(basename "${file}")"
    strip_host_statements < "${file}" | mysql "${MYSQL_ARGS[@]}"
    echo "   done."
}

# The order matters: tables, then migrations, then indexes, then the
# views that read them, then the procedures and the triggers, and
# finally the demonstration data.
apply_file "${DB_DIR}/01_schema.sql"     "1/6 tables"
apply_file "${DB_DIR}/02_migrations.sql" "2/6 migrations"
apply_file "${DB_DIR}/03_indexes.sql"    "3/6 indexes"
apply_file "${DB_DIR}/04_views.sql"      "4/6 views"
apply_file "${DB_DIR}/05_procedures.sql" "5/6 procedures"
apply_file "${DB_DIR}/06_triggers.sql"   "6/6 triggers"

if [ "${SKIP_SEED:-0}" != "1" ]; then
    apply_file "${DB_DIR}/07_seed.sql" "seed"
    if [ -n "${SEED_FILE:-}" ]; then
        apply_file "${SEED_FILE}" "extra seed"
    fi
fi

echo
echo "== Applying done. Next: bash database/deploy/verify_remote.sh"
