<?php
/**
 * Banc hors ligne — collaborations YouTube du collecteur (stats-collector.php, 23/10/2026).
 * Une vidéo publiée par une AUTRE chaîne qui nous invite comme collaborateur s'affiche sur nos
 * onglets publics sans être dans nos envois (l'API Data n'a aucun champ « collaborateurs ») :
 * ytCollabIds() lit l'étagère « Collaborations » de la page Accueil (24/10/2026), ytCollabGarde() ne garde que les vidéos d'une autre chaîne.
 * Une page qui n'est pas celle de la chaîne (consentement, refus) est ILLISIBLE, jamais « aucune ».
 *
 *   docker run --rm -v "$PWD":/app -w /app php:8.5-cli-alpine php tests/stats-youtube-collab.test.php
 */
declare(strict_types=1);
error_reporting(E_ALL);
set_error_handler(static function (int $no, string $msg, string $f, int $l): bool { fwrite(STDERR, "⚠️ PHP [$no] $msg @ $f:$l\n"); exit(2); });
$src = (string) file_get_contents(dirname(__DIR__) . '/stats-collector.php');
foreach (['ytCollabIds', 'ytCollabGarde'] as $f) {
    if (!preg_match('/^function ' . $f . '\(.*?^}\n/ms', $src, $m)) { fwrite(STDERR, "$f introuvable\n"); exit(2); }
    eval($m[0]);
}
$ko = 0;
function t(string $nom, bool $ok, $info = null): void { global $ko; echo ($ok ? '  ✓ ' : '  ✗ ÉCHEC ') . $nom . ($ok || $info === null ? '' : ' — ' . json_encode($info, JSON_UNESCAPED_UNICODE)) . "\n"; if (!$ok) { $ko++; } }

$nous = 'UCWiOufpZiUdXj1m-28mp1FQ';   // @new-software-yard
$etagere = static fn (string $titre, array $ids): array => ['richItemRenderer' => ['content' => ['richShelfRenderer' => [
    'title' => ['runs' => [['text' => $titre]]], 'contents' => array_map(static fn (string $i): array => ['videoId' => $i], $ids)]]]];
$accueil = static fn (array $etageres, string $chaine): string => '<html><script>var ytInitialData = '
    . json_encode(['metadata' => ['channelMetadataRenderer' => ['externalId' => $chaine]],
                   'contents' => ['tabs' => [['tabRenderer' => ['title' => 'Accueil', 'selected' => true, 'content' => $etageres]]]]])
    . ';</script><script>var autre = 1;</script></html>';
$page = $accueil([$etagere('Vidéos', ['AAAAAAAAAAA', 'BBBBBBBBBBB']), $etagere('Collaborations', ['Cc-_123abcd', 'DDDDDDDDDDD', 'Cc-_123abcd']),
                  ['shelfRenderer' => ['title' => ['simpleText' => 'Chaînes en vedette'], 'content' => ['videoId' => 'EEEEEEEEEEE']]]], $nous);

echo "Lecture de la page Accueil\n";
t('seule l\'étagère « Collaborations » est lue, sans doublon', ytCollabIds($page, $nous) === ['Cc-_123abcd', 'DDDDDDDDDDD'], ytCollabIds($page, $nous));
t('titre en simpleText ou en runs, casse indifférente', ytCollabIds($accueil([['shelfRenderer' => ['title' => ['simpleText' => 'COLLABORATIONS'], 'x' => ['videoId' => 'FFFFFFFFFFF']]]], $nous), $nous) === ['FFFFFFFFFFF']);
t('sans étagère Collaborations : aucune, pas illisible', ytCollabIds($accueil([$etagere('Vidéos', ['AAAAAAAAAAA'])], $nous), $nous) === []);
t('page de consentement (sans l\'identifiant de la chaîne) : illisible', ytCollabIds('<form action="https://consent.youtube.com/save">"videoId":"AAAAAAAAAAA"', $nous) === null);
t('page d\'une AUTRE chaîne : illisible', ytCollabIds($page, 'UCxxxxxxxxxxxxxxxxxxxxxx') === null);
t('réponse vide (délai, refus) : illisible', ytCollabIds('', $nous) === null);
t('identifiant de chaîne inconnu : illisible', ytCollabIds($page, '') === null);
t('données de page tronquées : illisible', ytCollabIds('"' . $nous . '" var ytInitialData = {"contents":[;</script>', $nous) === null);

