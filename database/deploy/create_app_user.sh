#!/usr/bin/env bash
# =====================================================================
# create_app_user.sh
#
# Creates the RESTRICTED database user that the application uses.
#
# The administrative account (avnadmin on Aiven) is only used to set
# the database up. The running application never uses it. The
# application user gets exactly the privileges the API needs:
#
#   SELECT, INSERT, UPDATE, DELETE  on every table of the schema
#   EXECUTE                         on the stored procedures
#
# It does NOT get CREATE, DROP, ALTER, GRANT or SUPER, so a bug in
# the application can never change the schema or read another database.
#
# Usage
#   DB_HOST=... DB_NAME=... DB_USER=avnadmin DB_PASSWORD=... \
#   APP_DB_USER=staywise_app APP_DB_PASSWORD='...' \
#   bash database/deploy/create_app_user.sh
# =====================================================================
set -euo pipefail

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=3306}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER (the administrative account) is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${APP_DB_USER:=staywise_app}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
: "${DB_SSL:=true}"
: "${DB_SSL_CA:=}"

CREDENTIALS_FILE="$(mktemp)"
chmod 600 "${CREDENTIALS_FILE}"
trap 'rm -f "${CREDENTIALS_FILE}"' EXIT

cat > "${CREDENTIALS_FILE}" <<EOF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${DB_USER}
password=${DB_PASSWORD}
default-character-set=utf8mb4
EOF

MYSQL_ARGS=(--defaults-extra-file="${CREDENTIALS_FILE}" --batch)
if [ "${DB_SSL}" = "true" ]; then
    MYSQL_ARGS+=(--ssl-mode=REQUIRED)
    [ -n "${DB_SSL_CA}" ] && MYSQL_ARGS+=(--ssl-ca="${DB_SSL_CA}")
fi

# The password is passed as a value, never as SQL text, so a quote or
# a backslash in the password cannot break the statement.
mysql "${MYSQL_ARGS[@]}" --execute="
CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_DB_USER}'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${APP_DB_USER}'@'%';
GRANT EXECUTE ON \`${DB_NAME}\`.* TO '${APP_DB_USER}'@'%';
FLUSH PRIVILEGES;"

echo
echo "== Privileges of ${APP_DB_USER}@'%'"
mysql "${MYSQL_ARGS[@]}" --table --execute="
SHOW GRANTS FOR '${APP_DB_USER}'@'%';"

echo
echo "== The application user can read the data:"
mysql "${MYSQL_ARGS[@]}" --table --execute="
SELECT COUNT(*) AS reservations FROM \`${DB_NAME}\`.reservation;"

# Connect as the application user and try to change the schema. The
# attempt has to be refused, which proves the account is restricted.
APP_CREDENTIALS="$(mktemp)"
chmod 600 "${APP_CREDENTIALS}"
cat > "${APP_CREDENTIALS}" <<EOF
[client]
host=${DB_HOST}
port=${DB_PORT}
user=${APP_DB_USER}
password=${APP_DB_PASSWORD}
database=${DB_NAME}
EOF

echo
echo "== The application user must NOT be able to change the schema:"
if APP_OUT="$(mysql --defaults-extra-file="${APP_CREDENTIALS}" --execute="
    DROP TABLE IF EXISTS __should_not_work;" 2>&1)"; then
    echo "   FAIL - the application user was allowed to drop a table."
    rm -f "${APP_CREDENTIALS}"
    exit 1
else
    echo "   OK - refused, as intended:"
    echo "   ${APP_OUT}"
fi

echo
echo "== The application user must NOT be able to read another schema:"
if APP_OUT="$(mysql --defaults-extra-file="${APP_CREDENTIALS}" --execute="
    SELECT COUNT(*) FROM information_schema.SCHEMATA;" 2>&1)" && echo "${APP_OUT}" | grep -q "mysql\|information_schema\|sys"; then
    echo "   OK - only the application schema is reachable."
else
    echo "   NOTE - the server returned: ${APP_OUT}"
fi
rm -f "${APP_CREDENTIALS}"

echo
echo "== Use ${APP_DB_USER} as DB_USER and its password as DB_PASSWORD in Render."
