<?php
/**
 * NSY — Project feasibility questionnaire handler.
 *
 * Receives POST from faisabilite.html / feasibility.html, validates,
 * verifies Cloudflare Turnstile, then emails the structured answers via
 * Infomaniak SMTP (PHPMailer). Same security + email styling as contact.php.
 *
 * The questionnaire answers arrive as a JSON `payload` built client-side
 * from the form labels (single source of truth), so this handler stays
 * generic: it never needs to know the individual questions.
 *
 * Credentials live in _secret/config.php (gitignored).
 */

declare(strict_types=1);

// PHP 8.x hardening (host moved from 7.4 to 8.5): keep any deprecation /
// warning noise — e.g. from the bundled PHPMailer — OUT of the JSON response
// body, otherwise the browser can't parse the reply and the form shows a false
// "send error" even though the email was sent. Real errors still go to the log.
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
ini_set('display_errors', '0');
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ───── Only POST allowed ─────
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Méthode non autorisée / Method not allowed']);
    exit;
}

// ───── Visitor language (hidden field) — drives messages + auto-responder ─────
$lang = (($_POST['lang'] ?? 'fr') === 'en') ? 'en' : 'fr';
$L = static fn(string $fr, string $en): string => $lang === 'en' ? $en : $fr;

// ───── Honeypot anti-bot (silent success if filled) ─────
if (!empty($_POST['website'] ?? '')) {
    echo json_encode(['ok' => true]);
    exit;
}

// ───── Load SMTP & Turnstile credentials ─────
$configPath = __DIR__ . '/_secret/config.php';
if (!file_exists($configPath)) {
    error_log('NSY faisabilité: missing _secret/config.php');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $L('Erreur de configuration serveur — veuillez réessayer.', 'Server configuration error — please try again.')]);
    exit;
}
$config = require $configPath;

// ───── Cloudflare Turnstile anti-bot verification ─────
$turnstileToken = trim((string)($_POST['cf-turnstile-response'] ?? ''));
if (!empty($config['turnstile_secret']) && $config['turnstile_secret'] !== 'CHANGE_ME_SET_THE_TURNSTILE_SECRET_KEY') {
    if ($turnstileToken === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => $L('Vérification anti-bot manquante. Rechargez la page et réessayez.', 'Anti-bot check missing. Reload the page and try again.')]);
        exit;
    }

    $ch = curl_init('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'secret'   => $config['turnstile_secret'],
            'response' => $turnstileToken,
            'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $verifyRaw = curl_exec($ch);
    $verifyErr = curl_error($ch);
    curl_close($ch);

    $verify = is_string($verifyRaw) ? json_decode($verifyRaw, true) : null;
    if (!is_array($verify) || empty($verify['success'])) {
        error_log('NSY faisabilité: Turnstile verify failed — ' . ($verifyErr ?: json_encode($verify)));
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => $L('Vérification anti-bot échouée. Rechargez la page et réessayez.', 'Anti-bot check failed. Reload the page and try again.')]);
        exit;
    }
}

// ───── Field extraction & validation ─────
$name  = trim((string)($_POST['contact_nom']   ?? ''));
$email = trim((string)($_POST['contact_email'] ?? ''));

$errors = [];
if (mb_strlen($name) < 2 || mb_strlen($name) > 120)  $errors[] = $L('Nom invalide', 'Invalid name');
if (!filter_var($email, FILTER_VALIDATE_EMAIL))      $errors[] = $L('Email invalide', 'Invalid email');

// Decode the structured answers payload.
$payloadRaw = (string)($_POST['payload'] ?? '');
$payload = json_decode($payloadRaw, true);
if (!is_array($payload) || count($payload) === 0) {
    $errors[] = $L('Questionnaire vide ou illisible', 'Empty or unreadable questionnaire');
}
if (mb_strlen($payloadRaw) > 60000) {
    $errors[] = $L('Questionnaire trop volumineux', 'Questionnaire too large');
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => implode(' · ', $errors)]);
    exit;
}

// ───── Rate limiting (1 send / IP / 60s via temp file) ─────
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/nsy_faisa_' . md5($ip);
if (file_exists($rateFile) && (time() - filemtime($rateFile)) < 60) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => $L('Trop de demandes — patientez 1 minute avant de réessayer.', 'Too many requests — please wait a minute before trying again.')]);
    exit;
}
@touch($rateFile);

// ───── Build the admin notification email (same light-card style as contact) ─────
$esc = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

$subject = $L('[NSY Faisabilité] ', '[NSY Feasibility] ') . $name;

