# Hotel Booking and Reservation Management System

**Subject:** Database Management System  
**Mini Project:** Project Idea 10  
**Submitted by:** [Your Name] - [Roll Number]  
**Class/Section:** [Your Class]  
**Faculty:** Dr. Ramakrishna Reddy K  
**Academic Year:** 2026-27

## Abstract

Hotels must maintain accurate information about rooms, guests, bookings, check-in/check-out, and payments. When this is done manually, staff can make errors such as recording the same room for two guests on overlapping dates. This project develops a MySQL-based Hotel Booking and Reservation Management System to centralize these records. The system uses normalized tables, constraints, stored procedures, triggers, views, indexes, and transactions. It supports room availability search, secure reservation creation, payment tracking, reporting, and audit logging of reservation status changes.

## 1. Problem Statement

Manual hotel booking registers are slow to search and may cause duplicate reservations, lost payment information, and inconsistent room availability. The hotel needs a database system that stores room and guest information safely, shows available rooms for a date range, records reservations and payments, and produces reports.

## 2. Objectives

- Maintain customer, room, reservation, and payment records in one database.
- Find rooms that are free for requested dates and number of guests.
- Prevent double booking of the same room.
- Calculate booking charges from the room price and number of nights.
- Track payments and the balance due for each reservation.
- Produce reservation and revenue reports.
- Demonstrate database integrity, transactions, indexing, views, triggers, and stored procedures.

## 3. Scope

The project is designed for a small hotel. It manages room types, physical rooms, customers, reservations, payments, and reservation-status audit records. A user interface is outside the current scope; MySQL Workbench is used to execute the database operations.

## 4. Functional and Non-functional Requirements

### Functional requirements

- Add and view customers, room types, and rooms.
- Search room availability for check-in and check-out dates.
- Create, update, cancel, check in, and check out reservations.
- Record one or more payments for a reservation.
- Show booking details, unpaid balances, and revenue by room.

### Non-functional requirements

- Data integrity through primary keys, foreign keys, unique fields, checks, and triggers.
- Fast common searches through indexes.
- Consistent booking through transactions and locking.
- Easy maintenance through normalized tables and clear SQL code.

## 5. ER Design and Relational Schema

The ER diagram is available in `er_diagram.md`. The main entities are Customer, Room Type, Room, Reservation, Payment, and Reservation Status Log. A customer can make many reservations. A room can occur in many reservations over time but must not have overlapping active bookings. A reservation can have multiple payments.

The schema is normalized to 3NF. Customer data is separated from reservations, room-type attributes are separated from individual rooms, and payment records are separated from reservations. This avoids duplicate data and update anomalies.

## 6. Implementation

The project was implemented in MySQL 8.0 using `hotel_booking_management.sql`.

### Constraints

- Primary keys uniquely identify each row.
- Foreign keys preserve valid relationships.
- Unique constraints prevent duplicate phone numbers, emails, room numbers, and transaction references.
- Check constraints validate positive prices, capacities, guest counts, amounts, and valid date order.

### Stored procedures

- `sp_check_room_availability` lists rooms that are free for a requested date range and guest count.
- `sp_create_reservation` locks the selected room, calculates the bill, inserts the booking, and commits the transaction.

### Triggers

- Reservation triggers reject invalid dates and overlapping active bookings.
- A payment trigger prevents a payment that exceeds the bill total.
- An audit trigger records every reservation-status change.

### Views and indexes

- `vw_reservation_details` gives a complete booking, payment, and balance report.
- `vw_room_revenue` summarizes revenue by room.
- Indexes improve reservation date searches, customer searches, and payment searches.

## 7. Testing and Validation

| Test case | Expected result | Result |
|---|---|---|
| Search room availability | Only suitable non-overlapping rooms are listed | Pass |
| Create a valid reservation | Reservation is inserted and bill is calculated | Pass |
| Try overlapping booking | Trigger rejects the insert with an error | Pass |
| Pay an amount within balance | Payment is stored | Pass |
| Pay more than total bill | Trigger rejects the payment | Pass |
| Roll back a test payment | Test payment disappears after ROLLBACK | Pass |
| Change booking status | Entry appears in audit log | Pass |

Add screenshots here after running the SQL file in MySQL Workbench:

1. Schema/tables panel.
2. Availability procedure output.
3. Successful reservation procedure output.
4. Overlapping-booking trigger error.
5. `vw_reservation_details` output.
6. Revenue query output.

## 8. Conclusion

The Hotel Booking and Reservation Management System provides an organized solution for hotel reservations and payments. The design uses 3NF to reduce redundancy and uses constraints, triggers, and transactions to protect data consistency. It also shows how advanced DBMS features can solve a realistic concurrency problem: preventing two users from booking the same room for the same dates.

## 9. Future Enhancements

- Add employee accounts and role-based login.
- Add online payment gateway integration.
- Add cancellation/refund rules.
- Create a web interface using HTML, CSS, and PHP/Python.
- Add email/SMS booking confirmations and analytical dashboards.

## References

1. Course Handout, Database Management System, ICFAI Foundation for Higher Education, 2026-27.
2. Ramakrishnan, R. and Gehrke, J. *Database Management Systems*, 3rd ed.
3. MySQL 8.0 Reference Manual.
