<?php
/**
 * stats/newsletter.php — les abonnés de la newsletter du journal, pour l'onglet
 * « Newsletter » du tableau de bord (owner, 22/09/2026 : « le nombre d'inscrits
 * et les adresses mails recensées »).
 *
 * Ce dossier est sous Basic Auth (stats/.htaccess) : seul l'owner y entre.
 *
 *   GET → { ok, comptes, abonnes[] }
 *         comptes  = ceux de l'envoi (nl_comptes) : inscrits par langue, en attente, désinscrits ;
 *         abonnes  = adresse, langue, état et dates de chaque fiche — confirmés d'abord.
 *
 * LECTURE SEULE. newsletter.php est le seul à écrire _secret/newsletter.json (sous
 * verrou, puis renommage atomique) : on lit donc toujours un fichier entier, sans
 * verrou. Les fonctions viennent de newsletter.php en mode bibliothèque
 * (NL_BIBLIOTHEQUE) : mêmes règles que l'envoi, dont l'oubli des inscriptions
 * restées en attente plus de NL_ATTENTE_JOURS jours.
 *
 * ⛔ Le JETON d'une fiche ne sort JAMAIS d'ici : il vaut signature (il confirme une
 * inscription ou désinscrit l'abonné). Seuls les champs listés dans
 * nl_tableau_de_bord() partent vers le navigateur.
 *
 * ⛔ Règle du 30/08/2026 : gabarit compteur-d'erreurs en tête.
 */
declare(strict_types=1);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);   // les dépréciations ne vont JAMAIS au journal (09/09/2026)
$prvErreurs = 0;
set_error_handler(static function (int $no, string $msg, string $fichier, int $ligne) use (&$prvErreurs): bool {
    if (!(error_reporting() & $no)) {
        return true;
    }
    if (++$prvErreurs <= 5) {
        error_log("stats/newsletter.php: [$no] $msg @ $fichier:$ligne");
    }
    if ($prvErreurs > 10) {
        http_response_code(500);
        die(json_encode(['ok' => false, 'erreur' => 'stoppé : trop d\'erreurs PHP']));
    }
    return true;
}, E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

defined('NL_BIBLIOTHEQUE') || define('NL_BIBLIOTHEQUE', true);
require_once dirname(__DIR__) . '/newsletter.php';

/** Les fiches telles que l'onglet les montre — jamais le jeton. Confirmés, puis en attente,
 *  puis désinscrits ; dans chaque groupe, la plus récente en tête. */
function nl_tableau_de_bord(array $abonnes, int $maintenant): array
{
    $ordre = ['confirme' => 0, 'attente' => 1, 'desinscrit' => 2];
    $liste = [];
    foreach (nl_purger($abonnes, $maintenant) as $a) {
        $etat = (string) ($a['etat'] ?? '');
        if (!isset($ordre[$etat])) {
            continue;
        }
        $liste[] = [
            'email'      => (string) ($a['email'] ?? ''),
            'langue'     => nl_langue($a['langue'] ?? null),
            'etat'       => $etat,
            'inscrit'    => is_string($a['inscrit'] ?? null) ? $a['inscrit'] : null,
            'confirme'   => is_string($a['confirme'] ?? null) ? $a['confirme'] : null,
            'desinscrit' => is_string($a['desinscrit'] ?? null) ? $a['desinscrit'] : null,
        ];
    }
    $date = static fn(array $f): string => (string) ($f['confirme'] ?? $f['desinscrit'] ?? $f['inscrit'] ?? '');
    usort($liste, static fn(array $x, array $y): int
        => [$ordre[$x['etat']], $date($y)] <=> [$ordre[$y['etat']], $date($x)]);
    return ['comptes' => nl_comptes($abonnes, $maintenant), 'abonnes' => $liste];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'erreur' => 'lecture seule']);
    return;
}
$abonnes = nl_charger(NL_STOCK);
if ($abonnes === null) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'erreur' => 'newsletter.json illisible — la liste n\'a pas été modifiée'], JSON_UNESCAPED_UNICODE);
    return;
}
echo json_encode(['ok' => true] + nl_tableau_de_bord($abonnes, time()), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
