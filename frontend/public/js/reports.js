/* =====================================================================
   reports.js - the seven database reports
   Each report is a GET call to /api/reports/* which runs a real
   SELECT in MySQL. Nothing is calculated in the browser.
   ===================================================================== */
import api from './api.js';
import {
  $, $$, boot, toast, money, formatDate, formatDateTime, statusBadge,
  emptyRow, escapeHtml, downloadCsv, today, addDays, ICONS,
} from './ui.js';

const REPORTS = {
  reservations: {
    label: 'Reservation details',
    description: 'Every booking with its guest, stay, bill and balance.',
    endpoint: '/reports/reservations',
    filters: [
      { type: 'date', id: 'from', label: 'Stay overlapping from' },
      { type: 'date', id: 'to', label: 'Stay overlapping to' },
      {
        type: 'select',
        id: 'status',
        label: 'Status',
        options: [
          ['', 'All statuses'],
          ['Pending', 'Pending'],
          ['Confirmed', 'Confirmed'],
          ['Checked_In', 'Checked In'],
          ['Checked_Out', 'Checked Out'],
          ['Cancelled', 'Cancelled'],
        ],
      },
    ],
    columns: [
      { label: '#', value: (r) => r.reservation_id },
      { label: 'Guest', value: (r) => r.customer_name, render: (r) => `<span class="cell-strong">${escapeHtml(r.customer_name)}</span><span class="cell-sub">${escapeHtml(r.phone)}</span>` },
      { label: 'Room', value: (r) => r.room_number, render: (r) => `${escapeHtml(r.room_number)}<span class="cell-sub">${escapeHtml(r.room_type)}</span>` },
      { label: 'Check-in', value: (r) => r.check_in_date, render: (r) => formatDate(r.check_in_date) },
      { label: 'Check-out', value: (r) => r.check_out_date, render: (r) => formatDate(r.check_out_date) },
      { label: 'Nights', value: (r) => r.nights, numeric: true },
      { label: 'Status', value: (r) => r.reservation_status, render: (r) => statusBadge(r.reservation_status) },
      { label: 'Bill', value: (r) => r.total_amount, numeric: true, render: (r) => money(r.total_amount) },
      { label: 'Paid', value: (r) => r.paid_amount, numeric: true, render: (r) => money(r.paid_amount) },
      { label: 'Balance', value: (r) => r.balance_due, numeric: true, render: (r) => money(r.balance_due) },
    ],
  },

  'available-rooms': {
    label: 'Available rooms',
    description: 'Rooms that are free for a requested date range.',
    endpoint: '/reports/available-rooms',
    filters: [
      { type: 'date', id: 'check_in', label: 'Check-in' },
      { type: 'date', id: 'check_out', label: 'Check-out' },
    ],
    columns: [
      { label: 'Room', value: (r) => r.room_number, render: (r) => `<span class="cell-strong">${escapeHtml(r.room_number)}</span>` },
      { label: 'Category', value: (r) => r.type_name },
      { label: 'Floor', value: (r) => r.floor_no, numeric: true },
      { label: 'Capacity', value: (r) => r.capacity, numeric: true },
      { label: 'Nightly rate', value: (r) => r.base_price, numeric: true, render: (r) => money(r.base_price) },
    ],
  },

  'bookings-by-room-type': {
    label: 'Bookings by room type',
    description: 'How many bookings and how much revenue each category produced.',
    endpoint: '/reports/bookings-by-room-type',
    filters: [],
    columns: [
      { label: 'Category', value: (r) => r.type_name, render: (r) => `<span class="cell-strong">${escapeHtml(r.type_name)}</span>` },
      { label: 'Rooms', value: (r) => r.total_rooms, numeric: true },
      { label: 'Bookings', value: (r) => r.total_bookings, numeric: true },
      { label: 'Nightly rate', value: (r) => r.base_price, numeric: true, render: (r) => money(r.base_price) },
      { label: 'Revenue', value: (r) => r.total_revenue, numeric: true, render: (r) => money(r.total_revenue) },
    ],
  },

  'revenue-by-room-type': {
    label: 'Revenue by room type',
    description: 'Money earned per category, with the average booking value.',
    endpoint: '/reports/revenue-by-room-type',
    filters: [
      { type: 'date', id: 'from', label: 'Stay overlapping from' },
      { type: 'date', id: 'to', label: 'Stay overlapping to' },
    ],
    columns: [
      { label: 'Category', value: (r) => r.type_name, render: (r) => `<span class="cell-strong">${escapeHtml(r.type_name)}</span>` },
      { label: 'Bookings', value: (r) => r.bookings, numeric: true },
      { label: 'Revenue', value: (r) => r.revenue, numeric: true, render: (r) => money(r.revenue) },
      { label: 'Average booking value', value: (r) => r.average_booking_value, numeric: true, render: (r) => money(r.average_booking_value) },
    ],
  },

  'payments-collected': {
    label: 'Payments collected',
    description: 'Money received inside a date range, split by payment status.',
    endpoint: '/reports/payments-collected',
    filters: [
      { type: 'date', id: 'from', label: 'From' },
      { type: 'date', id: 'to', label: 'To' },
    ],
    columns: [
      { label: '#', value: (r) => r.payment_id },
      { label: 'Date', value: (r) => r.payment_date, render: (r) => formatDateTime(r.payment_date) },
      { label: 'Guest', value: (r) => r.customer_name, render: (r) => `<span class="cell-strong">${escapeHtml(r.customer_name)}</span><span class="cell-sub">Reservation #${r.reservation_id}</span>` },
      { label: 'Room', value: (r) => r.room_number },
      { label: 'Method', value: (r) => r.payment_method, render: (r) => escapeHtml(String(r.payment_method).replace('_', ' ')) },
      { label: 'Status', value: (r) => r.payment_status, render: (r) => statusBadge(r.payment_status) },
      { label: 'Amount', value: (r) => r.amount, numeric: true, render: (r) => money(r.amount) },
      { label: 'Reference', value: (r) => r.transaction_reference, render: (r) => `<span class="mono">${escapeHtml(r.transaction_reference || '—')}</span>` },
    ],
  },

  'outstanding-balances': {
    label: 'Outstanding balances',
    description: 'Guests who still owe money on a live reservation.',
    endpoint: '/reports/outstanding-balances',
    filters: [
      { type: 'date', id: 'from', label: 'Stay overlapping from' },
      { type: 'date', id: 'to', label: 'Stay overlapping to' },
    ],
    columns: [
      { label: '#', value: (r) => r.reservation_id },
      { label: 'Guest', value: (r) => r.customer_name, render: (r) => `<span class="cell-strong">${escapeHtml(r.customer_name)}</span><span class="cell-sub">${escapeHtml(r.phone)}</span>` },
      { label: 'Room', value: (r) => r.room_number, render: (r) => `${escapeHtml(r.room_number)}<span class="cell-sub">${escapeHtml(r.room_type)}</span>` },
      { label: 'Stay', value: (r) => r.check_in_date, render: (r) => `${formatDate(r.check_in_date)} → ${formatDate(r.check_out_date)}` },
      { label: 'Status', value: (r) => r.reservation_status, render: (r) => statusBadge(r.reservation_status) },
      { label: 'Bill', value: (r) => r.total_amount, numeric: true, render: (r) => money(r.total_amount) },
      { label: 'Paid', value: (r) => r.paid_amount, numeric: true, render: (r) => money(r.paid_amount) },
      { label: 'Balance', value: (r) => r.balance_due, numeric: true, render: (r) => `<span class="cell-strong">${money(r.balance_due)}</span>` },
    ],
  },

  'status-history': {
    label: 'Status history',
    description: 'The audit trail written by the status trigger.',
    endpoint: '/reports/status-history',
    filters: [
      { type: 'date', id: 'from', label: 'Changed from' },
      { type: 'date', id: 'to', label: 'Changed to' },
    ],
    columns: [
      { label: '#', value: (r) => r.log_id },
      { label: 'Reservation', value: (r) => r.reservation_id, render: (r) => `#${r.reservation_id}` },
      { label: 'Guest', value: (r) => r.customer_name, render: (r) => `<span class="cell-strong">${escapeHtml(r.customer_name)}</span><span class="cell-sub">Room ${escapeHtml(r.room_number)}</span>` },
      { label: 'From', value: (r) => r.old_status, render: (r) => (r.old_status ? escapeHtml(r.old_status.replace('_', ' ')) : '<span class="muted">created</span>') },
      { label: 'To', value: (r) => r.new_status, render: (r) => `<span class="cell-strong">${escapeHtml(r.new_status.replace('_', ' '))}</span>` },
      { label: 'When', value: (r) => r.changed_at, render: (r) => formatDateTime(r.changed_at) },
      { label: 'Changed by', value: (r) => r.changed_by, render: (r) => `<span class="mono">${escapeHtml(r.changed_by)}</span>` },
    ],
  },
};

