<?php
/**
 * Tests unitaires de la sanitisation de chat.php (code RÉEL, pas une copie) :
 * NSY_CHAT_TEST court-circuite le endpoint, les fonctions restent définies.
 * Lancer via tests/run-tests.sh (docker php:8.3-cli-alpine).
 */
declare(strict_types=1);
define('NSY_CHAT_TEST', true);
require __DIR__ . '/../chat.php';

$fail = 0;
function t(string $name, bool $ok): void {
    global $fail;
    echo ($ok ? "  ✓ " : "  ✗ ÉCHEC ") . $name . "\n";
    if (!$ok) $fail++;
}

// ── Whitelist : chaque lien officiel survit (markdown ET nu) ──
$officials = [
    'https://www.prv-concept.com',
    'https://prv-concept.com/forum',
    'https://www.lecerfthym.fr',
    'https://lecerfthym.fr/carte.html',
    'https://www.linkedin.com/company/nsy-new-software-yard',
    'https://www.linkedin.com/in/c%C3%A9dric-barme/',
    'https://www.linkedin.com/in/cédric-barme/',
    'https://github.com/machouse78',
    'https://github.com/machouse78/nsy-website',
    'https://youtube.com/@new-software-yard',
    'https://www.youtube.com/@new-software-yard',
    'https://www.linkedin.com/pulse/seo-vs-geo-votre-site-est-bien-class%C3%A9-sur-google-0znee',
    'https://www.facebook.com/share/17vyLQjakE/?mibextid=wwXIfr',
    'https://www.linkedin.com/pulse/votre-forum-est-une-mine-dor-pour-lia-%25C3%25A0-condition-1icee',
    'https://www.facebook.com/share/p/1Ey4FXBYDA',
];
foreach ($officials as $u) {
    t("officiel conservé (markdown) : $u", str_contains(nsy_sanitize_reply("Voir [lien]($u) ici et voilà."), $u));
    t("officiel conservé (nu) : $u", str_contains(nsy_sanitize_reply("Voir $u ici et voilà."), $u));
}
// nsy.fr passe toujours
t('nsy.fr conservé', str_contains(nsy_sanitize_reply('Va sur https://www.nsy.fr/faq.html et voilà.'), 'https://www.nsy.fr/faq.html'));

// ── Externes non officiels : markdown → libellé seul, nus → supprimés ──
$r = nsy_sanitize_reply("Essayez [Wix](https://www.wix.com) ou https://www.squarespace.com pour ça et voilà.");
t('externe markdown → libellé seul', str_contains($r, 'Wix') && !str_contains($r, 'wix.com'));
t('externe nu supprimé', !str_contains($r, 'squarespace'));
// linkedin NON officiel (autre profil) → neutralisé
$r = nsy_sanitize_reply("Contactez [lui](https://www.linkedin.com/in/quelquun-dautre) svp et voilà.");
t('linkedin non officiel neutralisé', !str_contains($r, 'linkedin.com/in/quelquun'));

// ── Purge des () vides + espaces ──
$r = nsy_sanitize_reply("Le Cerf Thym (https://www.evil.com) est top, oui ( ) vraiment et voilà.");
t('parenthèses vides purgées', !str_contains($r, '()') && !str_contains($r, '( )'));
t('pas de double espace', !preg_match('/  /', $r));

// ── Linkmap FR/EN : liens internes alignés sur la langue détectée ──
$fr = nsy_sanitize_reply("Pour une réponse sur votre projet avec nous, voyez la page [Contact](contact-en.html) et le [portfolio](portfolio.html).");
t('réponse FR → liens FR', str_contains($fr, '](contact.html)') && str_contains($fr, '](realisations.html)'));
$en = nsy_sanitize_reply("The best way for you and your team: check the [Contact](contact.html) page and more with the [work](realisations.html#top).");
t('réponse EN → liens EN', str_contains($en, '](contact-en.html)') && str_contains($en, '](portfolio.html#top)'));
t('ancre préservée', str_contains($en, '#top)'));

