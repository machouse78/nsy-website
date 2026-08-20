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
 *   4. Trafic du dépôt GitHub public et chaîne YouTube (clés dans _secret/kpi.php,
 *      les deux facultatives : absentes, la rubrique disparaît du dashboard).
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
    // Agent conversationnel : le détail, pas juste un compteur d'appels.
    'chat' => ['messages' => 0, 'health' => 0, 'ratelimit' => 0, 'erreurs' => 0,
               'visiteurs' => [], 'pages' => []],
    // Périmètres : un même domaine peut héberger plusieurs applications
    // (PRV : vitrine + forum phpBB + boutique WooCommerce). Compté pour TOUTES
    // les lignes, robots compris — savoir ce que les IA lisent vraiment.
    'peri' => [],
    // Profils (agrégats depuis le UA) + provenance détaillée + parcours par session.
    'devices' => ['mobile' => 0, 'desktop' => 0, 'tablette' => 0],
    'os' => [], 'browsers' => [], 'ref_hosts' => [],
    'visites' => [], // hash éphémère => visite EN COURS ['first','last','pages'[]] — JETÉ après agrégation
    'sessions' => [], // visites closes (coupure d'inactivité) — même sort
];
// Périmètres : nsy.fr n'héberge qu'une application — tout est « site ».
$PERI_DEFAUT = 'site';
$PERIMETRES = [];
$JOURNAL_URL = static fn(string $slug): string => 'https://www.nsy.fr/' . $slug;
$logDir = (getenv('HOME') ?: dirname(__DIR__)) . '/ik-logs';
$files = array_merge(glob("$logDir/access.log") ?: [], glob("$logDir/access.log-*") ?: []);
// Infomaniak préfixe chaque ligne par le vhost (« nsy.fr IP - - [... ») — préfixe optionnel.
// La TAILLE de réponse est capturée : elle sert à reconnaître les sondes de
// disponibilité du chatbot dans l'historique d'avant le marqueur explicite.
$re = '#^(?:[a-z0-9.-]+ )?(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\S+) "([^"]*)" "([^"]*)"#';
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
        [, $ip, , $method, $path, $status, $size, $ref, $ua] = $m;
        $stats['hits']++;
        $clean = strtok($path, '?') ?: $path;
        // Périmètre + définition de « page vue » PROPRE À CHAQUE APPLICATION :
        // une page de forum est un .php, une fiche boutique une URL jolie.
        $peri = $PERI_DEFAUT;
        $isPage = $clean === '/' || str_ends_with($clean, '.html');
        foreach ($PERIMETRES as $nom => $rg) {
            if (!str_starts_with($clean, $rg['prefixe'])) continue;
            $peri = $nom;
            $isPage = (bool) preg_match($rg['page'], $clean)
                && !($rg['exclure'] !== '' && preg_match($rg['exclure'], $clean));
            break;
        }
        if (!isset($stats['peri'][$peri])) {
            $stats['peri'][$peri] = ['hits' => 0, 'ai_hits' => 0, 'pages_vues' => 0, 'visiteurs' => [], 'top' => []];
        }
        $stats['peri'][$peri]['hits']++;
        $sKey = in_array($status, ['200', '301', '404'], true) ? $status : 'other';
        $stats['status'][$sKey]++;

        $isAI = false;
        foreach ($AI as $name => $rx) {
            if (preg_match($rx, $ua)) {
                $stats['ai'][$name] = ($stats['ai'][$name] ?? 0) + 1;
                $stats['ai_hits']++;
                $stats['peri'][$peri]['ai_hits']++;
                $isAI = true;
                break;
            }
        }
        if (preg_match($SCAN_RE, $ua)) $stats['scan_hits']++;
        if (str_starts_with($path, '/llms')) $stats['llms_hits']++;
        // Agent conversationnel. ⚠️ Le voyant de disponibilité tape le MÊME
        // endpoint : sans marqueur (`?h=1` en POST, `?ping=1` en GET) ses
        // sondes seraient comptées comme des conversations.
        if (str_starts_with($clean, '/chat.php')) {
            $q0 = (string) parse_url($path, PHP_URL_QUERY);
            // Marqueur explicite (widgets à jour) OU réponse minuscule : le
            // voyant renvoie ~60 octets là où une vraie réponse en fait des
            // centaines — c'est ce qui rend l'historique antérieur exploitable.
            $sonde = str_contains($q0, 'h=1') || str_contains($q0, 'ping=1')
                || (ctype_digit($size) && (int) $size < 150);
            if ($sonde) {
                $stats['chat']['health']++;
            } elseif ($method === 'POST') {
                if ($status === '429')            $stats['chat']['ratelimit']++;
                elseif ((int) $status >= 500)     $stats['chat']['erreurs']++;
                else {
                    $stats['chat']['messages']++;
                    $stats['chat_calls']++;
                    $stats['chat']['visiteurs'][substr(md5($ip . '|' . $ua), 0, 12)] = 1;
                    $rp = (string) parse_url($ref, PHP_URL_PATH);
                    if ($rp !== '') $stats['chat']['pages'][$rp] = ($stats['chat']['pages'][$rp] ?? 0) + 1;
                }
            }
        }
        if ($isAI) continue;
        if (preg_match($SE_RE, $ua)) { $stats['se_hits']++; continue; }
        if ($ua === '' || $ua === '-' || preg_match($BOT_RE, $ua)) { $stats['bot_hits']++; continue; }

        // humain (approximation) : page servie ($clean / $isPage : voir périmètres)
        if ($isPage && in_array($status, ['200', '304'], true) && $method === 'GET') {
            $vh = substr(md5($ip . '|' . $ua), 0, 12); // ≠ $h (handle de fichier de la boucle !)
            $stats['peri'][$peri]['pages_vues']++;
            $stats['peri'][$peri]['visiteurs'][$vh] = 1;
            $stats['peri'][$peri]['top'][$clean] = ($stats['peri'][$peri]['top'][$clean] ?? 0) + 1;
            // Les compteurs GLOBAUX restent ceux du périmètre principal : sinon le
            // forum (10× la vitrine) écraserait toutes les courbes et couperait la
            // comparaison avec l'historique. Les autres périmètres se lisent au filtre.
            if ($peri !== $PERI_DEFAUT) continue;
            $stats['pageviews']++;
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

// Périmètres : on ne garde que des agrégats (les tables de hash sont jetées).
$perimetres = [];
foreach ($stats['peri'] as $nom => $p) {
    arsort($p['top']);
    $perimetres[$nom] = [
        'hits'       => $p['hits'],
        'ai_hits'    => $p['ai_hits'],
        'pages_vues' => $p['pages_vues'],
        'visiteurs'  => count($p['visiteurs']),
        'top_pages'  => array_slice($p['top'], 0, 12, true),
    ];
}
arsort($stats['chat']['pages']);

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
    'chat'        => [
        'messages'      => $stats['chat']['messages'],
        'conversations' => count($stats['chat']['visiteurs']),
        'health'        => $stats['chat']['health'],
        'ratelimit'     => $stats['chat']['ratelimit'],
        'erreurs'       => $stats['chat']['erreurs'],
        'pages'         => array_slice($stats['chat']['pages'], 0, 10, true),
    ],
    'perimetres'  => $perimetres,
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
$fb = ['abonnes' => null, 'posts' => [], 'vues' => null, 'engagements' => null,
       'nouveaux_abonnes' => null, 'vues_video' => null, 'reactions' => null, 'actions' => null];
$tok = (string) $cfg['fb_page_token'];
if ($tok !== '' && !str_starts_with($tok, 'CHANGE_ME')) {
    // ⚠️ overall_star_rating et rating_count doivent être DEMANDÉS ici : sans
    // eux, la rubrique Avis lisait un champ absent et affichait « — » alors que
    // la Page était bien notée (vécu 20/08/2026).
    $page = graphGet((string) $cfg['fb_page_id'], $tok,
        ['fields' => 'fan_count,followers_count,overall_star_rating,rating_count']);
    $fb['abonnes'] = $page['followers_count'] ?? $page['fan_count'] ?? null;

    // ── Statistiques de la Page (API Insights) ───────────────────────────────
    // Ce que Meta expose ENCORE en v21 : page_impressions, page_fans et
    // page_engaged_users sont refusées (« must be a valid insights metric »).
    // ⚠️ Deux conventions à connaître avant d'interpréter ces chiffres :
    //  1. une valeur porte l'horodatage de FIN de sa journée — la journée du 15
    //     est celle dont end_time vaut le 16 ;
    //  2. la journée est découpée sur le FUSEAU DE LA PAGE (07:00 UTC observé,
    //     pas minuit à Paris) : ces chiffres sont décalés de quelques heures et
    //     ne se comparent donc pas au visiteur près avec les logs du site.
    $METRIQUES = [
        'page_views_total'                  => 'vues',
        'page_post_engagements'             => 'engagements',
        'page_daily_follows_unique'         => 'nouveaux_abonnes',
        'page_video_views'                  => 'vues_video',
        'page_total_actions'                => 'actions',
        'page_actions_post_reactions_total' => 'reactions',
    ];
    $ins = graphGet($cfg['fb_page_id'] . '/insights', $tok, [
        'metric' => implode(',', array_keys($METRIQUES)),
        'period' => 'day',
        'since'  => $target,
        'until'  => date('Y-m-d', strtotime($target . ' +2 days')),
    ]);
    $finJour = date('Y-m-d', strtotime($target . ' +1 day'));
    foreach ($ins['data'] ?? [] as $m) {
        $cle = $METRIQUES[$m['name']] ?? null;
        if ($cle === null) continue;
        foreach ($m['values'] ?? [] as $v) {
            if (substr((string) ($v['end_time'] ?? ''), 0, 10) !== $finJour) continue;
            $val = $v['value'] ?? 0;
            $fb[$cle] = (int) (is_array($val) ? array_sum($val) : $val);
        }
    }
    $posts = graphGet($cfg['fb_page_id'] . '/posts', $tok,
        ['fields' => 'id,created_time,permalink_url,message,likes.summary(true),comments.summary(true),shares', 'limit' => '10']);
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
        // Lecture de CETTE publication. ⚠️ Meta a retiré post_impressions et
        // post_engaged_users en v21 : la « lecture » d'un post se lit désormais
        // par ses vues vidéo (le format est justement la vidéo) et ses clics.
        // Ces valeurs sont CUMULÉES depuis la publication, pas journalières :
        // la courbe se construit par les collectes successives, un rattrapage
        // écrirait la valeur d'aujourd'hui sur une date passée.
        $pi = [];
        if (!empty($p['id'])) {
            $r = graphGet($p['id'] . '/insights', $tok,
                ['metric' => 'post_clicks,post_video_views,post_reactions_by_type_total']);
            // ⚠️ Meta renvoie parfois DEUX entrées portant le même nom de
            // métrique — vécu : post_video_views à 92 puis à 0 dans la même
            // réponse. Garder la plus grande, sinon la seconde écrase la vraie.
            foreach ($r['data'] ?? [] as $m) {
                $v = $m['values'][0]['value'] ?? 0;
                $v = (int) (is_array($v) ? array_sum($v) : $v);
                $pi[$m['name']] = max($pi[$m['name']] ?? 0, $v);
            }
        }
        $txt = trim(preg_replace('/\s+/u', ' ', (string) ($p['message'] ?? '')));
        $fb['posts'][] = [
            'id'         => $p['id'] ?? '',
            'date'       => substr((string) ($p['created_time'] ?? ''), 0, 10),
            'url'        => $p['permalink_url'] ?? '',
            'titre'      => $txt === '' ? '' : mb_substr($txt, 0, 70),
            'likes'      => $p['likes']['summary']['total_count'] ?? 0,
            'comments'   => $p['comments']['summary']['total_count'] ?? 0,
            'shares'     => $p['shares']['count'] ?? 0,
            'vues_video' => $pi['post_video_views'] ?? 0,
            'clics'      => $pi['post_clicks'] ?? 0,
            'reactions'  => $pi['post_reactions_by_type_total'] ?? 0,
            'reshares'   => $reshares,
        ];
    }
}

