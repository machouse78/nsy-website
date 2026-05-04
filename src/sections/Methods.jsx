import React from 'react'
import { motion } from 'framer-motion'
import { 
  Search, 
  PenTool, 
  Code, 
  CheckCircle, 
  Rocket, 
  Settings,
  Clock,
  ArrowRight
} from 'lucide-react'
import { siteContent } from '../data/content'

const Methods = () => {
  const iconMap = {
    Search,
    PenTool,
    Code,
    CheckCircle,
    Rocket,
    Settings
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { x: -30, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.6 }
    }
  }

  const stepVariants = {
    hidden: { y: 50, opacity: 0 },
    visible: (i) => ({
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.1,
        duration: 0.8,
        ease: "easeOut"
      }
    })
  }

  return (
    <section id="methods" className="section-padding bg-dark-800/50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-6 py-2 mb-6">
              <Settings className="w-4 h-4 text-primary-400" />
              <span className="text-primary-400 text-sm font-medium">MÉTHODE DE TRAVAIL</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">{siteContent.methods.title}</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-4">
              {siteContent.methods.subtitle}
            </p>
            <p className="text-lg text-gray-300 max-w-4xl mx-auto">
              {siteContent.methods.description}
            </p>
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            {/* Timeline Line */}
            <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-500 via-cyber-500 to-ai-500"></div>

            {/* Steps */}
            <div className="space-y-16">
              {siteContent.methods.steps.map((step, index) => {
                const Icon = iconMap[step.icon] || Search
                const isEven = index % 2 === 0

                return (
                  <motion.div
                    key={index}
                    custom={index}
                    variants={stepVariants}
                    className={`relative ${isEven ? 'lg:pr-1/2' : 'lg:pl-1/2 lg:ml-auto'}`}
                  >
                    {/* Timeline Node */}
                    <div className="hidden lg:block absolute top-6 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gradient-to-r from-primary-500 to-cyber-500 rounded-full border-4 border-dark-800 z-10"></div>

                    {/* Card */}
                    <motion.div
                      whileHover={{ scale: 1.02, y: -5 }}
                      className={`glass-card p-8 glow-card ${
                        isEven ? 'lg:mr-12' : 'lg:ml-12'
                      }`}
                    >
                      <div className="flex items-start space-x-6">
                        {/* Step Number & Icon */}
                        <div className="flex-shrink-0">
                          <div className="relative">
                            <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-cyber-500 rounded-2xl flex items-center justify-center mb-4">
                              <Icon className="w-10 h-10 text-white" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-ai-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {step.number}
                            </div>
                          </div>
                          
                          {/* Duration Badge */}
                          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-400">{step.duration}</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-3">
                            {step.title}
                          </h3>
                          <p className="text-gray-400 leading-relaxed mb-6">
                            {step.description}
                          </p>

                          {/* Details */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-300">Étapes clés :</h4>
                            <div className="grid sm:grid-cols-2 gap-3">
                              {step.details.map((detail, detailIndex) => (
                                <div key={detailIndex} className="flex items-center space-x-3">
                                  <div className="w-2 h-2 bg-primary-400 rounded-full flex-shrink-0"></div>
                                  <span className="text-gray-300 text-sm">{detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Arrow for next step */}
                      {index < siteContent.methods.steps.length - 1 && (
                        <div className="flex justify-center mt-8 lg:hidden">
                          <ArrowRight className="w-6 h-6 text-primary-400 transform rotate-90" />
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Methodology Highlights */}
          <motion.div variants={itemVariants} className="mt-20">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-card p-6 text-center glow-card">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold text-white mb-2">Agile & Flexible</h4>
                <p className="text-gray-400 text-sm">Adaptation continue aux besoins client</p>
              </div>

              <div className="glass-card p-6 text-center glow-card">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold text-white mb-2">Code Quality</h4>
                <p className="text-gray-400 text-sm">Standards élevés et bonnes pratiques</p>
              </div>

              <div className="glass-card p-6 text-center glow-card">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold text-white mb-2">Livraison Rapide</h4>
                <p className="text-gray-400 text-sm">Respect des délais et itérations courtes</p>
              </div>

              <div className="glass-card p-6 text-center glow-card">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold text-white mb-2">Support Continu</h4>
                <p className="text-gray-400 text-sm">Accompagnement post-livraison</p>
              </div>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div variants={itemVariants} className="text-center mt-16">
            <div className="glass-card p-8 glow-card">
              <h3 className="text-2xl font-bold text-white mb-4">
                Convaincu par ma méthode ?
              </h3>
              <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                Chaque projet est unique, mais ma méthodologie éprouvée garantit 
                la réussite de votre projet dans les meilleures conditions.
              </p>
              
              <motion.button
                onClick={() => {
                  const element = document.querySelector('#contact')
                  if (element) element.scrollIntoView({ behavior: 'smooth' })
                }}
                className="btn-primary text-lg px-8 py-4 flex items-center justify-center space-x-2 mx-auto"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>Démarrons votre projet</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default Methods