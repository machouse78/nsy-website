<?php
/**
 * formulaires.php — socle partagé des formulaires (contact.php, faisabilite.php)
 * et du collecteur KPI. Trois services :
 *
 *   1. nsy_turnstile_verdict()  — la vérification Cloudflare Turnstile, avec un
 *      principe né le 02/09/2026 : quand c'est NOTRE configuration qui est en
 *      cause (clé secrète rejetée, Cloudflare injoignable, réponse illisible),
 *      le contrôle est CONTOURNÉ et non bloquant. Ce soir-là, Cloudflare a
 *      cessé d'accepter la clé (« invalid-input-secret ») et chaque visiteur
 *      humain recevait une 403 : un formulaire de contact muet, c'est du
 *      chiffre d'affaires perdu. Les autres remparts (honeypot, cadence,
 *      plafond journalier, score anti-spam) restent actifs pendant le bypass.
 *      Seul un verdict qui incrimine le JETON du visiteur (jeton invalide,
 *      expiré, déjà consommé) reste un refus : là, c'est bien un robot.
 *
 *   2. nsy_form_event()          — journal des envois et tentatives, une ligne
 *      JSON par événement dans _secret/formulaires.log, SANS donnée personnelle
 *      (ni IP, ni nom, ni email) : c'est ce que le tableau de bord KPI agrège.
 *
 *   3. nsy_alerte_owner()        — un e-mail au propriétaire, au plus un par
 *      24 h et par sujet (fichier-témoin dans _secret/), pour qu'une panne
 *      silencieuse ne le reste jamais plus d'une journée.
 *
 * Tout est tolérant : rien ici ne doit jamais faire échouer un envoi.
 */
declare(strict_types=1);

/** Issues possibles d'une tentative d'envoi — la nomenclature du tableau de bord. */
const NSY_FORM_ISSUES = [
    'envoye'           => 'Envoyé',
    'antibot_bypass'   => 'Envoyé, anti-bot contourné',
    'honeypot'         => 'Robot (honeypot)',
    'spam'             => 'Spam (contenu)',
    'antibot_manquant' => 'Anti-bot absent',
    'antibot_refuse'   => 'Anti-bot refusé',
    'invalide'         => 'Champs invalides',
    'throttle'         => 'Cadence (1/min)',
    'plafond'          => 'Plafond journalier',
    'erreur_envoi'     => 'Erreur d\'envoi',
    'erreur_config'    => 'Erreur de configuration',
];

/**
 * Appel HTTP vers siteverify — isolé pour être remplaçable dans les tests
 * ($GLOBALS['NSY_TURNSTILE_HTTP'] = fn(array $champs): array [code, corps, erreurCurl]).
 */
function nsy_turnstile_http(array $champs): array
{
    if (isset($GLOBALS['NSY_TURNSTILE_HTTP']) && is_callable($GLOBALS['NSY_TURNSTILE_HTTP'])) {
        return ($GLOBALS['NSY_TURNSTILE_HTTP'])($champs);
    }
    $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($champs),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    return [$code, is_string($raw) ? $raw : '', $err];
}

/**
 * Classe une réponse siteverify.
 *  - 'ok'     : Cloudflare valide le jeton ;
 *  - 'bot'    : Cloudflare incrimine LE JETON (invalide, expiré, déjà consommé) → refus légitime ;
 *  - 'bypass' : le problème est chez nous ou chez Cloudflare (clé rejetée, appel
 *               en échec, réponse illisible) → le contrôle ne doit pas bloquer.
 */
function nsy_turnstile_classer(int $code, string $raw, string $err): array
{
    if ($err !== '' || $raw === '') {
        return ['verdict' => 'bypass', 'raison' => 'Cloudflare injoignable (' . ($err ?: 'réponse vide') . ')'];
    }
    $j = json_decode($raw, true);
    if (!is_array($j)) {
        return ['verdict' => 'bypass', 'raison' => 'réponse Cloudflare illisible (HTTP ' . $code . ')'];
    }
    if (!empty($j['success'])) {
        return ['verdict' => 'ok', 'raison' => ''];
    }
    $codes = array_map('strval', (array) ($j['error-codes'] ?? []));
    $fauteDuJeton = ['invalid-input-response', 'timeout-or-duplicate', 'missing-input-response'];
    $autres = array_diff($codes, $fauteDuJeton);
    if ($codes && !$autres) {
        return ['verdict' => 'bot', 'raison' => implode(',', $codes)];
    }
    // invalid-input-secret, missing-input-secret, bad-request, internal-error,
    // ou aucun code du tout : ce n'est pas le visiteur qu'il faut punir.
    return ['verdict' => 'bypass', 'raison' => 'Cloudflare : ' . ($codes ? implode(',', $codes) : 'échec sans code') . ' (HTTP ' . $code . ')'];
}