// ── 2 bis. Avis clients, par source ──────────────────────────────────────────
// Une seule source est collectable sans frais ni démarche : les recommandations
// de la Page Facebook (le jeton de Page suffit). Les autres sont DÉCLARÉES dans
// _secret/kpi.php et affichées comme non collectées — mieux vaut une ligne
// honnête « pas d'API » qu'un zéro qu'on lirait comme « aucun avis ».
//   · Google : l'API Business Profile impose une demande d'accès à valider par
//     Google puis un parcours OAuth ; l'API Places, elle, exige la facturation.
//   · PagesJaunes et Bing Places n'exposent rien de public.
// ⚠️ AUCUNE donnée nominative : on ne demande ni l'auteur ni le texte, seulement
// created_time et recommendation_type. L'historique reste agrégé, comme le reste.
$avis = [];
foreach ((array) ($cfg['avis_sources'] ?? []) as $nom => $s) {
    $avis[$nom] = [
        'note'      => null,   // null = non collecté (≠ 0, qui serait une note)
        'nombre'    => null,
        'positifs'  => null,
        'profil'    => (string) ($s['profil'] ?? ''),
        'deposer'   => (string) ($s['deposer'] ?? ''),
    ];
}
if (isset($tok) && $tok !== '' && !str_starts_with($tok, 'CHANGE_ME')) {
    $note = $page['overall_star_rating'] ?? null;
    $fbAvis = ['note' => $note > 0 ? (float) $note : null, 'nombre' => 0, 'positifs' => 0,
               'profil' => (string) ($cfg['avis_sources']['Facebook']['profil'] ?? ''),
               'deposer' => (string) ($cfg['avis_sources']['Facebook']['deposer'] ?? '')];
    $r = graphGet($cfg['fb_page_id'] . '/ratings', $tok,
        ['fields' => 'created_time,recommendation_type', 'limit' => '100']);
    foreach ($r['data'] ?? [] as $a) {
        $fbAvis['nombre']++;
        if (($a['recommendation_type'] ?? '') === 'positive') $fbAvis['positifs']++;
    }
    $avis['Facebook'] = $fbAvis;
}

