/* =====================================================================
   customers.js - guest directory and booking history
   ===================================================================== */
import api from './api.js';
import {
  $, boot, toast, money, formatDate, statusBadge, emptyRow, openModal,
  closeModal, escapeHtml, ICONS,
} from './ui.js';

let customers = [];
let editingCustomerId = null;

async function loadCustomers() {
  try {
    const response = await api.get('/customers');
    customers = response.data;
    renderStats();
    renderCustomers();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderStats() {
  const total = customers.length;
  const withBookings = customers.filter((customer) => customer.reservation_count > 0).length;
  const repeat = customers.filter((customer) => customer.reservation_count > 1).length;
  const spend = customers.reduce((sum, customer) => sum + Number(customer.total_spent || 0), 0);

  const cards = [
    { label: 'Registered guests', value: total, note: 'Customers on record', tone: '', icon: 'customers' },
    { label: 'Guests with bookings', value: withBookings, note: 'At least one reservation', tone: 'blue', icon: 'reservations' },
    { label: 'Repeat guests', value: repeat, note: 'More than one booking', tone: 'violet', icon: 'customers' },
    { label: 'Lifetime booking value', value: money(spend), note: 'All non-cancelled bookings', tone: 'green', icon: 'payments' },
  ];

  $('#customerStats').innerHTML = cards.map((card) => `
    <div class="stat ${card.tone}">
      <div class="stat-top">
        <span class="stat-label">${card.label}</span>
        <span class="stat-icon">${ICONS[card.icon] || ''}</span>
      </div>
      <div class="stat-value">${typeof card.value === 'string' ? card.value : Number(card.value).toLocaleString('en-IN')}</div>
      <div class="stat-note">${card.note}</div>
    </div>`).join('');
}

function renderCustomers() {
  const q = $('#customerSearch').value.trim().toLowerCase();
  const list = customers.filter((customer) => {
    if (!q) return true;
    return `${customer.customer_name} ${customer.phone} ${customer.email} ${customer.address || ''}`
      .toLowerCase().includes(q);
  });

  const body = $('#customerRows');
  if (!list.length) {
    body.innerHTML = emptyRow(7, 'No guest matches the current search.');
    return;
  }

  body.innerHTML = list.map((customer) => `<tr>
    <td class="cell-strong">#${customer.customer_id}</td>
    <td class="cell-stack">
      <span class="cell-strong">${escapeHtml(customer.customer_name)}</span>
      <span class="cell-sub">Registered ${formatDate(customer.created_at)}</span>
    </td>
    <td class="cell-stack">
      <span>${escapeHtml(customer.phone)}</span>
      <span class="cell-sub">${escapeHtml(customer.email)}</span>
    </td>
    <td class="muted small">${escapeHtml(customer.address || '—')}</td>
    <td class="num">${customer.reservation_count}</td>
    <td class="num">${money(customer.total_spent)}</td>
    <td class="right nowrap">
      <button class="btn btn-sm" data-history="${customer.customer_id}">History</button>
      <button class="btn btn-sm" data-edit="${customer.customer_id}">Edit</button>
    </td>
  </tr>`).join('');
}

/* ------------------------------ modal --------------------------------- */

function openCustomerModal(customer = null) {
  editingCustomerId = customer ? customer.customer_id : null;
  $('#customerModalTitle').textContent = customer
    ? `Edit ${customer.customer_name}`
    : 'Register a guest';
  $('#customerSubmit').textContent = customer ? 'Save changes' : 'Save guest';
  $('#custFirst').value = customer ? customer.first_name : '';
  $('#custLast').value = customer ? customer.last_name : '';
  $('#custPhone').value = customer ? customer.phone : '';
  $('#custEmail').value = customer ? customer.email : '';
  $('#custAddress').value = customer ? customer.address || '' : '';
  openModal('customerModal');
}

$('#addCustomerBtn').addEventListener('click', () => openCustomerModal());

$('#customerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#customerSubmit');
  const payload = {
    first_name: $('#custFirst').value.trim(),
    last_name: $('#custLast').value.trim(),
    phone: $('#custPhone').value.trim(),
    email: $('#custEmail').value.trim(),
    address: $('#custAddress').value.trim() || null,
  };

  button.disabled = true;
  try {
    if (editingCustomerId) {
      await api.put(`/customers/${editingCustomerId}`, payload);
      toast(`${payload.first_name} ${payload.last_name} updated.`);
    } else {
      await api.post('/customers', payload);
      toast(`${payload.first_name} ${payload.last_name} registered.`);
    }
    closeModal('customerModal');
    await loadCustomers();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

async function openHistory(customerId) {
  const customer = customers.find((item) => item.customer_id === Number(customerId));
  try {
    const { data } = await api.get(`/customers/${customerId}/reservations`);
    $('#historyTitle').textContent = `${data.customer.customer_name} — booking history`;
    $('#historySub').textContent = `${data.customer.phone} · ${data.customer.email}`;

    const body = $('#historyRows');
    if (!data.reservations.length) {
      body.innerHTML = emptyRow(8, 'This guest has no reservations yet.');
    } else {
      body.innerHTML = data.reservations.map((row) => `<tr>
        <td class="cell-strong">#${row.reservation_id}</td>
        <td class="cell-stack">
          <span class="cell-strong">${escapeHtml(row.room_number)}</span>
          <span class="cell-sub">${escapeHtml(row.room_type)}</span>
        </td>
        <td class="nowrap">${formatDate(row.check_in_date)} &rarr; ${formatDate(row.check_out_date)}</td>
        <td class="num">${row.nights}</td>
        <td class="num">${money(row.total_amount)}</td>
        <td class="num">${money(row.paid_amount)}</td>
        <td class="num">${money(row.balance_due)}</td>
        <td>${statusBadge(row.reservation_status)}</td>
      </tr>`).join('');
    }
    openModal('historyModal');
  } catch (error) {
    toast(error.message, 'error');
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.edit) {
    const customer = customers.find((item) => item.customer_id === Number(button.dataset.edit));
    if (customer) openCustomerModal(customer);
  }
  if (button.dataset.history) openHistory(button.dataset.history);
});

$('#customerSearch').addEventListener('input', renderCustomers);

boot('customers');
loadCustomers();
