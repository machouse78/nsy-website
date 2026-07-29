# Skill `chatbot` — assistant de site à mascotte animée (réutilisable)

Playbook **réutilisable** (nsy.fr, prv-concept.com, sites clients) pour construire
et maintenir un chatbot **avec une identité** : une mascotte animée (FAB en bas à
droite), une bulle d'accroche, un panneau de chat, des avatars animés, et — sous
le capot — un LLM ancré sur les données du site (avec repli résilient) ou un
moteur de règles local.

Ce dossier est un [skill Claude Code](https://docs.claude.com/en/docs/claude-code/skills) :
de la documentation passive chargée quand elle est pertinente.

## Ce que couvre le skill

- **Front portable** : un widget autonome `.cbot-*` (un seul JS + un seul CSS),
  injecté sur chaque page, qui marche aussi sur la boutique WordPress et le forum
  phpBB.
- **Charte graphique** : le widget est thémé par **design tokens** (palette,
  polices, couleur d'accent). Deux chartes de référence documentées — PRV Concept
  (dark chaud + orange `#ED7D2B`) et NSY (marine + cyan `#00E5FF`) —, plus la
  règle d'or : tout ornement « signal » (anneau, **halo d'avatar**, greeter…)
  porte l'accent de la charte. Voir [`reference/charte-graphique.md`](reference/charte-graphique.md).
- **Mascotte animée** : pipeline image→vidéo (générer → composer sur le fond de la
  charte → boomerang → **dé-bober** le recadrage tête), idle humain (pas de
  bobbing mécanique, logo rigide), FAB plein pied + avatars tête + halo.
- **Performance & iOS** : pause hors-écran, et le **correctif du gel des vidéos au
  retour d'une autre app** (Instagram/YouTube) sur iOS Chrome/Safari — reprise sur
  geste via un bus `window.__prv`.
- **Étage serveur** : proxy LLM ancré + garde-fous **zéro invention** (jamais de
  contenu externe inventé), rédaction sensible silencieuse, repli résilient.

## Deux implémentations de référence

| Site | Mascotte | Charte | IA visible ? |
|------|----------|--------|--------------|
| nsy.fr | **Ansley** (robot) | marine + cyan | oui (badge « IA · MISTRAL ») |
| prv-concept.com | **Père Hervé** (tête-de-piston) | dark chaud + orange | non (masquée) |

Le code canonique de chaque widget vit dans son repo (`assets/prevy.js` +
`assets/prevy.css` pour PRV) ; ce skill capture l'**architecture, la charte et les
pièges** pour ne pas les ré-apprendre à chaque fois.

## Related skills

`frontend-responsive-perf`, `video-to-website`, `antispam`, `seo-geo-llmo`,
`skill-nsy-website`, `skill-prv-concept`.
