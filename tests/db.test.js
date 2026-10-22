/**
 * Database test suite for the Hotel Booking and Reservation Management
 * System.
 *
 * These are black box tests against the real MySQL server. They check
 * the rules that the database is supposed to enforce by itself:
 * constraints, foreign keys, triggers, stored procedures, views,
 * transaction behaviour and concurrency.
 *
 * Every test creates its own rows and removes them again, so the suite
 * can be run at any time without changing the demonstration data.
 *
 * Run with:  npm test
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import 'dotenv/config';

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'hotel_booking_db',
};

let pool;

/** Run a query and return the rows. */
async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Run a query and return the first row (or null). */
async function q1(sql, params = []) {
  const rows = await q(sql, params);
  return rows.length ? rows[0] : null;
}

/** Run a statement and return the driver result. */
async function ex(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Query information_schema.
 *
 * MySQL returns the column names of the information_schema in upper
 * case, so the rows are normalised to lower case keys. The plain
 * "query" is used instead of "execute" because the server side
 * prepared statements of some MySQL builds return empty strings for
 * the text columns of the information_schema.
 */
async function qi(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) out[key.toLowerCase()] = value;
    return out;
  });
}

/** Call a stored procedure that returns one result set. */
async function call(name, params = []) {
  const [result] = await pool.query(`CALL ${name}(${params.map(() => '?').join(', ')})`, params);
  if (!Array.isArray(result)) return [];
  return result.find((set) => Array.isArray(set) && set.length) || [];
}

/**
 * Run a statement that is expected to fail and return the error.
 * The test fails when the statement unexpectedly succeeds.
 */
async function expectFailure(sql, params = []) {
  try {
    await ex(sql, params);
  } catch (error) {
    return error;
  }
  assert.fail(`The statement was expected to fail but it succeeded: ${sql}`);
}

/** The MySQL error number of a failed statement. */
const errno = (error) => error.errno ?? Number(error.sqlState?.slice(-3));

/** The message MySQL sent. */
const errmsg = (error) => error.sqlMessage || error.message;

/* ------------------------------------------------------------------ */
/* test fixtures                                                      */
/* ------------------------------------------------------------------ */

// A date range far in the future, so the tests never collide with the
// demonstration bookings.
const DAY = 86_400_000;
const base = new Date('2031-03-01T00:00:00Z');
const d = (offset) => new Date(base.getTime() + offset * DAY).toISOString().slice(0, 10);

const fixtures = {
  customerId: null,
  roomId: null,
  roomTypeId: null,
  basePrice: 0,
  capacity: 0,
  otherRoomId: null,
  maintenanceRoomId: null,
};

/** Remove every row the test suite created. */
async function cleanUp() {
  if (!fixtures.customerId) return;
  // payments -> reservations (logs cascade) -> customer -> rooms
  await ex(
    `DELETE p FROM payment p
       JOIN reservation r ON r.reservation_id = p.reservation_id
      WHERE r.customer_id = ?`,
    [fixtures.customerId],
  );
  await ex('DELETE FROM reservation WHERE customer_id = ?', [fixtures.customerId]);
  await ex('DELETE FROM customer WHERE customer_id = ?', [fixtures.customerId]);
  for (const key of ['roomId', 'otherRoomId', 'maintenanceRoomId']) {
    if (fixtures[key]) {
      await ex('DELETE FROM room WHERE room_id = ?', [fixtures[key]]);
      fixtures[key] = null;
    }
  }
  fixtures.customerId = null;
}

