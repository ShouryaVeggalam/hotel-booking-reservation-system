/**
 * Customer service.
 *
 * phone and email carry UNIQUE constraints, so a duplicate registration
 * is rejected by the database. The service converts that database error
 * into a friendly 409 response.
 */
import { query, queryOne, execute } from '../db/pool.js';
import ApiError from '../utils/apiError.js';
import { escapeLike } from '../utils/validators.js';

export async function listCustomers({ q = null, limit = 200 } = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    const term = `%${escapeLike(q)}%`;
    params.push(term, term, term, term);
  }

  const sql = `
    SELECT c.customer_id, c.first_name, c.last_name, c.phone, c.email, c.address, c.created_at,
           CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
           (SELECT COUNT(*) FROM reservation res WHERE res.customer_id = c.customer_id) AS reservation_count,
           (SELECT COALESCE(SUM(res.total_amount), 0) FROM reservation res
             WHERE res.customer_id = c.customer_id AND res.reservation_status <> 'Cancelled') AS total_spent
    FROM customer c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY c.first_name, c.last_name
    LIMIT ?`;
  params.push(limit);
  return query(sql, params);
}

export async function getCustomer(customerId) {
  const customer = await queryOne(
    `SELECT customer_id, first_name, last_name, phone, email, address, created_at,
            CONCAT(first_name, ' ', last_name) AS customer_name
     FROM customer WHERE customer_id = ?`,
    [customerId],
  );
  if (!customer) throw ApiError.notFound(`Customer ${customerId} does not exist.`);
  return customer;
}

export async function getCustomerReservations(customerId) {
  const customer = await getCustomer(customerId);
  const reservations = await query(
    `SELECT reservation_id, customer_name, phone, room_number, room_type,
            check_in_date, check_out_date, nights, reservation_status,
            total_amount, paid_amount, balance_due
     FROM vw_reservation_details
     WHERE reservation_id IN (
            SELECT reservation_id FROM reservation WHERE customer_id = ?
     )
     ORDER BY check_in_date DESC, reservation_id DESC`,
    [customerId],
  );
  return { customer, reservations };
}

export async function createCustomer({ first_name, last_name, phone, email, address }) {
  const result = await execute(
    `INSERT INTO customer (first_name, last_name, phone, email, address)
     VALUES (?, ?, ?, ?, ?)`,
    [first_name, last_name, phone, email, address ?? null],
  );
  return getCustomer(result.insertId);
}

export async function updateCustomer(customerId, { first_name, last_name, phone, email, address }) {
  const existing = await getCustomer(customerId);
  await execute(
    `UPDATE customer
        SET first_name = ?, last_name = ?, phone = ?, email = ?, address = ?
      WHERE customer_id = ?`,
    [
      first_name ?? existing.first_name,
      last_name ?? existing.last_name,
      phone ?? existing.phone,
      email ?? existing.email,
      address === undefined ? existing.address : address,
      customerId,
    ],
  );
  return getCustomer(customerId);
}

export default {
  listCustomers,
  getCustomer,
  getCustomerReservations,
  createCustomer,
  updateCustomer,
};
