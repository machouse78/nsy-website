import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Mail, 
  Phone, 
  Linkedin, 
  Clock,
  Send,
  MapPin,
  MessageSquare,
  CheckCircle
} from 'lucide-react'
import { siteContent } from '../data/content'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      // Reset form after 3 seconds
      setTimeout(() => {
        setIsSubmitted(false)
        setFormData({ name: '', email: '', subject: '', message: '' })
      }, 3000)
    }, 1000)
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
    <section id="contact" className="section-padding bg-dark-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyber-500/5 rounded-full blur-3xl"></div>
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
              <MessageSquare className="w-4 h-4 text-primary-400" />
              <span className="text-primary-400 text-sm font-medium">CONTACT</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-white">Discutons de votre projet</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Prêt à transformer vos idées en réalité ? Contactez-moi pour démarrer 
              votre projet dès aujourd'hui.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left Column - Contact Info */}
            <motion.div variants={itemVariants} className="space-y-8">
              <div className="glass-card p-8 glow-card">
                <h3 className="text-2xl font-bold text-white mb-6">
                  Informations de contact
                </h3>
                
                <div className="space-y-6">
                  {/* Email */}
                  <motion.a
                    href={`mailto:${siteContent.contact.email}`}
                    className="flex items-center space-x-4 p-4 rounded-lg hover:bg-white/5 transition-colors group"
                    whileHover={{ x: 10 }}
                  >
                    <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-primary-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Email</h4>
                      <p className="text-primary-400">{siteContent.contact.email}</p>
                    </div>
                  </motion.a>

                  {/* Phone */}
                  <motion.a
                    href={`tel:${siteContent.contact.phone}`}
                    className="flex items-center space-x-4 p-4 rounded-lg hover:bg-white/5 transition-colors group"
                    whileHover={{ x: 10 }}
                  >
                    <div className="w-12 h-12 bg-gradient-to-r from-cyber-500 to-cyber-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Téléphone</h4>
                      <p className="text-cyan-400">{siteContent.contact.phone}</p>
                    </div>
                  </motion.a>

                  {/* LinkedIn */}
                  <motion.a
                    href={siteContent.contact.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-4 p-4 rounded-lg hover:bg-white/5 transition-colors group"
                    whileHover={{ x: 10 }}
                  >
                    <div className="w-12 h-12 bg-gradient-to-r from-ai-500 to-ai-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Linkedin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">LinkedIn</h4>
                      <p className="text-ai-400">Cédric Barme</p>
                    </div>
                  </motion.a>

                  {/* Availability */}
                  <div className="flex items-center space-x-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Disponibilité</h4>
                      <p className="text-green-400">{siteContent.contact.availability}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Response Time */}
              <motion.div variants={itemVariants} className="glass-card p-6 glow-card">
                <div className="flex items-center space-x-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <h4 className="font-semibold text-white">Engagement qualité</h4>
                </div>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li>• Réponse sous 24h maximum</li>
                  <li>• Devis gratuit et détaillé</li>
                  <li>• Accompagnement personnalisé</li>
                </ul>
              </motion.div>
            </motion.div>

            {/* Right Column - Contact Form */}
            <motion.div variants={itemVariants}>
              <div className="glass-card p-8 glow-card">
                <h3 className="text-2xl font-bold text-white mb-6">
                  Envoyez-moi un message
                </h3>

                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h4 className="text-xl font-bold text-white mb-2">Message envoyé !</h4>
                    <p className="text-gray-400">Je vous répondrai dans les plus brefs délais.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">
                          Nom complet
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:bg-white/10 transition-all"
                          placeholder="Votre nom"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:bg-white/10 transition-all"
                          placeholder="votre@email.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Sujet
                      </label>
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:bg-white/10 transition-all"
                        placeholder="Ex: Développement d'une application web"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Message
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:bg-white/10 transition-all resize-none"
                        placeholder="Décrivez votre projet, vos besoins et vos objectifs..."
                      />
                    </div>

                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full btn-primary flex items-center justify-center space-x-2 ${
                        isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                      whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                      whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Envoi en cours...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          <span>Envoyer le message</span>
                        </>
                      )}
                    </motion.button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Contact