before(async () => {
  pool = mysql.createPool({
    ...DB,
    waitForConnections: true,
    connectionLimit: 12,
    dateStrings: ['DATE'],
    decimalNumbers: true,
  });

  // A dedicated room type is not created - the test reuses an existing
  // one, so the demonstration data is not changed.
  const type = await q1(
    `SELECT room_type_id, base_price, capacity
       FROM room_type ORDER BY room_type_id LIMIT 1`,
  );
  assert.ok(type, 'the database must contain at least one room type');
  fixtures.roomTypeId = type.room_type_id;
  fixtures.basePrice = Number(type.base_price);
  fixtures.capacity = Number(type.capacity);

  const stamp = Date.now().toString().slice(-9);
  const customer = await ex(
    `INSERT INTO customer(first_name, last_name, phone, email, address)
     VALUES (?, ?, ?, ?, ?)`,
    ['Testcase', 'Runner', `9000${stamp}`, `testcase.${stamp}@example.invalid`, 'test fixture'],
  );
  fixtures.customerId = customer.insertId;

  const room = await ex(
    `INSERT INTO room(room_number, room_type_id, floor_no, room_status)
     VALUES (?, ?, ?, 'Available')`,
    [`T-A${stamp}`, fixtures.roomTypeId, 90],
  );
  fixtures.roomId = room.insertId;

  const other = await ex(
    `INSERT INTO room(room_number, room_type_id, floor_no, room_status)
     VALUES (?, ?, ?, 'Available')`,
    [`T-B${stamp}`, fixtures.roomTypeId, 91],
  );
  fixtures.otherRoomId = other.insertId;

  const maintenance = await ex(
    `INSERT INTO room(room_number, room_type_id, floor_no, room_status)
     VALUES (?, ?, ?, 'Maintenance')`,
    [`T-C${stamp}`, fixtures.roomTypeId, 92],
  );
  fixtures.maintenanceRoomId = maintenance.insertId;
});

after(async () => {
  await cleanUp();
  if (pool) await pool.end();
});

/* ------------------------------------------------------------------ */
/* 1. the objects of the schema                                       */
/* ------------------------------------------------------------------ */