$rowsHtml = '';
$rowsText = '';
foreach ($payload as $block) {
    if (!is_array($block) || empty($block['items']) || !is_array($block['items'])) continue;
    $sectionTitle = $esc(trim((string)($block['section'] ?? '')));
    $rowsHtml .= '<h3 style="margin:28px 0 10px;color:#1f4e79;font-size:15px;border-bottom:2px solid #d6e4f0;padding-bottom:6px">' . $sectionTitle . '</h3>'
        . '<table style="border-collapse:collapse;width:100%;font-size:14px">';
    $rowsText .= "\n" . trim((string)($block['section'] ?? '')) . "\n";
    $lastSub = null;
    foreach ($block['items'] as $item) {
        if (!is_array($item)) continue;
        $lbl = $esc(trim((string)($item['label'] ?? '')));
        $val = trim((string)($item['value'] ?? ''));
        $sub = isset($item['sub']) ? trim((string)$item['sub']) : '';
        if ($val === '') continue;
        if ($sub !== '' && $sub !== $lastSub) {
            $rowsHtml .= '<tr><td colspan="2" style="padding:12px 0 4px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.05em">' . $esc($sub) . '</td></tr>';
            $rowsText .= "  — $sub —\n";
            $lastSub = $sub;
        }
        $valHtml = nl2br($esc($val));
        $rowsHtml .= '<tr>'
            . '<td style="padding:7px 14px 7px 0;color:#555;width:46%;vertical-align:top">' . $lbl . '</td>'
            . '<td style="padding:7px 0;color:#0A0F1C;vertical-align:top"><strong>' . $valHtml . '</strong></td>'
            . '</tr>';
        $rowsText .= "  $lbl : $val\n";
    }
    $rowsHtml .= '</table>';
}

$headLine = $L('Nouvelle demande de faisabilité projet via nsy.fr', 'New project feasibility request via nsy.fr');

$bodyHtml = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:680px;margin:auto;padding:24px;background:#f5f7fb">'
    . '<div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06)">'
    . '<h2 style="margin:0 0 8px;color:#0A0F1C;font-size:20px">' . $esc($headLine) . '</h2>'
    . '<p style="margin:0 0 20px;color:#555;font-size:14px">'
    .   '<strong style="color:#0A0F1C">' . $esc($name) . '</strong> · '
    .   '<a href="mailto:' . $esc($email) . '" style="color:#00B8D4">' . $esc($email) . '</a>'
    . '</p>'
    . $rowsHtml
    . '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e9f0">'
    . '<p style="margin:0;color:#888;font-size:11px;font-family:monospace">Envoyé depuis nsy.fr · ' . $esc($lang) . ' · IP ' . $esc($ip) . ' · ' . date('Y-m-d H:i:s') . '</p>'
    . '</div></div>';

