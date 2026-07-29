# Skill `chatbot-core` — socle du chatbot à mascotte animée

**Socle commun réutilisable** (nsy.fr, prv-concept.com, sites clients) pour un
chatbot **avec une identité** : une mascotte animée (FAB en bas à droite), une
bulle d'accroche, un panneau de chat, des avatars animés, et — sous le capot — un
LLM ancré sur les données du site (avec repli résilient) ou un moteur de règles
local.

Ce dossier est un [skill Claude Code](https://docs.claude.com/en/docs/claude-code/skills) :
de la documentation passive chargée quand elle est pertinente. Il ne contient que
le **commun**. Les spécificités de chaque site vivent dans un skill qui **hérite**
de ce socle : **`chatbot-nsy`** (Ansley) et **`chatbot-prv`** (Père Hervé) — on
lit d'abord ce socle, puis le skill du site.

## Ce que couvre le socle

- **Architecture front** : la structure `.cbot-*` (FAB, greeter, panneau, avatars)
  et ses deux modes de livraison — **autonome** (un JS + un CSS embarquant leurs
  tokens, pour tourner hors vitrine : boutique WordPress, forum phpBB) ou
  **intégré** (partial + CSS global). Le mode retenu par site est dans son skill.
- **Charte graphique — méthode** : theming par **design tokens** (palette, polices,
  accent) + correspondance token→composant + règle d'or (tout ornement « signal »
  porte l'accent). Voir [`reference/charte-graphique.md`](reference/charte-graphique.md).
  Les **valeurs** de palette sont dans les skills de site.
- **Mascotte animée** : pipeline image→vidéo (générer → composer sur le fond de la
  charte → boomerang → **dé-bober** le recadrage tête), idle humain (pas de
  bobbing mécanique, logo rigide), FAB plein pied + avatars tête + halo.
- **Performance & iOS** : pause hors-écran, et le **correctif du gel des vidéos au
  retour d'une autre app** (Instagram/YouTube) sur iOS Chrome/Safari — reprise sur
  geste via un bus de reprise global.
- **Étage serveur** : proxy LLM ancré + garde-fous **zéro invention** (jamais de
  contenu externe inventé), rédaction sensible silencieuse, repli résilient.

## Skills qui héritent de ce socle

| Skill | Site | Mascotte | Charte | IA visible ? |
|-------|------|----------|--------|--------------|
| **`chatbot-nsy`** | nsy.fr | **Ansley** (robot) | marine + cyan | oui (badge « IA · MISTRAL ») |
| **`chatbot-prv`** | prv-concept.com | **Père Hervé** (tête-de-piston) | dark chaud + orange | non (masquée) |

Le code canonique de chaque widget vit dans **son** repo (`partials/chatbot.*.html`
+ `chat.php` pour NSY ; `assets/prevy.js` + `assets/prevy.css` pour PRV).

## Related skills

`frontend-responsive-perf`, `video-to-website`, `antispam`, `seo-geo-llmo`,
`skill-nsy-website`, `skill-prv-concept`.
