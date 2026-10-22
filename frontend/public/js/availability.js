/* =====================================================================
   availability.js - availability search and booking flow
   The search calls GET /api/availability, which runs the stored
   procedure sp_check_room_availability in MySQL.
   ===================================================================== */
import api from './api.js';
import {
  $, boot, toast, money, formatDate, emptyRow, openModal, closeModal,
  today, addDays, escapeHtml,
} from './ui.js';

let results = [];
let customers = [];

async function loadCustomers() {
  try {
    const response = await api.get('/customers');
    customers = response.data;
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function search() {
  const checkIn = $('#checkIn').value;
  const checkOut = $('#checkOut').value;
  const adults = Number($('#adults').value);
  const children = Number($('#children').value);

  if (!checkIn || !checkOut) {
    toast('Choose both a check-in and a check-out date.', 'error');
    return;
  }
  if (checkOut <= checkIn) {
    toast('The check-out date must be after the check-in date.', 'error');
    return;
  }

  const button = $('#searchBtn');
  button.disabled = true;
  try {
    const { data } = await api.get('/availability', {
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children,
    });
    results = data.rooms;
    renderResults(checkIn, checkOut, adults, children);
  } catch (error) {
    toast(error.message, 'error');
    $('#resultRows').innerHTML = emptyRow(8, 'The search could not be completed.');
  } finally {
    button.disabled = false;
  }
}

function renderResults(checkIn, checkOut, adults, children) {
  const body = $('#resultRows');
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);

  $('#resultTitle').textContent = 'Available rooms';
  $('#resultSub').textContent =
    `${formatDate(checkIn)} to ${formatDate(checkOut)} · ${nights} night${nights === 1 ? '' : 's'} · ${adults + children} guest${adults + children === 1 ? '' : 's'}`;
  $('#resultCount').textContent = `${results.length} room${results.length === 1 ? '' : 's'}`;

  if (!results.length) {
    body.innerHTML = emptyRow(8, 'No room satisfies this search. Try different dates or a smaller party.');
    return;
  }

  body.innerHTML = results.map((room) => `<tr>
    <td class="cell-strong">${escapeHtml(room.room_number)}</td>
    <td>${escapeHtml(room.type_name)}</td>
    <td class="num">${room.floor_no}</td>
    <td class="num">${room.capacity}</td>
    <td class="num">${money(room.base_price)}</td>
    <td class="num">${nights}</td>
    <td class="num">${money(room.base_price * nights)}</td>
    <td class="right">
      <button class="btn btn-sm btn-primary" data-book="${room.room_id}">Book this room</button>
    </td>
  </tr>`).join('');
}

/* ---------------------------- booking modal ---------------------------- */

function openBooking(room) {
  if (!customers.length) {
    toast('Register a guest before creating a booking.', 'error');
    return;
  }

  $('#bookCustomer').innerHTML = customers
    .map((customer) => `<option value="${customer.customer_id}">${escapeHtml(customer.customer_name)} — ${escapeHtml(customer.phone)}</option>`)
    .join('');

  $('#bookRoom').innerHTML = results
    .map((item) => `<option value="${item.room_id}"${item.room_id === room.room_id ? ' selected' : ''}>${escapeHtml(item.room_number)} — ${escapeHtml(item.type_name)} (${money(item.base_price)})</option>`)
    .join('');

  $('#bookCheckIn').value = $('#checkIn').value;
  $('#bookCheckOut').value = $('#checkOut').value;
  $('#bookAdults').value = $('#adults').value;
  $('#bookChildren').value = $('#children').value;
  $('#bookRemarks').value = '';

  const nights = Math.round((new Date($('#checkOut').value) - new Date($('#checkIn').value)) / 86400000);
  $('#bookingInfo').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:16px;height:16px;flex:0 0 16px">
      <circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
    <span>Room <strong>${escapeHtml(room.room_number)}</strong> will be locked by the database while the booking is
    written, so two front-desk staff cannot book it at the same time.
    Estimated bill: <strong>${money(room.base_price * nights)}</strong> for ${nights} night${nights === 1 ? '' : 's'}.</span>`;

  openModal('bookingModal');
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || !button.dataset.book) return;
  const room = results.find((item) => item.room_id === Number(button.dataset.book));
  if (room) openBooking(room);
});

$('#bookingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#bookSubmit');
  const payload = {
    customer_id: Number($('#bookCustomer').value),
    room_id: Number($('#bookRoom').value),
    check_in_date: $('#bookCheckIn').value,
    check_out_date: $('#bookCheckOut').value,
    adults: Number($('#bookAdults').value),
    children: Number($('#bookChildren').value),
    remarks: $('#bookRemarks').value.trim() || null,
  };

  button.disabled = true;
  try {
    const { data } = await api.post('/reservations', payload);
    toast(`Reservation #${data.reservation_id} created for room ${data.room_number}.`);
    closeModal('bookingModal');
    await search();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* -------------------------------- init --------------------------------- */

$('#searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  search();
});

$('#resetBtn').addEventListener('click', () => {
  $('#checkIn').value = today();
  $('#checkOut').value = addDays(today(), 1);
  $('#adults').value = 1;
  $('#children').value = 0;
  results = [];
  $('#resultRows').innerHTML = emptyRow(8, 'Run a search to see the rooms the database returns.');
  $('#resultSub').textContent = 'Run a search to see the rooms the database returns';
  $('#resultCount').textContent = '0 rooms';
});

$('#checkIn').value = today();
$('#checkOut').value = addDays(today(), 1);

boot('availability');
loadCustomers();
