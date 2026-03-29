<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_auth_user();

$pdo = db();
$method = get_method();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, name, email, phone, status FROM customers ORDER BY name ASC')->fetchAll();
    $items = array_map(static function (array $row): array {
        return [
            'id' => (int)$row['id'],
            'name' => (string)$row['name'],
            'email' => (string)$row['email'],
            'phone' => (string)$row['phone'],
            'status' => (string)$row['status'],
        ];
    }, $rows);
    json_response(['ok' => true, 'items' => $items]);
}

if ($method === 'POST') {
    $body = read_json_body();
    $name = trim((string)($body['name'] ?? ''));
    $email = normalize_email((string)($body['email'] ?? ''));
    $phone = trim((string)($body['phone'] ?? ''));
    $status = trim((string)($body['status'] ?? ''));

    if ($name === '' || $email === '' || $phone === '' || $status === '') {
        json_response(['ok' => false, 'message' => 'Invalid customer payload'], 422);
    }

    $stmt = $pdo->prepare('INSERT INTO customers (name, email, phone, status) VALUES (:name, :email, :phone, :status)');
    try {
        $stmt->execute(['name' => $name, 'email' => $email, 'phone' => $phone, 'status' => $status]);
    } catch (Throwable $e) {
        json_response(['ok' => false, 'message' => 'Customer email already exists'], 409);
    }

    json_response(['ok' => true], 201);
}

if ($method === 'PUT') {
    $body = read_json_body();
    $id = (int)($body['id'] ?? 0);
    $name = trim((string)($body['name'] ?? ''));
    $email = normalize_email((string)($body['email'] ?? ''));
    $phone = trim((string)($body['phone'] ?? ''));
    $status = trim((string)($body['status'] ?? ''));

    if ($id <= 0 || $name === '' || $email === '' || $phone === '' || $status === '') {
        json_response(['ok' => false, 'message' => 'Invalid customer payload'], 422);
    }

    $check = $pdo->prepare('SELECT id FROM customers WHERE email = :email AND id != :id LIMIT 1');
    $check->execute(['email' => $email, 'id' => $id]);
    if ($check->fetch()) {
        json_response(['ok' => false, 'message' => 'Customer email already exists'], 409);
    }

    $stmt = $pdo->prepare('UPDATE customers SET name = :name, email = :email, phone = :phone, status = :status WHERE id = :id');
    $stmt->execute(['name' => $name, 'email' => $email, 'phone' => $phone, 'status' => $status, 'id' => $id]);
    json_response(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        json_response(['ok' => false, 'message' => 'Invalid customer id'], 422);
    }

    $check = $pdo->prepare('SELECT id FROM bookings WHERE customer_id = :id LIMIT 1');
    $check->execute(['id' => $id]);
    if ($check->fetch()) {
        json_response(['ok' => false, 'message' => 'Cannot delete customer with active bookings'], 409);
    }

    $stmt = $pdo->prepare('DELETE FROM customers WHERE id = :id');
    $stmt->execute(['id' => $id]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'message' => 'Method not allowed'], 405);

