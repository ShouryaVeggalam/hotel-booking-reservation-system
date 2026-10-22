/**
 * Dashboard controller.
 */
import { getDashboard } from '../services/dashboard.service.js';
import { requireDate } from '../utils/validators.js';

export async function dashboard(req, res) {
  const date = req.query.date ? requireDate(req.query.date, 'date') : today();
  const data = await getDashboard(date);
  res.json({ success: true, data });
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export default { dashboard };
