<?php
/**
 * Tests d'intégration HTTP de la newsletter — le VRAI code (newsletter.php,
 * formulaires.php, antispam.php + PHPMailer) copié tel quel dans un bac à sable
 * servi par `php -S`, avec un _secret/config.php FACTICE :
 *   - boîte aux lettres factice (auto_prepend_file → NL_ENVOI_MAIL) : le mail
 *     de confirmation est capturé dans un fichier, rien ne sort ;
 *   - puis SMTP RÉEL de PHPMailer pointé sur un port fermé : l'échec d'envoi
 *     est rejoué sans qu'aucun e-mail ne puisse partir ;
 *   - la sortie d'erreur de `php -S` tient lieu de journal d'erreurs de
 *     l'HÉBERGEMENT (~/ik-logs/error.log) : il doit rester vierge.
 * Lancer via tests/run-tests.sh (docker php:8.5-cli-alpine).
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
$SB  = sys_get_temp_dir() . '/nsy-newsletter-sb';
exec('rm -rf ' . escapeshellarg($SB));
@mkdir($SB . '/_secret', 0777, true);
@mkdir($SB . '/vendor/PHPMailer/src', 0777, true);
foreach (['newsletter.php', 'formulaires.php', 'antispam.php'] as $f) copy("$APP/$f", "$SB/$f");
foreach (glob("$APP/vendor/PHPMailer/src/*.php") as $f) copy($f, "$SB/vendor/PHPMailer/src/" . basename($f));
$CFG = <<<'CFG'
<?php return [
  'turnstile_secret' => '',
  'smtp_host' => '127.0.0.1', 'smtp_port' => 2599, 'smtp_secure' => 'tls',
  'smtp_username' => 'sandbox@example.invalid', 'smtp_password' => 'x',
  'to_address' => 'owner@example.invalid', 'to_name' => 'NSY test',
];
CFG;
file_put_contents("$SB/_secret/config.php", $CFG);
// Témoin d'alerte récent : l'alerte owner est tentée mais étouffée (1 / 24 h) —
// aucune connexion SMTP de plus, et le chemin reste vérifiable dans alertes.log.
touch("$SB/_secret/alerte-newsletter.txt");

$BOITE = "$SB/boite.jsonl";                        // boîte aux lettres factice
$REEL  = "$SB/smtp-reel";                          // présent → PHPMailer réel (port fermé)
$PRE   = sys_get_temp_dir() . '/nsy-newsletter-sb-prepend.php';
file_put_contents($PRE, "<?php\nif (!is_file(" . var_export($REEL, true) . ")) {\n"
    . "    \$GLOBALS['NL_ENVOI_MAIL'] = static function (array \$m): void {\n"
    . "        file_put_contents(" . var_export($BOITE, true) . ", json_encode(\$m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . \"\\n\", FILE_APPEND);\n"
    . "    };\n}\n");
$HOTE = sys_get_temp_dir() . '/nsy-newsletter-sb-journal-hebergeur.log';   // stderr de php -S
@unlink($HOTE);

$port = 8198;
$proc = proc_open(['php', '-d', "auto_prepend_file=$PRE", '-S', "127.0.0.1:$port", '-t', $SB],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', $HOTE, 'w']], $pipes);
usleep(500000);

/** Requête → [code, corps brut, en-têtes]. */
function req(string $method, string $path, ?array $post = null, array $headers = []): array {
    global $port;
    $h = $headers;
    $opts = ['http' => ['method' => $method, 'ignore_errors' => true, 'timeout' => 40]];
    if ($post !== null) {
        $h[] = 'Content-Type: application/x-www-form-urlencoded';
        $opts['http']['content'] = http_build_query($post);
    }
    $opts['http']['header'] = implode("\r\n", $h) . ($h ? "\r\n" : '');
    $body = @file_get_contents("http://127.0.0.1:$port$path", false, stream_context_create($opts));
    $hdrs = $http_response_header ?? [];
    preg_match('#HTTP/\S+ (\d+)#', $hdrs[0] ?? '', $m);
    return [(int) ($m[1] ?? 0), (string) $body, implode("\n", $hdrs)];
}
/** Inscription comme js/app.js : Accept JSON, Origin du site, horodatages à 3 s d'écart. */
function inscrire(string $email, string $lang = 'fr', array $plus = []): array {
    global $port;
    $t = (int) (microtime(true) * 1000);
    return req('POST', '/newsletter.php?action=inscrire',
        $plus + ['email' => $email, 'lang' => $lang, 'website' => '', 'rendu' => (string) ($t - 3000), 'envoi' => (string) $t],
        ['Accept: application/json', "Origin: http://localhost:$port"]);
}
function abonnes(): array {
    global $SB;
    $d = json_decode((string) @file_get_contents("$SB/_secret/newsletter.json"), true);
    return is_array($d) ? ($d['abonnes'] ?? []) : [];
}
function fiche(string $email): ?array {
    foreach (abonnes() as $a) if (($a['email'] ?? '') === $email) return $a;
    return null;
}
function boite(): array {
    global $BOITE;
    return array_map(static fn($l) => json_decode($l, true), file($BOITE, FILE_IGNORE_NEW_LINES) ?: []);
}
function dernierEvenement(): array {
    global $SB;
    $l = file("$SB/_secret/formulaires.log", FILE_IGNORE_NEW_LINES) ?: [];
    return json_decode((string) end($l), true) ?: [];
}
function journalHebergeur(): array {
    global $HOTE;
    $l = preg_split('/\R/', (string) @file_get_contents($HOTE)) ?: [];
    return array_values(array_filter($l, static fn($x) => $x !== ''
        && !preg_match('/\] (PHP \S+ Development Server|127\.0\.0\.1:\d+ (Accepted|Closing)|127\.0\.0\.1:\d+ \[\d{3}\]:)/', $x)));
}
function resetLimits(): void {
    foreach (glob(sys_get_temp_dir() . '/nsy_cap_newsletter_*') as $f) @unlink($f);
}
resetLimits();

