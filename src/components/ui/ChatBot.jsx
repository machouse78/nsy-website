import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  User, 
  Zap,
  Brain,
  Sparkles,
  Clock
} from 'lucide-react'
import { getFormattedExperience, calculateStats } from '../../utils/dateUtils'

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "👋 Bonjour ! Je suis l'assistant IA de NSY. Comment puis-je vous aider avec vos projets numériques ?",
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Réponses prédéfinies du chatbot
  const getBotResponse = (userMessage) => {
    const message = userMessage.toLowerCase()
    
    if (message.includes('salut') || message.includes('bonjour') || message.includes('hello')) {
      return "Bonjour ! 🌟 Je suis ravi de vous rencontrer. Parlez-moi de votre projet digital ou posez-moi vos questions sur l'IA !"
    }
    
    if (message.includes('ia') || message.includes('intelligence artificielle') || message.includes('ai')) {
      return "🤖 L'IA est ma spécialité ! NSY peut vous aider avec :\n• Intégration d'IA générative\n• Automatisation intelligente\n• Chatbots personnalisés\n• Analyse prédictive\n\nQuel aspect vous intéresse le plus ?"
    }
    
    if (message.includes('projet') || message.includes('développement') || message.includes('site')) {
      return "🚀 Excellent ! NSY accompagne tous types de projets :\n• Applications web modernes\n• Sites responsive\n• Solutions sur-mesure\n• Intégration IA\n\nPouvez-vous me parler de votre besoin spécifique ?"
    }
    
    if (message.includes('prix') || message.includes('tarif') || message.includes('coût') || message.includes('budget')) {
      return "💡 Chaque projet est unique ! Le tarif dépend de :\n• Complexité technique\n• Fonctionnalités souhaitées\n• Délais de réalisation\n• Technologies utilisées\n\nJe vous propose un devis gratuit personnalisé. Contactez directement Cédric !"
    }
    
    if (message.includes('contact') || message.includes('rendez-vous') || message.includes('rdv')) {
      return "📞 Parfait ! Voici les coordonnées de Cédric :\n• Email : cedric.barme@nsy.fr\n• Téléphone : 06 72 94 71 06\n• LinkedIn : Cédric Barme\n\nDisponible du lundi au vendredi, 9h-18h. N'hésitez pas à me contacter ! ✨"
    }
    
    if (message.includes('expérience') || message.includes('compétence') || message.includes('expertise')) {
      const stats = calculateStats()
      return `🎯 NSY c'est ${stats.experience} années d'expertise :\n• React, Node.js, Java EE\n• Intelligence Artificielle\n• Automatisation\n• ${stats.technologies} technologies maîtrisées\n• Accompagnement personnalisé de clients\n\nUne question technique spécifique ?`
    }
    
    if (message.includes('délai') || message.includes('temps') || message.includes('durée') || message.includes('quand')) {
      return "⏰ Les délais dépendent du projet :\n• Site vitrine : 2-4 semaines\n• Application web : 1-3 mois\n• Intégration IA : 3-6 semaines\n• Projet sur-mesure : sur devis\n\nMéthodologie agile avec livraisons régulières ! 🚀"
    }
    
    if (message.includes('merci') || message.includes('super') || message.includes('parfait')) {
      return "😊 De rien ! Je suis là pour vous accompagner. N'hésitez pas à contacter Cédric directement pour approfondir votre projet. Bonne journée ! ✨"
    }
    
    // Réponse par défaut
    return "🤔 C'est une excellente question ! Pour une réponse personnalisée et détaillée, je vous recommande de contacter directement Cédric :\n• cedric.barme@nsy.fr\n• 06 72 94 71 06\n\nIl sera ravi de discuter de votre projet spécifique ! 💡"
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulation de délai de réponse IA
    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        type: 'bot',
        content: getBotResponse(inputValue),
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, botResponse])
      setIsTyping(false)
    }, 1000 + Math.random() * 2000) // Délai réaliste 1-3s
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      {/* Bouton flottant du chatbot */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-r from-primary-500 to-red-500 hover:from-primary-600 hover:to-red-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 2, type: "spring" }}
      >
        <div className="relative">
          <MessageCircle className="w-8 h-8 text-white" />
          {/* Badge IA pulsant */}
          <motion.div
            className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Brain className="w-3 h-3 text-white" />
          </motion.div>
          
          {/* Particules flottantes */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                style={{
                  left: `${20 + i * 20}%`,
                  top: `${30 + (i % 2) * 40}%`,
                }}
                animate={{
                  y: [-5, -15, -5],
                  opacity: [0.7, 1, 0.7],
                  scale: [0.8, 1.2, 0.8]
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>
        </div>
        
        {/* Tooltip */}
        <motion.div
          className="absolute bottom-full right-0 mb-2 bg-dark-800 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ y: 10, opacity: 0 }}
          whileHover={{ y: 0, opacity: 1 }}
        >
          Assistant IA NSY
          <div className="absolute top-full right-4 w-2 h-2 bg-dark-800 rotate-45"></div>
        </motion.div>
      </motion.button>

      {/* Fenêtre de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-dark-800 rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
            initial={{ scale: 0, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0, y: 100, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Header du chat */}
            <div className="bg-gradient-to-r from-primary-500 to-red-500 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <motion.div
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Assistant IA NSY</h3>
                  <div className="flex items-center space-x-1 text-xs text-white/80">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>En ligne • Powered by AI</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 h-80">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.type === 'user' 
                        ? 'bg-primary-500' 
                        : 'bg-gradient-to-r from-primary-500 to-red-500'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={`rounded-2xl p-3 ${
                      message.type === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 text-gray-100 border border-white/10'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                      <div className="flex items-center justify-end mt-1 space-x-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {message.timestamp.toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {/* Indicateur de saisie */}
              {isTyping && (
                <motion.div
                  className="flex justify-start"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-red-500 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex space-x-1">
                        {[...Array(3)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-primary-400 rounded-full"
                            animate={{ scale: [1, 1.5, 1] }}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              delay: i * 0.2
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de saisie */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Posez votre question sur l'IA, vos projets..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-primary-500 transition-colors"
                    rows={1}
                  />
                </div>
                <motion.button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="w-10 h-10 bg-gradient-to-r from-primary-500 to-red-500 hover:from-primary-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              </div>
              
              {/* Suggestions rapides */}
              <div className="flex flex-wrap gap-2 mt-2">
                {['Mes services IA', 'Tarifs', 'Contact'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputValue(suggestion)}
                    className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-500/50 rounded-full px-3 py-1 text-gray-300 hover:text-white transition-all duration-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ChatBot