import React from 'react'
import { motion } from 'framer-motion'
import { 
  Code, 
  Brain, 
  Zap, 
  Users, 
  Shield, 
  GraduationCap,
  ArrowRight,
  CheckCircle
} from 'lucide-react'
import { siteContent } from '../data/content'

const Services = () => {
  const iconMap = {
    Code,
    Brain,
    Zap,
    Users,
    Shield,
    GraduationCap
  }

  // Motion Design optimized variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06 // Plus rapide selon skill
      }
    }
  }

  const itemVariants = {
    hidden: { y: 30, opacity: 0, scale: 0.98 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { 
        duration: 0.18, // --dur-2
        ease: [0.165, 0.84, 0.44, 1] // --ease-out-quart
      }
    }
  }

  const cardVariants = {
    hidden: { y: 40, opacity: 0, scale: 0.97 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { 
        duration: 0.18, // --dur-2 pour enter pattern
        ease: [0.165, 0.84, 0.44, 1] // --ease-out-quart
      }
    }
  }

  return (
    <section id="services" className="section-padding bg-dark-900">
      <div className="container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-6 py-2 mb-6">
              <div className="w-2 h-2 bg-cyber-500 rounded-full"></div>
              <span className="text-cyber-400 text-sm font-medium">SERVICES</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">{siteContent.services.title}</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              {siteContent.services.subtitle}
            </p>
          </motion.div>

          {/* Services Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {siteContent.services.list.map((service, index) => {
              const Icon = iconMap[service.icon] || Code
              
              return (
                <motion.div
                  key={index}
                  variants={cardVariants}
                  whileHover={{ y: -10, scale: 1.02 }}
                  className="group relative"
                >
                  <div className="glass-card p-8 h-full glow-card relative overflow-hidden">
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-5 group-hover:opacity-10 transition-opacity duration-500`}></div>
                    
                    {/* Content */}
                    <div className="relative z-10">
                      {/* Icon */}
                      <div className="mb-6">
                        <div className={`w-16 h-16 bg-gradient-to-br ${service.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-bold text-white mb-4 group-hover:text-primary-400 transition-colors duration-300">
                        {service.title}
                      </h3>

                      {/* Description */}
                      <p className="text-gray-400 leading-relaxed mb-6">
                        {service.description}
                      </p>

                      {/* Technologies */}
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Technologies :</h4>
                        <div className="flex flex-wrap gap-2">
                          {service.technologies.slice(0, 3).map((tech, techIndex) => (
                            <span
                              key={techIndex}
                              className="bg-white/5 border border-white/10 text-gray-300 px-3 py-1 rounded-full text-xs"
                            >
                              {tech}
                            </span>
                          ))}
                          {service.technologies.length > 3 && (
                            <span className="bg-white/5 border border-white/10 text-gray-300 px-3 py-1 rounded-full text-xs">
                              +{service.technologies.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="flex items-center text-primary-400 group-hover:text-primary-300 transition-colors duration-300">
                        <span className="text-sm font-medium">En savoir plus</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
                      </div>
                    </div>

                    {/* Hover Effect Border */}
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-primary-500/30 rounded-xl transition-colors duration-300"></div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Bottom CTA */}
          <motion.div 
            variants={itemVariants}
            className="text-center mt-16"
          >
            <div className="glass-card p-8 glow-card">
              <h3 className="text-2xl font-bold text-white mb-4">
                Besoin d'une solution sur-mesure ?
              </h3>
              <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                Chaque projet est unique. Discutons ensemble de vos besoins spécifiques 
                pour créer la solution qui vous correspond parfaitement.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.button
                  onClick={() => {
                    const element = document.querySelector('#contact')
                    if (element) element.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="btn-primary flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>Discuter de mon projet</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
                
                <motion.a
                  href={`mailto:${siteContent.contact.email}`}
                  className="btn-secondary flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>Envoyer un email</span>
                </motion.a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default Services