// ── Routage ──
[$c, $b] = req('GET', '/newsletter.php');
t('sans action → 400, page bilingue', $c === 400 && str_contains($b, 'Requête invalide') && str_contains($b, 'Invalid request'), "code $c");
[$c, $b, $h] = req('GET', '/newsletter.php?action=inscrire');
t('inscrire en GET → 405', $c === 405 && str_contains($h, 'Allow: POST'), "code $c");
t('en-tête X-Robots-Tag noindex', str_contains($h, 'X-Robots-Tag: noindex'));

// ── Refus visibles, en JSON ──
[$c, $b] = inscrire('pas-un-email');
$j = json_decode($b, true) ?: [];
t('adresse invalide → 400, message FR clair', $c === 400 && ($j['ok'] ?? null) === false && ($j['error'] ?? '') === 'Adresse e-mail invalide.', "code $c $b");
[$c, $b] = inscrire('pas-un-email', 'en');
t('adresse invalide → message EN', $c === 400 && (json_decode($b, true)['error'] ?? '') === 'Invalid email address.', $b);
[$c, $b] = req('POST', '/newsletter.php?action=inscrire', ['email' => 'x@exemple.fr', 'lang' => 'fr'],
    ['Accept: application/json', 'Origin: https://pirate.example']);
t('origine étrangère → 403', $c === 403 && str_contains($b, 'depuis le site'), "code $c");
$t0 = (int) (microtime(true) * 1000);
[$c, $b] = inscrire('rapide@exemple.fr', 'fr', ['rendu' => (string) $t0, 'envoi' => (string) ($t0 + 800)]);
t('envoi en 0,8 s → 400 « trop rapide », visible (un humain peut réessayer)', $c === 400 && str_contains($b, 'trop rapide'), "code $c $b");
t('… événement trop_rapide, rien d\'enregistré', (dernierEvenement()['issue'] ?? '') === 'trop_rapide' && fiche('rapide@exemple.fr') === null);

// ── Inscription (boîte factice) ──
[$c, $B1] = inscrire('marie@exemple.fr');
$marie = fiche('marie@exemple.fr');
t('inscription → 200 {ok, message}', $c === 200 && $B1 === '{"ok":true,"message":"Vérifiez votre boîte mail pour confirmer."}', "code $c $B1");
t('… fiche en attente, jeton de 32 hex, champs limités', ($marie['etat'] ?? '') === 'attente' && preg_match('/^[a-f0-9]{32}$/', $marie['jeton'] ?? '')
    && array_keys($marie) === ['email', 'langue', 'etat', 'jeton', 'inscrit', 'confirme', 'desinscrit']);
$mails = boite();
t('… un mail de confirmation, à cette adresse, avec le lien personnel', count($mails) === 1 && $mails[0]['a'] === 'marie@exemple.fr'
    && str_contains($mails[0]['texte'], 'newsletter.php?action=confirmer&t=' . $marie['jeton']));
$e = dernierEvenement();
t('… événement inscription, langue, sans adresse', ($e['form'] ?? '') === 'newsletter' && ($e['issue'] ?? '') === 'inscription' && ($e['lang'] ?? '') === 'fr');

