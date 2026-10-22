-- =====================================================================
-- 05_procedures.sql  |  Stored procedures
--
--   sp_check_room_availability - read-only availability search
--   sp_create_reservation     - transactional booking with room locking
--   sp_record_payment         - transactional payment with balance check
--
-- CONCURRENCY DESIGN (important, this is the part the report explains)
--
--   A plain SELECT inside a trigger is a *consistent, non-locking*
--   read. Under REPEATABLE READ it reads the transaction snapshot and
--   therefore CANNOT see another transaction's uncommitted INSERT.
--   That is why an overlap check written with a plain SELECT lets two
--   concurrent bookings for the same room both succeed.
--
--   The fix used in this project is a row lock on the parent room:
--
--       SELECT room_status FROM room WHERE room_id = ? FOR UPDATE
--
--   FOR UPDATE is a *locking* read: it reads the latest committed
--   version of the row and holds an exclusive lock until the
--   transaction ends. Because every booking path for a room locks the
--   same room row, the booking attempts for one room are serialised,
--   and the second transaction sees the first transaction's committed
--   reservation and is rejected.
--
--   The overlap count itself is written as a NORMAL read on purpose.
--   MySQL forbids a locking read on a table from inside a trigger
--   that fires on that same table (error 1442), and a normal read is
--   correct here as long as it happens AFTER the room lock has been
--   granted: the read view is then created at that moment and
--   therefore contains the committed booking of the session that held
--   the room lock before us.
--
--   Lock order is always the same in every path:
--       room row  ->  reservation rows
--   A consistent order prevents deadlocks between two sessions.
-- =====================================================================

USE hotel_booking_db;

DROP PROCEDURE IF EXISTS sp_check_room_availability;
DROP PROCEDURE IF EXISTS sp_create_reservation;
DROP PROCEDURE IF EXISTS sp_record_payment;

DELIMITER $$

-- ---------------------------------------------------------------------
-- sp_check_room_availability
--   Lists every room that can host the requested number of guests for
--   the requested date range.
--
--   Blocking statuses are Pending, Confirmed and Checked_In.
--   Cancelled and Checked_Out reservations never block a room.
--   Overlap rule: existing_check_in < requested_check_out
--                 AND existing_check_out > requested_check_in
--   This allows one guest to check out on the same date that another
--   guest checks in.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_check_room_availability(
    IN p_check_in DATE,
    IN p_check_out DATE,
    IN p_guests INT
)
BEGIN
    IF p_check_in IS NULL OR p_check_out IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Both check-in and check-out dates are required.';
    END IF;

    IF p_guests IS NULL OR p_guests < 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Number of guests must be at least 1.';
    END IF;

    IF p_check_out <= p_check_in THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;

    SELECT r.room_id,
           r.room_number,
           r.floor_no,
           rt.type_name,
           rt.capacity,
           rt.base_price,
           DATEDIFF(p_check_out, p_check_in) AS nights,
           rt.base_price * DATEDIFF(p_check_out, p_check_in) AS estimated_total
    FROM room r
    JOIN room_type rt ON rt.room_type_id = r.room_type_id
    WHERE r.room_status = 'Available'
      AND rt.capacity >= p_guests
      AND NOT EXISTS (
            SELECT 1
            FROM reservation res
            WHERE res.room_id = r.room_id
              AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
              AND p_check_in  < res.check_out_date
              AND p_check_out > res.check_in_date
      )
    ORDER BY rt.base_price, r.room_number;
END$$

