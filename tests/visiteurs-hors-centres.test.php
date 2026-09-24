<?php
/**
 * Banc du compteur « visiteurs hors centres de données » — hors ligne.
 *
 *   docker run --rm -v "$PWD":/app -w /app php:8.5-cli-alpine php tests/visiteurs-hors-centres.test.php
 *
 * Né du 23/09/2026 sur prv-concept.com (même collecteur, même piège) : 15 458 requêtes d'une seule plage d'hébergeur (47.79.0.0/16),
 * référent « google.com » FABRIQUÉ (Search Console comptait 28 clics le même jour),
 * ont fait passer « visiteurs » de ~150 à 1 963. Ces robots portent un user-agent de
 * navigateur : le filtre à robots ne les voit pas. Le RÉSEAU, lui, les trahit.
 *
 * Ce banc rejoue la logique de stats-collector.php telle qu'elle est écrite — il
 * EXTRAIT la liste de marqueurs du fichier réel, pour qu'un marqueur ajouté là-bas
 * soit éprouvé ici. Il verrouille les deux sens :
 *   1. un hébergeur est écarté, et le compte se fait sur l'EMPREINTE du visiteur
 *      (ip|ua), pas sur l'IP : une même IP à deux user-agents fait deux visiteurs ;
 *   2. ⚠️ AUCUN fournisseur d'accès grand public n'y tombe — Orange, Free, SFR,
 *      Bouygues, Proximus, Swisscom : les écarter serait pire que le mal.
 */
declare(strict_types=1);
error_reporting(E_ALL);
set_error_handler(static function (int $no, string $msg, string $f, int $l): bool {
    fwrite(STDERR, "  ⚠️  PHP [$no] $msg @ $f:$l\n"); exit(2);
});

$src = file_get_contents(dirname(__DIR__) . '/stats-collector.php');
if (!preg_match('/\$marqueurs = (\[.*?\]);/s', $src, $m)) {
    fwrite(STDERR, "  ❌ liste \$marqueurs introuvable dans stats-collector.php\n"); exit(2);
}
eval('$marqueurs = ' . $m[1] . ';');

$ok = 0; $ko = 0;
$verif = static function (string $nom, bool $cond, string $detail = '') use (&$ok, &$ko): void {
    if ($cond) { $ok++; return; }
    $ko++; echo "  ❌ $nom" . ($detail !== '' ? " — $detail" : '') . "\n";
};
/** La décision du collecteur, à l'identique. */
$estCentre = static function (string $nomAs) use ($marqueurs): bool {
    $n = mb_strtolower($nomAs);
    foreach ($marqueurs as $mk) { if ($nomAs !== '' && str_contains($n, $mk)) { return true; } }
    return false;
};

echo "1. Les hébergeurs et anonymiseurs sont reconnus\n";
foreach ([
    'Alibaba Cloud LLC', 'Alibaba (US) Technology Co., Ltd.', 'AMAZON-02', 'Amazon Data Services',
    'GOOGLE-CLOUD-PLATFORM', 'Google LLC', 'MICROSOFT-CORP-MSN-AS-BLOCK', 'OVH SAS',
    'Hetzner Online GmbH', 'DigitalOcean, LLC', 'Contabo GmbH', 'M247 Europe SRL',
    'Tencent Cloud Computing', 'HUAWEI CLOUDS', 'Oracle Corporation', 'Linode, LLC',
    'Scaleway S.a.s.', 'IP Volume inc', 'Stark Industries Solutions', 'Cloudflare, Inc.',
] as $as) {
    $verif("écarté : $as", $estCentre($as));
}

echo "2. ⚠️ Les fournisseurs d'accès grand public ne tombent JAMAIS dedans\n";
foreach ([
    'Orange', 'Free SAS', 'SFR SA', 'Bouygues Telecom SA', 'Proximus NV', 'Swisscom (Schweiz) AG',
    'Telecom Italia', 'Deutsche Telekom AG', 'Vodafone Ltd', 'British Telecommunications',
    'Orange Polska Spolka Akcyjna', 'Free Mobile SAS',
] as $as) {
    $verif("gardé : $as", !$estCentre($as), 'un vrai visiteur serait effacé');
}

echo "3. Le compte porte sur l'EMPREINTE du visiteur, pas sur l'IP\n";
/* Reproduit la boucle du collecteur : $vh_ip (empreinte => IP) et $estDc (IP => bool). */
$compte = static function (array $vhIp, array $asParIp) use ($estCentre): int {
    $estDc = [];
    foreach (array_unique(array_values($vhIp)) as $ip) { $estDc[$ip] = $estCentre($asParIp[$ip] ?? ''); }
    $n = 0;
    foreach ($vhIp as $ip) { if (empty($estDc[$ip])) { $n++; } }
    return $n;
};
$asParIp = [
    '47.79.1.1' => 'Alibaba Cloud LLC',
    '47.79.2.2' => 'Alibaba Cloud LLC',
    '88.182.1.1' => 'Free SAS',
    '92.184.1.1' => 'Orange',
    '10.0.0.1' => '',                 // réseau inconnu du fichier ASN
];
$verif('3 lecteurs réels sur 5 empreintes, 2 chez un hébergeur',
    $compte(['a' => '47.79.1.1', 'b' => '47.79.2.2', 'c' => '88.182.1.1',
             'd' => '92.184.1.1', 'e' => '10.0.0.1'], $asParIp) === 3);
$verif('une même IP à DEUX user-agents compte DEUX visiteurs',
    $compte(['a' => '88.182.1.1', 'b' => '88.182.1.1'], $asParIp) === 2,
    'le compte doit suivre l\'empreinte ip|ua, comme « visiteurs »');
$verif('un réseau INCONNU est gardé (on n\'efface pas ce qu\'on ne sait pas)',
    $compte(['a' => '10.0.0.1'], $asParIp) === 1);
$verif('la journée du 23/09 reconstituée : 2 lecteurs, pas 1 002',
    $compte(array_merge(
        array_combine(array_map(static fn($i) => "bot$i", range(1, 1000)),
                      array_fill(0, 1000, '47.79.1.1')),
        ['h1' => '88.182.1.1', 'h2' => '92.184.1.1']), $asParIp) === 2);

echo "4. Le collecteur porte bien le nouveau champ\n";
$verif('$stats[\'vh_ip\'] est initialisé', str_contains($src, "'vh_ip' => []"));
$verif('l\'empreinte est enregistrée sous le MÊME plafond que les IP',
    (bool) preg_match('/count\(\$stats\[\'ips\'\]\) < 60000\)\s*\{.*?\$stats\[\'vh_ip\'\]\[\$vh\] = \$ip;/s', $src),
    'sans le plafond, une journée anormale ferait exploser la mémoire');
$verif('visiteurs_hors_centres est exposé', str_contains($src, "\$pays['visiteurs_hors_centres'] = \$visHc;"));
$verif('« visiteurs » n\'est PAS réécrit — l\'historique reste comparable',
    !preg_match('/\$day\[\'visiteurs\'\]\s*=\s*\$visHc/', $src));

echo ($ko ? "❌" : "✅") . " visiteurs-hors-centres : $ok OK, $ko KO\n";
exit($ko ? 1 : 0);
