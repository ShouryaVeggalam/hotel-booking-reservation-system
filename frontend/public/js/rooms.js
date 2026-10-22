/* =====================================================================
   rooms.js - room directory and room category management
   ===================================================================== */
import api from './api.js';
import {
  $, boot, toast, money, statusBadge, emptyRow, openModal, closeModal,
  confirmAction, ICONS, escapeHtml,
} from './ui.js';

let rooms = [];
let types = [];
let editingRoomId = null;
let editingTypeId = null;

const STATUS_TONE = {
  Available: 'badge-green',
  Maintenance: 'badge-amber',
  Inactive: 'badge-grey',
};

async function loadAll() {
  try {
    const [roomRes, typeRes] = await Promise.all([
      api.get('/rooms'),
      api.get('/room-types'),
    ]);
    rooms = roomRes.data;
    types = typeRes.data;
    renderStats();
    renderRooms();
    renderTypes();
    populateTypeSelects();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderStats() {
  const available = rooms.filter((room) => room.room_status === 'Available').length;
  const maintenance = rooms.filter((room) => room.room_status === 'Maintenance').length;
  const inactive = rooms.filter((room) => room.room_status === 'Inactive').length;
  const capacity = rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0);

  const cards = [
    { label: 'Total rooms', value: rooms.length, note: 'Rooms in the hotel', tone: '', icon: 'rooms' },
    { label: 'Available', value: available, note: 'Open for new bookings', tone: 'green', icon: 'availability' },
    { label: 'In maintenance', value: maintenance, note: 'Temporarily out of service', tone: 'teal', icon: 'rooms' },
    { label: 'Inactive', value: inactive, note: 'Retired from inventory', tone: '', icon: 'rooms' },
    { label: 'Guest capacity', value: capacity, note: 'Maximum sleeping guests', tone: 'violet', icon: 'customers' },
    { label: 'Categories', value: types.length, note: 'Distinct room types', tone: 'blue', icon: 'reports' },
  ];

  $('#roomStats').innerHTML = cards.map((card) => `
    <div class="stat ${card.tone}">
      <div class="stat-top">
        <span class="stat-label">${card.label}</span>
        <span class="stat-icon">${ICONS[card.icon] || ''}</span>
      </div>
      <div class="stat-value">${Number(card.value).toLocaleString('en-IN')}</div>
      <div class="stat-note">${card.note}</div>
    </div>`).join('');
}

function filteredRooms() {
  const q = $('#roomSearch').value.trim().toLowerCase();
  const status = $('#statusFilter').value;
  const typeId = $('#typeFilter').value;

  return rooms.filter((room) => {
    if (status && room.room_status !== status) return false;
    if (typeId && String(room.room_type_id) !== typeId) return false;
    if (!q) return true;
    return room.room_number.toLowerCase().includes(q)
      || room.type_name.toLowerCase().includes(q);
  });
}

function renderRooms() {
  const list = filteredRooms();
  const body = $('#roomRows');

  if (!list.length) {
    body.innerHTML = emptyRow(8, 'No room matches the current filter.');
    return;
  }

  body.innerHTML = list.map((room) => `<tr>
    <td class="cell-strong">${escapeHtml(room.room_number)}</td>
    <td>${escapeHtml(room.type_name)}</td>
    <td class="num">${room.floor_no}</td>
    <td class="num">${room.capacity}</td>
    <td class="num">${money(room.base_price)}</td>
    <td class="num">${room.active_bookings}</td>
    <td>${statusBadge(room.room_status)}</td>
    <td class="right nowrap">
      <button class="btn btn-sm" data-edit-room="${room.room_id}">Edit</button>
      <button class="btn btn-sm" data-status-room="${room.room_id}" data-next="${nextStatus(room.room_status)}">
        ${nextStatus(room.room_status)}
      </button>
      <button class="btn btn-sm btn-danger" data-delete-room="${room.room_id}">Delete</button>
    </td>
  </tr>`).join('');
}

function nextStatus(current) {
  if (current === 'Available') return 'Maintenance';
  if (current === 'Maintenance') return 'Available';
  return 'Available';
}

function renderTypes() {
  const body = $('#typeRows');
  if (!types.length) {
    body.innerHTML = emptyRow(6, 'No room category has been defined yet.');
    return;
  }
  body.innerHTML = types.map((type) => `<tr>
    <td class="cell-strong">${escapeHtml(type.type_name)}</td>
    <td class="num">${money(type.base_price)}</td>
    <td class="num">${type.capacity}</td>
    <td class="num">${type.room_count}</td>
    <td class="muted small">${escapeHtml(type.description || '—')}</td>
    <td class="right nowrap">
      <button class="btn btn-sm" data-edit-type="${type.room_type_id}">Edit</button>
      <button class="btn btn-sm btn-danger" data-delete-type="${type.room_type_id}">Delete</button>
    </td>
  </tr>`).join('');
}

function populateTypeSelects() {
  const options = types.map((type) => `<option value="${type.room_type_id}">${escapeHtml(type.type_name)} — ${money(type.base_price)}</option>`).join('');
  $('#roomType').innerHTML = options;
  $('#typeFilter').innerHTML = `<option value="">All categories</option>${options}`;
}

/* ------------------------------ room modal ------------------------------ */

function openRoomModal(room = null) {
  editingRoomId = room ? room.room_id : null;
  $('#roomModalTitle').textContent = room ? `Edit room ${room.room_number}` : 'Add a room';
  $('#roomSubmit').textContent = room ? 'Save changes' : 'Save room';
  $('#roomNumber').value = room ? room.room_number : '';
  $('#roomType').value = room ? String(room.room_type_id) : (types[0] ? String(types[0].room_type_id) : '');
  $('#roomFloor').value = room ? room.floor_no : 1;
  $('#roomStatus').value = room ? room.room_status : 'Available';
  openModal('roomModal');
}

$('#addRoomBtn').addEventListener('click', () => openRoomModal());

$('#roomForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#roomSubmit');
  const payload = {
    room_number: $('#roomNumber').value.trim(),
    room_type_id: Number($('#roomType').value),
    floor_no: Number($('#roomFloor').value),
    room_status: $('#roomStatus').value,
  };

  button.disabled = true;
  try {
    if (editingRoomId) {
      await api.put(`/rooms/${editingRoomId}`, payload);
      toast(`Room ${payload.room_number} updated.`);
    } else {
      await api.post('/rooms', payload);
      toast(`Room ${payload.room_number} added.`);
    }
    closeModal('roomModal');
    await loadAll();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

/* --------------------------- type category form -------------------------- */

function resetTypeForm() {
  editingTypeId = null;
  $('#typeFormTitle').textContent = 'Add a category';
  $('#typeSubmit').textContent = 'Add category';
  $('#typeCancel').classList.add('hidden');
  $('#typeName').value = '';
  $('#typePrice').value = '';
  $('#typeCapacity').value = '';
  $('#typeDescription').value = '';
}

$('#typeBtn').addEventListener('click', () => openModal('typeModal'));

$('#typeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    type_name: $('#typeName').value.trim(),
    base_price: Number($('#typePrice').value),
    capacity: Number($('#typeCapacity').value),
    description: $('#typeDescription').value.trim() || null,
  };

  try {
    if (editingTypeId) {
      await api.put(`/room-types/${editingTypeId}`, payload);
      toast(`Category "${payload.type_name}" updated.`);
    } else {
      await api.post('/room-types', payload);
      toast(`Category "${payload.type_name}" added.`);
    }
    resetTypeForm();
    await loadAll();
  } catch (error) {
    toast(error.message, 'error');
  }
});

