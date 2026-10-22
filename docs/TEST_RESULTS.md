# Test Results — Hotel Booking and Reservation Management System

**Project:** Staywise — Hotel Booking and Reservation Management System
**Test suite:** `tests/db.test.js` (Node.js built-in test runner)
**Command:** `npm test`
**Date of the run:** 22 October 2026
**Database under test:** MySQL 26.7.0 (Homebrew), schema `hotel_booking_db`
**Result:** **32 tests — 32 passed, 0 failed, 0 skipped** (118 ms)

---

## 1. What the suite proves

The suite is a black box test against the **real MySQL server**. It does not
mock the database and it does not test the JavaScript in isolation. Every
assertion asks the question *"does the database itself enforce this rule?"*,
because that is what separates a database design from a form validation.

The suite also proves the three properties that are hardest to show and
easiest to claim: **transactions**, **concurrency** and **report accuracy**.

### Self-cleaning

Every test creates its own customer and its own rooms, and removes them
again in the `after` hook. The row counts before and after a run are
identical:

| Table | Before the run | After the run |
|---|---|---|
| `customer` | 4 | 4 |
| `room` | 6 | 6 |
| `reservation` | 4 | 4 |
| `payment` | 4 | 4 |
| `reservation_status_log` | 0 | 0 |

The demonstration data is never touched.

---

## 2. The complete test list

### 2.1 Schema objects

| # | Test | What it checks | Result |
|---|---|---|---|
| T01 | The six tables, five foreign keys, seven views, three procedures and five triggers exist | The whole object inventory of the project, counted in `information_schema` | ✅ PASS |
| T02 | The secondary indexes exist (15 in total) | `idx_reservation_room_dates`, `idx_payment_reservation`, `idx_customer_name` plus the four index-backed unique keys `email`, `phone`, `room_number`, `transaction_reference` | ✅ PASS |

### 2.2 Constraints

| # | Test | What it checks | Result |
|---|---|---|---|
| T03 | A room type with a price of zero is refused | `CHECK (base_price > 0)` → MySQL error **3819**, message names `room_type_chk_1` | ✅ PASS |
| T04 | A room type with a capacity of zero is refused | `CHECK (capacity > 0)` → error **3819**, `room_type_chk_2` | ✅ PASS |
| T05 | A reservation whose check-out is not after the check-in is refused | The BEFORE INSERT trigger rejects it with **1644** | ✅ PASS |
| T05b | A payment with an amount of zero is refused | `CHECK (amount > 0)` → error **3819**, `payment_chk_1` — no trigger in the way, so the constraint itself is proved | ✅ PASS |
| T06 | A second customer with the same phone number is refused | `UNIQUE(phone)` → error **1062** | ✅ PASS |
| T07 | A second customer with the same e-mail address is refused | `UNIQUE(email)` → error **1062** | ✅ PASS |
| T08 | A reservation for a customer that does not exist is refused | `fk_reservation_customer` → error **1452** | ✅ PASS |
| T09 | A reservation for a room that does not exist is refused | The trigger reports it first (**1644**, *"room does not exist"*) | ✅ PASS |
| T10 | A customer with a reservation cannot be deleted | `ON DELETE RESTRICT` → error **1451**, `fk_reservation_customer` | ✅ PASS |

### 2.3 Stored procedures

| # | Test | What it checks | Result |
|---|---|---|---|
| T11 | `sp_check_room_availability` returns only the free rooms | A booked room disappears from the result, a free room stays, and the booked room comes back for a range that does not overlap | ✅ PASS |
| T12 | `sp_create_reservation` calculates the bill correctly | 3 nights × base price = `total_amount`, status `Confirmed` | ✅ PASS |
| T13 | `sp_create_reservation` refuses an overlapping booking | Error **1644**, *"Room is already reserved for part of these dates."* | ✅ PASS |
| T14 | `sp_create_reservation` refuses a room under maintenance | Error **1644**, *"not available"* | ✅ PASS |
| T15 | `sp_create_reservation` refuses an oversized party | Error **1644**, *"capacity"* | ✅ PASS |
| T16 | `sp_create_reservation` refuses a check-out that is not after the check-in | Error **1644**, *"Check-out date must be after check-in date."* | ✅ PASS |
| T17 | `sp_record_payment` stores the payment and reports the balance | `bill_amount`, `paid_amount` and `balance_due` are correct, the row is written | ✅ PASS |
| T18 | `sp_record_payment` refuses a payment above the balance | Error **1644**, *"greater than the remaining"* — and **no** payment row is written | ✅ PASS |
| T19 | Only a payment with the status `Paid` reduces the balance | A `Pending` payment is stored but the balance stays at the full bill, in the view and in the procedure result | ✅ PASS |

### 2.4 Triggers

| # | Test | What it checks | Result |
|---|---|---|---|
| T20 | `trg_reservation_before_insert` blocks an overlap even for a raw `INSERT` | The protection does not depend on the application using the procedure — error **1644** | ✅ PASS |
| T21 | `trg_reservation_before_insert` blocks a booking of a room in maintenance | Error **1644** | ✅ PASS |
| T22 | `trg_reservation_before_update` refuses to reactivate a cancelled reservation | Error **1644**, *"cannot be reactivated"* | ✅ PASS |
| T23 | `trg_reservation_before_update` refuses to re-date a completed stay | Error **1644**, *"completed stay cannot be re-dated"* | ✅ PASS |
| T24 | `trg_reservation_status_audit` writes one audit row per status change | 3 rows after create → `Checked_In` → `Checked_Out`, with the correct old and new status | ✅ PASS |
| T25 | `trg_payment_before_insert` refuses a payment above the bill | Error **1644**, *"greater than the remaining bill amount"* | ✅ PASS |