let currentKey = 'reservations';
let currentRows = [];
let currentMeta = {};

function renderTabs() {
  const tabs = Object.entries(REPORTS)
    .map(([key, report]) => `<button class="btn btn-sm${key === currentKey ? ' btn-dark' : ''}" data-report="${key}">${report.label}</button>`)
    .join('');
  $('#reportTabs').innerHTML = tabs;
}

function renderFilters() {
  const report = REPORTS[currentKey];
  const host = $('#reportFilters');
  const filterDefs = report.filters;

  if (!filterDefs.length) {
    host.innerHTML = `<span class="muted small">This report has no date filter.</span>`;
    return;
  }

  host.innerHTML = filterDefs.map((filter) => {
    if (filter.type === 'date') {
      return `<div class="field">
        <label for="filter-${filter.id}" class="muted small">${filter.label}</label>
        <input type="date" id="filter-${filter.id}" data-filter="${filter.id}" />
      </div>`;
    }
    return `<div class="field">
      <label for="filter-${filter.id}" class="muted small">${filter.label}</label>
      <select id="filter-${filter.id}" data-filter="${filter.id}">
        ${filter.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </select>
    </div>`;
  }).join('');

  // Sensible defaults so the report returns data straight away.
  if (currentKey === 'available-rooms') {
    $('#filter-check_in').value = today();
    $('#filter-check_out').value = addDays(today(), 1);
  }
  if (currentKey === 'payments-collected') {
    $('#filter-from').value = `${new Date().getFullYear()}-01-01`;
    $('#filter-to').value = `${new Date().getFullYear()}-12-31`;
  }
}

