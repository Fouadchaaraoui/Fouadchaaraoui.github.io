CREATE DATABASE IF NOT EXISTS hotel_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hotel_booking;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(80) NOT NULL,
    status ENUM('Available', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available',
    price_per_night DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    status ENUM('Regular', 'VIP') NOT NULL DEFAULT 'Regular',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(32) NOT NULL UNIQUE,
    customer_id BIGINT UNSIGNED NOT NULL,
    room_id BIGINT UNSIGNED NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    hotel_name VARCHAR(180) NOT NULL,
    contact_email VARCHAR(190) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    auto_confirm_bookings TINYINT(1) NOT NULL DEFAULT 1,
    vip_arrival_alerts TINYINT(1) NOT NULL DEFAULT 1,
    maintenance_reminders TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB;

INSERT INTO rooms (room_number, type, status, price_per_night)
SELECT * FROM (
    SELECT '101', 'Deluxe', 'Available', 140.00 UNION ALL
    SELECT '205', 'Suite', 'Maintenance', 260.00 UNION ALL
    SELECT '312', 'Standard', 'Occupied', 95.00
) AS t
WHERE NOT EXISTS (SELECT 1 FROM rooms LIMIT 1);

INSERT INTO customers (name, email, phone, status)
SELECT * FROM (
    SELECT 'Sarah Lee', 'sarah@example.com', '+1 555 210 9090', 'VIP' UNION ALL
    SELECT 'John Kim', 'john@example.com', '+1 555 908 2221', 'Regular' UNION ALL
    SELECT 'Mia Garcia', 'mia@example.com', '+1 555 444 8899', 'VIP'
) AS t
WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);

INSERT INTO bookings (booking_code, customer_id, room_id, check_in, check_out)
SELECT * FROM (
    SELECT 'BK-1001', c1.id, r2.id, '2026-02-17', '2026-02-20'
    FROM customers c1, rooms r2
    WHERE c1.email = 'sarah@example.com' AND r2.room_number = '205'
    UNION ALL
    SELECT 'BK-1002', c2.id, r1.id, '2026-02-18', '2026-02-19'
    FROM customers c2, rooms r1
    WHERE c2.email = 'john@example.com' AND r1.room_number = '101'
    UNION ALL
    SELECT 'BK-1003', c3.id, r3.id, '2026-02-16', '2026-02-21'
    FROM customers c3, rooms r3
    WHERE c3.email = 'mia@example.com' AND r3.room_number = '312'
) AS t
WHERE NOT EXISTS (SELECT 1 FROM bookings LIMIT 1);

INSERT INTO settings (id, hotel_name, contact_email, currency, auto_confirm_bookings, vip_arrival_alerts, maintenance_reminders)
VALUES (1, 'Grand Horizon', 'info@grandhorizon.com', 'USD', 1, 1, 0)
ON DUPLICATE KEY UPDATE
  hotel_name = VALUES(hotel_name),
  contact_email = VALUES(contact_email),
  currency = VALUES(currency),
  auto_confirm_bookings = VALUES(auto_confirm_bookings),
  vip_arrival_alerts = VALUES(vip_arrival_alerts),
  maintenance_reminders = VALUES(maintenance_reminders);