// ── 3. Compteurs du journal ──────────────────────────────────────────────────
// ⚠️ Les deux sites ne stockent PAS la même chose : nsy.fr écrit
// {"<slug>.html": {views, likes}} et sert l'article à la racine ; PRV écrit
// {"<slug>": {v, l}} et sert /journal/<slug>.html. On normalise ICI (vues,
// likes, url) pour que le dashboard, identique sur les deux sites, n'ait rien
// à deviner. Vécu : compteurs PRV affichés à zéro faute de cette tolérance.
$journal = [];
$js = @json_decode((string) @file_get_contents(__DIR__ . '/_secret/journal-stats.json'), true);
foreach (is_array($js) ? $js : [] as $slug => $v) {
    if (!is_array($v)) continue;
    $journal[$slug] = [
        'vues'  => (int) ($v['views'] ?? $v['v'] ?? 0),
        'likes' => (int) ($v['likes'] ?? $v['l'] ?? 0),
        'url'   => $JOURNAL_URL($slug),
    ];
}


// ── 3 bis. Trafic du dépôt GitHub (dépôt PUBLIC uniquement) ──────────────────
// GitHub ne conserve que 14 JOURS de statistiques de fréquentation : les
// historiser ici est le seul moyen d'avoir de la profondeur. L'API renvoie
// justement ces 14 jours détaillés, donc un rattrapage fonctionne sur cette
// fenêtre — au-delà, la donnée est définitivement perdue côté GitHub.
// Jeton : fine-grained, un seul dépôt, « Administration: Read-only » (vérifié).
$github = null;
$ghSerie = [];   // les 14 jours renvoyés par l'API, pour combler les trous
$ghTok = (string) ($cfg['github_token'] ?? '');
$ghRepo = (string) ($cfg['github_repo'] ?? '');
if ($ghTok !== '' && !str_starts_with($ghTok, 'CHANGE_ME') && $ghRepo !== '') {
    $ghGet = static function (string $chemin) use ($ghRepo, $ghTok) {
        $ch = curl_init("https://api.github.com/repos/$ghRepo/$chemin");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => ["Authorization: Bearer $ghTok", 'Accept: application/vnd.github+json',
                                   'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: nsy-kpi'],
        ]);
        $raw = curl_exec($ch);
        $j = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($j) ? $j : [];
    };
    $jourDe = static function (array $rep, string $cle, string $date): ?array {
        foreach ($rep[$cle] ?? [] as $e) {
            if (substr((string) ($e['timestamp'] ?? ''), 0, 10) === $date) return $e;
        }
        return null;
    };
    $vues = $ghGet('traffic/views');
    $clones = $ghGet('traffic/clones');
    // GitHub publie une journée avec un peu de retard : la collecte de J-1 la
    // trouve parfois absente, et passé 14 jours elle est perdue pour toujours.
    // On mémorise donc TOUTE la fenêtre pour reboucher l'historique plus bas.
    foreach ([['views', 'vues', 'visiteurs'], ['clones', 'clones', 'cloneurs']] as [$cle, $nb, $uniq]) {
        foreach (($cle === 'views' ? $vues : $clones)[$cle] ?? [] as $e) {
            $j = substr((string) ($e['timestamp'] ?? ''), 0, 10);
            if ($j === '') continue;
            $ghSerie[$j][$nb] = (int) ($e['count'] ?? 0);
            $ghSerie[$j][$uniq] = (int) ($e['uniques'] ?? 0);
        }
    }
    $ev = $jourDe($vues, 'views', $target);
    $ec = $jourDe($clones, 'clones', $target);
    if ($ev !== null || $ec !== null) {
        // Pages et référents sont des CUMULS sur 14 jours, pas des valeurs du
        // jour : on les garde comme instantané, le dashboard n'affiche que le
        // plus récent (même convention que les publications Facebook).
        $top = static function (array $l, string $cle, int $n = 5): array {
            $o = [];
            foreach (array_slice($l, 0, $n) as $e) {
                $o[] = ['nom' => (string) ($e[$cle] ?? ''), 'vues' => (int) ($e['count'] ?? 0),
                        'uniques' => (int) ($e['uniques'] ?? 0)];
            }
            return $o;
        };
        $github = [
            'vues'       => (int) ($ev['count'] ?? 0),
            'visiteurs'  => (int) ($ev['uniques'] ?? 0),
            'clones'     => (int) ($ec['count'] ?? 0),
            'cloneurs'   => (int) ($ec['uniques'] ?? 0),
            'pages'      => $top($ghGet('traffic/popular/paths'), 'path'),
            'referents'  => $top($ghGet('traffic/popular/referrers'), 'referrer'),
        ];
    }
}

