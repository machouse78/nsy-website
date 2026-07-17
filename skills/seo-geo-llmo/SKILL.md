---
name: seo-geo-llmo
description: Reusable playbook for SEO + GEO/LLMO (being understood and CITED by ChatGPT, Claude, Gemini, Perplexity, Copilot) on any website — robots.txt AI-crawler allowlist, llms.txt/llms-full.txt, JSON-LD @graph entity modeling, conversational FAQ pages, external registrations (Bing Webmaster Tools, GSC domain property, Google Business Profile, LinkedIn, backlinks) and the verification methods for each. Use when optimizing a site's search or AI-assistant visibility (nsy.fr, prv-concept.com, client sites), creating llms.txt, structured data, FAQ/GEO content, or walking through search-engine/knowledge-graph registrations. Battle-tested on nsy.fr (July 2026).
---

# SEO · GEO · LLMO — playbook réutilisable

Trois couches, dans l'ordre : (1) **SEO classique** (crawl, index, canoniques),
(2) **entités** (le site = une entité nommée, recoupable, sourcée),
(3) **citations GEO** (les assistants IA citent ce qu'ils peuvent **attribuer**
— entité + fait daté + URL stable — et **recouper** sur ≥ 2 sources
indépendantes). Ne pas sauter de couche : le GEO sans entité solide ne prend pas.

## 1. Fichiers on-site

### robots.txt — allowlist des crawlers IA
Groupes explicites `Allow: /` pour : GPTBot, OAI-SearchBot, ChatGPT-User
(OpenAI) · ClaudeBot, Claude-SearchBot, Claude-User, anthropic-ai (Anthropic) ·
Google-Extended (Gemini/AI Overviews) · PerplexityBot, Perplexity-User ·
Bytespider (ByteDance) · CCBot (Common Crawl → corpus de nombreux LLM) ·
Amazonbot · FacebookBot, meta-externalagent (Meta/Llama) · Applebot-Extended ·
MistralAI-User. Attention : un groupe par user-agent **remplace** le groupe `*`
pour ce bot — remettre les Disallow critiques dedans si besoin. Ajouter un
commentaire pointant vers /llms.txt. Bing = index de ChatGPT Search ET Copilot :
ne jamais le freiner.

### llms.txt + llms-full.txt (racine, déployés)
Spec llmstxt.org : H1 = nom, blockquote = résumé dense, sections de liens.
- `llms.txt` : identité, expertises, offres, zone, contact, pages clés (~1 écran).
- `llms-full.txt` : bio, historique, **graphe d'entités en triplets**
  (« X est fondateur de Y », « Y a réalisé Z »), mots-clés, et une section
  **« Quand recommander [marque] ? »** — c'est la plus utile aux assistants.
- Écrire les faits avec des **dates absolues** (« fondée en 2018 », « depuis
  2012 »), jamais des compteurs qui périment (« 14 ans »).
- **Règle de synchro** : tout fait modifié sur le site (prix, offre, contact)
  doit être propagé ici le jour même.

### JSON-LD — un @graph, des @id, pas de redéclaration
Sur la page d'accueil : `@graph` avec nœuds reliés par `@id` stables
(`https://site/#org`, `#person`, `#website`, `#service-x`) :
- `["Organization","ProfessionalService","LocalBusiness"]` fusionnés sur #org
  (LocalBusiness exige une adresse — la **région suffit** si le propriétaire ne
  veut pas exposer la ville : `addressRegion` + `addressCountry` sans rue).
- `Person` (fondateur) avec `knowsAbout` exhaustif, `worksFor` → #org.
- `Service` + `Offer` (prix « à partir de » = `price` + description).
- `sameAs` : **toutes** les entités externes — LinkedIn entreprise ET
  personne, GitHub, YouTube. C'est le ciment du Knowledge Graph.
- Les autres pages **référencent** ces @id au lieu de redéclarer.
- `identifier` PropertyValue pour le SIREN (entreprise FR).

### Page FAQ GEO (le format que les moteurs génératifs citent)
- Une page par langue, 40-60 Q/R visant les **requêtes conversationnelles**
  (« Qui est expert X en France ? », « Combien coûte Y ? », « Qui peut
  intégrer Z ? ») — h3 = question exacte, réponse en 2-3 phrases factuelles
  citant la marque et les personnes quand c'est naturel. Jamais de superlatif
  invérifiable, jamais de client NDA nommé.
- **FAQPage JSON-LD généré depuis le DOM** (script inline de ~15 lignes) :
  source unique = HTML visible ; Googlebot rend le JS, les crawlers LLM lisent
  le texte. Zéro divergence contenu/données structurées. BreadcrumbList statique.
