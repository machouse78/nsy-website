# Skills Claude Code

Cinq [skills Claude Code](https://docs.claude.com/en/docs/claude-code/skills)
versionnés avec le projet. Ce sont de la **documentation passive** chargée par
Claude quand elle est pertinente — ils n'exécutent rien et ne modifient pas le
site par eux-mêmes.

| Skill | Rôle |
|---|---|
| **`skill-nsy-website/`** | Le « quoi » spécifique au projet : faits (fondée 2018, prix 5 800 € HT, SIREN…), conventions bilingues, terminologie (Conception 3D/Maillage, pas de « K2000 »), contraintes du chatbot, pipeline 3D, workflow de déploiement. Évite d'avoir à re-préciser ces règles à chaque session. |
| **`frontend-responsive-perf/`** | Le « comment » technique réutilisable (framework-agnostique) : responsive parfait mobile/tablette/desktop/paysage, alignement des nav/widgets, optimisations CPU/GPU (pause hors-écran des vidéos/animations/3D, recompression média), chatbot léger sans LLM, et la méthodo de vérification en Chrome headless. |
| **`seo-geo-llmo/`** | Le playbook SEO + GEO/LLMO réutilisable (nsy.fr, prv-concept.com, sites clients) : allowlist des crawlers IA dans robots.txt, llms.txt/llms-full.txt, JSON-LD `@graph` entitaire, FAQ conversationnelle, inscriptions externes (Bing Webmaster Tools, propriété de domaine GSC via TXT DNS, Wikidata sourcée SIRENE, Google Business Profile, LinkedIn, backlinks) — avec les pièges vécus et les vérifications curl/dig/headless. |
| **`frontend-design/`** | Création d'interfaces front distinctives et production-grade, sans esthétique « IA générique » — le skill utilisé pour concevoir le design du site. |
| **`video-to-website/`** | Transformer une vidéo en site scroll-animé premium (GSAP, rendu canvas, chorégraphie d'animations par couches). |

## Activer les skills

Claude Code charge les skills depuis `~/.claude/skills/`. Pour les activer
depuis ce dépôt, copie-les (ou crée des liens symboliques pour qu'ils restent
synchronisés avec le repo) :

```bash
# Copie simple
cp -R skills/* ~/.claude/skills/

# …ou liens symboliques (les éditions du repo se répercutent automatiquement)
for s in skill-nsy-website frontend-responsive-perf seo-geo-llmo frontend-design video-to-website; do
  ln -sfn "$(pwd)/skills/$s" ~/.claude/skills/$s
done
```

Chaque skill suit le format standard : un `SKILL.md` (frontmatter `name` +
`description` qui pilote le déclenchement) et un dossier `references/` pour le
détail.
