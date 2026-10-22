/* =====================================================================
   dashboard.js - operational dashboard
   Every value rendered here comes from GET /api/dashboard, which runs
   real SQL against MySQL. No value is hard coded.
   ===================================================================== */
import api from './api.js';
import {
  $, boot, toast, money, formatDate, statusBadge, emptyRow, ICONS,
} from './ui.js';

const STAT_CARDS = [
  { key: 'total_rooms', label: 'Total rooms', icon: 'rooms', tone: '', note: 'Physical rooms in the hotel' },
  { key: 'free_rooms_today', label: 'Free today', icon: 'availability', tone: 'green', note: 'Available and not occupied' },
  { key: 'active_reservations', label: 'Active bookings', icon: 'reservations', tone: 'blue', note: 'Pending, Confirmed or Checked In' },
  { key: 'check_ins_today', label: 'Check-ins', icon: 'dashboard', tone: 'teal', note: 'Arrivals on the selected day' },
  { key: 'check_outs_today', label: 'Check-outs', icon: 'dashboard', tone: 'violet', note: 'Departures on the selected day' },
  { key: 'total_payments_collected', label: 'Payments collected', icon: 'payments', tone: 'green', note: 'Only paid transactions', money: true },
  { key: 'outstanding_balance', label: 'Outstanding balance', icon: 'reports', tone: 'red', note: 'Money still to be collected', money: true },
  { key: 'registered_customers', label: 'Registered guests', icon: 'customers', tone: '', note: 'Customers in the directory' },
];

async function load() {
  const date = $('#dashDate').value;
  const grid = $('#statCards');
  grid.innerHTML = STAT_CARDS.map((card) => `
    <div class="stat ${card.tone}">
      <div class="stat-top">
        <span class="stat-label">${card.label}</span>
        <span class="stat-icon">${ICONS[card.icon] || ''}</span>
      </div>
      <div class="stat-value" id="stat-${card.key}">—</div>
      <div class="stat-note">${card.note}</div>
    </div>`).join('');

  try {
    const { data } = await api.get('/dashboard', { date });

    STAT_CARDS.forEach((card) => {
      const cell = document.getElementById(`stat-${card.key}`);
      if (!cell) return;
      const raw = data.summary[card.key];
      cell.textContent = card.money ? money(raw) : Number(raw || 0).toLocaleString('en-IN');
    });

    renderMovements(data.movements || [], data.date);
    renderRooms(data.rooms || []);
    renderReservations(data.recent_reservations || []);
  } catch (error) {
    toast(error.message, 'error');
    $('#movementRows').innerHTML = emptyRow(5, 'Could not load the dashboard.');
  }
}

function renderMovements(movements, date) {
  $('#movementSub').textContent = `Bookings that start or end on ${formatDate(date)}`;
  const body = $('#movementRows');

  if (!movements.length) {
    body.innerHTML = emptyRow(5, 'No arrivals or departures on this day.');
    return;
  }

  body.innerHTML = movements.map((row) => {
    const isArrival = row.check_in_date === date;
    return `<tr>
      <td class="cell-strong">#${row.reservation_id}</td>
      <td class="cell-stack">
        <span class="cell-strong">${row.customer_name}</span>
        <span class="cell-sub">${formatDate(row.check_in_date)} to ${formatDate(row.check_out_date)}</span>
      </td>
      <td>${row.room_number}</td>
      <td>${isArrival
        ? '<span class="badge badge-blue">Arrival</span>'
        : '<span class="badge badge-violet">Departure</span>'}</td>
      <td>${statusBadge(row.reservation_status)}</td>
    </tr>`;
  }).join('');
}

function renderRooms(rooms) {
  const body = $('#roomRows');
  if (!rooms.length) {
    body.innerHTML = emptyRow(6, 'No rooms are defined yet.');
    return;
  }
  body.innerHTML = rooms.map((room) => `<tr>
    <td class="cell-strong">${room.room_number}</td>
    <td>${room.type_name}</td>
    <td class="num">${room.capacity}</td>
    <td class="num">${money(room.base_price)}</td>
    <td class="num">${room.active_bookings}</td>
    <td>${statusBadge(room.room_status)}</td>
  </tr>`).join('');
}

function renderReservations(reservations) {
  const body = $('#reservationRows');
  if (!reservations.length) {
    body.innerHTML = emptyRow(8, 'No reservations have been created yet.');
    return;
  }
  body.innerHTML = reservations.map((row) => `<tr>
    <td class="cell-strong">#${row.reservation_id}</td>
    <td class="cell-stack">
      <span class="cell-strong">${row.customer_name}</span>
      <span class="cell-sub">${row.phone}</span>
    </td>
    <td class="cell-stack">
      <span class="cell-strong">${row.room_number}</span>
      <span class="cell-sub">${row.room_type}</span>
    </td>
    <td class="nowrap">${formatDate(row.check_in_date)} &rarr; ${formatDate(row.check_out_date)}</td>
    <td class="num">${row.nights}</td>
    <td class="num">${money(row.total_amount)}</td>
    <td class="num">${Number(row.balance_due) > 0 ? money(row.balance_due) : '<span class="muted">Settled</span>'}</td>
    <td>${statusBadge(row.reservation_status)}</td>
  </tr>`).join('');
}

boot('dashboard');

const dateInput = $('#dashDate');
dateInput.value = new Date().toISOString().slice(0, 10);
dateInput.addEventListener('change', load);
$('#refreshBtn').addEventListener('click', load);

load();
