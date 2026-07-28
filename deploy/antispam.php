<?php
/**
 * NSY — Anti-spam serveur partagé (contact.php + faisabilite.php).
 *
 * Défense de contenu + plafond journalier par IP, en complément du honeypot,
 * de Cloudflare Turnstile et du throttle 60 s déjà en place. Aucun secret ici :
 * c'est du code, il est commité et déployé normalement.
 *
 * Le score de spam est heuristique : plus il est haut, plus la soumission est
 * suspecte. Au-delà du seuil, l'appelant abandonne SILENCIEUSEMENT (faux succès,
 * comme le honeypot) pour ne pas renseigner le spammeur, et journalise dans
 * _secret/spam.log (inaccessible en HTTP, lisible en FTP) — filet de sécurité
 * pour repérer un éventuel faux positif.
 */

declare(strict_types=1);

if (!defined('NSY_SPAM_THRESHOLD')) {
    define('NSY_SPAM_THRESHOLD', 5);
}

/** Score de spam d'une soumission (0 = sain ; >= NSY_SPAM_THRESHOLD = spam). */
function nsy_spam_score(string $message, string $email = '', string $name = '', string $company = ''): int
{
    $text = $name . "\n" . $company . "\n" . $email . "\n" . $message;
    $blob = mb_strtolower($text);
    $score = 0;

    // 1) URLs dans le texte — rares dans une vraie demande B2B, systématiques en spam.
    $urls = preg_match_all('#https?://#i', $blob);
    if ($urls >= 1) $score += 3;
    if ($urls >= 2) $score += 4;
    // Liens Markdown / BBCode / HTML injectés.
    if (preg_match('#\[/?url|</?a\b|href\s*=|\[link#i', $text)) {
        $score += 4;
    }

    // 2) Raccourcisseurs d'URL / domaines à très forte odeur de spam.
    $badHosts = [
        'telegra.ph', 't.me', 'bit.ly', 'tinyurl', 'cutt.ly', 'is.gd', 'goo.gl',
        'wa.me', 'api.whatsapp', 'rebrand.ly', 'shorturl', 'ow.ly', 'tiny.cc',
    ];
    foreach ($badHosts as $h) {
        if (str_contains($blob, $h)) {
            $score += 5;
        }
    }
    // TLD fréquemment utilisés par le spam.
    if (preg_match('#\.(ru|top|xyz|club|online|site|live|loan|work|buzz|icu|cn|tk)\b#i', $blob)) {
        $score += 2;
    }

    // 3) Mots-clés spam — quasi absents d'une vraie demande de conseil FR/EN.
    $kw = [
        'crypto', 'bitcoin', 'cryptocurrenc', 'ethereum', 'forex', 'casino', 'betting',
        'viagra', 'cialis', 'porn', 'escort', 'seo service', 'seo services', 'backlink',
        'rank your', 'guest post', 'payday', 'earn $', 'earn €', 'make money', 'per day',
        'passive income', 'work from home', 'investment opportunity', 'binary option',
        'get rich', 'free money', 'click here', 'limited offer', 'act now', 'weight loss',
        'gambling', 'jackpot', 'win big', 'webcam', 'adult content', 'nude',
    ];
    foreach ($kw as $k) {
        if (str_contains($blob, $k)) {
            $score += 3;
        }
    }

    // 4) Montants « $1,500 », « €500/day »…
    if (preg_match('#[$€£]\s?\d[\d.,]{2,}#u', $text)) {
        $score += 2;
    }
    // 5) Longue séquence EN MAJUSCULES (typique des pubs criardes).
    if (preg_match('#[A-Z][A-Z0-9 ]{18,}#', $text)) {
        $score += 2;
    }

    return $score;
}

/** Raccourci booléen. */
function nsy_is_spam(string $message, string $email = '', string $name = '', string $company = ''): bool
{
    return nsy_spam_score($message, $email, $name, $company) >= NSY_SPAM_THRESHOLD;
}

/** Journalise une soumission bloquée (_secret/spam.log — 403 en HTTP, lisible en FTP). */
function nsy_spam_log(string $tag, array $fields, int $score, string $ip): void
{
    $clip = static fn($v, int $n): string => preg_replace('/\s+/', ' ', substr((string)$v, 0, $n)) ?? '';
    $line = date('c') . " [$tag] score=$score ip=$ip"
        . ' name=' . $clip($fields['name'] ?? '', 60)
        . ' email=' . $clip($fields['email'] ?? '', 80)
        . ' msg=' . $clip($fields['message'] ?? '', 200)
        . "\n";
    @error_log($line, 3, __DIR__ . '/_secret/spam.log');
}

/**
 * Plafond journalier par IP (en plus du throttle 60 s). true = plafond dépassé.
 * $key distingue les formulaires (« contact », « faisa ») ; compteur par IP hachée.
 */
function nsy_over_daily_cap(string $key, string $ip, int $maxPerDay): bool
{
    $file = sys_get_temp_dir() . '/nsy_cap_' . $key . '_' . md5($ip) . '.json';
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
