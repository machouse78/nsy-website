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
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.18, // --dur-2
        ease: [0.165, 0.84, 0.44, 1] // --ease-out-quart
      }}
      className={`fixed top-0 left-0 right-0 z-50 ${
        isScrolled 
          ? 'bg-dark-900/95 backdrop-blur-md shadow-lg border-b border-white/10' 
          : 'bg-transparent'
      }`}
      style={{
        transition: 'background-color 150ms ease, backdrop-filter 150ms ease' // Subtle state change
      }}
    >
      <nav className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <motion.div 
            className="flex items-center space-x-6 cursor-pointer group"
            whileHover={{ scale: 1.02 }} // Subtle scale for hover
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15, ease: "ease" }} // Built-in ease for hover
            onClick={() => handleNavClick('#home')}
          >
            <div className="relative">
              {/* Logo NSY original agrandi et sans fond */}
              <motion.div 
                className="relative overflow-hidden motion-hover"
                whileHover={{
                  filter: "drop-shadow(0 0 12px rgba(59, 130, 246, 0.4))" // Subtle glow NSY blue
                }}
              >
                
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
              
              {/* Badge IA - subtle hover selon motion design */}
              <motion.div 
                className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg motion-hover"
                whileHover={{ scale: 1.1 }}
              >
                <Zap className="w-3 h-3 text-white" />
              </motion.div>
              

            </div>
            
            {/* Texte avec hover subtil */}
            <div className="ml-2">
              <p className="text-lg font-medium text-gray-300 group-hover:text-white motion-hover">
                AI & Digital Solutions
              </p>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {siteContent.navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavClick(item.href)}
                className="text-gray-300 hover:text-white motion-hover font-medium"
              >
                {item.name}
              </button>
            ))}
            <motion.button
              onClick={() => handleNavClick('#contact')}
              className="btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ 
                duration: 0.12, // --dur-1 for button press feedback
                ease: [0.25, 0.46, 0.45, 0.94] // --ease-out-quad for button press
              }}
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

        {/* Mobile Navigation - Enter/Exit pattern according to motion design skill */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ 
                opacity: 0, 
                scale: 0.96,
                height: 0 
              }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                height: 'auto' 
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.96,
                height: 0 
              }}
              transition={{
                duration: 0.18, // --dur-2
                ease: [0.165, 0.84, 0.44, 1] // --ease-out-quart for dropdown
              }}
              className="md:hidden border-t border-white/10 overflow-hidden"
              style={{ transformOrigin: 'top center' }}
            >
              <div className="py-4 space-y-4">
                {siteContent.navigation.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => handleNavClick(item.href)}
                    className="block w-full text-left text-gray-300 hover:text-white motion-hover py-2"
                  >
                    {item.name}
                  </button>
                ))}
                <motion.button
                  onClick={() => handleNavClick('#contact')}
                  className="btn-primary w-full mt-4"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ 
                    duration: 0.12,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
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