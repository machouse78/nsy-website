<?php
/**
 * newsletter.php — la lettre du journal : un e-mail à chaque nouvel article.
 *
 *   POST ?action=inscrire          email, lang (fr|en), website (honeypot),
 *                                  rendu / envoi (horodatages posés par js/app.js)
 *        → abonné créé ou réactivé en « attente » + e-mail de CONFIRMATION
 *          (double opt-in, RGPD). Réponse JSON quand le navigateur la demande
 *          (Accept: application/json), page HTML sinon (formulaire sans JS).
 *   GET  ?action=confirmer&t=…     → page avec un BOUTON (lecture seule, rien ne change)
 *   GET  ?action=desinscrire&t=…   → page avec un BOUTON (lecture seule, rien ne change)
 *   POST ?action=confirmer&t=…     → « confirme », date du consentement (le bouton).
 *   POST ?action=desinscrire&t=…   → « desinscrit » : le bouton, ou la désinscription
 *                                    en un clic des messageries (RFC 8058 :
 *                                    List-Unsubscribe-Post: List-Unsubscribe=One-Click).
 *   Pourquoi un bouton (18/09/2026) : les antivirus et messageries d'entreprise
 *   OUVRENT les liens des e-mails pour les analyser. Un GET qui agirait
 *   confirmerait une inscription — double opt-in sans humain — ou désinscrirait
 *   un lecteur à son insu. Un robot ouvre un lien ; il ne clique pas un bouton.
 *
 * L'ENVOI des articles ne part pas d'ici : scripts/newsletter-envoi.py, lancé à
 * la main depuis le poste du owner, lit la liste par FTPS et envoie par SMTP.
 *
 * Stockage : _secret/newsletter.json (403 en HTTP ; _secret/ est exclu de
 * l'envoi FTP, le déploiement ne l'écrase jamais). Par abonné : e-mail, langue,
 * état, jeton, dates — rien d'autre, pas d'IP. Écriture sous verrou (flock sur
 * newsletter.json.lock) puis renommage atomique : le lecteur FTP ne voit jamais
 * un fichier à moitié écrit. Une inscription restée en attente plus de
 * NL_ATTENTE_JOURS jours disparaît à l'écriture suivante.
 *
 * Règles de la maison, toutes tenues ici :
 *  - fail-open : la panne d'un rempart anti-robot ne bloque jamais un humain
 *    (horodatages absents = formulaire envoyé sans JS → accepté) ;
 *  - erreurs visibles et claires, dans la langue du visiteur ;
 *  - tentatives journalisées par nsy_form_event() (formulaires.php) SANS
 *    donnée personnelle ; état de la liste par nl_comptes(), sans adresse ;
 *  - AUCUN error_log() vers le journal de l'hébergeur (son débordement a bloqué
 *    le site le week-end du 29-30/08/2026) : les traces vont dans
 *    _secret/newsletter-diag.log, datées, adresses masquées, remis à zéro à 2 Mo ;
 *  - garde-fou set_error_handler (règle du 30/08/2026) : 5 traces au plus, et
 *    au-delà de 10 erreurs PHP le traitement s'arrête net.
 *
 * PORTAGE (prv-concept.com…) : ce fichier se copie tel quel, seul le bloc
 * CONFIGURATION ci-dessous change. Dépendances facultatives, dans le même
 * dossier : formulaires.php (journal des tentatives, alerte owner) et
 * antispam.php (plafond journalier par IP) — absentes, le module s'en passe.
 * Tests : tests/newsletter.test.php (unitaires) et tests/newsletter-http.test.php
 * (bac à sable php -S, SMTP sur port fermé).
 */
declare(strict_types=1);

/* ═══════════════════════════ CONFIGURATION DU SITE ═══════════════════════════
   Seule partie à adapter d'un site à l'autre. L'adresse d'expédition et les
   identifiants SMTP sont lus dans _secret/config.php (clés smtp_* ; clé
   facultative newsletter_from, sinon smtp_username). */
const NL_SITE_NOM       = 'NSY';
const NL_SITE_URL       = 'https://www.nsy.fr';                       // sans « / » final
const NL_ENDPOINT       = NL_SITE_URL . '/newsletter.php';
const NL_LOGO_URL       = NL_SITE_URL . '/public/nsy-logo.png';
const NL_LOGO_LARGEUR   = 110;                                        // px (logo 512×232)
const NL_EXPEDITEUR_NOM = 'NSY · Journal';
/** Le journal nommé dans les phrases : « … au journal NSY », « … du journal NSY ». */
const NL_JOURNAL = [
    'fr' => ['a' => 'au journal NSY', 'de' => 'du journal NSY'],
    'en' => ['a' => 'to the NSY journal', 'de' => 'from the NSY journal'],
];
/** Pages du site (chemins relatifs à NL_SITE_URL). */
const NL_PAGES = [
    'fr' => ['journal' => 'blog.html', 'confidentialite' => 'confidentialite.html#newsletter'],
    'en' => ['journal' => 'blog-en.html', 'confidentialite' => 'privacy.html#newsletter'],
];
/** Hôtes acceptés dans Origin / Referer pour l'inscription. */
const NL_HOTES = ['www.nsy.fr', 'nsy.fr', 'localhost', '127.0.0.1'];
/** Charte (pages et e-mails) — valeurs des jetons de css/style.css. */
const NL_COULEURS = [
    'fond'   => '#05080F', 'carte' => '#0F1626', 'bord' => 'rgba(140,170,220,0.15)',
    'titre'  => '#F2F6FF', 'texte' => '#C5CEE3', 'discret' => '#8993AF', 'pale' => '#5B6485',
    'accent' => '#00E5FF', 'sur_accent' => '#021018',
];
const NL_POLICE   = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const NL_FAVICONS = '<link rel="icon" href="/favicon.ico" sizes="any" />'
                  . '<link rel="icon" type="image/png" sizes="192x192" href="/public/cropped-NSY-logo-192x192.png" />';
