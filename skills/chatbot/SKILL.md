---
name: chatbot
description: Reusable animated-mascot chat widget for a website — portable front-end (`.cbot-*` widget injected on every page) + optional grounded LLM server proxy + an AI-generated animated mascot (FAB, header/message avatars, greeter bubble). Carries the per-site GRAPHIC CHARTER (design tokens: palette, fonts, accent halo/glow) so ornaments respect the brand. Covers the mascot video pipeline (generate → composite on brand-dark → boomerang → de-bob → head crop), performance, the iOS "video frozen after switching apps" fix, and the grounded/zero-invention server guardrails. Use when building, theming, animating, or debugging the chatbot on nsy.fr (Ansley) or prv-concept.com (Père Hervé), or standing one up on a new site. Two reference implementations. Battle-tested (2026).
---

# Chatbot à mascotte animée — playbook réutilisable

Un assistant de site **avec une identité** : une mascotte animée en bas à droite
(FAB), une bulle d'accroche (greeter), un panneau de chat, des avatars animés, et
— sous le capot — soit un vrai LLM ancré sur les données du site, soit un moteur
de règles local. **Portable** (vitrine + boutique WordPress + forum phpBB) et
**thémé par la charte graphique** du site.

Deux implémentations de référence :
- **NSY (nsy.fr)** — « **Ansley** », mascotte robot, charte marine + cyan, badge
  « IA · MISTRAL » affiché (public tech).
- **PRV Concept (prv-concept.com)** — « **Père Hervé** » (jeu de mots P-R-V),
  mascotte tête-de-piston mécano, charte dark chaud + orange, IA **masquée**.

Le code canonique vit dans chaque repo : **`assets/prevy.js` + `assets/prevy.css`**
(PRV) — un widget autonome de ~30 Ko injecté par `js/app.js`. La **charte
graphique** (les seuls tokens à changer d'un site à l'autre) est dans
[`reference/charte-graphique.md`](reference/charte-graphique.md).

## 1. Architecture front — un widget portable et autonome

- **Source unique** : tout le widget (`initChatbot()` + helpers) dans un seul JS
  (`prevy.js`) + un seul CSS (`prevy.css`). Aucune des pages HTML ne le connaît ;
  `app.js` les **injecte** avec un cache-buster `?v=`. La boutique/forum le
  chargent avec 2 lignes (`<link …/prevy.css>` + `<script …/prevy.js defer>`).
- **Autonome** : le CSS embarque **ses propres variables** de charte (voir §4) —
  il ne dépend pas du `:root` de la page (la boutique/forum n'ont pas la charte
  vitrine). Préfixe de classes `.cbot-*` pour ne rien casser autour.
- **Persistance** : conversation en `sessionStorage` (suit le visiteur de page en
  page). Rendu : copie assistant en `innerHTML` (gras/liens), saisie visiteur en
  `textContent` (jamais en HTML — anti-XSS).
- **⚠️ Cache-busting** : après CHAQUE modif de `prevy.js`/`prevy.css`, incrémenter
  le token `?v=` sur `app.js`+`styles.css` dans **toutes** les pages HTML (script
  le sed, puis régénère les pages EN) **et** le `V` du chargeur prevy dans
  `app.js`. Sinon les navigateurs servent l'ancien widget malgré `no-cache`.

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
CSS (`--bg*`, `--ink*`/`--fg*`, `--orange`/accent, `--line*`). Table complète des
2 chartes de référence (PRV orange `#ED7D2B` / NSY cyan `#00E5FF`), polices, et
correspondance token→composant : [`reference/charte-graphique.md`](reference/charte-graphique.md).

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

Les **règles de contenu spécifiques** à chaque site (véhicules, périmètre forum,
etc.) vivent dans les skills de site (`skill-prv-concept`, `skill-nsy-website`),
pas ici.

## 7. Vérifier (avant de livrer)

- **Mesurer, pas deviner** (headless/preview) : tailles FAB fermé/ouvert, avatars,
  pas d'overflow horizontal, halo non rogné, bulle greeter lisible. (Note : l'onglet
  du pane est souvent « hidden » → vidéos en pause et transitions gelées ; couper la
  transition pour lire la vraie valeur, mesurer plutôt que se fier au rendu figé.)
- **Bob avatar** : quantifier l'amplitude verticale (numpy) avant/après dé-bob.
- **iOS réel** : bascule vers Instagram/YouTube puis retour → héros + mascotte +
  avatars repartent (au retour ou au 1er toucher).
- **Cache** : après modif prevy, vérifier le nouveau `?v=` **en ligne**.

## Related skills

`frontend-responsive-perf` (mesure headless, vidéos en boucle, moteur de règles) ·
`video-to-website` (pipeline vidéo) · `antispam` (formulaires) ·
`skill-nsy-website` / `skill-prv-concept` (branchements & contenu par site).