// ── 3 ter. Chaîne YouTube (API Data v3, données PUBLIQUES) ───────────────────
// ⚠️ Nature de la donnée : l'API Data ne renvoie que des CUMULS depuis la
// création (abonnés, vues de la chaîne, vues de chaque vidéo) — jamais une
// valeur journalière. La courbe quotidienne se reconstitue donc côté dashboard
// par différence entre deux collectes. Conséquence directe : un RATTRAPAGE est
// interdit ici, il écrirait le cumul d'aujourd'hui sur une date passée et
// écraserait toutes les variations. D'où le garde-fou ci-dessous.
// Le vrai journalier existe (API YouTube Analytics) mais impose un parcours
// OAuth avec jeton à rafraîchir : disproportionné pour ces quelques chiffres.
// Coût : 3 unités par collecte sur un quota gratuit de 10 000 par jour.
$youtube = null;
$ytKey = (string) ($cfg['youtube_key'] ?? '');
$ytRecent = $target >= date('Y-m-d', strtotime('-2 days'));
if ($ytKey !== '' && !str_starts_with($ytKey, 'CHANGE_ME') && $ytRecent) {
    $ytGet = static function (string $ressource, array $params) use ($ytKey) {
        $params['key'] = $ytKey;
        $ch = curl_init('https://www.googleapis.com/youtube/v3/' . $ressource . '?' . http_build_query($params));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5]);
        $raw = curl_exec($ch);
        $j = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($j) && !isset($j['error']) ? $j : [];
    };
    // L'identifiant de chaîne est résolu depuis le handle (@nom) et RECOPIÉ dans
    // la config une fois connu — sinon on paierait la résolution à chaque fois.
    $ytId = (string) ($cfg['youtube_channel'] ?? '');
    $ytHandle = ltrim((string) ($cfg['youtube_handle'] ?? ''), '@');
    if ($ytId === '' && $ytHandle !== '') {
        $r = $ytGet('channels', ['part' => 'id', 'forHandle' => '@' . $ytHandle]);
        $ytId = (string) ($r['items'][0]['id'] ?? '');
    }
    if ($ytId !== '') {
        $ch = $ytGet('channels', ['part' => 'snippet,statistics,contentDetails', 'id' => $ytId]);
        $it = $ch['items'][0] ?? null;
        if ($it !== null) {
            $st = $it['statistics'] ?? [];
            $youtube = [
                'id'       => $ytId,
                'nom'      => (string) ($it['snippet']['title'] ?? ''),
                'url'      => 'https://www.youtube.com/' . ($ytHandle !== '' ? '@' . $ytHandle : 'channel/' . $ytId),
                // hiddenSubscriberCount : le compte d'abonnés peut être masqué par
                // le propriétaire — on distingue alors « masqué » (null) de « zéro ».
                'abonnes'  => empty($st['hiddenSubscriberCount']) && isset($st['subscriberCount'])
                    ? (int) $st['subscriberCount'] : null,
                'vues'     => (int) ($st['viewCount'] ?? 0),
                'videos'   => (int) ($st['videoCount'] ?? 0),
                'derniers' => [],
            ];
            $up = (string) ($it['contentDetails']['relatedPlaylists']['uploads'] ?? '');
            if ($up !== '') {
                $pl = $ytGet('playlistItems', ['part' => 'contentDetails', 'playlistId' => $up, 'maxResults' => '10']);
                $ids = [];
                foreach ($pl['items'] ?? [] as $p) {
                    $v = (string) ($p['contentDetails']['videoId'] ?? '');
                    if ($v !== '') $ids[] = $v;
                }
                if ($ids) {
                    $vd = $ytGet('videos', ['part' => 'snippet,statistics', 'id' => implode(',', $ids)]);
                    foreach ($vd['items'] ?? [] as $v) {
                        $vs = $v['statistics'] ?? [];
                        $youtube['derniers'][] = [
                            'id'            => (string) ($v['id'] ?? ''),
                            'date'          => substr((string) ($v['snippet']['publishedAt'] ?? ''), 0, 10),
                            'titre'         => mb_substr(trim((string) ($v['snippet']['title'] ?? '')), 0, 70),
                            'url'           => 'https://www.youtube.com/watch?v=' . ($v['id'] ?? ''),
                            'vues'          => (int) ($vs['viewCount'] ?? 0),
                            'likes'         => (int) ($vs['likeCount'] ?? 0),
                            'commentaires'  => (int) ($vs['commentCount'] ?? 0),
                        ];
                    }
                }
            }
        }
    }
}

