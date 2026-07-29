# Charte graphique du widget chatbot — MÉTHODE (design tokens)

Ce fichier décrit la **méthode** de theming, commune à tous les sites. Les
**valeurs** concrètes (palettes, polices) de chaque site sont dans son skill de
site : `chatbot-nsy` (Ansley, cyan) et `chatbot-prv` (Père Hervé, orange).

Le widget est **thémé par variables CSS**. Selon le mode de livraison (voir le
socle §1) :
- **widget autonome** (PRV) : les tokens sont embarqués dans le CSS du widget —
  il ne dépend PAS du `:root` de la page (il doit marcher aussi sur la boutique
  WordPress et le forum phpBB, qui n'ont pas la charte de la vitrine) ;
- **widget intégré** (NSY) : les tokens sont ceux du `:root` global du site.

Dans les deux cas, adapter la charte = changer QUE le bloc de tokens ; la
structure `.cbot-*` reste identique.

## Le bloc de tokens (à porter tel quel dans le CSS du widget)

Les variables sont posées sur les 3 racines du widget pour être autonomes :

```css
#cbot-fab, #cbot, #cbot-greeter {
  --bg:…; --bg-2:…; --bg-3:…;           /* 3 niveaux de fond (du plus clair au plus sombre) */
  --ink:…; --ink-soft:…; --ink-mut:…; --ink-dim:…;  /* 4 niveaux de texte */
  --orange:…;                           /* couleur d'accent = charte du site */
  --line:…; --line-soft:…;              /* filets/bordures */
}
```

> Le nom `--orange` est historique (PRV) : c'est l'**accent de la charte**, quelle
> que soit sa teinte réelle. Sur NSY c'est un cyan. Garder le nom `--orange`
> évite de toucher les 40+ références dans le CSS ; seule la VALEUR change.

## Valeurs par site → skill de site

Les palettes concrètes ne vivent PAS ici (pour rester indépendantes) :
- **NSY / Ansley** (marine + cyan `#00E5FF`, IA **affichée**) → skill `chatbot-nsy`.
- **PRV / Père Hervé** (dark chaud + orange `#ED7D2B`, IA **masquée**) → skill `chatbot-prv`.

> **Choix éditorial IA visible / masquée** (à décider par site) : un public tech
> peut **afficher** le badge « IA · … » (NSY) ; un public grand-public peut le
> **masquer** et présenter la mascotte comme un personnage (PRV : « le Père Hervé,
> chef d'atelier »). Le socle supporte les deux.

## Correspondance token → composant

- **FAB fermé** : `background:var(--bg)` (badge sombre = raccord avec le fond de la
  vidéo mascotte), anneau `box-shadow: 0 0 0 3px accent`.
- **FAB ouvert** (bouton fermer) : dégradé d'accent, croix `var(--bg)`.
- **En-tête** : `--bg-3`, avatar en cercle sombre + **halo accent** (anneau pulse
  `.cbot-ava-pulse` + glow `::after`), nom en police titre, voyant en ligne vert
  (orange quand l'IA est en repli).
- **Bulles** : assistant `--bg-3` + `--ink-soft` ; visiteur = dégradé d'accent +
  texte sombre (`#140f0a`).
- **Greeter** (bulle d'accroche) : fond **plein accent** + texte sombre → doit
  **trancher** sur le fond quasi-noir du site (un fond sombre, même avec liseré
  accent, se fond dans le décor — leçon PRV).
- **Puces de suggestion / liens / bouton envoyer** : accent.

## Règle d'or charte

Tout élément « signal » (anneau FAB, halo avatar, greeter, bouton envoyer, liens)
porte la **couleur d'accent de la charte du site**. Le reste est neutre (échelle
de gris chaude ou froide selon le site). Quand on ajoute un ornement (ex. le halo
de l'avatar), il **doit** reprendre l'accent, pas une couleur arbitraire.
