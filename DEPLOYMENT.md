# DEPLOYMENT.md — Staywise Hotel Booking and Reservation Management System

**Last updated:** 22 October 2026
**Purpose:** the operational runbook for the public demonstration.

> **Status summary**
> ✅ GitHub repository — live
> ✅ Vercel frontend — live and public
> ⏳ Render backend — prepared, waiting for the account authorisation
> ⏳ Aiven MySQL 8 — prepared, waiting for the account authorisation
>
> The two steps that need the account owner are written out in section 3 and
> section 4. Everything else is done and verified.

---

## 1. The public URLs

| What | URL | State |
|---|---|---|
| **Frontend (share this with faculty)** | **https://staywise-dbms.vercel.app** | ✅ live, HTTP 200, public |
| Frontend (team scoped alias) | https://staywise-dbms-shouryaveggalams-projects.vercel.app | ✅ live |
| Backend API | `https://<render-service>.onrender.com/api` | ⏳ pending Render |
| **Backend health check** | `https://<render-service>.onrender.com/api/health` | ⏳ pending Render |
| API documentation | `https://<render-service>.onrender.com/api` | ⏳ pending Render |
| Source code | https://github.com/ShouryaVeggalam/hotel-booking-reservation-system | ✅ live |

The pages of the frontend:

| Page | URL |
|---|---|
| Dashboard | https://staywise-dbms.vercel.app/ |
| Rooms | https://staywise-dbms.vercel.app/rooms |
| Customers | https://staywise-dbms.vercel.app/customers |
| Availability | https://staywise-dbms.vercel.app/availability |
| Reservations | https://staywise-dbms.vercel.app/reservations |
| Payments | https://staywise-dbms.vercel.app/payments |
| Reports | https://staywise-dbms.vercel.app/reports |

---

## 2. Database provider and connection configuration (no secrets)

| Item | Value |
|---|---|
| Provider | **Aiven for MySQL 8** (free "Service Type" plan) |
| Endpoint | `mysql-project-<id>.aivencloud.com` (given on the Aiven connection page) |
| Port | `3306` |
| Database name | given on the Aiven connection page (usually `dbname`) |
| Administrative user | `avnadmin` — used **only** for the one time schema setup |
| Application user | `staywise_app` — restricted, this is what Render uses |
| TLS | required, `ca.crt` from Aiven, certificate verification **on** |
| Application privileges | `SELECT, INSERT, UPDATE, DELETE` on the schema + `EXECUTE` on the procedures. No `CREATE`, `DROP`, `ALTER`, `SUPER`. |

The database is **not** exposed to the internet: Aiven only accepts connections
from the network access list, and the application connects over TLS as the
restricted user.

---

## 3. Environment variables and where to set them

| Variable | Where | Value / example | Secret |
|---|---|---|---|
| `PORT` | Render (set automatically) | — | no |
| `NODE_ENV` | Render | `production` | no |
| `DB_HOST` | Render → Environment | `mysql-project-xxxx.aivencloud.com` | no |
| `DB_PORT` | Render → Environment | `3306` | no |
| `DB_NAME` | Render → Environment | `dbname` | no |
| `DB_USER` | Render → Environment | `staywise_app` | **yes** |
| `DB_PASSWORD` | Render → Environment | the password you chose for `staywise_app` | **yes** |
| `DB_CONNECTION_LIMIT` | Render → Environment | `5` | no |
| `DB_SSL` | Render → Environment | `true` | no |
| `DB_SSL_REJECT_UNAUTHORIZED` | Render → Environment | `true` | no |
| `DB_SSL_CA` | Render → Environment | the contents of `ca.crt` as **one line**, line breaks written as `\n` | **yes** |
| `CORS_ORIGIN` | Render → Environment | `https://staywise-dbms.vercel.app` | no |

Locally the same variables live in `.env` (created from `.env.example`).
`.env` is in `.gitignore` and is **never** committed.

---

## 4. How to deploy an update

The repository is connected to both Vercel and Render, so a push to `main`
redeploys automatically.

```bash
cd /Users/shouryaveggalam/Documents/ChatGPT/DBMS/hotel_booking_db
git add -A
git commit -m "describe the change"
git push origin main
```

* **Vercel** rebuilds the static site (a few seconds). Watch it in
  <https://vercel.com/shouryaveggalams-projects/staywise-dbms/deployments>.
* **Render** rebuilds the API. Watch it in the dashboard under the service →
  **Events**. The build command is `npm ci --omit=dev`, the start command is
  `node backend/server.js`, the health check path is `/api/health`.

