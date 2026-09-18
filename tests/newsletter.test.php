<?php
/**
 * Tests unitaires de la newsletter (newsletter.php — code RÉEL, chargé en mode
 * bibliothèque) : adresses, jetons, transitions d'état, purge des attentes,
 * stockage (verrou, fichier cassé jamais réécrit), comptes sans donnée
 * personnelle, pièges anti-robot, message de confirmation, traces de
 * diagnostic, garde-fou d'erreurs, et aucun error_log() sans destination.
 *
 * error_reporting(E_ALL) + un gestionnaire qui rend CHAQUE avertissement
 * visible : un test vert sous PHP 8.5 = aucun avertissement, dépréciations
 * comprises. Lancer via tests/run-tests.sh (docker php:8.5-cli-alpine).
 */
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '1');
$AVERTISSEMENTS = [];
set_error_handler(static function (int $no, string $msg, string $f = '', int $l = 0) use (&$AVERTISSEMENTS): bool {
    if (!(error_reporting() & $no)) return true;   // appel préfixé par @ : voulu (E_ALL sinon, dépréciations comprises)
    $AVERTISSEMENTS[] = "[$no] $msg @ " . basename($f) . ":$l";
    echo "  ⚠ AVERTISSEMENT PHP [$no] $msg @ " . basename($f) . ":$l\n";
    return true;
});

$TMP = sys_get_temp_dir() . '/nsy-newsletter-unit-' . bin2hex(random_bytes(4));
mkdir($TMP, 0777, true);
define('NL_BIBLIOTHEQUE', true);
define('NL_SECRET', $TMP);                 // rien n'est jamais écrit dans le _secret/ du dépôt
require dirname(__DIR__) . '/newsletter.php';
date_default_timezone_set(NL_FUSEAU);

$fail = 0;
function t(string $name, bool $ok, string $info = ''): void {
    global $fail;
    echo ($ok ? "  ✓ " : "  ✗ ÉCHEC ") . $name . ($ok || $info === '' ? '' : " — $info") . "\n";
    if (!$ok) $fail++;
}
$T0 = strtotime('2026-09-18 10:00:00');
const CHAMPS = ['email', 'langue', 'etat', 'jeton', 'inscrit', 'confirme', 'desinscrit'];

// ── Adresses ──
t('adresse normalisée (espaces, majuscules)', nl_email_normalise('  Marie.Dupont@Exemple.FR ') === 'marie.dupont@exemple.fr');
t('adresse sans @ refusée', nl_email_normalise('pas-un-email') === null);
t('adresse vide refusée', nl_email_normalise('') === null);
t('injection d\'en-tête refusée (retour ligne)', nl_email_normalise("a@exemple.fr\r\nBcc: x@exemple.fr") === null);
t('adresse de plus de 254 caractères refusée', nl_email_normalise(str_repeat('a', 64) . '@' . str_repeat('b', 190) . '.fr') === null);
t('espace intérieur refusé', nl_email_normalise('marie dupont@exemple.fr') === null);
t('domaine sans point refusé', nl_email_normalise('marie@localhost') === null);

// ── Jetons ──
$j1 = nl_jeton(); $j2 = nl_jeton();
t('jeton = 32 caractères hexadécimaux', nl_jeton_valide($j1) && strlen($j1) === 32);
t('deux jetons diffèrent', $j1 !== $j2);
t('jeton mal formé refusé (court, majuscules, autre alphabet)',
    !nl_jeton_valide('abc') && !nl_jeton_valide(strtoupper($j1)) && !nl_jeton_valide(str_repeat('z', 32)) && !nl_jeton_valide($j1 . "\n"));

// ── Transitions ──
$ab = [];
$r = nl_inscrire($ab, 'marie@exemple.fr', 'fr', $T0);
t('inscription : nouvelle fiche en attente, mail à envoyer', $r['issue'] === 'inscription' && nl_jeton_valide((string) $r['jeton'])
    && count($ab) === 1 && $ab[0]['etat'] === 'attente' && $ab[0]['jeton'] === $r['jeton']);
t('fiche : exactement e-mail, langue, état, jeton, dates — pas d\'IP', array_keys($ab[0]) === CHAMPS);
t('fiche : dates de confirmation et de désinscription vides', $ab[0]['confirme'] === null && $ab[0]['desinscrit'] === null);
$jMarie = $r['jeton'];

