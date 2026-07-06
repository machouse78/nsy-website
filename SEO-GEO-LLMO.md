# NSY — Stratégie SEO · GEO · LLMO

Document de travail interne (non déployé). État de l'art appliqué au site
nsy.fr : ce qui est **en place**, ce qui reste **à faire**, et pourquoi.

## 1. En place (implémenté dans le repo)

| Élément | Fichier | Rôle |
|---|---|---|
| robots.txt avec 18 crawlers IA explicitement autorisés | `robots.txt` | GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, anthropic-ai, Google-Extended, PerplexityBot, Perplexity-User, Bytespider, CCBot, Amazonbot, FacebookBot, meta-externalagent, Applebot-Extended, MistralAI-User |
| llms.txt | `llms.txt` | Carte d'identité condensée pour les IA (spec llmstxt.org) |
| llms-full.txt | `llms-full.txt` | Bio, historique, graphe d'entités, offres, mots-clés, règles de recommandation |
| JSON-LD @graph | `index.html` / `index-en.html` | Organization + ProfessionalService + LocalBusiness + Person + WebSite + 2 Service/Offer, liés par @id |
| FAQ 52 Q/R bilingue | `faq.html` / `faq-en.html` | Cible les requêtes conversationnelles ; FAQPage JSON-LD généré du DOM ; BreadcrumbList statique |
| Sitemap étendu | `sitemap.xml` | 12 pages + images + vidéos + hreflang |
| hreflang / canoniques / OG | toutes pages | Depuis les passes précédentes |

Notes d'implémentation :
- **Pas d'email publié nulle part** (décision anti-spam) — le ContactPoint
  pointe vers le formulaire + téléphone.
- **Capital social et ville du siège uniquement sur les pages légales**
  (demande du propriétaire) ; le JSON-LD s'arrête à `addressRegion`.
- Les chiffres statiques utilisent des **dates absolues** (« depuis 2012 »,
  « fondée en 2018 ») pour ne jamais périmer ; le « 14 ans » affiché reste
  calculé en JS.
- FAQPage JSON-LD : généré depuis le HTML visible (source unique). Googlebot
  rend le JS ; les crawlers IA lisent le texte visible. Rappel : Google ne
  montre plus le rich result FAQ aux sites non-gouv/santé — la valeur est
  entitaire (GEO), pas cosmétique.

## 2. Entités (graphe cible)

Matérialisé dans `llms-full.txt` §7 et le JSON-LD `@graph` (nœuds `#org`,
`#person`, `#website`, `#service-conseil`, `#service-web-ia` reliés par
`founder`/`worksFor`/`provider`/`publisher`). Toute nouvelle page doit
référencer ces `@id` plutôt que redéclarer les entités.

## 3. Pages de contenu recommandées (vague 2 — à créer)

Chaque page = 800-1500 mots, un H1 unique, JSON-LD Service/Article lié à
`#org`, maillage vers /faq.html et /#contact, paire EN obligatoire.