/**
 * Le verdict complet pour une soumission.
 * Jeton vide : avant de conclure « robot », on vérifie que la clé est encore
 * acceptée par Cloudflare (sonde avec un jeton factice). Si la clé est rejetée,
 * le widget côté page est probablement lui aussi hors service (même widget,
 * même paire de clés) : un humain n'a alors AUCUN moyen d'obtenir un jeton.
 *  → 'manquant' : jeton absent et clé saine (un robot qui n'exécute pas le JS).
 */
function nsy_turnstile_verdict(string $secret, string $token, string $ip): array
{
    if ($token === '') {
        $sante = nsy_turnstile_sante($secret);
        if (!$sante['ok']) {
            return ['verdict' => 'bypass', 'raison' => $sante['raison'] . ' — et jeton absent'];
        }
        return ['verdict' => 'manquant', 'raison' => 'jeton absent, clé saine'];
    }
    [$code, $raw, $err] = nsy_turnstile_http(['secret' => $secret, 'response' => $token, 'remoteip' => $ip]);
    return nsy_turnstile_classer($code, $raw, $err);
}

/**
 * Santé de la clé secrète : un jeton factice doit produire EXACTEMENT
 * « invalid-input-response ». Toute autre réponse signifie que la clé, la
 * liaison ou Cloudflare sont en défaut. Utilisé par le verdict (jeton vide),
 * par le collecteur KPI chaque jour, et par la pré-vérification du déploiement.
 */
function nsy_turnstile_sante(string $secret): array
{
    [$code, $raw, $err] = nsy_turnstile_http(['secret' => $secret, 'response' => 'sonde-sante-nsy']);
    $c = nsy_turnstile_classer($code, $raw, $err);
    if ($c['verdict'] === 'bot') {
        return ['ok' => true, 'raison' => ''];
    }
    return ['ok' => false, 'raison' => $c['verdict'] === 'ok' ? 'Cloudflare valide un jeton factice (?!)' : $c['raison']];
}

/** Journal des tentatives — une ligne JSON, sans donnée personnelle. */
function nsy_form_event(string $form, string $issue, array $extra = []): void
{
    $ligne = ['t' => date('c'), 'form' => $form, 'issue' => $issue] + $extra;
    @file_put_contents(__DIR__ . '/_secret/formulaires.log', json_encode($ligne, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * Lit le journal des formulaires pour un jour donné (Y-m-d) → compteurs par
 * formulaire et par issue. Utilisé par le collecteur KPI.
 */
function nsy_form_events_du_jour(string $jour, string $fichier = ''): array
{
    $fichier = $fichier ?: __DIR__ . '/_secret/formulaires.log';
    $out = [];
    if (!is_readable($fichier)) return $out;
    $h = fopen($fichier, 'r');
    if (!$h) return $out;
    while (($l = fgets($h)) !== false) {
        if (!str_starts_with($l, '{"t":"' . $jour)) continue;
        $e = json_decode($l, true);
        if (!is_array($e) || empty($e['form']) || empty($e['issue'])) continue;
        $f = (string) $e['form']; $i = (string) $e['issue'];
        $out[$f][$i] = ($out[$f][$i] ?? 0) + 1;
    }
    fclose($h);
    return $out;
}

/**
 * Alerte e-mail au propriétaire, au plus UNE par 24 h et par clé (fichier-témoin).
 * Retourne true si un e-mail est parti. Ne lève jamais.
 */
function nsy_alerte_owner(array $config, string $sujet, string $texte, string $cle = 'generale'): bool
{
    $temoin = __DIR__ . '/_secret/alerte-' . preg_replace('/[^a-z0-9-]/', '', strtolower($cle)) . '.txt';
    if (file_exists($temoin) && (time() - (int) filemtime($temoin)) < 86400) return false;
    if (empty($config['smtp_host']) || empty($config['to_address'])) return false;
    @touch($temoin);
    try {
        foreach (['Exception', 'PHPMailer', 'SMTP'] as $c) {
            if (!class_exists('\\PHPMailer\\PHPMailer\\' . $c)) require_once __DIR__ . '/vendor/PHPMailer/src/' . $c . '.php';
        }
        $m = new \PHPMailer\PHPMailer\PHPMailer(true);
        $m->isSMTP();
        $m->Host       = $config['smtp_host'];
        $m->SMTPAuth   = true;
        $m->Username   = $config['smtp_username'];
        $m->Password   = $config['smtp_password'];
        $m->SMTPSecure = $config['smtp_secure'];
        $m->Port       = (int) $config['smtp_port'];
        $m->CharSet    = 'UTF-8';
        $m->Timeout    = 15;
        $m->setFrom($config['smtp_username'], 'Alerte NSY');
        $m->addAddress($config['to_address'], $config['to_name'] ?? 'NSY');
        $m->Subject = $sujet;
        $m->Body    = $texte;
        $m->send();
        return true;
    } catch (\Throwable $e) {
        error_log('NSY alerte: envoi impossible — ' . $e->getMessage());
        return false;
    }
}
