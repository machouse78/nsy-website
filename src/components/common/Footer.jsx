import React from 'react'
import { motion } from 'framer-motion'
import { Brain, Mail, Phone, Linkedin, Heart, Sparkles } from 'lucide-react'
import { siteContent } from '../../data/content'

const Footer = () => {
  const currentYear = new Date().getFullYear()

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

  const handleNavClick = (href) => {
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="bg-dark-900 border-t border-white/10 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="py-16"
        >
          {/* Main Footer Content */}
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 mb-12">
            {/* Brand Column */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <motion.div 
                className="flex items-center space-x-3 mb-6 cursor-pointer group"
                whileHover={{ scale: 1.02 }}
                onClick={() => handleNavClick('#home')}
              >
                <div className="relative">
                  {/* Logo NSY original avec effets spéciaux */}
                  <motion.div 
                    className="relative overflow-hidden"
                    whileHover={{
                      filter: [
                        "drop-shadow(0 0 10px rgba(249, 115, 22, 0.3))",
                        "drop-shadow(0 0 20px rgba(239, 68, 68, 0.4))",
                        "drop-shadow(0 0 25px rgba(245, 158, 11, 0.3))",
                        "drop-shadow(0 0 10px rgba(249, 115, 22, 0.3))"
                      ],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{
                      duration: 2,
                      ease: "easeInOut"
                    }}
                  >
                    {/* Effet de pulsation lumineuse */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-radial from-yellow-400/20 to-transparent rounded-xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 0.8 }}
                    />
                    
                    <motion.img 
                      src="/nsy-logo.png" 
                      alt="NSY Logo" 
                      className="h-12 w-auto object-contain relative z-10 filter brightness-110"
                      whileHover={{
                        scale: [1, 1.05, 1],
                        filter: [
                          "brightness(110%)",
                          "brightness(130%) saturate(120%)",
                          "brightness(110%)"
                        ]
                      }}
                      transition={{
                        duration: 0.6,
                        ease: "easeInOut"
                      }}
                      onError={(e) => {
                        // Fallback si le logo ne charge pas
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    
                    {/* Fallback logo généré */}
                    <div className="h-12 w-16 bg-gradient-to-r from-primary-500 to-red-500 rounded-xl items-center justify-center hidden">
                      <Brain className="w-7 h-7 text-white" />
                    </div>
                  </motion.div>
                  
                  {/* Badge IA avec rotation */}
                  <motion.div 
                    className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-primary-500 to-red-500 rounded-full flex items-center justify-center shadow-lg"
                    whileHover={{
                      scale: [1, 1.4, 1.2],
                      rotate: [0, 360],
                      background: [
                        "linear-gradient(to right, rgb(249, 115, 22), rgb(239, 68, 68))",
                        "linear-gradient(to right, rgb(245, 158, 11), rgb(249, 115, 22))",
                        "linear-gradient(to right, rgb(239, 68, 68), rgb(245, 158, 11))",
                        "linear-gradient(to right, rgb(249, 115, 22), rgb(239, 68, 68))"
                      ]
                    }}
                    transition={{
                      duration: 1.2,
                      ease: "easeInOut"
                    }}
                  >
                    <Sparkles className="w-2 h-2 text-white" />
                  </motion.div>
                  
                  {/* Anneaux de lumière au survol */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {[1, 2, 3].map((ring) => (
                      <motion.div
                        key={ring}
                        className="absolute inset-0 border rounded-xl"
                        style={{
                          borderColor: ring === 1 ? 'rgba(249, 115, 22, 0.3)' : 
                                      ring === 2 ? 'rgba(239, 68, 68, 0.3)' : 
                                      'rgba(245, 158, 11, 0.3)'
                        }}
                        animate={{
                          scale: [1, 1.2 + ring * 0.1, 1],
                          opacity: [0.8, 0, 0.8]
                        }}
                        transition={{
                          duration: 2,
                          delay: ring * 0.2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                  </motion.div>
                </div>
                
                <motion.div
                  whileHover={{ x: 3 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <p className="text-lg font-medium text-gray-300 group-hover:text-yellow-300 transition-colors duration-300">
                    AI & Digital Solutions
                  </p>
                </motion.div>
              </motion.div>
              
              <p className="text-gray-400 leading-relaxed mb-6 max-w-lg">
                {siteContent.company.description}
              </p>
              
              <div className="flex items-center space-x-4">
                <motion.a
                  href={`mailto:${siteContent.contact.email}`}
                  className="w-10 h-10 bg-white/5 hover:bg-primary-500/20 border border-white/10 hover:border-primary-500/30 rounded-lg flex items-center justify-center transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Mail className="w-5 h-5 text-gray-400 hover:text-primary-400" />
                </motion.a>
                
                <motion.a
                  href={`tel:${siteContent.contact.phone}`}
                  className="w-10 h-10 bg-white/5 hover:bg-cyber-500/20 border border-white/10 hover:border-cyber-500/30 rounded-lg flex items-center justify-center transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Phone className="w-5 h-5 text-gray-400 hover:text-cyber-400" />
                </motion.a>
                
                <motion.a
                  href={siteContent.contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-white/5 hover:bg-ai-500/20 border border-white/10 hover:border-ai-500/30 rounded-lg flex items-center justify-center transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Linkedin className="w-5 h-5 text-gray-400 hover:text-ai-400" />
                </motion.a>
              </div>
            </motion.div>

            {/* Navigation Links */}
            <motion.div variants={itemVariants}>
              <h4 className="text-white font-semibold mb-4">Navigation</h4>
              <ul className="space-y-3">
                {siteContent.navigation.slice(0, 4).map((item) => (
                  <li key={item.name}>
                    <button
                      onClick={() => handleNavClick(item.href)}
                      className="text-gray-400 hover:text-white transition-colors duration-200"
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Services Links */}
            <motion.div variants={itemVariants}>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => handleNavClick('#services')}
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Développement Full-Stack
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNavClick('#ai')}
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Intelligence Artificielle
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNavClick('#services')}
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Automatisation
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNavClick('#construction')}
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Construction du site
                  </button>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* AI Attribution Section */}
          <motion.div 
            variants={itemVariants}
            className="border-t border-white/10 pt-8 mb-8"
          >
            <div className="glass-card p-6 glow-card">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Brain className="w-6 h-6 text-ai-400" />
                <Sparkles className="w-5 h-5 text-cyber-400" />
                <h4 className="text-lg font-semibold gradient-text">Powered by AI</h4>
              </div>
              <p className="text-center text-gray-400 text-sm leading-relaxed max-w-3xl mx-auto">
                {siteContent.footer.aiMention}
              </p>
            </div>
          </motion.div>

          {/* Bottom Footer */}
          <motion.div 
            variants={itemVariants}
            className="border-t border-white/10 pt-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              {/* Copyright */}
              <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <span>{siteContent.footer.copyright.replace('2024', currentYear)}</span>
                <Heart className="w-4 h-4 text-red-400" />
                <span>Fait avec passion</span>
              </div>

              {/* Legal Links */}
              <div className="flex items-center space-x-6 text-sm">
                {siteContent.footer.links.map((link) => (
                  <button
                    key={link.name}
                    onClick={() => handleNavClick(link.href)}
                    className="text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </footer>
  )
}

export default Footer