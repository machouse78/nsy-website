<?php
/**
 * Tests unitaires de l'anti-spam partagé (antispam.php — code RÉEL, pas une
 * copie) : scoring de contenu, seuil, plafond journalier par IP.
 * Lancer via tests/run-tests.sh (docker php).
 */
declare(strict_types=1);
require __DIR__ . '/../antispam.php';

$fail = 0;
function t(string $name, bool $ok): void {
    global $fail;
    echo ($ok ? "  ✓ " : "  ✗ ÉCHEC ") . $name . "\n";
    if (!$ok) $fail++;
}

// ── Soumissions légitimes → sous le seuil ──
t('demande B2B FR saine', !nsy_is_spam(
    "Bonjour, nous cherchons un accompagnement pour migrer notre socle Java EE vers Jakarta. Pouvez-vous nous rappeler ?",
    'dsi@banque-exemple.fr', 'Marie Dupont', 'Banque Exemple'));
t('demande EN saine', !nsy_is_spam(
    'Hello, we would like a quote for an AI-powered website for our firm.',
    'ceo@company.co.uk', 'John Smith', 'Company Ltd'));
t('1 URL légitime < seuil', nsy_spam_score('Notre site actuel : https://www.exemple.fr — refonte à prévoir.') < NSY_SPAM_THRESHOLD);
t('montant sans symbole < seuil', nsy_spam_score('Budget prévu : environ 15 000 EUR pour la refonte du site.') < NSY_SPAM_THRESHOLD);

// ── Spam → au seuil ou au-delà ──
t('2 URLs → spam', nsy_is_spam('Check https://a.com and https://b.com'));
t('raccourcisseur bit.ly → spam', nsy_is_spam('Great offer here bit.ly/xyz'));
t('mots-clés SEO/backlink → spam', nsy_is_spam('We provide seo services and backlink packages to rank your website'));
t('crypto + make money → spam', nsy_is_spam('Invest in crypto and make money fast'));
t('lien BBCode injecté → +4 cumulés', nsy_spam_score('Hello [url=http://x]click[/url]') >= 7);
t('TLD .ru + URL → spam', nsy_is_spam('Visit https://promo.example.ru now'));
t('MAJUSCULES + $ + mot-clé → spam', nsy_is_spam('EARN UNLIMITED CASH TODAY GUARANTEED $1,500 viagra'));

// ── Plafond journalier (code réel sur fichiers temp, clé isolée) ──
$key = 'test' . substr(md5((string)mt_rand()), 0, 8);
$ip  = '203.0.113.42';
$ok5 = true;
for ($i = 1; $i <= 5; $i++) { if (nsy_over_daily_cap($key, $ip, 5)) $ok5 = false; }
t('plafond 5/jour : les 5 premiers passent', $ok5);
t('plafond 5/jour : le 6e est bloqué', nsy_over_daily_cap($key, $ip, 5));
t('plafond : une autre IP n\'est pas affectée', !nsy_over_daily_cap($key, '198.51.100.7', 5));
@unlink(sys_get_temp_dir() . '/nsy_cap_' . $key . '_' . md5($ip) . '.json');
@unlink(sys_get_temp_dir() . '/nsy_cap_' . $key . '_' . md5('198.51.100.7') . '.json');

echo $fail === 0 ? "ANTISPAM : TOUS LES TESTS PASSENT\n" : "ANTISPAM : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
