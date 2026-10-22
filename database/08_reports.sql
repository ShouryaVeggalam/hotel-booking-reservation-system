-- =====================================================================
-- 08_reports.sql  |  The seven required database reports
--
-- Every report is a real SELECT executed by MySQL. The backend report
-- module runs the same statements through the mysql2 driver, so the
-- numbers on the screen are always produced by the database.
--
-- All of them accept a date filter where a date filter makes sense.
-- The placeholders below use concrete dates from the sample data so
-- that the script can be pasted straight into MySQL Workbench.
-- =====================================================================

USE hotel_booking_db;

-- =====================================================================
-- REPORT 1 - Reservation details
--   Every booking with the guest, the room, the stay, the bill, the
--   amount paid and the outstanding balance.
-- =====================================================================
SELECT reservation_id, customer_name, phone, room_number, room_type,
       check_in_date, check_out_date, nights, reservation_status,
       total_amount, paid_amount, balance_due
FROM vw_reservation_details
ORDER BY check_in_date, reservation_id;

-- =====================================================================
-- REPORT 2 - Available rooms
--   Rooms that are free for a requested date range. The same overlap
--   rule as everywhere else is applied:
--       existing_check_in  < requested_check_out
--       existing_check_out > requested_check_in
-- =====================================================================
SELECT r.room_id, r.room_number, r.floor_no, rt.type_name, rt.base_price, rt.capacity
FROM room r
JOIN room_type rt ON rt.room_type_id = r.room_type_id
WHERE r.room_status = 'Available'
  AND NOT EXISTS (
        SELECT 1 FROM reservation res
        WHERE res.room_id = r.room_id
          AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
          AND '2026-11-05' < res.check_out_date
          AND '2026-11-08' > res.check_in_date
      )
ORDER BY rt.base_price, r.room_number;

-- =====================================================================
-- REPORT 3 - Booking count by room type
--   GROUP BY + COUNT, with a HAVING clause that removes the room
--   types that have never been booked.
-- =====================================================================
SELECT type_name,
       total_rooms,
       total_bookings,
       base_price,
       total_revenue
FROM vw_room_type_booking_stats
GROUP BY room_type_id, type_name, total_rooms, total_bookings, base_price, total_revenue
HAVING total_bookings > 0
ORDER BY total_bookings DESC, type_name;

-- =====================================================================
-- REPORT 4 - Revenue by room type
--   The money earned per room category. Cancelled reservations are
--   excluded because they produce no revenue.
-- =====================================================================
SELECT rt.type_name,
       COUNT(res.reservation_id)              AS bookings,
       COALESCE(SUM(res.total_amount), 0)     AS revenue,
       COALESCE(AVG(res.total_amount), 0)     AS average_booking_value
FROM room_type rt
LEFT JOIN room r ON r.room_type_id = rt.room_type_id
LEFT JOIN reservation res ON res.room_id = r.room_id
                           AND res.reservation_status <> 'Cancelled'
GROUP BY rt.room_type_id, rt.type_name
ORDER BY revenue DESC;

-- =====================================================================
-- REPORT 5 - Payments collected during a date range
--   Only 'Paid' payments are counted towards the collected total.
--   Pending, Failed and Refunded rows are still listed so that the
--   manager can see them, but they do not add to the total.
-- =====================================================================
SELECT p.payment_id,
       p.payment_date,
       p.customer_name,
       p.room_number,
       p.payment_method,
       p.payment_status,
       p.amount,
       p.transaction_reference
FROM vw_payments_collected p
WHERE p.payment_date BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY p.payment_date DESC, p.payment_id DESC;

SELECT COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0) AS total_collected,
       COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END), 0)     AS successful_payments,
       COUNT(*)                                                                 AS total_payment_rows
FROM vw_payments_collected
WHERE payment_date BETWEEN '2026-01-01' AND '2026-12-31';

-- =====================================================================
-- REPORT 6 - Outstanding balances
--   Who still owes money, and how much.
-- =====================================================================
SELECT reservation_id, customer_name, phone, room_number, room_type,
       check_in_date, check_out_date, reservation_status,
       total_amount, paid_amount, balance_due
FROM vw_outstanding_balances
ORDER BY balance_due DESC, reservation_id;

SELECT COUNT(*)            AS reservations_with_balance,
       COALESCE(SUM(balance_due), 0) AS total_outstanding
FROM vw_outstanding_balances;

-- =====================================================================
-- REPORT 7 - Reservation status history
--   The audit trail: every status change, with who made it and when.
-- =====================================================================
SELECT log_id, reservation_id, customer_name, room_number,
       old_status, new_status, changed_at, changed_by
FROM vw_status_history
ORDER BY changed_at DESC, log_id DESC;

-- =====================================================================
-- BONUS - Advanced SQL showcase for the lab record
-- =====================================================================

-- (a) INNER JOIN + GROUP BY + HAVING: bookings per customer that are
--     worth more than the average booking.
SELECT c.customer_id,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       COUNT(res.reservation_id) AS bookings,
       SUM(res.total_amount)     AS total_spent
FROM customer c
JOIN reservation res ON res.customer_id = c.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name
HAVING total_spent > (SELECT AVG(total_amount) FROM reservation)
ORDER BY total_spent DESC;

-- (b) Subquery: the room type that generates the most revenue.
SELECT rt.type_name, totals.revenue
FROM room_type rt
JOIN (
        SELECT r.room_type_id, SUM(res.total_amount) AS revenue
        FROM reservation res
        JOIN room r ON r.room_id = res.room_id
        WHERE res.reservation_status <> 'Cancelled'
        GROUP BY r.room_type_id
     ) totals ON totals.room_type_id = rt.room_type_id
ORDER BY totals.revenue DESC
LIMIT 1;

-- (c) LEFT JOIN + COUNT: every room type including the ones with no
--     booking at all.
SELECT rt.type_name,
       COUNT(res.reservation_id) AS bookings,
       COALESCE(SUM(res.total_amount), 0) AS revenue
FROM room_type rt
LEFT JOIN room r ON r.room_type_id = rt.room_type_id
LEFT JOIN reservation res ON res.room_id = r.room_id
                           AND res.reservation_status <> 'Cancelled'
GROUP BY rt.room_type_id, rt.type_name
ORDER BY rt.room_type_id;

-- (d) Correlated subquery: reservations with no payment recorded.
SELECT v.reservation_id, v.customer_name, v.total_amount
FROM vw_reservation_details v
WHERE NOT EXISTS (
        SELECT 1 FROM payment p
        WHERE p.reservation_id = v.reservation_id
          AND p.payment_status = 'Paid'
      )
ORDER BY v.reservation_id;

-- (e) Occupancy: how many nights of each room were sold.
SELECT rt.type_name,
       SUM(DATEDIFF(res.check_out_date, res.check_in_date)) AS sold_nights
FROM reservation res
JOIN room r ON r.room_id = res.room_id
JOIN room_type rt ON rt.room_type_id = r.room_type_id
WHERE res.reservation_status <> 'Cancelled'
GROUP BY rt.room_type_id, rt.type_name
ORDER BY sold_nights DESC;