[$c, $b] = inscrire('Marie@Exemple.fr');
t('même adresse aussitôt → réponse IDENTIQUE, aucun second mail (cadence)', $c === 200 && $b === $B1 && count(boite()) === 1
    && (dernierEvenement()['issue'] ?? '') === 'cadence', "code $c $b");

[$c, $b] = inscrire('robot@exemple.fr', 'fr', ['website' => 'http://spam.example']);
t('honeypot → réponse IDENTIQUE, rien d\'enregistré, aucun mail', $c === 200 && $b === $B1 && fiche('robot@exemple.fr') === null
    && count(boite()) === 1 && (dernierEvenement()['issue'] ?? '') === 'honeypot');
[$c, $b] = inscrire('robot2@exemple.fr', 'fr', ['rendu' => 'abc', 'envoi' => 'def']);
t('horodatage falsifié → réponse IDENTIQUE, rien d\'enregistré', $c === 200 && $b === $B1 && fiche('robot2@exemple.fr') === null
    && (dernierEvenement()['issue'] ?? '') === 'horodatage');

// ── Confirmation ──
[$c, $b] = req('HEAD', '/newsletter.php?action=confirmer&t=' . $marie['jeton']);
t('HEAD sur le lien (sonde) → 200 sans rien modifier', $c === 200 && (fiche('marie@exemple.fr')['etat'] ?? '') === 'attente', "code $c");
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=' . $marie['jeton']);
t('GET sur le lien (antivirus qui l\'ouvre) → page à bouton, RIEN ne change', $c === 200 && str_contains($b, 'Confirmer mon inscription')
    && str_contains($b, '<form method="post" action="/newsletter.php?action=confirmer&amp;t=' . $marie['jeton'] . '"')
    && (fiche('marie@exemple.fr')['etat'] ?? '') === 'attente', "code $c");
[$c, $b] = req('POST', '/newsletter.php?action=confirmer&t=' . $marie['jeton'], []);
$f = fiche('marie@exemple.fr');
t('confirmer (POST du bouton) → 200, page « Inscription confirmée », état confirme + date', $c === 200 && str_contains($b, 'Inscription confirmée')
    && str_contains($b, '<html lang="fr"') && ($f['etat'] ?? '') === 'confirme' && !empty($f['confirme']), "code $c");
t('… page noindex, sans l\'adresse', str_contains($b, 'noindex') && !str_contains($b, 'marie@exemple.fr'));
t('… logo et liens du même site : aucune URL absolue (une copie de test n\'appelle jamais la production)',
    str_contains($b, 'src="/public/nsy-logo.png"') && !preg_match('#(src|href)="https?://#', $b));
t('… événement confirmation', (dernierEvenement()['issue'] ?? '') === 'confirmation');
[$c, $b] = req('POST', '/newsletter.php?action=confirmer&t=' . $marie['jeton'], []);
t('confirmer à nouveau (POST) → « déjà confirmée », date inchangée', $c === 200 && str_contains($b, 'déjà confirmée')
    && (fiche('marie@exemple.fr')['confirme'] ?? '') === $f['confirme']);
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=' . $marie['jeton']);
t('lien de confirmation rouvert (GET) → « déjà confirmée », sans bouton', $c === 200 && str_contains($b, 'déjà confirmée')
    && (fiche('marie@exemple.fr')['confirme'] ?? '') === $f['confirme']);

[$c, $b] = inscrire('marie@exemple.fr');
t('adresse CONFIRMÉE réinscrite → réponse IDENTIQUE, aucun mail (ne pas révéler qui est abonné)',
    $c === 200 && $b === $B1 && count(boite()) === 1 && (dernierEvenement()['issue'] ?? '') === 'deja_inscrit');

// ── Anglais ──
[$c, $b] = inscrire('john@example.co.uk', 'en');
$john = fiche('john@example.co.uk');
$mails = boite();
t('inscription EN → message anglais, mail anglais', $c === 200 && str_contains($b, 'Check your inbox')
    && str_starts_with(end($mails)['sujet'], 'Confirm your subscription'), $b);
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=' . $john['jeton']);
t('lien EN → bouton anglais', $c === 200 && str_contains($b, 'Confirm my subscription') && str_contains($b, '<html lang="en"'));
[$c, $b] = req('POST', '/newsletter.php?action=confirmer&t=' . $john['jeton'], []);
t('confirmation EN → page anglaise', $c === 200 && str_contains($b, 'Subscription confirmed') && str_contains($b, '<html lang="en"'));