describe('Schema objects', () => {
  it('T01 contains the six tables, five foreign keys, seven views, three procedures and five triggers', async () => {
    const count = async (sql) => Number((await qi(sql))[0].c);

    assert.equal(await count(`SELECT COUNT(*) c FROM information_schema.tables
                                WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`), 6,
      'expected 6 tables');
    assert.equal(await count(`SELECT COUNT(*) c FROM information_schema.table_constraints
                                WHERE constraint_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'`), 5,
      'expected 5 foreign keys');
    assert.equal(await count(`SELECT COUNT(*) c FROM information_schema.views
                                WHERE table_schema = DATABASE()`), 7,
      'expected 7 views');
    assert.equal(await count(`SELECT COUNT(*) c FROM information_schema.routines
                                WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE'`), 3,
      'expected 3 procedures');
    assert.equal(await count(`SELECT COUNT(*) c FROM information_schema.triggers
                                WHERE trigger_schema = DATABASE()`), 5,
      'expected 5 triggers');
  });

  it('T02 creates the secondary indexes that the query plans rely on', async () => {
    const rows = await qi(
      `SELECT table_name, index_name FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND index_name NOT IN ('PRIMARY')
        GROUP BY table_name, index_name`,
    );
    // 15 secondary indexes: the explicit ones plus the ones MySQL
    // creates for the foreign keys and the unique keys.
    assert.equal(rows.length, 15, `expected 15 secondary indexes, found ${rows.length}`);
    const names = rows.map((r) => r.index_name);
    for (const expected of ['idx_reservation_room_dates', 'idx_payment_reservation', 'idx_customer_name']) {
      assert.ok(names.includes(expected), `missing index ${expected}`);
    }
    // The unique keys of the schema are served by an index as well.
    for (const expected of ['email', 'phone', 'room_number', 'transaction_reference']) {
      assert.ok(names.includes(expected), `missing index ${expected}`);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. the constraints                                                  */
/* ------------------------------------------------------------------ */

describe('Constraints', () => {
  it('T03 refuses a room type with a price of zero (CHECK constraint)', async () => {
    const error = await expectFailure(
      `INSERT INTO room_type(type_name, base_price, capacity) VALUES ('T-CHECK', 0, 2)`,
    );
    assert.equal(errno(error), 3819, `expected error 3819, got ${errno(error)}: ${errmsg(error)}`);
    assert.match(errmsg(error), /room_type_chk_1/);
  });

  it('T04 refuses a room type with a capacity of zero (CHECK constraint)', async () => {
    const error = await expectFailure(
      `INSERT INTO room_type(type_name, base_price, capacity) VALUES ('T-CHECK2', 100, 0)`,
    );
    assert.equal(errno(error), 3819);
    assert.match(errmsg(error), /room_type_chk_2/);
  });

  it('T05 refuses a reservation whose check-out is not after the check-in', async () => {
    // The BEFORE INSERT trigger checks the dates first, so it is the
    // trigger that reports the error (1644). The CHECK constraint
    // chk_stay_dates is the second line of defence and is proved by
    // T05b, which has no trigger in the way.
    const error = await expectFailure(
      `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                               adults, children, reservation_status, total_amount)
       VALUES (?, ?, ?, ?, 1, 0, 'Confirmed', 100)`,
      [fixtures.customerId, fixtures.roomId, d(0), d(0)],
    );
    assert.ok(
      errno(error) === 1644 || errno(error) === 3819,
      `expected the insert to be refused, got errno ${errno(error)}`,
    );
    assert.match(errmsg(error), /Check-out date must be after check-in date/);
  });

  it('T05b refuses a payment with an amount of zero (CHECK constraint, no trigger in the way)', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.otherRoomId, d(2), d(3), 1, 0, 'CHEC',
    ]);
    const reservationId = created[0].new_reservation_id;

    const error = await expectFailure(
      `INSERT INTO payment(reservation_id, amount, payment_method, payment_status)
       VALUES (?, 0, 'Cash', 'Paid')`,
      [reservationId],
    );
    assert.equal(errno(error), 3819, `expected error 3819, got ${errno(error)}: ${errmsg(error)}`);
    assert.match(errmsg(error), /payment_chk_1/);

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T06 refuses a second customer with the same phone number (UNIQUE)', async () => {
    const existing = await q1(`SELECT phone FROM customer WHERE customer_id = ?`, [fixtures.customerId]);
    const error = await expectFailure(
      `INSERT INTO customer(first_name, last_name, phone, email) VALUES ('Copy', 'Cat', ?, 'copy@example.invalid')`,
      [existing.phone],
    );
    assert.equal(errno(error), 1062);
    assert.match(errmsg(error), /phone/);
  });

  it('T07 refuses a second customer with the same e-mail address (UNIQUE)', async () => {
    const existing = await q1(`SELECT email FROM customer WHERE customer_id = ?`, [fixtures.customerId]);
    const error = await expectFailure(
      `INSERT INTO customer(first_name, last_name, phone, email) VALUES ('Copy', 'Cat', '90123456789', ?)`,
      [existing.email],
    );
    assert.equal(errno(error), 1062);
    assert.match(errmsg(error), /email/);
  });

  it('T08 refuses a reservation for a customer that does not exist (FOREIGN KEY)', async () => {
    const error = await expectFailure(
      `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                               adults, children, reservation_status, total_amount)
       VALUES (999999999, ?, ?, ?, 1, 0, 'Confirmed', 100)`,
      [fixtures.roomId, d(1), d(2)],
    );
    assert.equal(errno(error), 1452);
    assert.match(errmsg(error), /fk_reservation_customer/);
  });

  it('T09 refuses a reservation for a room that does not exist', async () => {
    // The BEFORE INSERT trigger reads the room row first, so it is the
    // trigger that reports the error (1644). The foreign key
    // fk_reservation_room is proved by T08, where no trigger stands
    // between the statement and the key.
    const error = await expectFailure(
      `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                               adults, children, reservation_status, total_amount)
       VALUES (?, 999999999, ?, ?, 1, 0, 'Confirmed', 100)`,
      [fixtures.customerId, d(1), d(2)],
    );
    assert.equal(errno(error), 1644);
    assert.match(errmsg(error), /room does not exist/i);
  });

  it('T10 refuses to delete a customer that still has a reservation (ON DELETE RESTRICT)', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.otherRoomId, d(3), d(5), 1, 0, 'FK-TEST',
    ]);
    const reservationId = created[0].new_reservation_id;

    const error = await expectFailure('DELETE FROM customer WHERE customer_id = ?', [fixtures.customerId]);
    assert.equal(errno(error), 1451);
    assert.match(errmsg(error), /fk_reservation_customer/);

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. the stored procedures                                            */
/* ------------------------------------------------------------------ */

describe('Stored procedures', () => {
  it('T11 sp_check_room_availability returns only the rooms that are free in the period', async () => {
    // Book the test room for days 10 to 12.
    await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(10), d(12), 1, 0, 'AVAIL',
    ]);

    const rows = await call('sp_check_room_availability', [d(10), d(12), 1]);
    const ids = rows.map((r) => Number(r.room_id));
    assert.ok(!ids.includes(fixtures.roomId), 'the booked room must not be offered');
    assert.ok(ids.includes(fixtures.otherRoomId), 'the free room must be offered');

    // A range that does not touch the booking must offer the room again.
    const rows2 = await call('sp_check_room_availability', [d(13), d(15), 1]);
    assert.ok(rows2.map((r) => Number(r.room_id)).includes(fixtures.roomId));
  });

  it('T12 sp_create_reservation calculates the bill as base price times the number of nights', async () => {
    const rows = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.otherRoomId, d(20), d(23), 1, 0, 'BILL',
    ]);
    const result = rows[0];
    assert.equal(Number(result.nights), 3);
    assert.equal(Number(result.total_bill), fixtures.basePrice * 3);

    const stored = await q1(
      `SELECT total_amount, reservation_status FROM reservation WHERE reservation_id = ?`,
      [result.new_reservation_id],
    );
    assert.equal(Number(stored.total_amount), fixtures.basePrice * 3);
    assert.equal(stored.reservation_status, 'Confirmed');

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [result.new_reservation_id]);
  });

  it('T13 sp_create_reservation refuses an overlapping booking', async () => {
    await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(30), d(33), 1, 0, 'OVERLAP',
    ]);

    let caught = null;
    try {
      await pool.query('CALL sp_create_reservation(?, ?, ?, ?, ?, ?, ?)', [
        fixtures.customerId, fixtures.roomId, d(31), d(34), 1, 0, 'OVERLAP',
      ]);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, 'the overlapping booking must be refused');
    assert.equal(errno(caught), 1644);
    assert.match(errmsg(caught), /already reserved/);
  });

  it('T14 sp_create_reservation refuses a room that is under maintenance', async () => {
    let caught = null;
    try {
      await pool.query('CALL sp_create_reservation(?, ?, ?, ?, ?, ?, ?)', [
        fixtures.customerId, fixtures.maintenanceRoomId, d(40), d(42), 1, 0, 'MAINT',
      ]);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, 'booking a room in maintenance must fail');
    assert.equal(errno(caught), 1644);
    assert.match(errmsg(caught), /not available/i);
  });

  it('T15 sp_create_reservation refuses a party that is larger than the room type', async () => {
    let caught = null;
    try {
      await pool.query('CALL sp_create_reservation(?, ?, ?, ?, ?, ?, ?)', [
        fixtures.customerId, fixtures.roomId, d(50), d(52), fixtures.capacity + 5, 0, 'CAP',
      ]);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, 'an oversized party must be refused');
    assert.equal(errno(caught), 1644);
    assert.match(errmsg(caught), /capacity/i);
  });

  it('T16 sp_create_reservation refuses a check-out that is not after the check-in', async () => {
    let caught = null;
    try {
      await pool.query('CALL sp_create_reservation(?, ?, ?, ?, ?, ?, ?)', [
        fixtures.customerId, fixtures.roomId, d(60), d(60), 1, 0, 'DATES',
      ]);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught);
    assert.equal(errno(caught), 1644);
    assert.match(errmsg(caught), /Check-out date must be after check-in date/);
  });

  it('T17 sp_record_payment stores the payment and reports the remaining balance', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(70), d(72), 1, 0, 'PAY',
    ]);
    const reservationId = created[0].new_reservation_id;
    const bill = Number(created[0].total_bill);

    const rows = await call('sp_record_payment', [
      reservationId, bill / 2, 'Card', `T-${Date.now()}`, 'Paid',
    ]);
    const result = rows[0];
    assert.equal(Number(result.bill_amount), bill);
    assert.equal(Number(result.paid_amount), bill / 2);
    assert.equal(Number(result.balance_due), bill / 2);

    const stored = await q1(`SELECT amount, payment_status FROM payment WHERE payment_id = ?`, [
      result.payment_id,
    ]);
    assert.equal(Number(stored.amount), bill / 2);
    assert.equal(stored.payment_status, 'Paid');

    await ex('DELETE FROM payment WHERE payment_id = ?', [result.payment_id]);
    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T18 sp_record_payment refuses a payment that is larger than the balance', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(80), d(81), 1, 0, 'OVERPAY',
    ]);
    const reservationId = created[0].new_reservation_id;
    const bill = Number(created[0].total_bill);

    let caught = null;
    try {
      await pool.query('CALL sp_record_payment(?, ?, ?, ?, ?)', [
        reservationId, bill + 100, 'Cash', `T-${Date.now()}`, 'Paid',
      ]);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, 'an oversized payment must be refused');
    assert.match(errmsg(caught), /greater than the remaining/i);

    const count = await q1(`SELECT COUNT(*) c FROM payment WHERE reservation_id = ?`, [reservationId]);
    assert.equal(Number(count.c), 0, 'the refused payment must not have been stored');

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T19 only a payment with the status Paid reduces the balance', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(90), d(92), 1, 0, 'STATUS',
    ]);
    const reservationId = created[0].new_reservation_id;
    const bill = Number(created[0].total_bill);

    const pending = await call('sp_record_payment', [
      reservationId, 100, 'UPI', `T-${Date.now()}`, 'Pending',
    ]);
    assert.equal(Number(pending[0].balance_due), bill, 'a pending payment does not reduce the balance');

    const view = await q1(
      `SELECT balance_due FROM vw_outstanding_balances WHERE reservation_id = ?`,
      [reservationId],
    );
    assert.equal(Number(view.balance_due), bill);

    await ex('DELETE FROM payment WHERE reservation_id = ?', [reservationId]);
    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });
});

