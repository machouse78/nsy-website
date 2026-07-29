---
name: chatbot-core
description: SHARED base playbook for the animated-mascot chat widget reused across sites — portable `.cbot-*` front-end + optional grounded-LLM server proxy + an AI-generated animated mascot (FAB, header/message avatars, greeter bubble). Covers the reusable ARCHITECTURE, the mascot video pipeline (generate → composite on brand-dark → boomerang → de-bob → head crop), performance, the iOS "video frozen after switching apps" fix, the charte-by-tokens theming method, and the grounded/zero-invention server guardrails — everything common to every site. The per-site specifics (persona, palette values, exact file map, live-data rules) live in the site skills that build on this one: `chatbot-nsy` (Ansley) and `chatbot-prv` (Père Hervé). Use whenever building, theming, animating, or debugging a mascot chatbot, or standing one up on a new site — then read the matching site skill. Battle-tested (2026).
---

# Chatbot à mascotte animée — socle commun (playbook réutilisable)

Un assistant de site **avec une identité** : une mascotte animée en bas à droite
(FAB), une bulle d'accroche (greeter), un panneau de chat, des avatars animés, et
— sous le capot — soit un vrai LLM ancré sur les données du site, soit un moteur
de règles local. **Portable** et **thémé par la charte graphique** du site.

> **Ce skill = le SOCLE COMMUN** (architecture, pipeline mascotte, perf/iOS,
> méthode de charte, garde-fous serveur). Il ne contient AUCUNE valeur propre à
> un site. Les spécificités (persona, valeurs de palette, carte des fichiers,
> données live) vivent dans les skills de site qui **héritent** de ce socle —
> lis d'abord celui-ci, puis le skill du site :
>
> - **`chatbot-nsy`** — nsy.fr, « **Ansley** », mascotte robot, charte marine +
>   cyan, IA **affichée** (badge « IA · MISTRAL ») ; widget dans
>   `partials/chatbot.{fr,en}.html` + `.cbot-*` de `css/style.css` + `chat.php`.
> - **`chatbot-prv`** — prv-concept.com, « **Père Hervé** », mascotte
>   tête-de-piston, charte dark chaud + orange, IA **masquée** ; widget autonome
>   `assets/prevy.js` + `assets/prevy.css`, branché boutique WooCommerce + forum phpBB.

La **charte graphique** (méthode + correspondance token→composant, commune à
tous les sites) est dans [`reference/charte-graphique.md`](reference/charte-graphique.md) ;
les **valeurs** de palette de chaque site sont dans son skill de site.

## 1. Architecture front — un widget portable et autonome

- **Structure `.cbot-*`, identique partout** : FAB + greeter + panneau + avatars.
  Deux façons de la livrer selon le site (détail dans le skill de site) :
  - **widget autonome** — un seul JS + un seul CSS embarquant leurs propres
    tokens de charte, injectés par `app.js` (ex. `prevy.js`/`prevy.css` sur PRV) :
    obligatoire quand le widget doit tourner **hors** de la vitrine (boutique
    WordPress, forum phpBB) qui n'ont pas le `:root` du site ;
  - **widget intégré** — markup dans un partial injecté sur chaque page + styles
    dans le CSS global (ex. `partials/chatbot.*.html` + `.cbot-*` de `style.css`
    sur NSY) : suffisant quand toutes les pages partagent la même charte.
- **Persistance** : conversation en `sessionStorage` (suit le visiteur de page en
  page). Rendu : copie assistant en `innerHTML` (gras + liens **internes**), saisie
  visiteur en `textContent` (jamais en HTML — anti-XSS).
- **⚠️ Cache-busting** (widget autonome) : après CHAQUE modif du JS/CSS du widget,
  incrémenter le token `?v=` sur `app.js`/`styles.css` dans **toutes** les pages
  HTML **et** le `V` du chargeur, puis régénérer les pages EN. Sinon les
  navigateurs servent l'ancien widget malgré `no-cache`. (Widget intégré : le
  versioning du CSS/JS global du site suffit.)

## 2. La mascotte animée (le cœur de l'identité)