const NL_FUSEAU     = 'Europe/Paris';
const NL_FORMULAIRE = 'newsletter';          // clé des événements dans _secret/formulaires.log
/* Réglages */
const NL_LANGUES         = ['fr', 'en'];
const NL_ATTENTE_JOURS   = 30;               // inscription non confirmée : supprimée au-delà
const NL_RENVOI_S        = 600;              // pas de 2e mail de confirmation à la même adresse avant 10 min
const NL_PLAFOND_IP_JOUR = 10;               // inscriptions par IP (hachée) et par jour
const NL_DELAI_MIN_MS    = 2000;             // piège temporel : rendu → envoi du formulaire
const NL_DIAG_MAX        = 2097152;          // _secret/newsletter-diag.log remis à zéro au-delà (2 Mo)
/* Chemins — define() pour que les tests puissent les rediriger. */
defined('NL_SECRET')    || define('NL_SECRET', __DIR__ . '/_secret');
defined('NL_CONFIG')    || define('NL_CONFIG', NL_SECRET . '/config.php');
defined('NL_STOCK')     || define('NL_STOCK', NL_SECRET . '/newsletter.json');
defined('NL_DIAG')      || define('NL_DIAG', NL_SECRET . '/newsletter-diag.log');
defined('NL_PHPMAILER') || define('NL_PHPMAILER', __DIR__ . '/vendor/PHPMailer/src');
/* ═════════════════════════ FIN DE LA CONFIGURATION ═══════════════════════════ */

/** Issues journalisées (nomenclature du futur tableau de bord). */
const NL_ISSUES = [
    'inscription'     => 'Inscription (mail de confirmation parti)',
    'relance'         => 'Nouvelle demande en attente (mail renvoyé)',
    'cadence'         => 'Nouvelle demande trop proche (aucun mail)',
    'deja_inscrit'    => 'Adresse déjà confirmée (aucun mail)',
    'confirmation'    => 'Inscription confirmée',
    'desinscription'  => 'Désinscription (mode : bouton ou un_clic)',
    'honeypot'        => 'Robot (honeypot)',
    'horodatage'      => 'Robot (horodatage falsifié)',
    'trop_rapide'     => 'Envoi trop rapide (refus visible)',
    'origine'         => 'Origine étrangère au site',
    'invalide'        => 'Adresse invalide',
    'plafond'         => 'Plafond journalier par IP',
    'erreur_envoi'    => 'Erreur d\'envoi du mail de confirmation',
    'erreur_config'   => 'Erreur de configuration',
    'erreur_stockage' => 'Erreur de stockage',
];

/* ───────────────────────────── Outils ───────────────────────────── */

function nl_date(int $t): string
{
    return date('c', $t);
}

function nl_langue(mixed $l): string
{
    return in_array($l, NL_LANGUES, true) ? (string) $l : NL_LANGUES[0];
}

/** Un paramètre de requête, en chaîne ('' si absent ou si c'est un tableau : ?t[]=…). */
function nl_champ(array $source, string $cle): string
{
    return is_string($source[$cle] ?? null) ? $source[$cle] : '';
}

/** Adresse normalisée (minuscules, sans espaces) ou null si invalide. */
function nl_email_normalise(string $brut): ?string
{
    $e = trim($brut);
    if ($e === '' || strlen($e) > 254 || preg_match('/[\r\n\0]/', $e)) {
        return null;
    }
    $e = strtolower($e);
    return filter_var($e, FILTER_VALIDATE_EMAIL) !== false ? $e : null;
}

function nl_jeton(): string
{
    return bin2hex(random_bytes(16));
}

function nl_jeton_valide(string $t): bool
{
    return (bool) preg_match('/^[a-f0-9]{32}\z/', $t);          // \z : pas de « \n » final toléré
}

