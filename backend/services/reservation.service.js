/**
 * Reservation service.
 *
 * Booking is delegated to the stored procedure sp_create_reservation,
 * which owns the transaction, the room lock, the validation and the
 * bill calculation. The API layer therefore cannot create a booking
 * that the database would reject.
 */
import { query, queryOne, execute, callProcedure } from '../db/pool.js';
import ApiError from '../utils/apiError.js';
import { escapeLike } from '../utils/validators.js';

export const RESERVATION_STATUSES = [
  'Pending',
  'Confirmed',
  'Checked_In',
  'Checked_Out',
  'Cancelled',
];

export async function listReservations({
  q = null,
  status = null,
  customer_id = null,
  room_id = null,
  from = null,
  to = null,
  limit = 200,
} = {}) {
  const where = [];
  const params = [];

  if (status) {
    where.push('v.reservation_status = ?');
    params.push(status);
  }
  if (customer_id) {
    where.push('v.reservation_id IN (SELECT reservation_id FROM reservation WHERE customer_id = ?)');
    params.push(customer_id);
  }
  if (room_id) {
    where.push('v.reservation_id IN (SELECT reservation_id FROM reservation WHERE room_id = ?)');
    params.push(room_id);
  }
  if (from) {
    where.push('v.check_out_date > ?');
    params.push(from);
  }
  if (to) {
    where.push('v.check_in_date < ?');
    params.push(to);
  }
  if (q) {
    where.push('(v.reservation_id = ? OR v.customer_name LIKE ? OR v.phone LIKE ? OR v.room_number LIKE ?)');
    const term = `%${escapeLike(q)}%`;
    params.push(Number.isNaN(Number(q)) ? 0 : Number(q), term, term, term);
  }

  const sql = `
    SELECT v.*
    FROM vw_reservation_details v
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY v.check_in_date DESC, v.reservation_id DESC
    LIMIT ?`;
  params.push(limit);
  return query(sql, params);
}

export async function getReservation(reservationId) {
  const reservation = await queryOne(
    `SELECT reservation_id, customer_name, phone, email, room_number, room_type,
            check_in_date, check_out_date, nights, reservation_status, booking_date,
            total_amount, paid_amount, balance_due
     FROM vw_reservation_details WHERE reservation_id = ?`,
    [reservationId],
  );
  if (!reservation) throw ApiError.notFound(`Reservation ${reservationId} does not exist.`);

  const [customer, room, payments, history] = await Promise.all([
    queryOne(
      `SELECT c.customer_id, c.first_name, c.last_name, c.phone, c.email, c.address
       FROM customer c
       JOIN reservation res ON res.customer_id = c.customer_id
       WHERE res.reservation_id = ?`,
      [reservationId],
    ),
    queryOne(
      `SELECT r.room_id, r.room_number, r.floor_no, r.room_status,
              rt.type_name, rt.base_price, rt.capacity
       FROM room r
       JOIN room_type rt ON rt.room_type_id = r.room_type_id
       JOIN reservation res ON res.room_id = r.room_id
       WHERE res.reservation_id = ?`,
      [reservationId],
    ),
    query(
      `SELECT payment_id, payment_date, amount, payment_method, payment_status, transaction_reference
       FROM payment WHERE reservation_id = ? ORDER BY payment_date DESC, payment_id DESC`,
      [reservationId],
    ),
    query(
      `SELECT log_id, old_status, new_status, changed_at, changed_by
       FROM reservation_status_log WHERE reservation_id = ? ORDER BY changed_at DESC, log_id DESC`,
      [reservationId],
    ),
  ]);

  return { ...reservation, customer, room, payments, history };
}

/**
 * Create a booking through sp_create_reservation.
 * The procedure locks the room row, validates the request, calculates
 * the bill and commits. Any failure is rolled back inside the
 * procedure and re-raised to the API.
 */
export async function createReservation({
  customer_id,
  room_id,
  check_in_date,
  check_out_date,
  adults,
  children,
  remarks,
}) {
  const rows = await callProcedure('sp_create_reservation', [
    customer_id,
    room_id,
    check_in_date,
    check_out_date,
    adults,
    children,
    remarks ?? null,
  ]);

  const created = Array.isArray(rows) ? rows[0] : null;
  if (!created) {
    throw new Error('The booking procedure did not return a booking reference.');
  }
  return getReservation(created.new_reservation_id);
}

export async function updateReservationStatus(reservationId, status) {
  const existing = await queryOne(
    'SELECT reservation_id, reservation_status FROM reservation WHERE reservation_id = ?',
    [reservationId],
  );
  if (!existing) throw ApiError.notFound(`Reservation ${reservationId} does not exist.`);

  await execute('UPDATE reservation SET reservation_status = ? WHERE reservation_id = ?', [
    status,
    reservationId,
  ]);
  return getReservation(reservationId);
}

/**
 * Cancel a booking. Cancelling frees the room again, because a
 * cancelled reservation never blocks the availability search.
 */
export async function cancelReservation(reservationId) {
  const existing = await queryOne(
    'SELECT reservation_id, reservation_status FROM reservation WHERE reservation_id = ?',
    [reservationId],
  );
  if (!existing) throw ApiError.notFound(`Reservation ${reservationId} does not exist.`);
  if (existing.reservation_status === 'Cancelled') {
    throw ApiError.conflict('This reservation is already cancelled.');
  }
  if (existing.reservation_status === 'Checked_Out') {
    throw ApiError.conflict('A completed stay cannot be cancelled.');
  }
  await execute(`UPDATE reservation SET reservation_status = 'Cancelled' WHERE reservation_id = ?`, [
    reservationId,
  ]);
  return getReservation(reservationId);
}

/**
 * Amend the stay of a pending or confirmed booking. The BEFORE UPDATE
 * trigger re-checks the overlap and the capacity, so an amendment that
 * would create a double booking is rejected by the database.
 */
export async function updateReservation(reservationId, { check_in_date, check_out_date, adults, children, remarks }) {
  const existing = await queryOne(
    `SELECT reservation_id, customer_id, room_id, check_in_date, check_out_date,
            adults, children, reservation_status, remarks
     FROM reservation WHERE reservation_id = ?`,
    [reservationId],
  );
  if (!existing) throw ApiError.notFound(`Reservation ${reservationId} does not exist.`);
  if (existing.reservation_status === 'Checked_Out' || existing.reservation_status === 'Cancelled') {
    throw ApiError.conflict(
      `A ${existing.reservation_status.toLowerCase().replace('_', ' ')} reservation can no longer be amended.`,
    );
  }

  await execute(
    `UPDATE reservation
        SET check_in_date = ?, check_out_date = ?, adults = ?, children = ?, remarks = ?
      WHERE reservation_id = ?`,
    [
      check_in_date ?? existing.check_in_date,
      check_out_date ?? existing.check_out_date,
      adults ?? existing.adults,
      children ?? existing.children,
      remarks === undefined ? existing.remarks : remarks,
      reservationId,
    ],
  );
  return getReservation(reservationId);
}

export default {
  listReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
  cancelReservation,
  updateReservation,
};
