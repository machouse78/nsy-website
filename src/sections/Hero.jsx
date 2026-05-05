import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ArrowRight, Brain, Code, Zap, Users, ChevronDown } from 'lucide-react'
import { siteContent } from '../data/content'
import ParticlesBackground from '../components/ui/ParticlesBackground'
import LogoAnimation from '../components/ui/LogoAnimation'

const Hero = () => {
  const [typedText, setTypedText] = useState('')
  const fullText = siteContent.hero.subtitle
  
  // Refs pour animations GSAP orchestrées
  const heroRef = useRef(null)
  const titleRef = useRef(null)
  const subtitleRef = useRef(null)
  const statsRef = useRef(null)
  
  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.slice(0, i + 1))
        i++
      } else {
        clearInterval(timer)
      }
    }, 50)
    
    return () => clearInterval(timer)
  }, [fullText])

  // ANIMATIONS ORCHESTRÉES GSAP - Skill frontend-design
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Timeline principale - Révélations échelonnées
      const tl = gsap.timeline({ delay: 0.5 })
      
      // Séquence orchestrée selon skill
      tl.from('.hero-title-line', {
        y: 100,
        opacity: 0,
        duration: 1.2,
        ease: 'power4.out',
        stagger: 0.12  // Délai échelonné entre lignes
      })
      .from('.hero-subtitle', {
        x: -50,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
      }, '-=0.6')
      .from('.hero-content', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        stagger: 0.08
      }, '-=0.4')
      .from('.hero-stats', {
        scale: 0.8,
        opacity: 0,
        duration: 0.6,
        ease: 'back.out(1.7)',
        stagger: 0.1
      }, '-=0.2')
      
      // Animation continue des accents décoratifs
      gsap.to('.decorative-accent', {
        rotation: 360,
        duration: 20,
        ease: 'none',
        repeat: -1
      })
      
    }, heroRef)
    
    return () => ctx.revert()
  }, [])

  // STATS COUNTER - Animation selon skill
  useEffect(() => {
    const animateCounters = () => {
      siteContent.stats.forEach((stat, index) => {
        const value = parseInt(stat.value.replace(/\D/g, '')) || 0
        gsap.fromTo(`.counter-${index}`, {
          innerText: 0
        }, {
          innerText: value,
          duration: 2,
          delay: 2 + index * 0.2,
          ease: 'power2.out',
          snap: { innerText: 1 },
          onUpdate: function() {
            this.targets()[0].innerText = Math.ceil(this.targets()[0].innerText)
          }
        })
      })
    }
    
    const timer = setTimeout(animateCounters, 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleNavClick = (href) => {
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6 }
    }
  }

  return (
    <section ref={heroRef} id="home" className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 neural-bg">
        <ParticlesBackground />
      </div>
      
      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-900/50 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent"></div>

      {/* Content */}
      <div className="container relative z-10">
        <div className="flex flex-col pt-20 space-y-8">
          {/* Main Title - Au dessus de tout */}
          <motion.div 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-center space-y-4"
          >
            <h1 ref={titleRef} className="text-4xl md:text-6xl lg:text-7xl font-display font-black leading-[0.85] tracking-tight">
              <span className="hero-title-line block text-white">TRANSFORMEZ VOS</span>
              <span className="hero-title-line block gradient-text italic transform rotate-1">IDÉES EN SOLUTIONS</span>
              <span className="hero-title-line block text-white transform -translate-x-4">NUMÉRIQUES</span>
            </h1>
          </motion.div>

          {/* Subtitle ASYMÉTRIQUE - Skill frontend-design */}
          <motion.div 
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.5 }}
            className="relative text-left ml-8 md:ml-16"
          >
            <div className="hero-subtitle text-xl md:text-3xl text-gray-300 font-sans font-medium transform rotate-1 bg-dark-800/60 backdrop-blur-sm px-6 py-3 rounded-lg border border-cyber-500/20 inline-block">
              <span className="typing-animation whitespace-nowrap overflow-hidden tracking-wide">
                {typedText}
              </span>
              {/* DECORATIVE ACCENT animé */}
              <div className="decorative-accent absolute -top-2 -right-2 w-3 h-3 bg-primary-500 rounded-full blur-sm"></div>
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-start w-full">
            {/* Logo Animation - Colonne gauche */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="order-2 lg:order-1 flex justify-center"
            >
              <LogoAnimation autoPlay={true} />
            </motion.div>

            {/* Contenu principal - Colonne droite */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-8 order-1 lg:order-2"
            >

            {/* Description */}
            <motion.div variants={itemVariants}>
              <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
                {siteContent.hero.description}
              </p>
            </motion.div>

            {/* Highlights */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-wrap gap-4 mb-4">
                {siteContent.hero.highlights.map((highlight, index) => (
                  <div key={index} className="flex items-center space-x-2 text-cyan-400">
                    <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                    <span className="text-sm font-medium">{highlight}</span>
                  </div>
                ))}
              </div>
              
              {/* AI Transparency Badge */}
              <motion.button
                onClick={() => handleNavClick('#construction')}
                className="inline-flex items-center space-x-2 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/30 hover:border-primary-500/50 rounded-full px-4 py-2 transition-all duration-300 group"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Brain className="w-4 h-4 text-primary-400" />
                <span className="text-sm text-primary-300 group-hover:text-primary-200">Site créé avec IA • Transparence totale</span>
                <ArrowRight className="w-3 h-3 text-primary-400 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <motion.button
                  onClick={() => handleNavClick('#contact')}
                  className="group btn-primary text-lg px-8 py-4 flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>{siteContent.hero.cta.primary}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
                
                <motion.button
                  onClick={() => handleNavClick('#services')}
                  className="btn-secondary text-lg px-8 py-4"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {siteContent.hero.cta.secondary}
                </motion.button>
              </div>
            </motion.div>

            {/* STATS ANIMÉES - Espacement augmenté pour éviter confusion */}
            <motion.div variants={itemVariants} className="pt-20 pb-16 border-t border-white/10 mt-16">
              {/* Titre des stats pour séparation visuelle */}
              <h3 className="text-center text-sm uppercase tracking-[0.2em] text-gray-500 font-sans font-medium mb-12">
                Expertise & Réalisations
              </h3>
              
              {/* GRID ORGANISÉE mais avec asymétrie subtile */}
              <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
                {siteContent.stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    className={`hero-stats text-center transform ${
                      index % 2 ? 'rotate-1' : '-rotate-1'
                    }`}
                    whileHover={{ 
                      scale: 1.1, 
                      rotate: 0,
                      transition: { type: "spring", stiffness: 300 }
                    }}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 + index * 0.2 }}
                  >
                    {/* Number - 4rem+ selon skill + Animation counter GSAP */}
                    <div className={`text-4xl md:text-5xl font-display font-black leading-none ${
                      index % 2 ? 'text-cyber-400' : 'gradient-text'
                    }`}>
                      <span className={`counter-${index}`}>0</span>
                      <span className="text-xl md:text-2xl opacity-60">+</span>
                    </div>
                    {/* Label - uppercase letterspaced selon skill */}
                    <div className="text-xs uppercase tracking-[0.15em] text-gray-400 mt-2 font-sans font-semibold">
                      {stat.label}
                    </div>
                    
                    {/* DECORATIVE BORDERS - Skill atmosphérique */}
                    <div className={`mt-2 mx-auto w-8 h-0.5 ${
                      index % 2 ? 'bg-gradient-to-r from-cyber-500/60 to-transparent' : 'bg-gradient-to-r from-primary-500/60 to-transparent'
                    }`}></div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Floating Icons */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-1/4 right-1/4 text-primary-400/20"
        >
          <Brain className="w-20 h-20" />
        </motion.div>
        
        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className="absolute bottom-1/3 right-1/6 text-cyan-400/20"
        >
          <Code className="w-16 h-16" />
        </motion.div>
        
        <motion.div
          animate={{
            y: [0, -15, 0],
            rotate: [0, 3, 0]
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 4
          }}
          className="absolute top-2/3 left-1/6 text-ai-400/20"
        >
          <Zap className="w-12 h-12" />
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <button
          onClick={() => handleNavClick('#about')}
          className="flex flex-col items-center text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-sm mb-2">Découvrir</span>
          <ChevronDown className="w-6 h-6" />
        </button>
      </motion.div>
    </section>
  )
}

export default Hero