// ── Liens invalides ──
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=nimporte-quoi');
t('jeton mal formé → 404, page bilingue', $c === 404 && str_contains($b, 'Lien inconnu') && str_contains($b, 'Unknown or expired link'), "code $c");
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=' . str_repeat('ab', 16));
t('jeton inconnu → 404', $c === 404, "code $c");
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t[]=x');
t('jeton en tableau → 404, sans avertissement PHP', $c === 404, "code $c");
[$c, $b] = req('PUT', '/newsletter.php?action=confirmer&t=' . $marie['jeton'], []);
t('confirmer en PUT → 405', $c === 405, "code $c");

// ── Désinscription ──
[$c, $b] = req('POST', '/newsletter.php?action=desinscrire&t=' . $marie['jeton'], ['List-Unsubscribe' => 'One-Click']);
$f = fiche('marie@exemple.fr');
t('désinscription en un clic (POST RFC 8058, sans Origin) → 200, état desinscrit + date', $c === 200
    && ($f['etat'] ?? '') === 'desinscrit' && !empty($f['desinscrit']), "code $c");
$e = dernierEvenement();
t('… événement desinscription, mode un_clic', ($e['issue'] ?? '') === 'desinscription' && ($e['mode'] ?? '') === 'un_clic');
[$c, $b] = req('GET', '/newsletter.php?action=desinscrire&t=' . $john['jeton']);
t('lien de désinscription (GET) → bouton anglais, RIEN ne change', $c === 200 && str_contains($b, 'Unsubscribe me')
    && (fiche('john@example.co.uk')['etat'] ?? '') === 'confirme');
[$c, $b] = req('POST', '/newsletter.php?action=desinscrire&t=' . $john['jeton'], []);
t('désinscription par le bouton (POST) → page anglaise, mode bouton', $c === 200 && str_contains($b, 'You are unsubscribed')
    && (fiche('john@example.co.uk')['etat'] ?? '') === 'desinscrit' && (dernierEvenement()['mode'] ?? '') === 'bouton');
[$c, $b] = req('GET', '/newsletter.php?action=desinscrire&t=' . $john['jeton']);
t('désinscription répétée → « already unsubscribed »', $c === 200 && str_contains($b, 'Already unsubscribed'));
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=' . $john['jeton']);
t('vieux lien de confirmation après désinscription → ne réabonne pas', $c === 200 && str_contains($b, 'Address unsubscribed')
    && (fiche('john@example.co.uk')['etat'] ?? '') === 'desinscrit');

[$c, $b] = inscrire('marie@exemple.fr');
$f = fiche('marie@exemple.fr');
t('réinscription après désinscription → attente, NOUVEAU jeton, mail envoyé', $c === 200 && ($f['etat'] ?? '') === 'attente'
    && $f['jeton'] !== $marie['jeton'] && count(boite()) === 3);
[$c, $b] = req('GET', '/newsletter.php?action=desinscrire&t=' . $marie['jeton']);
t('… l\'ancien jeton ne vaut plus rien (404)', $c === 404, "code $c");

// ── Sans JS : page HTML, horodatages absents acceptés (fail-open) ──
[$c, $b, $h] = req('POST', '/newsletter.php?action=inscrire', ['email' => 'sansjs@exemple.fr', 'lang' => 'fr', 'website' => '']);
t('formulaire sans JS → 200, page HTML « Vérifiez votre boîte mail »', $c === 200 && str_contains($h, 'text/html')
    && str_contains($b, 'Vérifiez votre boîte mail') && (fiche('sansjs@exemple.fr')['etat'] ?? '') === 'attente', "code $c");
t('… événement marqué « horodatage absent »', (dernierEvenement()['horodatage'] ?? '') === 'absent');

// ── Purge des attentes à l'écriture suivante ──
$d = json_decode((string) file_get_contents("$SB/_secret/newsletter.json"), true);
$d['abonnes'][] = ['email' => 'oublie@exemple.fr', 'langue' => 'fr', 'etat' => 'attente', 'jeton' => str_repeat('cd', 16),
    'inscrit' => date('c', time() - 31 * 86400), 'confirme' => null, 'desinscrit' => null];
file_put_contents("$SB/_secret/newsletter.json", json_encode($d));
[$c, $b] = req('GET', '/newsletter.php?action=confirmer&t=' . str_repeat('cd', 16));
t('attente de 31 jours : lien expiré (404) dès la lecture', $c === 404, "code $c");
[$c, $b] = req('POST', '/newsletter.php?action=confirmer&t=' . str_repeat('cd', 16), []);
t('… et fiche purgée à l\'écriture suivante', $c === 404 && fiche('oublie@exemple.fr') === null, "code $c");