Pipeline reproductible (connecteur média type Kling `kling3_0_turbo`, image→vidéo) :

1. **Visuel source** : un PNG **corps entier transparent** de la mascotte.
2. **Composite** sur le **fond sombre de la charte** (`ffmpeg color=…:s=560x560` +
   `overlay` centré) — pas de transparence vidéo (iOS Safari ne la gère pas de
   façon fiable) ; le fond se raccorde au badge.
3. **Génère** un idle **humain subtil** : clignement + micro-respiration. Prompt
   IMPÉRATIF : **aucun mouvement mécanique de haut en bas**, corps/veste/logo
   **rigides** (sinon le logo « nage »). Valider **image par image** (zoomer le
   logo).
4. **Boomerang** (aller + `ffmpeg reverse` concaténés) → `loop` sans coupure.
5. **Recadrages** : le clip **plein pied** (~512²) sert le **FAB fermé** ; un
   **recadrage tête** (~224²) sert les **avatars** (en-tête + messages).
6. **DE-BOB des avatars (piège majeur)** : le recadrage tête **amplifie** la
   respiration en un va-et-vient vertical très visible (≈20 px à l'échelle
   avatar). Le corriger par une **stabilisation déterministe image par image** :
   mesurer la position d'un repère (numpy, ex. le haut du piston) et **décaler le
   cadrage** pour la verrouiller (20 px → 3 px). `deshake` **ne marche pas** (fait
   pour les tremblements erratiques, pas une oscillation douce).

Owner (durable) : la mascotte se comporte comme **une personne**, pas un jouet
mécanique. Rejette : bobbing, logo qui nage, coupure de boucle.

## 3. Composants & interactions

- **FAB fermé** = mascotte **plein pied** (badge portrait arrondi, fond charte +
  anneau accent) ; **ouvert** = petit **rond d'accent** avec croix (morph
  width/height/border-radius en .25s). Vidéo en pause quand panneau ouvert / hors
  écran.
- **Greeter** : bulle d'accroche qui se présente 1×/session (`sessionStorage`),
  clic → ouvre le chat, croix → referme. **Fond plein accent** (voir §4/leçon).
- **Avatars animés** : en-tête + **chaque** message assistant = `<video>` (même
  clip tête dé-bobé), joués tant que le panneau est ouvert (`playAvatars()`),
  en pause sinon. L'avatar d'en-tête porte un **halo accent** (anneau `pulse` +
  glow `::after`) — son conteneur **abandonne `overflow:hidden`** (la vidéo se
  découpe en cercle via `border-radius:50%`) pour ne pas rogner le halo.
- **Voyant d'état** : vert « en ligne » ; **orange** quand l'IA est en repli
  (données réelles servies sans le LLM).

## 4. Charte graphique (design tokens) — OBLIGATOIRE

