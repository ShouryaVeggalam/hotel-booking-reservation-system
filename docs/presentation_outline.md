# 11-Slide Presentation Outline

Use this to make a PowerPoint/Canva presentation. Keep each slide simple and explain the details while speaking.

## Slide 1 - Title

**Hotel Booking and Reservation Management System**  
DBMS Mini Project - Project Idea 10  
[Your Name] | [Roll Number] | [Class]

## Slide 2 - Problem Statement

- Manual booking records can be slow and error-prone.
- The same room may be accidentally reserved twice.
- Payment and room-status information can become inconsistent.
- The project provides a centralized MySQL solution.

## Slide 3 - Objectives

- Manage guests, rooms, reservations, and payments.
- Search available rooms by dates and guest count.
- Prevent double booking.
- Generate booking and revenue reports.

## Slide 4 - Main Entities

Show the ER diagram from `er_diagram.md`.

- Customer makes Reservation.
- Room Type classifies Room.
- Reservation belongs to one customer and one room.
- Reservation has one or more Payments.

## Slide 5 - Relational Schema and Normalization

- Tables: Customer, Room_Type, Room, Reservation, Payment, Reservation_Status_Log.
- Primary and foreign keys preserve relationships.
- Design is in 3NF.
- Reduces duplicate customer, room-type, and payment data.

## Slide 6 - SQL Implementation

- DDL creates six normalized tables.
- DML inserts room, customer, reservation, and payment data.
- Constraints: PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK.
- Indexes speed up room/date and payment searches.

## Slide 7 - Stored Procedures

- `sp_check_room_availability` finds suitable free rooms.
- `sp_create_reservation` calculates bill and creates a booking.
- It uses `START TRANSACTION`, `FOR UPDATE`, and `COMMIT`.

## Slide 8 - Triggers and Integrity

- Reject invalid check-in/check-out dates.
- Reject overlapping reservations for the same room.
- Reject payment above the total bill.
- Create audit records when reservation status changes.

## Slide 9 - Views and Reports

- `vw_reservation_details`: customer, room, nights, payment, balance due.
- `vw_room_revenue`: number of reservations and revenue per room.
- Add a screenshot of both query outputs from MySQL Workbench.

## Slide 10 - Testing Results

| Test | Result |
|---|---|
| Room availability search | Pass |
| Valid booking creation | Pass |
| Double booking prevention | Pass |
| Overpayment prevention | Pass |
| Transaction rollback | Pass |

## Slide 11 - Conclusion and Future Scope

- The project provides a reliable database solution for hotel bookings.
- Constraints, triggers, and transactions ensure correct data.
- Future scope: login roles, online payments, cancellation/refund, web UI, notifications.

End with: **Thank You - Questions?**