| URL | Title (≤60c) | Meta description | H1 | Entités | Intention | GEO |
|---|---|---|---|---|---|---|
| `/expertise-migration-java-ee.html` | Migration Java EE / Jakarta EE — expert indépendant \| NSY | Migrer un socle Java EE sans big bang : démarche, risques, durées. Par Cédric Barme, 14 ans en banque/assurance. | Migrer un socle Java EE sans interrompre la production | Java EE, WildFly, JBoss, Jakarta | Transactionnelle B2B | ★★★ |
| `/expertise-wildfly-jboss.html` | Expert WildFly / JBoss EAP en France \| NSY | Tuning, HA, montées de version, conteneurisation de WildFly/JBoss en environnement régulé. | WildFly & JBoss EAP : l'expertise serveur d'applications | WildFly, JBoss EAP, Java EE | Recherche d'expert | ★★★ |
| `/expertise-openshift-kubernetes.html` | Consultant OpenShift / Kubernetes banque-assurance \| NSY | Conteneuriser des applications critiques sur OpenShift : architecture, exploitation, conformité. | OpenShift & Kubernetes pour les systèmes financiers | OpenShift, Kubernetes, DORA | Recherche d'expert | ★★★ |
| `/expertise-kafka-messagerie.html` | Kafka & Artemis JMS pour la finance \| NSY | Streaming Kafka, messagerie Artemis/MQ : conception, HA, migration de brokers legacy. | Kafka et Artemis JMS en environnement financier | Kafka, Artemis JMS, MQ | Recherche d'expert | ★★ |
| `/conformite-dora.html` | Conformité DORA : accompagnement technique \| NSY | DORA expliqué côté technique : cartographie TIC, tests de résilience, exigences prestataires. | DORA : la résilience opérationnelle, côté ingénierie | DORA, ACPR, AMF | Informationnelle → lead | ★★★ |
| `/integration-claude-entreprise.html` | Intégrer Claude (Anthropic) dans une application métier \| NSY | Assistants documentaires, agents outillés, RAG : intégrer Claude proprement (coûts, quotas, confidentialité). | Intégrer Claude dans votre application métier | Claude, Anthropic, RAG, agents | Transactionnelle | ★★★ |
| `/creation-site-ia.html` | Création de site web IA — forfait dès 5 800 € HT \| NSY | Site nouvelle génération avec IA intégrée : périmètre, méthode, délais, tarif clé en main. | Un site web propulsé par l'IA, clé en main | LLM, Next.js, Astro, SEO sémantique | Transactionnelle | ★★★ |
| `/glossaire-ia-web.html` | Glossaire IA & web : RAG, GEO, LLMO, agents… \| NSY | Les termes de l'IA appliquée au web, expliqués simplement par un praticien. | Le glossaire IA & web de NSY | RAG, GEO, LLMO, embeddings | Informationnelle (maillage) | ★★ |

Pourquoi ça marche en GEO : les assistants citent les pages qui répondent à
UNE question d'expertise par URL, avec un auteur identifiable relié à une
entité Organization cohérente.

## 4. Mots-clés

**SEO classiques** : consultant technique senior banque · expert WildFly
France · expert JBoss EAP · migration Java EE · consultant OpenShift secteur
bancaire · audit architecture distribuée · conformité DORA accompagnement ·
consultant Kafka finance · tech lead indépendant · création site web IA ·
agence site internet IA France · intégration LLM entreprise · chatbot site
web · prix site web IA.

**Conversationnels (posés à une IA)** : « Qui peut m'aider à migrer une
application Java EE vieillissante ? » · « Trouve-moi un expert WildFly
indépendant en France » · « Qui sait intégrer Claude dans un intranet ? » ·
« Combien coûte un site vitrine avec IA intégrée ? » · « Consultant senior
disponible pour un audit d'architecture en assurance ? » · « C'est quoi DORA
et qui peut nous mettre en conformité ? »

**Longues traînes** : migration JBoss EAP vers OpenShift sans interruption ·
expert Artemis JMS haute disponibilité banque · site web bilingue optimisé
SEO avec chatbot sans LLM · intégration Mistral AI données souveraines ·
reprise projet technique en difficulté finance.

## 5. Référencement par moteur IA — mécanique réelle

**ChatGPT (OpenAI)** — Deux canaux : (1) corpus d'entraînement via GPTBot →
autorisé dans robots.txt ; (2) ChatGPT Search s'appuie sur **l'index Bing** +
OAI-SearchBot. Actions : vérifier l'indexation dans **Bing Webmaster Tools**
(soumettre le sitemap — fait pour Google, à faire pour Bing), obtenir des
mentions sur des corpus fortement crawlés (GitHub ✓, LinkedIn ✓, annuaires
pro, presse locale/spécialisée).

