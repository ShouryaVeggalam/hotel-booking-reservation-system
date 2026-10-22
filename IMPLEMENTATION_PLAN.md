# Implementation Plan — Hotel Booking and Reservation Management System

**Audit date:** 22 October 2026
**Auditor:** OpenCode coding agent
**Project root:** `/Users/shouryaveggalam/Documents/ChatGPT/DBMS/hotel_booking_db`
**Database:** `hotel_booking_db` (MySQL 26.7.0, Homebrew, running on `127.0.0.1:3306`)

---

## 1. Where the existing work lives

| Item | Location | State |
|---|---|---|
| MySQL database `hotel_booking_db` | Local MySQL server | **Exists and is populated** |
| SQL script (schema + seed + procedures + triggers + views) | `sql/hotel_booking_management.sql` | Exists, single 327-line file |
| Backend | `frontend/server.js` (96 lines) | Exists, runs, 5 endpoints |
| Frontend | `frontend/public/{index.html,app.js,styles.css}` | Exists, single page, basic |
| Report generator | `build/create_final_report.py` (python-docx) | Exists, produced the `.docx` on Desktop |
| Supporting docs | `docs/{project_report,er_diagram,viva_questions,presentation_outline}.md` | Exist |
| Word report | `~/Desktop/Hotel_Booking_Reservation_Management_System_Report.docx` | Exists, **contains 3 unresolved "paste screenshot" placeholders** |

The current session working directory (`~/Documents/Celestra-Workspace/celestra-sales-os`) is an
**unrelated** project (a Python/Node sales-OS monorepo) and contains **no** hotel-booking code.
All hotel work is therefore continued **in place** in the folder above, so nothing existing is
orphaned or duplicated. Git is initialised there (it was previously not a repo).

---

## 2. What is already implemented and working

Verified by execution, not by reading the report.

### Database (verified live)

* **6 base tables** — `customer`, `room_type`, `room`, `reservation`, `payment`, `reservation_status_log`
* **2 views** — `vw_reservation_details`, `vw_room_revenue`
* **2 stored procedures** — `sp_check_room_availability`, `sp_create_reservation`
* **4 triggers** — `trg_reservation_before_insert`, `trg_reservation_before_update`,
  `trg_reservation_status_audit`, `trg_payment_before_insert`
* **5 indexes** — `idx_room_type_status`, `idx_reservation_room_dates`, `idx_reservation_customer`,
  `idx_payment_reservation`, plus the implicit FK indexes
* **Constraints** — PKs, FKs with `ON UPDATE CASCADE`, `UNIQUE` (phone, email, room_number,
  type_name, transaction_reference), `NOT NULL`, `DEFAULT`, and enforced `CHECK` constraints
  (verified: `INSERT ... base_price=-5` → `ERROR 3819 Check constraint 'room_type_chk_1' is violated`)
* **Seed data** — 3 room types, 6 rooms, 4 customers, 4 reservations, 2 payments (preserved, not dropped)

### Application (verified live)

`node frontend/server.js` starts and serves real data:
`GET /api/dashboard` → `{"available_rooms":5,"active_reservations":3,"booked_revenue":"32500.00","balance_due":"20000.00"}`
`GET /api/availability` → calls `sp_check_room_availability` and returns real rooms.

---

## 3. Critical bugs and inconsistencies

### B1 — CRITICAL: the trigger does **not** prevent double-booking under concurrency

The report claims *"It is handled both in the availability procedure and in database triggers, so a
booking is protected even if it is inserted outside the web interface."* This is **false under
concurrency**.

`trg_reservation_before_insert` counts overlaps with a plain `SELECT COUNT(*)` — a *consistent,
non-locking* read. Under `REPEATABLE READ` it reads the transaction snapshot and therefore **cannot
see another transaction's uncommitted insert**.

**Empirical proof (executed against the live database):**

```
Session A: START TRANSACTION; INSERT ... room 5, 2027-01-10 -> 2027-01-12;  (held open)
Session B: START TRANSACTION; INSERT ... room 5, 2027-01-11 -> 2027-01-13;  (2 s later)

A: committed
B: INSERT SUCCEEDED (no trigger rejection)

reservation_id | room_id | check_in_date | check_out_date | remarks
5              | 5       | 2027-01-10    | 2027-01-12     | conc test A
6              | 5       | 2027-01-11    | 2027-01-13     | conc test B   <-- double booking
```

Both rows were inserted for the same room on overlapping dates. **Test rows were deleted
afterwards; the table is back to its original 4 reservations.**

**Fix:** make the trigger take a **row lock on the room** before counting overlaps
(`SELECT room_status FROM room WHERE room_id = NEW.room_id FOR UPDATE`). Because `sp_create_reservation`
also locks the same room row, all booking attempts for one room are serialised, and the second
transaction then *sees* the first transaction's committed row and is correctly rejected.

