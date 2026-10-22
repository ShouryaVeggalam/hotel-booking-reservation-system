-- =====================================================================
-- 06_triggers.sql  |  Triggers - integrity rules and audit trail
--
--   trg_reservation_before_insert   - validate + lock + reject overlap
--   trg_reservation_before_update   - validate + reject invalid updates
--   trg_reservation_status_audit    - AFTER UPDATE, write the audit trail
--   trg_reservation_after_insert    - AFTER INSERT, record the creation
--   trg_payment_before_insert       - reject payment above the balance
--
-- Every rule below is enforced by the DATABASE, not only by the
-- application. A booking inserted directly through the MySQL client
-- obeys exactly the same rules as a booking created in the web UI.
--
-- SAFE: the triggers are dropped and recreated. No table data is
-- touched.
-- =====================================================================

USE hotel_booking_db;

DROP TRIGGER IF EXISTS trg_reservation_before_insert;
DROP TRIGGER IF EXISTS trg_reservation_before_update;
DROP TRIGGER IF EXISTS trg_reservation_status_audit;
DROP TRIGGER IF EXISTS trg_reservation_after_insert;
DROP TRIGGER IF EXISTS trg_payment_before_insert;

DELIMITER $$

-- ---------------------------------------------------------------------
-- trg_reservation_before_insert
--
--   Guards every new booking, no matter which client issues it.
--
--   Rule 1  check-out must be strictly after check-in.
--   Rule 2  the room must exist and be 'Available'.
--           The room row is read with FOR UPDATE. This is the
--           concurrency control point: every booking path locks the
--           same room row, so two sessions cannot book the same room
--           for the same dates at the same time.
--   Rule 3  the party must fit into the room type capacity.
--   Rule 4  no blocking reservation may overlap the new dates.
--           Overlap rule:
--               existing_check_in  <  NEW.check_out_date
--               existing_check_out >  NEW.check_in_date
--           Blocking statuses: Pending, Confirmed, Checked_In.
--           Cancelled and Checked_Out reservations never block.
--
--   WHY THE OVERLAP COUNT IS NOT WRITTEN WITH FOR UPDATE
--   A locking read (FOR UPDATE) on the reservation table is not
--   allowed from inside a trigger that fires on the reservation table
--   (MySQL error 1442). The correct order is:
--       1. lock the ROOM row (a locking read on a different table)
--       2. only then read the reservation table with a normal read
--   Because the room lock is taken first, every competing booking for
--   that room has already committed before the reservation table is
--   read, and the read view created at step 2 is therefore fresh.
--   This is what makes the double-booking protection work under
--   real concurrency instead of only in single-session tests.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_reservation_before_insert
BEFORE INSERT ON reservation
FOR EACH ROW
BEGIN
    DECLARE v_overlap_count   INT DEFAULT 0;
    DECLARE v_room_status     VARCHAR(20);
    DECLARE v_capacity        INT DEFAULT 0;

    -- Rule 1
    IF NEW.check_out_date <= NEW.check_in_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;

    -- Rule 2 - locking read of the room row
    SELECT room_status INTO v_room_status
    FROM room WHERE room_id = NEW.room_id FOR UPDATE;

    IF v_room_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The selected room does not exist.';
    END IF;

    IF v_room_status <> 'Available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This room is not available for booking.';
    END IF;

    -- Rule 3
    SELECT rt.capacity INTO v_capacity
    FROM room_type rt
    JOIN room r ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    IF v_capacity IS NOT NULL AND (NEW.adults + NEW.children) > v_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The number of guests exceeds the capacity of this room type.';
    END IF;

    -- Rule 4 - overlap check.
    -- The read view used here was created by the capacity read above,
    -- which happens after the room lock was granted, so it is fresh.
    IF NEW.reservation_status IN ('Pending','Confirmed','Checked_In') THEN
        SELECT COUNT(*) INTO v_overlap_count
        FROM reservation res
        WHERE res.room_id = NEW.room_id
          AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
          AND NEW.check_in_date  < res.check_out_date
          AND NEW.check_out_date > res.check_in_date;

        IF v_overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Room is already reserved for part of these dates.';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- trg_reservation_before_update
