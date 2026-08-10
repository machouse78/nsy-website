<?php
/**
 * Tests d'intégration HTTP des formulaires — le VRAI code (contact.php,
 * faisabilite.php, antispam.php + PHPMailer) copié tel quel dans un bac à
 * sable servi par `php -S`, avec un _secret/config.php FACTICE :
 *   - turnstile_secret vide → la vérification Cloudflare est sautée (comme le
 *     prévoit le code), toute la validation devient atteignable hors ligne ;
 *   - SMTP pointé sur un port fermé → une soumission valide atteint l'étape
 *     d'envoi et échoue proprement, AUCUN email réel ne part.
 * Lancer via tests/run-tests.sh (docker php).
 */
declare(strict_types=1);

$fail = 0;
function t(string $name, bool $ok, string $info = ''): void {
    global $fail;
    echo ($ok ? "  ✓ " : "  ✗ ÉCHEC ") . $name . ($ok || $info === '' ? '' : " — $info") . "\n";
    if (!$ok) $fail++;
}

// ── Bac à sable : code réel + config factice ──
$APP = dirname(__DIR__);
$SB  = sys_get_temp_dir() . '/nsy-forms-sb';
exec('rm -rf ' . escapeshellarg($SB));
@mkdir($SB . '/_secret', 0777, true);
@mkdir($SB . '/vendor/PHPMailer/src', 0777, true);
foreach (['contact.php', 'faisabilite.php', 'antispam.php', 'journal-stats.php'] as $f) copy("$APP/$f", "$SB/$f");
file_put_contents("$SB/fake-article.html", '<html></html>');
foreach (glob("$APP/vendor/PHPMailer/src/*.php") as $f) copy($f, "$SB/vendor/PHPMailer/src/" . basename($f));
file_put_contents("$SB/_secret/config.php", <<<'CFG'
<?php return [
  'turnstile_secret' => '',
  'smtp_host' => '127.0.0.1', 'smtp_port' => 2599, 'smtp_secure' => 'tls',
  'smtp_username' => 'sandbox@example.invalid', 'smtp_password' => 'x',
  'to_address' => 'owner@example.invalid', 'to_name' => 'NSY test',
];
CFG);

$port = 8199;
$proc = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $SB],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
usleep(500000);

function req(string $path, ?array $post): array {
    global $port;
    $opts = ['http' => ['ignore_errors' => true, 'timeout' => 40]];
    if ($post !== null) {
        $opts['http']['method']  = 'POST';
        $opts['http']['header']  = "Content-Type: application/x-www-form-urlencoded\r\n";
        $opts['http']['content'] = http_build_query($post);
    }
    $body = file_get_contents("http://127.0.0.1:$port$path", false, stream_context_create($opts));
    preg_match('#HTTP/\S+ (\d+)#', $http_response_header[0] ?? '', $m);
    return [(int)($m[1] ?? 0), json_decode((string)$body, true) ?: []];
}
/** Efface throttle 60 s + plafonds journaliers entre les cas (mêmes fichiers temp). */
function resetLimits(): void {
    foreach (glob(sys_get_temp_dir() . '/nsy_rate_*') as $f) @unlink($f);
    foreach (glob(sys_get_temp_dir() . '/nsy_cap_*') as $f) @unlink($f);
}

$VALID = ['lang' => 'fr', 'name' => 'Marie Dupont', 'email' => 'marie@exemple.fr',
          'message' => 'Bonjour, nous aimerions échanger sur une migration Java EE.',
          'service' => 'consulting', 'timing' => 'now'];

// ── contact.php ──
resetLimits();
[$c, $j] = req('/contact.php', null);
t('contact GET → 405', $c === 405 && ($j['ok'] ?? null) === false, "code $c");

[$c, $j] = req('/contact.php', $VALID + ['website' => 'http://spam']);
t('contact honeypot → faux succès silencieux', $c === 200 && ($j['ok'] ?? false) === true, "code $c");

[$c, $j] = req('/contact.php', ['lang' => 'fr']);
t('contact champs manquants → 400 FR', $c === 400
    && str_contains($j['error'] ?? '', 'Nom invalide') && str_contains($j['error'] ?? '', 'Email invalide'), "code $c");

[$c, $j] = req('/contact.php', ['lang' => 'en']);
t('contact mêmes erreurs en EN (champ lang)', $c === 400 && str_contains($j['error'] ?? '', 'Invalid name'), "code $c");

[$c, $j] = req('/contact.php', ['lang' => 'fr', 'name' => 'Marie Dupont', 'email' => 'pas-un-email',
    'message' => 'Bonjour, message suffisamment long pour la validation.']);
t('contact email invalide seul → 400', $c === 400
    && str_contains($j['error'] ?? '', 'Email invalide') && !str_contains($j['error'] ?? '', 'Nom'), "code $c");

[$c, $j] = req('/contact.php', ['lang' => 'fr', 'name' => 'Marie', 'email' => 'm@exemple.fr', 'message' => 'court']);
t('contact message trop court → 400', $c === 400 && str_contains($j['error'] ?? '', 'trop court'), "code $c");

