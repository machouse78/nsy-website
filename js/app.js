// NSY Website - Real Video Implementation (Apple Style)

// Global variables
let lenis;

// DOM Elements
const loader = document.getElementById('loader');
const loaderBar = document.querySelector('.loader-fill');
const loaderPercent = document.getElementById('loader-percent');
const heroVideo = document.getElementById('hero-video');
const scrollContainer = document.getElementById('scroll-container');
const videoHero = document.querySelector('.video-hero');
const darkOverlay = document.getElementById('dark-overlay');

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initLenis();
    initRandomVideoSelection();
    initVideoHandling();
    initHeroAnimations();
});

// Random video selection
function initRandomVideoSelection() {
    const videos = ['video.mp4', 'video2.mp4', 'video3.mp4'];
    const randomIndex = Math.floor(Math.random() * videos.length);
    const selectedVideo = videos[randomIndex];
    
    console.log(`Loading random video: ${selectedVideo}`);
    
    if (heroVideo) {
        // Update video source with random selection
        const source = heroVideo.querySelector('source');
        if (source) {
            source.src = `public/${selectedVideo}`;
            heroVideo.load(); // Reload video with new source
        }
    }
}

// 1. LENIS SMOOTH SCROLL (MANDATORY selon skill)
function initLenis() {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true
    });
    
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
}

// 2. VIDEO HANDLING with fade-out effect
function initVideoHandling() {
    if (heroVideo) {
        let videoDuration = 0;
        let fadeStartTime = 0;
        
        // Ensure video plays (Apple style - autoplay on load)
        heroVideo.addEventListener('loadedmetadata', () => {
            videoDuration = heroVideo.duration;
            fadeStartTime = videoDuration - 0.5; // Start fade 0.5 seconds before end
            
            heroVideo.play().catch(e => {
                console.log('Autoplay prevented:', e);
                showVideoPlayButton();
            });
        });

        // Monitor video time for speed fade-out effect only
        heroVideo.addEventListener('timeupdate', () => {
            const currentTime = heroVideo.currentTime;
            
            if (currentTime >= fadeStartTime && currentTime < videoDuration) {
                // Calculate fade progress (0 to 1 over 0.5 seconds)
                const fadeProgress = (currentTime - fadeStartTime) / 0.5;
                
                // Smooth easing function for more natural feel
                const easedProgress = 1 - Math.pow(1 - fadeProgress, 3); // Cubic ease-out
                
                // Apply ONLY speed slow-motion effect using playbackRate
                const targetRate = 1 - (easedProgress * 0.7); // Slow down to 30% of original speed
                heroVideo.playbackRate = Math.max(0.3, targetRate);
                
            } else if (currentTime < fadeStartTime) {
                // Reset to normal speed if before fade zone
                heroVideo.playbackRate = 1;
            }
        });

        // Video ends (no loop like Apple)
        heroVideo.addEventListener('ended', () => {
            console.log('Video ended with speed fade-out effect');
            // Video stays on last frame at slow speed
        });

        // Hide loader when video is ready
        heroVideo.addEventListener('canplaythrough', () => {
            hideLoader();
        });
    }
}

