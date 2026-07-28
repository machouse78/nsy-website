<?php
/**
 * Anti-spam serveur — module réutilisable pour formulaires web (PHP).
 *
 * Template du skill `antispam`. Copiez ce fichier à la racine du projet,
 * adaptez les points marqués « ADAPTER », puis appelez-le dans vos handlers de
 * formulaire (contact, devis, questionnaire…) juste avant l'envoi de l'email.
 *
 * Défense en profondeur (du moins cher au plus cher — arrêtez au 1er filtre) :
 *   1. honeypot (champ caché que seuls les bots remplissent)
 *   2. Turnstile / reCAPTCHA (vérif côté serveur)
 *   3. [CE MODULE] scoring de contenu
 *   4. rate-limit 60 s + plafond journalier par IP
 *   5. au-delà du seuil → abandon SILENCIEUX (faux succès) + log d'audit
 *
 * Aucun secret ici : c'est du code, il se commit et se déploie normalement.
 * Battle-tested sur nsy.fr (juillet 2026).
 */

declare(strict_types=1);

// ── ADAPTER : seuil de rejet. score >= seuil ⇒ considéré comme spam. ──
// 5 = bon compromis : bloque le spam évident, laisse passer une vraie demande
// qui partagerait UNE url propre (score 3). Montez à 6-7 si faux positifs.
if (!defined('SPAM_THRESHOLD')) {
    define('SPAM_THRESHOLD', 5);
}

// ── ADAPTER : chemin du journal d'audit. DOIT être hors racine web (403). ──
// Ex. un dossier _secret/ protégé par un .htaccess « Deny from all ».
if (!defined('SPAM_LOG')) {
    define('SPAM_LOG', __DIR__ . '/_secret/spam.log');
}

/**
 * Score de spam d'une soumission (0 = sain ; >= SPAM_THRESHOLD = spam).
 * $message = texte libre principal ; $extra = tout autre texte (payload, etc.).
 */
function spam_score(string $message, string $email = '', string $name = '', string $extra = ''): int
{
    $text = $name . "\n" . $extra . "\n" . $email . "\n" . $message;
    $blob = mb_strtolower($text);
    $score = 0;

    // 1) URLs — rares dans une vraie demande B2B, systématiques en spam.
    $urls = preg_match_all('#https?://#i', $blob);
    if ($urls >= 1) $score += 3;
    if ($urls >= 2) $score += 4;
    // Liens Markdown / BBCode / HTML injectés.
    if (preg_match('#\[/?url|</?a\b|href\s*=|\[link#i', $text)) {
        $score += 4;
    }

    // 2) Raccourcisseurs d'URL / domaines à très forte odeur de spam.
    // ADAPTER : ajoutez ceux que vous voyez passer dans votre log d'audit.
    $badHosts = [
        'telegra.ph', 't.me', 'bit.ly', 'tinyurl', 'cutt.ly', 'is.gd', 'goo.gl',
        'wa.me', 'api.whatsapp', 'rebrand.ly', 'shorturl', 'ow.ly', 'tiny.cc',
    ];
    foreach ($badHosts as $h) {
        if (str_contains($blob, $h)) $score += 5;
    }
    // TLD fréquemment utilisés par le spam.
    if (preg_match('#\.(ru|top|xyz|club|online|site|live|loan|work|buzz|icu|cn|tk)\b#i', $blob)) {
        $score += 2;
    }

    // 3) Mots-clés spam — quasi absents d'une vraie demande de conseil FR/EN.
    // ADAPTER : selon le métier. Ne mettez PAS de terme légitime de votre
    // secteur (ex. « seo » seul si vous vendez du SEO — préférez « seo service »).
    $kw = [
        'crypto', 'bitcoin', 'cryptocurrenc', 'ethereum', 'forex', 'casino', 'betting',
        'viagra', 'cialis', 'porn', 'escort', 'seo service', 'seo services', 'backlink',
        'rank your', 'guest post', 'payday', 'earn $', 'earn €', 'make money', 'per day',
        'passive income', 'work from home', 'investment opportunity', 'binary option',
        'get rich', 'free money', 'click here', 'limited offer', 'act now', 'weight loss',
        'gambling', 'jackpot', 'win big', 'webcam', 'adult content', 'nude',
    ];
    foreach ($kw as $k) {
        if (str_contains($blob, $k)) $score += 3;
    }

    // 4) Montants « $1,500 », « €500/day »…
    if (preg_match('#[$€£]\s?\d[\d.,]{2,}#u', $text)) $score += 2;
    // 5) Longue séquence EN MAJUSCULES (typique des pubs criardes).
    if (preg_match('#[A-Z][A-Z0-9 ]{18,}#', $text)) $score += 2;

    return $score;
}

