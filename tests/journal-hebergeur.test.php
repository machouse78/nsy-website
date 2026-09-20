<?php
/**
 * Le journal d'erreurs de l'HÉBERGEMENT (~/ik-logs/error.log) n'est pas un
 * journal applicatif : son débordement a bloqué nsy.fr et prv-concept.com le
 * week-end des 29-30/08/2026. Tout error_log() SANS destination (type 3 +
 * fichier) y écrit. Ce test lit le code RÉEL au tokenizer — les mentions en
 * commentaire ne comptent pas — et refuse tout appel nu dans les PHP qui
 * tournent sur le serveur (racine, en/, stats/), hors les listes nommées
 * ci-dessous.
 *
 *   docker run --rm -v "$PWD":/app -w /app php:8.5-cli-alpine php tests/journal-hebergeur.test.php
 *
 *   20/09/2026 : chat.php (nsy_diag → _secret/chat-diag.log). Le pendant de
 *                prv-concept existait depuis le 17/09 ; le côté nsy n'avait
 *                jamais atterri sur main, et chat.php écrivait encore au
 *                journal de l'hébergement à chaque refus du fournisseur —
 *                motif que la sonde du journal ARRÊTE toujours, donc un
 *                déploiement bloqué au premier 429 de Mistral.
 * Jumeau de tests/journal-hebergeur-test.php de prv-concept (même détecteur).
 */
declare(strict_types=1);
error_reporting(E_ALL);
set_error_handler(static function (int $no, string $msg, string $f, int $l): bool {
    fwrite(STDERR, "  ⚠️  PHP [$no] $msg @ $f:$l\n");
    exit(2);
});

$fail = 0;
function t(string $name, bool $ok): void {
    global $fail;
    echo ($ok ? "  ✓ " : "  ✗ ÉCHEC ") . $name . "\n";
    if (!$ok) $fail++;
}

/**
 * Appels error_log() sans destination d'un source PHP → [[ligne, 1er argument]].
 * Le premier argument est rendu tel qu'écrit, espaces hors chaînes retirés.
 */