// ── Plafond journalier par IP ──
resetLimits();
for ($i = 1; $i <= 10; $i++) inscrire("lot$i@exemple.fr");
[$c, $b] = inscrire('lot11@exemple.fr');
t('11ᵉ inscription du jour depuis la même IP → 429 visible', $c === 429 && str_contains($b, 'réessayez demain') && fiche('lot11@exemple.fr') === null, "code $c $b");
resetLimits();

// ── SMTP réel sur port fermé : échec visible, rien d'enregistré ──
touch($REEL);
$avant = count(boite());
[$c, $b] = inscrire('echec@exemple.fr');
t('SMTP en panne → 500, message clair', $c === 500 && str_contains($b, 'n\'a pas pu partir'), "code $c $b");
t('… inscription annulée (aucune fiche), aucun mail factice', fiche('echec@exemple.fr') === null && count(boite()) === $avant);
t('… événement erreur_envoi', (dernierEvenement()['issue'] ?? '') === 'erreur_envoi');
$diag = (string) @file_get_contents("$SB/_secret/newsletter-diag.log");
t('… détail dans _secret/newsletter-diag.log, adresse masquée', str_contains($diag, 'SMTP (confirmation)') && !str_contains($diag, 'echec@exemple.fr'), $diag);
t('… alerte owner tentée (étouffée par le témoin 24 h)', str_contains((string) @file_get_contents("$SB/_secret/alertes.log"), '| newsletter | ÉTOUFFÉE'));
[$c, $b] = inscrire('echec@exemple.fr');
t('nouvel essai aussitôt → nouvelle tentative (500), pas un faux succès « cadence »', $c === 500, "code $c");
@unlink($REEL);

// ── Configuration absente, stockage cassé ──
rename("$SB/_secret/config.php", "$SB/_secret/config.php.off");
[$c, $b] = inscrire('config@exemple.fr');
t('config.php absent → 500 clair, événement erreur_config', $c === 500 && str_contains($b, 'impossible pour le moment')
    && (dernierEvenement()['issue'] ?? '') === 'erreur_config', "code $c");
rename("$SB/_secret/config.php.off", "$SB/_secret/config.php");
$sain = (string) file_get_contents("$SB/_secret/newsletter.json");
file_put_contents("$SB/_secret/newsletter.json", '{"format":1,"abonnes":[{"em');
[$c, $b] = inscrire('casse@exemple.fr');
t('newsletter.json cassé → 500 clair, fichier LAISSÉ INTACT', $c === 500 && str_contains($b, 'impossible pour le moment')
    && (string) file_get_contents("$SB/_secret/newsletter.json") === '{"format":1,"abonnes":[{"em'
    && (dernierEvenement()['issue'] ?? '') === 'erreur_stockage', "code $c");
[$c, $b] = req('GET', '/newsletter.php?action=desinscrire&t=' . $f['jeton']);
t('… désinscription pendant la panne → 503, page claire', $c === 503 && str_contains($b, 'indisponible'), "code $c");
file_put_contents("$SB/_secret/newsletter.json", $sain);

// ── Données personnelles et journaux ──
$log = (string) @file_get_contents("$SB/_secret/formulaires.log");
t('formulaires.log : aucune adresse e-mail', $log !== '' && !str_contains($log, '@'));
$diag = (string) @file_get_contents("$SB/_secret/newsletter-diag.log");
t('newsletter-diag.log : aucune adresse, aucun avertissement PHP', !str_contains($diag, '@') && !str_contains($diag, 'PHP ['), $diag);
$cles = array_unique(array_merge(...array_map('array_keys', abonnes())));
sort($cles);
t('newsletter.json : seulement e-mail, langue, état, jeton, dates (pas d\'IP)',
    $cles === ['confirme', 'desinscrit', 'email', 'etat', 'inscrit', 'jeton', 'langue'], implode(',', $cles));
$hote = journalHebergeur();
t('journal de l\'hébergeur VIERGE sur tous les chemins (SMTP en panne compris)', $hote === [], implode(' | ', $hote));

proc_terminate($proc);
exec('rm -rf ' . escapeshellarg($SB));
@unlink($PRE);
@unlink($HOTE);
echo $fail === 0 ? "NEWSLETTER-HTTP : TOUS LES TESTS PASSENT\n" : "NEWSLETTER-HTTP : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
