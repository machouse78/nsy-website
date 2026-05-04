import React from 'react'
import { motion } from 'framer-motion'
import { 
  Sparkles, 
  Bot, 
  TrendingUp, 
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Zap,
  Brain
} from 'lucide-react'
import { siteContent } from '../data/content'

const AI = () => {
  const iconMap = {
    Sparkles,
    Bot,
    TrendingUp,
    MessageSquare
  }

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
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6 }
    }
  }

  return (
    <section id="ai" className="section-padding bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ai-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-500/5 rounded-full blur-3xl"></div>
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
            <div className="inline-flex items-center space-x-2 bg-ai-500/10 border border-ai-500/20 rounded-full px-6 py-2 mb-6">
              <Brain className="w-4 h-4 text-ai-400" />
              <span className="text-ai-400 text-sm font-medium">INTELLIGENCE ARTIFICIELLE</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">{siteContent.ai.title}</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              {siteContent.ai.subtitle}
            </p>
            <p className="text-lg text-gray-300 max-w-4xl mx-auto mt-4">
              {siteContent.ai.description}
            </p>
          </motion.div>

          {/* AI Features Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {siteContent.ai.features.map((feature, index) => {
              const Icon = iconMap[feature.icon] || Sparkles
              
              return (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="group"
                >
                  <div className="glass-card p-8 h-full glow-card relative overflow-hidden">
                    {/* Gradient Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-ai-500/5 to-cyber-500/5 group-hover:from-ai-500/10 group-hover:to-cyber-500/10 transition-all duration-500"></div>
                    
                    <div className="relative z-10">
                      {/* Icon */}
                      <div className="flex items-center space-x-4 mb-6">
                        <div className="w-14 h-14 bg-gradient-to-r from-ai-500 to-cyber-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white group-hover:text-ai-400 transition-colors duration-300">
                          {feature.title}
                        </h3>
                      </div>

                      {/* Description */}
                      <p className="text-gray-400 leading-relaxed mb-6">
                        {feature.description}
                      </p>

                      {/* Benefits */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-300">Bénéfices :</h4>
                        {feature.benefits.map((benefit, benefitIndex) => (
                          <div key={benefitIndex} className="flex items-center space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                            <span className="text-gray-300 text-sm">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* AI Showcase */}
          <motion.div variants={itemVariants} className="mb-16">
            <div className="glass-card p-8 glow-card">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left - Content */}
                <div>
                  <h3 className="text-3xl font-bold text-white mb-6">
                    L'IA au service de votre entreprise
                  </h3>
                  <p className="text-gray-400 leading-relaxed mb-8">
                    Dans un monde où l'intelligence artificielle révolutionne les façons de travailler, 
                    NSY vous accompagne pour intégrer ces technologies de pointe dans vos processus 
                    métier et créer un avantage concurrentiel durable.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Zap className="w-6 h-6 text-ai-400 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-white">Automatisation intelligente</h4>
                        <p className="text-gray-400 text-sm">Libérez vos équipes des tâches répétitives</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <TrendingUp className="w-6 h-6 text-cyber-400 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-white">Analyse prédictive</h4>
                        <p className="text-gray-400 text-sm">Anticipez les tendances et optimisez vos décisions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <Brain className="w-6 h-6 text-primary-400 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-white">IA sur-mesure</h4>
                        <p className="text-gray-400 text-sm">Solutions adaptées à vos besoins spécifiques</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right - Visual */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-ai-500/20 to-cyber-500/20 rounded-2xl p-8 backdrop-blur-sm border border-white/10">
                    <div className="space-y-6">
                      {/* Code-like visualization */}
                      <div className="font-mono text-sm space-y-2">
                        <div className="text-ai-400"># Configuration IA</div>
                        <div className="text-gray-300">
                          <span className="text-cyan-400">model</span>: <span className="text-green-400">"gpt-4"</span>
                        </div>
                        <div className="text-gray-300">
                          <span className="text-cyan-400">temperature</span>: <span className="text-yellow-400">0.7</span>
                        </div>
                        <div className="text-gray-300">
                          <span className="text-cyan-400">max_tokens</span>: <span className="text-yellow-400">2000</span>
                        </div>
                        <div className="text-ai-400 mt-4"># Automatisation</div>
                        <div className="text-gray-300">
                          <span className="text-cyan-400">workflow</span>: <span className="text-green-400">"analyse → traitement → réponse"</span>
                        </div>
                        <div className="text-green-400 flex items-center space-x-2 mt-4">
                          <CheckCircle className="w-4 h-4" />
                          <span>Système opérationnel</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating elements */}
                  <div className="absolute -top-4 -right-4 w-8 h-8 bg-ai-500 rounded-full animate-pulse"></div>
                  <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-cyber-500 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div variants={itemVariants} className="text-center">
            <div className="glass-card p-8 glow-card">
              <h3 className="text-2xl font-bold text-white mb-4">
                Prêt à intégrer l'IA dans votre entreprise ?
              </h3>
              <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                Découvrons ensemble comment l'intelligence artificielle peut transformer 
                vos processus et créer de nouvelles opportunités pour votre business.
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
                <Brain className="w-5 h-5" />
                <span>Parlons de votre projet IA</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default AI