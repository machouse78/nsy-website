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
// Assistants IA côté PROVENANCE (un humain a cliqué depuis une réponse).
// ⚠️ Ils se testent AVANT les moteurs : gemini.google.com contient « google »,
// copilot.microsoft.com renvoie vers Bing… Les jetons courts servent aussi à
// lire les utm_source (ChatGPT ajoute lui-même ?utm_source=chatgpt.com).
$IA_REF = [
    'ChatGPT'    => ['chatgpt', 'chat.openai.com', 'openai.com'],
    'Claude'     => ['claude.ai', 'anthropic'],
    'Perplexity' => ['perplexity'],
    'Gemini'     => ['gemini.google.com', 'bard.google.com', 'aistudio.google.com', 'gemini.com'],
    'Copilot'    => ['copilot.microsoft.com', 'bing.com/chat', 'copilot'],
    'Mistral'    => ['chat.mistral.ai', 'mistral.ai'],
    'Grok'       => ['grok.com', 'x.ai'],
    'DeepSeek'   => ['chat.deepseek.com', 'deepseek'],
    'Poe'        => ['poe.com'],
    'You.com'    => ['you.com'],
    'Phind'      => ['phind.com'],
];
$iaOf = static function (string $s) use ($IA_REF): ?string {
    foreach ($IA_REF as $nom => $jetons) foreach ($jetons as $j) if (str_contains($s, $j)) return $nom;
    return null;
};
$SE_RE   = '/Googlebot|bingbot|msnbot|YandexBot|Baiduspider|DuckDuckBot|Qwantbot|Applebot(?!.*Extended)/i';
$BOT_RE  = '/bot|crawl|spider|slurp|scanner|scan|python|curl|wget|go-http|aiohttp|httpx|libwww|okhttp|java\/|guzzle|facebookexternalhit|monitor|checker|probe|wp2shell|xploit|jetpack|feed|semrush|mj12|ahrefs|censys|netcraft|builtwith|barkrowler|dataprovider|client/i';
$SCAN_RE = '/wp2shell|vuln|xploit|security-auditor|censys|scanner|sqlmap|nuclei/i';

