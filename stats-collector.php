<?php
/**
 * stats-collector.php — collecteur KPI quotidien de nsy.fr.
 *
 * Appelé chaque matin par une tâche planifiée Infomaniak :
 *   /stats-collector.php?key=<cron_key>&run=1            → collecte J-1
 *   /stats-collector.php?key=<cron_key>&run=1&date=YYYY-MM-DD → backfill d'un jour
 *
 * Sources :
 *   1. Access logs Infomaniak ($HOME/ik-logs/access.log*) — visites humaines,
 *      pages vues, robots IA (le KPI GEO), top pages, referrals, 404/scans.
 *      Les lignes sont FILTRÉES par la date cible (le nom des fichiers rotatés
 *      ne fait pas foi). AUCUNE donnée personnelle conservée : uniquement des
 *      agrégats (les IP servent au comptage d'uniques puis sont oubliées).
 *   2. API Graph Facebook — abonnés de la Page + engagement des derniers posts
 *      (jeton de PAGE dans _secret/kpi.php, jamais affiché).
 *   3. Compteurs du journal (_secret/journal-stats.json).
 *
 * Sortie : _secret/kpi-history.json (une entrée par jour, idempotent).
 * Le dashboard /stats/ (Basic Auth) lit cet historique via stats/data.php.
 */
declare(strict_types=1);
date_default_timezone_set('Europe/Paris');
ini_set('display_errors', '0'); // JSON propre — les erreurs vont au log PHP

$cfg = require __DIR__ . '/_secret/kpi.php';
if (!hash_equals((string) $cfg['cron_key'], (string) ($_GET['key'] ?? ''))) {
    http_response_code(404);
    exit;
}
if (($_GET['run'] ?? '') !== '1') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'run=1 attendu']);
    exit;
}
header('Content-Type: application/json; charset=utf-8');

$target = $_GET['date'] ?? date('Y-m-d', strtotime('yesterday'));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $target)) {
    echo json_encode(['ok' => false, 'error' => 'date invalide']);
    exit;
}
$targetLog = date('d/M/Y', strtotime($target)); // format des logs : 16/Aug/2026

// ── 1. Access logs ───────────────────────────────────────────────────────────
// Robots IA (GEO) — l'ordre = priorité du match.
$AI = [
    'ChatGPT-User'   => '/ChatGPT-User/i',
    'OAI-SearchBot'  => '/OAI-SearchBot/i',
    'GPTBot'         => '/GPTBot/i',
    'Claude'         => '/ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai/i',
    'Perplexity'     => '/Perplexity/i',
    'Mistral'        => '/MistralAI/i',
    'Gemini-Vertex'  => '/Google-CloudVertexBot/i',
    'CCBot'          => '/CCBot/i',
    'Bytespider'     => '/Bytespider/i',
    'Amazonbot'      => '/Amazonbot/i',
    'Meta-AI'        => '/meta-externalagent|FacebookBot/i',
    'Applebot'       => '/Applebot/i',
    'PetalBot'       => '/PetalBot/i',
    'YouBot'         => '/YouBot/i',
];
$SE_RE   = '/Googlebot|bingbot|msnbot|YandexBot|Baiduspider|DuckDuckBot|Qwantbot|Applebot(?!.*Extended)/i';
$BOT_RE  = '/bot|crawl|spider|slurp|scanner|scan|python|curl|wget|go-http|aiohttp|httpx|libwww|okhttp|java\/|guzzle|facebookexternalhit|monitor|checker|probe|wp2shell|xploit|jetpack|feed|semrush|mj12|ahrefs|censys|netcraft|builtwith|barkrowler|dataprovider|client/i';
$SCAN_RE = '/wp2shell|vuln|xploit|security-auditor|censys|scanner|sqlmap|nuclei/i';

$stats = [
    'pageviews' => 0, 'uniques' => [], 'hits' => 0, 'status' => ['200' => 0, '301' => 0, '404' => 0, 'other' => 0],
    'ai' => [], 'ai_hits' => 0, 'se_hits' => 0, 'bot_hits' => 0, 'scan_hits' => 0,
    'pages' => [], 'referrals' => ['facebook' => 0, 'linkedin' => 0, 'google' => 0, 'bing' => 0, 'autres' => 0],
    'llms_hits' => 0, 'chat_calls' => 0,
];
$logDir = (getenv('HOME') ?: dirname(__DIR__)) . '/ik-logs';
$files = array_merge(glob("$logDir/access.log") ?: [], glob("$logDir/access.log-*") ?: []);
// Infomaniak préfixe chaque ligne par le vhost (« nsy.fr IP - - [... ») — préfixe optionnel.
$re = '#^(?:[a-z0-9.-]+ )?(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"#';
$parsedFiles = 0;

