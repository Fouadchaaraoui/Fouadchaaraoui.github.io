<?php
declare(strict_types=1);

require_once __DIR__ . '/../_bootstrap.php';

ensure_default_admin();

$user = current_user();
json_response([
    'ok' => true,
    'authenticated' => (bool)$user,
    'user' => $user,
]);

