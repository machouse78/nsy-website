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

/* ── Garde-fou du 30/08/2026 (skill execution-scripts-serveur) ──────────────
   Deux blocages Infomaniak en deux jours : des avertissements PHP émis PAR
   LIGNE LUE ont fait déborder le journal d'erreurs de l'hébergement — les
   sites sont restés hors ligne tout un week-end. Ce gestionnaire rend la
   récidive impossible : les 5 premières erreurs vont au journal (diagnostic),
   au-delà de 10 le traitement est ABANDONNÉ net. Mieux vaut une collecte
   ratée qu'un hébergement bloqué. */
$prvErreurs = 0;
set_error_handler(static function ($no, $msg, $fichier, $ligne) use (&$prvErreurs) {
    if (++$prvErreurs <= 5) {
        error_log("stats-collector: [$no] $msg @ " . basename($fichier) . ":$ligne");
    }
    if ($prvErreurs > 10) {
        http_response_code(500);
        die(json_encode(['ok' => false,
            'erreur' => "traitement STOPPE : $prvErreurs erreurs PHP - regle du 30/08/2026"]));
    }
    return true;    // comptée et maîtrisée : PHP ne la journalise pas une 2e fois
});

$cfg = require __DIR__ . '/_secret/kpi.php';
if (!hash_equals((string) $cfg['cron_key'], (string) ($_GET['key'] ?? ''))) {
    http_response_code(404);
    exit;
}

/* ── Mode STORIES, intrajournalier : ?key=…&stories=1 (toutes les 4 à 6 h).
   N'écrit que le carnet _secret/kpi-stories.json — ni logs, ni historique. */
