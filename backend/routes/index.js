/**
 * API route table.
 *
 * Every route below is a thin wrapper that validates the request and
 * calls a service. The service owns the SQL.
 */
import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller.js';
import roomController from '../controllers/room.controller.js';
import customerController from '../controllers/customer.controller.js';
import reservationController from '../controllers/reservation.controller.js';
import reportController from '../controllers/report.controller.js';
import { healthCheck } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/* ------------------------------ system ----------------------------- */
/**
 * Lightweight health check.
 *
 * Render uses this path to decide whether the service is alive. It
 * really talks to MySQL, so a database outage is reported as an
 * unhealthy service instead of a silently broken API.
 */
router.get('/health', asyncHandler(async (_req, res) => {
  const info = await healthCheck();
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'staywise-api',
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: Math.round(process.uptime()),
      database: info,
    },
  });
}));

/**
 * A short map of the API. Handy during a demonstration and when
 * somebody opens /api in a browser.
 */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Staywise - Hotel Booking and Reservation Management System API',
      endpoints: {
        health: '/api/health',
        dashboard: '/api/dashboard',
        rooms: '/api/rooms',
        roomTypes: '/api/room-types',
        customers: '/api/customers',
        availability: '/api/availability?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD',
        reservations: '/api/reservations',
        payments: '/api/payments',
        reports: '/api/reports/reservations',
      },
    },
  });
});

/* ---------------------------- dashboard --------------------------- */
router.get('/dashboard', asyncHandler(dashboardController.dashboard));

/* ------------------------------ rooms ------------------------------ */
router.get('/rooms', asyncHandler(roomController.listRooms));
router.get('/rooms/:id', asyncHandler(roomController.getRoom));
router.post('/rooms', asyncHandler(roomController.createRoom));
router.put('/rooms/:id', asyncHandler(roomController.updateRoom));
router.patch('/rooms/:id/status', asyncHandler(roomController.updateRoomStatus));
router.delete('/rooms/:id', asyncHandler(roomController.deleteRoom));

/* --------------------------- room types --------------------------- */
router.get('/room-types', asyncHandler(roomController.listRoomTypes));
router.get('/room-types/:id', asyncHandler(roomController.getRoomType));
router.post('/room-types', asyncHandler(roomController.createRoomType));
router.put('/room-types/:id', asyncHandler(roomController.updateRoomType));
router.delete('/room-types/:id', asyncHandler(roomController.deleteRoomType));

/* ---------------------------- customers --------------------------- */
router.get('/customers', asyncHandler(customerController.listCustomers));
router.get('/customers/:id', asyncHandler(customerController.getCustomer));
router.get('/customers/:id/reservations', asyncHandler(customerController.getCustomerReservations));
router.post('/customers', asyncHandler(customerController.createCustomer));
router.put('/customers/:id', asyncHandler(customerController.updateCustomer));
router.delete('/customers/:id', asyncHandler(customerController.deleteCustomer));

/* --------------------------- availability ------------------------- */
router.get('/availability', asyncHandler(reservationController.checkAvailability));

/* --------------------------- reservations ------------------------- */
router.get('/reservations', asyncHandler(reservationController.listReservations));
router.get('/reservations/:id', asyncHandler(reservationController.getReservation));
router.post('/reservations', asyncHandler(reservationController.createReservation));
router.put('/reservations/:id', asyncHandler(reservationController.updateReservation));
router.patch('/reservations/:id/status', asyncHandler(reservationController.updateReservationStatus));
router.post('/reservations/:id/cancel', asyncHandler(reservationController.cancelReservation));
router.delete('/reservations/:id', asyncHandler(reservationController.deleteReservation));

/* ----------------------------- payments --------------------------- */
router.get('/payments', asyncHandler(reservationController.listPayments));
router.post('/payments', asyncHandler(reservationController.createPayment));
router.get('/reservations/:id/payments', asyncHandler(reservationController.getPaymentHistory));
router.delete('/payments/:id', asyncHandler(reservationController.deletePayment));

/* ------------------------------ reports --------------------------- */
router.get('/reports/reservations', asyncHandler(reportController.reservationDetails));
router.get('/reports/available-rooms', asyncHandler(reportController.availableRooms));
router.get('/reports/bookings-by-room-type', asyncHandler(reportController.bookingsByRoomType));
router.get('/reports/revenue-by-room-type', asyncHandler(reportController.revenueByRoomType));
router.get('/reports/payments-collected', asyncHandler(reportController.paymentsCollected));
router.get('/reports/outstanding-balances', asyncHandler(reportController.outstandingBalances));
router.get('/reports/status-history', asyncHandler(reportController.statusHistory));

export default router;
