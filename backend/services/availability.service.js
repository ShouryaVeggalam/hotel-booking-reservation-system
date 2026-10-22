/**
 * Availability and payment services.
 */
import { query, queryOne, execute, callProcedure } from '../db/pool.js';
import ApiError from '../utils/apiError.js';

/**
 * Find the rooms that can host the requested party for the requested
 * dates. The whole rule set lives in the stored procedure
 * sp_check_room_availability, so the screen and the database can never
 * disagree about what is available.
 */
export async function checkAvailability({ check_in, check_out, adults, children }) {
  const guests = adults + children;
  const rows = await callProcedure('sp_check_room_availability', [check_in, check_out, guests]);
  return {
    check_in,
    check_out,
    adults,
    children,
    guests,
    rooms: Array.isArray(rows) ? rows : [],
  };
}

/**
 * Record a payment through sp_record_payment. The procedure locks the
 * reservation row, checks the balance and commits.
 */
export async function createPayment({
  reservation_id,
  amount,
  payment_method,
  transaction_reference,
  payment_status,
}) {
  const rows = await callProcedure('sp_record_payment', [
    reservation_id,
    amount,
    payment_method,
    transaction_reference ?? null,
    payment_status,
  ]);

  const created = Array.isArray(rows) ? rows[0] : null;
  if (!created) {
    throw new Error('The payment procedure did not return a payment reference.');
  }
  return created;
}

export async function listPayments({ reservation_id = null, from = null, to = null, method = null, status = null } = {}) {
  const where = [];
  const params = [];

  if (reservation_id) {
    where.push('p.reservation_id = ?');
    params.push(reservation_id);
  }
  if (from) {
    where.push('p.payment_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(to);
  }
  if (method) {
    where.push('p.payment_method = ?');
    params.push(method);
  }
  if (status) {
    where.push('p.payment_status = ?');
    params.push(status);
  }

  const payments = await query(
    `SELECT p.payment_id, p.reservation_id, p.payment_date, p.amount, p.payment_method,
            p.payment_status, p.transaction_reference, p.customer_name, p.room_number,
            p.bill_amount
     FROM vw_payments_collected p
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY p.payment_date DESC, p.payment_id DESC`,
    params,
  );

  const totals = await queryOne(
    `SELECT COUNT(*) AS payment_count,
            COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN amount ELSE 0 END), 0) AS total_paid,
            COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN amount ELSE 0 END), 0) AS total_pending,
            COALESCE(SUM(CASE WHEN payment_status = 'Refunded' THEN amount ELSE 0 END), 0) AS total_refunded,
            COALESCE(SUM(CASE WHEN payment_status = 'Failed' THEN amount ELSE 0 END), 0) AS total_failed
     FROM vw_payments_collected p
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );

  return { payments, totals };
}

export async function getPaymentHistory(reservationId) {
  const reservation = await queryOne(
    `SELECT reservation_id, customer_name, room_number, check_in_date, check_out_date,
            total_amount, paid_amount, balance_due, reservation_status
     FROM vw_reservation_details WHERE reservation_id = ?`,
    [reservationId],
  );
  if (!reservation) throw ApiError.notFound(`Reservation ${reservationId} does not exist.`);

  const payments = await query(
    `SELECT payment_id, payment_date, amount, payment_method, payment_status, transaction_reference
     FROM payment WHERE reservation_id = ? ORDER BY payment_date DESC, payment_id DESC`,
    [reservationId],
  );
  return { reservation, payments };
}

/**
 * Remove a payment row.
 *
 * A payment that is linked to a reservation can be removed, for
 * example when it was entered by mistake. The balance of the
 * reservation is recalculated by the view, so the ledger and the
 * balance can never drift apart.
 */
export async function deletePayment(paymentId) {
  const existing = await queryOne(
    `SELECT payment_id, reservation_id, amount, payment_status
       FROM payment WHERE payment_id = ?`,
    [paymentId],
  );
  if (!existing) throw ApiError.notFound(`Payment ${paymentId} does not exist.`);

  await execute('DELETE FROM payment WHERE payment_id = ?', [paymentId]);
  return { deleted: true, payment_id: Number(paymentId), reservation_id: existing.reservation_id };
}

export default {
  checkAvailability,
  createPayment,
  listPayments,
  getPaymentHistory,
  deletePayment,
};