function nl_esc(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Trace de diagnostic dans NOTRE fichier (jamais le journal de l'hébergeur) :
 * datée, une ligne, adresses e-mail masquées, remise à zéro au-delà de 2 Mo.
 */
function nl_diag(string $m, ?string $fichier = null): void
{
    $fichier = $fichier ?? NL_DIAG;
    $m = preg_replace('/[^\s<>()\[\]"\'@,;:]+@[^\s<>()\[\]"\'@,;:]+/u', '[adresse]', $m) ?? '[trace illisible]';
    $m = str_replace(["\r", "\n"], ' ', $m);
    clearstatcache(true, $fichier);
    $mode = (is_file($fichier) && (int) @filesize($fichier) > NL_DIAG_MAX) ? 0 : FILE_APPEND;
    @file_put_contents($fichier, date('Y-m-d H:i:s') . ' ' . $m . "\n", $mode | LOCK_EX);
}

/**
 * Garde-fou du 30/08/2026 (skill execution-scripts-serveur), calqué sur celui de
 * stats-collector.php — mais vers NOTRE fichier de diagnostic, pas vers
 * error_log(). Les erreurs exclues par error_reporting (dépréciations, appels
 * préfixés par @) restent muettes ; les 5 premières sont tracées ; au-delà de
 * 10, le traitement s'arrête net (exception rattrapée par le routeur → 500).
 */
function nl_garde_erreur(int $no, string $msg, string $fichier = '', int $ligne = 0): bool
{
    if (!(error_reporting() & $no)) {
        return true;
    }
    $n = ++$GLOBALS['NL_ERREURS_PHP'];
    if ($n <= 5) {
        nl_diag("PHP [$no] $msg @ " . basename($fichier) . ":$ligne");
    }
    if ($n > 10) {
        throw new RuntimeException("traitement STOPPÉ : $n erreurs PHP — règle du 30/08/2026");
    }
    return true;
}
$GLOBALS['NL_ERREURS_PHP'] = 0;

/** Événement pour les statistiques (formulaires.php) — jamais d'adresse. */
function nl_evenement(string $issue, array $extra = []): void
{
    if (function_exists('nsy_form_event')) {
        nsy_form_event(NL_FORMULAIRE, $issue, $extra);
    }
}

/* ───────────────────────────── Stockage ───────────────────────────── */

/** Liste des abonnés ; [] si le fichier n'existe pas ; null s'il est illisible. */
function nl_charger(string $fichier): ?array
{
    if (!is_file($fichier)) {
        return [];
    }
    $brut = @file_get_contents($fichier);
    if ($brut === false) {
        return null;
    }
    if (trim($brut) === '') {
        return [];
    }
    $d = json_decode($brut, true);
    if (!is_array($d) || !isset($d['abonnes']) || !is_array($d['abonnes'])) {
        return null;
    }
    return array_values(array_filter($d['abonnes'], 'is_array'));
}

/** Retire les inscriptions restées en attente plus de NL_ATTENTE_JOURS jours. */
function nl_purger(array $abonnes, int $maintenant): array
{
    $limite = $maintenant - NL_ATTENTE_JOURS * 86400;
    return array_values(array_filter($abonnes, static function (array $a) use ($limite): bool {
        if (($a['etat'] ?? '') !== 'attente') {
            return true;
        }
        $t = strtotime((string) ($a['inscrit'] ?? ''));
        return $t !== false && $t >= $limite;
    }));
}

/**
 * Lecture → purge → modification → écriture, sous verrou exclusif.
 * $fn reçoit la liste PAR RÉFÉRENCE et renvoie un résultat libre.
 * Un fichier illisible (JSON cassé) n'est JAMAIS réécrit : on refuse.
 * → ['ok' => true, 'resultat' => …] ou ['ok' => false, 'raison' => …]
 */
function nl_modifier(string $fichier, callable $fn, ?int $maintenant = null): array
{
    $verrou = @fopen($fichier . '.lock', 'c');
    if ($verrou === false) {
        return ['ok' => false, 'raison' => 'verrou impossible à ouvrir'];
    }
    try {
        if (!flock($verrou, LOCK_EX)) {
            return ['ok' => false, 'raison' => 'verrou refusé'];
        }
        $abonnes = nl_charger($fichier);
        if ($abonnes === null) {
            return ['ok' => false, 'raison' => 'newsletter.json illisible — laissé intact'];
        }
        $avant = $abonnes;
        $abonnes = nl_purger($abonnes, $maintenant ?? time());
        $resultat = $fn($abonnes);
        if ($abonnes !== $avant) {
            $json = json_encode(['format' => 1, 'abonnes' => array_values($abonnes)],
                JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $tmp = $fichier . '.tmp';
            if ($json === false || @file_put_contents($tmp, $json . "\n") === false || !@rename($tmp, $fichier)) {
                @unlink($tmp);
                return ['ok' => false, 'raison' => 'écriture impossible'];
            }
        }
        return ['ok' => true, 'resultat' => $resultat];
    } finally {
        flock($verrou, LOCK_UN);
        fclose($verrou);
    }
}

/* ─────────────────────── Transitions d'état (pures) ─────────────────────── */

/** Nouvelle fiche — exactement ces champs, rien d'autre. */
function nl_fiche(string $email, string $langue, int $t): array
{
    return ['email' => $email, 'langue' => $langue, 'etat' => 'attente', 'jeton' => nl_jeton(),
            'inscrit' => nl_date($t), 'confirme' => null, 'desinscrit' => null];
}

/**
 * Demande d'inscription. Issues :
 *   'inscription'  nouvelle fiche, ou fiche désinscrite réactivée (NOUVEAU jeton) ;
 *   'relance'      déjà en attente depuis plus de NL_RENVOI_S : même jeton, mail renvoyé ;
 *   'cadence'      déjà en attente depuis moins de NL_RENVOI_S : rien ;
 *   'deja_inscrit' adresse confirmée : rien (et le visiteur n'en sait rien).
 * 'jeton' est fourni quand un mail est à envoyer ; 'precedent' permet d'annuler.
 */
function nl_inscrire(array &$abonnes, string $email, string $langue, int $maintenant): array
{
    foreach ($abonnes as $i => $a) {
        if (($a['email'] ?? '') !== $email) {
            continue;
        }
        $etat = $a['etat'] ?? '';
        if ($etat === 'confirme') {
            return ['issue' => 'deja_inscrit', 'jeton' => null, 'precedent' => null];
        }
        if ($etat === 'attente' && nl_jeton_valide((string) ($a['jeton'] ?? ''))) {
            $depuis = $maintenant - (int) (strtotime((string) ($a['inscrit'] ?? '')) ?: 0);
            if ($depuis < NL_RENVOI_S) {
                return ['issue' => 'cadence', 'jeton' => null, 'precedent' => null];
            }
            $abonnes[$i]['langue'] = $langue;
            $abonnes[$i]['inscrit'] = nl_date($maintenant);
            return ['issue' => 'relance', 'jeton' => (string) $a['jeton'], 'precedent' => $a];
        }
        $abonnes[$i] = nl_fiche($email, $langue, $maintenant);
        return ['issue' => 'inscription', 'jeton' => $abonnes[$i]['jeton'], 'precedent' => $a];
    }
    $f = nl_fiche($email, $langue, $maintenant);
    $abonnes[] = $f;
    return ['issue' => 'inscription', 'jeton' => $f['jeton'], 'precedent' => null];
}

/** Annule une inscription dont le mail n'a pas pu partir (sinon la cadence bloquerait le nouvel essai). */
function nl_annuler(array &$abonnes, string $email, string $jeton, ?array $precedent): bool
{
    foreach ($abonnes as $i => $a) {
        if (($a['email'] ?? '') !== $email || ($a['jeton'] ?? '') !== $jeton) {
            continue;
        }
        if ($precedent === null) {
            unset($abonnes[$i]);
            $abonnes = array_values($abonnes);
        } else {
            $abonnes[$i] = $precedent;
        }
        return true;
    }
    return false;
}

function nl_index_jeton(array $abonnes, string $jeton): ?int
{
    foreach ($abonnes as $i => $a) {
        if (is_string($a['jeton'] ?? null) && hash_equals($a['jeton'], $jeton)) {
            return $i;
        }
    }
    return null;
}

/** → issue 'confirmation' | 'deja_confirme' | 'desinscrit' | 'inconnu', et la langue de la fiche. */
function nl_confirmer(array &$abonnes, string $jeton, int $maintenant): array
{
    $i = nl_index_jeton($abonnes, $jeton);
    if ($i === null) {
        return ['issue' => 'inconnu', 'langue' => null];
    }
    $langue = nl_langue($abonnes[$i]['langue'] ?? null);
    switch ($abonnes[$i]['etat'] ?? '') {
        case 'attente':
            $abonnes[$i]['etat'] = 'confirme';
            $abonnes[$i]['confirme'] = nl_date($maintenant);
            return ['issue' => 'confirmation', 'langue' => $langue];
        case 'confirme':
            return ['issue' => 'deja_confirme', 'langue' => $langue];
        default:
            // Un vieux lien de confirmation ne réabonne jamais une adresse désinscrite.
            return ['issue' => 'desinscrit', 'langue' => $langue];
    }
}

/** → issue 'desinscription' | 'deja_desinscrit' | 'inconnu', et la langue de la fiche. */
function nl_desinscrire(array &$abonnes, string $jeton, int $maintenant): array
{
    $i = nl_index_jeton($abonnes, $jeton);
    if ($i === null) {
        return ['issue' => 'inconnu', 'langue' => null];
    }
    $langue = nl_langue($abonnes[$i]['langue'] ?? null);
    if (($abonnes[$i]['etat'] ?? '') === 'desinscrit') {
        return ['issue' => 'deja_desinscrit', 'langue' => $langue];
    }
    $abonnes[$i]['etat'] = 'desinscrit';
    $abonnes[$i]['desinscrit'] = nl_date($maintenant);
    return ['issue' => 'desinscription', 'langue' => $langue];
}

/**
 * Comptes SANS donnée personnelle — pour le tableau de bord. Les attentes
 * périmées (non encore purgées) ne comptent pas.
 */
function nl_comptes(array $abonnes, ?int $maintenant = null): array
{
    $c = ['confirmes' => array_fill_keys(NL_LANGUES, 0), 'confirmes_total' => 0, 'attente' => 0, 'desinscrits' => 0];
    foreach (nl_purger($abonnes, $maintenant ?? time()) as $a) {
        $etat = $a['etat'] ?? '';
        if ($etat === 'confirme') {
            $c['confirmes'][nl_langue($a['langue'] ?? null)]++;
            $c['confirmes_total']++;
        } elseif ($etat === 'attente') {
            $c['attente']++;
        } elseif ($etat === 'desinscrit') {
            $c['desinscrits']++;
        }
    }
    return $c;
}

/** Idem, depuis le fichier ; null s'il est illisible. */
function nl_comptes_fichier(string $fichier = NL_STOCK): ?array
{
    $a = nl_charger($fichier);
    return $a === null ? null : nl_comptes($a);
}

/* ───────────────────────────── Anti-robots ───────────────────────────── */

/**
 * Pièges du formulaire. null = rien à signaler ; sinon l'issue :
 *   'honeypot'    champ caché rempli                 → faux succès silencieux ;
 *   'horodatage'  horodatages non numériques         → faux succès silencieux
 *                 (js/app.js n'écrit que des nombres : c'est un robot) ;
 *   'trop_rapide' moins de NL_DELAI_MIN_MS entre l'affichage et l'envoi
 *                 → refus VISIBLE : un humain pressé (autoremplissage) peut
 *                 réessayer, il n'est jamais bloqué en silence.
 * Horodatages absents (formulaire envoyé sans JS) : aucun contrôle — fail-open.
 * Les deux valeurs viennent de la même horloge, celle du navigateur : seule la
 * durée compte, l'écart d'horloge avec le serveur ne joue pas.
 */
function nl_piege(array $post): ?string
{
    if (trim(nl_champ($post, 'website')) !== '' || is_array($post['website'] ?? null)) {
        return 'honeypot';
    }
    $rendu = trim(nl_champ($post, 'rendu'));
    $envoi = trim(nl_champ($post, 'envoi'));
    if ($rendu === '' || $envoi === '') {
        return null;
    }
    if (!ctype_digit($rendu) || !ctype_digit($envoi)) {
        return 'horodatage';
    }
    return ((int) $envoi - (int) $rendu) < NL_DELAI_MIN_MS ? 'trop_rapide' : null;
}

/** Origin / Referer : absents (ou « null ») → accepté ; présents → hôte du site exigé. */
function nl_origine_ok(array $server): bool
{
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
        $v = trim((string) ($server[$h] ?? ''));
        if ($v === '' || $v === 'null') {
            continue;
        }
        return in_array(strtolower((string) parse_url($v, PHP_URL_HOST)), NL_HOTES, true);
    }
    return true;
}

/* ───────────────────────────── Textes ───────────────────────────── */

function nl_textes(string $langue): array
{
    $a = NL_JOURNAL[$langue]['a'];
    $de = NL_JOURNAL[$langue]['de'];
    $jours = NL_ATTENTE_JOURS;
    if ($langue === 'en') {
        return [
            'ok'          => 'Check your inbox to confirm.',
            'email'       => 'Invalid email address.',
            'trop_rapide' => 'Sent too quickly — wait two seconds, then try again.',
            'plafond'     => 'Too many sign-ups from this connection today — please try again tomorrow.',
            'origine'     => 'Sign-up refused: the form must be sent from the website.',
            'indispo'     => 'Sign-up is unavailable right now — please try again in a few minutes.',
            'envoi'       => 'The confirmation email could not be sent — please try again in a few minutes.',
            'methode'     => 'Method not allowed.',
            'retour'      => 'Read the journal',
            'p_ok'        => ['Check your inbox', "Confirm your subscription with the link in the email we have just sent you. If it is not there, check your spam folder."],
            'p_erreur'    => 'Sign-up failed',
            'confirmation'    => ['Subscription confirmed', "You will receive an email for each new article $de. Every email includes an unsubscribe link."],
            'deja_confirme'   => ['Subscription already confirmed', "You will receive an email for each new article $de. Every email includes an unsubscribe link."],
            'desinscrit'      => ['Address unsubscribed', 'This address has since unsubscribed. To receive the articles again, subscribe from the journal.'],
            'desinscription'  => ['You are unsubscribed', "You will no longer receive emails $de. You can subscribe again at any time from the journal."],
            'deja_desinscrit' => ['Already unsubscribed', "No more emails $de are sent to this address."],
            'inconnu'         => ['Unknown or expired link', "This link is no longer valid. An unconfirmed sign-up is deleted after $jours days: you can subscribe again from the journal."],
            'panne'           => ['Temporarily unavailable', 'Please try again in a few minutes.'],
            'requete'         => ['Invalid request', 'This address does not match any page.'],
            'q_confirmer'     => ['Confirm your subscription', "One last click to receive an email for each new article $de.", 'Confirm my subscription'],
            'q_desinscrire'   => ['Unsubscribe', "You will no longer receive emails $de.", 'Unsubscribe me'],
            'mail' => [
                'sujet'   => "Confirm your subscription $a",
                'titre'   => 'Confirm your subscription',
                'corps'   => "You asked to receive an email for each new article $de.",
                'agir'    => 'To confirm, click the button below.',
                'agir_texte' => 'To confirm, open this link:',
                'bouton'  => 'Confirm my subscription',
                'secours' => 'Button not working? Copy this link into your browser:',
                'ignorer' => "Did not request this? Simply ignore this message: without confirmation, the address is deleted within $jours days.",
            ],
        ];
    }
    return [
        'ok'          => 'Vérifiez votre boîte mail pour confirmer.',
        'email'       => 'Adresse e-mail invalide.',
        'trop_rapide' => 'Envoi trop rapide — patientez deux secondes, puis réessayez.',
        'plafond'     => 'Trop d\'inscriptions depuis cette connexion aujourd\'hui — réessayez demain.',
        'origine'     => 'Inscription refusée : le formulaire doit être envoyé depuis le site.',
        'indispo'     => 'Inscription impossible pour le moment — réessayez dans quelques minutes.',
        'envoi'       => 'L\'e-mail de confirmation n\'a pas pu partir — réessayez dans quelques minutes.',
        'methode'     => 'Méthode non autorisée.',
        'retour'      => 'Lire le journal',
        'p_ok'        => ['Vérifiez votre boîte mail', 'Confirmez votre inscription par le lien de l\'e-mail que nous venons de vous envoyer. Ne le voyez-vous pas ? Regardez dans les indésirables.'],
        'p_erreur'    => 'Inscription impossible',
        'confirmation'    => ['Inscription confirmée', "Vous recevrez un e-mail à chaque nouvel article $de. Chaque e-mail comporte un lien de désinscription."],
        'deja_confirme'   => ['Inscription déjà confirmée', "Vous recevrez un e-mail à chaque nouvel article $de. Chaque e-mail comporte un lien de désinscription."],
        'desinscrit'      => ['Adresse désinscrite', 'Cette adresse s\'est désinscrite depuis. Pour recevoir à nouveau les articles, réinscrivez-vous depuis le journal.'],
        'desinscription'  => ['Désinscription enregistrée', "Vous ne recevrez plus d'e-mail $de. Vous pouvez vous réinscrire à tout moment depuis le journal."],
        'deja_desinscrit' => ['Adresse déjà désinscrite', "Plus aucun e-mail $de ne lui est envoyé."],
        'inconnu'         => ['Lien inconnu ou expiré', "Ce lien n'est plus valable. Une inscription non confirmée est supprimée au bout de $jours jours : vous pouvez vous réinscrire depuis le journal."],
        'panne'           => ['Service momentanément indisponible', 'Réessayez dans quelques minutes.'],
        'requete'         => ['Requête invalide', 'Cette adresse ne correspond à aucune page.'],
        'q_confirmer'     => ['Confirmer votre inscription', "Un dernier clic pour recevoir un e-mail à chaque nouvel article $de.", 'Confirmer mon inscription'],
        'q_desinscrire'   => ['Se désinscrire', "Vous ne recevrez plus d'e-mail $de.", 'Me désinscrire'],
        'mail' => [
            'sujet'   => "Confirmez votre inscription $a",
            'titre'   => 'Confirmez votre inscription',
            'corps'   => "Vous avez demandé à recevoir un e-mail à chaque nouvel article $de.",
            'agir'    => 'Pour confirmer, cliquez sur le bouton ci-dessous.',
            'agir_texte' => 'Pour confirmer, ouvrez ce lien :',
            'bouton'  => 'Confirmer mon inscription',
            'secours' => 'Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :',
            'ignorer' => "Vous n'êtes pas à l'origine de cette demande ? Ignorez ce message : sans confirmation, l'adresse est supprimée sous $jours jours.",
        ],
    ];
}

/* ─────────────────────── E-mail de confirmation ─────────────────────── */

function nl_lien(string $action, string $jeton): string
{
    return NL_ENDPOINT . '?action=' . rawurlencode($action) . '&t=' . rawurlencode($jeton);
}

/** Même lien, en chemin du site (formulaire d'une page servie par lui). */
function nl_lien_local(string $action, string $jeton): string
{
    return (string) parse_url(NL_ENDPOINT, PHP_URL_PATH) . '?action=' . rawurlencode($action) . '&t=' . rawurlencode($jeton);
}

/** Le message (pur, testable) : ['a', 'sujet', 'html', 'texte']. */
function nl_message_confirmation(string $email, string $langue, string $jeton): array
{
    $c = NL_COULEURS;
    $m = nl_textes($langue)['mail'];
    $lien = nl_lien('confirmer', $jeton);
    $hote = (string) parse_url(NL_SITE_URL, PHP_URL_HOST);
    $html = '<!doctype html><html lang="' . $langue . '"><head><meta charset="utf-8" />'
        . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        . '<meta name="color-scheme" content="dark light" /><title>' . nl_esc($m['sujet']) . '</title></head>'
        . '<body style="margin:0;padding:0;background:' . $c['fond'] . ';">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' . $c['fond'] . '" style="background:' . $c['fond'] . ';">'
        . '<tr><td align="center" style="padding:32px 16px;">'
        . '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;font-family:' . NL_POLICE . ';">'
        . '<tr><td style="padding:0 0 20px;"><a href="' . nl_esc(NL_SITE_URL) . '/"><img src="' . nl_esc(NL_LOGO_URL) . '" width="' . NL_LOGO_LARGEUR . '" alt="' . nl_esc(NL_SITE_NOM) . '" style="display:block;border:0;height:auto;" /></a></td></tr>'
        . '<tr><td bgcolor="' . $c['carte'] . '" style="background:' . $c['carte'] . ';border:1px solid ' . $c['bord'] . ';border-radius:18px;padding:32px 28px;">'
        . '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:' . $c['titre'] . ';">' . nl_esc($m['titre']) . '</h1>'
        . '<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:' . $c['texte'] . ';">' . nl_esc($m['corps'] . ' ' . $m['agir']) . '</p>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="' . $c['accent'] . '" style="background:' . $c['accent'] . ';border-radius:999px;">'
        . '<a href="' . nl_esc($lien) . '" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:' . $c['sur_accent'] . ';text-decoration:none;">' . nl_esc($m['bouton']) . '</a>'
        . '</td></tr></table>'
        . '<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:' . $c['discret'] . ';">' . nl_esc($m['secours']) . '<br />'
        . '<a href="' . nl_esc($lien) . '" style="color:' . $c['accent'] . ';word-break:break-all;">' . nl_esc($lien) . '</a></p>'
        . '<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:' . $c['discret'] . ';">' . nl_esc($m['ignorer']) . '</p>'
        . '</td></tr>'
        . '<tr><td style="padding:20px 8px 0;font-size:12px;color:' . $c['pale'] . ';">' . nl_esc(NL_SITE_NOM) . ' · <a href="' . nl_esc(NL_SITE_URL) . '/" style="color:' . $c['pale'] . ';">' . nl_esc($hote) . '</a></td></tr>'
        . '</table></td></tr></table></body></html>';
    $texte = $m['titre'] . "\n\n" . $m['corps'] . "\n" . $m['agir_texte'] . "\n" . $lien . "\n\n" . $m['ignorer']
        . "\n\n—\n" . NL_SITE_NOM . ' · ' . NL_SITE_URL . "\n";
    return ['a' => $email, 'sujet' => $m['sujet'], 'html' => $html, 'texte' => $texte];
}

/**
 * Envoi par PHPMailer + SMTP, exactement comme contact.php. Lève une exception
 * en cas d'échec. Remplaçable dans les tests : $GLOBALS['NL_ENVOI_MAIL'] =
 * fn(array $message): void (même mécanique que NSY_TURNSTILE_HTTP).
 */
function nl_envoyer(array $config, array $msg): void
{
    if (isset($GLOBALS['NL_ENVOI_MAIL']) && is_callable($GLOBALS['NL_ENVOI_MAIL'])) {
        ($GLOBALS['NL_ENVOI_MAIL'])($msg);
        return;
    }
    foreach (['Exception', 'PHPMailer', 'SMTP'] as $cl) {
        if (!class_exists('\\PHPMailer\\PHPMailer\\' . $cl)) {
            require_once NL_PHPMAILER . '/' . $cl . '.php';
        }
    }
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = (string) $config['smtp_host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = (string) $config['smtp_username'];
        $mail->Password   = (string) $config['smtp_password'];
        $mail->SMTPSecure = (string) $config['smtp_secure'];
        $mail->Port       = (int) $config['smtp_port'];
        $mail->CharSet    = 'UTF-8';
        $mail->Timeout    = 15;
        $mail->setFrom((string) ($config['newsletter_from'] ?? $config['smtp_username']), NL_EXPEDITEUR_NOM);
        $mail->addAddress($msg['a']);
        $mail->isHTML(true);
        $mail->Subject = $msg['sujet'];
        $mail->Body    = $msg['html'];
        $mail->AltBody = $msg['texte'];
        $mail->send();
    } catch (\PHPMailer\PHPMailer\Exception $e) {
        throw new RuntimeException($mail->ErrorInfo ?: $e->getMessage(), 0, $e);
    }
}

/* ───────────────────────────── Réponses ───────────────────────────── */

function nl_veut_json(): bool
{
    return str_contains(strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? '')), 'application/json');
}

