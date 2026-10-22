-- =====================================================================
--  WARNING - LEGACY SCRIPT, KEEP FOR REFERENCE ONLY
--
--  This is the ORIGINAL single file version of the schema. It is kept
--  so that the history of the project stays visible.
--
--  DO NOT RUN THIS FILE ON THE DEPLOYED DATABASE.
--  It starts with `DROP DATABASE IF EXISTS hotel_booking_db;`, which
--  would destroy every reservation on the live server.
--
--  The script that is actually used for the deployment is
--  database/run_all.sh (local) and database/deploy/apply_remote.sh
--  (Aiven). Both of them are safe: they never drop anything.
--
--  This file also contains the ORIGINAL double booking check, which
--  the current triggers replace. See IMPLEMENTATION_PLAN.md, bug B1.
-- =====================================================================

-- Hotel Booking and Reservation Management System
-- MySQL 8.0+ | DBMS Mini Project - Topic 10

DROP DATABASE IF EXISTS hotel_booking_db;
CREATE DATABASE hotel_booking_db;
USE hotel_booking_db;

-- 1. TABLES (DDL)
CREATE TABLE customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE room_type (
    room_type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price > 0),
    capacity INT NOT NULL CHECK (capacity > 0),
    description VARCHAR(255)
);

CREATE TABLE room (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    room_type_id INT NOT NULL,
    floor_no INT NOT NULL,
    room_status ENUM('Available', 'Maintenance', 'Inactive') NOT NULL DEFAULT 'Available',
    CONSTRAINT fk_room_type FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE reservation (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    room_id INT NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    adults INT NOT NULL DEFAULT 1 CHECK (adults > 0),
    children INT NOT NULL DEFAULT 0 CHECK (children >= 0),
    reservation_status ENUM('Pending', 'Confirmed', 'Checked_In', 'Checked_Out', 'Cancelled')
        NOT NULL DEFAULT 'Pending',
    booking_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    remarks VARCHAR(255),
    CONSTRAINT chk_stay_dates CHECK (check_out_date > check_in_date),
    CONSTRAINT fk_reservation_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reservation_room FOREIGN KEY (room_id)
        REFERENCES room(room_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method ENUM('Cash', 'Card', 'UPI', 'Bank_Transfer') NOT NULL,
    payment_status ENUM('Paid', 'Refunded', 'Failed') NOT NULL DEFAULT 'Paid',
    transaction_reference VARCHAR(60) UNIQUE,
    CONSTRAINT fk_payment_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservation(reservation_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE reservation_status_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(80) NOT NULL DEFAULT 'SYSTEM',
    CONSTRAINT fk_log_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservation(reservation_id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 2. INDEXES (optimization)
CREATE INDEX idx_room_type_status ON room(room_type_id, room_status);
CREATE INDEX idx_reservation_room_dates ON reservation(room_id, check_in_date, check_out_date);
CREATE INDEX idx_reservation_customer ON reservation(customer_id);
CREATE INDEX idx_payment_reservation ON payment(reservation_id);

-- 3. TRIGGERS (integrity and audit)
DELIMITER $$

CREATE TRIGGER trg_reservation_before_insert
BEFORE INSERT ON reservation
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT DEFAULT 0;
    DECLARE selected_room_status VARCHAR(20);

    IF NEW.check_out_date <= NEW.check_in_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;

    SELECT room_status INTO selected_room_status FROM room WHERE room_id = NEW.room_id;
    IF selected_room_status IS NULL OR selected_room_status <> 'Available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This room is not available for booking.';
    END IF;

    IF NEW.reservation_status IN ('Pending', 'Confirmed', 'Checked_In') THEN
        SELECT COUNT(*) INTO overlap_count
        FROM reservation
        WHERE room_id = NEW.room_id
          AND reservation_status IN ('Pending', 'Confirmed', 'Checked_In')
          AND NEW.check_in_date < check_out_date
          AND NEW.check_out_date > check_in_date;
        IF overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is already reserved for part of these dates.';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_reservation_before_update
BEFORE UPDATE ON reservation
FOR EACH ROW
BEGIN
    DECLARE overlap_count INT DEFAULT 0;
    IF NEW.check_out_date <= NEW.check_in_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;
    IF NEW.reservation_status IN ('Pending', 'Confirmed', 'Checked_In') THEN
        SELECT COUNT(*) INTO overlap_count
        FROM reservation
        WHERE room_id = NEW.room_id
          AND reservation_id <> OLD.reservation_id
          AND reservation_status IN ('Pending', 'Confirmed', 'Checked_In')
          AND NEW.check_in_date < check_out_date
          AND NEW.check_out_date > check_in_date;
        IF overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Update would create an overlapping reservation.';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_reservation_status_audit
AFTER UPDATE ON reservation
FOR EACH ROW
BEGIN
    IF OLD.reservation_status <> NEW.reservation_status THEN
        INSERT INTO reservation_status_log(reservation_id, old_status, new_status, changed_by)
        VALUES (NEW.reservation_id, OLD.reservation_status, NEW.reservation_status, CURRENT_USER());
    END IF;
END$$

CREATE TRIGGER trg_payment_before_insert
BEFORE INSERT ON payment
FOR EACH ROW
BEGIN
    DECLARE bill_total DECIMAL(10,2);
    DECLARE paid_total DECIMAL(10,2);
    SELECT total_amount INTO bill_total FROM reservation WHERE reservation_id = NEW.reservation_id;
    IF bill_total IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reservation does not exist.';
    END IF;
    SELECT COALESCE(SUM(amount), 0) INTO paid_total
    FROM payment WHERE reservation_id = NEW.reservation_id AND payment_status = 'Paid';
    IF NEW.payment_status = 'Paid' AND paid_total + NEW.amount > bill_total THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment is greater than the remaining bill amount.';
    END IF;
END$$

-- 4. STORED PROCEDURES
CREATE PROCEDURE sp_check_room_availability(IN p_check_in DATE, IN p_check_out DATE, IN p_guests INT)
BEGIN
    IF p_check_out <= p_check_in THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;
    SELECT r.room_id, r.room_number, rt.type_name, rt.capacity, rt.base_price
    FROM room r
    JOIN room_type rt ON rt.room_type_id = r.room_type_id
    WHERE r.room_status = 'Available'
      AND rt.capacity >= p_guests
      AND NOT EXISTS (
          SELECT 1 FROM reservation res
          WHERE res.room_id = r.room_id
            AND res.reservation_status IN ('Pending', 'Confirmed', 'Checked_In')
            AND p_check_in < res.check_out_date
            AND p_check_out > res.check_in_date
      )
    ORDER BY rt.base_price, r.room_number;
END$$

CREATE PROCEDURE sp_create_reservation(
    IN p_customer_id INT, IN p_room_id INT, IN p_check_in DATE, IN p_check_out DATE,
    IN p_adults INT, IN p_children INT, IN p_remarks VARCHAR(255)
)
BEGIN
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_room_status VARCHAR(20);
    DECLARE v_nights INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT r.room_status, rt.base_price INTO v_room_status, v_price
    FROM room r JOIN room_type rt ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = p_room_id FOR UPDATE;

    IF v_room_status IS NULL OR v_room_status <> 'Available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Selected room is not available.';
    END IF;
    SET v_nights = DATEDIFF(p_check_out, p_check_in);
    IF v_nights <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid stay dates.';
    END IF;
    SET v_total = v_price * v_nights;

    INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date, adults, children,
                            reservation_status, total_amount, remarks)
    VALUES (p_customer_id, p_room_id, p_check_in, p_check_out, p_adults, p_children,
            'Confirmed', v_total, p_remarks);
    COMMIT;
    SELECT LAST_INSERT_ID() AS new_reservation_id, v_total AS total_bill;
END$$
DELIMITER ;

-- 5. SAMPLE DATA (DML)
INSERT INTO room_type(type_name, base_price, capacity, description) VALUES
('Standard', 2500.00, 2, 'Comfortable room with one queen bed'),
('Deluxe', 4000.00, 3, 'Spacious room with city view'),
('Suite', 6500.00, 4, 'Living area and premium amenities');

INSERT INTO room(room_number, room_type_id, floor_no, room_status) VALUES
('101', 1, 1, 'Available'), ('102', 1, 1, 'Available'), ('201', 2, 2, 'Available'),
('202', 2, 2, 'Available'), ('301', 3, 3, 'Available'), ('302', 3, 3, 'Maintenance');

INSERT INTO customer(first_name, last_name, phone, email, address) VALUES
('Aarav', 'Sharma', '9876500001', 'aarav@example.com', 'Hyderabad'),
('Diya', 'Reddy', '9876500002', 'diya@example.com', 'Secunderabad'),
('Kabir', 'Khan', '9876500003', 'kabir@example.com', 'Warangal'),
('Meera', 'Patel', '9876500004', 'meera@example.com', 'Vijayawada');

INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date, adults, children,
                        reservation_status, total_amount, remarks) VALUES
(1, 1, '2026-10-10', '2026-10-13', 2, 0, 'Checked_Out', 7500.00, 'Completed stay'),
(2, 3, '2026-11-05', '2026-11-08', 2, 1, 'Confirmed', 12000.00, 'Needs extra bed'),
(3, 4, '2026-11-12', '2026-11-14', 1, 0, 'Pending', 8000.00, 'Early check-in requested');

INSERT INTO payment(reservation_id, amount, payment_method, payment_status, transaction_reference) VALUES
(1, 7500.00, 'UPI', 'Paid', 'UPI-20261010-001'),
(2, 5000.00, 'Card', 'Paid', 'CARD-20261101-002');

-- 6. VIEWS
CREATE VIEW vw_reservation_details AS
SELECT res.reservation_id,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       c.phone, r.room_number, rt.type_name AS room_type,
       res.check_in_date, res.check_out_date,
       DATEDIFF(res.check_out_date, res.check_in_date) AS nights,
       res.reservation_status, res.total_amount,
       COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_amount,
       res.total_amount - COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0 END), 0) AS balance_due
FROM reservation res
JOIN customer c ON c.customer_id = res.customer_id
JOIN room r ON r.room_id = res.room_id
JOIN room_type rt ON rt.room_type_id = r.room_type_id
LEFT JOIN payment p ON p.reservation_id = res.reservation_id
GROUP BY res.reservation_id, c.first_name, c.last_name, c.phone, r.room_number, rt.type_name,
         res.check_in_date, res.check_out_date, res.reservation_status, res.total_amount;

CREATE VIEW vw_room_revenue AS
SELECT r.room_number, rt.type_name,
       COUNT(res.reservation_id) AS number_of_reservations,
       COALESCE(SUM(res.total_amount), 0) AS booked_revenue
FROM room r
JOIN room_type rt ON rt.room_type_id = r.room_type_id
LEFT JOIN reservation res ON res.room_id = r.room_id AND res.reservation_status <> 'Cancelled'
GROUP BY r.room_id, r.room_number, rt.type_name;

-- 7. REPORT QUERIES: run these one by one during your demo
SELECT * FROM vw_reservation_details;
SELECT * FROM vw_room_revenue ORDER BY booked_revenue DESC;

-- Availability search (stored procedure)
CALL sp_check_room_availability('2026-11-05', '2026-11-08', 2);

-- Make a safe booking (room 2 is free for these dates)
CALL sp_create_reservation(4, 2, '2026-12-20', '2026-12-22', 2, 0, 'Demo booking');

-- Join query: confirmed/pending future stays
SELECT customer_name, room_number, check_in_date, check_out_date, balance_due
FROM vw_reservation_details
WHERE reservation_status IN ('Confirmed', 'Pending')
ORDER BY check_in_date;

-- Aggregate query: revenue by room type
SELECT rt.type_name, COUNT(res.reservation_id) AS bookings, COALESCE(SUM(res.total_amount), 0) AS revenue
FROM room_type rt
LEFT JOIN room r ON r.room_type_id = rt.room_type_id
LEFT JOIN reservation res ON res.room_id = r.room_id AND res.reservation_status <> 'Cancelled'
GROUP BY rt.room_type_id, rt.type_name
HAVING revenue >= 0
ORDER BY revenue DESC;

-- Subquery: customers whose booking amount is above the average booking amount
SELECT CONCAT(c.first_name, ' ', c.last_name) AS customer_name, res.total_amount
FROM customer c JOIN reservation res ON c.customer_id = res.customer_id
WHERE res.total_amount > (SELECT AVG(total_amount) FROM reservation)
ORDER BY res.total_amount DESC;

-- Trigger demonstration: this must fail because room 201 is already booked on these dates.
-- INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date, adults, children,
--                         reservation_status, total_amount)
-- VALUES (4, 3, '2026-11-06', '2026-11-07', 2, 0, 'Confirmed', 4000.00);

-- Transaction demonstration (uncomment only if you want to show ROLLBACK):
-- START TRANSACTION;
-- INSERT INTO payment(reservation_id, amount, payment_method, payment_status, transaction_reference)
-- VALUES (2, 1000.00, 'Cash', 'Paid', 'TEMP-DEMO-001');
-- ROLLBACK;
-- SELECT * FROM payment WHERE transaction_reference = 'TEMP-DEMO-001';  -- no rows after rollback

-- Optional DCL example: run only if your MySQL account has admin permission.
-- CREATE USER 'hotel_staff'@'localhost' IDENTIFIED BY 'ChangeThisPassword!';
-- GRANT SELECT, INSERT, UPDATE ON hotel_booking_db.* TO 'hotel_staff'@'localhost';
-- REVOKE DELETE ON hotel_booking_db.* FROM 'hotel_staff'@'localhost';
