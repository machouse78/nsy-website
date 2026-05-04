import { getFormattedExperience, getExperienceDescription, calculateStats } from '../utils/dateUtils'

export const siteContent = {
  // Informations générales
  company: {
    name: "NSY",
    tagline: "Expert en Intelligence Artificielle et Solutions Numériques",
    description: "Accompagnement personnalisé dans votre transformation numérique avec l'expertise de Cédric Barme, développeur full-stack et spécialiste IA.",
    founder: "Cédric Barme",
    experience: getFormattedExperience(), // Dynamique: "14+" en 2024, "15+" en 2025, etc.
    specialty: "Chef de projet technique / Lead Dev Full Stack"
  },

  // Contact
  contact: {
    email: "cedric.barme@nsy.fr",
    phone: "06 72 94 71 06",
    linkedin: "https://www.linkedin.com/in/cédric-barme/",
    availability: "Lundi au vendredi, 9h00 - 18h00"
  },

  // Navigation
  navigation: [
    { name: "Accueil", href: "#home", current: true },
    { name: "À propos", href: "#about", current: false },
    { name: "Services", href: "#services", current: false },
    { name: "IA & Innovation", href: "#ai", current: false },
    { name: "Méthodes", href: "#methods", current: false },
    { name: "Construction", href: "#construction", current: false },
  ],

  // Hero section
  hero: {
    title: "Transformez vos idées en solutions numériques innovantes",
    subtitle: "Expert indépendant en développement, intelligence artificielle et automatisation",
    description: `${getExperienceDescription()}, j'accompagne les entreprises dans leur transition numérique en créant des solutions sur-mesure, performantes et évolutives.`,
    cta: {
      primary: "Discuter de votre projet",
      secondary: "Découvrir mes services"
    },
    highlights: [
      `${getFormattedExperience()} années d'expertise`,
      "Solutions Full-Stack",
      "Spécialiste IA & Automatisation",
      "Accompagnement personnalisé"
    ]
  },

  // À propos
  about: {
    title: "À propos de NSY",
    subtitle: "L'expertise au service de votre innovation",
    description: `Bonjour, je m'appelle Cédric Barme et je suis passionné par les technologies numériques depuis plus de ${getFormattedExperience().replace('+', '')} ans. Issu d'un cursus universitaire en informatique avec un Master en répartition et aide à la décision, j'ai accompagné de nombreuses entreprises dans leur transformation digitale.`,
    mission: "Ma mission est de démocratiser l'accès aux technologies avancées en proposant des solutions sur-mesure, alliant expertise technique et compréhension métier.",
    vision: "Dans un monde en constante évolution, je crois fermement que l'intelligence artificielle et l'automatisation sont les clés d'une entreprise plus efficace et compétitive.",
    values: [
      {
        title: "Excellence technique",
        description: "Des solutions robustes et évolutives utilisant les dernières technologies",
        icon: "Code"
      },
      {
        title: "Accompagnement personnalisé", 
        description: "Une approche sur-mesure adaptée à vos besoins spécifiques",
        icon: "Users"
      },
      {
        title: "Innovation continue",
        description: "Intégration des dernières avancées en IA et automatisation",
        icon: "Lightbulb"
      },
      {
        title: "Qualité garantie",
        description: "Respect des délais, tests rigoureux et maintenance assurée",
        icon: "Shield"
      }
    ]
  },

  // Services
  services: {
    title: "Mes services",
    subtitle: "Solutions complètes pour votre transformation numérique",
    list: [
      {
        title: "Développement Full-Stack",
        description: "Applications web modernes avec React, Node.js, Java EE. Interface utilisateur intuitive et backend robuste pour des solutions complètes et performantes.",
        technologies: ["React", "Java EE", "Node.js", "TypeScript", "PostgreSQL"],
        icon: "Code",
        color: "from-primary-500 to-primary-700"
      },
      {
        title: "Intelligence Artificielle",
        description: "Intégration d'IA générative, automatisation intelligente, analyse de données. Optimisation de vos processus grâce aux dernières avancées en machine learning.",
        technologies: ["OpenAI", "Machine Learning", "Python", "TensorFlow", "Automation"],
        icon: "Brain",
        color: "from-ai-500 to-ai-700"
      },
      {
        title: "Automatisation & Optimisation",
        description: "Automatisation de vos processus métier, optimisation des workflows, intégration d'outils tiers. Gagnez en productivité et réduisez les tâches répétitives.",
        technologies: ["API Integration", "Workflow", "DevOps", "CI/CD", "Docker"],
        icon: "Zap",
        color: "from-cyber-500 to-cyber-700"
      },
      {
        title: "Conseil & Architecture",
        description: "Audit technique, conception d'architecture, choix technologiques. Définition de la stratégie technique optimale pour vos projets.",
        technologies: ["Architecture", "Consulting", "Technical Audit", "Strategy", "Planning"],
        icon: "Users",
        color: "from-purple-500 to-purple-700"
      },
      {
        title: "Maintenance & Support",
        description: "Maintenance évolutive, support technique, optimisation des performances. Assurance de la pérennité et de l'évolution de vos solutions.",
        technologies: ["Monitoring", "Performance", "Security", "Updates", "Support"],
        icon: "Shield",
        color: "from-green-500 to-green-700"
      },
      {
        title: "Formation & Accompagnement",
        description: "Formation de vos équipes, transfert de compétences, accompagnement dans l'adoption de nouvelles technologies et méthodes agiles.",
        technologies: ["Training", "Mentoring", "Agile", "Scrum", "Knowledge Transfer"],
        icon: "GraduationCap",
        color: "from-orange-500 to-orange-700"
      }
    ]
  },

  // IA & Innovation
  ai: {
    title: "IA & Innovation",
    subtitle: "L'intelligence artificielle au service de votre business",
    description: "NSY vous accompagne dans l'intégration de l'intelligence artificielle pour optimiser vos processus, automatiser vos tâches répétitives et créer de nouvelles opportunités business.",
    features: [
      {
        title: "IA Générative",
        description: "Intégration de solutions d'IA générative pour automatiser la création de contenu, l'assistance client et l'analyse de données.",
        benefits: ["Gain de temps significatif", "Qualité constante", "Scalabilité"],
        icon: "Sparkles"
      },
      {
        title: "Automatisation Intelligente",
        description: "Mise en place de workflows automatisés qui s'adaptent et apprennent de vos processus métier.",
        benefits: ["Réduction des erreurs", "Optimisation continue", "ROI mesurable"],
        icon: "Bot"
      },
      {
        title: "Analyse Prédictive",
        description: "Exploitation de vos données pour prédire les tendances et optimiser vos décisions business.",
        benefits: ["Anticipation des besoins", "Optimisation des ressources", "Avantage concurrentiel"],
        icon: "TrendingUp"
      },
      {
        title: "Interfaces Conversationnelles",
        description: "Chatbots et assistants virtuels pour améliorer l'expérience utilisateur et l'efficacité opérationnelle.",
        benefits: ["Support 24/7", "Expérience personnalisée", "Réduction des coûts"],
        icon: "MessageSquare"
      }
    ]
  },

  // Méthodes de travail
  methods: {
    title: "Ma méthode de travail",
    subtitle: "Un processus éprouvé pour garantir le succès de vos projets",
    description: `Forte de ${getFormattedExperience().replace('+', '')} années d'expérience, ma méthodologie combine les meilleures pratiques agiles avec une approche personnalisée adaptée à chaque client.`,
    steps: [
      {
        number: "01",
        title: "Analyse & Définition",
        description: "Compréhension approfondie de vos besoins, analyse de l'existant et définition des objectifs précis.",
        details: ["Audit technique", "Recueil des besoins", "Définition du scope", "Estimation des ressources"],
        icon: "Search",
        duration: "1-2 semaines"
      },
      {
        number: "02", 
        title: "Conception & Planification",
        description: "Élaboration de l'architecture technique, choix des technologies et planification détaillée du projet.",
        details: ["Architecture système", "Choix technologiques", "Planning détaillé", "Validation des spécifications"],
        icon: "PenTool",
        duration: "1-3 semaines"
      },
      {
        number: "03",
        title: "Développement Agile",
        description: "Développement itératif avec des livraisons régulières et feedback continu pour s'adapter à vos besoins.",
        details: ["Sprints courts", "Livraisons fréquentes", "Tests continus", "Feedback régulier"],
        icon: "Code",
        duration: "Selon projet"
      },
      {
        number: "04",
        title: "Tests & Validation",
        description: "Tests exhaustifs, validation fonctionnelle et technique avant la mise en production.",
        details: ["Tests unitaires", "Tests d'intégration", "Validation utilisateur", "Tests de performance"],
        icon: "CheckCircle",
        duration: "1-2 semaines"
      },
      {
        number: "05",
        title: "Déploiement & Formation",
        description: "Mise en production sécurisée, formation des équipes et transfert de compétences.",
        details: ["Déploiement progressif", "Formation utilisateurs", "Documentation", "Transfert de connaissances"],
        icon: "Rocket",
        duration: "1 semaine"
      },
      {
        number: "06",
        title: "Maintenance & Évolution",
        description: "Support technique, maintenance évolutive et accompagnement dans la croissance de votre solution.",
        details: ["Support technique", "Maintenance évolutive", "Optimisations", "Nouvelles fonctionnalités"],
        icon: "Settings",
        duration: "Continue"
      }
    ]
  },

  // Compétences techniques
  skills: {
    frontend: ["React", "TypeScript", "Next.js", "Vue.js", "Angular", "Tailwind CSS"],
    backend: ["Java EE", "Node.js", "Python", "Spring Boot", "Express.js", "REST APIs"],
    database: ["PostgreSQL", "MySQL", "Oracle", "MongoDB", "Redis"],
    ai: ["OpenAI API", "Machine Learning", "TensorFlow", "Python AI", "Automation"],
    devops: ["Docker", "CI/CD", "Git", "Linux", "Cloud Platforms"],
    methodologies: ["Scrum", "Agile", "DevOps", "TDD", "Code Review"]
  },

  // Statistiques (calculées dynamiquement)
  get stats() {
    const calculatedStats = calculateStats()
    return [
      { label: "Années d'expérience", value: calculatedStats.experience, icon: "Calendar" },
      { label: "Technologies maîtrisées", value: calculatedStats.technologies, icon: "Code" },
      { label: "Clients accompagnés", value: calculatedStats.clients, icon: "Users" },
      { label: "Expertise", value: calculatedStats.expertise, icon: "Zap" }
    ]
  },

  // Témoignages (fictifs basés sur l'expérience)
  testimonials: [
    {
      name: "Direction Technique",
      company: "Entreprise de Services",
      content: "Cédric a su nous accompagner efficacement dans la modernisation de notre système d'information. Son expertise technique et sa capacité d'adaptation nous ont permis de réussir notre transition.",
      rating: 5
    },
    {
      name: "Chef de Projet",
      company: "Secteur Financier", 
      content: "Un développeur full-stack exceptionnel. La qualité du code et le respect des délais ont été remarquables. Je recommande vivement NSY pour vos projets critiques.",
      rating: 5
    }
  ],

  // Construction du site
  construction: {
    title: "Construction du site",
    subtitle: "Transparence sur le processus de création assistée par IA",
    description: "Dans un souci de transparence et d'innovation, NSY révèle les coulisses de la création de ce site web, réalisé grâce aux dernières avancées en intelligence artificielle.",
    details: {
      ide: {
        name: "Cursor",
        description: "IDE révolutionnaire intégrant l'IA au cœur du développement",
        version: "0.43+",
        features: [
          "Autocomplétion intelligente basée sur l'IA",
          "Génération de code contextuelle",
          "Refactoring automatique",
          "Chat intégré avec l'assistant IA"
        ]
      },
      ai: {
        name: "Claude",
        model: "Claude 4 Sonnet (20250522)",
        provider: "Anthropic via OpenRouter",
        description: "Assistant IA de nouvelle génération spécialisé dans le développement",
        capabilities: [
          "Génération de code ReactJS avancé",
          "Architecture et conception de projets",
          "Optimisation des performances",
          "Intégration des meilleures pratiques",
          "Documentation automatique"
        ]
      },
      timeline: {
        totalTime: "~2 heures",
        phases: [
          {
            phase: "Analyse & Planning",
            duration: "15 minutes",
            description: "Analyse du site existant NSY.fr et définition de l'architecture"
          },
          {
            phase: "Configuration & Structure",
            duration: "20 minutes", 
            description: "Setup Vite, Tailwind, structure des dossiers et configuration"
          },
          {
            phase: "Développement des composants",
            duration: "60 minutes",
            description: "Création des composants React, sections et logique métier"
          },
          {
            phase: "Design & Animations",
            duration: "30 minutes",
            description: "Intégration Framer Motion, effets visuels et responsive design"
          },
          {
            phase: "Optimisation & Déploiement",
            duration: "15 minutes",
            description: "Configuration Infomaniak, .htaccess et optimisations"
          }
        ]
      },
      promptKeys: [
        {
          key: "Analyse du contexte",
          description: "Récupération et analyse du contenu existant de NSY.fr pour préserver l'identité"
        },
        {
          key: "Identité visuelle IA",
          description: "Design moderne orienté intelligence artificielle avec couleurs tech (bleu, cyan, violet)"
        },
        {
          key: "Architecture ReactJS",
          description: "Structure modulaire avec Vite, Tailwind CSS et Framer Motion pour les animations"
        },
        {
          key: "Compatibilité Infomaniak",
          description: "Build statique sans serveur Node.js, configuration .htaccess pour hébergement mutualisé"
        },
        {
          key: "Performance & SEO",
          description: "Optimisations avancées : code splitting, lazy loading, compression, cache"
        },
        {
          key: "Responsive design",
          description: "Interface adaptative pour mobile, tablette et desktop avec approche mobile-first"
        },
        {
          key: "Contenu enrichi",
          description: "Reformulation professionnelle du contenu original avec focus sur l'expertise IA"
        },
        {
          key: "Mentions transparentes",
          description: "Intégration élégante des mentions IA/Cursor/Claude dans l'identité du site"
        }
      ],
      techStack: {
        frontend: ["React 18", "Vite 4", "Tailwind CSS 3", "Framer Motion 10"],
        tools: ["Cursor IDE", "Claude AI", "Git", "NPM"],
        deployment: ["Static Build", "Infomaniak Hosting", ".htaccess"],
        performance: ["Code Splitting", "Tree Shaking", "Gzip Compression", "Browser Caching"]
      }
    },
    philosophy: "Cette approche de développement assisté par IA représente l'avenir de la création web : rapidité, qualité et innovation au service de l'excellence technique.",
    
    // Prompt complet et ressources
    fullPrompt: {
      title: "Prompt complet de génération",
      description: "Voici l'intégralité du prompt utilisé pour créer ce site avec l'IA Claude :",
      content: `PROMPT COMPLET - CRÉATION SITE NSY (Synthèse avec améliorations)

Je suis le propriétaire du site https://NSY.fr. Je souhaite recréer entièrement ce site sous forme d'un nouveau site web moderne, élégant et professionnel, généré en ReactJS.

OBJECTIF PRINCIPAL :
Créer un site web moderne pour NSY (Cédric Barme), expert indépendant en développement et intelligence artificielle, en récupérant et enrichissant le contenu existant de NSY.fr.

CONTRAINTES TECHNIQUES :
- ReactJS avec Vite (pas Next.js SSR)
- Code propre, structuré, maintenable
- Compatible hébergement Infomaniak (statique, FTP/SFTP)
- Architecture modulaire avec composants réutilisables
- Tailwind CSS + Framer Motion pour animations
- Fichier .htaccess pour compatibilité React Router
- Build optimisé dans dist/ 

IDENTITÉ VISUELLE ET CHARTE COULEUR :
- Utiliser le logo NSY existant : http://nsy.fr/wp-content/uploads/2019/05/cropped-NSY-logo-1.png
- Charte couleur basée sur les couleurs du logo NSY (orange, rouge, doré)
- Logo agrandi sans fond blanc, avec effets spéciaux au survol
- Thème sombre avec dégradés élégants
- Design orienté IA/technologie avec effets lumineux subtils
- Typographie moderne et lisible

CONTENU ET DONNÉES DYNAMIQUES :
- Cédric Barme : Expérience calculée automatiquement depuis 2012 (14 ans en 2026, 15 ans en 2027, etc.)
- 2 clients accompagnés (approche qualité plutôt que volume)
- 20+ technologies maîtrisées (valeur fixe)
- Focus expertise Full-Stack + Intelligence Artificielle
- Contact : cedric.barme@nsy.fr, 06 72 94 71 06
- LinkedIn : https://www.linkedin.com/in/cédric-barme/

STRUCTURE DU SITE :
1. Header : Logo NSY agrandi + "AI & Digital Solutions" + Navigation épurée + "Me contacter" (supprimer "Contact" redondant)
2. Hero : Titre principal + Animation typing + Statistiques réalistes + Badge IA transparence (supprimer badge "Disponible pour projets")
3. À propos : Profil Cédric + 14 ans expérience + Valeurs + Compétences
4. Services : 6 services en cards (Full-Stack, IA, Automatisation, Conseil, Maintenance, Formation)
5. IA & Innovation : Section dédiée expertise IA + Bénéfices + Use cases
6. Méthodes : Processus 6 étapes + Timeline + Méthodologie agile
7. Construction : Transparence totale sur création IA + Prompt complet + Liens GitHub/LinkedIn
8. Contact : Formulaire + Informations + Engagement qualité
9. Footer : Logo + Description + Mention IA obligatoire + Copyright dynamique

FONCTIONNALITÉS SPÉCIALES :
- ChatBot IA intégré avec réponses contextuelles  
- Animation interactive du logo NSY en Hero section (visible dès le chargement)
- Effets magnétiques au survol : particules attirées vers la souris comme un aimant
- Changement de couleur des neurones : orange/doré → bleu NSY au survol
- Logo NSY agrandi et réactif avec animations de respiration
- Effets spéciaux sur le logo header (brillance, rotation, particules dorées)
- Animations Framer Motion fluides sur tous les composants
- ScrollToTop automatique et navigation smooth entre sections

DESIGN ET UX :
- Responsive parfait (mobile-first)
- Performance optimisée (code splitting, lazy loading)
- SEO optimisé avec meta tags
- Glassmorphisme pour les cards
- Dégradés orange/rouge/doré basés sur le logo
- Animation Canvas 60 FPS du logo NSY avec 50 particules IA interactives
- Effet magnétique au survol : particules attirées vers souris + changement couleur bleu
- Logo NSY agrandi (192px desktop, 160px mobile) au centre de l'animation
- Réseaux neuronaux dynamiques entre particules avec connexions intelligentes
- Espacement équilibré entre tous les éléments
- Bouton "Découvrir" bien séparé des statistiques

MENTIONS ET TRANSPARENCE :
- Section "Construction" détaillant le processus IA
- Prompt complet visible et copiable  
- Chronologie de développement (~2 heures)
- Outils utilisés : Cursor IDE + Claude AI
- Badge transparence dans Hero section
- Mention Footer : "Développé en collaboration avec l'IA • Cursor IDE + Claude Assistant • Transparence totale"

CHATBOT IA INTÉGRÉ :
- Assistant IA flottant en bas à droite
- Réponses contextuelles sur services, IA, tarifs, contact
- Design NSY avec couleurs du logo
- Interface moderne avec animations
- Simulation typing réaliste
- Suggestions rapides

OPTIMISATIONS SPÉCIFIQUES :
- Logo NSY intégré sans fond blanc avec effets dorés
- Suppression éléments redondants (badge disponibilité, texte NSY duplicate, liens légaux)
- Navigation épurée et logique
- Statistiques dynamiques calculées automatiquement (expérience depuis 2012, technologies fixes à 20+)
- Espacement optimal entre tous les éléments
- Cards simplifiées pour éviter conflits CSS sur les liens externes
- Copyright et expérience auto-incrémentés chaque année

Le site doit démontrer l'expertise NSY en IA/automatisation tout en restant professionnel, authentique et facilement maintenable.`
    },
    
    // Ressources du projet
    resources: {
      title: "Code source et ressources",
      github: {
        url: "https://github.com/machouse78/nsy-website",
        description: "Code source complet du projet NSY disponible sur GitHub",
        features: [
          "Code ReactJS complet avec Vite",
          "Configuration Tailwind CSS personnalisée",
          "Composants réutilisables et modulaires",
          "Animations Framer Motion",
          "Configuration déploiement Infomaniak",
          "Documentation complète du projet"
        ]
      },
      linkedin: {
        url: "https://www.linkedin.com/in/cédric-barme/",
        description: "Profil professionnel de Cédric Barme sur LinkedIn",
        highlights: [
          "14+ années d'expérience en développement",
          "Expert Full-Stack et Intelligence Artificielle",
          "Spécialiste React, Java EE, automatisation",
          "Accompagnement personnalisé d'entreprises",
          "Veille technologique et innovation continue"
        ]
      },
      technologies: [
        "ReactJS 18 + Vite 4",
        "Tailwind CSS 3 + PostCSS",
        "Framer Motion 10",
        "Lucide React (icônes)",
        "Configuration ESM moderne"
      ]
    }
  },

  // Footer
  footer: {
    aiMention: "Développé en collaboration avec l'IA • Cursor IDE + Claude Assistant • Transparence totale",
    copyright: "Copyright © 2024 NSY. Tous droits réservés.",
    links: []
  }
};