# Deployment Plan — Hotel Booking and Reservation Management System

**Project:** Staywise — Hotel Booking and Reservation Management System
**Targets:** Vercel (frontend) · Render (backend) · Aiven for MySQL 8 (database) · GitHub (source)
**Plan written:** 22 October 2026
**Status of this document:** the audit is complete, the code is deployment ready,
the frontend is live, and the two steps that need an account authorisation are
listed in section 8.

---

## 1. The stack that is actually in the repository

The stack was determined by reading the repository, not assumed.

| Layer | Technology | Evidence |
|---|---|---|
| Database | **MySQL 8.0+** | `database/01_schema.sql`, `utf8mb4_0900_ai_ci`, CHECK constraints, `SIGNAL SQLSTATE '45000'` |
| DB objects | 6 tables · 7 views · 3 procedures · 5 triggers · 15 secondary indexes | `database/01`–`06` |
| Backend | **Node.js 22 + Express 5** | `backend/server.js`, `backend/app.js`, `package.json` |
| DB driver | **mysql2 3.x** with a connection pool | `backend/db/pool.js` |
| Frontend | **Plain HTML + CSS + vanilla JS (ES modules)** — no framework, no bundler, no build step | `frontend/public/*.html`, `frontend/public/js/*.js` (ES `import`/`export`) |
| Frontend styling | Hand written design system, one stylesheet | `frontend/public/css/theme.css` |
| Package manager | **npm** (single root `package.json`, `package-lock.json`) | `package.json` |
| Source control | Git | `.git/`, branch `main` |

### Entry points

| Purpose | Path |
|---|---|
| Backend entry point | `backend/server.js` → `backend/app.js` |
| Backend start command (production) | `node backend/server.js` |
| Frontend entry point (local) | `backend/app.js` serves `frontend/public` with `express.static` |
| Frontend entry point (production) | `frontend/public/index.html`, served by Vercel's CDN |
| Database entry point | `database/run_all.sh` (local) / `database/deploy/apply_remote.sh` (Aiven) |

### How the frontend talks to the backend

`frontend/public/js/api.js` is the only file that performs network calls.

```js
import './config.js';
const BASE = window.STAYWISE_API_BASE || '/api';
```

Originally the base URL was hard coded to the relative string `'/api'`.
Because the backend serves the static files as well, the same relative URL
works locally. For a split deployment (Vercel frontend + Render backend) the
base has to become the public address of the Render API, so the value was moved
into `frontend/public/js/config.js` — a single file that every page loads.

Because the frontend has **no build step**, the usual `import.meta.env` /
`process.env` mechanism does not exist. The two supported ways of pointing the
frontend at the API are therefore:

1. **Same origin** — `window.STAYWISE_API_BASE = '/api'` and the `vercel.json`
   rewrite forwards `/api/*` to the Render API. No CORS involved.
2. **Direct** — `window.STAYWISE_API_BASE = 'https://<render-host>/api'`.
   The browser calls Render directly and the backend CORS policy decides
   whether the browser origin is allowed.

Both are implemented. The default is the same-origin mode.

---

## 2. Where the database objects live

| Object | File | Notes |
|---|---|---|
| Tables, keys, CHECK constraints | `database/01_schema.sql` | `CREATE TABLE IF NOT EXISTS` |
| `ALTER TABLE` demonstrations | `database/02_migrations.sql` | every ALTER is guarded by an `information_schema` check |
| Indexes (15 secondary) | `database/03_indexes.sql` | includes the indexes MySQL creates for the foreign keys |
| Views (7) | `database/04_views.sql` | `vw_reservation_details`, `vw_room_revenue`, `vw_room_type_booking_stats`, `vw_payments_collected`, `vw_outstanding_balances`, `vw_available_rooms_today`, `vw_status_history` |
| Procedures (3) | `database/05_procedures.sql` | `sp_check_room_availability`, `sp_create_reservation`, `sp_record_payment` |
| Triggers (5) | `database/06_triggers.sql` | overlap prevention, validation, status audit, payment cap |
| Seed data | `database/07_seed.sql` | idempotent, fictional records only |
| Report queries | `database/08_reports.sql` | read only |
| DDL lab (ALTER/DROP/TRUNCATE) | `database/09_ddl_lab.sql` | runs in the throwaway schema `hotel_booking_db_lab`, never in production |
| Remote deployment | `database/deploy/apply_remote.sh` | strips `CREATE DATABASE`/`USE` and applies everything over TLS |
| Remote verification | `database/deploy/verify_remote.sh` | prints PASS/FAIL per object and per business rule |
| Restricted DB user | `database/deploy/create_app_user.sh` | grants only what the API needs |