function nl_json(array $payload, int $code = 200): never
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Page HTML sobre aux couleurs du site. $blocs = [[titre, texte], …] — plusieurs
 * blocs pour une page bilingue (lien inconnu : on ne sait pas à qui l'on parle).
 * $formulaire = [url, libellé] : un bouton qui POSTE la demande, à la place du
 * bouton « Lire le journal » (qui reste en lien discret).
 */
function nl_page(string $langue, array $blocs, int $code = 200, ?array $formulaire = null): never
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    $c = NL_COULEURS;
    $corps = '';
    foreach ($blocs as $n => [$titre, $texte]) {
        $corps .= ($n > 0 ? '<hr />' : '') . '<h1>' . nl_esc($titre) . '</h1><p>' . nl_esc($texte) . '</p>';
    }
    // Chemins du MÊME site (la page est servie par lui) : pas d'URL absolue, qui
    // ferait appeler la production depuis une copie locale ou de test.
    $retour = '/' . NL_PAGES[$langue]['journal'];
    $logo = (string) parse_url(NL_LOGO_URL, PHP_URL_PATH);
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="' . $langue . '"><head><meta charset="utf-8" />'
        . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        . '<meta name="robots" content="noindex, nofollow" />'
        . '<title>' . nl_esc($blocs[0][0]) . ' — ' . nl_esc(NL_SITE_NOM) . '</title>' . NL_FAVICONS
        . '<style>'
        . 'body{margin:0;background:' . $c['fond'] . ';color:' . $c['texte'] . ';font-family:' . NL_POLICE . ';}'
        . 'main{max-width:560px;margin:0 auto;padding:48px 16px;}'
        . '.logo img{display:block;width:' . NL_LOGO_LARGEUR . 'px;height:auto;margin:0 0 24px;}'
        . '.carte{background:' . $c['carte'] . ';border:1px solid ' . $c['bord'] . ';border-radius:18px;padding:32px 28px;}'
        . 'h1{margin:0 0 12px;font-size:24px;line-height:1.25;color:' . $c['titre'] . ';}'
        . 'p{margin:0 0 20px;font-size:16px;line-height:1.6;}'
        . 'hr{border:0;border-top:1px solid ' . $c['bord'] . ';margin:28px 0;}'
        . '.btn{display:inline-block;background:' . $c['accent'] . ';color:' . $c['sur_accent'] . ';border-radius:999px;padding:12px 22px;font-weight:600;text-decoration:none;}'
        . 'button.btn{border:0;cursor:pointer;font:inherit;font-weight:600;}'
        . 'form{display:inline-block;margin:0 16px 0 0;}'
        . '.discret{color:' . $c['discret'] . ';font-size:14px;}'
        . '</style></head><body><main>'
        . '<a class="logo" href="/"><img src="' . nl_esc($logo) . '" alt="' . nl_esc(NL_SITE_NOM) . '" /></a>'
        . '<div class="carte">' . $corps
        . ($formulaire !== null
            ? '<form method="post" action="' . nl_esc($formulaire[0]) . '"><button class="btn" type="submit">' . nl_esc($formulaire[1]) . '</button></form>'
              . '<a class="discret" href="' . nl_esc($retour) . '">' . nl_esc(nl_textes($langue)['retour']) . '</a></div>'
            : '<a class="btn" href="' . nl_esc($retour) . '">' . nl_esc(nl_textes($langue)['retour']) . '</a></div>')
        . '</main></body></html>';
    exit;
}

