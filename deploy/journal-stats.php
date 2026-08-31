<?php
/**
 * NSY — Compteurs de vues / « j'aime » des articles du journal.
 *
 * POST JSON {slug, action: get|view|like|unlike} → {ok, views, likes}.
 * Le slug est TOUJOURS le slug FR (clé canonique partagée par la paire FR/EN,
 * fournie par l'attribut data-slug de la page — voir js/app.js).
 *
 * Stockage : _secret/journal-stats.json (interdit en HTTP par _secret/.htaccess,
 * jamais écrasé par le déploiement — l'upload FTP n'efface rien à distance).
 * Aucune donnée personnelle : des agrégats par slug, c'est tout. L'anti-abus
 * réutilise le plafond journalier par IP hachée d'antispam.php.
 *
 * RGPD : l'état « j'ai aimé » vit côté navigateur (localStorage), le serveur
 * ne stocke que des totaux.
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function jstats_respond(array $payload, int $status = 200): never
{
    ob_end_clean();
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Applique l'action et renvoie les compteurs (fichier JSON partagé, flock). */
function nsy_jstats_apply(string $file, string $slug, string $action): array
{
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return ['views' => 0, 'likes' => 0]; // stockage indisponible → ne pas casser la page
    }
    flock($fh, LOCK_EX);
    $d = json_decode((string)stream_get_contents($fh), true);
    if (!is_array($d)) $d = [];
    $e = ['views' => (int)($d[$slug]['views'] ?? 0), 'likes' => (int)($d[$slug]['likes'] ?? 0)];
    if ($action === 'view')   $e['views'] += 1;
    if ($action === 'like')   $e['likes'] += 1;
    if ($action === 'unlike') $e['likes'] = max(0, $e['likes'] - 1);
    if ($action !== 'get' && count($d) < 500) { // garde-fou : pas de fichier infini
        $d[$slug] = $e;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($d));
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $e;
}

// ───── Mode test : la fonction pure reste définie, le endpoint ne s'exécute pas ─────
if (defined('NSY_JSTATS_TEST')) { return; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    jstats_respond(['ok' => false, 'code' => 'method'], 405);
}

// Même origine uniquement (même logique que chat.php).
$srcHost = '';
foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
    if (!empty($_SERVER[$h])) { $srcHost = (string)parse_url((string)$_SERVER[$h], PHP_URL_HOST); break; }
}
if ($srcHost === '' || !in_array(strtolower($srcHost), ['www.nsy.fr', 'nsy.fr', 'localhost', '127.0.0.1'], true)) {
    jstats_respond(['ok' => false, 'code' => 'origin'], 403);
}

$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) {
    jstats_respond(['ok' => false, 'code' => 'payload'], 400);
}
$slug   = (string)($body['slug'] ?? '');
$action = (string)($body['action'] ?? 'get');

// Slug = une vraie page du site (pattern strict + existence sur disque).
if (!preg_match('/^[a-z0-9][a-z0-9-]{2,80}\.html$/', $slug) || !is_file(__DIR__ . '/' . $slug)) {
    jstats_respond(['ok' => false, 'code' => 'slug'], 400);
}
if (!in_array($action, ['get', 'view', 'like', 'unlike'], true)) {
    jstats_respond(['ok' => false, 'code' => 'action'], 400);
}

// Anti-abus : plafond journalier par IP (hachée) sur les écritures seulement.
if ($action !== 'get') {
    require_once __DIR__ . '/antispam.php';
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    if (nsy_over_daily_cap('jstats', $ip, 120)) {
        jstats_respond(['ok' => false, 'code' => 'ratelimit'], 429);
    }
}

$counts = nsy_jstats_apply(__DIR__ . '/_secret/journal-stats.json', $slug, $action);
jstats_respond(['ok' => true] + $counts);
