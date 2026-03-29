<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_auth_user();

$pdo = db();
$method = get_method();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, room_number, type, status, price_per_night FROM rooms ORDER BY room_number ASC')->fetchAll();
    $items = array_map(static function (array $row): array {
        return [
            'id' => (int)$row['id'],
            'number' => (string)$row['room_number'],
            'type' => (string)$row['type'],
            'status' => (string)$row['status'],
            'price' => (float)$row['price_per_night'],
        ];
    }, $rows);
    json_response(['ok' => true, 'items' => $items]);
}

if ($method === 'POST') {
    $body = read_json_body();
    $number = trim((string)($body['number'] ?? ''));
    $type = trim((string)($body['type'] ?? ''));
    $status = trim((string)($body['status'] ?? ''));
    $price = (float)($body['price'] ?? 0);

    if ($number === '' || $type === '' || $status === '' || $price <= 0) {
        json_response(['ok' => false, 'message' => 'Invalid room payload'], 422);
    }

    $sql = 'INSERT INTO rooms (room_number, type, status, price_per_night) VALUES (:number, :type, :status, :price)';
    $stmt = $pdo->prepare($sql);
    try {
        $stmt->execute(['number' => $number, 'type' => $type, 'status' => $status, 'price' => $price]);
    } catch (Throwable $e) {
        json_response(['ok' => false, 'message' => 'Room number already exists'], 409);
    }

    json_response(['ok' => true], 201);
}

if ($method === 'PUT') {
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    $number = trim((string)($body['number'] ?? ''));
    $type = trim((string)($body['type'] ?? ''));
    $status = trim((string)($body['status'] ?? ''));
    $price = (float)($body['price'] ?? 0);

    if ($id <= 0 || $number === '' || $type === '' || $status === '' || $price <= 0) {
        json_response(['ok' => false, 'message' => 'Invalid room payload'], 422);
    }

    $check = $pdo->prepare('SELECT id FROM rooms WHERE room_number = :number AND id != :id LIMIT 1');
    $check->execute(['number' => $number, 'id' => $id]);
    if ($check->fetch()) {
        json_response(['ok' => false, 'message' => 'Room number already exists'], 409);
    }

    $sql = 'UPDATE rooms SET room_number = :number, type = :type, status = :status, price_per_night = :price WHERE id = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['number' => $number, 'type' => $type, 'status' => $status, 'price' => $price, 'id' => $id]);

    json_response(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        json_response(['ok' => false, 'message' => 'Invalid room id'], 422);
    }

    $check = $pdo->prepare('SELECT id FROM bookings WHERE room_id = :id LIMIT 1');
    $check->execute(['id' => $id]);
    if ($check->fetch()) {
        json_response(['ok' => false, 'message' => 'Cannot delete room with active bookings'], 409);
    }

    $stmt = $pdo->prepare('DELETE FROM rooms WHERE id = :id');
    $stmt->execute(['id' => $id]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Method not allowed'], 405);