/** Page bilingue (langue inconnue : lien invalide, panne, requête hors sujet). */
function nl_page_bilingue(string $cle, int $code): never
{
    nl_page(NL_LANGUES[0], array_map(static fn(string $l): array => nl_textes($l)[$cle], NL_LANGUES), $code);
}

/** Réponse d'inscription : JSON pour js/app.js, page HTML pour un envoi sans JS. */
function nl_repondre_inscription(string $langue, ?string $erreur, int $code = 200): never
{
    $T = nl_textes($langue);
    if (nl_veut_json()) {
        nl_json($erreur === null ? ['ok' => true, 'message' => $T['ok']] : ['ok' => false, 'error' => $erreur], $code);
    }
    nl_page($langue, [$erreur === null ? $T['p_ok'] : [$T['p_erreur'], $erreur]], $code);
}

/* ───────────────────────────── Actions ───────────────────────────── */

function nl_action_inscrire(): never
{
    $langue = nl_langue($_POST['lang'] ?? null);
    $T = nl_textes($langue);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        nl_repondre_inscription($langue, $T['methode'], 405);
    }
    if (!nl_origine_ok($_SERVER)) {
        nl_evenement('origine');
        nl_repondre_inscription($langue, $T['origine'], 403);
    }
    $piege = nl_piege($_POST);
    if ($piege === 'honeypot' || $piege === 'horodatage') {
        nl_evenement($piege);
        nl_repondre_inscription($langue, null);            // faux succès : ne rien apprendre au robot
    }
    if ($piege === 'trop_rapide') {
        nl_evenement('trop_rapide');
        nl_repondre_inscription($langue, $T['trop_rapide'], 400);
    }
    $email = nl_email_normalise(nl_champ($_POST, 'email'));
    if ($email === null) {
        nl_evenement('invalide', ['lang' => $langue]);
        nl_repondre_inscription($langue, $T['email'], 400);
    }
    if (function_exists('nsy_over_daily_cap')
        && nsy_over_daily_cap(NL_FORMULAIRE, (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), NL_PLAFOND_IP_JOUR)) {
        nl_evenement('plafond');
        nl_repondre_inscription($langue, $T['plafond'], 429);
    }
    $config = is_file(NL_CONFIG) ? require NL_CONFIG : null;
    if (!is_array($config) || empty($config['smtp_host']) || empty($config['smtp_username'])) {
        nl_diag('configuration SMTP absente ou incomplète (' . basename(NL_CONFIG) . ')');
        nl_evenement('erreur_config');
        nl_repondre_inscription($langue, $T['indispo'], 500);
    }

    $maintenant = time();
    $r = nl_modifier(NL_STOCK, static function (array &$ab) use ($email, $langue, $maintenant): array {
        return nl_inscrire($ab, $email, $langue, $maintenant);
    }, $maintenant);
    if (!$r['ok']) {
        nl_diag('stockage : ' . $r['raison']);
        nl_evenement('erreur_stockage');
        nl_repondre_inscription($langue, $T['indispo'], 500);
    }
    $res = $r['resultat'];
    $extra = ['lang' => $langue] + (trim(nl_champ($_POST, 'rendu')) === '' ? ['horodatage' => 'absent'] : []);
    if ($res['jeton'] === null) {                          // déjà confirmé, ou cadence : même réponse
        nl_evenement($res['issue'], $extra);
        nl_repondre_inscription($langue, null);
    }

    try {
        nl_envoyer($config, nl_message_confirmation($email, $langue, $res['jeton']));
    } catch (Throwable $e) {
        nl_diag('SMTP (confirmation) : ' . $e->getMessage());
        $annul = nl_modifier(NL_STOCK, static function (array &$ab) use ($email, $res): bool {
            return nl_annuler($ab, $email, $res['jeton'], $res['precedent']);
        });
        if (!$annul['ok']) {
            nl_diag('annulation impossible après échec SMTP : ' . $annul['raison']);
        }
        nl_evenement('erreur_envoi', ['lang' => $langue]);
        if (function_exists('nsy_alerte_owner')) {
            nsy_alerte_owner($config, '[' . NL_SITE_NOM . '] Newsletter : e-mail de confirmation impossible',
                "L'inscription à la newsletter n'a pas pu envoyer son e-mail de confirmation.\n"
                . "Le visiteur a vu un message d'erreur et peut réessayer ; rien n'a été enregistré.\n\n"
                . "Détail (adresses masquées) : _secret/" . basename(NL_DIAG) . "\n"
                . "Cette alerte est envoyée au plus une fois par 24 h.\n", 'newsletter');
        }
        nl_repondre_inscription($langue, $T['envoi'], 500);
    }
    nl_evenement($res['issue'], $extra);
    nl_repondre_inscription($langue, null);
}

