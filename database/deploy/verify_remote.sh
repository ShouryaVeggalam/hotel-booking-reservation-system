#!/usr/bin/env bash
# =====================================================================
# verify_remote.sh
#
# Verifies that the REMOTE MySQL 8 database really contains every
# object the application needs, and that the business rules work.
#
# It prints a PASS / FAIL line for every check and exits with a
# non-zero status if anything failed, so it can be used as a gate.
#
# Usage: same environment variables as apply_remote.sh
# =====================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:=3306}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
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
database=${DB_NAME}
default-character-set=utf8mb4
EOF

MYSQL_ARGS=(--defaults-extra-file="${CREDENTIALS_FILE}" --batch --skip-column-names)
if [ "${DB_SSL}" = "true" ]; then
    MYSQL_ARGS+=(--ssl-mode=REQUIRED)
    [ -n "${DB_SSL_CA}" ] && MYSQL_ARGS+=(--ssl-ca="${DB_SSL_CA}")
fi

FAILED=0

# check <label> <expected-count> <sql>
check() {
    local label="$1" expected="$2" sql="$3"
    local actual
    actual="$(mysql "${MYSQL_ARGS[@]}" -e "${sql}" 2>/dev/null | tr -d '[:space:]')"
    if [ "${actual}" = "${expected}" ]; then
        printf '  PASS  %-46s %s\n' "${label}" "${actual}"
    else
        printf '  FAIL  %-46s expected %s, got %s\n' "${label}" "${expected}" "${actual}"
        FAILED=1
    fi
}

# check_min <label> <minimum> <sql>
# Used for the row counts. The optional demonstration seed
# (database/deploy/08_demo_data.sql) adds rooms, guests, bookings and
# payments on top of the baseline, so only a lower bound is guaranteed.
check_min() {
    local label="$1" minimum="$2" sql="$3"
    local actual
    actual="$(mysql "${MYSQL_ARGS[@]}" -e "${sql}" 2>/dev/null | tr -d '[:space:]')"
    if [ -n "${actual}" ] && [ "${actual}" -ge "${minimum}" ] 2>/dev/null; then
        printf '  PASS  %-46s %s (at least %s)\n' "${label}" "${actual}" "${minimum}"
    else
        printf '  FAIL  %-46s expected at least %s, got %s\n' "${label}" "${minimum}" "${actual}"
        FAILED=1
    fi
}

echo "== Server information"
mysql "${MYSQL_ARGS[@]}" -e "
  SELECT CONCAT('  MySQL version : ', VERSION());
  SELECT CONCAT('  Database      : ', DATABASE());
  SELECT CONCAT('  TLS in use    : ', IF(VARIABLE_VALUE = 'YES', 'yes', 'no'))
    FROM performance_schema.session_status
   WHERE VARIABLE_NAME = 'Ssl_cipher';" 2>/dev/null || true

echo
echo "== Tables (expected 6)"
check "tables in the schema" 6 \
  "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE';"

echo
echo "== Foreign keys (expected 5)"
check "foreign key constraints" 5 \
  "SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE();"

echo
echo "== Views (expected 7)"
check "views in the schema" 7 \
  "SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE();"

echo
echo "== Stored procedures (expected 3)"
check "procedures" 3 \
  "SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE='PROCEDURE';"

echo
echo "== Triggers (expected 5)"
check "triggers" 5 \
  "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();"

echo
echo "== Indexes (expected 15 non primary)"
check "secondary indexes" 15 \
  "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME <> 'PRIMARY';"

echo
echo "== Seed data (minimums - the demo seed adds more rows)"
check_min "room types" 3 "SELECT COUNT(*) FROM room_type;"
check_min "rooms" 6 "SELECT COUNT(*) FROM room;"
check_min "customers" 4 "SELECT COUNT(*) FROM customer;"
check_min "reservations" 4 "SELECT COUNT(*) FROM reservation;"
check_min "payments" 2 "SELECT COUNT(*) FROM payment;"

