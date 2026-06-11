# Skills Claude Code

Deux [skills Claude Code](https://docs.claude.com/en/docs/claude-code/skills)
versionnés avec le projet. Ce sont de la **documentation passive** chargée par
Claude quand elle est pertinente — ils n'exécutent rien et ne modifient pas le
site par eux-mêmes.

| Skill | Rôle |
|---|---|
| **`skill-nsy-website/`** | Le « quoi » spécifique au projet : faits (fondée 2018, prix 5 800 € HT, SIREN…), conventions bilingues, terminologie (Loisirs/Maillage, pas de « K2000 »), contraintes du chatbot, pipeline 3D, workflow de déploiement. Évite d'avoir à re-préciser ces règles à chaque session. |
| **`frontend-responsive-perf/`** | Le « comment » technique réutilisable (framework-agnostique) : responsive parfait mobile/tablette/desktop/paysage, alignement des nav/widgets, optimisations CPU/GPU (pause hors-écran des vidéos/animations/3D, recompression média), chatbot léger sans LLM, et la méthodo de vérification en Chrome headless. |

## Activer les skills

Claude Code charge les skills depuis `~/.claude/skills/`. Pour les activer
depuis ce dépôt, copie-les (ou crée des liens symboliques pour qu'ils restent
synchronisés avec le repo) :

```bash
# Copie simple
cp -R skills/skill-nsy-website skills/frontend-responsive-perf ~/.claude/skills/

# …ou liens symboliques (les éditions du repo se répercutent automatiquement)
ln -s "$(pwd)/skills/skill-nsy-website"        ~/.claude/skills/skill-nsy-website
ln -s "$(pwd)/skills/frontend-responsive-perf" ~/.claude/skills/frontend-responsive-perf
```

Chaque skill suit le format standard : un `SKILL.md` (frontmatter `name` +
`description` qui pilote le déclenchement) et un dossier `references/` pour le
détail.