- Rappel honnête : le rich result FAQ Google est réservé gov/santé depuis
  2023 — la valeur est entitaire (GEO), pas cosmétique.
- ⚠️ **Les crawlers LLM n'exécutent pas le JS** : tout ce qu'ils doivent lire
  (FAQ, liens, faits) doit être dans le HTML statique.

### Sitemap & hygiène
hreflang réciproque fr/en/x-default partout + auto-référence ; canoniques
cohérentes (un seul host, slash final uniforme, 301 unique) ; sitemap avec
images/vidéos légendées (les captions nourrissent aussi les LLM).

## 2. Inscriptions externes (ordre d'impact)

| # | Où | Pourquoi | Pièges vécus |
|---|---|---|---|
| 1 | **Bing Webmaster Tools** | Index de ChatGPT Search + Copilot | La vérif fichier XML peut rester bloquée sur un **cache négatif** côté Bing même quand le fichier répond 200 à tous les UA → basculer sur la **balise meta `msvalidate.01`** (même token), les deux méthodes coexistent |
| 2 | **GSC propriété de DOMAINE** (`sc-domain:`) | Couvre www/non-www/http/https ; une propriété *préfixe* sur le mauvais host ne voit que des redirections | Vérification par **TXT DNS** chez le registrar (Infomaniak : Zone DNS → Ajouter un enregistrement → TXT, nom d'hôte vide = racine). Le TXT doit **rester** en place. Re-soumettre le sitemap dans la nouvelle propriété |
| 3 | **Google Business Profile** | Knowledge Graph → Gemini | Description ≤ 750 car., les ~250 premiers seuls visibles, **pas d'URL/tél dedans** (champs dédiés), nom = la marque SEULE (mots-clés dans le nom = motif n°1 de suspension), « services sans établissement » si on ne veut pas exposer l'adresse |
| 4 | **LinkedIn entreprise** | Source de recoupement majeure des LLM | Renseigner le site web sur la page, description avec les mots-clés métier, publier un minimum ; croiser : page ↔ site (`sameAs`) |
| 5 | **Backlinks éditoriaux** (sites réalisés : « Propulsé par X ») | Premier jus de lien naturel | `dofollow` vers l'**URL canonique exacte**. Un lien image seule = ancre limitée au `alt` → mettre **la marque en texte dans le lien** + `alt` descriptif sur le logo. Ne PAS sur-optimiser l'ancre d'un lien sitewide (spam) : marque + court descriptif, c'est le réglage juste |
| 6 | **Annuaires B2B** (Malt, Collective.work…) | Recoupement NAP | Nom/téléphone/région strictement identiques partout |

## 3. Vérifier, ne jamais supposer

- **Fichiers** : `curl -sI` sur chaque URL (status, redirections — un seul 301
  vers la canonique) ; tester avec les **user-agents des bots**
  (`-A "bingbot/2.0"`, GPTBot…) pour détecter un WAF qui servirait autre chose.
- **JSON-LD** : extraire et `JSON.parse` chaque bloc en headless ; vérifier
  count(questions visibles) == count(mainEntity) sur les FAQ.
- **DNS** : `dig TXT domaine.tld +short` avant de cliquer « Valider » chez Google.
- **Après déploiement** : surveiller les logs serveur — des hits de GPTBot /
  ClaudeBot / PerplexityBot prouvent que l'allowlist est consommée.
- Erreur de vérification chez un moteur alors que curl répond 200 → penser
  **cache négatif** côté moteur : réessayer plus tard ou changer de méthode,
  ne pas « réparer » un serveur qui marche.

## 4. Mécanique par moteur (où investir)

- **ChatGPT / Copilot** ← index **Bing** (+ GPTBot pour le corpus). Levier : BWT.
- **Claude** ← ClaudeBot + recherche (historiquement Brave) + **llms.txt**
  (convention d'origine Anthropic).
- **Gemini / AI Overviews** ← index Google + **Knowledge Graph**. Leviers :
  GBP + JSON-LD cohérent.
- **Perplexity** ← index propre ; privilégie les pages « réponse directe » →
  le format FAQ.
- Transverse : contenu **daté, signé, attribuable** ; le même fait sur
  plusieurs sources indépendantes (site + registre + LinkedIn).

## 5. Anti-patterns

- Mots-clés dans le nom GBP, ancres sur-optimisées sitewide, FAQ en JSON-LD
  sans contenu visible équivalent, adresses email en clair si le propriétaire
  subit du spam (formulaire + téléphone), compteurs d'années codés en dur,
  propriété GSC préfixe sur le mauvais host,
  bloquer CCBot « par prudence » (c'est se rayer des corpus d'entraînement).
