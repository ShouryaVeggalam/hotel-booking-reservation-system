/* =====================================================================
   reservations.js - the reservation register
   ===================================================================== */
import api from './api.js';
import {
  $, boot, toast, money, formatDate, formatDateTime, statusBadge, emptyRow,
  openModal, closeModal, confirmAction, escapeHtml, ICONS,
} from './ui.js';

let reservations = [];
let activeId = null;

async function loadReservations() {
  try {
    const { data } = await api.get('/reservations', {
      q: $('#searchField').value.trim(),
      status: $('#statusFilter').value,
      from: $('#fromDate').value,
      to: $('#toDate').value,
    });
    reservations = data;
    renderStats();
    renderTable();
  } catch (error) {
    toast(error.message, 'error');
    $('#reservationRows').innerHTML = emptyRow(10, 'Could not load the reservations.');
  }
}

function renderStats() {
  const total = reservations.length;
  const active = reservations.filter((row) => ['Pending', 'Confirmed', 'Checked_In'].includes(row.reservation_status)).length;
  const billed = reservations.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const paid = reservations.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  const due = reservations.reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
  const nights = reservations.reduce((sum, row) => sum + Number(row.nights || 0), 0);

  const cards = [
    { label: 'Reservations shown', value: total, note: 'Matching the current filter', tone: '', icon: 'reservations' },
    { label: 'Active bookings', value: active, note: 'Pending, Confirmed or Checked In', tone: 'blue', icon: 'availability' },
    { label: 'Nights booked', value: nights, note: 'Total room nights', tone: 'violet', icon: 'dashboard' },
    { label: 'Total billed', value: money(billed), note: 'Value of the stays', tone: 'teal', icon: 'reports' },
    { label: 'Collected', value: money(paid), note: 'Paid payments only', tone: 'green', icon: 'payments' },
    { label: 'Balance due', value: money(due), note: 'Still to be collected', tone: 'red', icon: 'reports' },
  ];

  $('#reservationStats').innerHTML = cards.map((card) => `
    <div class="stat ${card.tone}">
      <div class="stat-top">
        <span class="stat-label">${card.label}</span>
        <span class="stat-icon">${ICONS[card.icon] || ''}</span>
      </div>
      <div class="stat-value">${typeof card.value === 'string' ? card.value : Number(card.value).toLocaleString('en-IN')}</div>
      <div class="stat-note">${card.note}</div>
    </div>`).join('');
}

function renderTable() {
  const body = $('#reservationRows');
  if (!reservations.length) {
    body.innerHTML = emptyRow(10, 'No reservation matches the current filter.');
    return;
  }

  body.innerHTML = reservations.map((row) => `<tr>
    <td class="cell-strong">#${row.reservation_id}</td>
    <td class="cell-stack">
      <span class="cell-strong">${escapeHtml(row.customer_name)}</span>
      <span class="cell-sub">${escapeHtml(row.phone)}</span>
    </td>
    <td class="cell-stack">
      <span class="cell-strong">${escapeHtml(row.room_number)}</span>
      <span class="cell-sub">${escapeHtml(row.room_type)}</span>
    </td>
    <td class="nowrap">${formatDate(row.check_in_date)} &rarr; ${formatDate(row.check_out_date)}</td>
    <td class="num">${row.nights}</td>
    <td class="num">${money(row.total_amount)}</td>
    <td class="num">${money(row.paid_amount)}</td>
    <td class="num">${Number(row.balance_due) > 0 ? money(row.balance_due) : '<span class="muted">Settled</span>'}</td>
    <td>${statusBadge(row.reservation_status)}</td>
    <td class="right nowrap">
      <button class="btn btn-sm" data-view="${row.reservation_id}">View</button>
      <button class="btn btn-sm" data-pay="${row.reservation_id}">Payment</button>
      <button class="btn btn-sm" data-status="${row.reservation_id}">Status</button>
      ${row.reservation_status !== 'Cancelled' && row.reservation_status !== 'Checked_Out'
        ? `<button class="btn btn-sm btn-danger" data-cancel="${row.reservation_id}">Cancel</button>`
        : ''}
    </td>
  </tr>`).join('');
}

/* ------------------------------ detail --------------------------------- */

