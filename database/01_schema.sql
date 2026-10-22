-- =====================================================================
-- 01_schema.sql  |  Hotel Booking and Reservation Management System
-- DDL - tables, keys and constraints
-- Target: MySQL 8.0+ (developed and verified on MySQL 26.7.0, Homebrew)
--
-- SAFE: this script never drops, truncates or resets an existing
-- database. It uses CREATE ... IF NOT EXISTS so it can be re-run.
-- The destructive DDL demonstration lives in 09_ddl_lab.sql and runs
-- against a separate throwaway database.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS hotel_booking_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE hotel_booking_db;

-- ---------------------------------------------------------------------
-- 1. CUSTOMER - master data. One row per registered guest.
--    UNIQUE(phone) and UNIQUE(email) prevent duplicate guest records.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer (
    customer_id  INT AUTO_INCREMENT PRIMARY KEY,
    first_name   VARCHAR(50)  NOT NULL,
    last_name    VARCHAR(50)  NOT NULL,
    phone        VARCHAR(20)  NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    address      VARCHAR(255) NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2. ROOM_TYPE - master data. Price and capacity live here (3NF).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_type (
    room_type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name    VARCHAR(50)   NOT NULL UNIQUE,
    base_price   DECIMAL(10,2) NOT NULL,
    capacity     INT           NOT NULL,
    description  VARCHAR(255)  NULL,
    CONSTRAINT room_type_chk_1 CHECK (base_price > 0),
    CONSTRAINT room_type_chk_2 CHECK (capacity > 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 3. ROOM - master data. The physical rooms of the hotel.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room (
    room_id      INT AUTO_INCREMENT PRIMARY KEY,
    room_number  VARCHAR(10) NOT NULL UNIQUE,
    room_type_id INT         NOT NULL,
    floor_no     INT         NOT NULL,
    room_status  ENUM('Available','Maintenance','Inactive') NOT NULL DEFAULT 'Available',
    CONSTRAINT fk_room_type FOREIGN KEY (room_type_id)
        REFERENCES room_type(room_type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT room_chk_1 CHECK (floor_no > 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 4. RESERVATION - transactional data. One row per booking.
--    The date CHECK plus the BEFORE INSERT / BEFORE UPDATE triggers
--    guarantee that a room is never double booked.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation (
    reservation_id    INT AUTO_INCREMENT PRIMARY KEY,
    customer_id       INT          NOT NULL,
    room_id           INT          NOT NULL,
    check_in_date     DATE         NOT NULL,
    check_out_date    DATE         NOT NULL,
    adults            INT          NOT NULL DEFAULT 1,
    children          INT          NOT NULL DEFAULT 0,
    reservation_status ENUM('Pending','Confirmed','Checked_In','Checked_Out','Cancelled')
                      NOT NULL DEFAULT 'Pending',
    booking_date      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount      DECIMAL(10,2) NOT NULL,
    remarks           VARCHAR(255) NULL,
    CONSTRAINT fk_reservation_customer FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reservation_room FOREIGN KEY (room_id)
        REFERENCES room(room_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_stay_dates       CHECK (check_out_date > check_in_date),
    CONSTRAINT reservation_chk_1   CHECK (adults > 0),
    CONSTRAINT reservation_chk_2   CHECK (children >= 0),
    CONSTRAINT reservation_chk_3   CHECK (total_amount >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 5. PAYMENT - transactional data. A reservation may have many payments.
--    Balance rule: only payment_status = 'Paid' reduces the balance.
--    'Pending', 'Failed' and 'Refunded' rows are recorded for audit but
--    do not count towards the amount paid.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment (
    payment_id           INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id       INT          NOT NULL,
    payment_date         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount               DECIMAL(10,2) NOT NULL,
    payment_method       ENUM('Cash','Card','UPI','Bank_Transfer') NOT NULL,
    payment_status       ENUM('Paid','Pending','Refunded','Failed') NOT NULL DEFAULT 'Paid',
    transaction_reference VARCHAR(60) NULL UNIQUE,
    CONSTRAINT fk_payment_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservation(reservation_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT payment_chk_1 CHECK (amount > 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 6. RESERVATION_STATUS_LOG - audit data. One row per status change.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_status_log (
    log_id         INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT          NOT NULL,
    old_status     VARCHAR(20)  NULL,
    new_status     VARCHAR(20)  NOT NULL,
    changed_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by     VARCHAR(80)  NOT NULL DEFAULT 'SYSTEM',
    CONSTRAINT fk_log_reservation FOREIGN KEY (reservation_id)
        REFERENCES reservation(reservation_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;