echo "Tri des collaborations\n";
$v = static fn (string $id, string $chaine, string $nom, string $date, int $vues = 10): array => ['id' => $id,
    'snippet' => ['channelId' => $chaine, 'channelTitle' => $nom, 'title' => "Vidéo $id", 'publishedAt' => $date . 'T10:00:00Z'],
    'statistics' => ['viewCount' => (string) $vues, 'likeCount' => '2']];
$items = [$v('AAAAAAAAAAA', $nous, 'NSY', '2026-10-01'),
          $v('BBBBBBBBBBB', 'UCcamper0000000000000000', 'Camper car services', '2026-10-20', 321),
          $v('Cc-_123abcd', 'UCcamper0000000000000000', 'Camper car services', '2026-10-22', 45),
          ['id' => 'DDDDDDDDDDD', 'snippet' => []]];
$g = ytCollabGarde($items, $nous);
t('nos propres vidéos sont écartées (elles sont déjà dans les envois)', !in_array('AAAAAAAAAAA', array_column($g, 'id'), true), $g);
t('une vidéo sans chaîne connue est écartée', !in_array('DDDDDDDDDDD', array_column($g, 'id'), true), $g);
t('les collaborations, la plus récente d\'abord', array_column($g, 'id') === ['Cc-_123abcd', 'BBBBBBBBBBB'], $g);
t('la chaîne qui publie est nommée', ($g[1]['chaine'] ?? '') === 'Camper car services', $g);
t('vues, j\'aime, commentaires (absents = 0), date, lien',
  ($g[1]['vues'] ?? null) === 321 && ($g[1]['likes'] ?? null) === 2 && ($g[1]['commentaires'] ?? null) === 0
  && ($g[1]['date'] ?? '') === '2026-10-20' && ($g[1]['url'] ?? '') === 'https://www.youtube.com/watch?v=BBBBBBBBBBB', $g);
t('rien à garder : liste vide', ytCollabGarde([], $nous) === [] && ytCollabGarde([$items[0]], $nous) === []);

echo "Le collecteur\n";
t('mode lecture seule ?seul=youtube, AVANT la garde run=1',
  ($p = strpos($src, "=== 'youtube'")) !== false && $p < strpos($src, "if ((\$_GET['run'] ?? '') !== '1')"));
t('jamais de rattrapage : la chaîne n\'est relue que pour une date récente', str_contains($src, '$youtube = $ytRecent ? collecteYoutube($cfg) : null;'));
t('l\'état de la lecture est historisé', str_contains($src, "\$youtube['collab_lecture'] = \$vus === null ? 'accueil illisible' : 'ok';"));
t('c\'est la page ACCUEIL qui est lue (l\'étagère Collaborations n\'est pas dans l\'onglet Vidéos)', str_contains($src, "rawurlencode(\$youtube['id']) . '/featured'"));

echo "Autres chaînes suivies\n";
t('une fonction par chaîne, appelée pour la chaîne du site ET pour chaque autre', substr_count($src, 'ytChaine($ytGet, ') === 2);
t('les autres chaînes vont dans youtube.autres, jamais dans les totaux', str_contains($src, "\$youtube['autres'][] = \$autre;"));
t('jamais la chaîne du site en double', str_contains($src, "\$id !== \$youtube['id']"));

echo $ko ? "❌ $ko échec(s)\n" : "✅ stats-youtube-collab : tout passe\n";
exit($ko ? 1 : 0);