if (($_GET['stories'] ?? '') === '1') {
    $tokS = (string) ($cfg['fb_page_token'] ?? '');
    $carnetS = ($tokS !== '' && !str_starts_with($tokS, 'CHANGE_ME'))
        ? collecteStories($cfg, $tokS, __DIR__ . '/_secret/kpi-stories.json') : ['stories' => []];
    $auj = date('Y-m-d');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'mode' => 'stories', 'carnet' => count($carnetS['stories']),
                      'facebook_aujourdhui' => count(storiesDuJour($carnetS, 'facebook', $auj)),
                      'instagram_aujourdhui' => count(storiesDuJour($carnetS, 'instagram', $auj))], JSON_UNESCAPED_UNICODE);
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
    // ⚠️ L'ORDRE FAIT LA CLASSIFICATION : le premier motif qui correspond gagne
    // (break). Les agents « -User » DOIVENT précéder leur crawler homonyme,
    // sinon /Perplexity/i avale Perplexity-User et l'on reperd la distinction.
    'ChatGPT-User'   => '/ChatGPT-User/i',
    'Claude-User'    => '/Claude-User/i',
    'Perplexity-User' => '/Perplexity-User/i',
    'OAI-SearchBot'  => '/OAI-SearchBot/i',
    'Claude-Search'  => '/Claude-SearchBot/i',
    'GPTBot'         => '/GPTBot/i',
    'Claude'         => '/ClaudeBot|anthropic-ai/i',
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
// ── Familles d'agents : TOUTES les lectures d'IA ne se valent pas ────────────
// « conversation » = récupération DÉCLENCHÉE EN DIRECT par la question d'un
//   humain. Un hit ChatGPT-User signifie : à cet instant, quelqu'un a posé une
//   question et l'assistant est allé lire CETTE page pour lui répondre. C'est
//   le signal le plus proche d'une mention — horodaté, et avec la page lue.
// « recherche »    = alimentation de l'index de recherche de l'assistant.
// « indexation »   = crawl d'entraînement ou de corpus, sans rapport avec une
//   conversation en cours. C'est le gros du volume, et le moins intéressant.
// Tout agent absent de cette table est compté en « indexation ».
$IA_FAMILLE = [
    'ChatGPT-User'    => 'conversation',
    'Claude-User'     => 'conversation',
    'Perplexity-User' => 'conversation',
    'OAI-SearchBot'   => 'recherche',
    'Claude-Search'   => 'recherche',
    'Gemini-Vertex'   => 'recherche',
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
// Détail par moteur — même ordre de priorité que $SE_RE.
$SE_NOMS = [
    'Googlebot'    => '/Googlebot/i',
    'Bingbot'      => '/bingbot|msnbot/i',
    'DuckDuckBot'  => '/DuckDuckBot/i',
    'Qwantbot'     => '/Qwantbot/i',
    'YandexBot'    => '/YandexBot/i',
    'Baiduspider'  => '/Baiduspider/i',
    'Applebot'     => '/Applebot/i',
];
$BOT_RE  = '/bot|crawl|spider|slurp|scanner|scan|python|curl|wget|go-http|aiohttp|httpx|libwww|okhttp|java\/|guzzle|facebookexternalhit|monitor|checker|probe|wp2shell|xploit|jetpack|feed|semrush|mj12|ahrefs|censys|netcraft|builtwith|barkrowler|dataprovider|client/i';
$SCAN_RE = '/wp2shell|vuln|xploit|security-auditor|censys|scanner|sqlmap|nuclei/i';

$stats = [
    'pageviews' => 0, 'uniques' => [], 'ips' => [], 'hits' => 0, 'status' => ['200' => 0, '301' => 0, '404' => 0, 'other' => 0],
    'ai' => [], 'ai_hits' => 0, 'se_hits' => 0, 'bot_hits' => 0, 'scan_hits' => 0,
    'ia_familles' => ['conversation' => 0, 'recherche' => 0, 'indexation' => 0],
    'ia_conv_pages' => [], // page lue lors d'une récupération DÉCLENCHÉE par une question
    'pages' => [], 'referrals' => ['ia' => 0, 'facebook' => 0, 'linkedin' => 0, 'google' => 0, 'bing' => 0, 'autres' => 0],
    'ref_ia' => [], // détail par assistant (ChatGPT, Claude, Perplexity…) — provenance GEO
    'ia_pages' => [], // assistant => page d'atterrissage => n (LA page que l'IA a citée)
    'moteurs' => [],      // moteur de recherche => passages de son robot
    'se_pages' => [],     // page => passages de robots de moteurs (ce qu'ils explorent)
    'google_pages' => [], // page d'atterrissage des visites venues de Google (ce qui se positionne)
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
// ── Archive quotidienne des logs bruts (owner, 22/08/2026) ───────────────────
// L'hébergeur ne conserve que ~38 jours de logs : chaque collecte range donc la
// tranche du jour cible dans _secret/log-archive/<date>.log.gz — HORS web et
// HORS git (les adresses IP sont des données personnelles). Toute question
// future (« et si on ventilait par X ? ») redevient alors rejouable sans limite
// d'historique. Rétention : AUCUNE LIMITE — on garde TOUT (règle owner,
// 31/08/2026). Un journal compressé pèse quelques dizaines de Ko par jour ;
// le coût de stockage est dérisoire face à la valeur d'un historique complet,
// et une donnée purgée ne se rattrape jamais. NE PAS réintroduire de purge.
$archDir  = __DIR__ . '/_secret/log-archive';
$archFile = "$archDir/$target.log.gz";
$archTmp  = null; $archH = null; $archLignes = 0;
if ($target < date('Y-m-d', strtotime('-30 days')) && is_file($archFile)) {
    // Date trop ancienne pour les logs de l'hébergeur : on relit NOTRE archive.
    // Entre 30 et 38 jours les deux sources existent encore ; l'archive, écrite
    // le jour même, est identique — la préférer évite tout double comptage.
    $files = [$archFile];
} elseif (!is_file($archFile)) { // idempotente : une archive n'est JAMAIS réécrite
    if (!is_dir($archDir)) @mkdir($archDir, 0700, true);
    $archTmp = "$archDir/.$target.tmp.gz";
    $archH = @gzopen($archTmp, 'wb6');
}
// Infomaniak préfixe chaque ligne par le vhost (« nsy.fr IP - - [... ») — préfixe optionnel.
// La TAILLE de réponse est capturée : elle sert à reconnaître les sondes de
// disponibilité du chatbot dans l'historique d'avant le marqueur explicite.
$re = '#^(?:[a-z0-9.-]+ )?(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\S+) "([^"]*)" "([^"]*)"#';
$parsedFiles = 0;

foreach ($files as $f) {
    // ne lire que les fichiers susceptibles de contenir la date cible (mtime ± 3 j)
    // (l'archive est exemptée du filtre mtime : elle est écrite bien après la date)
    if ($f !== $archFile && abs(filemtime($f) - strtotime($target)) > 3 * 86400 + 86399) continue;
    $h = str_ends_with($f, '.gz') ? gzopen($f, 'rb') : fopen($f, 'rb');
    if (!$h) continue;
    $parsedFiles++;
    $read = str_ends_with($f, '.gz') ? 'gzgets' : 'fgets';
    while (($line = $read($h)) !== false) {
        if (!str_contains($line, $targetLog)) continue;
        // Ligne BRUTE archivée avant tout filtre : l'archive doit être la tranche
        // complète, y compris ce que le parseur d'aujourd'hui ne sait pas lire.
        if ($archH) { gzwrite($archH, $line); $archLignes++; }
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
                $fam = $IA_FAMILLE[$name] ?? 'indexation';
                $stats['ia_familles'][$fam] = ($stats['ia_familles'][$fam] ?? 0) + 1;
                if ($fam === 'conversation') {
                    $stats['ia_conv_pages'][$clean] = ($stats['ia_conv_pages'][$clean] ?? 0) + 1;
                }
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
        if (preg_match($SE_RE, $ua)) {
            $stats['se_hits']++;
            // Détail par moteur : « 682 passages de moteurs » ne dit pas si c'est
            // Google ou Yandex. Le total reste se_hits, l'historique n'est pas coupé.
            foreach ($SE_NOMS as $nom => $rx) {
                if (preg_match($rx, $ua)) { $stats['moteurs'][$nom] = ($stats['moteurs'][$nom] ?? 0) + 1; break; }
            }
            $stats['se_pages'][$clean] = ($stats['se_pages'][$clean] ?? 0) + 1;
            continue;
        }
        if ($ua === '' || $ua === '-' || preg_match($BOT_RE, $ua)) { $stats['bot_hits']++; continue; }

        // humain (approximation) : page servie ($clean / $isPage : voir périmètres)
        if ($isPage && in_array($status, ['200', '304'], true) && $method === 'GET') {
            $vh = substr(md5($ip . '|' . $ua), 0, 12); // ≠ $h (handle de fichier de la boucle !)
            /* IP retenue le temps du calcul du PAYS, puis oubliee : elle ne sort
               jamais de ce script et n'entre pas dans l'historique. */
            if ($peri === $PERI_DEFAUT && count($stats['ips']) < 60000) {
                $stats['ips'][$ip] = ($stats['ips'][$ip] ?? 0) + 1;
            }
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
                elseif (str_contains($rh, 'google')) {
                    $stats['referrals']['google']++;
                    // Page d'atterrissage = la page qui s'est POSITIONNÉE dans Google.
                    $stats['google_pages'][$clean] = ($stats['google_pages'][$clean] ?? 0) + 1;
                }
                elseif (str_contains($rh, 'bing'))                               $stats['referrals']['bing']++;
                else                                                             $stats['referrals']['autres']++;
            }
        }
    }
    is_resource($h) ? (str_ends_with($f, '.gz') ? gzclose($h) : fclose($h)) : null;
}
if ($archH) {
    gzclose($archH);
    // On ne fige que des journées COMPLÈTES : un passage sur le jour courant
    // (logs encore en cours d'écriture) ne doit pas archiver une demi-journée.
    if ($archLignes > 0 && $target <= date('Y-m-d', strtotime('yesterday'))) rename($archTmp, $archFile);
    else @unlink($archTmp);
    // Aucune purge : l'archive est conservée intégralement (règle owner,
    // 31/08/2026). Voir le commentaire de $archDir plus haut.
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

// ── 1 ter. Pays des visiteurs — résolu SUR LE SERVEUR, sans rien envoyer ─────
// Demande de l'owner (29/08/2026) : « d'où viennent les visiteurs ». La Search
// Console ne répond que pour ceux venus d'une recherche Google — 335 clics sur
// 433 visiteurs par jour. Les logs, eux, voient tout le monde. On résout donc
// ici, à partir de la base DB-IP Country Lite (CC BY 4.0), que le SERVEUR
// télécharge et relit lui-même : aucune IP n'est envoyée à un tiers, et rien
// ne dépend d'un traitement sur le poste de quelqu'un.
//
// Choix de méthode : PAS d'index binaire. Le construire demanderait de traiter
// 400 000 plages dans une fenêtre HTTP de 60 s — fragile. On fait l'inverse :
// on rassemble les IP DISTINCTES du jour (quelques centaines), on les trie, et
// on balaie la base UNE fois en avançant en parallèle. Un seul passage, mémoire
// constante, et rien à maintenir entre deux collectes.
//
// ⚠️ Les IP ne sortent pas de ce script : elles servent au calcul, puis
// $stats['ips'] est vidé. Seul un compteur par pays entre dans l'historique.
$pays = null;
$geoDir = __DIR__ . '/_secret/geoip';
$geoCsv = "$geoDir/dbip-city-lite.csv.gz";
if ($stats['ips']) {
    if (!is_dir($geoDir)) @mkdir($geoDir, 0700, true);
    // Rafraîchissement mensuel : DB-IP publie un fichier par mois, sans clé.
    $ageOk = is_file($geoCsv) && (time() - (int) @filemtime($geoCsv)) < 32 * 86400;
    if (!$ageOk) {
        foreach ([date('Y-m'), date('Y-m', strtotime('-1 month'))] as $mois) {
            $url = "https://download.db-ip.com/free/dbip-city-lite-$mois.csv.gz";
            $tmp = "$geoDir/.tmp.gz";
            $fp = @fopen($tmp, 'wb');
            if (!$fp) { break; }
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_FILE => $fp, CURLOPT_FOLLOWLOCATION => true,
                                    CURLOPT_TIMEOUT => 600, CURLOPT_FAILONERROR => true]);
            $ok = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            fclose($fp);
            if ($ok && $code === 200 && filesize($tmp) > 10000000) { @rename($tmp, $geoCsv); break; }
            @unlink($tmp);
        }
    }

    if (is_file($geoCsv) && ($gz = @gzopen($geoCsv, 'rb'))) {
        // IPv4 d'un côté, IPv6 de l'autre — deux espaces d'adresses, deux tris.
        $v4 = []; $v6 = [];
        foreach (array_keys($stats['ips']) as $ipx) {
            $b = @inet_pton($ipx);
            if ($b === false) { continue; }
            if (strlen($b) === 4) { $v4[$ipx] = $b; } else { $v6[$ipx] = $b; }
        }
        asort($v4, SORT_STRING); asort($v6, SORT_STRING);   // ordre binaire = ordre numérique
        $l4 = array_values($v4); $k4 = array_keys($v4); $i4 = 0; $n4 = count($l4);
        $l6 = array_values($v6); $k6 = array_keys($v6); $i6 = 0; $n6 = count($l6);
        $compte = []; $pays_par_ip = []; $lieu_par_ip = [];
        while (($ligne = gzgets($gz)) !== false) {
            if ($i4 >= $n4 && $i6 >= $n6) { break; }        // toutes les IP placées
            /* Colonnes DB-IP City : debut, fin, continent, PAYS, region,
               ville, latitude, longitude. */
            /* $escape EXPLICITE — vécu le 29/08/2026 : sans lui, PHP 8.4 émet
               un « Deprecated » PAR LIGNE LUE, soit ~8 millions d'avertissements
               par collecte dans le journal d'erreurs. Infomaniak a bloqué LES
               DEUX SITES pour « nombre trop important d'erreurs ». La valeur
               '\\' reproduit le comportement historique à l'identique. */
            $c = str_getcsv(rtrim($ligne, "\r\n"), ',', '"', '\\');
            if (count($c) < 8) { continue; }
            $deb = @inet_pton($c[0]); $fin = @inet_pton($c[1]);
            if ($deb === false || $fin === false) { continue; }
            $cc = $c[3]; $lieu = [$c[3], $c[4], $c[5], (float) $c[6], (float) $c[7]];
            if (strlen($deb) === 4) {
                while ($i4 < $n4 && $l4[$i4] < $deb) { $i4++; }          // IP avant la plage : sans pays
                while ($i4 < $n4 && $l4[$i4] <= $fin) {
                    $compte[$cc] = ($compte[$cc] ?? 0) + 1;
                    $pays_par_ip[$k4[$i4]] = $cc; $lieu_par_ip[$k4[$i4]] = $lieu; $i4++;
                }
            } else {
                while ($i6 < $n6 && $l6[$i6] < $deb) { $i6++; }
                while ($i6 < $n6 && $l6[$i6] <= $fin) {
                    $compte[$cc] = ($compte[$cc] ?? 0) + 1;
                    $pays_par_ip[$k6[$i6]] = $cc; $lieu_par_ip[$k6[$i6]] = $lieu; $i6++;
                }
            }
        }
        gzclose($gz);
        arsort($compte);
        /* Combien de RESEAUX distincts derriere le pays dominant ? 248 adresses
           reparties sur deux /16 sont un parc de proxys ; reparties sur 200,
           ce sont des visiteurs. La question se tranche sans exposer une seule
           adresse. */
        /* ⚠️ Il faut compter les reseaux DU PAYS DOMINANT, pas de toutes les
           adresses : mesurer l ensemble melangeait 248 suisses eventuellement
           groupees avec 168 autres forcement dispersees, et laissait croire a
           une diversite qui n existait pas. Erreur commise le 29/08/2026. */
        $dom = array_key_first($compte);
        $reseaux = [];
        foreach ($pays_par_ip as $ipx => $cc) {
            if ($cc !== $dom) { continue; }
            $b = @inet_pton($ipx);
            if ($b === false || strlen($b) !== 4) { continue; }
            $pt = strpos($ipx, '.', strpos($ipx, '.') + 1);
            $reseaux[substr($ipx, 0, $pt === false ? strlen($ipx) : $pt)] = true;
        }
        arsort($reseaux);
        /* Le meme classement, restreint aux adresses ayant lu au moins DEUX
           pages : c'est la repartition de l'audience qui lit vraiment, par
           opposition a celle des passages. Les deux sont publiees cote a cote
           — l'ecart entre elles EST l'information. */
        /* ── Agregation par LIEU ────────────────────────────────────────────
           On ne conserve JAMAIS une coordonnee par adresse : on regroupe par
           ville et on compte. « Lille : 3 » entre dans l'historique, l'adresse
           qui a permis de le calculer n'y entre pas et n'existe plus a la fin
           de ce script. C'est la difference entre une statistique et un
           fichier de localisation. */
        $lieux = [];
        foreach ($stats['ips'] as $ipx => $nb) {
            $L = $lieu_par_ip[$ipx] ?? null;
            if ($L === null || ($L[3] == 0 && $L[4] == 0)) { continue; }   // 0,0 = inconnu
            $cle = $L[0] . '|' . $L[1] . '|' . $L[2];
            if (!isset($lieux[$cle])) {
                $lieux[$cle] = ['cc' => $L[0], 'region' => $L[1], 'ville' => $L[2],
                                'lat' => round($L[3], 3), 'lon' => round($L[4], 3),
                                'n' => 0, 'n2p' => 0];
            }
            $lieux[$cle]['n']++;
            if ($nb >= 2) { $lieux[$cle]['n2p']++; }
        }
        usort($lieux, static fn($a, $b) => $b['n'] <=> $a['n']);

        $compte2p = [];
        foreach ($stats['ips'] as $ipx => $nb) {
            if ($nb < 2) { continue; }
            $cc = $pays_par_ip[$ipx] ?? null;
            if ($cc !== null) { $compte2p[$cc] = ($compte2p[$cc] ?? 0) + 1; }
        }
        arsort($compte2p);
        $pays = ['source' => 'logs', 'compte_2p' => $compte2p, 'lieux' => array_slice($lieux, 0, 400),
                 'base' => date('Y-m', (int) @filemtime($geoCsv)),
                 'resolus' => array_sum($compte), 'total' => count($stats['ips']),
                 'reseaux_16' => count($reseaux), 'dominant' => $dom,
                 'top_reseaux' => array_slice(array_keys($reseaux), 0, 6),
                 'compte' => $compte];
    }
}

    /* ── Qui est derriere l'adresse ? ────────────────────────────────────────
       Le releve par pays a revele que 60 % des « visiteurs » venaient de 57
       reseaux suisses en 5.x — de l'espace RIPE d'hebergeurs et de VPN, pas
       d'acces residentiels. Ce ne sont pas des visiteurs : ce sont des clients
       automatises qui portent un user-agent de navigateur et passent au
       travers du filtre anti-robots.
       On ne REECRIT rien pour autant : la courbe historique reste ce qu'elle
       est, comparable a elle-meme. On ajoute a cote un second compteur, « hors
       centres de donnees », et on garde les noms d'operateurs pour pouvoir
       verifier le classement au lieu de le croire. */
    $asnCsv = "$geoDir/dbip-asn-lite.csv.gz";
    if ($pays !== null) {
        $ageAsn = is_file($asnCsv) && (time() - (int) @filemtime($asnCsv)) < 32 * 86400;
        if (!$ageAsn) {
            foreach ([date('Y-m'), date('Y-m', strtotime('-1 month'))] as $mois) {
                $tmp = "$geoDir/.asn.tmp.gz";
                $fp = @fopen($tmp, 'wb');
                if (!$fp) { break; }
                $ch = curl_init("https://download.db-ip.com/free/dbip-asn-lite-$mois.csv.gz");
                curl_setopt_array($ch, [CURLOPT_FILE => $fp, CURLOPT_FOLLOWLOCATION => true,
                                        CURLOPT_TIMEOUT => 180, CURLOPT_FAILONERROR => true]);
                $ok = curl_exec($ch);
                $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                fclose($fp);
                if ($ok && $code === 200 && filesize($tmp) > 1000000) { @rename($tmp, $asnCsv); break; }
                @unlink($tmp);
            }
        }
        if (is_file($asnCsv) && ($gz = @gzopen($asnCsv, 'rb'))) {
            $i4 = 0; $i6 = 0; $asNoms = []; $asParIp = [];
            while (($ligne = gzgets($gz)) !== false) {
                if ($i4 >= $n4 && $i6 >= $n6) { break; }
                $c = str_getcsv(rtrim($ligne, "\r\n"), ',', '"', '\\');
                if (count($c) < 4) { continue; }
                $deb = @inet_pton($c[0]); $fin = @inet_pton($c[1]);
                if ($deb === false || $fin === false) { continue; }
                if (strlen($deb) === 4) {
                    while ($i4 < $n4 && $l4[$i4] < $deb) { $i4++; }
                    while ($i4 < $n4 && $l4[$i4] <= $fin) { $asParIp[$k4[$i4]] = $c[3]; $i4++; }
                } else {
                    while ($i6 < $n6 && $l6[$i6] < $deb) { $i6++; }
                    while ($i6 < $n6 && $l6[$i6] <= $fin) { $asParIp[$k6[$i6]] = $c[3]; $i6++; }
                }
            }
            gzclose($gz);

            /* Liste EXPLICITE, pour qu'on puisse la discuter au lieu de la subir.
               Volontairement centree sur des marqueurs d'hebergement et de VPN,
               jamais sur un nom de fournisseur d'acces : Orange, Free, SFR et
               Bouygues ne doivent JAMAIS y tomber. */
            $marqueurs = ['hosting', 'host', 'cloud', 'server', 'datacenter', 'data center',
                          'vps', 'colocation', 'colo ', 'digitalocean', 'ovh', 'hetzner',
                          'amazon', 'google llc', 'microsoft', 'oracle', 'linode', 'vultr',
                          'contabo', 'leaseweb', 'm247', 'proxy', 'vpn', 'scaleway',
                          'choopa', 'ip volume', 'packethub', 'stark industries', 'alibaba',
                          'tencent', 'huawei', 'cloudflare', 'fastly', 'akamai', 'datacamp'];
            $dc = 0; $horsDc = 0;
            foreach (array_keys($stats['ips']) as $ipx) {
                $nom = $asParIp[$ipx] ?? '';
                $n_l = mb_strtolower($nom);
                $est = false;
                foreach ($marqueurs as $mk) { if ($nom !== '' && str_contains($n_l, $mk)) { $est = true; break; } }
                if ($est) { $dc++; } else { $horsDc++; }
                if ($nom !== '') { $asNoms[$nom] = ($asNoms[$nom] ?? 0) + 1; }
            }
            arsort($asNoms);
            $pays['centres_donnees'] = $dc;
            $pays['hors_centres'] = $horsDc;
            $pays['as_top'] = array_slice($asNoms, 0, 12, true);
            /* Combien de pages par adresse ? Un reseau de proxys residentiels
               se reconnait a ceci : beaucoup d'adresses distinctes, une ou deux
               pages chacune. Un vrai visiteur en lit plusieurs. */
            $vues = array_values($stats['ips']);
            sort($vues);
            /* LE compteur qui veut dire quelque chose. 388 adresses sur 416 ne
               lisent QU'UNE page : ce sont des passages, pas des lectures. Un
               visiteur qui en ouvre deux a fait un choix. On ne réécrit pas la
               courbe historique — elle reste comparable à elle-même — on pose
               celle-ci à côté. */
            $pays['visiteurs_2p'] = count(array_filter($stats['ips'], static fn($v) => $v >= 2));
            $pays['vues_par_ip'] = [
                'moyenne' => count($vues) ? round(array_sum($vues) / count($vues), 2) : 0,
                'mediane' => count($vues) ? $vues[intdiv(count($vues), 2)] : 0,
                'a_une_seule_page' => count(array_filter($vues, static fn($v) => $v === 1)),
                'max' => $vues ? end($vues) : 0,
            ];
        }
    }

