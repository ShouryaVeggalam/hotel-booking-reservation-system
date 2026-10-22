#!/usr/bin/env node
/* =====================================================================
   verify_deployment.mjs

   A black box end to end check of a DEPLOYED Staywise instance.

   The script only talks to the HTTP API. It therefore works against
   the local server and against the public Render deployment in exactly
   the same way, and it proves that the deployed system behaves like
   the system that was tested during development.

   It walks through the eleven workflows of the deployment checklist:

     1  health endpoint
     2  dashboard metrics
     3  room inventory
     4  availability search
     5  create a reservation for a fictional guest
     6  the reservation survives a fresh read (persistence)
     7  record a payment and check the remaining balance
     8  an overlapping reservation is refused
     9  a status change is written to the audit log
    10  a payment above the balance is refused
    11  the test data is removed again

   Usage
     node scripts/verify_deployment.mjs https://staywise-dbms.vercel.app
     node scripts/verify_deployment.mjs http://localhost:3000 --keep
   ===================================================================== */

const args = process.argv.slice(2);
const baseArg = args.find((a) => !a.startsWith('--')) || 'http://localhost:3000';
const KEEP = args.includes('--keep');
const BASE = baseArg.replace(/\/+$/, '');

// The API base is /api unless the argument already contains it.
const API = BASE.endsWith('/api') ? BASE : `${BASE}/api`;

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function log(line = '') {
  console.log(line);
}

function record(ok, label, detail = '') {
  if (ok) {
    passed += 1;
    log(`  PASS  ${label}${detail ? `  ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(label);
    log(`  FAIL  ${label}${detail ? `  ${detail}` : ''}`);
  }
  return ok;
}

function skip(label, reason) {
  skipped += 1;
  log(`  SKIP  ${label}  (${reason})`);
}

async function api(path, options = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body, headers: res.headers };
}

/** A fictional guest and a fictional reservation. */
const stamp = Date.now().toString().slice(-8);
const GUEST = {
  first_name: 'Demo',
  last_name: `Verifier${stamp.slice(-4)}`,
  phone: `9199${stamp}`.slice(0, 15),
  email: `verifier.${stamp}@example.invalid`,
  address: 'Demonstration address, not a real place',
};

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

// Use a window far in the future so that the test never collides with
// the demonstration bookings of the seed file.
const CHECK_IN = iso(addDays(today, 400));
const CHECK_OUT = iso(addDays(today, 402));

let customerId = null;
let roomId = null;
let reservationId = null;
let paymentId = null;

