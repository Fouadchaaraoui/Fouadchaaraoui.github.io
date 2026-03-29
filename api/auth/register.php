<?php
declare(strict_types=1);

require_once __DIR__ . '/../_bootstrap.php';

require_method('POST');

$body = read_json_body();
$name = trim((string)($body['name'] ?? ''));
$email = normalize_email((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if (strlen($name) < 2) {
    json_response(['ok' => false, 'message' => 'Name must be at least 2 characters'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'message' => 'Invalid email'], 422);
}
if (strlen($password) < 6) {
    json_response(['ok' => false, 'message' => 'Password must be at least 6 characters'], 422);
}

$pdo = db();
$check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
$check->execute(['email' => $email]);
if ($check->fetch()) {
    json_response(['ok' => false, 'message' => 'Email already registered'], 409);
}

$insert = $pdo->prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :password_hash, :role)'
);
$insert->execute([
    'name' => $name,
    'email' => $email,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'role' => 'staff',
]);

$userId = (int)$pdo->lastInsertId();
$_SESSION['user'] = [
    'id' => $userId,
    'name' => $name,
    'email' => $email,
    'role' => 'staff',
];

json_response([
    'ok' => true,
    'user' => $_SESSION['user'],
], 201);