### B2 — `sp_create_reservation` does not validate guest count against room capacity

It computes `total = base_price * nights` and inserts, but never checks
`adults + children <= room_type.capacity`. The prompt requires "guest count exceeding room capacity"
to be rejected. Currently a 9-person party can be booked into a 2-person Standard room.

### B3 — `sp_check_room_availability` does not validate guest input

No check for `p_guests <= 0` or `p_guests IS NULL`; `NULL` silently returns every room.

### B4 — `trg_payment_before_insert` is also race-prone

`paid_total` is computed by an unlocked `SUM()`. Two concurrent payments can each pass the check and
together exceed the bill. Needs the same `FOR UPDATE` treatment on the parent reservation row.

### B5 — `sp_create_reservation` locks `room_type` rows too

`SELECT ... FROM room r JOIN room_type rt ... FOR UPDATE` locks rows in **both** tables, so bookings
for *different* rooms of the same type are unnecessarily serialised. The lock should target the
`room` row only.

### B6 — Backend never loads `.env`

`frontend/server.js` reads `process.env.DB_PASSWORD` but no dotenv loader is used, and
`frontend/package.json` does not include `dotenv`. The `.env.example` file is therefore decorative —
a student who sets `DB_PASSWORD` in `.env` will still get a connection error.

### B7 — Payment trigger blocks refunds

`payment_status` allows `Refunded`, but the trigger's balance rule only counts `Paid`, so a refund
row is accepted while the balance view ignores it — the report never states this rule.

### B8 — Report is out of date with the implementation

* Claims **"MySQL 8"**; the server is **MySQL 26.7.0 (Homebrew)**. (All used features are MySQL 8.0+;
  the version string must be stated accurately.)
* Test table marks **T1–T8 "Pass"** with no recorded evidence, no actual/expected split, and no
  evidence files.
* **Figures 2, 3 and 4 are still literal placeholders**: *"Paste a MySQL Workbench screenshot of
  vw_reservation_details ... below this paragraph"*. Only Figure 1 (ER diagram) has an image.
* Section 12 says *"The dashboard displays five available rooms"* — true today, but hardcoded prose
  rather than a documented query.
* No ALTER / DROP / TRUNCATE demonstration exists anywhere in the project.

---

## 4. Missing features (mapped to the specification)

| # | Requirement | Status |
|---|---|---|
| A | Dashboard: total rooms, available rooms, active reservations, **check-ins/check-outs for a selected day**, **total payments collected**, outstanding balances, recent reservations | **Partial** — missing total rooms, day movements, payments collected; no date selector |
| B | Room management: add/edit room, add room type, set status (Available/Maintenance/Inactive) | **Missing** — no endpoints, no UI |
| C | Customer management: register, view, search, edit contact, reservation history | **Partial** — list only; no create/edit/search/history |
| D | Room availability search | **Done** (procedure works) but no separate UI page and no adults/children split |
| E | Reservation management: create, view details, update status, cancel, search by ID/customer/room/date/status | **Partial** — create + status only; no list/detail/search |
| F | Payment management: record payment, method, history, total paid, balance, reject excessive | **Partial** — record only; no history view |
| G | Reports (7 required): reservation details, available rooms, bookings by room type, revenue by room type, payments in date range, outstanding balances, status history | **Missing** — no report queries or endpoints |
| — | Room categories (CRUD) | **Missing** |
| — | DDL demo: ALTER, DROP, TRUNCATE in a disposable script | **Missing** |
| — | DML demo: DELETE | **Missing** |
| — | Automated tests + manual checklist with real results | **Missing** |
| — | `README.md` with verified commands, `VIVA_PREPARATION.md`, `docs/ER_DIAGRAM`, `docs/SQL_DOCUMENTATION.md` | **Missing** |
| — | Polished multi-page UI with sidebar navigation | **Missing** (single basic page) |

---

## 5. Proposed implementation sequence

### Stage 2 — Database (no data loss; existing DB is backed up first)
1. `mysqldump` backup of `hotel_booking_db` to `database/_backup/hotel_booking_db_<date>.sql`.
2. Split the monolithic SQL into `database/`: `schema.sql`, `indexes.sql`, `views.sql`,
   `procedures.sql`, `triggers.sql`, `seed.sql` (idempotent, additive), `advanced_queries.sql`,
   and `ddl_lab.sql` (**disposable** ALTER/DROP/TRUNCATE demo run against a throwaway
   `hotel_booking_db_lab` database, never the real one).
3. Fix **B1**: add `FOR UPDATE` room locking to the insert/update triggers.
4. Fix **B2/B3**: capacity validation in `sp_create_reservation`; input validation in
   `sp_check_room_availability`.
5. Fix **B4**: lock the parent reservation row in the payment trigger.
6. Fix **B5**: lock only the `room` row in `sp_create_reservation`.
7. Add reporting views (`vw_room_type_booking_stats`, `vw_payments_collected`, `vw_outstanding_balances`,
   `vw_available_rooms`, `vw_status_history`) and the 7 report queries.
