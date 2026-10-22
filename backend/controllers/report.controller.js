/**
 * Report controller - the seven database driven reports.
 */
import reportService from '../services/report.service.js';
import { requireDate, optionalDate, optionalOneOf } from '../utils/validators.js';

const RESERVATION_STATUSES = ['Pending', 'Confirmed', 'Checked_In', 'Checked_Out', 'Cancelled'];

function currentYear() {
  return new Date().getFullYear();
}

export async function reservationDetails(req, res) {
  const data = await reportService.reservationDetails({
    from: optionalDate(req.query.from, 'from'),
    to: optionalDate(req.query.to, 'to'),
    status: optionalOneOf(req.query.status, RESERVATION_STATUSES, 'status'),
  });
  res.json({ success: true, data: data.rows, meta: data.totals });
}

export async function availableRooms(req, res) {
  const checkIn = requireDate(req.query.check_in, 'check_in');
  const checkOut = requireDate(req.query.check_out, 'check_out');
  const data = await reportService.availableRooms({ check_in: checkIn, check_out: checkOut });
  res.json({ success: true, data: data.rows, meta: { check_in: checkIn, check_out: checkOut } });
}

export async function bookingsByRoomType(req, res) {
  const data = await reportService.bookingsByRoomType();
  res.json({ success: true, data: data.rows });
}

export async function revenueByRoomType(req, res) {
  const data = await reportService.revenueByRoomType({
    from: optionalDate(req.query.from, 'from'),
    to: optionalDate(req.query.to, 'to'),
  });
  res.json({ success: true, data: data.rows });
}

export async function paymentsCollected(req, res) {
  const from = req.query.from ? requireDate(req.query.from, 'from') : `${currentYear()}-01-01`;
  const to = req.query.to ? requireDate(req.query.to, 'to') : `${currentYear()}-12-31`;
  const data = await reportService.paymentsCollected({ from, to });
  res.json({ success: true, data: data.rows, meta: data.totals });
}

export async function outstandingBalances(req, res) {
  const data = await reportService.outstandingBalances({
    from: optionalDate(req.query.from, 'from'),
    to: optionalDate(req.query.to, 'to'),
  });
  res.json({ success: true, data: data.rows, meta: data.totals });
}

export async function statusHistory(req, res) {
  const data = await reportService.statusHistory({
    from: optionalDate(req.query.from, 'from'),
    to: optionalDate(req.query.to, 'to'),
    reservation_id: req.query.reservation_id ? Number(req.query.reservation_id) : null,
  });
  res.json({ success: true, data: data.rows });
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
