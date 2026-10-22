/* =====================================================================
   ui.js - shared interface helpers
   Shell (sidebar + navigation), toasts, modals, formatting.
   ===================================================================== */
import api from './api.js';

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/* ----------------------------- icons ----------------------------- */
export const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  rooms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12"/><path d="M15 10h4a2 2 0 0 1 2 2v6"/><path d="M3 18h18"/><path d="M7 8h3"/></svg>',
  customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  availability: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
  reservations: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  payments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M3 7 5 3h14l2 4"/><path d="M9 12h6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/></svg>',
  printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 17h12v4H6z"/></svg>',
};

export const PAGES = [
  { group: 'Operations' },
  { id: 'dashboard', href: 'index.html', label: 'Dashboard', icon: 'dashboard' },
  { id: 'availability', href: 'availability.html', label: 'Availability', icon: 'availability' },
  { id: 'reservations', href: 'reservations.html', label: 'Reservations', icon: 'reservations' },
  { id: 'payments', href: 'payments.html', label: 'Payments', icon: 'payments' },
  { group: 'Records' },
  { id: 'rooms', href: 'rooms.html', label: 'Rooms', icon: 'rooms' },
  { id: 'customers', href: 'customers.html', label: 'Customers', icon: 'customers' },
  { group: 'Analysis' },
  { id: 'reports', href: 'reports.html', label: 'Reports', icon: 'reports' },
];

/* ---------------------------- shell ------------------------------ */
export function renderShell(active) {
  const host = $('#sidebar');
  if (!host) return;

  const links = PAGES.map((page) => {
    if (page.group) return `<div class="nav-label">${page.group}</div>`;
    const icon = ICONS[page.icon] || '';
    const cls = page.id === active ? ' class="active"' : '';
    return `<a href="${page.href}"${cls}>${icon}<span>${page.label}</span></a>`;
  }).join('');

  host.innerHTML = `
    <div class="brand">
      <span class="brand-mark">S</span>
      <span class="brand-text"><strong>Staywise</strong><span>Hotel Operations</span></span>
    </div>
    <nav class="nav">${links}</nav>
    <div class="sidebar-foot">
      <span class="db-dot" id="dbDot"></span><span id="dbLabel">Checking MySQL...</span>
    </div>`;

  const toggle = $('.menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      host.classList.toggle('open');
    });
  }
  document.addEventListener('click', (event) => {
    if (window.innerWidth <= 980 && host.classList.contains('open') && !host.contains(event.target)) {
      host.classList.remove('open');
    }
  });
}

export async function refreshDbStatus() {
  const dot = $('#dbDot');
  const label = $('#dbLabel');
  if (!dot) return;
  try {
    const { data } = await api.get('/health');
    dot.classList.remove('off');
    label.textContent = `MySQL ${data.database.version} connected`;
  } catch {
    dot.classList.add('off');
    label.textContent = 'Database unreachable';
  }
}

/* ---------------------------- toast ------------------------------ */
export function toast(message, type = 'success') {
  const host = $('#toast');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'error' ? ICONS.alert : type === 'info' ? ICONS.info : ICONS.check;
  el.innerHTML = `${icon}<span></span>`;
  el.lastElementChild.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s ease, transform .25s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(14px)';
    setTimeout(() => el.remove(), 260);
  }, 3600);
}

/* ---------------------------- modal ------------------------------ */
export function openModal(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  el.classList.add('open');
  const focusable = el.querySelector('input:not([type=hidden]), select, textarea');
  if (focusable) setTimeout(() => focusable.focus(), 40);
}

export function closeModal(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.classList.remove('open');
}

export function initModals() {
  document.addEventListener('click', (event) => {
    if (event.target.dataset && event.target.dataset.close) {
      closeModal(event.target.dataset.close);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      $$('.modal-backdrop.open').forEach((el) => el.classList.remove('open'));
    }
  });
}

/** Small confirmation dialog built on the fly. */
export function confirmAction(message, { title = 'Please confirm', confirmText = 'Confirm', danger = true } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-head">
          <div><h2>${title}</h2></div>
          <button class="icon-btn" data-close="${''}">${ICONS.x}</button>
        </div>
        <div class="modal-body"><p style="font-size:13.5px;color:var(--ink-soft)">${message}</p></div>
        <div class="modal-foot">
          <button class="btn" data-act="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.addEventListener('click', (event) => {
      const act = event.target.dataset ? event.target.dataset.act : null;
      if (act === 'ok') finish(true);
      else if (act === 'cancel' || event.target === backdrop) finish(false);
      const closer = event.target.closest('[data-close]');
      if (closer) finish(false);
    });
  });
}

/* -------------------------- formatting --------------------------- */
export function money(value) {
  const number = Number(value || 0);
  return `₹${number.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

const STATUS_STYLE = {
  Pending: 'badge-amber',
  Confirmed: 'badge-blue',
  Checked_In: 'badge-violet',
  Checked_Out: 'badge-green',
  Cancelled: 'badge-red',
  Paid: 'badge-green',
  Refunded: 'badge-blue',
  Failed: 'badge-red',
  Available: 'badge-green',
  Maintenance: 'badge-amber',
  Inactive: 'badge-grey',
};

export function statusBadge(status, { plain = false } = {}) {
  const label = String(status || '').replace(/_/g, ' ');
  const cls = STATUS_STYLE[status] || 'badge-grey';
  return `<span class="badge ${cls}${plain ? ' plain' : ''}">${escapeHtml(label)}</span>`;
}

export function emptyRow(colspan, message = 'Nothing to show yet.') {
  return `<tr><td colspan="${colspan}">
    <div class="table-empty">${ICONS.empty}${escapeHtml(message)}</div>
  </td></tr>`;
}

export function setBusy(button, busy, label = 'Working...') {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

/** Download an array of rows as a CSV file. */
export function downloadCsv(filename, columns, rows) {
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [
    columns.map((column) => escapeCell(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Shared bootstrap for every page. */
export function boot(activePage) {
  renderShell(activePage);
  initModals();
  refreshDbStatus();
}