/**
 * confirmer | desinscrire : même squelette, transition différente.
 * GET = lecture seule, page à bouton ; HEAD = sonde, rien ; POST = la transition.
 */
function nl_action_jeton(string $action): never
{
    $methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($methode, ['GET', 'HEAD', 'POST'], true)) {
        header('Allow: GET, HEAD, POST');
        nl_page_bilingue('requete', 405);
    }
    $jeton = nl_champ($_GET, 't');
    if (!nl_jeton_valide($jeton)) {
        nl_page_bilingue('inconnu', 404);
    }
    if ($methode === 'HEAD') {                             // sonde de lien : ne rien modifier
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(200);
        exit;
    }
    $maintenant = time();
    if ($methode === 'GET') {                              // lecture seule : un robot qui ouvre le lien ne change rien
        $ab = nl_charger(NL_STOCK);
        if ($ab === null) {
            nl_diag('stockage : newsletter.json illisible (lecture)');
            nl_evenement('erreur_stockage');
            nl_page_bilingue('panne', 503);
        }
        $ab = nl_purger($ab, $maintenant);                 // une attente périmée n'est plus un lien valable
        $i = nl_index_jeton($ab, $jeton);
        if ($i === null) {
            nl_page_bilingue('inconnu', 404);
        }
        $langue = nl_langue($ab[$i]['langue'] ?? null);
        $etat = (string) ($ab[$i]['etat'] ?? '');
        $T = nl_textes($langue);
        if ($action === 'confirmer' && $etat !== 'attente') {
            nl_page($langue, [$T[$etat === 'confirme' ? 'deja_confirme' : 'desinscrit']]);
        }
        if ($action === 'desinscrire' && $etat === 'desinscrit') {
            nl_page($langue, [$T['deja_desinscrit']]);
        }
        $q = $T['q_' . $action];
        nl_page($langue, [[$q[0], $q[1]]], 200, [nl_lien_local($action, $jeton), $q[2]]);
    }
    $r = nl_modifier(NL_STOCK, static function (array &$ab) use ($action, $jeton, $maintenant): array {
        return $action === 'confirmer' ? nl_confirmer($ab, $jeton, $maintenant) : nl_desinscrire($ab, $jeton, $maintenant);
    }, $maintenant);
    if (!$r['ok']) {
        nl_diag('stockage : ' . $r['raison']);
        nl_evenement('erreur_stockage');
        nl_page_bilingue('panne', 503);
    }
    $issue = $r['resultat']['issue'];
    if ($issue === 'inconnu') {
        nl_page_bilingue('inconnu', 404);
    }
    $langue = $r['resultat']['langue'];
    if ($issue === 'confirmation') {
        nl_evenement('confirmation', ['lang' => $langue]);
    } elseif ($issue === 'desinscription') {
        nl_evenement('desinscription', ['lang' => $langue, 'mode' => isset($_POST['List-Unsubscribe']) ? 'un_clic' : 'bouton']);
    }
    nl_page($langue, [nl_textes($langue)[$issue]]);
}