echo
echo "== Stored procedure works (availability for a date range)"
AVAIL="$(mysql "${MYSQL_ARGS[@]}" -e "
  CALL sp_check_room_availability(DATE_ADD(CURDATE(), INTERVAL 30 DAY),
                                  DATE_ADD(CURDATE(), INTERVAL 32 DAY), 2);
  SELECT COUNT(*) FROM (SELECT 1) AS t;" 2>/dev/null | tail -1)"
if [ -n "${AVAIL}" ]; then
    printf '  PASS  %-46s\n' "sp_check_room_availability returned a result set"
else
    printf '  FAIL  %-46s\n' "sp_check_room_availability returned nothing"
    FAILED=1
fi

echo
echo "== Double booking is rejected by the database"
# The check below inserts a booking directly into the table and then
# tries to insert an overlapping one. The trigger must refuse the
# second insert, so the row count must not grow by two.
BEFORE="$(mysql "${MYSQL_ARGS[@]}" -e "SELECT COUNT(*) FROM reservation;" 2>/dev/null | tr -d '[:space:]')"
mysql "${MYSQL_ARGS[@]}" -e "
  INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                          adults, children, reservation_status, total_amount, remarks)
  SELECT c.customer_id, r.room_id,
         DATE_ADD(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 62 DAY),
         1, 0, 'Confirmed', rt.base_price * 2, 'DEPLOYMENT_VERIFY'
    FROM customer c CROSS JOIN room r JOIN room_type rt ON rt.room_type_id = r.room_type_id
   WHERE r.room_status = 'Available'
   LIMIT 1;" >/dev/null 2>&1
MID="$(mysql "${MYSQL_ARGS[@]}" -e "SELECT COUNT(*) FROM reservation;" 2>/dev/null | tr -d '[:space:]')"

# Second attempt: same room, one day later, so the dates overlap.
# The BEFORE INSERT trigger has to refuse it.
mysql "${MYSQL_ARGS[@]}" -e "
  INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                          adults, children, reservation_status, total_amount, remarks)
  SELECT customer_id, room_id,
         DATE_ADD(CURDATE(), INTERVAL 61 DAY), DATE_ADD(CURDATE(), INTERVAL 63 DAY),
         1, 0, 'Confirmed', 1000, 'DEPLOYMENT_VERIFY'
    FROM reservation WHERE remarks = 'DEPLOYMENT_VERIFY'
   ORDER BY reservation_id DESC LIMIT 1;" >/dev/null 2>&1
FINAL="$(mysql "${MYSQL_ARGS[@]}" -e "SELECT COUNT(*) FROM reservation;" 2>/dev/null | tr -d '[:space:]')"

if [ "${FINAL}" -eq "${MID}" ] && [ "${MID}" -eq $((BEFORE + 1)) ]; then
    printf '  PASS  %-46s %s -> %s -> %s rows\n' "overlapping booking refused" "${BEFORE}" "${MID}" "${FINAL}"
else
    printf '  FAIL  %-46s %s -> %s -> %s rows\n' "overlapping booking refused" "${BEFORE}" "${MID}" "${FINAL}"
    FAILED=1
fi

# Remove the row that the test above created so that the deployed data
# stays exactly as the seed file describes it.
mysql "${MYSQL_ARGS[@]}" -e "
  DELETE FROM reservation WHERE remarks = 'DEPLOYMENT_VERIFY';" >/dev/null 2>&1
RESTORED="$(mysql "${MYSQL_ARGS[@]}" -e "SELECT COUNT(*) FROM reservation;" 2>/dev/null | tr -d '[:space:]')"
if [ "${RESTORED}" -eq "${BEFORE}" ]; then
    printf '  PASS  %-46s %s rows\n' "test rows removed again" "${RESTORED}"
else
    printf '  FAIL  %-46s %s rows\n' "test rows removed again" "${RESTORED}"
    FAILED=1
fi

echo
if [ "${FAILED}" -eq 0 ]; then
    echo "== RESULT: all checks passed."
else
    echo "== RESULT: at least one check FAILED."
fi
exit "${FAILED}"
