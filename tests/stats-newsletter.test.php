<?php
/**
 * Test de stats/newsletter.php — l'onglet « Newsletter » du tableau de bord (22/09/2026).
 *
 * Le point d'accès est lancé dans un PHP ENFANT (il pose son propre gestionnaire d'erreurs),
 * sur une liste d'abonnés fabriquée dans un dossier temporaire : rien n'est lu ni écrit dans
 * le _secret/ du dépôt. Tout ce que l'enfant écrit sur stderr (error_log, avertissement,
 * dépréciation) fait échouer le test.
 *
 * Vérifie : le jeton ne sort JAMAIS ; les comptes sont ceux de l'envoi (attente de plus de
 * 30 jours oubliée) ; l'ordre (confirmés récents d'abord, puis attente, puis désinscrits) ;
 * un fichier cassé → ok:false sans rien réécrire ; un POST est refusé.
 * PHP 8.5 (la version du serveur) :
 *   docker run --rm -v "$PWD":/app -w /app php:8.5-cli-alpine php tests/stats-newsletter.test.php
 * Le même test existe dans prv-concept (tests/stats-newsletter-test.php).
 */
declare(strict_types=1);
error_reporting(E_ALL);
$racine = dirname(__DIR__);
$echecs = 0;
function ok(bool $c, string $m): void { global $echecs; echo ($c ? '  ✓ ' : '  ✗ ') . $m . "\n"; if (!$c) $echecs++; }

function lance(string $secret, string $methode = 'GET'): array
{
    global $racine;
    $code = 'define("NL_SECRET", ' . var_export($secret, true) . '); $_SERVER["REQUEST_METHOD"] = ' . var_export($methode, true) . ';'
          . ' require ' . var_export($racine . '/stats/newsletter.php', true) . ';';
    $p = proc_open([PHP_BINARY, '-d', 'display_errors=stderr', '-r', $code], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $tubes);
    $out = stream_get_contents($tubes[1]); $err = stream_get_contents($tubes[2]);
    fclose($tubes[1]); fclose($tubes[2]); proc_close($p);
    return [$out, $err];
}

$tmp = sys_get_temp_dir() . '/stats-newsletter-' . bin2hex(random_bytes(4));
mkdir($tmp, 0777, true);
$j = static fn(int $jours): string => date('c', time() - $jours * 86400);
$abonnes = [
    ['email' => 'ancien@exemple.fr', 'langue' => 'fr', 'etat' => 'confirme', 'jeton' => str_repeat('a', 64), 'inscrit' => $j(20), 'confirme' => $j(20), 'desinscrit' => null],
    ['email' => 'recent@exemple.fr', 'langue' => 'fr', 'etat' => 'confirme', 'jeton' => str_repeat('b', 64), 'inscrit' => $j(2), 'confirme' => $j(2), 'desinscrit' => null],
    ['email' => 'reader@example.com', 'langue' => 'en', 'etat' => 'confirme', 'jeton' => str_repeat('c', 64), 'inscrit' => $j(5), 'confirme' => $j(5), 'desinscrit' => null],
    ['email' => 'attend@exemple.fr', 'langue' => 'fr', 'etat' => 'attente', 'jeton' => str_repeat('d', 64), 'inscrit' => $j(1), 'confirme' => null, 'desinscrit' => null],
    ['email' => 'oublie@exemple.fr', 'langue' => 'fr', 'etat' => 'attente', 'jeton' => str_repeat('e', 64), 'inscrit' => $j(45), 'confirme' => null, 'desinscrit' => null],
    ['email' => 'parti@exemple.fr', 'langue' => 'fr', 'etat' => 'desinscrit', 'jeton' => str_repeat('f', 64), 'inscrit' => $j(10), 'confirme' => $j(10), 'desinscrit' => $j(3)],
];
file_put_contents("$tmp/newsletter.json", json_encode(['abonnes' => $abonnes]));

echo "Lecture de la liste\n";
[$out, $err] = lance($tmp);
$d = json_decode($out, true);
ok(is_array($d) && ($d['ok'] ?? false) === true, 'réponse JSON ok:true');
ok($err === '', 'rien sur stderr (ni error_log, ni avertissement)' . ($err !== '' ? " — $err" : ''));
ok(!str_contains($out, 'jeton') && !preg_match('/[a-f]{64}/', $out), 'aucun jeton dans la réponse');
ok(($d['comptes']['confirmes_total'] ?? null) === 3, '3 inscrits confirmés');
ok(($d['comptes']['confirmes']['fr'] ?? null) === 2 && ($d['comptes']['confirmes']['en'] ?? null) === 1, 'FR 2 · EN 1');
ok(($d['comptes']['attente'] ?? null) === 1, '1 en attente (celle de 45 jours est oubliée, comme à l\'envoi)');
ok(($d['comptes']['desinscrits'] ?? null) === 1, '1 désinscrit');
$ordre = array_column($d['abonnes'] ?? [], 'email');
ok($ordre === ['recent@exemple.fr', 'reader@example.com', 'ancien@exemple.fr', 'attend@exemple.fr', 'parti@exemple.fr'],
   'ordre : confirmés du plus récent au plus ancien, puis attente, puis désinscrits');
ok(array_keys($d['abonnes'][0] ?? []) === ['email', 'langue', 'etat', 'inscrit', 'confirme', 'desinscrit'], 'champs envoyés : exactement ceux prévus');

echo "Fichier cassé\n";
file_put_contents("$tmp/newsletter.json", '{"abonnes": [');
$avant = file_get_contents("$tmp/newsletter.json");
[$out, $err] = lance($tmp);
$d = json_decode($out, true);
ok(($d['ok'] ?? null) === false, 'ok:false');
ok(file_get_contents("$tmp/newsletter.json") === $avant, 'le fichier n\'est pas touché');
ok($err === '', 'rien sur stderr');

echo "Écriture refusée\n";
[$out, $err] = lance($tmp, 'POST');
ok((json_decode($out, true)['ok'] ?? null) === false, 'POST refusé (lecture seule)');

echo "Liste absente\n";
unlink("$tmp/newsletter.json");
[$out, $err] = lance($tmp);
$d = json_decode($out, true);
ok(($d['ok'] ?? null) === true && ($d['abonnes'] ?? null) === [] && ($d['comptes']['confirmes_total'] ?? null) === 0, 'aucun abonné : liste vide, comptes à zéro');

array_map('unlink', glob("$tmp/*") ?: []); @rmdir($tmp);
echo $echecs ? "\n✗ $echecs échec(s)\n" : "\n✓ tout passe\n";
exit($echecs ? 1 : 0);