function error_log_nus(string $source): array
{
    $nus = [];
    $tokens = token_get_all($source);
    $sautes = [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT];
    foreach ($tokens as $i => $tok) {
        if (!is_array($tok) || !in_array($tok[0], [T_STRING, T_NAME_FULLY_QUALIFIED], true)
            || ltrim(strtolower($tok[1]), '\\') !== 'error_log') continue;
        // $x->error_log(…), X::error_log(…), function error_log(…) : pas l'appel natif.
        for ($k = $i - 1; $k >= 0 && is_array($tokens[$k]) && in_array($tokens[$k][0], $sautes, true); $k--);
        if ($k >= 0 && is_array($tokens[$k]) && in_array($tokens[$k][0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION], true)) continue;
        $args = [];
        $courant = '';
        $prof = 0;
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

/** Le source contient-il un APPEL (pas une mention en commentaire) de cette fonction ? */
function appelle(string $source, string $fonction): bool
{
    $tokens = token_get_all($source);
    foreach ($tokens as $i => $tok) {
        if (!is_array($tok) || $tok[0] !== T_STRING || $tok[1] !== $fonction) continue;
        for ($j = $i + 1; isset($tokens[$j]) && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE; $j++);
        if (($tokens[$j] ?? null) === '(') return true;
    }
    return false;
}

// ── Le détecteur lui-même ──
$echantillon = <<<'PHP'
<?php
// error_log('en commentaire');
/* error_log('en bloc'); */
error_log('nu');
@error_log('arobase');
\error_log('qualifié');
error_log($ligne, 3, __DIR__ . '/_secret/x.log');
@error_log(date('c') . ' a, b', 3, $f);
error_log('type 0', 0);
$obj->error_log('méthode');
PHP;
$vus = array_map(static fn($n) => $n[1], error_log_nus($echantillon));
t('détecteur : nu, @ et \\ vus ; commentaires, type 3 et méthodes ignorés',
  $vus === ["'nu'", "'arobase'", "'qualifié'", "'type 0'"]);

// ── Exceptions NOMMÉES, et elles seules ──
// 1. La panne de configuration des formulaires reste une VRAIE erreur : 100 %
//    des envois échouent, aucune alerte ne peut partir, la sonde du journal
//    doit s'arrêter dessus. (Même choix que prv-concept, 17/09/2026.)
// 2. Le gestionnaire d'erreurs du gabarit du 30/08/2026 (skill
//    execution-scripts-serveur) : les erreurs PHP au journal puis arrêt net.
//    Valable seulement si le fichier pose bien set_error_handler().
$config = [
    'contact.php'     => ["'NSY contact: missing _secret/config.php'"],
    'faisabilite.php' => ["'NSY faisabilité: missing _secret/config.php'"],
];
$gardeFou = [
    'stats-collector.php' => ['"stats-collector: [$no] $msg @ ".basename($fichier).":$ligne"'],
];
// 3. La DETTE est RÉSORBÉE (20/09/2026) : contact.php, faisabilite.php et
//    formulaires.php ne portent plus aucun error_log() nu. La liste reste ici,
//    VIDE, pour que ce soit un choix visible et non un oubli — la remplir de
//    nouveau demande une décision, pas une distraction.
$dette = [];

// ── Le code réel : tout PHP de la vitrine qui tourne sur le serveur ──
$racine = dirname(__DIR__);
$fichiers = array_map(static fn($p) => substr($p, strlen($racine) + 1),
    array_merge(glob("$racine/*.php"), glob("$racine/en/*.php"), glob("$racine/stats/*.php")));
sort($fichiers);
$surveilles = ['chat.php', 'contact.php', 'faisabilite.php', 'formulaires.php', 'newsletter.php'];
t('périmètre : ' . count($fichiers) . ' fichiers, dont chat.php, contact.php, faisabilite.php, formulaires.php et newsletter.php',
  count(array_intersect($surveilles, $fichiers)) === count($surveilles));
foreach (array_keys($config + $gardeFou + $dette) as $f) {
    if (!in_array($f, $fichiers, true)) t("$f : fichier d'une exception nommée introuvable", false);
}

foreach ($fichiers as $fichier) {
    $source = (string)file_get_contents("$racine/$fichier");
    $permis = array_merge($config[$fichier] ?? [], $gardeFou[$fichier] ?? [], $dette[$fichier] ?? []);
    $nus = error_log_nus($source);
    $horsListe = array_filter($nus, static fn($n) => !in_array($n[1], $permis, true));
    if ($horsListe || $permis || in_array($fichier, $surveilles, true)) {
        t("$fichier : aucun error_log() sans destination"
            . ($permis ? ' hors ' . count($permis) . ' nommé(s)' : '')
            . ($horsListe ? ' — ' . implode(', ', array_map(static fn($n) => 'ligne ' . $n[0] . ' ' . $n[1], $horsListe)) : ''),
          $horsListe === []);
    }
    foreach ($permis as $p) {
        t("$fichier : l'exception nommée existe encore ($p)",
          count(array_filter($nus, static fn($n) => $n[1] === $p)) === 1);
    }
    if (isset($gardeFou[$fichier])) {
        t("$fichier : l'exception est bien celle d'un gestionnaire (set_error_handler)",
          appelle($source, 'set_error_handler'));
    }
}
$autres = array_diff($fichiers, array_keys($config + $gardeFou + $dette), $surveilles);
echo '  · ' . count($autres) . " autres fichiers sans aucun error_log() nu\n";

// ── chat.php : le chantier du 20/09/2026, verrouillé ──
$chat = (string)file_get_contents("$racine/chat.php");
t('chat.php passe par nsy_diag(), qui écrit _secret/chat-diag.log',
  appelle($chat, 'nsy_diag') && str_contains($chat, "__DIR__ . '/_secret/chat-diag.log'"));
t('chat.php : nsy_diag() est datée et remise à zéro au-delà de 2 Mo',
  str_contains($chat, "filesize(\$f) > 2097152") && str_contains($chat, "date('Y-m-d H:i:s')"));
t('chat.php : le refus du fournisseur ne va QUE dans _secret/chat-errors.log',
  str_contains($chat, "@error_log(\$line, 3, __DIR__ . '/_secret/chat-errors.log');")
  && !str_contains($chat, "error_log('NSY chat: upstream HTTP '"));
t('chat.php : « alerte LLM impossible » et « empty completion » passent par nsy_diag',
  str_contains($chat, "nsy_diag('NSY chat: alerte LLM impossible — '")
  && str_contains($chat, "nsy_diag('NSY chat: empty completion')"));
t('chat.php : la sonde de disponibilité garde sa destination (_secret/chat-errors.log)',
  count(array_filter(error_log_nus($chat))) === 0);
// Tout ce qui entre dans chat-errors.log doit porter « upstream HTTP <code> » : c'est
// le seul marqueur que le motif AMONT de scripts/sonde-journal.py reconnaît, donc le
// seul que --tolere-amont puisse tolérer. La sonde de disponibilité écrivait
// « sonde modèle … → HTTP 429 » : un simple 429 du voyant faisait rendre 2 à la
// sonde et bloquait tout déploiement (corrigé le 20/09/2026).
preg_match_all('/@?error_log\(\s*(.+?),\s*3,\s*__DIR__ \. \'\/_secret\/chat-errors\.log\'/s', $chat, $m);
/** Le 1er argument porte-t-il le marqueur ? Une variable est résolue par son affectation. */
$porteLeMarqueur = static function (string $arg) use ($chat): bool {
    $marqueur = "' upstream HTTP '";
    if (preg_match('/^\$(\w+)$/', trim($arg), $v)) {
        return (bool)preg_match('/\$' . preg_quote($v[1], '/') . '\s*=\s*[^;]*' . preg_quote($marqueur, '/') . '/', $chat);
    }
    return str_contains($arg, $marqueur);
};
t('chat.php : les ' . count($m[1]) . " écritures dans chat-errors.log portent toutes « upstream HTTP »",
  count($m[1]) === 2 && count(array_filter($m[1], $porteLeMarqueur)) === 2);

// ── newsletter.php (19/09/2026) : pas même un error_log() avec destination ──
$newsletter = (string)file_get_contents("$racine/newsletter.php");
t('newsletter.php : AUCUN appel error_log(), même avec destination', !appelle($newsletter, 'error_log'));

// ── Les formulaires : le chantier du 20/09/2026, verrouillé ──
$contact = (string)file_get_contents("$racine/contact.php");
$faisa   = (string)file_get_contents("$racine/faisabilite.php");
$forms   = (string)file_get_contents("$racine/formulaires.php");
t('formulaires.php définit nsy_form_diag(), qui écrit _secret/formulaires-diag.log',
  str_contains($forms, 'function nsy_form_diag(string $m, ?string $f = null): void')
  && str_contains($forms, "__DIR__ . '/_secret/formulaires-diag.log'"));
t('nsy_form_diag() est datée et remise à zéro au-delà de 2 Mo',
  str_contains($forms, 'filesize($f) > 2097152') && str_contains($forms, "date('Y-m-d H:i:s')"));
foreach (['contact.php' => $contact, 'faisabilite.php' => $faisa] as $nom => $src) {
    t("$nom : « Turnstile HORS SERVICE » et « autoresponder » passent par nsy_form_diag",
      substr_count($src, 'nsy_form_diag(') === 2
      && str_contains($src, 'nsy_form_diag(\'NSY ') && str_contains($src, 'Turnstile HORS SERVICE')
      && str_contains($src, 'autoresponder failed'));
    t("$nom : le jeton refusé porte sa RAISON dans l'événement, plus au journal",
      str_contains($src, "'antibot_refuse', ['raison' => \$tv['raison']]"));
    t("$nom : l'échec SMTP n'est plus journalisé qu'en double chez nous",
      !str_contains($src, 'error_log($errMsg);')
      && str_contains($src, "@file_put_contents(__DIR__ . '/_secret/contact-errors.log', \$errMsg, FILE_APPEND);"));
}
t('formulaires.php : « alerte : envoi impossible » n\'est plus que dans _secret/alertes.log',
  !str_contains($forms, "error_log(NSY_ALERTE_SITE")
  && str_contains($forms, "nsy_alerte_trace(\$cle, \$sujet, 'ÉCHEC — ' . \$e->getMessage());"));

// ── nsy_form_diag() : NOTRE fichier, daté, plafonné (comportement réel) ──
require_once "$racine/formulaires.php";
if (!function_exists('nsy_form_diag')) {
    t('formulaires.php expose nsy_form_diag()', false);
} else {
    $diagLog = sys_get_temp_dir() . '/nsy-form-diag-' . bin2hex(random_bytes(4)) . '.log';
    nsy_form_diag('NSY contact: Turnstile HORS SERVICE (test)', $diagLog);
    t('nsy_form_diag écrit une ligne datée dans son fichier',
      (bool)preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} NSY contact: Turnstile HORS SERVICE \(test\)\n$/',
                       (string)@file_get_contents($diagLog)));
    nsy_form_diag('deuxième', $diagLog);
    t('nsy_form_diag ajoute sans écraser', substr_count((string)file_get_contents($diagLog), "\n") === 2);
    file_put_contents($diagLog, str_repeat('x', 2097153));
    nsy_form_diag('après plafond', $diagLog);
    clearstatcache();
    t('nsy_form_diag remet à zéro au-delà de 2 Mo',
      filesize($diagLog) < 100 && str_contains((string)file_get_contents($diagLog), 'après plafond'));
    @unlink($diagLog);
}

echo $fail === 0 ? "JOURNAL-HÉBERGEUR : TOUS LES TESTS PASSENT\n" : "JOURNAL-HÉBERGEUR : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
