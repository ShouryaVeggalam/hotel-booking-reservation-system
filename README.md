# Hotel Booking and Reservation Management System

This is a beginner-friendly DBMS mini project for **Project Idea 10**.
It manages customers, rooms, reservations, payments, room availability, and an audit log.

## What you will submit

1. `sql/hotel_booking_management.sql` - run this in MySQL Workbench.
2. `docs/project_report.md` - content for your written report.
3. `docs/er_diagram.md` - ER diagram and relational schema.
4. `docs/viva_questions.md` - easy answers for viva.

## How to run it in MySQL Workbench

1. Open MySQL Workbench and connect to your local MySQL server.
2. Open `sql/hotel_booking_management.sql`.
3. Click the lightning-bolt **Execute** button.
4. Refresh the **Schemas** panel and select `hotel_booking_db`.
5. Run the example queries at the end of the file one at a time.

The script safely deletes and recreates only the database named `hotel_booking_db`. Do not run it if you already have important work in a database with that exact name.

## Features demonstrated

- ER-based relational design in Third Normal Form (3NF)
- Primary keys, foreign keys, `UNIQUE`, `CHECK`, and `NOT NULL` constraints
- DDL and DML
- joins, aggregate functions, subqueries, views, and indexes
- stored procedures and triggers
- transactions with `COMMIT` and `ROLLBACK`
- concurrent booking protection using a room lock plus an overlap-check trigger
- audit logging for reservation status changes

## Beginner tips

- A **room** is the actual physical room (for example, room 101).
- A **reservation** stores the dates for one customer and one room.
- A **payment** is stored separately because a reservation can have more than one payment.
- Never change the table structure during your demo unless you understand the effect. Use the test queries instead.

## Frontend application

The `frontend/` folder is a simple web application connected directly to this MySQL database.

1. Open a new Terminal window.
2. Run `cd /Users/shouryaveggalam/Documents/ChatGPT/DBMS/hotel_booking_db/frontend`.
3. Run `npm install` once.
4. Run `npm run dev`.
5. Open `http://localhost:3000` in a browser.

New reservations and status changes from the website are saved in MySQL immediately. The dashboard reloads the live data after each change.

## Before submission

- Replace the student placeholders in the report and slide deck.
- Run the script yourself and take screenshots of: tables, `CALL sp_check_room_availability`, `CALL sp_create_reservation`, views, trigger error, and report queries.
- Practise the short viva answers in `docs/viva_questions.md`.