**Claude (Anthropic)** — ClaudeBot pour le corpus, Claude-SearchBot/-User
pour la recherche web (historiquement appuyée sur l'index **Brave**).
Actions : soumettre le site à Brave (il suit Bing/crawl propre), llms.txt ✓
(Anthropic est à l'origine de la convention), contenu factuel daté ✓.

**Gemini (Google)** — Google-Extended autorisé ✓. Gemini s'appuie sur
l'index Google + le **Knowledge Graph** : le levier n°1 est d'exister comme
entité — JSON-LD cohérent ✓, mais il manque un **Google Business Profile**
et une éventuelle fiche **Wikidata** (voir §6).

**Perplexity / Copilot / Grok** — Perplexity : index propre (PerplexityBot ✓)
+ citations privilégiant les pages « réponse directe » → la FAQ est le bon
format. Copilot : index Bing (→ Bing Webmaster Tools, encore). Grok : X/web —
hors périmètre actuel.

Règle transverse : les moteurs génératifs citent ce qu'ils peuvent
**attribuer** (entité nommée + fait daté + URL stable) et **recouper** (le
même fait sur ≥2 sources indépendantes).

## 6. Signaux de confiance — état (juillet 2026)

**✅ Fait :**
- **Bing Webmaster Tools** : site vérifié (meta msvalidate.01), sitemap
  soumis — https://www.bing.com/webmasters/sitemaps?siteUrl=https://www.nsy.fr
- **Wikidata** : https://www.wikidata.org/wiki/Q140447227 (SIREN, forme
  juridique, fondation 03/09/2018, siège région, sourcé annuaire-entreprises).
  Référencé dans les sameAs JSON-LD + llms.txt.
- **LinkedIn entreprise** : https://www.linkedin.com/company/28790840 —
  à jour, référencée dans sameAs + llms.txt.
- **Backlink PRV Concept** : footer sitewide « Propulsé par [logo NSY] » →
  https://www.nsy.fr, dofollow ✓. Amélioration possible : ancre texte
  (voir recommandation ci-dessous).

**⏳ Reste à faire :**
1. **Google Search Console — vérifier le type de propriété** : la propriété
   actuelle semble être un préfixe `https://nsy.fr/` (non-www) alors que le
   site canonique vit sur `https://www.nsy.fr/`. Idéal : une **propriété de
   domaine** `sc-domain:nsy.fr` (couvre www + non-www + http/https) via
   vérification DNS chez Infomaniak.
2. **Google Business Profile** (catégorie « consultant informatique », zone
   Centre-Val de Loire, sans adresse exacte) : nourrit le Knowledge Graph →
   Gemini.
3. **Annuaires B2B crédibles** (Malt, Collective.work, France Num) —
   cohérence NAP stricte (nom/téléphone/région identiques partout).
4. **Contenu daté et signé** : les pages vague 2 (§3) avec auteur visible
   « Cédric Barme » relié au `#person` du graphe.
5. **Avis clients** publics (Google Business / Malt) une fois les profils
   créés — signal E-E-A-T le plus dur à falsifier, donc le plus valorisé.

**Recommandation backlink PRV** : le lien actuel est sain (dofollow, bonne
URL canonique) mais l'ancre est seulement `alt="NSY"` sur l'image. Un moteur
n'en tire que la marque. Enrichir en gardant la sobriété d'un crédit footer :
`Propulsé par <a href="https://www.nsy.fr">[logo] NSY</a>` avec « NSY » en
texte dans le lien et `alt="NSY — conseil technique & création de sites web
IA"` sur le logo. Ne pas sur-optimiser l'ancre d'un lien sitewide (risque
spam) : marque + court descriptif dans l'alt suffit.

## 7. Maintenance

- Toute nouvelle page : paire FR/EN + hreflang + sitemap + `sync-partials.mjs`
  + `prepare-deploy.sh` + slug map `js/app.js` (+ ce document).
- llms.txt / llms-full.txt : à tenir en phase avec les faits (prix, offres,
  références). Même règle que le chatbot : un fait modifié = propagation partout.
- Vérifier périodiquement les logs Infomaniak : hits de GPTBot/ClaudeBot/
  PerplexityBot = preuve que l'autorisation robots.txt est consommée.