$avant = $ab;
$r = nl_inscrire($ab, 'marie@exemple.fr', 'fr', $T0 + 60);
t('nouvelle demande sous 10 min : cadence, aucun mail, rien ne change', $r['issue'] === 'cadence' && $r['jeton'] === null && $ab === $avant);

$r = nl_inscrire($ab, 'marie@exemple.fr', 'en', $T0 + NL_RENVOI_S + 1);
t('nouvelle demande après 10 min : relance, MÊME jeton, langue et date mises à jour',
    $r['issue'] === 'relance' && $r['jeton'] === $jMarie && $ab[0]['langue'] === 'en' && $ab[0]['inscrit'] === nl_date($T0 + NL_RENVOI_S + 1));
t('relance : l\'état précédent est gardé pour pouvoir annuler', ($r['precedent']['inscrit'] ?? '') === nl_date($T0));

$r = nl_confirmer($ab, $jMarie, $T0 + 3600);
t('confirmation : attente → confirme, date du consentement', $r['issue'] === 'confirmation' && $ab[0]['etat'] === 'confirme'
    && $ab[0]['confirme'] === nl_date($T0 + 3600) && $r['langue'] === 'en');
$avant = $ab;
$r = nl_confirmer($ab, $jMarie, $T0 + 7200);
t('seconde confirmation : sans effet, date d\'origine conservée', $r['issue'] === 'deja_confirme' && $ab === $avant);

$r = nl_inscrire($ab, 'marie@exemple.fr', 'fr', $T0 + 9000);
t('adresse confirmée réinscrite : déjà inscrite, aucun mail, rien ne change', $r['issue'] === 'deja_inscrit' && $r['jeton'] === null && $ab === $avant);

$r = nl_desinscrire($ab, $jMarie, $T0 + 86400);
t('désinscription : confirme → desinscrit, date', $r['issue'] === 'desinscription' && $ab[0]['etat'] === 'desinscrit'
    && $ab[0]['desinscrit'] === nl_date($T0 + 86400));
$avant = $ab;
$r = nl_desinscrire($ab, $jMarie, $T0 + 90000);
t('seconde désinscription : sans effet', $r['issue'] === 'deja_desinscrit' && $ab === $avant);
$r = nl_confirmer($ab, $jMarie, $T0 + 90000);
t('vieux lien de confirmation sur une adresse désinscrite : ne réabonne pas', $r['issue'] === 'desinscrit' && $ab === $avant);

$r = nl_inscrire($ab, 'marie@exemple.fr', 'fr', $T0 + 2 * 86400);
t('réinscription après désinscription : attente, NOUVEAU jeton, dates remises à zéro',
    $r['issue'] === 'inscription' && $r['jeton'] !== $jMarie && count($ab) === 1 && $ab[0]['etat'] === 'attente'
    && $ab[0]['confirme'] === null && $ab[0]['desinscrit'] === null && array_keys($ab[0]) === CHAMPS);
t('ancien jeton désormais inconnu', nl_desinscrire($ab, $jMarie, $T0)['issue'] === 'inconnu');
$r2 = nl_desinscrire($ab, (string) $r['jeton'], $T0 + 2 * 86400 + 5);
t('désinscription possible depuis l\'attente', $r2['issue'] === 'desinscription' && $ab[0]['etat'] === 'desinscrit');
t('jeton inconnu : confirmer et désinscrire refusent', nl_confirmer($ab, nl_jeton(), $T0)['issue'] === 'inconnu'
    && nl_desinscrire($ab, nl_jeton(), $T0)['issue'] === 'inconnu');

// ── Annulation après échec SMTP ──
$ab = [];
$r = nl_inscrire($ab, 'paul@exemple.fr', 'fr', $T0);
t('annulation d\'une nouvelle inscription : fiche retirée', nl_annuler($ab, 'paul@exemple.fr', $r['jeton'], $r['precedent']) && $ab === []);
$r = nl_inscrire($ab, 'paul@exemple.fr', 'fr', $T0);
$fiche = $ab[0];
$r = nl_inscrire($ab, 'paul@exemple.fr', 'en', $T0 + NL_RENVOI_S + 5);
nl_annuler($ab, 'paul@exemple.fr', $r['jeton'], $r['precedent']);
t('annulation d\'une relance : fiche d\'avant restaurée (la cadence ne bloque pas le nouvel essai)', $ab === [$fiche]
    && nl_inscrire($ab, 'paul@exemple.fr', 'fr', $T0 + NL_RENVOI_S + 6)['issue'] === 'relance');