function currentQuery() {
  const report = REPORTS[currentKey];
  const query = {};
  report.filters.forEach((filter) => {
    const el = document.querySelector(`[data-filter="${filter.id}"]`);
    if (el && el.value) query[filter.id] = el.value;
  });
  return query;
}

async function runReport() {
  const report = REPORTS[currentKey];
  const button = $('#runBtn');
  button.disabled = true;
  try {
    const response = await api.get(report.endpoint, currentQuery());
    currentRows = response.data || [];
    currentMeta = response.meta || {};
    renderHead(report);
    renderRows(report);
    renderSummary(report);
    $('#reportDescription').textContent = report.description;
    $('#resultTitle').textContent = report.label;
    $('#resultSub').textContent = `${currentRows.length} row${currentRows.length === 1 ? '' : 's'} returned by the database`;
    $('#resultCount').textContent = `${currentRows.length} row${currentRows.length === 1 ? '' : 's'}`;
  } catch (error) {
    toast(error.message, 'error');
    $('#reportRows').innerHTML = emptyRow(report.columns.length, 'The report could not be run.');
  } finally {
    button.disabled = false;
  }
}

function renderHead(report) {
  $('#reportHead').innerHTML = `<tr>${report.columns
    .map((column) => `<th${column.numeric ? ' class="num"' : ''}>${column.label}</th>`)
    .join('')}</tr>`;
}

function renderRows(report) {
  const body = $('#reportRows');
  if (!currentRows.length) {
    body.innerHTML = emptyRow(report.columns.length, 'The report returned no rows for this filter.');
    return;
  }

  body.innerHTML = currentRows.map((row) => `<tr>${report.columns
    .map((column) => `<td${column.numeric ? ' class="num"' : ''}>${column.render ? column.render(row) : escapeHtml(String(column.value(row) ?? ''))}</td>`)
    .join('')}</tr>`).join('');
}

function renderSummary(report) {
  const stats = [];

  if (report.columns.some((column) => column.label === 'Bill')) {
    const billed = currentRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const paid = currentRows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
    const due = currentRows.reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
    stats.push({ label: 'Total billed', value: money(billed), tone: 'teal', icon: 'reports' });
    stats.push({ label: 'Total paid', value: money(paid), tone: 'green', icon: 'payments' });
    stats.push({ label: 'Total balance', value: money(due), tone: 'red', icon: 'reports' });
  }

  if (report.columns.some((column) => column.label === 'Revenue')) {
    const revenue = currentRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const bookings = currentRows.reduce((sum, row) => sum + Number(row.bookings || 0), 0);
    stats.push({ label: 'Total revenue', value: money(revenue), tone: 'green', icon: 'reports' });
    stats.push({ label: 'Bookings', value: bookings, tone: 'blue', icon: 'reservations' });
  }

  if (report.columns.some((column) => column.label === 'Amount')) {
    const collected = currentRows
      .filter((row) => row.payment_status === 'Paid')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    stats.push({ label: 'Collected (Paid)', value: money(collected), tone: 'green', icon: 'payments' });
  }

  if (report.columns.some((column) => column.label === 'Balance')) {
    const due = currentRows.reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
    stats.push({ label: 'Outstanding', value: money(due), tone: 'red', icon: 'reports' });
  }

  stats.push({
    label: 'Rows returned',
    value: currentRows.length,
    tone: '',
    icon: 'dashboard',
  });

  $('#reportStats').innerHTML = stats.map((stat) => `
    <div class="stat ${stat.tone}">
      <div class="stat-top">
        <span class="stat-label">${stat.label}</span>
        <span class="stat-icon">${ICONS[stat.icon] || ''}</span>
      </div>
      <div class="stat-value">${typeof stat.value === 'string' ? stat.value : Number(stat.value).toLocaleString('en-IN')}</div>
    </div>`).join('');
}

/* ------------------------------- events -------------------------------- */

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || !button.dataset.report) return;
  currentKey = button.dataset.report;
  renderTabs();
  renderFilters();
  runReport();
});

$('#runBtn').addEventListener('click', runReport);

$('#exportBtn').addEventListener('click', () => {
  const report = REPORTS[currentKey];
  if (!currentRows.length) {
    toast('There is nothing to export.', 'error');
    return;
  }
  downloadCsv(
    `staywise-${currentKey}-${today()}.csv`,
    report.columns.map((column) => ({ label: column.label, value: column.value })),
    currentRows,
  );
  toast('The report was exported as a CSV file.');
});

boot('reports');
renderTabs();
renderFilters();
runReport();
