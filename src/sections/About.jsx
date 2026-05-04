import React from 'react'
import { motion } from 'framer-motion'
import { Code, Users, Lightbulb, Shield, Award, Target } from 'lucide-react'
import { siteContent } from '../data/content'

const About = () => {
  const iconMap = {
    Code,
    Users,
    Lightbulb,
    Shield,
    Award,
    Target
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
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6 }
    }
  }

  return (
    <section id="about" className="section-padding bg-dark-800/50">
      <div className="container">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-6 py-2 mb-6">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span className="text-primary-400 text-sm font-medium">À PROPOS</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">{siteContent.about.title}</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              {siteContent.about.subtitle}
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
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