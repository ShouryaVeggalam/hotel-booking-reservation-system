/* =====================================================================
   payments.js - payment ledger
   ===================================================================== */
import api from './api.js';
import {
  $, boot, toast, money, formatDateTime, statusBadge, emptyRow, openModal,
  closeModal, escapeHtml, ICONS,
} from './ui.js';

let payments = [];
let totals = {};
let reservations = [];

async function loadPayments() {
  try {
    const response = await api.get('/payments', {
      from: $('#fromDate').value,
      to: $('#toDate').value,
      method: $('#methodFilter').value,
      status: $('#statusFilter').value,
    });
    payments = response.data;
    totals = response.meta || {};
    renderStats();
    renderTable();
  } catch (error) {
    toast(error.message, 'error');
    $('#paymentRows').innerHTML = emptyRow(9, 'Could not load the payments.');
  }
}

async function loadReservations() {
  try {
    const response = await api.get('/reservations');
    reservations = response.data.filter((row) => row.reservation_status !== 'Cancelled');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderStats() {
  const cards = [
    { label: 'Payment rows', value: totals.payment_count || 0, note: 'Transactions matching the filter', tone: '', icon: 'payments' },
    { label: 'Collected', value: money(totals.total_paid), note: 'Status Paid only', tone: 'green', icon: 'payments' },
    { label: 'Pending', value: money(totals.total_pending), note: 'Not yet settled', tone: 'teal', icon: 'reports' },
    { label: 'Refunded', value: money(totals.total_refunded), note: 'Returned to the guest', tone: 'blue', icon: 'reports' },
    { label: 'Failed', value: money(totals.total_failed), note: 'Rejected transactions', tone: 'red', icon: 'reports' },
  ];

  $('#paymentStats').innerHTML = cards.map((card) => `
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
  const body = $('#paymentRows');
  if (!payments.length) {
    body.innerHTML = emptyRow(9, 'No payment matches the current filter.');
    return;
  }

  body.innerHTML = payments.map((row) => `<tr>
    <td class="cell-strong">#${row.payment_id}</td>
    <td class="nowrap">${formatDateTime(row.payment_date)}</td>
    <td class="cell-stack">
      <span class="cell-strong">${escapeHtml(row.customer_name)}</span>
      <span class="cell-sub">Reservation #${row.reservation_id}</span>
    </td>
    <td>${escapeHtml(row.room_number)}</td>
    <td class="num">${money(row.bill_amount)}</td>
    <td>${escapeHtml(String(row.payment_method).replace('_', ' '))}</td>
    <td>${statusBadge(row.payment_status)}</td>
    <td class="num cell-strong">${money(row.amount)}</td>
    <td class="mono">${escapeHtml(row.transaction_reference || '—')}</td>
  </tr>`).join('');
}

/* ------------------------------ new payment ---------------------------- */

$('#newPaymentBtn').addEventListener('click', async () => {
  if (!reservations.length) await loadReservations();
  if (!reservations.length) {
    toast('There is no reservation to pay for yet.', 'error');
    return;
  }

  $('#payReservation').innerHTML = reservations.map((row) => {
    const label = `#${row.reservation_id} · ${row.customer_name} · room ${row.room_number} · balance ${money(row.balance_due)}`;
    return `<option value="${row.reservation_id}"${Number(row.balance_due) <= 0 ? ' disabled' : ''}>${label}</option>`;
  }).join('');

  const firstPayable = reservations.find((row) => Number(row.balance_due) > 0);
  if (firstPayable) {
    $('#payReservation').value = String(firstPayable.reservation_id);
    $('#payAmount').value = firstPayable.balance_due;
  } else {
    $('#payAmount').value = '';
  }
  $('#payMethod').value = 'UPI';
  $('#payStatus').value = 'Paid';
  $('#payReference').value = '';
  openModal('paymentModal');
});

$('#payReservation').addEventListener('change', () => {
  const row = reservations.find((item) => item.reservation_id === Number($('#payReservation').value));
  if (row) $('#payAmount').value = row.balance_due;
});

$('#paymentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#paySubmit');
  const payload = {
    reservation_id: Number($('#payReservation').value),
    amount: Number($('#payAmount').value),
    payment_method: $('#payMethod').value,
    payment_status: $('#payStatus').value,
    transaction_reference: $('#payReference').value.trim() || null,
  };

  button.disabled = true;
  try {
    await api.post('/payments', payload);
    toast(`Payment of ${money(payload.amount)} recorded.`);
    closeModal('paymentModal');
    await loadPayments();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* -------------------------------- filters ------------------------------- */

$('#fromDate').addEventListener('change', loadPayments);
$('#toDate').addEventListener('change', loadPayments);
$('#methodFilter').addEventListener('change', loadPayments);
$('#statusFilter').addEventListener('change', loadPayments);
$('#clearFilters').addEventListener('click', () => {
  $('#fromDate').value = '';
  $('#toDate').value = '';
  $('#methodFilter').value = '';
  $('#statusFilter').value = '';
  loadPayments();
});

boot('payments');
loadPayments();
loadReservations();
