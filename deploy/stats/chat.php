<?php
/**
 * stats/chat.php — agent conversationnel du tableau de bord KPI.
 *
 * ⚠️ À NE PAS CONFONDRE avec le /chat.php de la racine : celui-là est PUBLIC et
 * ancré sur llms-full.txt (le site parle aux visiteurs). Celui-ci est PRIVÉ,
 * ancré sur les données de fréquentation, et ne doit jamais être exposé.
 * Sa protection est celle du dossier (stats/.htaccess, Basic Auth) — même
 * mécanisme que data.php, qui sert déjà tout l'historique.
 *
 * Principe de conception, le seul qui compte ici : le modèle NE CALCULE RIEN.
 * Le dashboard lui transmet un dossier de faits déjà établis (totaux, pics
 * détectés, calendrier des événements) et le modèle se contente de rédiger.
 * C'est ce qui l'empêche d'inventer une corrélation — un modèle à qui l'on
 * donne des courbes brutes trouve TOUJOURS une explication, fût-elle fausse.
 *
 * ⚠️ Ce que ça implique : les chiffres d'audience du site partent chez le
 * fournisseur du modèle à chaque question. Rien de nominatif (l'historique est
 * agrégé), mais ce sont des données d'entreprise — arbitrage assumé par le owner.
 */
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function repond(array $d, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    repond(['ok' => false, 'error' => 'POST attendu'], 405);
}

$ai = @include dirname(__DIR__) . '/_secret/ai.php';
$apiKey = (string) (is_array($ai) ? ($ai['api_key'] ?? '') : '');
if ($apiKey === '' || str_starts_with($apiKey, 'CHANGE_ME')) {
    repond(['ok' => false, 'error' => "Aucune clé de modèle configurée dans _secret/ai.php."], 503);
}
$apiUrl = (string) ($ai['api_url'] ?? '') ?: 'https://api.mistral.ai/v1/chat/completions';
$model  = (string) ($ai['model'] ?? '') ?: 'mistral-small-latest';

$in = json_decode((string) file_get_contents('php://input'), true);
$question = trim((string) ($in['question'] ?? ''));
$dossier = $in['dossier'] ?? null;
if ($question === '' || mb_strlen($question) > 500 || !is_array($dossier)) {
    repond(['ok' => false, 'error' => 'Requête invalide.'], 400);
}

// Le dossier est produit par le dashboard : on le borne quand même, un
// historique très long ne doit pas faire exploser le contexte ni la facture.
$faits = json_encode($dossier, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (strlen($faits) > 24000) {
    repond(['ok' => false, 'error' => 'Période trop large pour une analyse — réduisez-la.'], 413);
}

// Historique de la conversation (le fil, pas la mémoire longue).
$messages = [];
foreach ((array) ($in['historique'] ?? []) as $m) {
    $role = ($m['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
    $txt = trim((string) ($m['content'] ?? ''));
    if ($txt !== '') $messages[] = ['role' => $role, 'content' => mb_substr($txt, 0, 1500)];
}
$messages = array_slice($messages, -6);
$messages[] = ['role' => 'user', 'content' => $question];

$system = <<<PROMPT
Tu es l'analyste du tableau de bord de fréquentation d'un site web. Tu t'adresses
au propriétaire du site, seul lecteur de cette page. Réponds en français, au
tutoiement jamais — vouvoiement — et sans jargon inutile.

RÈGLE ABSOLUE : tu ne disposes QUE du dossier de faits ci-dessous. Il a été
calculé par le tableau de bord, il est exact. Tu n'as le droit d'affirmer aucun
chiffre qui n'y figure pas, et tu ne calcules rien toi-même : si une donnée
manque, dis simplement qu'elle n'est pas mesurée. Ne propose jamais d'outil,
de service ou de site extérieur.

ATTRIBUTION DES PICS — le point le plus important :
- le dossier contient un calendrier d'événements (articles publiés, publications
  sociales, vidéos, actions techniques sur le site) et une liste de pics détectés
  avec les événements qui les précèdent ;
- une proximité de dates est une COÏNCIDENCE À SIGNALER, jamais une preuve.
  Écris « coïncide avec », « survient deux jours après », « pourrait s'expliquer
  par » — jamais « à cause de » ni « grâce à » ;
- si un pic n'a aucun événement proche, dis-le franchement : c'est une
  information utile, pas un échec. N'invente pas de cause plausible ;
- distingue les deux publics : les LECTURES DE ROBOTS IA (des machines qui
  indexent, sensibles aux actions techniques de référencement) et les VISITES
  HUMAINES (sensibles aux publications et aux réseaux). Ne les confonds jamais.

FORME : va droit au fait. Deux à cinq phrases pour une question simple. Pas de
liste à puces sauf si l'on te demande une énumération. Pas de formule de
politesse d'ouverture ni de conclusion creuse.

DOSSIER DE FAITS (JSON) :
{$faits}
PROMPT;

function appelle(string $url, string $key, array $payload): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 6,
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    return [$code, is_string($res) ? $res : ''];
}

// Même cascade que le chatbot public : le palier gratuit a un pool de capacité
// PAR modèle, un 429 sur le principal n'annonce pas une panne générale.
$modeles = array_values(array_unique(array_merge([$model],
    (array) ($ai['fallback_models'] ?? ['ministral-8b-latest', 'open-mistral-nemo']))));
$code = 0;
$res = '';
foreach ($modeles as $i => $m) {
    [$code, $res] = appelle($apiUrl, $apiKey, [
        'model' => $m,
        'messages' => array_merge([['role' => 'system', 'content' => $system]], $messages),
        'temperature' => 0.2,     // analyse : on veut de la sobriété, pas du style
        'max_tokens' => 600,
    ]);
    if ($code === 429 && $i === count($modeles) - 1) {
        usleep(1200000);
        [$code, $res] = appelle($apiUrl, $apiKey, [
            'model' => $m,
            'messages' => array_merge([['role' => 'system', 'content' => $system]], $messages),
            'temperature' => 0.2, 'max_tokens' => 600,
        ]);
    }
    if ($code !== 429) break;
}

if ($code < 200 || $code >= 300) {
    // Diagnostic du FOURNISSEUR uniquement — jamais le contenu des échanges.
    @file_put_contents(dirname(__DIR__) . '/_secret/stats-chat-errors.log',
        date('c') . ' HTTP ' . $code . ' — ' . substr(preg_replace('/\s+/', ' ', $res), 0, 300) . "\n",
        FILE_APPEND);
    repond(['ok' => false, 'error' => 'Le modèle est indisponible pour le moment.'], 502);
}

$j = json_decode($res, true);
$reply = trim((string) ($j['choices'][0]['message']['content'] ?? ''));
if ($reply === '') repond(['ok' => false, 'error' => 'Réponse vide du modèle.'], 502);
repond(['ok' => true, 'reply' => $reply]);
