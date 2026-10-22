/**
 * Report service.
 *
 * Seven reports, each one a real SELECT executed by MySQL.
 * Every report that has a natural date filter accepts one.
 */
import { query, queryOne } from '../db/pool.js';

/** 1. Reservation details. */
export async function reservationDetails({ from = null, to = null, status = null } = {}) {
  const where = [];
  const params = [];
  if (from) { where.push('v.check_out_date > ?'); params.push(from); }
  if (to) { where.push('v.check_in_date < ?'); params.push(to); }
  if (status) { where.push('v.reservation_status = ?'); params.push(status); }

  const rows = await query(
    `SELECT reservation_id, customer_name, phone, room_number, room_type, check_in_date,
            check_out_date, nights, reservation_status, total_amount, paid_amount, balance_due
     FROM vw_reservation_details v
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY v.check_in_date DESC, v.reservation_id DESC`,
    params,
  );

  const totals = await queryOne(
    `SELECT COUNT(*) AS reservations, COALESCE(SUM(total_amount),0) AS billed,
            COALESCE(SUM(paid_amount),0) AS collected, COALESCE(SUM(balance_due),0) AS outstanding
     FROM vw_reservation_details v
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return { rows, totals };
}

/** 2. Rooms available for a date range. */
export async function availableRooms({ check_in, check_out }) {
  const rows = await query(
    `SELECT r.room_id, r.room_number, r.floor_no, rt.type_name, rt.base_price, rt.capacity
     FROM room r
     JOIN room_type rt ON rt.room_type_id = r.room_type_id
     WHERE r.room_status = 'Available'
       AND NOT EXISTS (
             SELECT 1 FROM reservation res
             WHERE res.room_id = r.room_id
               AND res.reservation_status IN ('Pending','Confirmed','Checked_In')
               AND ? < res.check_out_date
               AND ? > res.check_in_date)
     ORDER BY rt.base_price, r.room_number`,
    [check_in, check_out],
  );
  return { check_in, check_out, rows };
}

/** 3. Booking count by room type. */
export async function bookingsByRoomType() {
  const rows = await query(
    `SELECT type_name, total_rooms, total_bookings, base_price, total_revenue
     FROM vw_room_type_booking_stats
     ORDER BY total_bookings DESC, type_name`,
  );
  return { rows };
}

/** 4. Revenue by room type. */
export async function revenueByRoomType({ from = null, to = null } = {}) {
  const where = ["res.reservation_status <> 'Cancelled'"];
  const params = [];
  if (from) { where.push('res.check_out_date > ?'); params.push(from); }
  if (to) { where.push('res.check_in_date < ?'); params.push(to); }

  const rows = await query(
    `SELECT rt.type_name,
            COUNT(res.reservation_id)          AS bookings,
            COALESCE(SUM(res.total_amount), 0) AS revenue,
            COALESCE(AVG(res.total_amount), 0) AS average_booking_value
     FROM room_type rt
     LEFT JOIN room r ON r.room_type_id = rt.room_type_id
     LEFT JOIN reservation res ON res.room_id = r.room_id AND ${where.join(' AND ')}
     GROUP BY rt.room_type_id, rt.type_name
     ORDER BY revenue DESC`,
    params,
  );
  return { rows };
}

/** 5. Payments collected during a date range. */
export async function paymentsCollected({ from, to }) {
  const rows = await query(
    `SELECT payment_id, payment_date, customer_name, room_number, payment_method,
            payment_status, amount, transaction_reference
     FROM vw_payments_collected
     WHERE payment_date >= ? AND payment_date < DATE_ADD(?, INTERVAL 1 DAY)
     ORDER BY payment_date DESC, payment_id DESC`,
    [from, to],
  );

  const totals = await queryOne(
    `SELECT COUNT(*) AS payment_rows,
            COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0) AS total_collected,
            COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN 1 ELSE 0 END), 0)     AS successful_payments,
            COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN amount ELSE 0 END), 0) AS total_pending,
            COALESCE(SUM(CASE WHEN payment_status = 'Refunded' THEN amount ELSE 0 END), 0) AS total_refunded,
            COALESCE(SUM(CASE WHEN payment_status = 'Failed' THEN amount ELSE 0 END), 0) AS total_failed
     FROM vw_payments_collected
     WHERE payment_date >= ? AND payment_date < DATE_ADD(?, INTERVAL 1 DAY)`,
    [from, to],
  );
  return { from, to, rows, totals };
}

/** 6. Outstanding balances. */
export async function outstandingBalances({ from = null, to = null } = {}) {
  const where = [];
  const params = [];
  if (from) { where.push('v.check_out_date > ?'); params.push(from); }
  if (to) { where.push('v.check_in_date < ?'); params.push(to); }

  const rows = await query(
    `SELECT v.reservation_id, v.customer_name, v.phone, v.room_number, v.room_type,
            v.check_in_date, v.check_out_date, v.reservation_status,
            v.total_amount, v.paid_amount, v.balance_due
     FROM vw_outstanding_balances v
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY v.balance_due DESC, v.reservation_id`,
    params,
  );

  const totals = await queryOne(
    `SELECT COUNT(*) AS reservations_with_balance,
            COALESCE(SUM(balance_due), 0) AS total_outstanding
     FROM vw_outstanding_balances v
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  return { rows, totals };
}

/** 7. Reservation status history. */
export async function statusHistory({ from = null, to = null, reservation_id = null } = {}) {
  const where = [];
  const params = [];
  if (from) { where.push('l.changed_at >= ?'); params.push(from); }
  if (to) { where.push('l.changed_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }
  if (reservation_id) { where.push('l.reservation_id = ?'); params.push(reservation_id); }

  const rows = await query(
    `SELECT l.log_id, l.reservation_id, l.customer_name, l.room_number,
            l.old_status, l.new_status, l.changed_at, l.changed_by
     FROM vw_status_history l
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY l.changed_at DESC, l.log_id DESC`,
    params,
  );
  return { rows };
}

export default {
  reservationDetails,
  availableRooms,
  bookingsByRoomType,
  revenueByRoomType,
  paymentsCollected,
  outstandingBalances,
  statusHistory,
};
