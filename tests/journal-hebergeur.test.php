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
// 3. DETTE, pas une permission : le chantier « plus rien au journal de
//    l'hébergement » a été fait sur chat.php le 20/09/2026, PAS encore sur les
//    formulaires. Ces dix appels DOUBLONNENT déjà un journal à nous
//    (_secret/contact-errors.log, _secret/formulaires.log, nsy_alerte_trace) ou
//    devraient passer par un nsy_form_diag() qui n'existe pas encore ici.
//    La liste est CLOSE : tout appel nu qui n'y figure pas fait échouer le test.
//    prv-concept a résorbé la sienne les 17 et 19/09/2026 — modèle à suivre.
$dette = [
    'contact.php' => [
        "'NSY contact: Turnstile HORS SERVICE ('.\$antiBotBypass.') — contrôle contourné, autres filtres actifs'",
        "'NSY contact: Turnstile a refusé le jeton — '.\$tv['raison']",
        "'NSY contact: autoresponder failed — '.\$auto->ErrorInfo",
        '$errMsg',
    ],
    'faisabilite.php' => [
        "'NSY faisabilité: Turnstile HORS SERVICE ('.\$antiBotBypass.') — contrôle contourné, autres filtres actifs'",
        "'NSY faisabilité: Turnstile a refusé le jeton — '.\$tv['raison']",
        "'NSY faisabilité: autoresponder failed — '.\$auto->ErrorInfo",
        '$errMsg',
    ],
    'formulaires.php' => [
        "NSY_ALERTE_SITE.' alerte: envoi impossible — '.\$e->getMessage()",
    ],
];

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

// ── newsletter.php (19/09/2026) : pas même un error_log() avec destination ──
$newsletter = (string)file_get_contents("$racine/newsletter.php");
t('newsletter.php : AUCUN appel error_log(), même avec destination', !appelle($newsletter, 'error_log'));

echo $fail === 0 ? "JOURNAL-HÉBERGEUR : TOUS LES TESTS PASSENT\n" : "JOURNAL-HÉBERGEUR : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
