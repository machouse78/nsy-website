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
    initVideoHandling();
    initHeroAnimations();
});

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

// 2. VIDEO HANDLING
function initVideoHandling() {
    if (heroVideo) {
        // Ensure video plays (Apple style - autoplay on load)
        heroVideo.addEventListener('loadedmetadata', () => {
            heroVideo.play().catch(e => {
                console.log('Autoplay prevented:', e);
                // Show a play button if autoplay fails
                showVideoPlayButton();
            });
        });

        // Video ends (no loop like Apple)
        heroVideo.addEventListener('ended', () => {
            console.log('Video ended - staying on last frame');
            // Video stays on last frame, doesn't loop
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
        ".section-label, .section-heading, .section-body, .section-note, .cta-button, .contact-info, .service-list, .stat"
    );

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
                    case 'about':       // La Société - needs more buffer
                        buffer = 200;   
                        break;
                    case 'services':    // Services - needs more buffer  
                        buffer = 200;   
                        break;
                    case 'contact':     // Contact - needs much more buffer (end of page)
                        buffer = 400;   
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
});

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
    
    // Simple bot responses based on keywords
    if (message.includes('service') || message.includes('développement')) {
        return "NSY propose des services de développement web, mobile, intégration IA et automatisation. Souhaitez-vous plus d'informations sur un domaine spécifique ?";
    }
    
    if (message.includes('ia') || message.includes('intelligence') || message.includes('ai')) {
        return "Notre expertise en IA couvre : machine learning, automatisation des processus, chatbots, analyse de données et solutions personnalisées. Quel est votre projet ?";
    }
    
    if (message.includes('prix') || message.includes('coût') || message.includes('tarif')) {
        return "Nos tarifs sont personnalisés selon votre projet. Contactez-nous via le formulaire pour un devis gratuit adapté à vos besoins spécifiques.";
    }
    
    if (message.includes('contact') || message.includes('email')) {
        return "Vous pouvez nous contacter à : contact@nsy.fr ou utiliser le formulaire de contact sur cette page. Nous répondons sous 24h !";
    }
    
    if (message.includes('expérience') || message.includes('portfolio')) {
        return "NSY a plus de 12 ans d'expérience en développement et transformation digitale. Nous accompagnons entreprises et startups dans leurs projets technologiques.";
    }
    
    if (message.includes('bonjour') || message.includes('salut') || message.includes('hello')) {
        return "Bonjour ! Ravi de vous rencontrer. Je suis là pour répondre à vos questions sur NSY et nos services. Que puis-je vous expliquer ?";
    }
    
    // Default response
    return "Merci pour votre question ! Pour une réponse personnalisée, n'hésitez pas à nous contacter directement à contact@nsy.fr ou via le formulaire de contact.";
}

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);