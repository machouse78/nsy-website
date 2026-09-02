<?php
/**
 * Tests du verdict Turnstile (formulaires.php, code réel) — l'appel HTTP vers
 * Cloudflare est remplacé par une fonction de test, aucun réseau.
 *
 * La règle protégée ici est née le 02/09/2026 : Cloudflare rejetait la clé
 * secrète (« invalid-input-secret ») et CHAQUE visiteur humain recevait une
 * 403. Un défaut de NOTRE configuration ne doit jamais bloquer un envoi.
 */
declare(strict_types=1);
require_once dirname(__DIR__) . '/formulaires.php';

$fail = 0;
function t(string $name, bool $ok, string $info = ''): void {
    global $fail;
    echo ($ok ? "  ✓ " : "  ✗ ÉCHEC ") . $name . ($ok || $info === '' ? '' : " — $info") . "\n";
    if (!$ok) $fail++;
}
/** Simule Cloudflare : la réponse dépend du secret et du jeton reçus. */
function cloudflare_simule(string $etatSecret): callable {
    return static function (array $champs) use ($etatSecret): array {
        if ($etatSecret === 'injoignable') return [0, '', 'Could not resolve host'];
        if ($etatSecret === 'html')        return [502, '<html>Bad gateway</html>', ''];
        if ($etatSecret === 'rejete')      return [400, '{"error-codes":["invalid-input-secret"],"success":false}', ''];
        // secret sain : le jeton décide
        $token = (string) ($champs['response'] ?? '');
        if ($token === 'bon-jeton')  return [200, '{"success":true,"error-codes":[]}', ''];
        if ($token === 'jeton-expire') return [200, '{"success":false,"error-codes":["timeout-or-duplicate"]}', ''];
        return [200, '{"success":false,"error-codes":["invalid-input-response"]}', ''];
    };
}

echo "── Clé saine ──\n";
$GLOBALS['NSY_TURNSTILE_HTTP'] = cloudflare_simule('sain');
$v = nsy_turnstile_verdict('0xSECRET', 'bon-jeton', '1.2.3.4');
t('jeton valide → ok', $v['verdict'] === 'ok', $v['verdict']);
$v = nsy_turnstile_verdict('0xSECRET', 'jeton-bidon', '1.2.3.4');
t('jeton invalide → bot (refus légitime)', $v['verdict'] === 'bot', $v['verdict']);
$v = nsy_turnstile_verdict('0xSECRET', 'jeton-expire', '1.2.3.4');
t('jeton expiré / déjà consommé → bot', $v['verdict'] === 'bot', $v['verdict']);
$v = nsy_turnstile_verdict('0xSECRET', '', '1.2.3.4');
t('jeton absent, clé saine → manquant (robot sans JS)', $v['verdict'] === 'manquant', $v['verdict']);
$s = nsy_turnstile_sante('0xSECRET');
t('santé : clé saine → ok', $s['ok'] === true);

echo "── Clé rejetée par Cloudflare (le cas du 02/09/2026) ──\n";
$GLOBALS['NSY_TURNSTILE_HTTP'] = cloudflare_simule('rejete');
$v = nsy_turnstile_verdict('0xVIEUX', 'bon-jeton', '1.2.3.4');
t('jeton présent, clé rejetée → BYPASS (jamais 403)', $v['verdict'] === 'bypass', $v['verdict']);
t('  raison explicite (invalid-input-secret)', str_contains($v['raison'], 'invalid-input-secret'), $v['raison']);
$v = nsy_turnstile_verdict('0xVIEUX', '', '1.2.3.4');
t('jeton ABSENT, clé rejetée → BYPASS (le widget est HS lui aussi)', $v['verdict'] === 'bypass', $v['verdict']);
$s = nsy_turnstile_sante('0xVIEUX');
t('santé : clé rejetée → KO', $s['ok'] === false && str_contains($s['raison'], 'invalid-input-secret'), $s['raison']);

echo "── Cloudflare en panne ──\n";
$GLOBALS['NSY_TURNSTILE_HTTP'] = cloudflare_simule('injoignable');
$v = nsy_turnstile_verdict('0xSECRET', 'bon-jeton', '1.2.3.4');
t('injoignable → bypass', $v['verdict'] === 'bypass', $v['verdict']);
$GLOBALS['NSY_TURNSTILE_HTTP'] = cloudflare_simule('html');
$v = nsy_turnstile_verdict('0xSECRET', 'bon-jeton', '1.2.3.4');
t('réponse illisible (HTML 502) → bypass', $v['verdict'] === 'bypass', $v['verdict']);

echo "── Classement brut ──\n";
$c = nsy_turnstile_classer(200, '{"success":false,"error-codes":["invalid-input-response","bad-request"]}', '');
t('mélange jeton + configuration → bypass (le doute profite au visiteur)', $c['verdict'] === 'bypass', $c['verdict']);
$c = nsy_turnstile_classer(200, '{"success":false}', '');
t('échec sans code → bypass', $c['verdict'] === 'bypass', $c['verdict']);

echo "── Journal des formulaires ──\n";
$tmp = sys_get_temp_dir() . '/nsy-formulaires-test.log';
file_put_contents($tmp, implode("\n", [
    '{"t":"2026-09-02T21:15:47+02:00","form":"contact","issue":"antibot_refuse"}',
    '{"t":"2026-09-02T21:16:04+02:00","form":"contact","issue":"antibot_refuse"}',
    '{"t":"2026-09-02T22:01:00+02:00","form":"contact","issue":"envoye","lang":"fr"}',
    '{"t":"2026-09-02T22:05:00+02:00","form":"faisa","issue":"honeypot"}',
    '{"t":"2026-09-01T10:00:00+02:00","form":"contact","issue":"envoye"}',
    'ligne corrompue',
]) . "\n");
$j = nsy_form_events_du_jour('2026-09-02', $tmp);
t('agrégation par formulaire et par issue', ($j['contact']['antibot_refuse'] ?? 0) === 2 && ($j['contact']['envoye'] ?? 0) === 1 && ($j['faisa']['honeypot'] ?? 0) === 1, json_encode($j));
t('la veille n\'est pas comptée', !isset($j['contact']['envoye']) || $j['contact']['envoye'] === 1);
t('un jour sans événement → tableau vide', nsy_form_events_du_jour('2026-08-01', $tmp) === []);
@unlink($tmp);

echo $fail === 0 ? "✅ Turnstile : tout passe\n" : "❌ Turnstile : $fail échec(s)\n";
exit($fail === 0 ? 0 : 1);
