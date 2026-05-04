import React from 'react'
import { motion } from 'framer-motion'
import { Brain, Sparkles, Zap, Mouse } from 'lucide-react'

const LogoShowcase = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="glass-card p-8 max-w-md text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Mouse className="w-5 h-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">Effets du logo NSY</h3>
          </div>
          <p className="text-gray-400 text-sm">
            Survolez le logo dans le header pour découvrir les effets spéciaux !
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
            <Sparkles className="w-5 h-5 text-ai-400" />
            <div className="text-left">
              <h4 className="text-white text-sm font-semibold">Brillance magique</h4>
              <p className="text-gray-400 text-xs">Effet de lumière qui traverse le logo</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
            <Zap className="w-5 h-5 text-cyber-400" />
            <div className="text-left">
              <h4 className="text-white text-sm font-semibold">Badge animé</h4>
              <p className="text-gray-400 text-xs">Rotation et changement de couleur</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
            <Brain className="w-5 h-5 text-primary-400" />
            <div className="text-left">
              <h4 className="text-white text-sm font-semibold">Particules flottantes</h4>
              <p className="text-gray-400 text-xs">Éléments qui s'élèvent autour du logo</p>
            </div>
          </div>
        </div>
        
        <motion.button
          onClick={onClose}
          className="btn-primary text-sm px-6 py-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Compris !
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

export default LogoShowcase