// ───── Mode bibliothèque : fonctions seules (tests, futur tableau de bord) ─────
if (defined('NL_BIBLIOTHEQUE')) {
    return;
}

date_default_timezone_set(NL_FUSEAU);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);   // les dépréciations ne vont JAMAIS au journal
ini_set('display_errors', '0');
set_error_handler('nl_garde_erreur', E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ob_start();
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

try {
    foreach (['formulaires.php', 'antispam.php'] as $dep) {
        if (is_file(__DIR__ . '/' . $dep)) {
            require_once __DIR__ . '/' . $dep;
        }
    }
    $action = nl_champ($_GET, 'action') ?: nl_champ($_POST, 'action');
    if ($action === 'inscrire') {
        nl_action_inscrire();
    }
    if ($action === 'confirmer' || $action === 'desinscrire') {
        nl_action_jeton($action);
    }
    nl_page_bilingue('requete', 400);
} catch (Throwable $e) {
    nl_diag('arrêt : ' . get_class($e) . ' — ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
    if ((nl_champ($_GET, 'action') ?: nl_champ($_POST, 'action')) === 'inscrire') {
        $l = nl_langue($_POST['lang'] ?? null);
        nl_repondre_inscription($l, nl_textes($l)['indispo'], 500);
    }
    nl_page_bilingue('panne', 500);
}