// ── Purge des attentes ──
$vieux = [
    ['email' => 'a@exemple.fr', 'langue' => 'fr', 'etat' => 'attente', 'jeton' => nl_jeton(), 'inscrit' => nl_date($T0 - 31 * 86400), 'confirme' => null, 'desinscrit' => null],
    ['email' => 'b@exemple.fr', 'langue' => 'fr', 'etat' => 'attente', 'jeton' => nl_jeton(), 'inscrit' => nl_date($T0 - 29 * 86400), 'confirme' => null, 'desinscrit' => null],
    ['email' => 'c@exemple.fr', 'langue' => 'en', 'etat' => 'confirme', 'jeton' => nl_jeton(), 'inscrit' => nl_date($T0 - 400 * 86400), 'confirme' => nl_date($T0 - 399 * 86400), 'desinscrit' => null],
    ['email' => 'd@exemple.fr', 'langue' => 'fr', 'etat' => 'desinscrit', 'jeton' => nl_jeton(), 'inscrit' => nl_date($T0 - 400 * 86400), 'confirme' => nl_date($T0 - 399 * 86400), 'desinscrit' => nl_date($T0 - 300 * 86400)],
    ['email' => 'e@exemple.fr', 'langue' => 'fr', 'etat' => 'attente', 'jeton' => nl_jeton(), 'inscrit' => 'date illisible', 'confirme' => null, 'desinscrit' => null],
];
$p = nl_purger($vieux, $T0);
t('purge : attente de 31 jours (et date illisible) retirées ; 29 jours, confirmé, désinscrit gardés',
    array_column($p, 'email') === ['b@exemple.fr', 'c@exemple.fr', 'd@exemple.fr']);

// ── Stockage ──
$F = "$TMP/newsletter.json";
$r = nl_modifier($F, static function (array &$ab) use ($T0): array { return nl_inscrire($ab, 'lea@exemple.fr', 'fr', $T0); }, $T0);
$d = json_decode((string) file_get_contents($F), true);
t('stockage : fichier absent → créé, format 1, une fiche', $r['ok'] && ($d['format'] ?? 0) === 1 && count($d['abonnes'] ?? []) === 1);
t('stockage : aucun .tmp laissé, verrou séparé', !is_file("$F.tmp") && is_file("$F.lock"));
file_put_contents($F, json_encode(['format' => 1, 'abonnes' => $vieux]));
$m0 = (string) file_get_contents($F);
$r = nl_modifier($F, static function (array &$ab): bool { return true; }, $T0);
$d = json_decode((string) file_get_contents($F), true);
t('purge à l\'écriture suivante : l\'attente périmée disparaît du fichier', $r['ok']
    && array_column($d['abonnes'], 'email') === ['b@exemple.fr', 'c@exemple.fr', 'd@exemple.fr']);
$m1 = (string) file_get_contents($F);
clearstatcache();
$r = nl_modifier($F, static function (array &$ab): bool { return true; }, $T0);
t('rien à changer → fichier non réécrit', $r['ok'] && (string) file_get_contents($F) === $m1 && $m0 !== $m1);
file_put_contents($F, '{"format":1,"abonnes":[{"email":');
$r = nl_modifier($F, static function (array &$ab) use ($T0): array { return nl_inscrire($ab, 'x@exemple.fr', 'fr', $T0); }, $T0);
t('fichier cassé : refus, et le fichier n\'est PAS réécrit', !$r['ok'] && (string) file_get_contents($F) === '{"format":1,"abonnes":[{"email":');
t('fichier cassé : comptes illisibles (null), pas des zéros trompeurs', nl_comptes_fichier($F) === null);
file_put_contents($F, '');
t('fichier vide : liste vide', nl_charger($F) === []);

// ── Comptes sans donnée personnelle ──
$c = nl_comptes($vieux, $T0);
t('comptes : confirmés par langue, attentes valides, désinscrits',
    $c === ['confirmes' => ['fr' => 0, 'en' => 1], 'confirmes_total' => 1, 'attente' => 1, 'desinscrits' => 1], json_encode($c));
