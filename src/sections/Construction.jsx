import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Code2, 
  Brain, 
  Clock,
  Zap,
  Settings,
  Sparkles,
  Monitor,
  Cpu,
  Terminal,
  Layers,
  CheckCircle,
  ArrowRight,
  Copy,
  Github,
  ExternalLink,
  FileText,
  Linkedin,
  User
} from 'lucide-react'
import { siteContent } from '../data/content'

const Construction = () => {
  const [promptCopied, setPromptCopied] = useState(false)
  
  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(siteContent.construction.fullPrompt.content)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
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

  const cardVariants = {
    hidden: { scale: 0.9, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  }

  return (
    <section id="construction" className="section-padding bg-gradient-to-br from-dark-900 via-purple-900/20 to-dark-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/8 rounded-full blur-xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-cyan-500/8 rounded-full blur-xl"></div>
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
            <div className="inline-flex items-center space-x-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-6 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 text-sm font-medium">CONSTRUCTION DU SITE</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">{siteContent.construction.title}</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-4">
              {siteContent.construction.subtitle}
            </p>
            <p className="text-lg text-gray-300 max-w-4xl mx-auto">
              {siteContent.construction.description}
            </p>
          </motion.div>

          {/* Tools Used */}
          <div className="grid lg:grid-cols-2 gap-8 mb-16">
            {/* Cursor IDE */}
            <motion.div variants={cardVariants} className="glass-card p-8 glow-card">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                  <Terminal className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{siteContent.construction.details.ide.name}</h3>
                  <p className="text-cyan-400">{siteContent.construction.details.ide.version}</p>
                </div>
              </div>
              
              <p className="text-gray-400 leading-relaxed mb-6">
                {siteContent.construction.details.ide.description}
              </p>
              
              <div className="space-y-3">
                <h4 className="text-white font-semibold">Fonctionnalités utilisées :</h4>
                {siteContent.construction.details.ide.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Claude AI */}
            <motion.div variants={cardVariants} className="glass-card p-8 glow-card">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{siteContent.construction.details.ai.name}</h3>
                  <p className="text-purple-400">{siteContent.construction.details.ai.model}</p>
                  <p className="text-xs text-gray-500">{siteContent.construction.details.ai.provider}</p>
                </div>
              </div>
              
              <p className="text-gray-400 leading-relaxed mb-6">
                {siteContent.construction.details.ai.description}
              </p>
              
              <div className="space-y-3">
                <h4 className="text-white font-semibold">Capacités exploitées :</h4>
                {siteContent.construction.details.ai.capabilities.map((capability, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{capability}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Timeline */}
          <motion.div variants={itemVariants} className="mb-16">
            <div className="glass-card p-8 glow-card">
              <div className="flex items-center justify-center space-x-4 mb-8">
                <Clock className="w-8 h-8 text-ai-400" />
                <h3 className="text-2xl font-bold text-white">Chronologie de développement</h3>
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full font-bold">
                  {siteContent.construction.details.timeline.totalTime}
                </div>
              </div>

              <div className="grid md:grid-cols-5 gap-6">
                {siteContent.construction.details.timeline.phases.map((phase, index) => (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    whileHover={{ y: -5 }}
                    className="relative"
                  >
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center h-full">
                      <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-cyber-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-white font-bold">{index + 1}</span>
                      </div>
                      <h4 className="font-semibold text-white text-sm mb-2">{phase.phase}</h4>
                      <div className="text-xs text-cyan-400 font-medium mb-2">{phase.duration}</div>
                      <p className="text-xs text-gray-400 leading-relaxed">{phase.description}</p>
                    </div>
                    
                    {index < siteContent.construction.details.timeline.phases.length - 1 && (
                      <ArrowRight className="hidden md:block absolute top-6 -right-3 w-6 h-6 text-primary-400 z-10" />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Prompt Keys */}
          <motion.div variants={itemVariants} className="mb-16">
            <h3 className="text-2xl font-bold text-white text-center mb-8">Points clés du prompt de création</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {siteContent.construction.details.promptKeys.map((key, index) => (
                <motion.div
                  key={index}
                  variants={cardVariants}
                  whileHover={{ scale: 1.05 }}
                  className="glass-card p-6 glow-card text-center"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-ai-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-white mb-3 text-sm">{key.key}</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">{key.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Tech Stack */}
          <motion.div variants={itemVariants} className="mb-16">
            <h3 className="text-2xl font-bold text-white text-center mb-8">Stack technologique utilisé</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(siteContent.construction.details.techStack).map(([category, technologies], index) => (
                <motion.div
                  key={category}
                  variants={itemVariants}
                  className="glass-card p-6 glow-card"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-cyber-500 rounded-lg flex items-center justify-center">
                      {category === 'frontend' && <Monitor className="w-5 h-5 text-white" />}
                      {category === 'tools' && <Settings className="w-5 h-5 text-white" />}
                      {category === 'deployment' && <Layers className="w-5 h-5 text-white" />}
                      {category === 'performance' && <Cpu className="w-5 h-5 text-white" />}
                    </div>
                    <h4 className="font-semibold text-white capitalize">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                  </div>
                  
                  <div className="space-y-2">
                    {technologies.map((tech, techIndex) => (
                      <div key={techIndex} className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary-400 rounded-full"></div>
                        <span className="text-sm text-gray-300">{tech}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>



          {/* Philosophy */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <div className="glass-card p-8 glow-card">
              <div className="flex items-center justify-center space-x-3 mb-6">
                <Brain className="w-8 h-8 text-ai-400" />
                <Sparkles className="w-6 h-6 text-purple-400" />
                <Code2 className="w-8 h-8 text-cyber-400" />
              </div>
              <h3 className="text-2xl font-bold gradient-text mb-4">
                Philosophie du développement assisté par IA
              </h3>
              <p className="text-lg text-gray-300 leading-relaxed max-w-4xl mx-auto">
                {siteContent.construction.details.philosophy}
              </p>
            </div>
          </motion.div>

          {/* Prompt complet */}
          <motion.div variants={itemVariants} className="mb-16">
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              {siteContent.construction.fullPrompt.title}
            </h3>
            
            <div className="glass-card p-8 glow-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-ai-400" />
                  <h4 className="text-lg font-semibold text-white">
                    {siteContent.construction.fullPrompt.description}
                  </h4>
                </div>
                <motion.button
                  onClick={copyPromptToClipboard}
                  className="flex items-center space-x-2 bg-ai-500/20 hover:bg-ai-500/30 border border-ai-500/30 rounded-lg px-4 py-2 text-ai-300 hover:text-ai-200 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">
                    {promptCopied ? 'Copié !' : 'Copier'}
                  </span>
                </motion.button>
              </div>
              
              <div className="bg-dark-900/50 rounded-lg p-6 border border-white/10 relative overflow-hidden">
                {/* Effet de code */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-r from-ai-500/10 to-purple-500/10 flex items-center px-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <span className="text-xs text-gray-400 ml-4">prompt-nsy-website.txt</span>
                </div>
                
                <pre className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pt-8 max-h-96 overflow-y-auto">
                  {siteContent.construction.fullPrompt.content}
                </pre>
              </div>
            </div>
          </motion.div>



          {/* Ressources GitHub */}
          <motion.div variants={itemVariants} className="mb-16">
            <h3 className="text-2xl font-bold text-white text-center mb-8">
              {siteContent.construction.resources.title}
            </h3>
            
            <div className="grid lg:grid-cols-3 gap-6">
              {/* GitHub Repository */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl flex items-center justify-center">
                    <Github className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">Repository GitHub</h4>
                    <p className="text-gray-400 text-sm">
                      {siteContent.construction.resources.github.description}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  {siteContent.construction.resources.github.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => window.open('https://github.com/machouse78/nsy-website', '_blank')}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg w-full flex items-center justify-center space-x-2 hover:scale-105 transition-all duration-200"
                >
                  <Github className="w-5 h-5" />
                  <span>Voir sur GitHub</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Profil LinkedIn */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center">
                    <Linkedin className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">LinkedIn</h4>
                    <p className="text-gray-400 text-sm">
                      {siteContent.construction.resources.linkedin.description}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  {siteContent.construction.resources.linkedin.highlights.map((highlight, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{highlight}</span>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => window.open('https://www.linkedin.com/in/cédric-barme/', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg w-full flex items-center justify-center space-x-2 hover:scale-105 transition-all duration-200"
                >
                  <Linkedin className="w-5 h-5" />
                  <span>Voir le profil</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              {/* Technologies utilisées */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -5, scale: 1.02 }}
                className="glass-card p-8 glow-card"
              >
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-red-500 rounded-2xl flex items-center justify-center">
                    <Code2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">Stack Technique</h4>
                    <p className="text-gray-400 text-sm">
                      Technologies modernes utilisées
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {siteContent.construction.resources.technologies.map((tech, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="w-8 h-8 bg-gradient-to-r from-primary-400 to-red-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-xs">{index + 1}</span>
                      </div>
                      <span className="text-gray-200 font-medium">{tech}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                  <p className="text-primary-300 text-sm text-center">
                    💡 Stack moderne optimisée pour la performance et la maintenabilité
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default Construction