// NSY Website - Video-to-Website Implementation
// Combining video-to-website skill + frontend-design skill

// Configuration
const FRAME_COUNT = 150;
const FRAME_SPEED = 2.0; // 1.8-2.2 selon skill
const IMAGE_SCALE = 0.85; // 0.82-0.90 sweet spot

// Global variables
let frames = [];
let currentFrame = 0;
let canvas, ctx;
let bgColor = '#0a0a0a';
let lenis;

// DOM Elements
const loader = document.getElementById('loader');
const loaderBar = document.querySelector('.loader-fill');
const loaderPercent = document.getElementById('loader-percent');
const canvasWrap = document.querySelector('.canvas-wrap');
const scrollContainer = document.getElementById('scroll-container');
const heroSection = document.querySelector('.hero-standalone');
const darkOverlay = document.getElementById('dark-overlay');

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    initLenis();
    preloadFrames();
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

// 2. CANVAS SETUP
function initCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    
    if (frames[currentFrame]) {
        drawFrame(currentFrame);
    }
}

// 3. FRAME PRELOADER - Two-phase loading selon skill
function preloadFrames() {
    let loadedCount = 0;
    
    // Phase 1: Load first 10 frames quickly
    for (let i = 1; i <= Math.min(10, FRAME_COUNT); i++) {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            updateLoader(loadedCount, 10);
            
            if (loadedCount === 10) {
                // Phase 2: Load remaining frames in background
                loadRemainingFrames();
            }
        };
        img.src = `frames/frame_${String(i).padStart(4, '0')}.png`;
        frames[i - 1] = img;
    }
}

function loadRemainingFrames() {
    let remainingLoaded = 0;
    const remainingCount = FRAME_COUNT - 10;
    
    if (remainingCount <= 0) {
        finishLoading();
        return;
    }
    
    for (let i = 11; i <= FRAME_COUNT; i++) {
        const img = new Image();
        img.onload = () => {
            remainingLoaded++;
            updateLoader(10 + remainingLoaded, FRAME_COUNT);
            
            // Sample background color every 20 frames
            if (i % 20 === 0) {
                sampleBgColor(img);
            }
            
            if (remainingLoaded === remainingCount) {
                finishLoading();
            }
        };
        img.src = `frames/frame_${String(i).padStart(4, '0')}.png`;
        frames[i - 1] = img;
    }
}

function updateLoader(loaded, total) {
    const percent = Math.round((loaded / total) * 100);
    loaderBar.style.width = percent + '%';
    loaderPercent.textContent = percent + '%';
}

function finishLoading() {
    // Hide loader only after all frames are ready
    setTimeout(() => {
        loader.classList.add('loader-hidden');
        startExperience();
    }, 500);
}

// 4. BACKGROUND COLOR SAMPLING
function sampleBgColor(img) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    
    tempCtx.drawImage(img, 0, 0);
    
    // Sample from corners
    const samples = [
        tempCtx.getImageData(0, 0, 1, 1).data,
        tempCtx.getImageData(img.naturalWidth - 1, 0, 1, 1).data,
        tempCtx.getImageData(0, img.naturalHeight - 1, 1, 1).data,
        tempCtx.getImageData(img.naturalWidth - 1, img.naturalHeight - 1, 1, 1).data
    ];
    
    // Average the samples
    let r = 0, g = 0, b = 0;
    samples.forEach(sample => {
        r += sample[0];
        g += sample[1];
        b += sample[2];
    });
    
    r = Math.round(r / 4);
    g = Math.round(g / 4);
    b = Math.round(b / 4);
    
    bgColor = `rgb(${r}, ${g}, ${b})`;
}

// 5. CANVAS RENDERER - Padded Cover Mode selon skill
function drawFrame(index) {
    const img = frames[index];
    if (!img || !img.complete) return;
    
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    
    // Cover mode with padding (IMAGE_SCALE)
    const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    
    // Fill background BEFORE drawing (fills padded border seamlessly)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);
    
    // Draw image
    ctx.drawImage(img, dx, dy, dw, dh);
}

// 6. START EXPERIENCE
function startExperience() {
    initScrollTriggers();
    initSectionAnimations();
    initCounters();
    initMarquees();
    initDarkOverlay();
    initHeroTransition();
    
    // Draw first frame
    drawFrame(0);
}