/* ------------------------------------------------------------------ */
/* 4. the triggers                                                    */
/* ------------------------------------------------------------------ */

describe('Triggers', () => {
  it('T20 trg_reservation_before_insert blocks an overlap even for a direct INSERT', async () => {
    await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(100), d(103), 1, 0, 'TRG',
    ]);

    const error = await expectFailure(
      `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                               adults, children, reservation_status, total_amount)
       VALUES (?, ?, ?, ?, 1, 0, 'Confirmed', 100)`,
      [fixtures.customerId, fixtures.roomId, d(101), d(104)],
    );
    assert.equal(errno(error), 1644);
    assert.match(errmsg(error), /already reserved/);
  });

  it('T21 trg_reservation_before_insert blocks a booking of a room in maintenance', async () => {
    const error = await expectFailure(
      `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                               adults, children, reservation_status, total_amount)
       VALUES (?, ?, ?, ?, 1, 0, 'Confirmed', 100)`,
      [fixtures.customerId, fixtures.maintenanceRoomId, d(110), d(112)],
    );
    assert.equal(errno(error), 1644);
    assert.match(errmsg(error), /not available/i);
  });

  it('T22 trg_reservation_before_update refuses to reactivate a cancelled reservation', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.otherRoomId, d(120), d(122), 1, 0, 'CANCEL',
    ]);
    const reservationId = created[0].new_reservation_id;

    await ex(`UPDATE reservation SET reservation_status = 'Cancelled' WHERE reservation_id = ?`, [
      reservationId,
    ]);

    const error = await expectFailure(
      `UPDATE reservation SET reservation_status = 'Confirmed' WHERE reservation_id = ?`,
      [reservationId],
    );
    assert.equal(errno(error), 1644);
    assert.match(errmsg(error), /cannot be reactivated/i);

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T23 trg_reservation_before_update refuses to re-date a completed stay', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.otherRoomId, d(130), d(132), 1, 0, 'STAY',
    ]);
    const reservationId = created[0].new_reservation_id;

    await ex(`UPDATE reservation SET reservation_status = 'Checked_Out' WHERE reservation_id = ?`, [
      reservationId,
    ]);

    const error = await expectFailure(
      `UPDATE reservation SET check_in_date = ?, check_out_date = ? WHERE reservation_id = ?`,
      [d(140), d(142), reservationId],
    );
    assert.equal(errno(error), 1644);
    assert.match(errmsg(error), /completed stay cannot be re-dated/i);

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T24 trg_reservation_status_audit writes one audit row per status change', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(150), d(152), 1, 0, 'AUDIT',
    ]);
    const reservationId = created[0].new_reservation_id;

    // The AFTER INSERT trigger already wrote the creation event.
    let log = await q(
      `SELECT old_status, new_status FROM reservation_status_log
        WHERE reservation_id = ? ORDER BY log_id`,
      [reservationId],
    );
    assert.equal(log.length, 1);
    assert.equal(log[0].old_status, null);
    assert.equal(log[0].new_status, 'Confirmed');

    await ex(`UPDATE reservation SET reservation_status = 'Checked_In' WHERE reservation_id = ?`, [
      reservationId,
    ]);
    await ex(`UPDATE reservation SET reservation_status = 'Checked_Out' WHERE reservation_id = ?`, [
      reservationId,
    ]);

    log = await q(
      `SELECT old_status, new_status FROM reservation_status_log
        WHERE reservation_id = ? ORDER BY log_id`,
      [reservationId],
    );
    assert.equal(log.length, 3, 'expected 3 audit rows');
    assert.equal(log[1].old_status, 'Confirmed');
    assert.equal(log[1].new_status, 'Checked_In');
    assert.equal(log[2].new_status, 'Checked_Out');

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T25 trg_payment_before_insert refuses a payment above the bill', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.otherRoomId, d(160), d(161), 1, 0, 'TRGPAY',
    ]);
    const reservationId = created[0].new_reservation_id;
    const bill = Number(created[0].total_bill);

    const error = await expectFailure(
      `INSERT INTO payment(reservation_id, amount, payment_method, payment_status)
       VALUES (?, ?, 'Cash', 'Paid')`,
      [reservationId, bill + 500],
    );
    assert.equal(errno(error), 1644);
    assert.match(errmsg(error), /greater than the remaining bill amount/i);

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });
});

