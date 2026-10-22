-- =====================================================================
-- 07_seed.sql  |  Sample data for the hotel
--
-- The data below is the EXACT dataset that is currently live in
-- hotel_booking_db. The script is idempotent: every INSERT is skipped
-- when the row already exists, so re-running it never duplicates data
-- and never changes what is already stored.
--
-- It contains no DROP, no TRUNCATE and no DELETE.
-- =====================================================================

USE hotel_booking_db;

-- ---------------------------------------------------------------------
-- Room types (3)
-- ---------------------------------------------------------------------
INSERT INTO room_type (room_type_id, type_name, base_price, capacity, description)
SELECT 1, 'Standard', 2500.00, 2, 'Comfortable room with one queen bed'
WHERE NOT EXISTS (SELECT 1 FROM room_type WHERE type_name = 'Standard');

INSERT INTO room_type (room_type_id, type_name, base_price, capacity, description)
SELECT 2, 'Deluxe', 4000.00, 3, 'Spacious room with city view'
WHERE NOT EXISTS (SELECT 1 FROM room_type WHERE type_name = 'Deluxe');

INSERT INTO room_type (room_type_id, type_name, base_price, capacity, description)
SELECT 3, 'Suite', 6500.00, 4, 'Living area and premium amenities'
WHERE NOT EXISTS (SELECT 1 FROM room_type WHERE type_name = 'Suite');

-- ---------------------------------------------------------------------
-- Rooms (6) - one of them is in Maintenance so that the room status
-- filter has something to exclude.
-- ---------------------------------------------------------------------
INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 1, '101', 1, 1, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '101');

INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 2, '102', 1, 1, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '102');

INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 3, '201', 2, 2, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '201');

INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 4, '202', 2, 2, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '202');

INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 5, '301', 3, 3, 'Available'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '301');

INSERT INTO room (room_id, room_number, room_type_id, floor_no, room_status)
SELECT 6, '302', 3, 3, 'Maintenance'
WHERE NOT EXISTS (SELECT 1 FROM room WHERE room_number = '302');

-- ---------------------------------------------------------------------
-- Customers (4)
-- ---------------------------------------------------------------------
INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 1, 'Aarav', 'Sharma', '9876500001', 'aarav@example.com', 'Hyderabad'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE phone = '9876500001');

INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 2, 'Diya', 'Reddy', '9876500002', 'diya@example.com', 'Secunderabad'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE phone = '9876500002');

INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 3, 'Kabir', 'Khan', '9876500003', 'kabir@example.com', 'Warangal'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE phone = '9876500003');

INSERT INTO customer (customer_id, first_name, last_name, phone, email, address)
SELECT 4, 'Meera', 'Patel', '9876500004', 'meera@example.com', 'Vijayawada'
WHERE NOT EXISTS (SELECT 1 FROM customer WHERE phone = '9876500004');

-- ---------------------------------------------------------------------
-- Reservations (4)
--
--   #1 room 101  10 -> 13 Oct 2026  Checked_Out  3 nights x 2500 = 7500
--   #2 room 201  05 -> 08 Nov 2026  Confirmed    3 nights x 4000 = 12000
--   #3 room 202  12 -> 14 Nov 2026  Pending      2 nights x 4000 = 8000
--   #4 room 102  20 -> 22 Dec 2026  Confirmed    2 nights x 2500 = 5000
--
-- The totals match the room type price x number of nights rule exactly.
-- ---------------------------------------------------------------------
INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 1, 1, 1, '2026-10-10', '2026-10-13', 2, 0, 'Checked_Out', 7500.00, 'Completed stay'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 1);

INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 2, 2, 3, '2026-11-05', '2026-11-08', 2, 1, 'Confirmed', 12000.00, 'Needs extra bed'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 2);

INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 3, 3, 4, '2026-11-12', '2026-11-14', 1, 0, 'Pending', 8000.00, 'Early check-in requested'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 3);

INSERT INTO reservation (reservation_id, customer_id, room_id, check_in_date, check_out_date,
                         adults, children, reservation_status, total_amount, remarks)
SELECT 4, 4, 2, '2026-12-20', '2026-12-22', 2, 0, 'Confirmed', 5000.00, 'Demo booking'
WHERE NOT EXISTS (SELECT 1 FROM reservation WHERE reservation_id = 4);

-- ---------------------------------------------------------------------
-- Payments (2)
--   Reservation 1 (bill 7500)  -> fully paid
--   Reservation 2 (bill 12000) -> 5000 paid, 7000 outstanding
-- ---------------------------------------------------------------------
INSERT INTO payment (payment_id, reservation_id, amount, payment_method, payment_status, transaction_reference)
SELECT 1, 1, 7500.00, 'UPI', 'Paid', 'UPI-20261010-001'
WHERE NOT EXISTS (SELECT 1 FROM payment WHERE transaction_reference = 'UPI-20261010-001');

INSERT INTO payment (payment_id, reservation_id, amount, payment_method, payment_status, transaction_reference)
SELECT 2, 2, 5000.00, 'Card', 'Paid', 'CARD-20261101-002'
WHERE NOT EXISTS (SELECT 1 FROM payment WHERE transaction_reference = 'CARD-20261101-002');

SELECT 'Seed data applied.' AS seed_status;