If the frontend has to point at a different API host, only
`frontend/public/js/config.js` changes:

```js
window.STAYWISE_API_BASE = 'https://<render-service>.onrender.com/api';
```

---

## 5. How to inspect the logs

| What | Where |
|---|---|
| Backend logs | Render → the service → **Logs** (live) or **Logs → Historical** |
| Frontend logs | Vercel → the project → **Deployments** → the deployment → **Function Logs** / **Build Logs** |
| Aiven database logs | Aiven → the service → **Logs** |
| Local backend log | the terminal that started `npm start` |

The backend prints one line per request:

```
GET /api/dashboard -> 200 (4.2 ms)
```

---

## 6. How to verify the live system

### Automatic

```bash
node scripts/verify_deployment.mjs https://staywise-dbms.vercel.app
```

The script walks through the eleven workflows of the checklist (health,
dashboard, inventory, availability, create, persistence, payment and balance,
double booking refused, status audit log, oversized payment refused, clean up)
and prints a PASS/FAIL line for each. It removes its own test data, so the
database is unchanged afterwards.

Against the local server the result on 22 October 2026 was
**19 checks, 19 passed, 0 failed**.

### Manual

1. Open https://staywise-dbms.vercel.app — the dashboard must show real numbers.
2. **Rooms** → the inventory of the rooms.
3. **Availability** → pick two future dates → the list of free rooms.
4. **Reservations** → *New reservation* → choose the guest and the room → save.
5. Reload the page → the new reservation is still there.
6. **Payments** → record a payment for it → the balance drops by that amount.
7. **Reservations** → try to book the same room for overlapping dates → the
   request is refused with *"Room is already reserved for part of these dates."*
8. **Reservations** → change the status → **Reports → Status history** shows the
   change.
9. **Reports** → the seven reports all return rows.
10. Open `https://<render-service>.onrender.com/api/health` → `{"status":"ok"}`.

---

## 7. The two-minute demonstration script

**Before the demonstration (one minute earlier):** open the backend health
check in a browser tab. The Render free tier sleeps after 15 minutes of
inactivity, and the first request needs 30–60 seconds to wake the service up.
Doing this once in advance means the demonstration never waits.

| # | What to show | Where |
|---|---|---|
| 0:00–0:20 | The dashboard: real metrics read from MySQL | `/` |
| 0:20–0:45 | The inventory of the rooms and the room types | `/rooms` |
| 0:45–1:10 | Availability search for a future date range | `/availability` |
| 1:10–1:40 | Create a reservation on the spot | `/reservations` |
| 1:40–2:00 | Record a payment, the balance updates, then the reports | `/payments`, `/reports` |

**The one sentence to say at the end:**

> "The double booking is refused by the database itself — by a trigger and a
> row lock inside the stored procedure — not by a check in the browser. You can
> see it if you try to book the same room for the same dates."

---

## 8. Known limitations

| Limitation | Detail |
|---|---|
| **Render free tier sleeps** | The service is suspended after 15 minutes without a request and needs 30–60 seconds to start again. The wake-up step in section 7 avoids the wait. The paid Starter plan ($7/month) removes the sleep. |
| **Aiven free tier sleeps** | The same applies to the database. The health check wakes it. |
| **Aiven connection limit** | The pool is limited to 5 connections (`DB_CONNECTION_LIMIT=5`). |
| **Vercel deployment protection** | The Vercel team had SSO protection switched on, which answered `404` to every anonymous visitor. It is switched off for this project (`ssoProtection: null`). |
| **No authentication** | There is no login. Anyone who knows the URL can create, change and cancel bookings. |
| **Academic demonstration only** | All data is fictional. The application is not suitable for a real hotel, and the database is not protected by anything beyond the network access list of Aiven and the restricted database user. |
| **The demo data is dated relative to `CURDATE()`** | `database/deploy/08_demo_data.sql` creates the demonstration bookings relative to the day it is run, so the dashboard always shows arrivals and departures. Re-running it later does not move the old rows. |

---

## 9. How to tear the deployment down

| What | How |
|---|---|
| Vercel | Delete the project `staywise-dbms` in the dashboard. The alias disappears with it. |
| Render | Delete the web service. Nothing else is stored there except the environment variables. |
| Aiven | Delete the MySQL service. **This destroys every row** — take a backup first: `bash database/backup.sh` with the remote `MYSQL_*` variables. |
| GitHub | Set the repository back to private. |