async function main() {
  log(`====================================================================`);
  log(` Staywise deployment verification`);
  log(` Target : ${BASE}`);
  log(` Date   : ${new Date().toISOString()}`);
  log(`====================================================================`);
  log('');

  /* -- 1. health ---------------------------------------------------- */
  log('1. Health endpoint');
  const health = await api('/health');
  record(
    health.status === 200 && health.body?.data?.status === 'ok',
    'GET /api/health returns ok',
    `status=${health.status} db=${health.body?.data?.database?.version ?? 'n/a'}`,
  );
  record(
    Boolean(health.body?.data?.database?.db),
    'the health check really reached the database',
    `db=${health.body?.data?.database?.db ?? 'n/a'}`,
  );

  /* -- 2. dashboard ------------------------------------------------- */
  log('');
  log('2. Dashboard metrics');
  const dash = await api('/dashboard');
  const summary = dash.body?.data?.summary ?? dash.body?.data ?? {};
  const metrics = ['total_rooms', 'registered_customers', 'active_reservations', 'total_payments_collected'];
  const missing = metrics.filter((m) => summary[m] === undefined);
  record(dash.status === 200 && missing.length === 0, 'GET /api/dashboard returns the summary', `missing=${missing.join(',') || 'none'}`);
  log(`        rooms=${summary.total_rooms} customers=${summary.registered_customers} active=${summary.active_reservations}`);

  /* -- 3. room inventory -------------------------------------------- */
  log('');
  log('3. Room inventory');
  const roomsRes = await api('/rooms');
  const rooms = roomsRes.body?.data?.rooms ?? roomsRes.body?.data ?? [];
  record(Array.isArray(rooms) && rooms.length > 0, 'GET /api/rooms returns the inventory', `count=${rooms.length}`);
  const free = rooms.filter((r) => r.room_status === 'Available');
  record(free.length > 0, 'at least one room is marked Available', `available=${free.length}`);

  /* -- 4. availability ---------------------------------------------- */
  log('');
  log('4. Availability search');
  const avail = await api(`/availability?check_in=${CHECK_IN}&check_out=${CHECK_OUT}&guests=1`);
  const availRows = avail.body?.data?.rooms ?? avail.body?.data ?? [];
  record(avail.status === 200 && Array.isArray(availRows), 'GET /api/availability answers', `count=${Array.isArray(availRows) ? availRows.length : 'n/a'}`);

  /* -- 5. create a reservation -------------------------------------- */
  log('');
  log('5. Create a reservation for a fictional guest');
  const cust = await api('/customers', { method: 'POST', body: JSON.stringify(GUEST) });
  customerId = cust.body?.data?.customer?.customer_id ?? cust.body?.data?.customer_id ?? null;
  record(cust.status === 200 || cust.status === 201, 'POST /api/customers creates the guest', `customer_id=${customerId} status=${cust.status}`);

  const target = availRows.find((r) => r.room_status === 'Available' || r.room_status === undefined) ?? free[0];
  roomId = target?.room_id ?? target?.id ?? null;
  record(roomId !== null, 'a room was chosen for the test', `room_id=${roomId}`);

  const booking = await api('/reservations', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: customerId,
      room_id: roomId,
      check_in_date: CHECK_IN,
      check_out_date: CHECK_OUT,
      adults: 1,
      children: 0,
      remarks: 'DEPLOYMENT_VERIFY',
    }),
  });
  reservationId = booking.body?.data?.reservation?.reservation_id ?? booking.body?.data?.reservation_id ?? null;
  record(booking.status === 200 || booking.status === 201, 'POST /api/reservations creates the booking', `reservation_id=${reservationId} status=${booking.status}`);
  if (booking.status >= 400) log(`        server said: ${JSON.stringify(booking.body?.error ?? booking.body)}`);

  /* -- 6. persistence ------------------------------------------------ */
  log('');
  log('6. The reservation is still there after a fresh read');
  const reread = await api(`/reservations/${reservationId}`);
  const found = reread.body?.data?.reservation ?? reread.body?.data;
  record(reread.status === 200 && found && String(found.reservation_id ?? '') === String(reservationId), 'GET /api/reservations/:id returns the booking', `status=${reread.status}`);

  /* -- 7. payment and balance ---------------------------------------- */
  log('');
  log('7. Record a payment and check the balance');
  const total = Number(found?.total_amount ?? 0);
  const half = Math.round(total / 2 * 100) / 100;
  const pay = await api('/payments', {
    method: 'POST',
    body: JSON.stringify({
      reservation_id: reservationId,
      amount: half,
      payment_method: 'UPI',
      payment_status: 'Paid',
      transaction_reference: `VERIFY-${stamp}`,
    }),
  });
  paymentId = pay.body?.data?.payment?.payment_id ?? pay.body?.data?.payment_id ?? null;
  record(pay.status === 200 || pay.status === 201, 'POST /api/payments records the payment', `payment_id=${paymentId} amount=${half}`);

  const afterPay = await api(`/reservations/${reservationId}`);
  const afterData = afterPay.body?.data?.reservation ?? afterPay.body?.data;
  const balance = Number(afterData?.balance_due ?? afterData?.balance ?? NaN);
  record(Math.abs(balance - (total - half)) < 0.01, 'the remaining balance is total minus the payment', `balance=${balance} expected=${(total - half).toFixed(2)}`);

  /* -- 8. overlapping reservation is refused ------------------------- */
  log('');
  log('8. An overlapping reservation is refused by the database');
  const overlap = await api('/reservations', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: customerId,
      room_id: roomId,
      check_in_date: iso(addDays(today, 401)),
      check_out_date: iso(addDays(today, 403)),
      adults: 1,
      children: 0,
      remarks: 'DEPLOYMENT_VERIFY',
    }),
  });
  record(overlap.status === 409, 'POST /api/reservations returns 409 for a double booking', `status=${overlap.status}`);
  log(`        message: ${overlap.body?.error?.message ?? overlap.body?.error ?? 'n/a'}`);

  /* -- 9. status change and audit log -------------------------------- */
  log('');
  log('9. A status change is written to the audit log');
  const statusChange = await api(`/reservations/${reservationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Checked_In' }),
  });
  record(statusChange.status === 200, 'PATCH /api/reservations/:id/status changes the status', `status=${statusChange.status}`);
  if (statusChange.status >= 400) log(`        server said: ${JSON.stringify(statusChange.body?.error ?? statusChange.body)}`);

  const history = await api(`/reports/status-history`);
  const histRows = history.body?.data?.rows ?? history.body?.data ?? [];
  const logged = Array.isArray(histRows)
    ? histRows.find((r) => String(r.reservation_id) === String(reservationId))
    : null;
  record(Boolean(logged), 'the change is visible in the status history report', logged ? `new_status=${logged.new_status}` : 'row not found');

  /* -- 10. payment above the balance is refused ---------------------- */
  log('');
  log('10. A payment above the remaining balance is refused');
  const tooMuch = await api('/payments', {
    method: 'POST',
    body: JSON.stringify({
      reservation_id: reservationId,
      amount: total + 1000,
      payment_method: 'Card',
      payment_status: 'Paid',
      transaction_reference: `VERIFY-TOOBIG-${stamp}`,
    }),
  });
  record(tooMuch.status === 409 || tooMuch.status === 400, 'POST /api/payments refuses an oversized payment', `status=${tooMuch.status}`);
  log(`        message: ${tooMuch.body?.error?.message ?? tooMuch.body?.error ?? 'n/a'}`);

  /* -- 11. clean up -------------------------------------------------- */
  log('');
  log('11. Remove the test data again');
  if (!KEEP) {
    if (paymentId !== null) {
      const del = await api(`/payments/${paymentId}`, { method: 'DELETE' });
      record(del.status === 200 || del.status === 204 || del.status === 404, 'the test payment is removed', `status=${del.status}`);
    }
    if (reservationId !== null) {
      const del = await api(`/reservations/${reservationId}`, { method: 'DELETE' });
      record(del.status === 200 || del.status === 204 || del.status === 404, 'the test reservation is removed', `status=${del.status}`);
    }
    if (customerId !== null) {
      const del = await api(`/customers/${customerId}`, { method: 'DELETE' });
      record(del.status === 200 || del.status === 204 || del.status === 404, 'the test guest is removed', `status=${del.status}`);
    }
  } else {
    skip('clean up', '--keep was given, the test rows stay in the database');
  }

  /* -- summary -------------------------------------------------------- */
  log('');
  log('====================================================================');
  log(` Result: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) {
    log(' Failing checks:');
    for (const f of failures) log(`   - ${f}`);
  }
  log('====================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nThe verification script itself failed:');
  console.error(error);
  process.exit(2);
});
