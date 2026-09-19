<?php
/* Le logo en tête des courriels (owner, 19/09/2026 : « pour tous les mails reçus de PRV, NSY
   ou Le Cerf Thym, il faudrait qu'il y ait le logo » — puis « mets le logo en tête des
   courriels en attendant »).
   Le rond à gauche de l'expéditeur, dans la boîte de réception, relève de BIMI et attend une
   décision du owner (skill skill-nsy-website, § logo des courriels). En attendant, le logo
   est DANS le courriel :
   - un courriel en texte brut (alertes de formulaires.php) devient un HTML à en-tête logo,
     son texte d'origine restant la version texte (AltBody) pour les messageries sans HTML ;
   - un gabarit HTML (contact.php, faisabilite.php) place lui-même <img src="cid:logo_courriel">
     où il le veut : l'image y est jointe ici (retirée du gabarit si elle manque).
   Le logo voyage en image incorporée (cid:), affichée sans « afficher les images » :
   public/nsy-logo.png (512 × 232, 8 Ko). La newsletter garde son logo par adresse.
   Même nom de fonction sur prv-concept.com (courriel-logo.php de prv-concept, logo PRV).
   Ne lève jamais : sans le fichier du logo ou sur une erreur, le courriel part tel quel. */

function site_courriel_logo(\PHPMailer\PHPMailer\PHPMailer $m): void
{
    try {
        $logo = __DIR__ . '/public/nsy-logo.png';
        if ($m->ContentType === 'text/html') {
            if (strpos((string) $m->Body, 'cid:logo_courriel') !== false
                && (!is_file($logo) || !$m->addEmbeddedImage($logo, 'logo_courriel', 'nsy.png', 'base64', 'image/png'))) {
                $m->Body = preg_replace('~<img[^>]*cid:logo_courriel[^>]*>~', '', (string) $m->Body) ?? $m->Body;
            }
            return;
        }
        if (!is_file($logo)) {
            return;
        }
        $texte = (string) $m->Body;
        $html  = site_courriel_gabarit($texte);
        // L'image n'est jointe qu'une fois le HTML prêt : jointe à un courriel resté en texte
        // brut, elle arriverait comme une pièce jointe.
        if ($html === '' || !$m->addEmbeddedImage($logo, 'logo_courriel', 'nsy.png', 'base64', 'image/png')) {
            return;
        }
        $m->isHTML(true);
        $m->Body    = $html;
        $m->AltBody = $texte;
    } catch (\Throwable $e) {
        // le courriel part sans logo plutôt que pas du tout
    }
}

/** Texte brut → HTML aux couleurs du site : fond nuit, carte, logo en tête. */
function site_courriel_gabarit(string $texte): string
{
    $h = htmlspecialchars($texte, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    // Adresses cliquables (la ponctuation qui suit une adresse n'en fait pas partie).
    $h = preg_replace('~https?://[^\s<>"»]*[^\s<>"».,;:!?)\]]~u',
        '<a href="$0" style="color:#00E5FF;text-decoration:underline">$0</a>', $h) ?? '';
    // Retraits et alignements : espaces multiples et sauts de ligne écrits en dur
    // (Outlook ignore white-space: pre-wrap).
    $h = preg_replace_callback('~(?<=^|\n) +| {2,}~', static fn($x) => str_repeat('&nbsp;', strlen($x[0])), $h) ?? '';
    if ($h === '') {
        return '';
    }
    $h = nl2br($h, false);
    return '<!doctype html><html lang="fr"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background:#05080F">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#05080F">'
        . '<tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" style="max-width:640px" cellpadding="0" cellspacing="0" border="0">'
        . '<tr><td style="background:#0F1626;border:1px solid #1E2A40;border-radius:18px;padding:28px 28px 26px">'
        . '<a href="https://www.nsy.fr"><img src="cid:logo_courriel" width="110" alt="NSY" '
        . 'style="display:block;width:110px;height:auto;border:0;margin:0 0 22px"></a>'
        . '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;'
        . 'font-size:14px;line-height:1.6;color:#C5CEE3;word-break:break-word;overflow-wrap:anywhere">' . $h . '</div>'
        . '</td></tr></table></td></tr></table></body></html>';
}