$stats['ips'] = [];   // les IP ne vont pas plus loin

$day = [
    'visiteurs'   => count($stats['uniques']),
    'pages_vues'  => $stats['pageviews'],
    'hits'        => $stats['hits'],
    'ai'          => $stats['ai'],
    'ai_hits'     => $stats['ai_hits'],
    'se_hits'     => $stats['se_hits'],
    'moteurs'     => $stats['moteurs'],
    'se_pages'    => array_slice($stats['se_pages'], 0, 15, true),
    'google_pages' => array_slice($stats['google_pages'], 0, 15, true),
    'bot_hits'    => $stats['bot_hits'],
    'scan_hits'   => $stats['scan_hits'],
    'llms_hits'   => $stats['llms_hits'],
    'chat_calls'  => $stats['chat_calls'],
    'top_pages'   => array_slice($stats['pages'], 0, 25, true),
    'referrals'   => $stats['referrals'],
    'ref_hosts'   => array_slice($stats['ref_hosts'], 0, 10, true),
    'ref_ia'      => $stats['ref_ia'],
    'ia_pages'    => $stats['ia_pages'],
    'ia_familles' => $stats['ia_familles'],
    'ia_conv_pages' => array_slice($stats['ia_conv_pages'], 0, 15, true),
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

/* ── STORIES (Facebook Page + Instagram) — une vie de 24 h ───────────────────
   Une story n'est lisible par l'API Graph que 24 h après sa parution ; la
   collecte nocturne de J-1 ne verrait que celles publiées après l'heure de la
   collecte. On tient donc un CARNET (_secret/kpi-stories.json), alimenté à
   chaque passage — nocturne, ou intrajournalier via ?key=…&stories=1 (à
   programmer toutes les 4 à 6 h) — qui mémorise chaque story vue et le
   MAXIMUM de ses mesures. L'entrée du jour J reprend les stories du carnet
   datées de J. Mesures Instagram : vues, portée, réponses, interactions ;
   Facebook n'expose pas de mesure fiable par story : la story est comptée,
   ses mesures restent « — » si l'API les refuse (GO owner 04/09/2026). */
function collecteStories(array $cfg, string $tok, string $carnetFile): array
{
    $carnet = is_readable($carnetFile) ? (json_decode((string) file_get_contents($carnetFile), true) ?: []) : [];
    $stories = is_array($carnet['stories'] ?? null) ? $carnet['stories'] : [];
    $vu = date('c');
    $garde = static function (array &$dst, string $id, array $neuf) use ($vu): void {
        $ancien = $dst[$id] ?? [];
        foreach (['vues', 'portee', 'reponses', 'interactions'] as $k) {
            if (isset($neuf[$k]) || isset($ancien[$k])) { $neuf[$k] = max((int) ($neuf[$k] ?? 0), (int) ($ancien[$k] ?? 0)); }
        }
        $neuf['vu_le'] = $vu;
        $neuf['premiere_vue'] = $ancien['premiere_vue'] ?? $vu;
        $dst[$id] = $neuf;
    };
    // Facebook — stories de la Page
    if (!empty($cfg['fb_page_id'])) {
        $fbS = graphGet($cfg['fb_page_id'] . '/stories', $tok, ['fields' => 'post_id,status,creation_time,media_type,media_id,url', 'limit' => '50']);
        foreach ($fbS['data'] ?? [] as $st) {
            $id = (string) ($st['post_id'] ?? $st['media_id'] ?? '');
            if ($id === '') { continue; }
            $mes = [];
            $ins = graphGet($id . '/insights', $tok, ['metric' => 'post_impressions_unique,post_impressions']);
            foreach ($ins['data'] ?? [] as $m) {
                $val = (int) ($m['values'][0]['value'] ?? 0);
                if (($m['name'] ?? '') === 'post_impressions_unique') { $mes['portee'] = $val; }
                if (($m['name'] ?? '') === 'post_impressions') { $mes['vues'] = $val; }
            }
            $garde($stories, 'fb:' . $id, ['reseau' => 'facebook', 'id' => $id,
                'date' => substr((string) ($st['creation_time'] ?? ''), 0, 10), 'type' => (string) ($st['media_type'] ?? ''),
                'url' => (string) ($st['url'] ?? ''), 'statut' => (string) ($st['status'] ?? '')] + $mes);
        }
    }
    // Instagram — stories du compte
    if (!empty($cfg['ig_user_id'])) {
        $igS = graphGet($cfg['ig_user_id'] . '/stories', $tok, ['fields' => 'id,timestamp,media_type,permalink', 'limit' => '50']);
        foreach ($igS['data'] ?? [] as $st) {
            $id = (string) ($st['id'] ?? '');
            if ($id === '') { continue; }
            $mes = [];
            $ins = graphGet($id . '/insights', $tok, ['metric' => 'views,reach,replies,total_interactions']);
            if (!isset($ins['data'])) { $ins = graphGet($id . '/insights', $tok, ['metric' => 'reach,replies']); }
            foreach ($ins['data'] ?? [] as $m) {
                $val = (int) ($m['values'][0]['value'] ?? 0);
                $cle = ['views' => 'vues', 'reach' => 'portee', 'replies' => 'reponses', 'total_interactions' => 'interactions'][$m['name'] ?? ''] ?? null;
                if ($cle !== null) { $mes[$cle] = $val; }
            }
            $garde($stories, 'ig:' . $id, ['reseau' => 'instagram', 'id' => $id,
                'date' => substr((string) ($st['timestamp'] ?? ''), 0, 10), 'type' => (string) ($st['media_type'] ?? ''),
                'url' => (string) ($st['permalink'] ?? '')] + $mes);
        }
    }
    // Le carnet ne garde qu'un an : au-delà, l'historique quotidien fait foi.
    $limite = date('Y-m-d', strtotime('-400 days'));
    $stories = array_filter($stories, static fn ($x) => (string) ($x['date'] ?? '') >= $limite);
    @file_put_contents($carnetFile, json_encode(['stories' => $stories, 'maj' => $vu], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    return ['stories' => $stories];
}
/** Les stories du carnet datées d'un jour, pour un réseau. */
function storiesDuJour(array $carnet, string $reseau, string $jour): array
{
    $out = [];
    foreach ($carnet['stories'] ?? [] as $x) {
        if (($x['reseau'] ?? '') === $reseau && ($x['date'] ?? '') === $jour) {
            $out[] = ['id' => $x['id'], 'date' => $x['date'], 'type' => $x['type'] ?? '', 'url' => $x['url'] ?? '',
                      'vues' => $x['vues'] ?? null, 'portee' => $x['portee'] ?? null, 'reponses' => $x['reponses'] ?? null,
                      'interactions' => $x['interactions'] ?? null];
        }
    }
    return $out;
}

$fb = ['stories' => [], 'ig_stories' => [], 'abonnes' => null, 'posts' => [], 'vues' => null, 'engagements' => null,
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
    $carnetS = collecteStories($cfg, $tok, __DIR__ . '/_secret/kpi-stories.json');
    $fb['stories'] = storiesDuJour($carnetS, 'facebook', $target);
    $fb['ig_stories'] = storiesDuJour($carnetS, 'instagram', $target);
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
    // Une source sans API peut porter des valeurs SAISIES À LA MAIN dans la
    // config (note / nombre) : mieux vaut un chiffre relevé et daté qu'un tiret
    // sur une plateforme qui affiche pourtant une note. `auto` distingue les
    // deux au rendu — on ne fait jamais passer une saisie pour une collecte.
    $avis[$nom] = [
        'note'      => isset($s['note']) ? (float) $s['note'] : null,   // null = inconnu (≠ 0)
        'nombre'    => isset($s['nombre']) ? (int) $s['nombre'] : null,
        'positifs'  => null,
        'auto'      => false,
        'profil'    => (string) ($s['profil'] ?? ''),
        'deposer'   => (string) ($s['deposer'] ?? ''),
    ];
}
if (isset($tok) && $tok !== '' && !str_starts_with($tok, 'CHANGE_ME')) {
    $note = $page['overall_star_rating'] ?? null;
    $fbAvis = ['note' => $note > 0 ? (float) $note : null, 'nombre' => 0, 'positifs' => 0, 'auto' => true,
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
    foreach ($fb['stories'] ?? [] as $p) {
        $ajouteEvt($e, (string) ($p['date'] ?? ''), 'facebook', 'story', (string) ($p['url'] ?? ''));
    }
    foreach ($fb['ig_stories'] ?? [] as $p) {
        $ajouteEvt($e, (string) ($p['date'] ?? ''), 'instagram', 'story', (string) ($p['url'] ?? ''));
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

// ── 3 sexies. Search Console (API, compte de service) ────────────────────────
// Pourquoi ce bloc existe : le 29/08/2026 on a découvert que le sitemap du
// forum soumettait ZÉRO URL à Google — sans erreur, sans avertissement, et
// depuis on ne sait combien de temps. Rien ne le surveillait. Un relevé
// quotidien du nombre d'URL soumises l'aurait signalé le lendemain.
//
// On relève donc chaque jour, par propriété :
//   · l'état des SITEMAPS (soumises, erreurs, avertissements, dernier
//     téléchargement) — c'est le chien de garde ;
//   · la PERFORMANCE (clics, impressions, CTR, position) sur 28 jours, et sur
//     le dernier jour complet.
//
// ⚠️ La donnée de performance de Google accuse deux à trois jours de retard :
// interroger « hier » renvoie souvent zéro. On prend donc le dernier jour
// RÉELLEMENT rempli, et on note sa date — sans quoi la courbe finirait par
// afficher des zéros qui ne veulent rien dire.
//
// ⚠️ Le champ `indexed` du rapport sitemaps est DÉPRÉCIÉ et renvoie 0 pour
// tout le monde : on ne le collecte pas, pour ne pas afficher un « 0 indexée »
// qui ferait croire à une catastrophe inexistante.
$gsc = null;
$gscCle = __DIR__ . '/_secret/gsc-service-account.json';
/* ⚠️ JAMAIS en rattrapage. Ce bloc est un ETAT D'AUJOURD'HUI — nombre d'URL
   soumises, performances des 28 derniers jours. L'ecrire sur une date passee
   inscrirait « 5 665 URLs soumises » au 21 juillet, ou il y en avait ZERO :
   ce ne serait pas un rattrapage, ce serait une invention. Meme raison que
   pour YouTube plus haut, et l'historisation reporte de toute facon le bloc
   deja present sur la date. */
$gscRecent = $target >= date('Y-m-d', strtotime('-2 days'));
if ($gscRecent && is_readable($gscCle)) {
    $gscJeton = static function (string $chemin): ?string {
        $cle = json_decode((string) @file_get_contents($chemin), true);
        if (!is_array($cle) || empty($cle['client_email']) || empty($cle['private_key'])) { return null; }
        $b64 = static fn(string $d): string => rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
        $now = time();
        $entete = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $charge = $b64(json_encode([
            'iss' => $cle['client_email'],
            'scope' => 'https://www.googleapis.com/auth/webmasters.readonly',
            'aud' => $cle['token_uri'] ?? 'https://oauth2.googleapis.com/token',
            'iat' => $now, 'exp' => $now + 3600,
        ]));
        $sig = '';
        if (!openssl_sign($entete . '.' . $charge, $sig, $cle['private_key'], OPENSSL_ALGO_SHA256)) { return null; }
        $assertion = $entete . '.' . $charge . '.' . $b64($sig);
        $ch = curl_init($cle['token_uri'] ?? 'https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 20,
            CURLOPT_POSTFIELDS => http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion])]);
        $rep = json_decode((string) curl_exec($ch), true);
        return $rep['access_token'] ?? null;
    };
    $gscAppel = static function (string $url, string $jeton, ?array $corps = null): ?array {
        $ch = curl_init($url);
        $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $jeton, 'Content-Type: application/json']];
        if ($corps !== null) { $opt[CURLOPT_POST] = true; $opt[CURLOPT_POSTFIELDS] = json_encode($corps); }
        curl_setopt_array($ch, $opt);
        $d = json_decode((string) curl_exec($ch), true);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return $code === 200 && is_array($d) ? $d : null;
    };

    $jeton = $gscJeton($gscCle);
    if ($jeton !== null) {
        // Toutes les propriétés VISIBLES par ce compte de service. S'il n'en voit
        // qu'une, on est dans le cas courant ; s'il en voit plusieurs (le compte
        // a été ajouté aux autres sites), on les relève TOUTES et le dashboard
        // les met côte à côte — c'est la comparaison demandée par l'owner le
        // 29/08/2026, et elle ne coûte qu'un appel de plus par propriété.
        $liste = $gscAppel('https://www.googleapis.com/webmasters/v3/sites', $jeton);
        $toutes = [];
        foreach (($liste['siteEntry'] ?? []) as $e) {
            if (!empty($e['siteUrl'])) { $toutes[] = (string) $e['siteUrl']; }
        }
        // La propriété PRINCIPALE : celle déclarée en config, sinon celle qui
        // porte le domaine de ce site, sinon la première de DOMAINE, sinon la
        // première tout court. Une propriété de domaine couvre http+https et
        // les sous-domaines : à préférer quand elle existe.
        /* ⚠️ L'ordre de préférence compte, et il n'est pas intuitif : une
           propriété de PRÉFIXE portant un sous-chemin (…/boutique/) a le MÊME
           hôte que la propriété de DOMAINE. Chercher d'abord par l'hôte a donc
           élu la boutique et affiché ses 42 clics à la place des 335 du site
           entier (vu à l'écran le 29/08/2026 avant correction).
           On prend donc, dans l'ordre : la config, puis le DOMAINE qui
           correspond, puis n'importe quel domaine, puis le préfixe le plus
           court — le plus englobant. */
        $site = (string) ($cfg['gsc_site'] ?? '');
        $moi = preg_replace('/^www\./', '', strtolower((string) ($_SERVER['HTTP_HOST'] ?? '')));
        if ($site === '') {
            foreach ($toutes as $u_s) {
                if (str_starts_with($u_s, 'sc-domain:')
                    && $moi !== '' && strtolower(substr($u_s, 10)) === $moi) { $site = $u_s; break; }
            }
        }
        if ($site === '') {
            foreach ($toutes as $u_s) { if (str_starts_with($u_s, 'sc-domain:')) { $site = $u_s; break; } }
        }
        if ($site === '' && $toutes) {
            $courts = $toutes;
            usort($courts, static fn($a, $b) => strlen($a) <=> strlen($b));
            $site = $courts[0];
        }
        if ($site !== '') {
            $enc = rawurlencode($site);
            $gsc = ['site' => $site, 'releve' => date('c'), 'sitemaps' => [], 'perf28' => null, 'perf_jour' => null];

            $sm = $gscAppel("https://www.googleapis.com/webmasters/v3/sites/$enc/sitemaps", $jeton);
            foreach (($sm['sitemap'] ?? []) as $x) {
                $soumises = 0;
                foreach (($x['contents'] ?? []) as $c) { $soumises += (int) ($c['submitted'] ?? 0); }
                $gsc['sitemaps'][] = [
                    'chemin'      => (string) ($x['path'] ?? ''),
                    'soumises'    => $soumises,
                    'erreurs'     => (int) ($x['errors'] ?? 0),
                    'avertis'     => (int) ($x['warnings'] ?? 0),
                    'index'       => !empty($x['isSitemapsIndex']),
                    'telecharge'  => (string) ($x['lastDownloaded'] ?? ''),
                ];
            }

            $req = static fn(string $d1, string $d2, array $dim = []): array =>
                ['startDate' => $d1, 'endDate' => $d2, 'dimensions' => $dim, 'rowLimit' => 30];
            $u = "https://www.googleapis.com/webmasters/v3/sites/$enc/searchAnalytics/query";

            $p28 = $gscAppel($u, $jeton, $req(date('Y-m-d', strtotime('-28 days')), date('Y-m-d')));
            if (!empty($p28['rows'][0])) {
                $r0 = $p28['rows'][0];
                $gsc['perf28'] = ['clics' => (int) $r0['clicks'], 'impressions' => (int) $r0['impressions'],
                                  'ctr' => round((float) $r0['ctr'], 5), 'position' => round((float) $r0['position'], 2)];
            }
            // dernier jour REMPLI (la donnée Google a 2-3 jours de retard)
            $pj = $gscAppel($u, $jeton, $req(date('Y-m-d', strtotime('-10 days')), date('Y-m-d'), ['date']));
            $lignes = $pj['rows'] ?? [];
            if ($lignes) {
                $d = end($lignes);
                $gsc['perf_jour'] = ['date' => (string) $d['keys'][0], 'clics' => (int) $d['clicks'],
                                     'impressions' => (int) $d['impressions'],
                                     'ctr' => round((float) $d['ctr'], 5), 'position' => round((float) $d['position'], 2)];
            }

            /* Pays, côté Search Console : une autre question que celle des logs
               — « dans quels pays Google me montre-t-il », et non « d'où
               viennent mes visiteurs ». Les deux se complètent, aucune ne
               remplace l'autre. */
            $pc = $gscAppel($u, $jeton, $req(date('Y-m-d', strtotime('-28 days')), date('Y-m-d'), ['country']));
            $gsc['pays'] = [];
            foreach (($pc['rows'] ?? []) as $x) {
                $gsc['pays'][] = ['code' => strtoupper((string) $x['keys'][0]),
                                  'clics' => (int) $x['clicks'], 'impressions' => (int) $x['impressions'],
                                  'position' => round((float) $x['position'], 2)];
            }
        }
    }
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
$extra = ['fb' => $fb, 'journal' => $journal, 'source' => 'logs', 'collecte' => date('c')];
// ── Formulaires (owner, 02/09/2026) : envois et tentatives du jour, lus dans
// _secret/formulaires.log (écrit par contact.php / faisabilite.php, sans donnée
// personnelle), et SANTÉ de la clé Turnstile — le jour où Cloudflare l'a rejetée,
// chaque humain recevait une 403 sans que personne ne le sache. Désormais le
// collecteur le vérifie chaque nuit et alerte le propriétaire (1 e-mail / 24 h).
require_once __DIR__ . '/formulaires.php';
$formulaires = nsy_form_events_du_jour($target);
if ($formulaires) $extra['formulaires'] = $formulaires;
$cfgSite = @include __DIR__ . '/_secret/config.php';
if (is_array($cfgSite) && !empty($cfgSite['turnstile_secret']) && !str_starts_with((string) $cfgSite['turnstile_secret'], 'CHANGE_ME')) {
    $ts = nsy_turnstile_sante((string) $cfgSite['turnstile_secret']);
    $extra['turnstile'] = ['ok' => $ts['ok'], 'raison' => $ts['raison']];
    if (!$ts['ok']) {
        nsy_alerte_owner($cfgSite, '[NSY] Clé Turnstile rejetée par Cloudflare — formulaires en mode dégradé',
            "Contrôle quotidien du collecteur KPI : la clé secrète Turnstile n'est pas acceptée (" . $ts['raison'] . ").\n\n"
            . "Les formulaires fonctionnent SANS ce contrôle (honeypot, cadence, plafond et score anti-spam restent actifs).\n"
            . "À faire : Cloudflare > Turnstile > widget nsy.fr > régénérer la clé secrète, la reporter dans _secret/config.php, redéployer.\n"
            . "Cette alerte est envoyée au plus une fois par 24 h tant que la clé reste rejetée.\n", 'turnstile-quotidien');
    }
}
if ($pays !== null) $extra['pays'] = $pays;
if ($avis) $extra['avis'] = $avis;
if ($favicons !== null) $extra['favicons'] = $favicons;
// L'écriture REMPLACE l'entrée du jour : sans ce report, relancer une date déjà
// collectée effacerait les blocs qui n'ont pas pu être recollectés (GitHub hors
// de sa fenêtre de 14 jours, YouTube volontairement muet en rattrapage).
foreach (['github' => $github, 'youtube' => $youtube, 'gsc' => $gsc] as $cle => $frais) {
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
