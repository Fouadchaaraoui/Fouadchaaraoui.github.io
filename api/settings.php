<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_auth_user();

$pdo = db();
$method = get_method();

function ensure_settings_row(PDO $pdo): void
{
    $stmt = $pdo->query('SELECT id FROM settings WHERE id = 1 LIMIT 1');
    if ($stmt->fetch()) {
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO settings
         (id, hotel_name, contact_email, currency, auto_confirm_bookings, vip_arrival_alerts, maintenance_reminders)
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

function map_settings(array $row): array
{
    return [
        'hotelName' => (string)$row['hotel_name'],
        'contactEmail' => (string)$row['contact_email'],
        'currency' => (string)$row['currency'],
        'autoConfirmBookings' => (bool)$row['auto_confirm_bookings'],
        'vipArrivalAlerts' => (bool)$row['vip_arrival_alerts'],
        'maintenanceReminders' => (bool)$row['maintenance_reminders'],
    ];
}

ensure_settings_row($pdo);

if ($method === 'GET') {
    $stmt = $pdo->query(
        'SELECT hotel_name, contact_email, currency, auto_confirm_bookings, vip_arrival_alerts, maintenance_reminders
         FROM settings WHERE id = 1 LIMIT 1'
    );
    $row = $stmt->fetch();
    json_response(['ok' => true, 'item' => map_settings($row ?: [])]);
}

if ($method === 'PUT') {
    $body = read_json_body();
    $hotelName = trim((string)($body['hotelName'] ?? ''));
    $contactEmail = normalize_email((string)($body['contactEmail'] ?? ''));
    $currency = trim((string)($body['currency'] ?? 'USD'));

    if ($hotelName === '') {
        json_response(['ok' => false, 'message' => 'Hotel name is required'], 422);
    }
    if (!filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
        json_response(['ok' => false, 'message' => 'Invalid contact email'], 422);
    }

    $stmt = $pdo->prepare(
        'UPDATE settings
         SET hotel_name = :hotel_name,
             contact_email = :contact_email,
             currency = :currency,
             auto_confirm_bookings = :auto_confirm_bookings,
             vip_arrival_alerts = :vip_arrival_alerts,
             maintenance_reminders = :maintenance_reminders,
             updated_at = NOW()
         WHERE id = 1'
    );
    $stmt->execute([
        'hotel_name' => $hotelName,
        'contact_email' => $contactEmail,
        'currency' => $currency,
        'auto_confirm_bookings' => bool_from_input($body['autoConfirmBookings'] ?? false),
        'vip_arrival_alerts' => bool_from_input($body['vipArrivalAlerts'] ?? false),
        'maintenance_reminders' => bool_from_input($body['maintenanceReminders'] ?? false),
    ]);

    $stmt = $pdo->query(
        'SELECT hotel_name, contact_email, currency, auto_confirm_bookings, vip_arrival_alerts, maintenance_reminders
         FROM settings WHERE id = 1 LIMIT 1'
    );
    $row = $stmt->fetch();
    json_response(['ok' => true, 'item' => map_settings($row ?: [])]);
}

json_response(['ok' => false, 'message' => 'Method not allowed'], 405);

