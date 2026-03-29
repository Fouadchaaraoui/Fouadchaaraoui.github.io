<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_auth_user();

$pdo = db();
$method = get_method();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, booking_code, customer_id, room_id, check_in, check_out FROM bookings ORDER BY check_in DESC')->fetchAll();
    $items = array_map(static function (array $row): array {
        return [
            'id' => (string)$row['booking_code'],
            'dbId' => (int)$row['id'],
            'customerId' => (int)$row['customer_id'],
            'roomId' => (int)$row['room_id'],
            'checkIn' => (string)$row['check_in'],
            'checkOut' => (string)$row['check_out'],
        ];
    }, $rows);
    json_response(['ok' => true, 'items' => $items]);
}

if ($method === 'POST') {
    $body = read_json_body();
    $customerId = (int)($body['customerId'] ?? 0);
    $roomId = (int)($body['roomId'] ?? 0);
    $checkIn = (string)($body['checkIn'] ?? '');
    $checkOut = (string)($body['checkOut'] ?? '');

    if ($customerId <= 0 || $roomId <= 0 || $checkIn === '' || $checkOut === '') {
        json_response(['ok' => false, 'message' => 'Invalid booking payload'], 422);
    }
    if ($checkOut <= $checkIn) {
        json_response(['ok' => false, 'message' => 'Check-out must be after check-in'], 422);
    }

    if (booking_overlap_exists($roomId, $checkIn, $checkOut, null)) {
        json_response(['ok' => false, 'message' => 'Selected room is already booked for these dates'], 409);
    }

    $bookingCode = 'BK-' . substr((string)time() . (string)random_int(100, 999), -6);
    $stmt = $pdo->prepare(
        'INSERT INTO bookings (booking_code, customer_id, room_id, check_in, check_out)
         VALUES (:booking_code, :customer_id, :room_id, :check_in, :check_out)'
    );
    $stmt->execute([
        'booking_code' => $bookingCode,
        'customer_id' => $customerId,
        'room_id' => $roomId,
        'check_in' => $checkIn,
        'check_out' => $checkOut,
    ]);

    json_response(['ok' => true], 201);
}

if ($method === 'PUT') {
    $body = read_json_body();
    $dbId = (int)($body['dbId'] ?? 0);
    $customerId = (int)($body['customerId'] ?? 0);
    $roomId = (int)($body['roomId'] ?? 0);
    $checkIn = (string)($body['checkIn'] ?? '');
    $checkOut = (string)($body['checkOut'] ?? '');

    if ($dbId <= 0 || $customerId <= 0 || $roomId <= 0 || $checkIn === '' || $checkOut === '') {
        json_response(['ok' => false, 'message' => 'Invalid booking payload'], 422);
    }
    if ($checkOut <= $checkIn) {
        json_response(['ok' => false, 'message' => 'Check-out must be after check-in'], 422);
    }

    if (booking_overlap_exists($roomId, $checkIn, $checkOut, $dbId)) {
        json_response(['ok' => false, 'message' => 'Selected room is already booked for these dates'], 409);
    }

    $stmt = $pdo->prepare(
        'UPDATE bookings
         SET customer_id = :customer_id, room_id = :room_id, check_in = :check_in, check_out = :check_out
         WHERE id = :id'
    );
    $stmt->execute([
        'customer_id' => $customerId,
        'room_id' => $roomId,
        'check_in' => $checkIn,
        'check_out' => $checkOut,
        'id' => $dbId,
    ]);

    json_response(['ok' => true]);
}

if ($method === 'DELETE') {
    $dbId = (int)($_GET['dbId'] ?? 0);
    if ($dbId <= 0) {
        json_response(['ok' => false, 'message' => 'Invalid booking id'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM bookings WHERE id = :id');
    $stmt->execute(['id' => $dbId]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Method not allowed'], 405);