--
--   Guards every UPDATE of an existing reservation.
--
--   Rule 1  check-out must still be strictly after check-in.
--   Rule 2  a completed stay cannot be re-dated or moved.
--   Rule 3  a cancelled reservation cannot be reactivated.
--   Rule 4  the party must still fit the room type capacity.
--   Rule 5  the update must not create an overlap with another
--           reservation. The room row is locked again so that a
--           concurrent booking cannot slip in between the check and
--           the update.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_reservation_before_update
BEFORE UPDATE ON reservation
FOR EACH ROW
BEGIN
    DECLARE v_overlap_count INT DEFAULT 0;
    DECLARE v_room_status   VARCHAR(20);
    DECLARE v_capacity      INT DEFAULT 0;

    -- Rule 1
    IF NEW.check_out_date <= NEW.check_in_date THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Check-out date must be after check-in date.';
    END IF;

    -- Rule 2
    IF OLD.reservation_status = 'Checked_Out'
       AND (NEW.check_in_date <> OLD.check_in_date
         OR NEW.check_out_date <> OLD.check_out_date
         OR NEW.room_id <> OLD.room_id) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A completed stay cannot be re-dated or moved to another room.';
    END IF;

    -- Rule 3
    IF OLD.reservation_status = 'Cancelled'
       AND NEW.reservation_status IN ('Pending','Confirmed','Checked_In') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A cancelled reservation cannot be reactivated.';
    END IF;

    -- Rule 4
    SELECT rt.capacity INTO v_capacity
    FROM room_type rt
    JOIN room r ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    IF v_capacity IS NOT NULL AND (NEW.adults + NEW.children) > v_capacity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'The number of guests exceeds the capacity of this room type.';
    END IF;

    -- Rule 5 - lock the room row, then look for overlaps
    IF NEW.reservation_status IN ('Pending','Confirmed','Checked_In') THEN
        SELECT room_status INTO v_room_status
        FROM room WHERE room_id = NEW.room_id FOR UPDATE;

        IF v_room_status IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'The selected room does not exist.';
        END IF;

        SELECT COUNT(*) INTO v_overlap_count
        FROM reservation res
        WHERE res.room_id = NEW.room_id
          AND res.reservation_id <> OLD.reservation_id
          AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
          AND NEW.check_in_date  < res.check_out_date
          AND NEW.check_out_date > res.check_in_date;

        IF v_overlap_count > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Update would create an overlapping reservation.';
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- trg_reservation_status_audit
--
--   AFTER UPDATE - writes one audit row whenever the status really
--   changes. The BEFORE trigger has already validated the update, so
--   this trigger only records what happened.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_reservation_status_audit
AFTER UPDATE ON reservation
FOR EACH ROW
BEGIN
    IF NOT (OLD.reservation_status <=> NEW.reservation_status) THEN
        INSERT INTO reservation_status_log(reservation_id, old_status, new_status, changed_by)
        VALUES (NEW.reservation_id, OLD.reservation_status, NEW.reservation_status, CURRENT_USER());
    END IF;
END$$

-- ---------------------------------------------------------------------
-- trg_reservation_after_insert
--
--   AFTER INSERT - records the creation of the booking in the audit
--   trail so that the history starts with the creation event and not
--   only with the first status change.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_reservation_after_insert
AFTER INSERT ON reservation
FOR EACH ROW
BEGIN
    INSERT INTO reservation_status_log(reservation_id, old_status, new_status, changed_by)
    VALUES (NEW.reservation_id, NULL, NEW.reservation_status, CURRENT_USER());
END$$

-- ---------------------------------------------------------------------
-- trg_payment_before_insert
--
--   Guards every payment row.
--
--   Rule 1  the reservation must exist.
--   Rule 2  the payment may not push the paid total above the bill.
--           The reservation row is locked with FOR UPDATE before the
--           balance is calculated, so two concurrent payments for the
--           same booking cannot both pass this test.
--           Only payment_status = 'Paid' contributes to the paid total.
--
--           The SUM over the payment table is a normal read, not a
--           locking read, because a locking read on the payment table
--           is not allowed from inside a trigger on the payment table
--           (MySQL error 1442). The read is safe because it happens
--           after the reservation row has been locked: any competing
--           payment for the same reservation must first acquire that
--           same lock and therefore has already committed.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_payment_before_insert
BEFORE INSERT ON payment
FOR EACH ROW
BEGIN
    DECLARE v_bill       DECIMAL(10,2);
    DECLARE v_paid_total DECIMAL(10,2) DEFAULT 0;

    -- Lock the parent reservation row.
    SELECT total_amount INTO v_bill
    FROM reservation WHERE reservation_id = NEW.reservation_id FOR UPDATE;

    IF v_bill IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Reservation does not exist.';
    END IF;

    SELECT COALESCE(SUM(p.amount), 0) INTO v_paid_total
    FROM payment p
    WHERE p.reservation_id = NEW.reservation_id
      AND p.payment_status = 'Paid';

    IF NEW.payment_status = 'Paid' AND v_paid_total + NEW.amount > v_bill THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment is greater than the remaining bill amount.';
    END IF;
END$$

DELIMITER ;

SELECT 'Triggers created.' AS trigger_status;
