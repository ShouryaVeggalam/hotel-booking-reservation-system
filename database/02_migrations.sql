-- =====================================================================
-- 02_migrations.sql  |  Safe, idempotent ALTER TABLE statements
--
-- Purpose
--   1. Bring an already-created `hotel_booking_db` in line with
--      01_schema.sql (a database created before this project will not
--      pick up new CHECK constraints or ENUM values from
--      CREATE TABLE IF NOT EXISTS).
--   2. Provide the ALTER TABLE demonstration required for the DBMS
--      lab record.
--
-- SAFE: no DROP, no TRUNCATE, no data loss. Every ALTER is guarded by
-- an information_schema check, so re-running the script is harmless.
-- =====================================================================

USE hotel_booking_db;

-- ---------------------------------------------------------------------
-- ALTER 1 - Add a CHECK constraint on room.floor_no.
--   Demonstrates: ALTER TABLE ... ADD CONSTRAINT ... CHECK
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'room'
                  AND CONSTRAINT_NAME = 'room_chk_1'),
        'SELECT ''room.room_chk_1 already exists - skipped'' AS migration_note',
        'ALTER TABLE room ADD CONSTRAINT room_chk_1 CHECK (floor_no > 0)'
    )
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ALTER 2 - Extend payment.payment_status so that a simulated
--   'Pending' payment can be recorded.
--   Demonstrates: ALTER TABLE ... MODIFY COLUMN
--   Balance rule stays: only 'Paid' rows reduce the outstanding balance.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'payment'
                  AND COLUMN_NAME = 'payment_status'
                  AND COLUMN_TYPE LIKE '%Pending%'),
        'SELECT ''payment.payment_status already includes Pending - skipped'' AS migration_note',
        'ALTER TABLE payment MODIFY COLUMN payment_status
             ENUM(''Paid'',''Pending'',''Refunded'',''Failed'') NOT NULL DEFAULT ''Paid'''
    )
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ALTER 3 - Add a NOT NULL + DEFAULT to room.room_status for databases
--   created without it. Demonstrates MODIFY COLUMN with a default.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'room'
                  AND COLUMN_NAME = 'room_status'
                  AND IS_NULLABLE = 'NO'
                  AND COLUMN_DEFAULT = 'Available'),
        'SELECT ''room.room_status already NOT NULL DEFAULT Available - skipped'' AS migration_note',
        'ALTER TABLE room MODIFY COLUMN room_status
             ENUM(''Available'',''Maintenance'',''Inactive'') NOT NULL DEFAULT ''Available'''
    )
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ALTER 4 - Widen room.room_number so room numbers such as 'A-1204'
--   can be stored. Demonstrates MODIFY COLUMN for size change.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(
        EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'room'
                  AND COLUMN_NAME = 'room_number'
                  AND CHARACTER_MAXIMUM_LENGTH >= 20),
        'SELECT ''room.room_number already VARCHAR(20) - skipped'' AS migration_note',
        'ALTER TABLE room MODIFY COLUMN room_number VARCHAR(20) NOT NULL'
    )
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Migrations applied.' AS migration_status;