/** Raccourci booléen. */
function is_spam(string $message, string $email = '', string $name = '', string $extra = ''): bool
{
    return spam_score($message, $email, $name, $extra) >= SPAM_THRESHOLD;
}

/**
 * Journalise une soumission bloquée (filet de sécurité pour repérer un faux
 * positif). Fichier hors racine web → invisible en HTTP, lisible en FTP/SSH.
 */
function spam_log(string $tag, array $fields, int $score, string $ip): void
{
    $clip = static fn($v, int $n): string => preg_replace('/\s+/', ' ', substr((string)$v, 0, $n)) ?? '';
    $line = date('c') . " [$tag] score=$score ip=$ip"
        . ' name=' . $clip($fields['name'] ?? '', 60)
        . ' email=' . $clip($fields['email'] ?? '', 80)
        . ' msg=' . $clip($fields['message'] ?? '', 200)
        . "\n";
    @error_log($line, 3, SPAM_LOG);
}

/**
 * Plafond journalier par IP (en plus d'un éventuel throttle 60 s). true = dépassé.
 * $key distingue les formulaires (« contact », « devis »…) ; compteur IP hachée.
 */
function over_daily_cap(string $key, string $ip, int $maxPerDay): bool
{
    $file = sys_get_temp_dir() . '/spam_cap_' . $key . '_' . md5($ip) . '.json';
    $today = date('Y-m-d');
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false; // stockage indisponible → ne bloque pas un visiteur légitime
    }
    flock($fh, LOCK_EX);
    $d = json_decode((string)stream_get_contents($fh), true);
    if (!is_array($d) || ($d['day'] ?? '') !== $today) {
        $d = ['day' => $today, 'count' => 0];
    }
    $over = ((int)($d['count'] ?? 0)) >= $maxPerDay;
    if (!$over) {
        $d['count'] = ((int)($d['count'] ?? 0)) + 1;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($d));
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $over;
}

/* ─────────────────────────────────────────────────────────────────────────
 * INTÉGRATION — dans votre handler PHP, APRÈS honeypot + Turnstile + validation
 * des champs, et AVANT l'envoi de l'email :
 *
 *   require_once __DIR__ . '/antispam.php';
 *   $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
 *
 *   // Plafond journalier (en plus de votre throttle 60 s).
 *   if (over_daily_cap('contact', $ip, 5)) {
 *       http_response_code(429);
 *       echo json_encode(['ok' => false, 'error' => 'Trop de demandes aujourd’hui.']);
 *       exit;
 *   }
 *
 *   // Filtrage de contenu : abandon SILENCIEUX (le bot croit avoir réussi) + log.
 *   $score = spam_score($message, $email, $name, $company);
 *   if ($score >= SPAM_THRESHOLD) {
 *       spam_log('contact', ['name' => $name, 'email' => $email, 'message' => $message], $score, $ip);
 *       echo json_encode(['ok' => true]); // faux succès : ne renseigne pas le spammeur
 *       exit;
 *   }
 * ───────────────────────────────────────────────────────────────────────── */
