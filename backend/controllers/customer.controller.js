/**
 * Customer controller.
 */
import customerService from '../services/customer.service.js';
import {
  requireString,
  optionalString,
  requireEmail,
  requirePhone,
  requirePositiveInt,
  optionalSearch,
} from '../utils/validators.js';

export async function listCustomers(req, res) {
  const customers = await customerService.listCustomers({ q: optionalSearch(req.query.q) });
  res.json({ success: true, data: customers });
}

export async function getCustomer(req, res) {
  const customer = await customerService.getCustomer(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data: customer });
}

export async function getCustomerReservations(req, res) {
  const data = await customerService.getCustomerReservations(requirePositiveInt(req.params.id, 'id'));
  res.json({ success: true, data });
}

export async function createCustomer(req, res) {
  const customer = await customerService.createCustomer({
    first_name: requireString(req.body.first_name, 'first_name', { maxLength: 50 }),
    last_name: requireString(req.body.last_name, 'last_name', { maxLength: 50 }),
    phone: requirePhone(req.body.phone),
    email: requireEmail(req.body.email),
    address: optionalString(req.body.address, 'address', { maxLength: 255 }),
  });
  res.status(201).json({ success: true, data: customer });
}

export async function updateCustomer(req, res) {
  const customer = await customerService.updateCustomer(requirePositiveInt(req.params.id, 'id'), {
    first_name: req.body.first_name === undefined
      ? undefined
      : requireString(req.body.first_name, 'first_name', { maxLength: 50 }),
    last_name: req.body.last_name === undefined
      ? undefined
      : requireString(req.body.last_name, 'last_name', { maxLength: 50 }),
    phone: req.body.phone === undefined ? undefined : requirePhone(req.body.phone),
    email: req.body.email === undefined ? undefined : requireEmail(req.body.email),
    address: req.body.address === undefined
      ? undefined
      : optionalString(req.body.address, 'address', { maxLength: 255 }),
  });
  res.json({ success: true, data: customer });
}

export default {
  listCustomers,
  getCustomer,
  getCustomerReservations,
  createCustomer,
  updateCustomer,
};