resetLimits();
[$c, $j] = req('/contact.php', ['lang' => 'fr', 'name' => 'Spammeur', 'email' => 'x@promo.ru',
    'message' => 'Buy backlink packages https://a.ru https://b.ru make money now']);
t('contact contenu spam → faux succès silencieux (aucun envoi)', $c === 200 && ($j['ok'] ?? false) === true, "code $c");
t('contact spam journalisé (_secret/spam.log)', str_contains((string)@file_get_contents("$SB/_secret/spam.log"), 'score='));

resetLimits();
[$c, $j] = req('/contact.php', $VALID);
t("contact valide → atteint l'envoi SMTP (échec propre en bac à sable)", $c === 500 && str_contains($j['error'] ?? '', 'envoi'), "code $c");

[$c, $j] = req('/contact.php', $VALID);
t('contact re-soumission < 60 s → 429 throttle', $c === 429, "code $c");

resetLimits();
for ($i = 0; $i < 5; $i++) {
    foreach (glob(sys_get_temp_dir() . '/nsy_rate_*') as $f) @unlink($f);
    req('/contact.php', $VALID);
}
foreach (glob(sys_get_temp_dir() . '/nsy_rate_*') as $f) @unlink($f);
[$c, $j] = req('/contact.php', $VALID);
t('contact plafond 5/jour/IP → 429', $c === 429 && str_contains($j['error'] ?? '', 'aujourd'), "code $c");

// ── faisabilite.php ──
resetLimits();
[$c, $j] = req('/faisabilite.php', null);
t('faisabilite GET → 405', $c === 405, "code $c");

[$c, $j] = req('/faisabilite.php', ['lang' => 'fr', 'website' => 'x']);
t('faisabilite honeypot → faux succès', $c === 200 && ($j['ok'] ?? false) === true, "code $c");

[$c, $j] = req('/faisabilite.php', ['lang' => 'fr', 'contact_nom' => 'Marie Dupont',
    'contact_email' => 'm@exemple.fr', 'payload' => '{}']);
t('faisabilite questionnaire vide → 400', $c === 400 && str_contains($j['error'] ?? '', 'Questionnaire'), "code $c");

[$c, $j] = req('/faisabilite.php', ['lang' => 'fr', 'contact_nom' => 'M', 'contact_email' => 'm@exemple.fr',
    'payload' => json_encode(['projet' => 'Site vitrine'])]);
t('faisabilite nom trop court → 400', $c === 400 && str_contains($j['error'] ?? '', 'Nom invalide'), "code $c");

resetLimits();
[$c, $j] = req('/faisabilite.php', ['lang' => 'fr', 'contact_nom' => 'Marie Dupont', 'contact_email' => 'm@exemple.fr',
    'payload' => json_encode(['projet' => 'Site vitrine avec chatbot', 'delai' => 'à cadrer'])]);
t("faisabilite valide → atteint l'envoi SMTP (échec propre en bac à sable)", $c === 500, "code $c");

// ── journal-stats.php ──
resetLimits();
[$c, $j] = req('/journal-stats.php', null);
t('jstats GET → 405', $c === 405, "code $c");

function jreq(array $payload): array {
    global $port;
    $opts = ['http' => ['method' => 'POST', 'ignore_errors' => true, 'timeout' => 20,
        'header' => "Content-Type: application/json\r\nOrigin: http://localhost\r\n",
        'content' => json_encode($payload)]];
    $body = file_get_contents("http://127.0.0.1:$port/journal-stats.php", false, stream_context_create($opts));
    preg_match('#HTTP/\S+ (\d+)#', $http_response_header[0] ?? '', $m);
    return [(int)($m[1] ?? 0), json_decode((string)$body, true) ?: []];
}
[$c, $j] = jreq(['slug' => 'nexiste-pas.html', 'action' => 'view']);
t('jstats slug inconnu → 400', $c === 400, "code $c");
[$c, $j] = jreq(['slug' => '../_secret/config.php', 'action' => 'view']);
t('jstats slug hors pattern → 400', $c === 400, "code $c");
[$c, $j] = jreq(['slug' => 'fake-article.html', 'action' => 'view']);
t('jstats vue comptée', $c === 200 && ($j['views'] ?? 0) === 1, "code $c views " . ($j['views'] ?? '—'));
[$c, $j] = jreq(['slug' => 'fake-article.html', 'action' => 'like']);
t('jstats like', ($j['likes'] ?? 0) === 1);
[$c, $j] = jreq(['slug' => 'fake-article.html', 'action' => 'unlike']);
t('jstats unlike (plancher 0 ensuite)', ($j['likes'] ?? -1) === 0);
[$c, $j] = jreq(['slug' => 'fake-article.html', 'action' => 'unlike']);
t('jstats unlike sous 0 impossible', ($j['likes'] ?? -1) === 0);
[$c, $j] = jreq(['slug' => 'fake-article.html', 'action' => 'get']);
t('jstats get sans effet de bord', ($j['views'] ?? 0) === 1 && ($j['likes'] ?? -1) === 0);

proc_terminate($proc);
exec('rm -rf ' . escapeshellarg($SB));
echo $fail === 0 ? "FORMS-HTTP : TOUS LES TESTS PASSENT\n" : "FORMS-HTTP : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
