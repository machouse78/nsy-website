<?php
/**
 * NSY — Contact form handler.
 *
 * Receives POST from index.html#contact form, validates, then sends the
 * email via Infomaniak SMTP (authenticated) using PHPMailer.
 *
 * Credentials are kept out of git in _secret/config.php (gitignored)
 * and out of public reach by the _secret/.htaccess Deny rule.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ───── Only POST allowed ─────
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

// ───── Honeypot anti-bot (silent success if filled) ─────
if (!empty($_POST['website'] ?? '')) {
    echo json_encode(['ok' => true]);
    exit;
}

// ───── Load SMTP credentials ─────
$configPath = __DIR__ . '/_secret/config.php';
if (!file_exists($configPath)) {
    error_log('NSY contact: missing _secret/config.php');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Configuration serveur manquante. Écrivez-nous à contact@nsy.fr.']);
    exit;
}
$config = require $configPath;

// ───── Field extraction & validation ─────
$name    = trim((string)($_POST['name']    ?? ''));
$email   = trim((string)($_POST['email']   ?? ''));
$company = trim((string)($_POST['company'] ?? ''));
$phone   = trim((string)($_POST['phone']   ?? ''));
$service = trim((string)($_POST['service'] ?? ''));
$timing  = trim((string)($_POST['timing']  ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

$errors = [];
if (mb_strlen($name) < 2 || mb_strlen($name) > 100)        $errors[] = 'Nom invalide';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errors[] = 'Email invalide';
if (mb_strlen($message) < 10 || mb_strlen($message) > 5000) $errors[] = 'Message trop court ou trop long';
if (mb_strlen($company) > 200)                              $errors[] = 'Société trop longue';
if (mb_strlen($phone)   > 50)                               $errors[] = 'Téléphone trop long';

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => implode(' · ', $errors)]);
    exit;
}

// ───── Rate limiting (1 send / IP / 60s via temp file) ─────
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/nsy_rate_' . md5($ip);
if (file_exists($rateFile) && (time() - filemtime($rateFile)) < 60) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Trop de demandes — patientez 1 minute avant de réessayer.']);
    exit;
}
@touch($rateFile);

// ───── Map IDs → libellés humains ─────
$serviceMap = [
    'consulting' => 'Conseil technique',
    'web-ai'     => 'Création web · IA',
];
$timingMap = [
    'now'    => 'Dès maintenant',
    'q3'     => 'Sous 1 à 2 mois',
    'q4'     => 'Sous 3 à 6 mois',
    'future' => 'Pas urgent — exploration',
];
$serviceLabel = $serviceMap[$service] ?? $service;
$timingLabel  = $timingMap[$timing]   ?? $timing;

// ───── Build email body ─────
$subject = '[NSY Contact] ' . $serviceLabel . ' — ' . $name;

$esc = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

$bodyHtml = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:640px;margin:auto;padding:24px;background:#f5f7fb">'
    . '<div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">'
    . '<h2 style="margin:0 0 24px;color:#0A0F1C;font-size:20px">Nouvelle demande via le formulaire NSY</h2>'
    . '<table style="border-collapse:collapse;width:100%;font-size:14px">'
    .   '<tr><td style="padding:8px 0;color:#555;width:130px">Nom</td><td style="padding:8px 0;color:#0A0F1C"><strong>' . $esc($name) . '</strong></td></tr>'
    .   '<tr><td style="padding:8px 0;color:#555">Email</td><td style="padding:8px 0"><a href="mailto:' . $esc($email) . '" style="color:#00B8D4">' . $esc($email) . '</a></td></tr>'
    .   ($company ? '<tr><td style="padding:8px 0;color:#555">Société</td><td style="padding:8px 0;color:#0A0F1C">' . $esc($company) . '</td></tr>' : '')
    .   ($phone   ? '<tr><td style="padding:8px 0;color:#555">Téléphone</td><td style="padding:8px 0;color:#0A0F1C">' . $esc($phone) . '</td></tr>' : '')
    .   '<tr><td style="padding:8px 0;color:#555">Service</td><td style="padding:8px 0;color:#0A0F1C">' . $esc($serviceLabel) . '</td></tr>'
    .   '<tr><td style="padding:8px 0;color:#555">Horizon</td><td style="padding:8px 0;color:#0A0F1C">' . $esc($timingLabel) . '</td></tr>'
    . '</table>'
    . '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e9f0">'
    . '<div style="white-space:pre-wrap;line-height:1.6;color:#0A0F1C;font-size:14px">' . $esc($message) . '</div>'
    . '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e9f0">'
    . '<p style="margin:0;color:#888;font-size:11px;font-family:monospace">Envoyé depuis nsy.fr · IP ' . $esc($ip) . ' · ' . date('Y-m-d H:i:s') . '</p>'
    . '</div></div>';

$bodyText = "Nouvelle demande via le formulaire NSY\n\n"
    . "Nom: $name\n"
    . "Email: $email\n"
    . ($company ? "Société: $company\n" : '')
    . ($phone   ? "Téléphone: $phone\n" : '')
    . "Service: $serviceLabel\n"
    . "Horizon: $timingLabel\n\n"
    . "Message:\n$message\n\n"
    . "---\nEnvoyé depuis nsy.fr · IP $ip · " . date('Y-m-d H:i:s') . "\n";

// ───── Send via PHPMailer + SMTP ─────
require_once __DIR__ . '/vendor/PHPMailer/src/Exception.php';
require_once __DIR__ . '/vendor/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/vendor/PHPMailer/src/SMTP.php';

$mail = new \PHPMailer\PHPMailer\PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = $config['smtp_host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['smtp_username'];
    $mail->Password   = $config['smtp_password'];
    $mail->SMTPSecure = $config['smtp_secure']; // 'ssl' (465) or 'tls' (587)
    $mail->Port       = (int)$config['smtp_port'];
    $mail->CharSet    = 'UTF-8';
    $mail->Timeout    = 15;

    $mail->setFrom($config['smtp_username'], 'Formulaire NSY');
    $mail->addAddress($config['to_address'], $config['to_name'] ?? 'NSY');
    $mail->addReplyTo($email, $name);

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $bodyHtml;
    $mail->AltBody = $bodyText;

    $mail->send();
    echo json_encode(['ok' => true]);
} catch (\PHPMailer\PHPMailer\Exception $e) {
    $detail = $mail->ErrorInfo ?: $e->getMessage();
    $errMsg = '[' . date('Y-m-d H:i:s') . '] NSY contact: ' . $detail . "\n";
    error_log($errMsg);
    // Try writing to two locations in case _secret/ is not writable.
    @file_put_contents(__DIR__ . '/_secret/contact-errors.log', $errMsg, FILE_APPEND);
    @file_put_contents(__DIR__ . '/contact-errors.log', $errMsg, FILE_APPEND);
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => "Erreur d'envoi — réessayez ou écrivez directement à contact@nsy.fr.",
        // TEMPORARY: expose the real SMTP error for diagnostics.
        // Remove after the form is validated end-to-end.
        'debug' => $detail,
    ]);
}