$('#typeCancel').addEventListener('click', resetTypeForm);

/* ------------------------------ row actions ----------------------------- */

document.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  const editRoom = target.dataset.editRoom;
  const statusRoom = target.dataset.statusRoom;
  const deleteRoom = target.dataset.deleteRoom;
  const editType = target.dataset.editType;
  const deleteType = target.dataset.deleteType;

  if (editRoom) {
    const room = rooms.find((item) => item.room_id === Number(editRoom));
    if (room) openRoomModal(room);
  }

  if (statusRoom) {
    const room = rooms.find((item) => item.room_id === Number(statusRoom));
    if (!room) return;
    const next = target.dataset.next;
    try {
      await api.patch(`/rooms/${room.room_id}/status`, { room_status: next });
      toast(`Room ${room.room_number} is now ${next}.`);
      await loadAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  if (deleteRoom) {
    const room = rooms.find((item) => item.room_id === Number(deleteRoom));
    if (!room) return;
    const confirmed = await confirmAction(
      `Delete room ${room.room_number}? This cannot be undone.`,
      { title: 'Delete room', confirmText: 'Delete' },
    );
    if (!confirmed) return;
    try {
      await api.del(`/rooms/${room.room_id}`);
      toast(`Room ${room.room_number} deleted.`);
      await loadAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  if (editType) {
    const type = types.find((item) => item.room_type_id === Number(editType));
    if (!type) return;
    editingTypeId = type.room_type_id;
    $('#typeFormTitle').textContent = `Edit category "${type.type_name}"`;
    $('#typeSubmit').textContent = 'Save changes';
    $('#typeCancel').classList.remove('hidden');
    $('#typeName').value = type.type_name;
    $('#typePrice').value = type.base_price;
    $('#typeCapacity').value = type.capacity;
    $('#typeDescription').value = type.description || '';
  }

  if (deleteType) {
    const type = types.find((item) => item.room_type_id === Number(deleteType));
    if (!type) return;
    const confirmed = await confirmAction(
      `Delete the category "${type.type_name}"?`,
      { title: 'Delete category', confirmText: 'Delete' },
    );
    if (!confirmed) return;
    try {
      await api.del(`/room-types/${type.room_type_id}`);
      toast(`Category "${type.type_name}" deleted.`);
      resetTypeForm();
      await loadAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }
});

/* -------------------------------- filters ------------------------------- */

$('#roomSearch').addEventListener('input', renderRooms);
$('#statusFilter').addEventListener('change', renderRooms);
$('#typeFilter').addEventListener('change', renderRooms);

boot('rooms');
loadAll();
