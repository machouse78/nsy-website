import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Code, Users, Lightbulb, Shield, Award, Target } from 'lucide-react'
import { siteContent } from '../data/content'

// Enregistrer le plugin GSAP
gsap.registerPlugin(ScrollTrigger)

const About = () => {
  const aboutRef = useRef(null)
  const titleRef = useRef(null)
  
  const iconMap = {
    Code,
    Users,
    Lightbulb,
    Shield,
    Award,
    Target
  }

  // ANIMATIONS GSAP - Skill frontend-design
  useEffect(() => {
    const ctx = gsap.context(() => {
      // COLOR ZONE TRANSITION - Section About vers accent
      gsap.to(aboutRef.current, {
        background: 'linear-gradient(135deg, var(--bg-accent) 0%, var(--bg-dark) 60%, #451a03 100%)',
        scrollTrigger: {
          trigger: aboutRef.current,
          start: 'top center',
          end: 'bottom center',
          scrub: 1
        }
      })

      // ORCHESTRATED REVEALS - Staggered animations
      gsap.from('.about-element', {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: aboutRef.current,
          start: 'top 80%'
        }
      })

    }, aboutRef)

    return () => ctx.revert()
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
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
    <section ref={aboutRef} id="about" className="section-padding relative overflow-hidden grain-overlay">
      {/* ATMOSPHERIC DETAILS - Skill frontend-design */}
      <div className="absolute inset-0 grain-overlay"></div>
      <div className="absolute top-1/4 right-0 w-64 h-64 bg-cyber-500/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 left-0 w-48 h-48 bg-ai-500/5 rounded-full blur-2xl"></div>
      
      <div className="container relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header - LAYOUT ASYMÉTRIQUE */}
          <div className="about-element relative mb-20">
            {/* Section label - Skill compliant */}
            <div className="absolute -top-4 left-8 text-xs uppercase tracking-[0.2em] text-primary-400/60 font-body font-bold">
              002 / EXPERTISE
            </div>
            
            {/* Titre - LEFT-ALIGNED selon skill variation */}
            <h2 ref={titleRef} className="about-element text-5xl md:text-6xl lg:text-7xl font-display font-black leading-[0.9] text-left ml-8 mb-8 skill-shadow">
              <span className="block text-white transform -rotate-1">{siteContent.about.title.split(' ')[0]}</span>
              <span className="block gradient-text transform translate-x-8 rotate-1">{siteContent.about.title.split(' ').slice(1).join(' ')}</span>
            </h2>
            
            {/* Subtitle - RIGHT-ALIGNED contrast */}
            <div className="about-element max-w-2xl ml-auto mr-16 text-right">
              <p className="text-xl md:text-2xl text-gray-300 font-body leading-relaxed italic transform rotate-1">
                {siteContent.about.subtitle}
              </p>
            </div>
          </div>

          {/* SPLIT LAYOUT - Text + Visual selon skill */}
          <div className="relative flex flex-col lg:flex-row gap-20 items-start">
            {/* Left Column - Story */}
            <motion.div variants={itemVariants} className="space-y-8">
              <div className="glass-card p-8 glow-card">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-cyber-500 rounded-xl flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Cédric Barme</h3>
                    <p className="text-cyan-400">{siteContent.company.specialty}</p>
                  </div>
                </div>
                
                <div className="space-y-6 text-gray-300">
                  <p className="leading-relaxed">
                    {siteContent.about.description}
                  </p>
                  
                  <div className="border-l-4 border-primary-500 pl-6 py-2 bg-primary-500/5 rounded-r">
                    <h4 className="text-white font-semibold mb-2">Ma mission</h4>
                    <p className="text-sm">
                      {siteContent.about.mission}
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-cyan-500 pl-6 py-2 bg-cyan-500/5 rounded-r">
                    <h4 className="text-white font-semibold mb-2">Ma vision</h4>
                    <p className="text-sm">
                      {siteContent.about.vision}
                    </p>
                  </div>
                </div>

                {/* Experience Highlights */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-3xl font-bold gradient-text">{siteContent.stats[0].value}</div>
                      <div className="text-sm text-gray-400">{siteContent.stats[0].label.replace("Années d'expérience", "Années")}</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold gradient-text">{siteContent.stats[1].value}</div>
                      <div className="text-sm text-gray-400">{siteContent.stats[1].label.replace("Projets réalisés", "Projets")}</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold gradient-text">{siteContent.stats[2].value}</div>
                      <div className="text-sm text-gray-400">{siteContent.stats[2].label.replace("Clients satisfaits", "Clients")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Column - Values */}
            <motion.div variants={itemVariants} className="space-y-6">
              <h3 className="text-2xl font-bold text-white mb-8">Mes valeurs</h3>
              
              {siteContent.about.values.map((value, index) => {
                const Icon = iconMap[value.icon] || Code
                
                return (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    whileHover={{ x: 10 }}
                    className="glass-card p-6 glow-card group cursor-pointer"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-cyber-500 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
                          {value.title}
                        </h4>
                        <p className="text-gray-400 leading-relaxed">
                          {value.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>

          {/* Skills Section */}
          <motion.div variants={itemVariants} className="mt-20">
            <h3 className="text-2xl font-bold text-white text-center mb-12">Compétences techniques</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.entries(siteContent.skills).map(([category, skills], index) => (
                <motion.div
                  key={category}
                  variants={itemVariants}
                  className="glass-card p-6 glow-card"
                  whileHover={{ y: -5 }}
                >
                  <h4 className="text-lg font-semibold text-white mb-4 capitalize">
                    {category.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, skillIndex) => (
                      <span
                        key={skillIndex}
                        className="bg-primary-500/10 border border-primary-500/20 text-primary-300 px-3 py-1 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default About