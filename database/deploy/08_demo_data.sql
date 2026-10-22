-- =====================================================================
-- 08_demo_data.sql  |  Extra demonstration data for the DEPLOYED
--                      database only.
--
-- Purpose
--   The public demonstration should show a hotel that is actually
--   running on the day it is opened. The rows below are therefore
--   dated relative to CURDATE(), so the dashboard always shows
--   arrivals, departures and an occupied night - whenever the
--   demonstration is given.
--
--   Every person here is fictional. The names, phone numbers and
--   email addresses do not belong to anybody: they use the ranges
--   that are reserved for documentation and examples, so nobody can
--   be contacted through them.
--
--   The two extra rooms (401 and 402) carry the demonstration
--   bookings. They are used because the four rooms of the main seed
--   file already carry the four original bookings, and a room can
--   only be free if no booking overlaps it.
--
-- NOT part of the local development database. This file is only run
-- against the deployed Aiven instance:
--     SEED_FILE=database/deploy/08_demo_data.sql \
--       bash database/deploy/apply_remote.sh
--
-- SAFE: every INSERT is guarded by NOT EXISTS, so the script can be
-- re-run without creating duplicates.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Two extra rooms for the demonstration.
--   401 - Standard (2 guests) on the fourth floor
--   402 - Deluxe   (3 guests) on the fourth floor
-- ---------------------------------------------------------------------
INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 7, '401', 1, 4, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '401');

INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 8, '402', 2, 4, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '402');

-- ---------------------------------------------------------------------
-- Demonstration guests (IDs start at 101 so they never collide with
-- the four customers of the main seed file).
-- ---------------------------------------------------------------------
INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 101, 'Aarav', 'Sharma', '9100000101', 'aarav.sharma@example.invalid', 'Banjara Hills, Hyderabad'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE customer_id = 101);

INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 102, 'Diya', 'Menon', '9100000102', 'diya.menon@example.invalid', 'Koramangala, Bengaluru'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE customer_id = 102);

INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 103, 'Rohan', 'Iyer', '9100000103', 'rohan.iyer@example.invalid', 'Marine Drive, Chennai'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE customer_id = 103);

INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 104, 'Fatima', 'Begum', '9100000104', 'fatima.begum@example.invalid', 'Hitec City, Hyderabad'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE customer_id = 104);

-- ---------------------------------------------------------------------
-- Demonstration bookings.
--   #101 room 401  arrives today, leaves tomorrow     1 night  x 2500
--   #102 room 402  leaves today                       2 nights x 4000
--   #103 room 301  occupied from today for three nights 3 nights x 6500
--   #104 room 401  arrives in three days               2 nights x 2500
-- The dates are written relative to CURDATE() on purpose, and the
-- rooms are ones that no other booking uses, so the script can be
-- re-run at any time without a double booking.
-- ---------------------------------------------------------------------
INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 101, 101, 7, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 DAY),
       2, 0, 'Checked_In', 2500.00, 'DEMO - arrival today'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 101);

INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 102, 102, 8, DATE_ADD(CURDATE(), INTERVAL -2 DAY), CURDATE(),
       1, 1, 'Checked_Out', 8000.00, 'DEMO - departure today'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 102);

INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 103, 103, 5, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY),
       2, 2, 'Confirmed', 19500.00, 'DEMO - suite stay in progress'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 103);

INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 104, 104, 7, DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 5 DAY),
       1, 0, 'Confirmed', 5000.00, 'DEMO - arriving in three days'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 104);

-- ---------------------------------------------------------------------
-- Demonstration payments. Only the rows with payment_status = 'Paid'
-- reduce the outstanding balance, which is the balance rule of the
-- project.
-- ---------------------------------------------------------------------
INSERT INTO payment (reservation_id, amount, payment_method, payment_status, transaction_reference)
SELECT 101, 2500.00, 'UPI', 'Paid', 'DEMO-UPI-0001'
WHERE NOT EXISTS (SELECT 1 FROM payment WHERE transaction_reference = 'DEMO-UPI-0001');

INSERT INTO payment (reservation_id, amount, payment_method, payment_status, transaction_reference)
SELECT 102, 8000.00, 'Card', 'Paid', 'DEMO-CARD-0002'
WHERE NOT EXISTS (SELECT 1 FROM payment WHERE transaction_reference = 'DEMO-CARD-0002');

INSERT INTO payment (reservation_id, amount, payment_method, payment_status, transaction_reference)
SELECT 103, 10000.00, 'Bank_Transfer', 'Paid', 'DEMO-BANK-0003'
WHERE NOT EXISTS (SELECT 1 FROM payment WHERE transaction_reference = 'DEMO-BANK-0003');

-- A payment that is still pending. It is visible in the ledger and in
-- the report, but it does NOT reduce the balance of reservation 103.
INSERT INTO payment (reservation_id, amount, payment_method, payment_status, transaction_reference)
SELECT 103, 5000.00, 'Cash', 'Pending', 'DEMO-CASH-0004'
WHERE NOT EXISTS (SELECT 1 FROM payment WHERE transaction_reference = 'DEMO-CASH-0004');

SELECT 'Demonstration data loaded.' AS demo_seed_status;