There is **no migration framework**. The SQL files are the migrations, and each
one is written so that running it twice changes nothing.

> `sql/hotel_booking_management.sql` is the original single file version of the
> schema. It starts with `DROP DATABASE IF EXISTS`. It is kept for the project
> history only and carries a warning banner at the top. **It must never be run
> against the deployed database.**

---

## 3. Environment variables and credentials

| Variable | Where it is set | Secret? | Purpose |
|---|---|---|---|
| `PORT` | Render (automatic) / `.env` | no | HTTP port. The server binds `process.env.PORT`. |
| `NODE_ENV` | Render / `.env` | no | `production` on Render. |
| `DB_HOST` | Render env var | no | Aiven host name, e.g. `mysql-project-xxxx.aivencloud.com`. |
| `DB_PORT` | Render env var | no | `3306`. |
| `DB_NAME` | Render env var | no | The database name Aiven created (often `dbname`). |
| `DB_USER` | Render env var | **yes** | The *restricted* application user, not `avnadmin`. |
| `DB_PASSWORD` | Render env var | **yes** | Password of that user. |
| `DB_CONNECTION_LIMIT` | Render env var | no | Pool size. Set to 5 on the free tier so the pool fits inside Aiven's free limits. |
| `DB_SSL` | Render env var | no | `true` on Aiven. |
| `DB_SSL_REJECT_UNAUTHORIZED` | Render env var | no | `true` — the certificate is verified. |
| `DB_SSL_CA` | Render env var | **yes** | The Aiven `ca.crt`, either as a file path or as PEM text with `\n`. |
| `CORS_ORIGIN` | Render env var | no | Comma separated allow list, e.g. `https://staywise-dbms.vercel.app`. |

Nothing secret is stored in the repository. `.env` is listed in `.gitignore`,
and the only credential-like file in the repository is `.env.example`, which
contains empty placeholders.

---

## 4. Deployment blockers that were found and fixed

| # | Blocker | Fix |
|---|---|---|
| B1 | The API base URL was hard coded to the relative `'/api'`, which cannot reach a backend on another host. | Moved to `frontend/public/js/config.js`; `api.js` imports it. Two supported modes. |
| B2 | No CORS policy at all. A browser on the Vercel origin would have been blocked by the browser itself. | `cors` middleware in `backend/app.js` with an allow list driven by `CORS_ORIGIN`. |
| B3 | The MySQL connection could not use TLS, so it could not talk to Aiven. | `DB_SSL`, `DB_SSL_CA`, `DB_SSL_REJECT_UNAUTHORIZED` in `backend/config.js`; the pool passes `ssl` to mysql2. |
| B4 | The health endpoint only reported a version string. Render needs a health check that really touches the database. | `GET /api/health` now performs a live `SELECT` and reports the MySQL version, the schema and the server time. |
| B5 | No `vercel.json` — the static site had no security headers and no API route. | `frontend/public/vercel.json` with the rewrite, the headers and `cleanUrls`. |
| B6 | No `render.yaml` — the service had to be configured by hand in the dashboard. | `render.yaml` blueprint with the build command, the start command, the health check path and every environment variable. |
| B7 | The API had no `DELETE` endpoints for customers, reservations and payments, so the API was not a full CRUD and the test data could not be cleaned up automatically. | `DELETE /api/customers/:id`, `DELETE /api/reservations/:id`, `DELETE /api/payments/:id`, each with a business rule guard. |
| B8 | The scripts `database/run_all.sh` and `database/backup.sh` were referenced by `package.json` but did not exist. | Both created and tested. |
| B9 | The Vercel project was created with the wrong Root Directory and with the team's SSO deployment protection switched on, so the site answered `404` for every anonymous visitor. | Root Directory set to `frontend/public`, `ssoProtection` set to `null` on the project. |

---

## 5. The database on Aiven

Aiven does not let a client create a database, so the schema has to be applied
to the database Aiven prepared. `database/deploy/apply_remote.sh` does exactly
that:

