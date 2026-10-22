/**
 * Reservation, availability and payment controller.
 */
import reservationService, { RESERVATION_STATUSES } from '../services/reservation.service.js';
import availabilityService from '../services/availability.service.js';
import {
  requireString,
  optionalString,
  requireInt,
  requirePositiveInt,
  requireNonNegativeInt,
  requireAmount,
  requireDate,
  optionalDate,
  requireOneOf,
  optionalOneOf,
  optionalSearch,
} from '../utils/validators.js';

const PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'Bank_Transfer'];
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Refunded', 'Failed'];

/* ---------------- reservations ---------------- */

export async function listReservations(req, res) {
  const reservations = await reservationService.listReservations({
    q: optionalSearch(req.query.q),
    status: optionalOneOf(req.query.status, RESERVATION_STATUSES, 'status'),
    customer_id: req.query.customer_id ? requirePositiveInt(req.query.customer_id, 'customer_id') : null,
    room_id: req.query.room_id ? requirePositiveInt(req.query.room_id, 'room_id') : null,
    from: optionalDate(req.query.from, 'from'),
    to: optionalDate(req.query.to, 'to'),
  });
  res.json({ success: true, data: reservations });
}

export async function getReservation(req, res) {
  const reservation = await reservationService.getReservation(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: reservation });
}

export async function createReservation(req, res) {
  const checkIn = requireDate(req.body.check_in_date, 'check_in_date');
  const checkOut = requireDate(req.body.check_out_date, 'check_out_date');

  const reservation = await reservationService.createReservation({
    customer_id: requirePositiveInt(req.body.customer_id, 'customer_id'),
    room_id: requirePositiveInt(req.body.room_id, 'room_id'),
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults: requirePositiveInt(req.body.adults ?? 1, 'adults', { max: 50 }),
    children: requireNonNegativeInt(req.body.children ?? 0, 'children', { max: 50 }),
    remarks: optionalString(req.body.remarks, 'remarks', { maxLength: 255 }),
  });
  res.status(201).json({ success: true, data: reservation });
}

export async function updateReservationStatus(req, res) {
  const reservation = await reservationService.updateReservationStatus(
    requirePositiveInt(req.params.id, 'id'),
    requireOneOf(req.body.status, RESERVATION_STATUSES, 'status'),
  );
  res.json({ success: true, data: reservation });
}

export async function updateReservation(req, res) {
  const reservation = await reservationService.updateReservation(
    requirePositiveInt(req.params.id, 'id'),
    {
      check_in_date: optionalDate(req.body.check_in_date, 'check_in_date'),
      check_out_date: optionalDate(req.body.check_out_date, 'check_out_date'),
      adults: req.body.adults === undefined ? undefined : requirePositiveInt(req.body.adults, 'adults', { max: 50 }),
      children: req.body.children === undefined
        ? undefined
        : requireNonNegativeInt(req.body.children, 'children', { max: 50 }),
      remarks: req.body.remarks === undefined
        ? undefined
        : optionalString(req.body.remarks, 'remarks', { maxLength: 255 }),
    },
  );
  res.json({ success: true, data: reservation });
}

export async function cancelReservation(req, res) {
  const reservation = await reservationService.cancelReservation(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: reservation });
}

export async function deleteReservation(req, res) {
  const result = await reservationService.deleteReservation(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: result });
}

/* ---------------- availability ---------------- */

export async function checkAvailability(req, res) {
  const checkIn = requireDate(req.query.check_in, 'check_in');
  const checkOut = requireDate(req.query.check_out, 'check_out');
  const adults = requirePositiveInt(req.query.adults ?? 1, 'adults', { max: 50 });
  const children = requireNonNegativeInt(req.query.children ?? 0, 'children', { max: 50 });

  const data = await availabilityService.checkAvailability({
    check_in: checkIn,
    check_out: checkOut,
    adults,
    children,
  });
  res.json({ success: true, data });
}

/* ---------------- payments ---------------- */

export async function listPayments(req, res) {
  const data = await availabilityService.listPayments({
    reservation_id: req.query.reservation_id
      ? requirePositiveInt(req.query.reservation_id, 'reservation_id')
      : null,
    from: optionalDate(req.query.from, 'from'),
    to: optionalDate(req.query.to, 'to'),
    method: optionalOneOf(req.query.method, PAYMENT_METHODS, 'method'),
    status: optionalOneOf(req.query.status, PAYMENT_STATUSES, 'status'),
  });
  res.json({ success: true, data: data.payments, meta: data.totals });
}

export async function createPayment(req, res) {
  const payment = await availabilityService.createPayment({
    reservation_id: requirePositiveInt(req.body.reservation_id, 'reservation_id'),
    amount: requireAmount(req.body.amount),
    payment_method: requireOneOf(req.body.payment_method, PAYMENT_METHODS, 'payment_method'),
    transaction_reference: optionalString(req.body.transaction_reference, 'transaction_reference', { maxLength: 60 }),
    payment_status: optionalOneOf(req.body.payment_status, PAYMENT_STATUSES, 'payment_status', 'Paid'),
  });
  res.status(201).json({ success: true, data: payment });
}

export async function getPaymentHistory(req, res) {
  const data = await availabilityService.getPaymentHistory(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data });
}

export async function deletePayment(req, res) {
  const result = await availabilityService.deletePayment(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: result });
}

export { PAYMENT_METHODS, PAYMENT_STATUSES };
export default {
  listReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
  updateReservation,
  cancelReservation,
  deleteReservation,
  checkAvailability,
  listPayments,
  createPayment,
  getPaymentHistory,
  deletePayment,
};
