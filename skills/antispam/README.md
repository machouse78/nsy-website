# Skill `antispam` — défense anti-spam réutilisable pour formulaires web

Playbook **réutilisable** (nsy.fr, prv-concept.com, sites clients) pour protéger
un formulaire PHP (contact, devis, questionnaire) contre le spam de bots — **sans
friction pour les vrais visiteurs** et **sans perdre un lead légitime**.

Ce dossier est un [skill Claude Code](https://docs.claude.com/en/docs/claude-code/skills) :
de la documentation passive chargée quand elle est pertinente. Il embarque un
module PHP prêt à coller.

## Contenu

| Fichier | Rôle |
|---|---|
| [`SKILL.md`](SKILL.md) | Le playbook (déclenchement + méthode) chargé par Claude |
| [`reference/antispam.php`](reference/antispam.php) | **Module PHP prêt à coller** — score de contenu, plafond journalier, log d'audit |
| `README.md` | Ce document |

## Le principe : défense en profondeur

Cinq couches enchaînées, du moins cher au plus cher. Chacune arrête un profil de
bot différent ; dès qu'une couche bloque, on s'arrête.

```
1. Honeypot            champ caché rempli seulement par les bots
2. Turnstile / CAPTCHA jeton vérifié côté serveur
3. Scoring de contenu  ← ce module (heuristique sur le texte)
4. Rate-limit + cap    60 s + plafond journalier par IP
5. Abandon silencieux  faux {ok:true}, aucun email, + log d'audit
```

> ⚠️ **La cause la plus fréquente du spam qui passe : Turnstile n'est pas
> réellement actif** (secret non configuré → vérif sautée). À vérifier en premier.
> Le scoring de contenu est le **filet** quand la couche 2 manque ou est contournée.

## Démarrage rapide

```bash
# 1. Copier le module à la racine du projet
cp reference/antispam.php /chemin/du/site/antispam.php

# 2. Vérifier la syntaxe
docker run --rm -v "$PWD":/app -w /app php:8.3-cli-alpine php -l antispam.php
```

Puis, dans chaque handler de formulaire, **après** honeypot + Turnstile +
validation, **avant** l'envoi de l'email :

```php
require_once __DIR__ . '/antispam.php';
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

if (over_daily_cap('contact', $ip, 5)) {              // + throttle 60 s existant
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Trop de demandes aujourd’hui.']);
    exit;
}
$score = spam_score($message, $email, $name, $company);
if ($score >= SPAM_THRESHOLD) {
    spam_log('contact', ['name'=>$name,'email'=>$email,'message'=>$message], $score, $ip);
    echo json_encode(['ok' => true]);                 // faux succès : aucun email
    exit;
}
```

## Signaux de score

| Signal | Poids |
|---|---|
| 1 URL dans le texte | +3 |
| 2 URLs et plus | +7 (cumulé) |
| Lien Markdown / BBCode / HTML injecté | +4 |
| Raccourcisseur / domaine spammy (`telegra.ph`, `t.me`, `bit.ly`…) | +5 |
| TLD à risque (`.ru .top .xyz .loan …`) | +2 |
| Mot-clé spam (crypto, casino, backlink, « earn $ », « per day »…) | +3 chacun |
| Montant `$1,500` / `€500` | +2 |
| Longue séquence EN MAJUSCULES | +2 |

**Seuil** `SPAM_THRESHOLD` = **5** par défaut.

## Calibration — règle d'or : zéro faux positif d'abord

Un lead perdu coûte plus cher qu'un spam reçu.

- **Seuil haut (5)** : une vraie demande partageant **une** URL propre (score 3)
  **passe** ; deux URLs, ou une URL + un mot-clé, sont bloquées.
- **Ne jamais** mettre un terme légitime de votre secteur dans les mots-clés
  (ex. « seo » seul si le client vend du SEO → utiliser « seo service »).
- En cas de doute, **logger sans bloquer** quelques jours et lire le journal avant
  de durcir.

## Abandon silencieux + audit

Le spam reçoit un **faux succès** (`{ok:true}`, aucun email) : le bot croit avoir
réussi et ne cherche pas à contourner. Chaque blocage est **journalisé** dans
`SPAM_LOG` — **obligatoirement hors racine web** (ex. `_secret/spam.log`,
dossier en `Deny from all`). Le log est le filet pour rattraper un faux positif.

Vérifier la protection :

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://votre-site/_secret/spam.log   # doit être 403
```

## Vérifier avant de livrer

- **Unitaire** : `spam_score()` sur le spam réel reçu (> seuil) **et** sur 3-4
  vraies demandes (doivent passer).
- **Intégration** (conteneur PHP jetable) : POST du spam → `{ok:true}`, **aucun**
  email, une ligne dans `spam.log`.
- **Live** : idem sur le vrai endpoint + `403` sur le log en HTTP.

## Adapter à un nouveau site (checklist)

1. Copier `reference/antispam.php` à la racine.
2. Régler `SPAM_LOG` (hors web, protégé) et `SPAM_THRESHOLD`.
3. Adapter `$badHosts` + mots-clés au **métier** (retirer les termes légitimes).
4. Brancher dans chaque handler de formulaire.
5. Ajouter au build/déploiement.
6. **Vérifier Turnstile réellement actif.**
7. Tester (unitaire + intégration + live) puis lire `spam.log` quelques jours.

## Historique

Extrait et généralisé depuis l'implémentation `antispam.php` de **nsy.fr**
(juillet 2026), qui a bloqué du spam crypto (`telegra.ph`, « EARN $1,500 PER
DAY ») passé au travers du honeypot + Turnstile inactif.