* it removes the two statements a managed host refuses (`CREATE DATABASE` and
  `USE <database>`), and selects the database with `--database` instead;
* it applies the seven files in the order the database needs them;
* it never drops, truncates or resets anything — every statement is idempotent,
  so re-running it is safe;
* it uses a temporary option file with mode `600`, so the password never
  appears in the process list.

### The restricted application user

`database/deploy/create_app_user.sh` creates `staywise_app` with exactly:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON `<db>`.* TO 'staywise_app'@'%';
GRANT EXECUTE                       ON `<db>`.* TO 'staywise_app'@'%';
```

No `CREATE`, no `DROP`, no `ALTER`, no `SUPER`. The script proves the
restriction by connecting as that user and showing that a `DROP TABLE` is
refused. The administrative account `avnadmin` is only used for the one time
setup.

### MySQL 8 compatibility

The schema was developed on MySQL 26.7.0. Every construct used is available in
MySQL 8.0.16 or later: `utf8mb4_0900_ai_ci`, enforced `CHECK` constraints,
`CREATE OR REPLACE VIEW`, `SIGNAL SQLSTATE '45000'`, prepared statements and
window-free aggregate queries. No `DEFINER` clause is used in any procedure or
trigger, so the objects work on a host where the administrator is not a real
superuser.

---

## 6. The deployment, step by step

### 6.1 GitHub (done)

Repository: **https://github.com/ShouryaVeggalam/hotel-booking-reservation-system**
Branch `main`. The repository contains the source, the SQL, the deployment
scripts and the documentation. No `.env`, no database dump, no secret.

### 6.2 Aiven (needs one authorisation)

1. Sign in at <https://aiven.io> and open **Aiven for MySQL 8**.
2. Create a service on the **free "Service Type" plan** (1 vCPU, 1 GB RAM,
   5 GB storage). The free plan needs a payment method on the account; if the
   account refuses it, the alternatives are listed in section 8.
3. Open **Service → Connection** and note **General**:
   `Host`, `Port` (usually `3306`), `Database` (usually `dbname`),
   `User` (`avnadmin`), `Password`, and download **`ca.crt`**.
4. Apply the schema from a terminal:

   ```bash
   export DB_HOST='mysql-project-xxxx.aivencloud.com'
   export DB_PORT=3306
   export DB_NAME='dbname'
   export DB_USER='avnadmin'
   export DB_PASSWORD='<the password from the connection page>'
   export DB_SSL=true
   export DB_SSL_CA="$HOME/Downloads/ca.crt"

   bash database/deploy/apply_remote.sh \
     SEED_FILE=database/deploy/08_demo_data.sql
   bash database/deploy/verify_remote.sh
   ```

   `verify_remote.sh` prints a PASS/FAIL line for every table, foreign key,
   view, procedure, trigger and index, and then proves that a double booking
   is refused and that its own test rows are removed again.
5. Create the restricted user:

   ```bash
   export APP_DB_USER='staywise_app'
   export APP_DB_PASSWORD='<a strong password>'
   bash database/deploy/create_app_user.sh
   ```

   Remember `staywise_app` and its password — they go into Render.

### 6.3 Render (needs one authorisation)

1. Sign in at <https://render.com>.
2. **New → Blueprint** → point it at
   `https://github.com/ShouryaVeggalam/hotel-booking-reservation-system`.
   Render reads `render.yaml` and creates the web service
   `staywise-api` with the correct build command, start command and health
   check path.
3. Render asks for the values of the environment variables marked
   `sync: false`. Fill them in with the Aiven values:

   | Variable | Value |
   |---|---|
   | `DB_HOST` | the Aiven host name |
   | `DB_NAME` | the Aiven database name |
   | `DB_USER` | `staywise_app` |
   | `DB_PASSWORD` | the password of `staywise_app` |
   | `DB_SSL_CA` | the contents of `ca.crt` as **one line**, with the line breaks written as `\n` |
   | `CORS_ORIGIN` | `https://staywise-dbms.vercel.app` |

4. Wait for the build to finish and check **Logs** for
   `Server listening on port <port>`.
5. The API is then at `https://staywise-api.onrender.com`
   (or the name Render gives the service) and the health check at
   `https://staywise-api.onrender.com/api/health`.

### 6.4 Vercel (done)

The frontend is deployed and public:

* **https://staywise-dbms.vercel.app**