### 2.5 Transactions and concurrency

| # | Test | What it checks | Result |
|---|---|---|---|
| T26 | A failing statement inside a transaction leaves no partial row behind | The first `INSERT` of the transaction is gone after the rollback | ✅ PASS |
| T27 | Two concurrent bookings for the same room produce exactly one reservation | Two independent connections call `sp_create_reservation` at the same time: **1 created, 1 refused** | ✅ PASS |
| T28 | Two concurrent payments cannot push the paid total above the bill | Two connections each try to pay 60 % of the bill: **1 accepted, 1 refused**, the paid total never exceeds the bill | ✅ PASS |

### 2.6 Views and reports

| # | Test | What it checks | Result |
|---|---|---|---|
| T29 | `vw_reservation_details` joins booking, guest and room | The guest name, the number of nights and the room number are correct | ✅ PASS |
| T30 | `vw_outstanding_balances` and `vw_payments_collected` agree with the base tables | The bill and the paid sum written directly against the tables are **identical** to the sums of the views; the view also loses no payment row | ✅ PASS |
| T31 | The seed data is idempotent | The four seeded telephone numbers exist at most once, so re-running the seed changes nothing | ✅ PASS |

---

## 3. The two concurrency tests in detail

These are the tests that prove the design is safe under real use, and they are
the ones worth showing to an examiner.

### T27 — two bookings for the same room at the same time

```
connection A                         connection B
-------------                        -------------
CALL sp_create_reservation(...)      CALL sp_create_reservation(...)
  SELECT room ... FOR UPDATE  ──┐      SELECT room ... FOR UPDATE
  (owns the lock)              │        (waits for A)
  overlap check: 0 rows        │        ...
  INSERT reservation            │        (A commits)
  COMMIT ──────────────────────┴──>    (B gets the lock)
                                        overlap check: 1 row
                                        SIGNAL 45000 -> refused
```

**Result: exactly one reservation exists afterwards.** The lock is taken on the
`room` row, not on the `reservation` table, because a locking read on a table
from inside a trigger on that same table is rejected by MySQL (error 1442).

### T28 — two payments for the same booking at the same time

```
connection A                         connection B
-------------                        -------------
CALL sp_record_payment(60 %)        CALL sp_record_payment(60 %)
  SELECT reservation ... FOR UPDATE ┐   SELECT reservation ... FOR UPDATE
  (owns the lock)                   │     (waits for A)
  paid = 0  -> ok                   │     ...
  INSERT payment                    │     (A commits)
  COMMIT ───────────────────────────┴──>  paid = 60 % -> 60 % + 60 % > 100 %
                                          SIGNAL 45000 -> refused
```

**Result: the paid total never exceeds the bill.**

---

## 4. Bugs the suite found while it was written

Writing the tests was not only a documentation exercise — four real defects
in the test expectations surfaced genuine behaviour of the system that the
documentation now describes correctly.

| # | Finding | Resolution |
|---|---|---|
| 1 | A reservation with an invalid date range reports error **1644** (the trigger) and not **3819** (the `CHECK` constraint). | The trigger runs first. The documentation now says the trigger is the first line of defence and the `CHECK` constraint is the second. T05b was added to prove a `CHECK` constraint without a trigger in the way. |
| 2 | A reservation for a non-existent room reports **1644** and not **1452**. | Same reason — the trigger reads the room row first. T08 remains the proof of the foreign key, because no trigger stands between the statement and the key there. |
| 3 | The first version of T28 paid 50 % + 50 % of the bill, and **both** payments were correctly accepted. | The test was wrong, not the code: two halves fit exactly under the cap. The test now pays 60 % each, which forces the race. |
| 4 | `information_schema` returns its column names in upper case, so `index_name` was `undefined` and the index test failed even though the indexes were there. | The test now uses a dedicated helper that normalises the keys and reads the information_schema with `query` instead of `execute`. |

---

## 5. How to reproduce the run

```bash
cd /Users/shouryaveggalam/Documents/ChatGPT/DBMS/hotel_booking_db

# 1. make sure MySQL is running and the schema is installed
npm run db:install

# 2. run the suite
npm test
```

The expected ending of the output is:

```
# tests 32
# suites 6
# pass 32
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 118
```

The suite is read/write against the development database. It creates and
removes its own rows, so it is safe to run at any time — but it does write to
the database, so it must **not** be pointed at the demonstration database on
Aiven while a demonstration is running.

---

## 6. The deployment verification

The database suite proves the rules of the database. The deployment suite
proves that the **deployed** system behaves the same way. It is a separate
script, `scripts/verify_deployment.mjs`, and it only uses the HTTP API, so it
runs against the local server and against the public Render deployment in
exactly the same way.

```bash
node scripts/verify_deployment.mjs http://localhost:3000
node scripts/verify_deployment.mjs https://<render-host>
```

It checks the eleven workflows of the deployment checklist — health, dashboard,
inventory, availability, create a reservation, persistence after a fresh read,
payment and balance, the refused double booking, the audit log, the refused
oversized payment and the clean-up — and removes its own test rows afterwards.

Against the local server the result on 22 October 2026 was
**19 checks, 19 passed, 0 failed**.
