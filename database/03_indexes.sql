-- =====================================================================
-- 03_indexes.sql  |  Indexes that support the real application queries
--
-- Every index below is justified by a query that uses it. The
-- "used by" comment names the query in the backend or in
-- 08_reports.sql that needs the index.
--
-- SAFE: each CREATE INDEX is guarded by an information_schema check,
-- so the script can be re-run without error.
-- =====================================================================

USE hotel_booking_db;

-- ---------------------------------------------------------------------
-- idx_room_type_status (room_type_id, room_status)
--   Already present in the original database. Kept for documentation.
--   Used by: room inventory list and room management filters.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'room'
                         AND INDEX_NAME = 'idx_room_type_status'),
        'SELECT ''idx_room_type_status already exists - skipped'' AS note',
        'CREATE INDEX idx_room_type_status ON room(room_type_id, room_status)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_reservation_room_dates (room_id, check_in_date, check_out_date)
--   The single most important index in the project. It makes the
--   overlap test inside trg_reservation_before_insert and inside
--   sp_check_room_availability a narrow range scan instead of a
--   full table scan.
--   Used by: sp_check_room_availability, sp_create_reservation,
--             both reservation triggers, the availability report.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation'
                         AND INDEX_NAME = 'idx_reservation_room_dates'),
        'SELECT ''idx_reservation_room_dates already exists - skipped'' AS note',
        'CREATE INDEX idx_reservation_room_dates ON reservation(room_id, check_in_date, check_out_date)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_reservation_customer (customer_id)
--   Used by: customer reservation history, reservation search by
--             customer, and the reservation -> customer join.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation'
                         AND INDEX_NAME = 'idx_reservation_customer'),
        'SELECT ''idx_reservation_customer already exists - skipped'' AS note',
        'CREATE INDEX idx_reservation_customer ON reservation(customer_id)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_payment_reservation (reservation_id)
--   Used by: the payment balance calculation and payment history.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment'
                         AND INDEX_NAME = 'idx_payment_reservation'),
        'SELECT ''idx_payment_reservation already exists - skipped'' AS note',
        'CREATE INDEX idx_payment_reservation ON payment(reservation_id)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_reservation_status_dates (reservation_status, check_in_date, check_out_date)
--   NEW. Used by: the occupancy / check-in / check-out dashboard
--   counters and by the status filtered reservation search.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation'
                         AND INDEX_NAME = 'idx_reservation_status_dates'),
        'SELECT ''idx_reservation_status_dates already exists - skipped'' AS note',
        'CREATE INDEX idx_reservation_status_dates ON reservation(reservation_status, check_in_date, check_out_date)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_room_status (room_status)
--   NEW. The composite index idx_room_type_status cannot serve a query
--   that filters on room_status alone, which is exactly what the
--   "rooms currently available" report does.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'room'
                         AND INDEX_NAME = 'idx_room_status'),
        'SELECT ''idx_room_status already exists - skipped'' AS note',
        'CREATE INDEX idx_room_status ON room(room_status)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_payment_date (payment_date)
--   NEW. Used by: the "payments collected during a date range" report.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment'
                         AND INDEX_NAME = 'idx_payment_date'),
        'SELECT ''idx_payment_date already exists - skipped'' AS note',
        'CREATE INDEX idx_payment_date ON payment(payment_date)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_customer_name (last_name, first_name)
--   NEW. Used by: the customer search box (name search).
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer'
                         AND INDEX_NAME = 'idx_customer_name'),
        'SELECT ''idx_customer_name already exists - skipped'' AS note',
        'CREATE INDEX idx_customer_name ON customer(last_name, first_name)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- idx_status_log_changed_at (changed_at)
--   NEW. Used by: the reservation status history report sorted by date.
-- ---------------------------------------------------------------------
SET @ddl := (
    SELECT IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS
                       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_status_log'
                         AND INDEX_NAME = 'idx_status_log_changed_at'),
        'SELECT ''idx_status_log_changed_at already exists - skipped'' AS note',
        'CREATE INDEX idx_status_log_changed_at ON reservation_status_log(changed_at)')
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'Indexes applied.' AS index_status;