Project `staywise-dbms`, Root Directory `frontend/public`, Framework preset
"Other" (static, no build step), connected to the GitHub repository so that
every push to `main` redeploys automatically.

Two changes are needed once the Render URL is known — both are one line:

* `frontend/public/js/config.js` → `window.STAYWISE_API_BASE = 'https://<render-host>/api';`
* `frontend/public/vercel.json` → the `destination` of the `/api/:path*` rewrite

Both are needed if the frontend calls the API directly (mode 2) **and** the
same-origin fallback (mode 1) is kept as a safety net.

---

## 7. What is verified, and how

`scripts/verify_deployment.mjs` is a black box script that only uses the HTTP
API. It runs the same eleven workflows against the local server and against the
deployed server:

1. the health endpoint answers and really reaches MySQL;
2. the dashboard returns the summary metrics;
3. the room inventory is served;
4. the availability search answers;
5. a reservation is created for a fictional guest;
6. the reservation is still there after a fresh read (persistence);
7. a payment is recorded and the remaining balance is `total − payment`;
8. an overlapping reservation is refused with **409** by the database;
9. a status change is written to the audit log and shows up in the report;
10. a payment above the balance is refused with **409**;
11. every row the script created is removed again.

The script removes its own test data, so the database is exactly as it was
before the run.

```bash
node scripts/verify_deployment.mjs http://localhost:3000
node scripts/verify_deployment.mjs https://staywise-dbms.vercel.app
```

Result against the local server on 22 October 2026: **19 checks, 19 passed,
0 failed**, and the row counts before and after the run are identical.

---

## 8. What still needs the account owner

Two resources cannot be created without an authorisation that is only held by
the account owner. Everything around them is prepared and tested.

| # | Resource | What is needed | What is already done |
|---|---|---|---|
| 1 | **Render web service** | Sign in at render.com and apply the blueprint (or provide a Render API key so it can be created from the command line). | `render.yaml`, the health check, the production error handling and the CORS policy are ready. |
| 2 | **Aiven MySQL 8 service** | Sign in at aiven.io and create the free MySQL service (or provide an Aiven API token so it can be created from the command line). | `apply_remote.sh`, `verify_remote.sh`, `create_app_user.sh` and the demonstration seed are ready and tested against a local MySQL. |

### If Aiven is not available on the account

Aiven's free "Service Type" plan requires a payment method on the account.
If the account cannot add one, the compatible alternatives are, in this order:

1. **Aiven free plan with a different region** — the plan itself is free, the
   region is a preference, not a cost.
2. **Aiven for PostgreSQL** — would require rewriting the 6 tables, the 5
   triggers and the 3 procedures for PostgreSQL. That is a port, not a
   configuration change, and it is not recommended for this project.
3. **Railway / PlanetScale MySQL** — a managed MySQL with a similar TLS
   setup. The scripts need a small change (the CA certificate and the
   `mysql` client flags), the code does not change at all.

The application code is **not** tied to Aiven: it only needs a MySQL 8 server
that accepts TLS. The `DB_*` environment variables cover every provider.

---

## 9. Known limitations of the free tier

| Limitation | Effect | Mitigation |
|---|---|---|
| Render free web services sleep after 15 minutes of inactivity | The first request after a pause takes 30–60 seconds | Open `https://<render-host>/api/health` one minute before the demonstration. A paid Starter instance ($7/month) removes the sleep completely. |
| Aiven free plan sleeps the MySQL service after a while | Same as above | The health endpoint wakes it. |
| Aiven free plan caps the number of connections | The pool is limited to 5 connections | `DB_CONNECTION_LIMIT=5` |
| Vercel Hobby deployment protection | Anonymous visitors get `404` | Switched off for this project (`ssoProtection: null`). |
| No authentication in the application | Anyone who knows the URL can create and change bookings | The deployment is an academic demonstration on fictional data only. It is not suitable for a real hotel. |

---

## 10. How to undo the deployment

| What | How |
|---|---|
| Vercel | `vercel project rm staywise-dbms` or delete the project in the dashboard. The alias disappears with it. |
| Render | Delete the web service in the dashboard. Nothing else is stored there except the environment variables. |
| Aiven | Delete the MySQL service in the dashboard. **This destroys the database and every row in it** — take a backup first with `bash database/backup.sh` against the remote host. |
| GitHub | The repository can simply be made private again. |