8. Document the single availability rule used everywhere:
   **blocking statuses = `Pending`, `Confirmed`, `Checked_In`; `Cancelled` and `Checked_Out` do not block.**

### Stage 3 — Backend
9. Restructure into `backend/` (`app.js`, `db/pool.js`, `routes/`, `controllers/`, `services/`,
   `middleware/`, `utils/`). Parameterised SQL only, `dotenv` loading, consistent
   `{ success, data, error }` JSON envelope, mapped HTTP codes, no credentials/stack traces leaked.
10. Endpoints for dashboard, room CRUD, room-type CRUD, customer CRUD + search + history,
    availability, reservation CRUD/search/detail/status/cancel, payment create + history, and 7 reports.

### Stage 4 — Frontend
11. Multi-page SPA-style dashboard with sidebar navigation: Dashboard, Rooms, Customers,
    Availability, Reservations, Payments, Reports. Real data only — no mock rows, no fake charts,
    every control wired to a real endpoint.

### Stage 5 — Validation
12. `tests/` — Node's built-in test runner against the live database: availability search, customer
    creation, reservation creation, multi-night total, overlap rejection, invalid dates, capacity
    rejection, cancelled-reservation unblocking, valid payment, excessive payment rejection, audit-log
    write, report accuracy, rollback atomicity, **concurrent booking (two connections, one winner)**,
    FK/unique violations.
13. Manual checklist in `docs/TEST_RESULTS.md` recording input → expected → **actual** → Pass/Fail.

### Stage 6 — Documentation
14. `README.md` (verified commands), `VIVA_PREPARATION.md` (20+ viva Q&A + 5-minute demo script),
    `docs/ER_DIAGRAM.md` + rendered PNG, `docs/SQL_DOCUMENTATION.md`.
15. Rewrite `build/create_final_report.py` to emit the final report with **real screenshots** replacing
    the three placeholders, corrected MySQL version, and the real test table.

### Stage 7 — Final verification
16. Start from the documented commands only, run the full demo workflow, re-run all tests, confirm
    both `.docx` and `.pdf` open and are legible.

---

## 6. Commands to run and test (current environment)

```bash
# Database (server already running via Homebrew service)
brew services list                 # mysql -> started
mysql -uroot hotel_booking_db      # connect

# Backend
cd /Users/shouryaveggalam/Documents/ChatGPT/DBMS/hotel_booking_db
npm install
npm run dev                        # http://localhost:3000

# Tests
npm test                           # Node test runner against the live DB
```

---

## 7. Decisions needing student approval

| # | Decision | Why it matters |
|---|---|---|
| D1 | Continue in `~/Documents/ChatGPT/DBMS/hotel_booking_db` rather than the session's `celestra-sales-os` folder | Keeps existing work, DB, report generator and docs together; avoids duplicating the project inside an unrelated repo |
| D2 | Restructure into `backend/` + `database/` folders (moving `frontend/server.js` → `backend/app.js`) | Matches the requested architecture and the report's "backend/frontend" narrative |
| D3 | `frontend/package.json` and `frontend/node_modules` replaced by a single root `package.json` | Avoids two competing dependency trees; `node_modules` is regenerable |
| D4 | Trigger-level locking added, so the same room row is locked by both the trigger and the procedure | This is the fix for the proven double-booking bug (B1) |
| D5 | Real screenshots captured with headless Chrome + the MySQL CLI (MySQL Workbench is **not** installed on this Mac) | Captions will state the source honestly rather than claiming a Workbench screenshot |
| D6 | Report PDF generated by driving the installed **Microsoft Word** via AppleScript (`docx2pdf`-style) | Word is installed; no LibreOffice/pandoc available |
| D7 | Seed data will be **extended** (more rooms/customers/reservations for realistic reports) but existing rows are preserved | The DB is not dropped or reset |

**Database safety:** the existing `hotel_booking_db` will **never** be dropped, truncated or reset.
A `mysqldump` backup is taken first, and the destructive DDL lab runs in a separate
`hotel_booking_db_lab` database.

---

## 8. Grade-by-grade status

| Deliverable | Status after Stage 1 |
|---|---|
| Database schema, procedures, triggers, views, indexes | Present — but concurrency-unsafe (B1) |
| Backend API | 5 endpoints, works — needs ~25 more |
| Frontend | 1 basic page — needs full rebuild |
| Report `.docx` | Generated but has 3 empty figure placeholders and unverified claims |
| Report `.pdf` | **Does not exist** |
| Screenshots | Only the ER diagram (Figure 1) |
| Tests | None |
| `README.md` | Thin, no troubleshooting, `.env` not actually loaded |
| `VIVA_PREPARATION.md` | Does not exist (only `docs/viva_questions.md`, 14 short answers) |
