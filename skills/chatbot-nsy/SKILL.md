---
name: chatbot-nsy
description: NSY-specific implementation of the mascot chatbot — "Ansley", the AI architect on nsy.fr. Inherits the shared `chatbot-core` skill (read that first for architecture, mascot pipeline, iOS fix, charte method, guardrails); this skill carries only what is NSY's own — the Ansley persona (AI shown, "IA · Mistral" badge), the cyan charte VALUES, the exact file map (widget in `partials/chatbot.{fr,en}.html` injected by `scripts/sync-partials.mjs`, `.cbot-*` in `css/style.css`, logic in `js/app.js`, LLM proxy `chat.php` on Mistral with a health endpoint + RAG on `llms-full.txt`, assets `public/ansley*`), and the finalized FAB visual spec (portrait 132×168, radius 22, cbot-pulse halo, open 60px circle, greeter). Use when building, styling, animating, or debugging Ansley on nsy.fr. Battle-tested (2026).
---

# chatbot-nsy — « Ansley » (nsy.fr)

> **Socle = [`chatbot-core`](../chatbot-core/SKILL.md).** Lis-le d'abord :
> architecture, pipeline mascotte + dé-bob, perf/iOS, méthode de charte, garde-fous
> serveur (zéro invention, jamais hors-site). **Ce skill = uniquement les
> spécificités NSY.** Le contenu métier (faits, offres, tarifs, bilingue) est dans
> `skill-nsy-website`.

## Persona

**Ansley**, l'architecte IA de NSY (société de Cédric Barme — conseil technique
finance/assurance + création web IA). Se présente comme *l'assistant/architecte
IA de NSY, une démonstration du savoir-faire IA de NSY, pas une personne réelle*.
**L'IA est ASSUMÉE** (public tech) : badge « IA · Mistral » affiché, statut « En
ligne · IA générative ». Le system prompt vit dans `chat.php` (`$system`).

## Mode de livraison — INTÉGRÉ

Toutes les pages nsy.fr partagent la charte du site → le widget n'est PAS un
bundle autonome (contrairement à PRV) :

| Élément | Fichier |
|---|---|
| Markup du widget (source unique) | `partials/chatbot.fr.html` · `partials/chatbot.en.html` |
| Injection sur les 36 pages | `node scripts/sync-partials.mjs` (marqueur `@partial:chatbot`) |
| Styles `.cbot-*` | `css/style.css` (bloc ~ligne 2050, tokens = `:root` global) |
| Logique widget (health-ping, typewriter, fallback règles, greeter) | `js/app.js` (IIFE chatbot) |
| Proxy LLM + health + anti-external + rate-limit | `chat.php` |
| Base de connaissances (RAG) | `llms-full.txt` (source de vérité unique) |
| Clé API (owner-managed, jamais committée) | `_secret/ai.php` (template `_secret/ai.php.example`) |
| Assets mascotte | `public/ansley.{mp4,png}` (visage/avatar), `public/ansley-fab.{mp4,png}` (buste/FAB) |

Modifier le widget → éditer le(s) **partial(s)** puis `node scripts/sync-partials.mjs`
(jamais les 36 pages à la main). Vérifier en preview headless. Déployer seulement
sur demande explicite (`./deploy.sh`). Voir `skill-nsy-website` pour le déploiement.

## Charte NSY (valeurs — marine + cyan)

Tokens = le `:root` global de `css/style.css` :

| Token | Valeur | Rôle |
|-------|--------|------|
| `--bg-0…3` | `#05080F` / `#0A0F1C` / `#0F1626` / `#161E33` | fonds (sombre → clair) |
| `--fg-0…3` | `#F2F6FF` / `#C5CEE3` / `#8993AF` / `#5B6485` | textes |
| `--accent` | `#00E5FF` (cyan) | accent : halo, badge « IA · MISTRAL », liens, bouton envoyer |
| `--accent-2` | `#4D7DFF` (bleu) | dégradés |
| `--warm` | `#F08A2C` | rien de structurel (petits voyants) |
| Police titre | **Space Grotesk** | nom de l'assistant |
| Corps / mono | **Manrope** / **JetBrains Mono** | bulles / labels, badge, statut |

Encre sur l'accent (greeter, bulle visiteur, FAB) = `#021018` / `#04141b` (jamais
noir pur ni un `--fg-*`). Voir la méthode dans `chatbot-core/reference/charte-graphique.md`.