t('comptes : aucune adresse dans le résultat', !str_contains(json_encode($c), '@'));
file_put_contents($F, json_encode(['format' => 1, 'abonnes' => $vieux]));
t('comptes depuis le fichier', (nl_comptes_fichier($F)['desinscrits'] ?? -1) === 1);

// ── Pièges anti-robot ──
t('honeypot rempli → robot', nl_piege(['website' => 'http://spam', 'rendu' => '1', 'envoi' => '99999']) === 'honeypot');
t('honeypot en tableau → robot', nl_piege(['website' => ['x']]) === 'honeypot');
t('horodatages non numériques → robot', nl_piege(['rendu' => 'abc', 'envoi' => '5000']) === 'horodatage');
t('envoi en moins de 2 s → trop rapide (refus visible)', nl_piege(['rendu' => '1000000', 'envoi' => '1001500']) === 'trop_rapide');
t('envoi avant l\'affichage → trop rapide', nl_piege(['rendu' => '5000', 'envoi' => '1000']) === 'trop_rapide');
t('envoi après 2,5 s → accepté', nl_piege(['rendu' => '1000000', 'envoi' => '1002500']) === null);
t('horodatages absents (sans JS) → accepté, fail-open', nl_piege([]) === null && nl_piege(['rendu' => '', 'envoi' => '']) === null);
t('un seul horodatage (JS interrompu) → accepté, fail-open', nl_piege(['rendu' => '1000000']) === null);

t('origine absente → acceptée', nl_origine_ok([]));
t('origine du site → acceptée', nl_origine_ok(['HTTP_ORIGIN' => 'https://www.nsy.fr']));
t('origine étrangère → refusée', !nl_origine_ok(['HTTP_ORIGIN' => 'https://pirate.example']));
t('Origin « null » → on regarde le Referer', nl_origine_ok(['HTTP_ORIGIN' => 'null', 'HTTP_REFERER' => 'https://www.nsy.fr/blog.html'])
    && !nl_origine_ok(['HTTP_ORIGIN' => 'null', 'HTTP_REFERER' => 'https://pirate.example/x']));
t('champ en tableau lu comme vide', nl_champ(['t' => ['a']], 't') === '' && nl_champ(['t' => 'b'], 't') === 'b');

// ── E-mail de confirmation ──
$mFr = nl_message_confirmation('lea@exemple.fr', 'fr', $j1);
$mEn = nl_message_confirmation('lea@exemple.fr', 'en', $j1);
$lien = NL_ENDPOINT . '?action=confirmer&t=' . $j1;
t('confirmation FR : sujet, bouton, lien personnel, version texte', str_starts_with($mFr['sujet'], 'Confirmez votre inscription')
    && str_contains($mFr['html'], 'Confirmer mon inscription') && str_contains($mFr['html'], nl_esc($lien)) && str_contains($mFr['texte'], $lien));
t('confirmation EN : anglais', str_starts_with($mEn['sujet'], 'Confirm your subscription') && str_contains($mEn['html'], 'lang="en"')
    && str_contains($mEn['html'], 'Confirm my subscription'));
t('confirmation : logo du site, tableaux, 30 jours annoncés', str_contains($mFr['html'], NL_LOGO_URL)
    && str_contains($mFr['html'], 'role="presentation"') && str_contains($mFr['texte'], NL_ATTENTE_JOURS . ' jours'));
t('confirmation : destinataire = l\'adresse, jamais recopiée dans le corps', $mFr['a'] === 'lea@exemple.fr'
    && !str_contains($mFr['html'], 'lea@exemple.fr') && !str_contains($mFr['texte'], 'lea@exemple.fr'));

// ── Traces de diagnostic ──
$D = "$TMP/diag.log";
nl_diag("SMTP Error: The following recipients failed: lea@exemple.fr: 550\nligne 2", $D);
$l = (string) file_get_contents($D);
t('diag : une ligne datée, adresse masquée', (bool) preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} SMTP Error: .*\[adresse\].*ligne 2\n$/', $l)
    && !str_contains($l, 'lea@exemple.fr'), $l);
