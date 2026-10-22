/**
 * Dashboard service.
 *
 * Every number on the dashboard is produced by a real SQL query.
 * There is no hard coded sample data anywhere in this project.
 */
import { query, queryOne } from '../db/pool.js';

/**
 * Build the dashboard payload for one day.
 * @param {string} date the day to report on, YYYY-MM-DD
 */
export async function getDashboard(date) {
  const summary = await queryOne(
    `SELECT
        (SELECT COUNT(*) FROM room)                                          AS total_rooms,
        (SELECT COUNT(*) FROM room WHERE room_status = 'Available')         AS available_rooms,
        (SELECT COUNT(*) FROM room
          WHERE room_status = 'Available'
            AND NOT EXISTS (
                SELECT 1 FROM reservation res
                WHERE res.room_id = room.room_id
                  AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
                  AND ? < res.check_out_date
                  AND ? >= res.check_in_date))                              AS free_rooms_today,
        (SELECT COUNT(*) FROM reservation
          WHERE reservation_status IN ('Pending','Confirmed','Checked_In'))  AS active_reservations,
        (SELECT COUNT(*) FROM reservation WHERE check_in_date = ?)          AS check_ins_today,
        (SELECT COUNT(*) FROM reservation WHERE check_out_date = ?)         AS check_outs_today,
        (SELECT COUNT(*) FROM reservation
          WHERE reservation_status = 'Checked_In')                          AS checked_in_guests,
        (SELECT COALESCE(SUM(amount), 0) FROM payment
          WHERE payment_status = 'Paid')                                    AS total_payments_collected,
        (SELECT COALESCE(SUM(total_amount), 0) FROM reservation
          WHERE reservation_status <> 'Cancelled')                          AS booked_revenue,
        (SELECT COALESCE(SUM(balance_due), 0) FROM vw_reservation_details
          WHERE reservation_status <> 'Cancelled')                          AS outstanding_balance,
        (SELECT COUNT(*) FROM customer)                                     AS registered_customers`,
    [date, date, date, date],
  );

  const recentReservations = await query(
    `SELECT reservation_id, customer_name, phone, room_number, room_type,
            check_in_date, check_out_date, nights, reservation_status,
            total_amount, paid_amount, balance_due
     FROM vw_reservation_details
     ORDER BY booking_date DESC, reservation_id DESC
     LIMIT 10`,
  );

  const rooms = await query(
    `SELECT r.room_id, r.room_number, r.floor_no, r.room_status,
            rt.type_name, rt.capacity, rt.base_price,
            (SELECT COUNT(*) FROM reservation res
              WHERE res.room_id = r.room_id
                AND res.reservation_status IN ('Pending','Confirmed','Checked_In')) AS active_bookings
     FROM room r
     JOIN room_type rt ON rt.room_type_id = r.room_type_id
     ORDER BY r.room_number`,
  );

  const movements = await query(
    `SELECT res.reservation_id, res.check_in_date, res.check_out_date, res.reservation_status,
            CONCAT(c.first_name, ' ', c.last_name) AS customer_name, r.room_number
     FROM reservation res
     JOIN customer c ON c.customer_id = res.customer_id
     JOIN room     r ON r.room_id     = res.room_id
     WHERE res.check_in_date = ? OR res.check_out_date = ?
     ORDER BY res.check_in_date, res.reservation_id`,
    [date, date],
  );

  return { date, summary, recent_reservations: recentReservations, rooms, movements };
}

export default { getDashboard };
