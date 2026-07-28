---
name: antispam
description: Reusable server-side anti-spam defense for web contact / lead / quote forms (PHP). Layered defense in depth — honeypot, Cloudflare Turnstile (CAPTCHA), content scoring (URLs, link shorteners, spam keywords, ALL-CAPS, money amounts), per-IP rate-limit + daily cap, and SILENT-DROP of spam with an audit log. Use when a form is receiving spam, or when adding / hardening spam protection on any site (nsy.fr, prv-concept.com, client sites). Ships a drop-in `antispam.php` module in references/. Battle-tested on nsy.fr (July 2026).
---

# Anti-spam — playbook réutilisable (formulaires web)

Protéger un formulaire (contact, devis, questionnaire) contre le spam de bots,
**sans friction pour les vrais visiteurs** et **sans perdre un lead légitime**.
Serveur PHP, aucune dépendance. Le module prêt à coller est
[`references/antispam.php`](references/antispam.php).

## Le modèle : défense en profondeur (5 couches, du moins cher au plus cher)

Chaque couche arrête un profil de bot différent. On les enchaîne ; dès qu'une
couche bloque, on s'arrête.

| # | Couche | Arrête | Coût |
|---|--------|--------|------|
| 1 | **Honeypot** — champ caché (ex. `website`) que seuls les bots remplissent | bots naïfs qui remplissent tout | nul |
| 2 | **Turnstile / CAPTCHA** — jeton vérifié côté serveur | bots sans navigateur / sans JS | nul (Cloudflare gratuit) |
| 3 | **Scoring de contenu** (ce module) — heuristique sur le texte | bots « intelligents » qui passent 1 & 2 | nul |
| 4 | **Rate-limit + plafond journalier** par IP | rafales, drip lent | nul |
| 5 | **Abandon silencieux + log d'audit** | — (verdict des couches 3-4) | nul |

> **Leçon nº1 (vécue sur nsy.fr) :** quand du spam passe malgré honeypot +
> Turnstile, la cause la plus fréquente est que **Turnstile n'est pas réellement
> actif** (secret non configuré côté serveur → la vérif est sautée). Toujours le
> vérifier en premier. Le scoring de contenu est le **filet** quand la couche 2
> est absente ou contournée (services de résolution de CAPTCHA).

## Couche 3 — scoring de contenu (le cœur du module)

`spam_score()` additionne des signaux ; `>= SPAM_THRESHOLD` (défaut **5**) ⇒ spam.

Signaux (voir le fichier pour les poids exacts) :
- **URLs** dans le texte (rare en B2B, systématique en spam) — 1 lien +3, 2+ +7.
- **Liens Markdown / BBCode / HTML** injectés (`[url=`, `<a href`) — fort.
- **Raccourcisseurs / domaines spammy** : `telegra.ph`, `t.me`, `bit.ly`… — +5.
- **TLD** à risque (`.ru .top .xyz .loan …`).
- **Mots-clés** spam (crypto, casino, backlinks, « earn $ », « per day »…).
- **Montants** `$1,500`, `€500/day`.
- **Longues MAJUSCULES** criardes.

### Calibration — règle d'or : zéro faux positif d'abord
Un lead perdu coûte plus cher qu'un spam reçu. Donc :
- **Seuil haut** (5) : une vraie demande « refonte de site » qui partage **une**
  URL propre (score 3) **passe**. Deux URLs ou une URL + un mot-clé ⇒ bloqué.
- **N'ajoutez jamais un terme légitime de votre secteur** à la liste de mots-clés
  (ex. « seo » seul si le client vend du SEO — utilisez « seo service »).
- En cas de doute, **loggez sans bloquer** quelque temps et lisez le log avant de
  durcir.

### Abandon SILENCIEUX (pas d'erreur affichée)
Quand c'est du spam, renvoyer un **faux succès** `{ok:true}` **sans envoyer
l'email** : le bot croit avoir réussi et ne cherche pas à contourner. On
**journalise** dans un fichier hors racine web (le filet de sécurité pour
repérer un éventuel faux positif). Ne jamais dire « message rejeté comme spam ».

## Intégration (dans un handler PHP existant)

Placer le bloc **après** honeypot + Turnstile + validation des champs, **avant**
l'envoi de l'email :

```php
require_once __DIR__ . '/antispam.php';
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

if (over_daily_cap('contact', $ip, 5)) {           // en plus d'un throttle 60 s
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => '…']); exit;
}
$score = spam_score($message, $email, $name, $company);
if ($score >= SPAM_THRESHOLD) {
    spam_log('contact', ['name'=>$name,'email'=>$email,'message'=>$message], $score, $ip);
    echo json_encode(['ok' => true]);              // faux succès, aucun email
    exit;
}
```

Pour un questionnaire multi-champs, passer le **payload sérialisé** en `$message`
(tout le texte libre est ainsi scoré d'un coup).

## Couches 1, 2, 4 (rappels d'implémentation)

- **Honeypot** : `<input name="website" tabindex="-1" autocomplete="off">` masqué
  en CSS ; si rempli → faux succès silencieux.
- **Turnstile** : sitekey (publique) dans le HTML, **secret** dans la config
  serveur (jamais commité) ; vérif POST vers
  `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Rejeter si absent
  quand le secret est configuré.
- **Rate-limit 60 s** : fichier temp `touch` par IP hachée + `over_daily_cap()`
  pour le plafond/jour.

## Protéger le log d'audit (obligatoire)

`SPAM_LOG` **doit** pointer hors de la racine web (ex. `_secret/spam.log`) et le
dossier être protégé (`Deny from all` .htaccess Apache / `location` nginx).
Vérifier : `curl -o /dev/null -w '%{http_code}' https://site/_secret/spam.log`
doit renvoyer **403**.

## Vérifier (avant de livrer)

- **Unitaire** : `spam_score()` sur le spam réel reçu (doit dépasser le seuil) ET
  sur 3-4 vraies demandes (conseil, web + 1 URL, mention d'un terme métier) — qui
  doivent **passer**.
- **Intégration** (conteneur PHP jetable) : POST du spam → réponse `{ok:true}`,
  **aucun** email, une ligne dans `spam.log`.
- **Live** : POST du spam sur le vrai endpoint → `{ok:true}` + entrée `spam.log`
  (et **403** sur le log en HTTP).

```bash
docker run --rm -v "$PWD":/app -w /app php:8.3-cli-alpine php -l antispam.php
```

## Adapter à un nouveau site (checklist PRV Concept / client)

1. Copier `references/antispam.php` à la racine du projet.
2. Régler `SPAM_LOG` sur un dossier **hors web** protégé du site, et `SPAM_THRESHOLD`.
3. Adapter `$badHosts` et la liste de mots-clés au **métier** (retirer les termes
   légitimes du secteur).
4. Brancher dans chaque handler de formulaire (contact, devis, forum si custom…).
5. Ajouter le fichier au build/déploiement (ex. `prepare-deploy.sh` / `build-deploy.sh`).
6. Vérifier Turnstile réellement actif (souvent la vraie cause du spam).
7. Tester (unitaire + intégration + live) puis lire `spam.log` quelques jours.

## Related skills

`seo-geo-llmo` (autre playbook réutilisable) · `skill-nsy-website` /
`skill-prv-concept` (branchements spécifiques à chaque site).