// 7. FRAME-TO-SCROLL BINDING selon skill
function initScrollTriggers() {
    ScrollTrigger.create({
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
            const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
            const index = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
            
            if (index !== currentFrame) {
                currentFrame = index;
                requestAnimationFrame(() => drawFrame(currentFrame));
            }
        }
    });
}

// 8. HERO ANIMATIONS (Word Split)
function initHeroAnimations() {
    // Hero heading word animation
    const heroSpans = document.querySelectorAll('.hero-heading span');
    const heroTagline = document.querySelector('.hero-tagline');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    // Initial state is set in CSS, animate in
    gsap.to(heroSpans, {
        y: 0,
        opacity: 1,
        duration: 1.2,
        ease: "power3.out",
        stagger: 0.15,
        delay: 0.5
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
        delay: 1.8
    });
}

// 9. CIRCLE-WIPE HERO REVEAL selon skill
function initHeroTransition() {
    ScrollTrigger.create({
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
            const p = self.progress;
            
            // Hero fades out as scroll begins
            heroSection.style.opacity = Math.max(0, 1 - p * 15);
            
            // Canvas reveals via expanding circle clip-path
            const wipeProgress = Math.min(1, Math.max(0, (p - 0.01) / 0.06));
            const radius = wipeProgress * 75; // 0% to 75% of viewport
            canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
        }
    });
}

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

    // ScrollTrigger for section animation
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
                tl.progress(Math.min(sectionProgress * 2, 1)); // Animation completes at 50% of section
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

// 11. COUNTER ANIMATIONS selon skill
function initCounters() {
    document.querySelectorAll(".stat-number").forEach(el => {
        const target = parseFloat(el.dataset.value);
        const decimals = parseInt(el.dataset.decimals || "0");
        
        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                const p = self.progress;
                // Stats section is at 58-72%
                if (p >= 0.58 && p <= 0.72) {
                    const sectionProgress = (p - 0.58) / (0.72 - 0.58);
                    const currentValue = target * Math.min(sectionProgress * 2, 1);
                    el.textContent = decimals === 0 ? Math.round(currentValue) : currentValue.toFixed(decimals);
                }
            }
        });
    });
}

// 12. HORIZONTAL TEXT MARQUEE selon skill
function initMarquees() {
    document.querySelectorAll(".marquee-wrap").forEach(el => {
        const speed = parseFloat(el.dataset.scrollSpeed) || -25;
        const marqueeText = el.querySelector(".marquee-text");
        
        gsap.to(marqueeText, {
            xPercent: speed,
            ease: "none",
            scrollTrigger: { 
                trigger: scrollContainer, 
                start: "top top", 
                end: "bottom bottom", 
                scrub: true 
            }
        });
        
        // Fade marquee in/out based on scroll range
        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                const p = self.progress;
                let opacity = 0;
                
                // Fade in from 15% to 25%, visible until 85%, fade out to 95%
                if (p >= 0.15 && p <= 0.25) {
                    opacity = (p - 0.15) / 0.1;
                } else if (p > 0.25 && p < 0.85) {
                    opacity = 1;
                } else if (p >= 0.85 && p <= 0.95) {
                    opacity = 1 - ((p - 0.85) / 0.1);
                }
                
                el.style.opacity = opacity;
            }
        });
    });
}

// 13. DARK OVERLAY selon skill
function initDarkOverlay() {
    const enter = 0.58; // Stats section start
    const leave = 0.72; // Stats section end
    const fadeRange = 0.04;
    
    ScrollTrigger.create({
        trigger: scrollContainer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
            const p = self.progress;
            let opacity = 0;
            
            if (p >= enter - fadeRange && p <= enter) {
                opacity = (p - (enter - fadeRange)) / fadeRange;
            } else if (p > enter && p < leave) {
                opacity = 0.9;
            } else if (p >= leave && p <= leave + fadeRange) {
                opacity = 0.9 * (1 - (p - leave) / fadeRange);
            }
            
            darkOverlay.style.opacity = opacity;
        }
    });
}

// CTA Button functionality
document.addEventListener('DOMContentLoaded', () => {
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', () => {
            window.open('mailto:contact@nsy.fr?subject=Demande de projet', '_blank');
        });
    }
});

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);