$bodyText = "$headLine\n\n$name · $email\n" . $rowsText
    . "\n---\nEnvoyé depuis nsy.fr · $lang · IP $ip · " . date('Y-m-d H:i:s') . "\n";

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
    $mail->SMTPSecure = $config['smtp_secure'];
    $mail->Port       = (int)$config['smtp_port'];
    $mail->CharSet    = 'UTF-8';
    $mail->Timeout    = 15;

    $mail->setFrom($config['smtp_username'], 'Questionnaire NSY');
    $mail->addAddress($config['to_address'], $config['to_name'] ?? 'NSY');
    $mail->addReplyTo($email, $name);

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $bodyHtml;
    $mail->AltBody = $bodyText;

    $mail->send();

    // ───── Auto-responder to the visitor (best effort — same dark NSY style as contact) ─────
    try {
        $auto = new \PHPMailer\PHPMailer\PHPMailer(true);
        $auto->isSMTP();
        $auto->Host       = $config['smtp_host'];
        $auto->SMTPAuth   = true;
        $auto->Username   = $config['smtp_username'];
        $auto->Password   = $config['smtp_password'];
        $auto->SMTPSecure = $config['smtp_secure'];
        $auto->Port       = (int)$config['smtp_port'];
        $auto->CharSet    = 'UTF-8';
        $auto->Timeout    = 15;

        $auto->setFrom($config['smtp_username'], 'Cédric Barme — NSY');
        $auto->addAddress($email, $name);
        $auto->addReplyTo($config['to_address'], $config['to_name'] ?? 'Cédric Barme (NSY)');

        $auto->isHTML(true);
        $ar = $lang === 'en' ? [
            'subject'  => 'Thanks for your feasibility request — NSY',
            'greeting' => 'Thank you, ' . $esc($name) . '.',
            'p1'       => 'I\'ve received your <strong style="color:#F2F6FF">project feasibility questionnaire</strong> and I\'ll personally get back to you <strong style="color:#00E5FF">within 48 business hours</strong> with an initial read: feasibility, ballpark figure, and a concrete next step.',
            'p2'       => 'If you have anything else to add in the meantime (references, constraints, deadlines), simply reply to this email.',
            'role'     => 'Founder of NSY',
            'alt'      => "Thank you, $name.\n\n"
                . "I've received your project feasibility questionnaire and I'll personally get back to you within 48 business hours with an initial read: feasibility, ballpark figure, and a concrete next step.\n\n"
                . "If you have anything else to add in the meantime, simply reply to this email.\n",
        ] : [
            'subject'  => 'Merci pour votre demande de faisabilité — NSY',
            'greeting' => 'Merci, ' . $esc($name) . '.',
            'p1'       => 'J\'ai bien reçu votre <strong style="color:#F2F6FF">questionnaire de faisabilité projet</strong> et je reviens vers vous personnellement <strong style="color:#00E5FF">sous 48 heures ouvrées</strong> avec une première lecture : faisabilité, ordre de grandeur, et prochain pas concret.',
            'p2'       => 'Si vous avez d\'autres éléments à ajouter d\'ici là (références, contraintes, échéances), répondez simplement à cet email.',
            'role'     => 'Fondateur de NSY',
            'alt'      => "Merci, $name.\n\n"
                . "J'ai bien reçu votre questionnaire de faisabilité projet et je reviens vers vous personnellement sous 48 heures ouvrées avec une première lecture : faisabilité, ordre de grandeur, et prochain pas concret.\n\n"
                . "Si vous avez d'autres éléments à ajouter d'ici là, répondez simplement à cet email.\n",
        ];

        $auto->Subject = $ar['subject'];

        $auto->Body = '<!doctype html><html lang="' . $lang . '"><body style="margin:0;padding:0;background:#05080F;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">'
            . '<div style="max-width:560px;margin:0 auto;padding:32px 16px">'
            .   '<div style="background:#0F1626;border:1px solid rgba(140,170,220,0.15);border-radius:18px;padding:40px 32px">'
            .     '<div style="font-family:\'JetBrains Mono\',Consolas,monospace;font-size:11px;letter-spacing:0.18em;color:#00E5FF;text-transform:uppercase;margin-bottom:12px">NSY · IA · Web</div>'
            .     '<h1 style="font-size:28px;line-height:1.15;letter-spacing:-0.02em;color:#F2F6FF;margin:0 0 24px">' . $ar['greeting'] . '</h1>'
            .     '<p style="font-size:16px;line-height:1.6;color:#C5CEE3;margin:0 0 16px">' . $ar['p1'] . '</p>'
            .     '<p style="font-size:16px;line-height:1.6;color:#C5CEE3;margin:0 0 28px">' . $ar['p2'] . '</p>'
            .     '<hr style="border:0;border-top:1px solid rgba(140,170,220,0.15);margin:28px 0">'
            .     '<table style="font-size:14px;color:#C5CEE3;border-collapse:collapse;line-height:1.6">'
            .       '<tr><td style="padding:4px 16px 4px 0;color:#8993AF;font-family:monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase">Site</td><td><a href="https://www.nsy.fr" style="color:#00E5FF;text-decoration:none">www.nsy.fr</a></td></tr>'
            .       '<tr><td style="padding:4px 16px 4px 0;color:#8993AF;font-family:monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase">Email</td><td><a href="mailto:contact@nsy.fr" style="color:#00E5FF;text-decoration:none">contact@nsy.fr</a></td></tr>'
            .       '<tr><td style="padding:4px 16px 4px 0;color:#8993AF;font-family:monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase">LinkedIn</td><td><a href="https://www.linkedin.com/in/c%C3%A9dric-barme/" style="color:#00E5FF;text-decoration:none">cédric-barme</a></td></tr>'
            .     '</table>'
            .     '<hr style="border:0;border-top:1px solid rgba(140,170,220,0.15);margin:28px 0">'
            .     '<p style="font-size:15px;line-height:1.5;color:#C5CEE3;margin:0">'
            .       '<strong style="color:#F2F6FF;font-size:16px">Cédric Barme</strong><br>'
            .       '<span style="color:#8993AF;font-size:13px">' . $ar['role'] . '</span>'
            .     '</p>'
            .   '</div>'
            .   '<p style="text-align:center;font-family:monospace;font-size:10px;letter-spacing:0.1em;color:#5B6485;margin:24px 0 0">NSY · EURL · SIREN 842 078 453</p>'
            . '</div>'
            . '</body></html>';

        $auto->AltBody = $ar['alt'] . "\n"
            . "Site       : https://www.nsy.fr\n"
            . "Email      : contact@nsy.fr\n"
            . "LinkedIn   : https://www.linkedin.com/in/cédric-barme/\n\n"
            . "—\nCédric Barme\n" . $ar['role'] . "\n\n"
            . "NSY · EURL · SIREN 842 078 453\n";

        $auto->send();
    } catch (\PHPMailer\PHPMailer\Exception $autoErr) {
        error_log('NSY faisabilité: autoresponder failed — ' . $auto->ErrorInfo);
    }

    if (ob_get_length()) ob_clean(); // drop any stray notice/deprecation before the JSON
    echo json_encode(['ok' => true]);
} catch (\PHPMailer\PHPMailer\Exception $e) {
    $detail = $mail->ErrorInfo ?: $e->getMessage();
    $errMsg = '[' . date('Y-m-d H:i:s') . '] NSY faisabilité: ' . $detail . "\n";
    error_log($errMsg);
    @file_put_contents(__DIR__ . '/_secret/contact-errors.log', $errMsg, FILE_APPEND);
    @file_put_contents(__DIR__ . '/contact-errors.log', $errMsg, FILE_APPEND);
    http_response_code(500);
    if (ob_get_length()) ob_clean();
    echo json_encode([
        'ok'    => false,
        'error' => $L("Erreur d'envoi — veuillez réessayer.", 'Sending failed — please try again.'),
        'debug' => $detail,
    ]);
}