nl_diag('deuxième', $D);
t('diag : ajoute sans écraser', substr_count((string) file_get_contents($D), "\n") === 2);
file_put_contents($D, str_repeat('x', NL_DIAG_MAX + 1));
nl_diag('après plafond', $D);
clearstatcache();
t('diag : remis à zéro au-delà de 2 Mo', filesize($D) < 100 && str_contains((string) file_get_contents($D), 'après plafond'));

// ── Garde-fou d'erreurs (règle du 30/08/2026) ──
$masque = error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);   // comme l'endpoint
@unlink(NL_DIAG);
$GLOBALS['NL_ERREURS_PHP'] = 0;
t('garde-fou : dépréciation → muette, non comptée', nl_garde_erreur(E_USER_DEPRECATED, 'vieux') && $GLOBALS['NL_ERREURS_PHP'] === 0 && !is_file(NL_DIAG));
$arret = null;
try {
    for ($i = 1; $i <= 11; $i++) nl_garde_erreur(E_WARNING, "avertissement $i", '/x/newsletter.php', $i);
} catch (RuntimeException $e) {
    $arret = $e->getMessage();
}
error_reporting($masque);
$lignes = file(NL_DIAG, FILE_IGNORE_NEW_LINES) ?: [];
t('garde-fou : 5 traces au plus, dans NOTRE fichier', count($lignes) === 5 && str_contains($lignes[0], 'PHP [2] avertissement 1 @ newsletter.php:1'));
t('garde-fou : au-delà de 10 erreurs, arrêt net', $arret !== null && str_contains($arret, 'STOPPÉ') && $i === 11);
$GLOBALS['NL_ERREURS_PHP'] = 0;

// ── Journal de l'hébergeur : aucun error_log() sans destination ──
// Même détecteur que tests/journal-hebergeur.test.php (lecture au tokenizer).
function error_log_nus(string $source): array
{
    $nus = [];
    $tokens = token_get_all($source);
    $sautes = [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT];
    foreach ($tokens as $i => $tok) {
        if (!is_array($tok) || !in_array($tok[0], [T_STRING, T_NAME_FULLY_QUALIFIED], true)
            || ltrim(strtolower($tok[1]), '\\') !== 'error_log') continue;
        for ($k = $i - 1; $k >= 0 && is_array($tokens[$k]) && in_array($tokens[$k][0], $sautes, true); $k--);
        if ($k >= 0 && is_array($tokens[$k]) && in_array($tokens[$k][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION], true)) continue;
        $args = []; $courant = ''; $prof = 0;
        for ($j = $i + 1, $n = count($tokens); $j < $n; $j++) {
            $s = is_array($tokens[$j]) ? $tokens[$j][1] : $tokens[$j];
            if (is_array($tokens[$j]) && in_array($tokens[$j][0], $sautes, true)) continue;
            if ($s === '(' || $s === '[') { if ($prof++ === 0 && $s === '(') continue; }
            if ($s === ')' || $s === ']') { if (--$prof === 0) { $args[] = $courant; break; } }
            if ($s === ',' && $prof === 1) { $args[] = $courant; $courant = ''; continue; }
            $courant .= $s;
        }
        if (count($args) < 3 || $args[1] !== '3') $nus[] = [$tok[2], $args[0] ?? ''];
    }
    return $nus;
}
t('détecteur : repère un appel nu, ignore commentaires et type 3',
    count(error_log_nus("<?php\n// error_log('x');\nerror_log('nu');\nerror_log(\$l, 3, \$f);")) === 1);
$nus = error_log_nus((string) file_get_contents(dirname(__DIR__) . '/newsletter.php'));
t('newsletter.php : aucun error_log() sans destination', $nus === [], json_encode($nus));
t('newsletter.php : aucun error_log() du tout (les traces passent par nl_diag)',
    !preg_match('/\berror_log\s*\(/', preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents(dirname(__DIR__) . '/newsletter.php'))));

// ── Aucun avertissement PHP pendant toute la suite ──
t('aucun avertissement PHP émis (E_ALL, PHP ' . PHP_VERSION . ')', $AVERTISSEMENTS === [], implode(' | ', $AVERTISSEMENTS));

exec('rm -rf ' . escapeshellarg($TMP));
echo $fail === 0 ? "NEWSLETTER : TOUS LES TESTS PASSENT\n" : "NEWSLETTER : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
