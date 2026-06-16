<?php
/**
 * KOZMO AI Telemetry Receiver
 *
 * Host this file on any server to receive daily pings from all sites running
 * the KOZMO AI plugin. Data is logged as JSONL (one JSON object per line).
 *
 * Usage:
 *   1. Upload this file to your server (e.g., https://your-server.com/telemetry.php)
 *   2. Set the telemetry URL in plugin Settings → Advanced → System
 *   3. Check the log file (telemetry.log in the same directory)
 *
 * Security: This endpoint is public. The data is anonymized (site hashes, no URLs).
 */

// ─── Config ──────────────────────────────────────────
$log_file = __DIR__ . '/telemetry.log';
$max_log_lines = 100000; // Auto-rotate

// ─── CORS & Headers ─────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST required']);
    exit;
}

// ─── Receive & Log ──────────────────────────────────
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || empty($data['site_hash'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

// Add server timestamp
$data['received_at'] = gmdate('c');

// Append to log
$line = json_encode($data) . "\n";
$written = file_put_contents($log_file, $line, FILE_APPEND | LOCK_EX);

if (false === $written) {
    http_response_code(500);
    echo json_encode(['error' => 'Write failed']);
    exit;
}

// Rotate if too large
if (file_exists($log_file) && count(file($log_file)) > $max_log_lines) {
    rename($log_file, $log_file . '.' . gmdate('Y-m-d-H-i-s') . '.bak');
}

// ─── Response ────────────────────────────────────────
http_response_code(200);
echo json_encode([
    'status'  => 'ok',
    'site'    => substr($data['site_hash'], 0, 8) . '...',
    'version' => $data['plugin_version'] ?? 'unknown',
    'time'    => $data['received_at'],
]);

// ─── Optional: Quick Stats Endpoint ─────────────────
// Access this via GET to see summary counts.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['stats'])) {
    header('Content-Type: application/json');
    $lines = file_exists($log_file) ? file($log_file) : [];

    $sites = [];
    $versions = [];
    foreach ($lines as $l) {
        $entry = json_decode($l, true);
        if (!$entry) continue;
        $sites[$entry['site_hash']] = $entry;
        $v = $entry['plugin_version'] ?? 'unknown';
        $versions[$v] = ($versions[$v] ?? 0) + 1;
    }

    $total = count($lines);
    $unique = count($sites);
    $latest = $lines ? json_decode(end($lines), true) : null;

    echo json_encode([
        'total_pings'    => $total,
        'unique_sites'   => $unique,
        'versions'       => $versions,
        'latest_ping'    => $latest ? $latest['received_at'] : null,
        'sites'          => array_map(function($s) {
            return [
                'hash'    => substr($s['site_hash'], 0, 12) . '...',
                'version' => $s['plugin_version'] ?? '?',
                'health'  => $s['health_overall'] ?? '?',
                'articles'=> $s['articles_total'] ?? 0,
                'last'    => $s['received_at'] ?? '?',
            ];
        }, $sites),
    ]);
    exit;
}
