<?php
// Sert l'historique KPI au dashboard. Ce dossier est sous Basic Auth
// (stats/.htaccess) — aucune clé supplémentaire nécessaire ici.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$f = dirname(__DIR__) . '/_secret/kpi-history.json';
echo is_file($f) ? file_get_contents($f) : '{"site":"nsy.fr","days":{}}';