// ── 3 quinquies. Favicons — contrôle QUOTIDIEN (skill `favicons`) ────────────
// Pourquoi ici : un favicon manquant ne casse rien, ne lève aucune erreur, et
// se découvre des semaines plus tard sous forme d'un globe générique dans
// Google. Il faut donc un contrôle régulier, et la seule tâche qui tourne tous
// les jours sur chaque site est ce collecteur.
// ⚠️ PORTÉE : on contrôle la page d'accueil et l'ACCESSIBILITÉ des fichiers —
// c'est là que se produisent les vraies pannes (fichier non déployé, supprimé,
// bloqué). Le balayage de TOUTES les pages reste le travail de
// `scripts/verifier-favicons.py`, trop coûteux pour une tâche quotidienne.
$favicons = null;
$hote = (string) ($_SERVER['HTTP_HOST'] ?? '');
if ($hote !== '') {
    $base = 'https://' . $hote . '/';
    $tete = static function (string $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_NOBODY => true, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => true]);
        curl_exec($ch);
        $c = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $t = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);
        return [$c, $t];
    };
    // ⚠️ curl et non file_get_contents : allow_url_fopen est désactivé sur
    // l'hébergement, et l'échec est SILENCIEUX — on obtenait « 0 icône
    // déclarée » sur une page qui en déclare quatre (vécu 20/08/2026).
    $ch = curl_init($base);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_FOLLOWLOCATION => true,
        // '' = accepte et DÉCOMPRESSE tous les encodages : sans ça on récupère
        // des octets gzip que la recherche d'icônes ne peut pas lire.
        CURLOPT_ENCODING => '', CURLOPT_USERAGENT => 'nsy-kpi/1.0']);
    $html = curl_exec($ch);
    curl_close($ch);
    $icones = [];
    $conforme = false;
    if (is_string($html)) {
        preg_match_all('/<link\b[^>]*\brel=["\'][^"\']*\bicon\b[^"\']*["\'][^>]*>/i', $html, $m);
        foreach ($m[0] as $balise) {
            if (!preg_match('/href=["\']([^"\']+)["\']/i', $balise, $h)) continue;
            $url = (string) $h[1];
            if (!preg_match('#^https?://#i', $url)) {
                $url = $base . ltrim($url, '/');
            }
            preg_match('/sizes=["\']([^"\']+)["\']/i', $balise, $sz);
            $taille = strtolower($sz[1] ?? '');
            // Google : carré multiple de 48 px. `any` (le .ico) compte aussi.
            if ($taille === 'any' || (preg_match('/^(\d+)x\1$/', $taille, $d)
                && (int) $d[1] >= 48 && (int) $d[1] % 48 === 0)) {
                $conforme = true;
            }
            [$code, $type] = $tete($url);
            $icones[] = ['url' => $url, 'taille' => $taille, 'code' => $code,
                         'image' => str_starts_with($type, 'image/')];
        }
    }
    [$codeIco] = $tete($base . 'favicon.ico');
    $casses = array_values(array_filter($icones, static fn($i) => $i['code'] !== 200 || !$i['image']));
    $favicons = [
        'ico'       => $codeIco,
        'source_octets' => strlen((string) $html),   // 0 = la page n'a pas pu être lue
        'declarees' => count($icones),
        'conforme'  => $conforme,          // au moins un carré ≥ 48 px multiple de 48
        'casses'    => $casses,
        'ok'        => $codeIco === 200 && $conforme && !$casses && $icones !== [],
    ];
}

