# Viva Questions and Short Answers

1. **What problem does your project solve?**
   It replaces manual room booking records with a database that keeps room availability, customer reservations, payments, and check-in/check-out information consistent.

2. **What is the primary key of the Reservation table?**
   `reservation_id`; it uniquely identifies each reservation.

3. **Why is Payment a separate table?**
   One reservation may be paid in more than one instalment, so keeping payments in a separate table avoids repeating reservation data.

4. **What is a foreign key in this project?**
   `reservation.customer_id` refers to `customer.customer_id`, and `reservation.room_id` refers to `room.room_id`. Foreign keys maintain referential integrity.

5. **How do you prevent double booking?**
   A trigger checks whether another active reservation has overlapping dates for the same room. The booking procedure also locks a candidate room using `FOR UPDATE` during the transaction.

6. **Why is `check_out_date > check_in_date` important?**
   It prevents invalid stays of zero or negative nights. A check constraint and trigger enforce it.

7. **What is a stored procedure?**
   It is reusable SQL stored in the database. `sp_check_room_availability` finds free rooms and `sp_create_reservation` creates a booking safely.

8. **What is a trigger?**
   A trigger runs automatically when an event occurs. This project uses triggers for date validation, overlap protection, audit logging, and payment validation.

9. **What is a view?**
   A view is a saved query. `vw_reservation_details` gives an easy full booking report without writing the joins every time.

10. **What does COMMIT do? What does ROLLBACK do?**
    `COMMIT` permanently saves all changes in a transaction. `ROLLBACK` cancels changes that have not yet been committed.

11. **Why are indexes used?**
    They make common searches faster, such as finding reservations by room and date or finding payments for a reservation.

12. **Which normal form did you use?**
    The design is in Third Normal Form (3NF), reducing redundancy and update anomalies.
