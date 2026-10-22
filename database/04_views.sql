-- =====================================================================
-- 04_views.sql  |  Reporting views
--
-- A view is a stored query that behaves like a table. The application
-- and the report module read from these views, so every report number
-- shown on screen is produced by the database, not by the frontend.
--
-- SAFE: CREATE OR REPLACE VIEW never drops a table and never deletes
-- data.
-- =====================================================================

USE hotel_booking_db;

-- ---------------------------------------------------------------------
-- vw_reservation_details
--   One row per reservation with the guest, the room, the number of
--   nights, the bill, the amount actually paid and the balance due.
--   Uses an INNER JOIN chain (customer, room, room_type) and a LEFT
--   JOIN to payment so that a reservation without any payment still
--   appears with a balance of the full bill.
--   Balance rule: only payment_status = 'Paid' reduces the balance.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_reservation_details AS
SELECT res.reservation_id,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       c.phone,
       c.email,
       r.room_number,
       rt.type_name AS room_type,
       res.check_in_date,
       res.check_out_date,
       DATEDIFF(res.check_out_date, res.check_in_date) AS nights,
       res.reservation_status,
       res.booking_date,
       res.total_amount,
       COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0 END), 0) AS paid_amount,
       res.total_amount
         - COALESCE(SUM(CASE WHEN p.payment_status = 'Paid' THEN p.amount ELSE 0 END), 0) AS balance_due
FROM reservation res
JOIN customer  c  ON c.customer_id  = res.customer_id
JOIN room      r  ON r.room_id      = res.room_id
JOIN room_type rt ON rt.room_type_id = r.room_type_id
LEFT JOIN payment p ON p.reservation_id = res.reservation_id
GROUP BY res.reservation_id, c.first_name, c.last_name, c.phone, c.email,
         r.room_number, rt.type_name, res.check_in_date, res.check_out_date,
         res.reservation_status, res.booking_date, res.total_amount;

-- ---------------------------------------------------------------------
-- vw_room_revenue
--   Bookings and revenue per physical room. A LEFT JOIN keeps rooms
--   that have never been booked in the result.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_room_revenue AS
SELECT r.room_id,
       r.room_number,
       rt.type_name,
       COUNT(res.reservation_id) AS number_of_reservations,
       COALESCE(SUM(res.total_amount), 0) AS booked_revenue
FROM room r
JOIN room_type rt ON rt.room_type_id = r.room_type_id
LEFT JOIN reservation res ON res.room_id = r.room_id
                           AND res.reservation_status <> 'Cancelled'
GROUP BY r.room_id, r.room_number, rt.type_name;

-- ---------------------------------------------------------------------
-- vw_room_type_booking_stats
--   Booking count and revenue per room type. Used by the
--   "bookings by room type" and "revenue by room type" reports.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_room_type_booking_stats AS
SELECT rt.room_type_id,
       rt.type_name,
       rt.base_price,
       rt.capacity,
       COUNT(DISTINCT r.room_id) AS total_rooms,
       COUNT(res.reservation_id) AS total_bookings,
       COALESCE(SUM(res.total_amount), 0) AS total_revenue
FROM room_type rt
LEFT JOIN room r ON r.room_type_id = rt.room_type_id
LEFT JOIN reservation res ON res.room_id = r.room_id
                           AND res.reservation_status <> 'Cancelled'
GROUP BY rt.room_type_id, rt.type_name, rt.base_price, rt.capacity;

-- ---------------------------------------------------------------------
-- vw_payments_collected
--   Every payment row joined to its reservation, guest and room.
--   The report layer filters this view by payment_date and by
--   payment_status to produce the "payments collected" report.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_payments_collected AS
SELECT p.payment_id,
       p.reservation_id,
       p.payment_date,
       p.amount,
       p.payment_method,
       p.payment_status,
       p.transaction_reference,
       res.total_amount AS bill_amount,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       r.room_number
FROM payment p
JOIN reservation res ON res.reservation_id = p.reservation_id
JOIN customer  c  ON c.customer_id  = res.customer_id
JOIN room      r  ON r.room_id      = res.room_id;

-- ---------------------------------------------------------------------
-- vw_outstanding_balances
--   Reservations that still owe money. Cancelled reservations are
--   excluded because a cancelled booking has no payable balance.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_outstanding_balances AS
SELECT v.reservation_id,
       v.customer_name,
       v.phone,
       v.room_number,
       v.room_type,
       v.check_in_date,
       v.check_out_date,
       v.reservation_status,
       v.total_amount,
       v.paid_amount,
       v.balance_due
FROM vw_reservation_details v
WHERE v.balance_due > 0
  AND v.reservation_status <> 'Cancelled';

-- ---------------------------------------------------------------------
-- vw_available_rooms_today
--   Rooms that are free right now: room_status = 'Available' and no
--   blocking reservation covering today.
--   The blocking statuses are the same three used everywhere in this
--   project: Pending, Confirmed, Checked_In.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_available_rooms_today AS
SELECT r.room_id,
       r.room_number,
       r.floor_no,
       rt.type_name,
       rt.base_price,
       rt.capacity
FROM room r
JOIN room_type rt ON rt.room_type_id = r.room_type_id
WHERE r.room_status = 'Available'
  AND NOT EXISTS (
        SELECT 1
        FROM reservation res
        WHERE res.room_id = r.room_id
          AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
          AND CURRENT_DATE() < res.check_out_date
          AND CURRENT_DATE() >= res.check_in_date
  );

-- ---------------------------------------------------------------------
-- vw_status_history
--   The audit trail enriched with the guest and room, used by the
--   "reservation status history" report.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_status_history AS
SELECT l.log_id,
       l.reservation_id,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       r.room_number,
       l.old_status,
       l.new_status,
       l.changed_at,
       l.changed_by
FROM reservation_status_log l
JOIN reservation res ON res.reservation_id = l.reservation_id
JOIN customer  c  ON c.customer_id  = res.customer_id
JOIN room      r  ON r.room_id      = res.room_id;

SELECT 'Views created.' AS view_status;