// ── 3 quater. Calendrier des événements ──────────────────────────────────────
// À quoi ça sert : un pic de visites ou de lectures de robots ne veut rien dire
// tant qu'on ignore ce qui s'est passé ce jour-là. Ce calendrier est ce qui
// permet à l'analyse de dire « pic du 17 : article publié la veille » au lieu
// d'une corrélation inventée. TOUT y est automatique — aucune saisie manuelle :
//   · articles       → le flux RSS du site (source de vérité des publications)
//   · publications   → dates déjà rapportées par Meta (Facebook, Instagram)
//   · vidéos         → dates de mise en ligne YouTube
//   · actions techniques → messages de commit du dépôt public (c'est là que
//     vivent les actions GEO/SEO : llms.txt, JSON-LD, pages villes…)
// Stocké à PLAT (hist.evenements[date]), hors des journées : un événement n'est
// pas une mesure, et il doit survivre à la recollecte d'une journée.
$evts = [];   // rempli plus bas, une fois l'historique ouvert
$ajouteEvt = static function (array &$e, string $date, string $type, string $lib, string $url = ''): void {
    $lib = trim(preg_replace('/\s+/u', ' ', $lib));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $lib === '') return;
    foreach ($e[$date] ?? [] as $x) {
        if ($x['t'] === $type && $x['l'] === $lib) return;     // déjà connu
    }
    $n = ['t' => $type, 'l' => mb_substr($lib, 0, 90)];
    if ($url !== '') $n['u'] = $url;
    $e[$date][] = $n;
};