$stats = [
    'pageviews' => 0, 'uniques' => [], 'hits' => 0, 'status' => ['200' => 0, '301' => 0, '404' => 0, 'other' => 0],
    'ai' => [], 'ai_hits' => 0, 'se_hits' => 0, 'bot_hits' => 0, 'scan_hits' => 0,
    'pages' => [], 'referrals' => ['ia' => 0, 'facebook' => 0, 'linkedin' => 0, 'google' => 0, 'bing' => 0, 'autres' => 0],
    'ref_ia' => [], // détail par assistant (ChatGPT, Claude, Perplexity…) — provenance GEO
    'ia_pages' => [], // assistant => page d'atterrissage => n (LA page que l'IA a citée)
    'campagnes' => [], // UTM : source/medium/campagne — le SEUL moyen de savoir de quel
                       // groupe ou post vient un clic (Facebook ne transmet que l'origine)
    'fbclid' => 0,     // clic Facebook confirmé même sans referer (app mobile)
    'llms_hits' => 0, 'chat_calls' => 0,
    // Profils (agrégats depuis le UA) + provenance détaillée + parcours par session.
    'devices' => ['mobile' => 0, 'desktop' => 0, 'tablette' => 0],
    'os' => [], 'browsers' => [], 'ref_hosts' => [],
    'visites' => [], // hash éphémère => visite EN COURS ['first','last','pages'[]] — JETÉ après agrégation
    'sessions' => [], // visites closes (coupure d'inactivité) — même sort
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
            $vh = substr(md5($ip . '|' . $ua), 0, 12); // ≠ $h (handle de fichier de la boucle !)
            $stats['uniques'][$vh] = 1;
            $stats['pages'][$clean] = ($stats['pages'][$clean] ?? 0) + 1;

            // Campagnes UTM + fbclid (query de l'URL demandée)
            $qs = parse_url($path, PHP_URL_QUERY);
            $fbclid = false;
            $utmIa = null;
            if ($qs) {
                parse_str($qs, $q);
                $fbclid = isset($q['fbclid']);
                if (!empty($q['utm_source'])) {
                    $utmIa = $iaOf(strtolower((string) $q['utm_source']));
                    $clean3 = static fn($x) => mb_substr(preg_replace('/[^\w\-. ]/u', '', (string) $x), 0, 40) ?: '-';
                    $camp = $clean3($q['utm_source']) . ' / ' . $clean3($q['utm_medium'] ?? '-') . ' / ' . $clean3($q['utm_campaign'] ?? '-');
                    $stats['campagnes'][$camp] = ($stats['campagnes'][$camp] ?? 0) + 1;
                }
                if ($fbclid) $stats['fbclid']++;
            }

            // Profil (familles uniquement — aucune donnée individuelle conservée)
            if (preg_match('/iPad|Tablet/i', $ua))                    $stats['devices']['tablette']++;
            elseif (preg_match('/Mobile|iPhone|Android/i', $ua))       $stats['devices']['mobile']++;
            else                                                       $stats['devices']['desktop']++;
            $os = preg_match('/iPhone|iPad|iOS/i', $ua) ? 'iOS'
                : (preg_match('/Android/i', $ua) ? 'Android'
                : (preg_match('/Windows/i', $ua) ? 'Windows'
                : (preg_match('/Macintosh|Mac OS/i', $ua) ? 'macOS'
                : (preg_match('/Linux/i', $ua) ? 'Linux' : 'autre'))));
            $stats['os'][$os] = ($stats['os'][$os] ?? 0) + 1;
            $br = preg_match('/Edg/i', $ua) ? 'Edge'
                : (preg_match('/OPR|Opera/i', $ua) ? 'Opera'
                : (preg_match('/SamsungBrowser/i', $ua) ? 'Samsung'
                : (preg_match('/Firefox|FxiOS/i', $ua) ? 'Firefox'
                : (preg_match('/Chrome|CriOS/i', $ua) ? 'Chrome'
                : (preg_match('/Safari/i', $ua) ? 'Safari'
                : (preg_match('/LinkedInApp/i', $ua) ? 'App LinkedIn'
                : (preg_match('/FBAN|FBAV|FB_IAB/i', $ua) ? 'App Facebook'
                : (preg_match('/Instagram/i', $ua) ? 'App Instagram' : 'autre'))))))));
            $stats['browsers'][$br] = ($stats['browsers'][$br] ?? 0) + 1;

            // Parcours : horodatage + séquence de pages par visite (hash éphémère).
            // 30 min d'inactivité = NOUVELLE visite — sinon un retour le soir sur
            // la même machine donnerait une « visite » de plusieurs heures.
            $dt = DateTime::createFromFormat('d/M/Y:H:i:s O', $m[2]);
            $ts = $dt ? $dt->getTimestamp() : 0;
            if (!isset($stats['visites'][$vh])) {
                $stats['visites'][$vh] = ['first' => $ts, 'last' => $ts, 'pages' => []];
            } elseif ($ts - $stats['visites'][$vh]['last'] > 1800) {
                $stats['sessions'][] = $stats['visites'][$vh];
                $stats['visites'][$vh] = ['first' => $ts, 'last' => $ts, 'pages' => []];
            }
            $stats['visites'][$vh]['last'] = max($stats['visites'][$vh]['last'], $ts);
            $prev = end($stats['visites'][$vh]['pages']);
            if ($prev !== $clean) $stats['visites'][$vh]['pages'][] = $clean;
            $rh = strtolower((string) parse_url($ref, PHP_URL_HOST));
            $externe = $rh !== '' && !str_contains($rh, 'nsy.fr') && !str_contains($rh, 'new-software-yard');
            if ($externe) $stats['ref_hosts'][$rh] = ($stats['ref_hosts'][$rh] ?? 0) + 1;
            // Provenance IA par le referer, à défaut par l'utm_source : ChatGPT
            // estampille ses liens (?utm_source=chatgpt.com), ce qui rattrape les
            // clics où le navigateur ne transmet aucun referer.
            $ia = $externe ? $iaOf($rh) : null;
            if ($ia === null) $ia = $utmIa;
            if ($ia !== null) {
                $stats['referrals']['ia']++;
                $stats['ref_ia'][$ia] = ($stats['ref_ia'][$ia] ?? 0) + 1;
                // Page d'atterrissage = la page CITÉE dans la réponse de l'assistant.
                $stats['ia_pages'][$ia][$clean] = ($stats['ia_pages'][$ia][$clean] ?? 0) + 1;
                // Marquage de la visite : son parcours sera comparé à la moyenne du site.
                if (empty($stats['visites'][$vh]['ia'])) $stats['visites'][$vh]['ia'] = $ia;
            }
            elseif ($rh === '' && $fbclid)                                       $stats['referrals']['facebook']++; // app FB : referer vide
            elseif ($externe) {
                if (str_contains($rh, 'facebook') || str_contains($rh, 'fb.'))   $stats['referrals']['facebook']++;
                elseif (str_contains($rh, 'linkedin') || $rh === 'lnkd.in')      $stats['referrals']['linkedin']++;
                elseif (str_contains($rh, 'google'))                             $stats['referrals']['google']++;
                elseif (str_contains($rh, 'bing'))                               $stats['referrals']['bing']++;
                else                                                             $stats['referrals']['autres']++;
            }
        }
    }
    is_resource($h) ? (str_ends_with($f, '.gz') ? gzclose($h) : fclose($h)) : null;
}
arsort($stats['pages']);
arsort($stats['ai']);
arsort($stats['os']);
arsort($stats['browsers']);
arsort($stats['ref_hosts']);
arsort($stats['ref_ia']);
arsort($stats['campagnes']);

