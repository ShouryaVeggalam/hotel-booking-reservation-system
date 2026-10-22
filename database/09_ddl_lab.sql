-- =====================================================================
-- 09_ddl_lab.sql  |  Disposable DDL laboratory
--
-- Demonstrates the DDL statements that MUST NOT appear in the normal
-- application start-up or in the production seed script:
--
--     ALTER TABLE   - change the structure of an existing table
--     DROP TABLE    - remove a table completely
--     TRUNCATE      - remove every row but keep the structure
--     DROP DATABASE - remove a database
--
-- SAFETY: this script NEVER touches hotel_booking_db. It creates a
-- throwaway database called hotel_booking_db_lab, performs the
-- destructive statements there and deletes the throwaway database at
-- the end. Run it only when you want to record the lab experiment.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Step 0 - create an isolated laboratory database
-- ---------------------------------------------------------------------
DROP DATABASE IF EXISTS hotel_booking_db_lab;
CREATE DATABASE hotel_booking_db_lab;
USE hotel_booking_db_lab;

SELECT 'Step 0: laboratory database hotel_booking_db_lab created' AS lab_step;

-- ---------------------------------------------------------------------
-- Step 1 - create a small practice table
-- ---------------------------------------------------------------------
CREATE TABLE lab_equipment (
    equipment_id   INT AUTO_INCREMENT PRIMARY KEY,
    equipment_name VARCHAR(60) NOT NULL,
    quantity       INT NOT NULL DEFAULT 1,
    cost           DECIMAL(10,2) NULL
);

INSERT INTO lab_equipment (equipment_name, quantity, cost) VALUES
('Laptop', 4, 45000.00),
('Projector', 1, 28000.00),
('Whiteboard', 6, 1500.00);

SELECT * FROM lab_equipment;

-- ---------------------------------------------------------------------
-- Step 2 - ALTER TABLE: add a column
-- ---------------------------------------------------------------------
ALTER TABLE lab_equipment
    ADD COLUMN warranty_months INT NOT NULL DEFAULT 12;

SELECT 'Step 2: ALTER TABLE ... ADD COLUMN warranty_months' AS lab_step;
SELECT * FROM lab_equipment;

-- ---------------------------------------------------------------------
-- Step 3 - ALTER TABLE: modify a column
-- ---------------------------------------------------------------------
ALTER TABLE lab_equipment
    MODIFY COLUMN cost DECIMAL(12,2) NOT NULL DEFAULT 0.00;

SELECT 'Step 3: ALTER TABLE ... MODIFY COLUMN cost' AS lab_step;

-- ---------------------------------------------------------------------
-- Step 4 - ALTER TABLE: add a CHECK constraint
-- ---------------------------------------------------------------------
ALTER TABLE lab_equipment
    ADD CONSTRAINT lab_equipment_chk_qty CHECK (quantity > 0);

SELECT 'Step 4: ALTER TABLE ... ADD CONSTRAINT CHECK (quantity > 0)' AS lab_step;

-- ---------------------------------------------------------------------
-- Step 5 - ALTER TABLE: rename a column
-- ---------------------------------------------------------------------
ALTER TABLE lab_equipment
    RENAME COLUMN warranty_months TO warranty_period_months;

SELECT 'Step 5: ALTER TABLE ... RENAME COLUMN' AS lab_step;

-- ---------------------------------------------------------------------
-- Step 6 - ALTER TABLE: drop a column
-- ---------------------------------------------------------------------
ALTER TABLE lab_equipment
    DROP COLUMN cost;

SELECT 'Step 6: ALTER TABLE ... DROP COLUMN cost' AS lab_step;
SELECT * FROM lab_equipment;

-- ---------------------------------------------------------------------
-- Step 7 - TRUNCATE: delete every row, keep the table structure
--    (TRUNCATE is faster than DELETE because it resets the AUTO_INCREMENT
--     counter and does not write a row-by-row undo log.)
-- ---------------------------------------------------------------------
TRUNCATE TABLE lab_equipment;

SELECT 'Step 7: TRUNCATE TABLE lab_equipment - rows removed, table kept' AS lab_step;
SELECT COUNT(*) AS rows_left_after_truncate FROM lab_equipment;

-- ---------------------------------------------------------------------
-- Step 8 - DROP TABLE: remove the table completely
-- ---------------------------------------------------------------------
DROP TABLE lab_equipment;

SELECT 'Step 8: DROP TABLE lab_equipment' AS lab_step;

-- ---------------------------------------------------------------------
-- Step 9 - DROP DATABASE: remove the throwaway laboratory database
-- ---------------------------------------------------------------------
DROP DATABASE hotel_booking_db_lab;

SELECT 'Step 9: DROP DATABASE hotel_booking_db_lab - laboratory cleaned up' AS lab_step;

-- ---------------------------------------------------------------------
-- Step 10 - proof that the real database was never touched
-- ---------------------------------------------------------------------
USE hotel_booking_db;

SELECT COUNT(*) AS customer_rows_untouched FROM customer;
SELECT COUNT(*) AS reservation_rows_untouched FROM reservation;
SELECT COUNT(*) AS payment_rows_untouched FROM payment;