Tout ornement « signal » (anneau FAB, **halo avatar**, greeter, bouton envoyer,
liens, puces) porte la **couleur d'accent de la charte du site**, jamais une
couleur arbitraire. Adapter un site = changer **uniquement** le bloc de tokens du
CSS (`--bg*`, `--ink*`/`--fg*`, `--orange`/accent, `--line*`). La **méthode**
(bloc de tokens, correspondance token→composant, règle d'or) est dans
[`reference/charte-graphique.md`](reference/charte-graphique.md) ; les **valeurs**
de chaque site (PRV orange `#ED7D2B`, NSY cyan `#00E5FF`, polices) sont dans son
skill de site (`chatbot-prv` / `chatbot-nsy`).

**Leçon greeter (PRV)** : un fond **sombre** pour la bulle d'accroche — même avec
un liseré d'accent — **se fond** dans le fond quasi-noir du site. Mettre un **fond
plein d'accent** + texte quasi-noir (`#140f0a`) pour un vrai contraste.

## 5. Performance & pièges iOS (indispensable)

- **Ne décoder/animer que le visible** : IntersectionObserver met en pause les
  vidéos hors écran ; CSS pauses sur `visibilitychange`.
- **PIÈGE iOS (Chrome ET Safari — WebKit)** : basculer vers une **autre app**
  (clic sur une pastille Instagram/YouTube `target="_blank"`) met le navigateur en
  arrière-plan ; **au retour, toutes les `<video>` restent figées** et un `play()`
  ne les débloque pas — WebKit exige un **geste utilisateur**. Solution : un petit
  **bus de reprise global** `window.__prv.onResume(fn)` ; chaque module (héros,
  FAB, avatars) enregistre sa reprise ; on rejoue au retour (`visibilitychange`/
  `pageshow`/`focus`) **ET au 1er `touchend`/`pointerup`/`click`** qui suit un
  passage en arrière-plan (le geste dont WebKit a besoin). « Ne pas mettre en
  pause » ne suffit PAS (le décodeur reste bloqué). Garder la pause « batterie »
  seulement pour les appareils à **souris** (`pointer: coarse` ⇒ tactile = jamais
  de pause en arrière-plan).
- **Liens externes** (forum/boutique, réseaux) : `target="_blank" rel="noopener"`
  (apps séparées) ; penser aussi aux liens **injectés en JS** (menu mobile).

## 6. Étage serveur (optionnel mais recommandé) — LLM ancré

Un proxy PHP (`chat.php`) compatible OpenAI, même origine, appelle un LLM (Mistral)
avec un **prompt système ancré** sur les FAITS du site + des **DONNÉES LIVE**
(produits boutique via Store API, sujets forum lus en base). **Repli résilient** :
si le LLM tombe (429/panne), on sert quand même les données réelles récupérées
(mode dégradé) ; sinon le widget bascule sur son **moteur de règles** local.

**Garde-fous (chacun gagné en prod, IMPÉRATIFS)** :
- **Zéro invention, tolérance zéro** : ne citer QUE ce qui est dans les FAITS /
  DONNÉES LIVE. **Jamais** de marque, boutique, site ou produit **externe**, même
  « à titre d'exemple » — dire « je ne trouve pas ça » plutôt qu'inventer.
- **Ne pas déduire** codes moteurs / puissances / relations entre personnes ;
  reprendre les **titres/pseudos exacts** des données (ne pas « corriger » un
  modèle vers une variante attendue).
- **Rédaction sensible SILENCIEUSE** (ex. modifications non homologuées) : omettre
  côté serveur, sans jamais l'annoncer.
- **Identifiants ≠ dates** ; n'afficher une date que si la donnée la fournit.

Les **règles de contenu spécifiques** à chaque site (persona, périmètre, données
live boutique/forum, véhicules…) vivent dans le skill de site (`chatbot-nsy`,
`chatbot-prv`) — et le contenu métier de fond dans `skill-nsy-website` /
`skill-prv-concept`. Pas ici.

## 7. Vérifier (avant de livrer)

- **Mesurer, pas deviner** (headless/preview) : tailles FAB fermé/ouvert, avatars,
  pas d'overflow horizontal, halo non rogné, bulle greeter lisible. (Note : l'onglet
  du pane est souvent « hidden » → vidéos en pause et transitions gelées ; couper la
  transition pour lire la vraie valeur, mesurer plutôt que se fier au rendu figé.)
- **Bob avatar** : quantifier l'amplitude verticale (numpy) avant/après dé-bob.
- **iOS réel** : bascule vers Instagram/YouTube puis retour → héros + mascotte +
  avatars repartent (au retour ou au 1er toucher).
- **Cache** : après modif prevy, vérifier le nouveau `?v=` **en ligne**.

## Skills qui héritent de ce socle

- **`chatbot-nsy`** — l'implémentation NSY (Ansley) : persona, charte cyan, carte
  des fichiers (`partials/chatbot.*.html`, `chat.php`, `.cbot-*`), FAB 132×168.
- **`chatbot-prv`** — l'implémentation PRV (Père Hervé) : persona, charte orange,
  widget `prevy.js/css`, données live boutique WooCommerce + forum phpBB et leurs
  règles de remontée.

## Related skills

`frontend-responsive-perf` (mesure headless, vidéos en boucle, moteur de règles) ·
`video-to-website` (pipeline vidéo) · `antispam` (formulaires) ·
`skill-nsy-website` / `skill-prv-concept` (contenu métier par site).