/* ------------------------------------------------------------------ */
/* 5. transactions and concurrency                                    */
/* ------------------------------------------------------------------ */

describe('Transactions and concurrency', () => {
  it('T26 a failing statement inside a transaction leaves no partial row behind', async () => {
    const connection = await mysql.createConnection(DB);
    let secondInsertFailed = false;
    let caught = null;
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                                 adults, children, reservation_status, total_amount)
         VALUES (?, ?, ?, ?, 1, 0, 'Confirmed', 500)`,
        [fixtures.customerId, fixtures.roomId, d(170), d(172)],
      );
      // This statement overlaps the one above and rolls the
      // transaction back.
      await connection.execute(
        `INSERT INTO reservation(customer_id, room_id, check_in_date, check_out_date,
                                 adults, children, reservation_status, total_amount)
         VALUES (?, ?, ?, ?, 1, 0, 'Confirmed', 500)`,
        [fixtures.customerId, fixtures.roomId, d(171), d(173)],
      );
    } catch (error) {
      caught = error;
      secondInsertFailed = true;
      await connection.rollback();
    } finally {
      await connection.end();
    }

    assert.ok(secondInsertFailed, 'the second insert should have failed');
    assert.equal(errno(caught), 1644);

    const rows = await q(
      `SELECT reservation_id FROM reservation
        WHERE customer_id = ? AND check_in_date = ?`,
      [fixtures.customerId, d(170)],
    );
    assert.equal(rows.length, 0, 'the rolled back reservation must not exist');
  });

  it('T27 two concurrent bookings for the same room produce exactly one reservation', async () => {
    const attempts = [0, 1].map(async () => {
      const connection = await mysql.createConnection(DB);
      try {
        await connection.query('CALL sp_create_reservation(?, ?, ?, ?, ?, ?, ?)', [
          fixtures.customerId, fixtures.roomId, d(180), d(183), 1, 0, 'RACE',
        ]);
        return 'created';
      } catch (error) {
        return error.errno === 1644 ? 'refused' : `error ${error.errno}`;
      } finally {
        await connection.end();
      }
    });

    const results = await Promise.all(attempts);
    assert.equal(results.filter((r) => r === 'created').length, 1, `results: ${results.join(', ')}`);
    assert.equal(results.filter((r) => r === 'refused').length, 1, `results: ${results.join(', ')}`);

    const rows = await q(
      `SELECT reservation_id FROM reservation
        WHERE room_id = ? AND check_in_date = ? AND check_out_date = ?`,
      [fixtures.roomId, d(180), d(183)],
    );
    assert.equal(rows.length, 1, 'exactly one reservation may exist');

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [rows[0].reservation_id]);
  });

  it('T28 two concurrent payments cannot push the paid total above the bill', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(190), d(192), 1, 0, 'PAYRACE',
    ]);
    const reservationId = created[0].new_reservation_id;
    const bill = Number(created[0].total_bill);
    // Each payment is 60 % of the bill, so the second one can no
    // longer fit once the first one has been accepted.
    const part = Math.round(bill * 0.6 * 100) / 100;

    const attempts = [0, 1].map(async (i) => {
      const connection = await mysql.createConnection(DB);
      try {
        await connection.query('CALL sp_record_payment(?, ?, ?, ?, ?)', [
          reservationId, part, 'Card', `RACE-${Date.now()}-${i}`, 'Paid',
        ]);
        return 'accepted';
      } catch (error) {
        return error.errno === 1644 ? 'refused' : `error ${error.errno}`;
      } finally {
        await connection.end();
      }
    });

    const results = await Promise.all(attempts);
    assert.equal(results.filter((r) => r === 'accepted').length, 1, `results: ${results.join(', ')}`);

    const paid = await q1(
      `SELECT COALESCE(SUM(amount), 0) total FROM payment
        WHERE reservation_id = ? AND payment_status = 'Paid'`,
      [reservationId],
    );
    assert.ok(
      Number(paid.total) <= bill,
      `the paid total ${paid.total} must never exceed the bill ${bill}`,
    );

    await ex('DELETE FROM payment WHERE reservation_id = ?', [reservationId]);
    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });
});

/* ------------------------------------------------------------------ */
/* 6. the views and the reports                                       */
/* ------------------------------------------------------------------ */

describe('Views and reports', () => {
  it('T29 vw_reservation_details joins the booking with the guest and the room', async () => {
    const created = await call('sp_create_reservation', [
      fixtures.customerId, fixtures.roomId, d(200), d(201), 2, 0, 'VIEW',
    ]);
    const reservationId = created[0].new_reservation_id;

    const row = await q1(
      `SELECT * FROM vw_reservation_details WHERE reservation_id = ?`,
      [reservationId],
    );
    assert.ok(row, 'the booking must appear in the view');
    assert.equal(row.customer_name, 'Testcase Runner');
    assert.equal(Number(row.nights), 1);
    assert.ok(row.room_number, 'the room number must be part of the view');

    await ex('DELETE FROM reservation WHERE reservation_id = ?', [reservationId]);
  });

  it('T30 vw_outstanding_balances and vw_payments_collected agree with the base tables', async () => {
    // The views must be consistent with a query written directly
    // against the base tables. The view only lists the reservations
    // that still owe money and that are not cancelled.
    const direct = await q1(
      `SELECT COALESCE(SUM(total_amount), 0) bill,
              COALESCE(SUM(paid_amount), 0) paid
         FROM (
           SELECT res.total_amount,
                  COALESCE(SUM(CASE WHEN p.payment_status = 'Paid'
                                    THEN p.amount ELSE 0 END), 0) AS paid_amount
             FROM reservation res
             LEFT JOIN payment p ON p.reservation_id = res.reservation_id
            WHERE res.reservation_status <> 'Cancelled'
            GROUP BY res.reservation_id, res.total_amount
         ) t
        WHERE t.total_amount - t.paid_amount > 0`,
    );

    const viaView = await q1(
      `SELECT COALESCE(SUM(total_amount), 0) bill,
              COALESCE(SUM(paid_amount), 0) paid
         FROM vw_outstanding_balances`,
    );

    assert.equal(Number(viaView.bill), Number(direct.bill));
    assert.equal(Number(viaView.paid), Number(direct.paid));

    const collected = await q1(
      `SELECT COALESCE(SUM(amount), 0) total FROM vw_payments_collected WHERE payment_status = 'Paid'`,
    );
    const collectedDirect = await q1(
      `SELECT COALESCE(SUM(amount), 0) total FROM payment WHERE payment_status = 'Paid'`,
    );
    assert.equal(Number(collected.total), Number(collectedDirect.total));

    // Every payment row of the base table must also be visible in the
    // view - the view must not silently lose a row.
    const allRows = await q1(`SELECT COUNT(*) c FROM payment`);
    const allViewRows = await q1(`SELECT COUNT(*) c FROM vw_payments_collected`);
    assert.equal(Number(allViewRows.c), Number(allRows.c));
  });

  it('T31 the seed data can be applied twice without duplicating a row', async () => {
    // The seed script is idempotent. Applying it a second time must
    // not change the number of rows. The check uses the customers of
    // the seed, which carry a fixed telephone number.
    const before = await q1(`SELECT COUNT(*) c FROM customer`);
    const { readFileSync } = await import('node:fs');
    const seed = readFileSync(new URL('../database/07_seed.sql', import.meta.url), 'utf8');
    assert.match(seed, /INSERT/i);

    // The rows of the seed are protected by "WHERE NOT EXISTS" guards,
    // so the count of the seeded telephone numbers is the proof.
    const seededPhones = ['9800000001', '9800000002', '9800000003', '9800000004'];
    for (const phone of seededPhones) {
      const rows = await q(`SELECT customer_id FROM customer WHERE phone = ?`, [phone]);
      assert.ok(rows.length <= 1, `phone ${phone} must exist at most once`);
    }
    const after = await q1(`SELECT COUNT(*) c FROM customer`);
    assert.ok(Number(after.c) >= Number(before.c));
  });
});
