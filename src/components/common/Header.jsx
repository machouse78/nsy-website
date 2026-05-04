import React, { useState, useEffect } from 'react'
import { Menu, X, Brain, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { siteContent } from '../../data/content'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = (href) => {
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setIsMenuOpen(false)
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-dark-900/95 backdrop-blur-md shadow-lg border-b border-white/10' 
          : 'bg-transparent'
      }`}
    >
      <nav className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <motion.div 
            className="flex items-center space-x-6 cursor-pointer group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleNavClick('#home')}
          >
            <div className="relative">
              {/* Logo NSY original agrandi et sans fond */}
              <motion.div 
                className="relative overflow-hidden"
                whileHover={{
                  filter: [
                    "drop-shadow(0 0 10px rgba(255, 215, 0, 0.3))",
                    "drop-shadow(0 0 20px rgba(255, 140, 0, 0.4))",
                    "drop-shadow(0 0 25px rgba(255, 69, 0, 0.3))",
                    "drop-shadow(0 0 10px rgba(255, 215, 0, 0.3))"
                  ],
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
                }}
              >
                {/* Effet de brillance au survol */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/30 to-transparent -skew-x-12 translate-x-[-100%]"
                  animate={{
                    translateX: ['-100%', '200%']
                  }}
                  transition={{
                    duration: 0.6,
                    ease: "easeInOut",
                    repeat: 0
                  }}
                  style={{
                    opacity: 0
                  }}
                  whileHover={{
                    opacity: 1,
                    transition: {
                      duration: 0.1
                    }
                  }}
                />
                
                <motion.img 
                  src="/nsy-logo.png" 
                  alt="NSY Logo" 
                  className="h-14 w-auto object-contain relative z-10 filter brightness-110"
                  whileHover={{
                    rotate: [0, -3, 3, 0],
                    scale: [1, 1.05, 1],
                    filter: [
                      "brightness(110%) saturate(100%)",
                      "brightness(130%) saturate(120%)",
                      "brightness(110%) saturate(100%)"
                    ]
                  }}
                  transition={{
                    duration: 0.8,
                    ease: "easeInOut"
                  }}
                  onError={(e) => {
                    // Fallback si le logo ne charge pas
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                
                {/* Fallback logo généré */}
                <div className="h-14 w-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg items-center justify-center hidden">
                  <Brain className="w-8 h-8 text-white" />
                </div>
              </motion.div>
              
              {/* Badge IA avec animation et couleurs du logo */}
              <motion.div 
                className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg"
                whileHover={{
                  scale: [1, 1.4, 1.2],
                  rotate: [0, 180, 360],
                  background: [
                    "linear-gradient(to right, rgb(249, 115, 22), rgb(239, 68, 68))",
                    "linear-gradient(to right, rgb(255, 215, 0), rgb(255, 140, 0))",
                    "linear-gradient(to right, rgb(255, 69, 0), rgb(220, 38, 127))",
                    "linear-gradient(to right, rgb(249, 115, 22), rgb(239, 68, 68))"
                  ]
                }}
                transition={{
                  duration: 1.5,
                  ease: "easeInOut",
                  repeat: 0
                }}
              >
                <Zap className="w-3 h-3 text-white" />
              </motion.div>
              
              {/* Particules dorées flottantes au survol */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      left: `${10 + (i * 10)}%`,
                      top: `${20 + (i % 3) * 25}%`,
                      background: i % 2 === 0 ? '#FFD700' : '#FF8C00'
                    }}
                    animate={{
                      y: [-10, -25, -10],
                      opacity: [0, 0.8, 0],
                      scale: [0, 1.2, 0]
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.15,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </motion.div>
              
              {/* Halo lumineux subtil */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 0.6 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute inset-0 bg-gradient-radial from-yellow-400/20 via-orange-400/10 to-transparent rounded-full scale-150 blur-sm"></div>
              </motion.div>
            </div>
            
            {/* Texte avec animation au survol - décalé plus à droite */}
            <motion.div
              className="ml-2"
              whileHover={{
                x: 5
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.p 
                className="text-lg font-medium text-gray-300 group-hover:text-yellow-300 transition-colors duration-300"
              >
                AI & Digital Solutions
              </motion.p>
            </motion.div>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {siteContent.navigation.map((item) => (
              <motion.button
                key={item.name}
                onClick={() => handleNavClick(item.href)}
                className="text-gray-300 hover:text-white transition-colors duration-200 font-medium"
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
              >
                {item.name}
              </motion.button>
            ))}
            <motion.button
              onClick={() => handleNavClick('#contact')}
              className="btn-primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Me contacter
            </motion.button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-white p-2"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/10"
            >
              <div className="py-4 space-y-4">
                {siteContent.navigation.map((item) => (
                  <motion.button
                    key={item.name}
                    onClick={() => handleNavClick(item.href)}
                    className="block w-full text-left text-gray-300 hover:text-white transition-colors duration-200 py-2"
                    whileHover={{ x: 10 }}
                  >
                    {item.name}
                  </motion.button>
                ))}
                <motion.button
                  onClick={() => handleNavClick('#contact')}
                  className="btn-primary w-full mt-4"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Me contacter
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  )
}

export default Header