$collecteEvts = static function (array &$e) use ($ajouteEvt, $fb, $youtube, $ghTok, $ghRepo, $target): void {
    // 1. Articles — le flux RSS porte la date de publication qui fait foi.
    $rss = @file_get_contents(__DIR__ . '/feed.xml');
    if (is_string($rss) && $rss !== '') {
        $xml = @simplexml_load_string($rss);
        foreach ($xml->channel->item ?? [] as $it) {
            $d = strtotime((string) $it->pubDate);
            if ($d) $ajouteEvt($e, date('Y-m-d', $d), 'article', (string) $it->title, (string) $it->link);
        }
    }
    // 2. Publications sociales — Meta ne renvoie que les 10 dernières, mais la
    //    collecte tourne chaque jour : l'accumulation fait le reste.
    foreach ($fb['posts'] ?? [] as $p) {
        $ajouteEvt($e, (string) ($p['date'] ?? ''), 'facebook', ($p['titre'] ?? '') ?: 'publication', (string) ($p['url'] ?? ''));
    }
    foreach ($fb['ig_posts'] ?? [] as $p) {
        $ajouteEvt($e, (string) ($p['date'] ?? ''), 'instagram', ($p['titre'] ?? '') ?: 'publication', (string) ($p['url'] ?? ''));
    }
    // 3. Vidéos YouTube.
    foreach ($youtube['derniers'] ?? [] as $v) {
        $ajouteEvt($e, (string) ($v['date'] ?? ''), 'video', (string) ($v['titre'] ?? ''), (string) ($v['url'] ?? ''));
    }
    // 4. Actions techniques — les commits. On remonte 30 JOURS à chaque passage
    //    (un seul appel, l'ajout est dédoublonné) : ça garnit l'historique déjà
    //    collecté au lieu de n'être utile qu'à partir de demain, et ça rattrape
    //    une collecte manquée. On écarte ce qui ne peut PAS influencer
    //    l'audience — outillage, docs, refactoring, et le dashboard lui-même :
    //    sans ce tri, le calendrier noie le vrai signal sous le bruit interne.
    if ($ghTok === '' || $ghRepo === '') return;
    $depuis = date('Y-m-d', strtotime($target . ' -30 days'));
    $ch = curl_init("https://api.github.com/repos/$ghRepo/commits?"
        . http_build_query(['since' => $depuis . 'T00:00:00Z', 'until' => $target . 'T23:59:59Z', 'per_page' => '100']));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $ghTok", 'Accept: application/vnd.github+json',
                               'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: nsy-kpi'],
    ]);
    $raw = curl_exec($ch);
    $liste = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($liste)) return;
    $parJour = [];        // plafond PAR JOUR, sinon une journée bavarde mange tout
    foreach ($liste as $c) {
        $msg = strtok((string) ($c['commit']['message'] ?? ''), "\n");
        if ($msg === false || $msg === '') continue;
        if (preg_match('/^(chore|docs|refactor|test|style|build|ci)[(:]/i', $msg)) continue;
        if (preg_match('/^\w+\((kpi|stats)\)/i', $msg)) continue;   // outillage interne
        $d = substr((string) ($c['commit']['author']['date'] ?? ''), 0, 10);
        if (($parJour[$d] ?? 0) >= 4) continue;
        $ajouteEvt($e, $d, 'technique', $msg);
        $parJour[$d] = ($parJour[$d] ?? 0) + 1;
    }
};

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
$extra = ['fb' => $fb, 'journal' => $journal, 'source' => 'logs', 'collecte' => date('c')];
if ($avis) $extra['avis'] = $avis;
if ($favicons !== null) $extra['favicons'] = $favicons;
// L'écriture REMPLACE l'entrée du jour : sans ce report, relancer une date déjà
// collectée effacerait les blocs qui n'ont pas pu être recollectés (GitHub hors
// de sa fenêtre de 14 jours, YouTube volontairement muet en rattrapage).
foreach (['github' => $github, 'youtube' => $youtube] as $cle => $frais) {
    $v = $frais ?? ($hist['days'][$target][$cle] ?? null);
    if ($v !== null) $extra[$cle] = $v;
}
$hist['days'][$target] = $day + $extra;
// Rebouchage GitHub : on ne remplit que les journées DÉJÀ présentes (jamais on
// n'invente un jour) et seulement si leur bloc manque — un bloc existant porte
// en plus les pages et référents, qu'on n'écraserait pas par des compteurs nus.
foreach ($ghSerie as $j => $c) {
    if (!isset($hist['days'][$j]) || isset($hist['days'][$j]['github'])) continue;
    $hist['days'][$j]['github'] = $c + ['vues' => 0, 'visiteurs' => 0, 'clones' => 0, 'cloneurs' => 0];
}
ksort($hist['days']);
// Calendrier : on repart de l'existant et on complète — les publications
// sorties de la fenêtre de 10 posts renvoyée par Meta restent ainsi acquises.
$evts = is_array($hist['evenements'] ?? null) ? $hist['evenements'] : [];
$collecteEvts($evts);
ksort($evts);
$hist['evenements'] = $evts;
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
