# Charte graphique du widget chatbot (design tokens)

Le widget est **thémé par variables CSS** embarquées dans son propre CSS (il ne
dépend PAS du `:root` de la page — il doit marcher aussi sur la boutique
WordPress et le forum phpBB, qui n'ont pas la charte du site vitrine). Pour
adapter le widget à un site, on ne change QUE ce bloc de tokens ; la structure
`.cbot-*` reste identique.

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

## Deux implémentations de référence

### PRV Concept — « Père Hervé » (dark chaud + orange)

| Token | Valeur | Rôle |
|-------|--------|------|
| `--bg` | `#100E0C` | fond principal (panneau, badge FAB) |
| `--bg-2` | `#16120F` | fond du panneau |
| `--bg-3` | `#0B0907` | fond le plus sombre (en-tête, bulles assistant, input) |
| `--ink` | `#F2EEE6` | texte principal |
| `--ink-soft` | `#C2B9AD` | texte secondaire (corps des bulles) |
| `--ink-mut` | `#9C938A` | texte atténué (statut, notes) |
| `--ink-dim` | `#8A8178` | texte le plus discret (placeholder) |
| `--orange` (accent) | `#ED7D2B` | anneau FAB, halo avatar, liens, puces, bouton envoyer, **bulle greeter** |
| `--line` / `--line-soft` | `rgba(242,238,230,.09)` / `.06` | filets |
| Halo avatar / bulle greeter | fond **plein** `#ED7D2B`, texte `#140f0a` | contraste fort sur fond quasi-noir |
| Police titre | **Saira Condensed** 800 | `.cbot-title` |
| Police mono (badge) | **JetBrains Mono** | `.cbot-badge` (masqué sur PRV : pas de « IA · Mistral ») |
| Corps | Archivo / système | bulles, input |

### NSY — « Ansley » (dark froid marine + cyan)

| Token | Valeur | Rôle |
|-------|--------|------|
| `--bg-0…3` | `#05080F` / `#0A0F1C` / `#0F1626` / `#161E33` | fonds (du plus sombre au plus clair) |
| `--fg-0…3` | `#F2F6FF` / `#C5CEE3` / `#8993AF` / `#5B6485` | textes |
| `--accent` | `#00E5FF` (cyan) | accent, halo avatar, badge « IA · MISTRAL » |
| `--accent-2` | `#4D7DFF` (bleu) | dégradés |
| Police titre | **Space Grotesk** | nom de l'assistant |
| Corps | Manrope / JetBrains Mono | — |

> NSY **affiche** le badge « IA · MISTRAL » et « IA générative » (public tech).
> PRV **masque** toute mention d'IA (public passionnés d'autos) : pas de badge,
> l'assistant se présente comme « le Père Hervé, chef d'atelier ». C'est un choix
> de charte éditoriale, à décider par site.

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