// ── Cap 4000 ──
t('cap 4000 caractères', mb_strlen(nsy_sanitize_reply(str_repeat('aé ', 3000))) <= 4000);

// ── replyIsEnglish ──
t('replyIsEnglish: EN', replyIsEnglish('The site and the team can help you with more of this.'));
t('replyIsEnglish: FR', !replyIsEnglish('Le site et la page vous aident avec une réponse pour nous.'));

// ── Publications sociales : ajout déterministe quand un article est cité ──
$r = nsy_sanitize_reply("Voir notre [article](seo-geo-etre-cite-par-les-ia.html) sur le sujet et voilà.");
t('article cité sans socials → LinkedIn Pulse ajouté', str_contains($r, 'linkedin.com/pulse/seo-vs-geo'));
t('article cité sans socials → Facebook ajouté', str_contains($r, 'facebook.com/share/17vyLQjakE'));
$r = nsy_sanitize_reply("Voir [article](seo-geo-etre-cite-par-les-ia.html) et [LinkedIn](https://www.linkedin.com/pulse/seo-vs-geo-votre-site-est-bien-class%C3%A9-sur-google-0znee) et voilà.");
t('socials déjà présents → pas de doublon', substr_count($r, 'linkedin.com/pulse/') === 1);
$r = nsy_sanitize_reply("Read the [article](seo-geo-getting-cited-by-ai.html) about this and more of the topic here.");
t('réponse EN → pas d\'ajout (publications FR)', !str_contains($r, 'facebook.com'));
$r = nsy_sanitize_reply('Bonjour, la page [Contact](contact.html) et voilà.');
t('pas d\'article cité → rien d\'ajouté', !str_contains($r, 'facebook.com'));

$r = nsy_sanitize_reply("Voir notre [article](chatbot-ia-forum-base-de-connaissances.html) sur le sujet et voilà.");
t('article 2 cité sans socials → LinkedIn + Facebook ajoutés',
  str_contains($r, 'linkedin.com/pulse/votre-forum') && str_contains($r, 'facebook.com/share/p/1Ey4FXBYDA'));

// ── Formulations bannies (positionnement ESN) → réécrites côté serveur ──
t('« sans intermédiaire » → « en prise directe »',
  nsy_sanitize_reply('Un modèle sans intermédiaire.') === 'Un modèle en prise directe.');
t("« pas d'intermédiaire » (apostrophe droite) → « un seul interlocuteur »",
  str_contains(nsy_sanitize_reply("Pas de junior, pas d'intermédiaire — top."), 'un seul interlocuteur'));
t('« pas d’intermédiaire » (apostrophe typographique) réécrit',
  str_contains(nsy_sanitize_reply('Pas de junior, pas d’intermédiaire — top.'), 'un seul interlocuteur'));
t('« sans pyramide » → « en prise directe »',
  str_contains(nsy_sanitize_reply('Le modèle sans pyramide de NSY.'), 'en prise directe'));
t('« sans surcouche commerciale » → « en prise directe »',
  str_contains(nsy_sanitize_reply('Une mission sans surcouche commerciale.'), 'en prise directe'));
t('« no middleman » → « a single point of contact »',
  str_contains(nsy_sanitize_reply('Great: no middleman involved here.'), 'a single point of contact'));
t('« no pyramid » → « direct accountability »',
  str_contains(nsy_sanitize_reply('The no pyramid model works.'), 'direct accountability'));
t('texte sain intact',
  nsy_sanitize_reply('Un interlocuteur unique senior et voilà.') === 'Un interlocuteur unique senior et voilà.');

echo $fail === 0 ? "CHAT-SANITIZE : TOUS LES TESTS PASSENT\n" : "CHAT-SANITIZE : $fail ÉCHEC(S)\n";
exit($fail === 0 ? 0 : 1);