## Spec visuelle du FAB (calée sur le FAB fermé de PRV Concept)

- **Fermé** : `.cbot-fab` **132×168, `border-radius:22px`** (portrait — buste
  d'Ansley + logo NSY visibles), glow cyan + **halo `::after`** = anneau
  `cbot-pulse` (1px, opacité 0.4, `inset:-4px`, `border-radius:26px`) — aussi
  discret que le pulse de l'avatar d'en-tête (mêmes keyframes `cbot-pulse`).
- **Ouvert** : `.cbot-fab.open` → **cercle 60×60** (`border-radius:50%`), croix.
- **Vidéo** : `.cbot-fab-face` (`object-fit:cover; border-radius:22px`) ; PAS
  d'`overflow:hidden` sur le FAB (rognerait le halo sortant).
- **Greeter** : `.cbot-greeter` `bottom:208px` (24 + 168 + marge), fond plein
  accent, texte `#04141b`, flèche vers le FAB, 1×/session (`nsy-cbot-greeted`).
- **En-tête** : avatar 38px cercle + `.cbot-avatar-pulse` (même anneau) ; la vidéo
  visage ne joue QUE panneau ouvert (`playAnsley`/`pauseAnsley`, économie batterie).
- **Mobile (≤480px)** : FAB `116×148`, ouvert `54×54`, greeter `bottom:176px`.
- Input : `font-size:16px` **minimum** (sinon iOS zoome au focus).

## Tests unitaires — OBLIGATOIRES avant tout commit chatbot

`./tests/run-tests.sh` (lint + suites) teste le **code réel** : `nsy_sanitize_reply()`
de `chat.php` (chargé via la garde `define('NSY_CHAT_TEST', true)` qui court-circuite
le endpoint — les fonctions top-level restent définies) et `mdToHtml` de `js/app.js`
(extrait par équilibrage d'accolades puis évalué). Couvre : whitelist officielle
(markdown + nu), neutralisation des externes, purge des `()`, linkmap FR/EN + ancres,
cap 4000, échappement XSS/`javascript:`, réécriture des formulations bannies
(ESN), ajout déterministe des publications sociales (`$journalSocials`). **À lancer avant CHAQUE commit touchant
`chat.php` ou `js/app.js`** ; ajouter un cas de test avec chaque nouvelle règle.

Autres règles du prompt (owner) : URL de la réalisation dès la 1re mention ; ne
jamais mêler la stack générale NSY aux faits d'une réalisation ; **toute réponse
sur une réalisation se termine par l'offre [Création de site IA](creation-site-ia.html)**.

Vérifier (headless) : FAB fermé `132×168 r22` en desktop ; l'état ouvert se
mesure sur un **clone** de `.cbot-fab.open` (ce navigateur corrompt la CSSOM d'un
nœud manipulé en direct) → attendu `60×60, 50%`.

## Garde-fous spécifiques NSY

Hérités du socle + propres à NSY (aussi dans `skill-nsy-website`) : **jamais de
prix / taux** (devis après cadrage → Contact, réponse < 48 h ouvrées), **jamais
d'e-mail ni de téléphone**, langue = celle du visiteur, liens internes FR/EN
réécrits serveur-side.
**Nuance « jamais hors-site » (owner, juillet 2026)** : les liens OFFICIELS de
NSY sont **whitelistés** — sites clients réalisés (prv-concept.com,
lecerfthym.fr), LinkedIn entreprise + profil fondateur, GitHub machouse78,
YouTube @new-software-yard, **et les publications sociales officielles des
articles du journal** (article LinkedIn Pulse + post Facebook, URLs exactes ;
préfixes stockés en MINUSCULES — la comparaison lowercase l'exige). Pour chaque
nouvel article : URLs dans `llms-full.txt` (bloc « Journal ») + les 3 étages +
un cas dans CHAQUE suite de tests + la map `$journalSocials` de
`nsy_sanitize_reply()` ; la règle 5 demande à Ansley de proposer ces liens,
et le serveur les APPEND de façon déterministe si une réponse FR cite un
article sans eux (le prompt seul est non fiable). Triple étage : prompt (règle 5), garde-fou
`chat.php` (`$ownHosts` + `$officialPrefixes` — les `()` vides après strip sont
purgés), et `mdToHtml` (`EXT_OK`, rendu cliquable `target="_blank"`). Tout AUTRE
lien externe reste neutralisé (zéro invention). La transparence est une feature (badge, note UE, section
RGPD) — la garder.