// Parcours agrégés — puis la table des sessions est jetée.
$entrees = []; $sorties = []; $transitions = []; $pv = ['1' => 0, '2_3' => 0, '4p' => 0];
$durees = []; $sessions = 0; $pagesTot = 0;
// Sous-population « arrivée depuis une réponse d'IA » : mêmes agrégats, pour comparer.
$iaS = ['visites' => 0, 'pages' => 0, 'une_page' => 0, 'durees' => [], 'par_ia' => [], 'entrees' => []];
foreach (array_merge($stats['sessions'], array_values($stats['visites'])) as $v) {
    $p = $v['pages'];
    if (!$p) continue;
    $entrees[$p[0]] = ($entrees[$p[0]] ?? 0) + 1;
    $sorties[end($p)] = ($sorties[end($p)] ?? 0) + 1;
    $n = count($p);
    $sessions++; $pagesTot += $n;
    $pv[$n === 1 ? '1' : ($n <= 3 ? '2_3' : '4p')]++;
    for ($i = 1; $i < $n; $i++) {
        $t = $p[$i - 1] . ' → ' . $p[$i];
        $transitions[$t] = ($transitions[$t] ?? 0) + 1;
    }
    $duree = ($n > 1 && $v['last'] > $v['first']) ? $v['last'] - $v['first'] : null;
    if ($duree !== null) $durees[] = $duree;
    if (!empty($v['ia'])) {
        $iaS['visites']++;
        $iaS['pages'] += $n;
        if ($n === 1) $iaS['une_page']++;
        if ($duree !== null) $iaS['durees'][] = $duree;
        $iaS['par_ia'][$v['ia']] = ($iaS['par_ia'][$v['ia']] ?? 0) + 1;
        $iaS['entrees'][$p[0]] = ($iaS['entrees'][$p[0]] ?? 0) + 1;
    }
}
arsort($entrees); arsort($sorties); arsort($transitions);
arsort($iaS['par_ia']); arsort($iaS['entrees']);
$parcours = [
    'entrees'      => array_slice($entrees, 0, 10, true),
    'sorties'      => array_slice($sorties, 0, 10, true),
    'transitions'  => array_slice($transitions, 0, 10, true),
    'pages_visite' => $pv,
    'visites'      => $sessions,
    'pages'        => $pagesTot,
    'duree_moy_s'  => $durees ? (int) round(array_sum($durees) / count($durees)) : 0,
    'duree_n'      => count($durees),
    'duree_tot_s'  => array_sum($durees),
];
// Parcours des visiteurs VENUS D'UNE IA — le « et après ? » du KPI GEO : la même
// grille que le site entier, pour dire si ce trafic vaut mieux (ou moins) que la moyenne.
$ia_parcours = [
    'visites'     => $iaS['visites'],
    'pages'       => $iaS['pages'],
    'une_page'    => $iaS['une_page'],
    'par_ia'      => $iaS['par_ia'],
    'entrees'     => array_slice($iaS['entrees'], 0, 10, true),
    'duree_n'     => count($iaS['durees']),
    'duree_tot_s' => array_sum($iaS['durees']),
    'duree_moy_s' => $iaS['durees'] ? (int) round(array_sum($iaS['durees']) / count($iaS['durees'])) : 0,
];

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
    'top_pages'   => array_slice($stats['pages'], 0, 25, true),
    'referrals'   => $stats['referrals'],
    'ref_hosts'   => array_slice($stats['ref_hosts'], 0, 10, true),
    'ref_ia'      => $stats['ref_ia'],
    'ia_pages'    => $stats['ia_pages'],
    'ia_parcours' => $ia_parcours,
    'campagnes'   => array_slice($stats['campagnes'], 0, 15, true),
    'fbclid'      => $stats['fbclid'],
    'devices'     => $stats['devices'],
    'os'          => array_slice($stats['os'], 0, 6, true),
    'browsers'    => array_slice($stats['browsers'], 0, 8, true),
    'parcours'    => $parcours,
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
        ['fields' => 'id,created_time,permalink_url,likes.summary(true),comments.summary(true),shares', 'limit' => '5']);
    foreach ($posts['data'] ?? [] as $p) {
        // Repartages VISIBLES du post (publics uniquement — Meta masque par design
        // les partages privés et ceux des groupes fermés ; « shares » reste le total).
        $reshares = [];
        if (!empty($p['id'])) {
            $sp = graphGet($p['id'] . '/sharedposts', $tok, ['fields' => 'from{name},permalink_url', 'limit' => '25']);
            foreach ($sp['data'] ?? [] as $r) {
                $reshares[] = ['nom' => $r['from']['name'] ?? '(profil privé)', 'url' => $r['permalink_url'] ?? ''];
            }
        }
        $fb['posts'][] = [
            'date'     => substr((string) ($p['created_time'] ?? ''), 0, 10),
            'url'      => $p['permalink_url'] ?? '',
            'likes'    => $p['likes']['summary']['total_count'] ?? 0,
            'comments' => $p['comments']['summary']['total_count'] ?? 0,
            'shares'   => $p['shares']['count'] ?? 0,
            'reshares' => $reshares,
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
// Garde-fou de rattrapage : une date SANS AUCUNE ligne de log ne s'écrit jamais.
// Passé la rétention de l'hébergeur (~1 mois), relancer une date ancienne ne
// trouve plus rien — sans ce test, un jour riche retomberait à zéro et un jour
// hors rétention entrerait vide dans l'historique.
if (($day['hits'] ?? 0) === 0) {
    flock($fh, LOCK_UN);
    fclose($fh);
    echo json_encode(['ok' => true, 'date' => $target, 'conserve' => true,
        'motif' => 'aucune ligne de log pour cette date (rétention hébergeur) — historique inchangé'],
        JSON_UNESCAPED_UNICODE);
    exit;
}
$hist['days'][$target] = $day + ['fb' => $fb, 'journal' => $journal, 'source' => 'logs', 'collecte' => date('c')];
ksort($hist['days']);
// Historique ILLIMITÉ (owner, 17/08/2026) : aucune purge — l'archive court depuis la V1 du site.
ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($hist, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
flock($fh, LOCK_UN);
fclose($fh);

echo json_encode(['ok' => true, 'date' => $target, 'visiteurs' => $day['visiteurs'],
    'pages_vues' => $day['pages_vues'], 'ai_hits' => $day['ai_hits'],
    'fb_abonnes' => $fb['abonnes'], 'jours_en_historique' => count($hist['days'])],
    JSON_UNESCAPED_UNICODE);