foreach ($files as $f) {
    // ne lire que les fichiers susceptibles de contenir la date cible (mtime ± 3 j)
    if (abs(filemtime($f) - strtotime($target)) > 3 * 86400 + 86399) continue;
    $h = str_ends_with($f, '.gz') ? gzopen($f, 'rb') : fopen($f, 'rb');
    if (!$h) continue;
    $parsedFiles++;
    $read = str_ends_with($f, '.gz') ? 'gzgets' : 'fgets';
    while (($line = $read($h)) !== false) {
        if (!str_contains($line, $targetLog)) continue;
        if (!preg_match($re, $line, $m)) continue;
        [, $ip, , $method, $path, $status, $ref, $ua] = $m;
        $stats['hits']++;
        $sKey = in_array($status, ['200', '301', '404'], true) ? $status : 'other';
        $stats['status'][$sKey]++;

        $isAI = false;
        foreach ($AI as $name => $rx) {
            if (preg_match($rx, $ua)) {
                $stats['ai'][$name] = ($stats['ai'][$name] ?? 0) + 1;
                $stats['ai_hits']++;
                $isAI = true;
                break;
            }
        }
        if (preg_match($SCAN_RE, $ua)) $stats['scan_hits']++;
        if (str_starts_with($path, '/llms')) $stats['llms_hits']++;
        if (str_starts_with($path, '/chat.php') && $method === 'POST') $stats['chat_calls']++;
        if ($isAI) continue;
        if (preg_match($SE_RE, $ua)) { $stats['se_hits']++; continue; }
        if ($ua === '' || $ua === '-' || preg_match($BOT_RE, $ua)) { $stats['bot_hits']++; continue; }

        // humain (approximation) : page HTML servie
        $clean = strtok($path, '?') ?: $path;
        $isPage = $clean === '/' || str_ends_with($clean, '.html');
        if ($isPage && in_array($status, ['200', '304'], true) && $method === 'GET') {
            $stats['pageviews']++;
            $stats['uniques'][substr(md5($ip . '|' . $ua), 0, 12)] = 1;
            $stats['pages'][$clean] = ($stats['pages'][$clean] ?? 0) + 1;
            $rh = strtolower((string) parse_url($ref, PHP_URL_HOST));
            if ($rh !== '' && !str_contains($rh, 'nsy.fr') && !str_contains($rh, 'new-software-yard')) {
                if (str_contains($rh, 'facebook') || str_contains($rh, 'fb.'))      $stats['referrals']['facebook']++;
                elseif (str_contains($rh, 'linkedin') || $rh === 'lnkd.in')          $stats['referrals']['linkedin']++;
                elseif (str_contains($rh, 'google'))                                 $stats['referrals']['google']++;
                elseif (str_contains($rh, 'bing'))                                   $stats['referrals']['bing']++;
                else                                                                 $stats['referrals']['autres']++;
            }
        }
    }
    is_resource($h) ? (str_ends_with($f, '.gz') ? gzclose($h) : fclose($h)) : null;
}
arsort($stats['pages']);
arsort($stats['ai']);
$day = [
    'visiteurs'   => count($stats['uniques']),
    'pages_vues'  => $stats['pageviews'],
    'hits'        => $stats['hits'],
    'ai'          => $stats['ai'],
    'ai_hits'     => $stats['ai_hits'],
    'se_hits'     => $stats['se_hits'],
    'bot_hits'    => $stats['bot_hits'],
    'scan_hits'   => $stats['scan_hits'],
    'llms_hits'   => $stats['llms_hits'],
    'chat_calls'  => $stats['chat_calls'],
    'top_pages'   => array_slice($stats['pages'], 0, 10, true),
    'referrals'   => $stats['referrals'],
    'status'      => $stats['status'],
    'log_files'   => $parsedFiles,
];

// ── 2. Facebook (API Graph) — état du JOUR de collecte ───────────────────────
function graphGet(string $path, string $token, array $params = []): array {
    $params['access_token'] = $token;
    $url = 'https://graph.facebook.com/v21.0/' . $path . '?' . http_build_query($params);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5]);
    $raw = curl_exec($ch);
    $j = is_string($raw) ? json_decode($raw, true) : null;
    return is_array($j) && !isset($j['error']) ? $j : [];
}
$fb = ['abonnes' => null, 'posts' => []];
$tok = (string) $cfg['fb_page_token'];
if ($tok !== '' && !str_starts_with($tok, 'CHANGE_ME')) {
    $page = graphGet((string) $cfg['fb_page_id'], $tok, ['fields' => 'fan_count,followers_count']);
    $fb['abonnes'] = $page['followers_count'] ?? $page['fan_count'] ?? null;
    $posts = graphGet($cfg['fb_page_id'] . '/posts', $tok,
        ['fields' => 'created_time,permalink_url,likes.summary(true),comments.summary(true),shares', 'limit' => '5']);
    foreach ($posts['data'] ?? [] as $p) {
        $fb['posts'][] = [
            'date'     => substr((string) ($p['created_time'] ?? ''), 0, 10),
            'url'      => $p['permalink_url'] ?? '',
            'likes'    => $p['likes']['summary']['total_count'] ?? 0,
            'comments' => $p['comments']['summary']['total_count'] ?? 0,
            'shares'   => $p['shares']['count'] ?? 0,
        ];
    }
}

// ── 3. Compteurs du journal ──────────────────────────────────────────────────
$journal = [];
$js = @json_decode((string) @file_get_contents(__DIR__ . '/_secret/journal-stats.json'), true);
foreach (is_array($js) ? $js : [] as $slug => $v) {
    if (is_array($v)) $journal[$slug] = ['vues' => $v['views'] ?? 0, 'likes' => $v['likes'] ?? 0];
}

// ── Historisation (idempotente, avec verrou) ─────────────────────────────────
$histFile = __DIR__ . '/_secret/kpi-history.json';
$fh = fopen($histFile, 'c+');
flock($fh, LOCK_EX);
$hist = json_decode((string) stream_get_contents($fh), true);
if (!is_array($hist)) $hist = ['site' => 'nsy.fr', 'days' => []];
$hist['days'][$target] = $day + ['fb' => $fb, 'journal' => $journal, 'collecte' => date('c')];
ksort($hist['days']);
if (count($hist['days']) > 400) $hist['days'] = array_slice($hist['days'], -400, null, true);
ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($hist, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
flock($fh, LOCK_UN);
fclose($fh);

echo json_encode(['ok' => true, 'date' => $target, 'visiteurs' => $day['visiteurs'],
    'pages_vues' => $day['pages_vues'], 'ai_hits' => $day['ai_hits'],
    'fb_abonnes' => $fb['abonnes'], 'jours_en_historique' => count($hist['days'])],
    JSON_UNESCAPED_UNICODE);