-- ---------------------------------------------------------------------
-- sp_create_reservation
--   Creates a confirmed reservation inside one transaction.
--
--   Steps
--     1. Validate the input (customer, room, dates, guest counts).
--     2. Lock the room row (FOR UPDATE) so that two staff members
--        cannot book the same room for the same dates at the same time.
--     3. Verify the room is Available and that the party fits.
--     4. Calculate the bill = room type price x number of nights.
--     5. Insert the reservation (the BEFORE INSERT trigger re-checks
--        the overlap as a locking read).
--     6. COMMIT. On any error the EXIT handler issues ROLLBACK and
--        re-signals, so a partial reservation is never stored.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_create_reservation(
    IN p_customer_id INT,
    IN p_room_id     INT,
    IN p_check_in    DATE,
    IN p_check_out   DATE,
    IN p_adults      INT,
    IN p_children    INT,
    IN p_remarks     VARCHAR(255)
)
BEGIN
    DECLARE v_price         DECIMAL(10,2);
    DECLARE v_total         DECIMAL(10,2);
    DECLARE v_room_status   VARCHAR(20);
    DECLARE v_capacity      INT DEFAULT 0;
    DECLARE v_nights        INT DEFAULT 0;
    DECLARE v_type_name     VARCHAR(50);
    DECLARE v_customer_ok   INT DEFAULT 0;
    DECLARE v_overlap_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- ---- 1. input validation -------------------------------------
    IF p_customer_id IS NULL OR p_customer_id <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A valid customer is required.';
    END IF;

    IF p_room_id IS NULL OR p_room_id <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A valid room is required.';
    END IF;

    IF p_check_in IS NULL OR p_check_out IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Both check-in and check-out dates are required.';
    END IF;

    IF p_check_out <= p_check_in THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;

    IF p_adults IS NULL OR p_adults < 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'At least one adult is required.';
    END IF;

    IF p_children IS NULL OR p_children < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Number of children cannot be negative.';
    END IF;

    START TRANSACTION;

    -- ---- 2. lock the room row -------------------------------------
    -- Only the `room` row is locked. Locking the joined room_type row
    -- as well would needlessly serialise bookings of different rooms
    -- that happen to share the same type.
    --
    -- This is the first read of the transaction and it is a LOCKING
    -- read, so it does not create a consistent-read snapshot. Every
    -- read after this point therefore sees the data as it is at that
    -- moment, which is exactly what the overlap check needs.
    SELECT room_status INTO v_room_status
    FROM room WHERE room_id = p_room_id FOR UPDATE;

    IF v_room_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The selected room does not exist.';
    END IF;

    IF v_room_status <> 'Available' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The selected room is not available for booking.';
    END IF;

    -- ---- 3. customer, capacity and overlap validation -------------
    SELECT COUNT(*) INTO v_customer_ok
    FROM customer WHERE customer_id = p_customer_id;

    IF v_customer_ok = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The selected customer does not exist.';
    END IF;

    SELECT rt.base_price, rt.capacity, rt.type_name
    INTO v_price, v_capacity, v_type_name
    FROM room_type rt
    JOIN room r ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = p_room_id;

    -- Capacity check
    IF (p_adults + p_children) > v_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The number of guests exceeds the capacity of this room type.';
    END IF;

    -- Overlap check. The read view used here was created after the
    -- room lock was granted, so it contains the committed booking of
    -- any session that booked this room before us.
    SELECT COUNT(*) INTO v_overlap_count
    FROM reservation res
    WHERE res.room_id = p_room_id
      AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
      AND p_check_in  < res.check_out_date
      AND p_check_out > res.check_in_date;

    IF v_overlap_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Room is already reserved for part of these dates.';
    END IF;

    -- ---- 4. calculate the bill -----------------------------------
    SET v_nights = DATEDIFF(p_check_out, p_check_in);
    SET v_total  = v_price * v_nights;

    -- ---- 5. insert (trigger repeats the validation) --------------
    INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                            adults, children, reservation_status, total_amount, remarks)
    VALUES (p_customer_id, p_room_id, p_check_in, p_check_out,
            p_adults, p_children, 'Confirmed', v_total, p_remarks);

    -- ---- 6. commit ------------------------------------------------
    COMMIT;

    SELECT LAST_INSERT_ID() AS new_reservation_id,
           v_total           AS total_bill,
           v_nights          AS nights,
           v_type_name       AS room_type;
END$$

-- ---------------------------------------------------------------------
-- sp_record_payment
--   Records a simulated payment against a reservation.
--
--   The parent reservation row is locked (FOR UPDATE) before the
--   balance is calculated, so two concurrent payments for the same
--   booking cannot both pass the balance test.
--
--   Balance rule: only payment_status = 'Paid' counts towards the
--   amount paid. 'Pending' and 'Failed' payments are stored for audit
--   but do not reduce the balance; 'Refunded' means money was returned
--   and therefore also does not reduce the balance.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_record_payment(
    IN p_reservation_id INT,
    IN p_amount         DECIMAL(10,2),
    IN p_method         VARCHAR(20),
    IN p_reference      VARCHAR(60),
    IN p_status         VARCHAR(20)
)
BEGIN
    DECLARE v_bill     DECIMAL(10,2);
    DECLARE v_paid     DECIMAL(10,2) DEFAULT 0;
    DECLARE v_balance  DECIMAL(10,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_reservation_id IS NULL OR p_reservation_id <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A valid reservation is required.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment amount must be greater than zero.';
    END IF;

    IF p_method IS NULL OR p_method NOT IN ('Cash','Card','UPI','Bank_Transfer') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid payment method.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('Paid','Pending','Refunded','Failed') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid payment status.';
    END IF;

    START TRANSACTION;

    -- Lock the reservation row: this serialises concurrent payments
    -- for the same booking.
    SELECT total_amount INTO v_bill
    FROM reservation WHERE reservation_id = p_reservation_id FOR UPDATE;

    IF v_bill IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The reservation does not exist.';
    END IF;

    -- Normal read of the already paid amount. It happens after the
    -- reservation row was locked, so the read view is fresh and
    -- contains every payment that was committed before the lock was
    -- granted.
    SELECT COALESCE(SUM(p.amount), 0) INTO v_paid
    FROM payment p
    WHERE p.reservation_id = p_reservation_id
      AND p.payment_status = 'Paid';

    SET v_balance = v_bill - v_paid;

    IF p_status = 'Paid' AND v_paid + p_amount > v_bill THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment is greater than the remaining balance of this reservation.';
    END IF;

    INSERT INTO payment(reservation_id, amount, payment_method, payment_status, transaction_reference)
    VALUES (p_reservation_id, p_amount, p_method, p_status, p_reference);

    COMMIT;

    SELECT LAST_INSERT_ID()            AS payment_id,
           v_bill                      AS bill_amount,
           v_paid + (CASE WHEN p_status = 'Paid' THEN p_amount ELSE 0 END) AS paid_amount,
           v_bill - (v_paid + (CASE WHEN p_status = 'Paid' THEN p_amount ELSE 0 END)) AS balance_due;
END$$

DELIMITER ;

SELECT 'Procedures created.' AS procedure_status;