async function openDetail(reservationId) {
  try {
    const { data } = await api.get(`/reservations/${reservationId}`);
    activeId = data.reservation_id;

    $('#detailTitle').textContent = `Reservation #${data.reservation_id}`;
    $('#detailSub').textContent =
      `${data.customer_name} · room ${data.room_number} (${data.room_type}) · ${formatDate(data.check_in_date)} to ${formatDate(data.check_out_date)}`;

    const payments = data.payments.length
      ? data.payments.map((payment) => `<tr>
          <td>#${payment.payment_id}</td>
          <td>${formatDateTime(payment.payment_date)}</td>
          <td class="num">${money(payment.amount)}</td>
          <td>${escapeHtml(String(payment.payment_method).replace('_', ' '))}</td>
          <td>${statusBadge(payment.payment_status)}</td>
          <td class="mono">${escapeHtml(payment.transaction_reference || '—')}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="muted">No payment has been recorded yet.</td></tr>';

    const history = data.history.length
      ? data.history.map((entry) => `<tr>
          <td>#${entry.log_id}</td>
          <td>${escapeHtml(entry.old_status ? entry.old_status.replace('_', ' ') : 'created')}</td>
          <td>${escapeHtml(entry.new_status.replace('_', ' '))}</td>
          <td>${formatDateTime(entry.changed_at)}</td>
          <td class="mono">${escapeHtml(entry.changed_by)}</td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="muted">No audit entry.</td></tr>';

    $('#detailBody').innerHTML = `
      <div class="grid two">
        <div>
          <h3 style="margin-bottom:12px">Stay</h3>
          <dl class="kv">
            <dt>Guest</dt><dd>${escapeHtml(data.customer_name)}</dd>
            <dt>Phone</dt><dd>${escapeHtml(data.phone)}</dd>
            <dt>Email</dt><dd>${escapeHtml(data.email)}</dd>
            <dt>Room</dt><dd>${escapeHtml(data.room_number)} · ${escapeHtml(data.room_type)}</dd>
            <dt>Floor</dt><dd>${data.room ? data.room.floor_no : '—'}</dd>
            <dt>Check-in</dt><dd>${formatDate(data.check_in_date)}</dd>
            <dt>Check-out</dt><dd>${formatDate(data.check_out_date)}</dd>
            <dt>Nights</dt><dd>${data.nights}</dd>
            <dt>Guests</dt><dd>${data.customer ? '—' : '—'}</dd>
            <dt>Status</dt><dd>${statusBadge(data.reservation_status)}</dd>
            <dt>Booked on</dt><dd>${formatDateTime(data.booking_date)}</dd>
          </dl>
        </div>
        <div>
          <h3 style="margin-bottom:12px">Money</h3>
          <dl class="kv">
            <dt>Bill</dt><dd>${money(data.total_amount)}</dd>
            <dt>Paid</dt><dd>${money(data.paid_amount)}</dd>
            <dt>Balance</dt><dd>${money(data.balance_due)}</dd>
          </dl>
        </div>
      </div>

      <div class="divider"></div>

      <h3 style="margin-bottom:12px">Payments</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Date</th><th class="num">Amount</th><th>Method</th><th>Status</th><th>Reference</th></tr></thead>
          <tbody>${payments}</tbody>
        </table>
      </div>

      <div class="divider"></div>

      <h3 style="margin-bottom:12px">Status history</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>From</th><th>To</th><th>When</th><th>Changed by</th></tr></thead>
          <tbody>${history}</tbody>
        </table>
      </div>`;

    openModal('detailModal');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------------------------- status change ---------------------------- */

function openStatusModal(reservationId) {
  const row = reservations.find((item) => item.reservation_id === Number(reservationId));
  if (!row) return;
  activeId = row.reservation_id;
  $('#statusSub').textContent = `Reservation #${row.reservation_id} is currently ${row.reservation_status.replace('_', ' ')}`;
  $('#newStatus').value = row.reservation_status;
  openModal('statusModal');
}

$('#statusForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#statusSubmit');
  button.disabled = true;
  try {
    await api.patch(`/reservations/${activeId}/status`, { status: $('#newStatus').value });
    toast(`Reservation #${activeId} is now ${$('#newStatus').value.replace('_', ' ')}.`);
    closeModal('statusModal');
    await loadReservations();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* ------------------------------ payment -------------------------------- */

function openPaymentModal(reservationId) {
  const row = reservations.find((item) => item.reservation_id === Number(reservationId));
  if (!row) return;
  activeId = row.reservation_id;

  $('#paymentSub').textContent = `Reservation #${row.reservation_id} · ${row.customer_name} · room ${row.room_number}`;
  $('#paymentInfo').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;flex:0 0 16px">
      <circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
    <span>Bill <strong>${money(row.total_amount)}</strong> · already paid <strong>${money(row.paid_amount)}</strong> ·
    remaining balance <strong>${money(row.balance_due)}</strong>. The database rejects any payment above the balance.</span>`;

  $('#payAmount').value = Number(row.balance_due) > 0 ? row.balance_due : '';
  $('#payMethod').value = 'UPI';
  $('#payStatus').value = 'Paid';
  $('#payReference').value = '';
  openModal('paymentModal');
}

$('#paymentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#paySubmit');
  const payload = {
    reservation_id: activeId,
    amount: Number($('#payAmount').value),
    payment_method: $('#payMethod').value,
    payment_status: $('#payStatus').value,
    transaction_reference: $('#payReference').value.trim() || null,
  };

  button.disabled = true;
  try {
    await api.post('/payments', payload);
    toast(`Payment of ${money(payload.amount)} recorded for reservation #${activeId}.`);
    closeModal('paymentModal');
    await loadReservations();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* ------------------------------- actions ------------------------------- */

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.view) openDetail(button.dataset.view);
  if (button.dataset.pay) openPaymentModal(button.dataset.pay);
  if (button.dataset.status) openStatusModal(button.dataset.status);

  if (button.dataset.cancel) {
    const id = Number(button.dataset.cancel);
    const row = reservations.find((item) => item.reservation_id === id);
    const confirmed = await confirmAction(
      `Cancel reservation #${id} for ${row ? row.customer_name : ''}? The room becomes available again immediately.`,
      { title: 'Cancel reservation', confirmText: 'Cancel booking' },
    );
    if (!confirmed) return;
    try {
      await api.post(`/reservations/${id}/cancel`);
      toast(`Reservation #${id} cancelled.`);
      await loadReservations();
    } catch (error) {
      toast(error.message, 'error');
    }
  }
});

/* -------------------------------- filters ------------------------------- */

let debounce;
$('#searchField').addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadReservations, 250);
});
$('#statusFilter').addEventListener('change', loadReservations);
$('#fromDate').addEventListener('change', loadReservations);
$('#toDate').addEventListener('change', loadReservations);
$('#clearFilters').addEventListener('click', () => {
  $('#searchField').value = '';
  $('#statusFilter').value = '';
  $('#fromDate').value = '';
  $('#toDate').value = '';
  loadReservations();
});
$('#refreshBtn').addEventListener('click', loadReservations);

boot('reservations');
loadReservations();
