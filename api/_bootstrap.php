<?php
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

date_default_timezone_set('UTC');

const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'hotel_booking';
const DB_USER = 'root';
const DB_PASS = '';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (Throwable $e) {
        bootstrap_database();
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    return $pdo;
}

function bootstrap_database(): void
{
    $serverDsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
    $server = new PDO($serverDsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

    $dbDsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dbDsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS rooms (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            room_number VARCHAR(50) NOT NULL UNIQUE,
            type VARCHAR(80) NOT NULL,
            status ENUM('Available', 'Occupied', 'Maintenance') NOT NULL DEFAULT 'Available',
            price_per_night DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customers (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(190) NOT NULL UNIQUE,
            phone VARCHAR(50) NOT NULL,
            status ENUM('Regular', 'VIP') NOT NULL DEFAULT 'Regular',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS bookings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            booking_code VARCHAR(32) NOT NULL UNIQUE,
            customer_id BIGINT UNSIGNED NOT NULL,
            room_id BIGINT UNSIGNED NOT NULL,
            check_in DATE NOT NULL,
            check_out DATE NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
            CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            hotel_name VARCHAR(180) NOT NULL,
            contact_email VARCHAR(190) NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'USD',
            auto_confirm_bookings TINYINT(1) NOT NULL DEFAULT 1,
            vip_arrival_alerts TINYINT(1) NOT NULL DEFAULT 1,
            maintenance_reminders TINYINT(1) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP NULL DEFAULT NULL
        ) ENGINE=InnoDB"
    );

    $settingsStmt = $pdo->query('SELECT id FROM settings WHERE id = 1 LIMIT 1');
    if (!$settingsStmt->fetch()) {
        $insert = $pdo->prepare(
            'INSERT INTO settings (id, hotel_name, contact_email, currency, auto_confirm_bookings, vip_arrival_alerts, maintenance_reminders)
             VALUES (1, :hotel_name, :contact_email, :currency, :auto_confirm_bookings, :vip_arrival_alerts, :maintenance_reminders)'
        );
        $insert->execute([
            'hotel_name' => 'Grand Horizon',
            'contact_email' => 'info@grandhorizon.com',
            'currency' => 'USD',
            'auto_confirm_bookings' => 1,
            'vip_arrival_alerts' => 1,
            'maintenance_reminders' => 0,
        ]);
    }
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        json_response(['ok' => false, 'message' => 'Method not allowed'], 405);
    }
}

function get_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function current_user(): ?array
{
    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        return null;
    }
    return $_SESSION['user'];
}

function require_auth_user(): array
{
    $user = current_user();
    if (!$user) {
        json_response(['ok' => false, 'message' => 'Unauthorized'], 401);
    }
    return $user;
}

function normalize_email(string $email): string
{
    return strtolower(trim($email));
}

function bool_from_input(mixed $value): int
{
    return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
}

function ensure_default_admin(): void
{
    $pdo = db();
    $email = 'admin@grandhorizon.com';
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $found = $stmt->fetch();
    if ($found) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :password_hash, :role)'
    );
    $insert->execute([
        'name' => 'Admin',
        'email' => $email,
        'password_hash' => password_hash('admin123', PASSWORD_DEFAULT),
        'role' => 'admin',
    ]);
}

function booking_overlap_exists(
    int $roomId,
    string $checkIn,
    string $checkOut,
    ?int $excludeBookingId = null
): bool {
    $pdo = db();
    $sql = 'SELECT id FROM bookings
            WHERE room_id = :room_id
              AND check_in < :check_out
              AND check_out > :check_in';
    $params = [
        'room_id' => $roomId,
        'check_in' => $checkIn,
        'check_out' => $checkOut,
    ];

    if ($excludeBookingId !== null) {
        $sql .= ' AND id != :exclude_id';
        $params['exclude_id'] = $excludeBookingId;
    }

    $sql .= ' LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (bool)$stmt->fetch();
}