function showVideoPlayButton() {
    // Create a play button overlay if autoplay fails
    const playButton = document.createElement('div');
    playButton.innerHTML = `
        <button class="video-play-btn">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <circle cx="30" cy="30" r="30" fill="rgba(0,0,0,0.7)"/>
                <path d="M23 18l14 12-14 12V18z" fill="white"/>
            </svg>
        </button>
    `;
    playButton.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 100;
        cursor: pointer;
    `;
    
    videoHero.appendChild(playButton);
    
    playButton.addEventListener('click', () => {
        heroVideo.play();
        playButton.remove();
    });
}

function hideLoader() {
    // Hide loader when video is ready
    setTimeout(() => {
        loader.classList.add('loader-hidden');
        startExperience();
    }, 500);
}

// Video handling replaces canvas rendering

// 6. START EXPERIENCE
function startExperience() {
    initSectionAnimations();
    initCounters();
    initMarquees();
    initDarkOverlay();
    
    // Start hero animations immediately
    initHeroAnimations();
    
    // Initialize navigation
    initNavigation();
}

// Video plays automatically, no frame binding needed

// 8. HERO ANIMATIONS - Content under video
function initHeroAnimations() {
    const heroTagline = document.querySelector('.hero-tagline');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const sectionLabel = document.querySelector('.content-hero .section-label');
    
    // Animate content under video with delay
    gsap.to(sectionLabel, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        delay: 1.0
    });
    
    gsap.to(heroTagline, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        delay: 1.2
    });
    
    gsap.to(scrollIndicator, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
        delay: 1.6
    });
}

// No hero transition needed - video is immediately visible

// 10. SECTION ANIMATION SYSTEM selon skill
function initSectionAnimations() {
    const sections = document.querySelectorAll('.scroll-section');
    
    sections.forEach(section => {
        setupSectionAnimation(section);
        positionSection(section);
    });
}

function positionSection(section) {
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    const midpoint = (enter + leave) / 2;
    
    // Position at midpoint with translateY(-50%)
    section.style.top = (midpoint * 100) + '%';
    section.style.transform = 'translateY(-50%)';
}

function setupSectionAnimation(section) {
    const type = section.dataset.animation;
    const persist = section.dataset.persist === "true";
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;
    
    const children = section.querySelectorAll(
        ".section-label, .section-heading, .section-body, .section-note, .contact-info, .service-list, .stat"
    );
    
    // Force formulaire visibility for contact section
    if (section.id === 'contact') {
        const form = section.querySelector('.contact-form');
        const submitBtn = section.querySelector('.form-submit');
        if (form) {
            form.style.opacity = '1';
            form.style.visibility = 'visible';
        }
        if (submitBtn) {
            submitBtn.style.opacity = '1';
            submitBtn.style.visibility = 'visible';
            submitBtn.style.display = 'block';
        }
    }

    const tl = gsap.timeline({ paused: true });

    // Different animation types selon skill (4+ types, never repeat)
    switch (type) {
        case "fade-up":
            tl.from(children, { 
                y: 50, 
                opacity: 0, 
                stagger: 0.12, 
                duration: 0.9, 
                ease: "power3.out" 
            });
            break;
        case "slide-left":
            tl.from(children, { 
                x: -80, 
                opacity: 0, 
                stagger: 0.14, 
                duration: 0.9, 
                ease: "power3.out" 
            });
            break;
        case "slide-right":
            tl.from(children, { 
                x: 80, 
                opacity: 0, 
                stagger: 0.14, 
                duration: 0.9, 
                ease: "power3.out" 
            });
            break;
        case "scale-up":
            tl.from(children, { 
                scale: 0.85, 
                opacity: 0, 
                stagger: 0.12, 
                duration: 1.0, 
                ease: "power2.out" 
            });
            break;
        case "rotate-in":
            tl.from(children, { 
                y: 40, 
                rotation: 3, 
                opacity: 0, 
                stagger: 0.1, 
                duration: 0.9, 
                ease: "power3.out" 
            });
            break;
        case "stagger-up":
            tl.from(children, { 
                y: 60, 
                opacity: 0, 
                stagger: 0.15, 
                duration: 0.8, 
                ease: "power3.out" 
            });
            break;
        case "clip-reveal":
            tl.from(children, { 
                clipPath: "inset(100% 0 0 0)", 
                opacity: 0, 
                stagger: 0.15, 
                duration: 1.2, 
                ease: "power4.inOut" 
            });
            break;
    }

    // ScrollTrigger for section animation - Simple approach
    ScrollTrigger.create({
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
            const p = self.progress;
            
            if (p >= enter && p <= leave) {
                const sectionProgress = (p - enter) / (leave - enter);
                section.style.opacity = 1;
                tl.progress(Math.min(sectionProgress * 2, 1));
            } else if (persist && p > leave) {
                section.style.opacity = 1;
                tl.progress(1);
            } else {
                section.style.opacity = 0;
                if (!persist || p < enter) {
                    tl.progress(0);
                }
            }
        }
    });
}

// 11. COUNTER ANIMATIONS
function initCounters() {
    document.querySelectorAll(".stat-number").forEach(el => {
        const target = parseFloat(el.dataset.value);
        const decimals = parseInt(el.dataset.decimals || "0");
        
        ScrollTrigger.create({
            trigger: el.closest(".scroll-section"),
            start: "top 70%",
            end: "bottom 30%",
            scrub: true,
            onUpdate: (self) => {
                const currentValue = target * self.progress;
                el.textContent = decimals === 0 ? Math.round(currentValue) : currentValue.toFixed(decimals);
            }
        });
    });
}

// 12. HORIZONTAL TEXT MARQUEE
function initMarquees() {
    document.querySelectorAll(".marquee-wrap").forEach(el => {
        const speed = parseFloat(el.dataset.scrollSpeed) || -25;
        const marqueeText = el.querySelector(".marquee-text");
        
        gsap.to(marqueeText, {
            xPercent: speed,
            ease: "none",
            scrollTrigger: { 
                trigger: document.body, 
                start: "top top", 
                end: "bottom bottom", 
                scrub: true 
            }
        });
        
        // Show marquee when scrolling past video
        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => {
                el.style.opacity = self.isActive ? 1 : 0;
            }
        });
    });
}

// 13. DARK OVERLAY for stats section
function initDarkOverlay() {
    ScrollTrigger.create({
        trigger: document.querySelector('.section-stats'),
        start: "top center",
        end: "bottom center",
        scrub: true,
        onUpdate: (self) => {
            darkOverlay.style.opacity = self.progress * 0.9;
        }
    });
}

// Navigation functionality
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1); // Remove #
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                // Calculate position accounting for video hero offset and header height
                const elementTop = targetElement.offsetTop;
                const videoHeroHeight = document.querySelector('.video-hero').offsetHeight + 
                                      document.querySelector('.content-hero').offsetHeight;
                const headerHeight = document.querySelector('.site-header').offsetHeight;
                
                // Different buffers for different sections since Expertise works perfectly
                let buffer = 100; // Default buffer
                
                switch(targetId) {
                    case 'concept':     // Concept - nouvelle première section  
                        buffer = 200;   
                        break;
                    case 'about':       // La Société - needs more buffer
                        buffer = 200;   
                        break;
                    case 'services':    // Services - needs more buffer  
                        buffer = 200;   
                        break;
                    case 'contact':     // Contact - needs much more buffer (end of page)
                        buffer = 600;   
                        break;
                    case 'expertise':   // Expertise - perfect as is
                        buffer = 100;   
                        break;
                    default:
                        buffer = 150;   
                }
                
                // Adjust position to show section label and heading properly
                const targetPosition = elementTop + videoHeroHeight - headerHeight - buffer;
                
                // Scroll with Lenis smooth scroll
                if (lenis) {
                    lenis.scrollTo(targetPosition, {
                        duration: 2,
                        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
                    });
                }
            }
        });
    });
}

// Contact Form and Chatbot functionality
document.addEventListener('DOMContentLoaded', () => {
    // Initialize navigation after DOM is loaded
    initNavigation();
    initContactForm();
    initChatbot();
    initFooter();
});

// Footer functionality
function initFooter() {
    // Update copyright year automatically
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
    
    // Make footer navigation links work
    const footerLinks = document.querySelectorAll('.footer-column a');
    footerLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const navLink = document.querySelector(`.nav-links a[href="#${targetId}"]`);
            if (navLink) {
                navLink.click(); // Reuse existing navigation logic
            }
        });
    });
}

// Contact Form Handler
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const name = formData.get('name');
            const email = formData.get('email');
            const subject = formData.get('subject') || 'Nouveau projet';
            const message = formData.get('message');
            
            // Create mailto link
            const mailtoLink = `mailto:contact@nsy.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
                `Bonjour,\n\nNom: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\nCordialement,\n${name}`
            )}`;
            
            window.open(mailtoLink, '_blank');
            
            // Show success message
            showFormSuccess();
        });
    }
}

function showFormSuccess() {
    const submitBtn = document.querySelector('.form-submit');
    const originalText = submitBtn.textContent;
    
    submitBtn.textContent = 'Message envoyé !';
    submitBtn.style.background = '#10b981';
    
    setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.style.background = '';
    }, 3000);
}

// Chatbot IA
function initChatbot() {
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotMessages = document.getElementById('chatbot-messages');
    
    // Toggle chatbot
    chatbotToggle.addEventListener('click', () => {
        chatbotWindow.classList.add('open');
    });
    
    chatbotClose.addEventListener('click', () => {
        chatbotWindow.classList.remove('open');
    });
    
    // Send message
    function sendMessage() {
        const message = chatbotInput.value.trim();
        if (!message) return;
        
        // Add user message
        addMessage(message, 'user');
        chatbotInput.value = '';
        
        // Simulate bot response
        setTimeout(() => {
            const response = getBotResponse(message);
            addMessage(response, 'bot');
        }, 1000);
    }
    
    chatbotSend.addEventListener('click', sendMessage);
    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function addMessage(content, type) {
    const chatbotMessages = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content;
    
    messageDiv.appendChild(messageContent);
    chatbotMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function getBotResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Enriched professional bot responses
    if (message.includes('service') || message.includes('développement')) {
        return "🚀 NSY offre une gamme complète de services technologiques :\n\n• Développement d'applications web et mobile (React, Node.js, Flutter)\n• Intégration d'Intelligence Artificielle (ML, NLP, Computer Vision)\n• Automatisation des processus métier et RPA\n• Conseil en transformation digitale\n• Architecture cloud et DevOps\n\nDans quel domaine souhaitez-vous approfondir ?";
    }
    
    if (message.includes('ia') || message.includes('intelligence') || message.includes('ai') || message.includes('machine learning')) {
        return "🧠 Notre expertise IA est au cœur de notre offre :\n\n• Machine Learning & Deep Learning (TensorFlow, PyTorch)\n• Traitement du langage naturel (NLP) et chatbots intelligents\n• Computer Vision et reconnaissance d'images\n• Automatisation intelligente des processus (RPA + IA)\n• Systèmes de recommandation personnalisés\n• Analyse prédictive et Business Intelligence\n\nAvez-vous un cas d'usage particulier en tête ?";
    }
    
    if (message.includes('prix') || message.includes('coût') || message.includes('tarif') || message.includes('budget')) {
        return "💰 Nos tarifs sont adaptés à chaque projet :\n\n• Audit initial et conseil : Gratuit (1h)\n• Développement web/mobile : À partir de 500€/jour\n• Projets IA : Devis personnalisé selon complexité\n• Forfaits tout inclus pour PME/startups\n• Support et maintenance : Plans flexibles\n\n📞 Contactez-nous pour un devis précis et sans engagement !";
    }
    
    if (message.includes('contact') || message.includes('email') || message.includes('rendez-vous')) {
        return "📧 Contactez NSY facilement :\n\n• Email direct : contact@nsy.fr (réponse < 24h)\n• Formulaire de contact sur cette page\n• Consultation gratuite de 30min disponible\n• Télétravail ou sur site selon vos préférences\n\n🕒 Nous privilégions un premier échange pour comprendre vos enjeux avant tout engagement.";
    }
    
    if (message.includes('expérience') || message.includes('portfolio') || message.includes('référence')) {
        return "🏆 NSY : Plus de 12 ans d'expertise prouvée :\n\n• 50+ projets réalisés (startups, PME, grands comptes)\n• Expertise technique : Full-Stack, Cloud, DevOps, IA\n• Secteurs : E-commerce, Fintech, Santé, Industrie 4.0\n• Certifications : AWS, Google Cloud, Microsoft Azure\n• Méthodologies : Agile, Scrum, DevOps, Design Thinking\n\n📈 Taux de satisfaction client : 98% | Projets livrés dans les délais : 95%";
    }
    
    if (message.includes('technologie') || message.includes('stack') || message.includes('outil')) {
        return "⚙️ Notre stack technologique de pointe :\n\n🎯 Frontend : React, Vue.js, Angular, TypeScript\n🔧 Backend : Node.js, Python, Java, .NET\n☁️ Cloud : AWS, Azure, Google Cloud, Docker, Kubernetes\n🤖 IA/ML : TensorFlow, PyTorch, OpenAI API, Hugging Face\n📱 Mobile : React Native, Flutter, PWA\n🗄️ Databases : PostgreSQL, MongoDB, Redis\n\nQuelle technologie vous intéresse le plus ?";
    }
    
    if (message.includes('méthodologie') || message.includes('processus') || message.includes('méthode')) {
        return "📋 Notre méthodologie éprouvée en 6 étapes :\n\n1. 🎯 Audit & Analyse des besoins\n2. 🏗️ Architecture & Conception technique\n3. 💻 Développement itératif (sprints 2 semaines)\n4. 🧪 Tests & Validation qualité\n5. 🚀 Déploiement & Mise en production\n6. 🔄 Support & Évolutions continues\n\n✨ Approche Agile avec livraisons fréquentes et feedback client constant.";
    }
    
    if (message.includes('équipe') || message.includes('qui') || message.includes('cédric')) {
        return "👨‍💻 L'équipe NSY :\n\n🎖️ Cédric Barme - Fondateur & Lead Developer\n• 12+ ans d'expérience Full-Stack\n• Expert en IA et transformation digitale\n• Ancien consultant grands comptes\n• Passionné d'innovation et nouvelles technologies\n\n🤝 Réseau de partenaires spécialisés selon vos besoins\n📚 Formation continue et veille technologique quotidienne";
    }
    
    if (message.includes('bonjour') || message.includes('salut') || message.includes('hello') || message.includes('bonsoir')) {
        return "👋 Bonjour et bienvenue sur le site NSY !\n\nJe suis votre assistant virtuel, spécialisé en :\n• Renseignements sur nos services IA et développement\n• Information sur nos méthodes et technologies\n• Orientation pour votre projet digital\n• Mise en relation avec notre équipe\n\n💡 Comment puis-je vous accompagner dans votre réflexion ?";
    }
    
    if (message.includes('automatisation') || message.includes('automation') || message.includes('rpa')) {
        return "🔄 Expertise en automatisation NSY :\n\n• RPA (Robotic Process Automation) avec UiPath, Blue Prism\n• Automatisation des workflows métier\n• Intégration API et webhooks\n• Chatbots et assistants virtuels intelligents\n• Automatisation des tests (Selenium, Cypress)\n• CI/CD et déploiement automatisé\n\n⚡ Gains typiques : 60-80% de temps économisé sur les tâches répétitives.";
    }
    
    if (message.includes('web') || message.includes('site') || message.includes('application')) {
        return "💻 Développement web & applications NSY :\n\n🎨 Frontend moderne : React, Vue.js, TypeScript\n🔧 Backend robuste : Node.js, Python, microservices\n📱 Applications mobiles : React Native, Flutter\n🌐 Sites web sur-mesure : E-commerce, corporate, SaaS\n⚡ Performance : PWA, optimisation SEO, Core Web Vitals\n🔒 Sécurité : HTTPS, authentification, protection données\n\nQuel type d'application envisagez-vous ?";
    }
    
    if (message.includes('délai') || message.includes('temps') || message.includes('durée')) {
        return "⏱️ Délais de réalisation NSY :\n\n• Site vitrine : 2-4 semaines\n• Application web complexe : 2-6 mois\n• Projet IA/ML : 1-4 mois selon données\n• Automatisation RPA : 3-8 semaines\n• Audit & conseil : 1-2 semaines\n\n📅 Planning adaptatif avec jalons et livrables intermédiaires. Priorité à la qualité et aux délais convenus.";
    }
    
    // Default response
    return "🤔 Question intéressante ! Pour vous donner une réponse précise et adaptée à votre contexte, je vous recommande :\n\n📧 Contact direct : contact@nsy.fr\n📝 Formulaire de contact (plus bas sur cette page)\n📞 Consultation gratuite de 30min\n\n💡 Notre expertise s'adapte à chaque projet unique. Partagez-nous vos défis, nous trouverons la solution optimale !";
}

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);