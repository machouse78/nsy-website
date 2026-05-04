import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const LogoAnimation = ({ autoPlay = true, duration = 5000 }) => {
  const canvasRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  
  // Utiliser useRef pour les valeurs dans l'animation
  const mousePosRef = useRef({ x: 0, y: 0 })
  const isHoveringRef = useRef(false)

  // Gestion du mouvement de la souris
  const handleMouseMove = (e) => {
    const container = e.currentTarget
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    console.log('Mouse move:', x, y, 'hovering:', isHoveringRef.current) // Debug
    setMousePos({ x, y })
    mousePosRef.current = { x, y }
  }

  const handleMouseEnter = () => {
    console.log('Mouse enter') // Debug
    setIsHovering(true)
    isHoveringRef.current = true
  }

  const handleMouseLeave = () => {
    console.log('Mouse leave') // Debug
    setIsHovering(false)
    isHoveringRef.current = false
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    
    // Configuration responsive
    const container = canvas.parentElement
    const size = Math.min(container.offsetWidth, 400)
    canvas.width = size
    canvas.height = size
    
    let animationId
    const particles = []
    const particleCount = 50
    

    
    // Classe particule IA
    class AIParticle {
      constructor() {
        this.reset()
      }
      
      reset() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.vx = (Math.random() - 0.5) * 2
        this.vy = (Math.random() - 0.5) * 2
        this.size = Math.random() * 3 + 1
        this.opacity = Math.random() * 0.8 + 0.2
        this.color = Math.random() > 0.5 ? '#f97316' : '#fbbf24' // Couleurs logo NSY
        this.life = 0
        this.maxLife = Math.random() * 200 + 100
        this.baseColor = Math.random() > 0.5 ? '#f97316' : '#fbbf24' // Couleurs de base NSY
      }
      
      update(mouseX, mouseY, isHovering) {
        this.x += this.vx
        this.y += this.vy
        this.life++
        
        // Fade out avec le temps
        this.opacity = Math.max(0, 1 - (this.life / this.maxLife))
        
        if (this.life > this.maxLife) {
          this.reset()
        }
        
        // Gravitation et effet aimant
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        
        if (isHovering && mouseX !== undefined && mouseY !== undefined) {
          // Distance à la souris
          const mouseDistance = Math.sqrt((mouseX - this.x) ** 2 + (mouseY - this.y) ** 2)
          
          if (mouseDistance < 120) {
            // Force magnétique forte vers la souris
            const magneticForce = (120 - mouseDistance) / 120 * 0.01
            const dx = mouseX - this.x
            const dy = mouseY - this.y
            
            this.vx += dx * magneticForce
            this.vy += dy * magneticForce
            
            // Particules plus lumineuses près de la souris
            this.opacity = Math.min(1, this.opacity * (1 + magneticForce * 10))
          } else {
            // Gravitation normale vers le centre
            const dx = centerX - this.x
            const dy = centerY - this.y
            this.vx += dx * 0.0001
            this.vy += dy * 0.0001
          }
        } else {
          // Gravitation normale vers le centre
          const dx = centerX - this.x
          const dy = centerY - this.y
          this.vx += dx * 0.0001
          this.vy += dy * 0.0001
        }
        
        // Friction
        this.vx *= 0.95
        this.vy *= 0.95
      }
      
      draw(isHovering, mouseX, mouseY) {
        ctx.globalAlpha = this.opacity
        
        // Changement de couleur vers bleu NSY si proche de la souris
        let particleColor = this.baseColor
        if (isHovering && mouseX !== undefined && mouseY !== undefined) {
          const distance = Math.sqrt((mouseX - this.x) ** 2 + (mouseY - this.y) ** 2)
          if (distance < 80) {
            particleColor = '#3b82f6' // Bleu NSY
            // Particule plus grosse quand attirée
            this.size = Math.min(5, this.size * 1.5)
          } else {
            this.size = Math.max(1, this.size * 0.95) // Retour taille normale
          }
        }
        
        ctx.fillStyle = particleColor
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
    
    // Initialiser les particules
    for (let i = 0; i < particleCount; i++) {
      particles.push(new AIParticle())
    }
    
    let frame = 0
    
    const animate = () => {
      // Clear avec effet de traînée
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Dessiner les connexions entre particules (couleur adaptative)
      const connectionColor = isHoveringRef.current ? 'rgba(59, 130, 246, 0.4)' : 'rgba(249, 115, 22, 0.3)'
      ctx.strokeStyle = connectionColor
      ctx.lineWidth = isHoveringRef.current ? 2 : 1
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          const maxDistance = isHoveringRef.current ? 100 : 80
          if (distance < maxDistance) {
            const opacity = (maxDistance - distance) / maxDistance * 0.5
            ctx.globalAlpha = opacity
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }
      
      // Mettre à jour et dessiner les particules avec effet aimant
      particles.forEach(particle => {
        particle.update(mousePosRef.current.x, mousePosRef.current.y, isHoveringRef.current)
        particle.draw(isHoveringRef.current, mousePosRef.current.x, mousePosRef.current.y)
      })
      
      // Effet de pulsation centrale et aimant souris
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const basePulseRadius = 30 + Math.sin(frame * 0.05) * 10
      const pulseRadius = isHoveringRef.current ? basePulseRadius * 1.5 : basePulseRadius
      
      // Pulsation centrale (logo)
      const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRadius)
      centerGradient.addColorStop(0, 'rgba(249, 115, 22, 0.8)')
      centerGradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)')
      centerGradient.addColorStop(1, 'rgba(251, 191, 36, 0.1)')
      
      ctx.fillStyle = centerGradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2)
      ctx.fill()
      
      // Effet aimant à la position de la souris (si survol)
      if (isHoveringRef.current && mousePosRef.current.x && mousePosRef.current.y) {
        const magnetRadius = 50 + Math.sin(frame * 0.08) * 15
        
        // Halo magnétique qui change vers le bleu
        const magnetGradient = ctx.createRadialGradient(
          mousePosRef.current.x, mousePosRef.current.y, 0, 
          mousePosRef.current.x, mousePosRef.current.y, magnetRadius
        )
        magnetGradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)') // Bleu NSY au centre
        magnetGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.4)') // Bleu-violet
        magnetGradient.addColorStop(1, 'rgba(139, 92, 246, 0.2)') // Violet transparent
        
        ctx.fillStyle = magnetGradient
        ctx.beginPath()
        ctx.arc(mousePosRef.current.x, mousePosRef.current.y, magnetRadius, 0, Math.PI * 2)
        ctx.fill()
        
        // Cercle de l'aimant bleu
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(mousePosRef.current.x, mousePosRef.current.y, magnetRadius * 0.6, 0, Math.PI * 2)
        ctx.stroke()
        
        // Cercle extérieur pulsant
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(mousePosRef.current.x, mousePosRef.current.y, magnetRadius * 1.2, 0, Math.PI * 2)
        ctx.stroke()
      }
      
      frame++
      animationId = requestAnimationFrame(animate)
    }
    
    if (autoPlay) {
      animate()
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [autoPlay, mousePos, isHovering])

  return (
    <div 
      className="relative w-full aspect-square max-w-md mx-auto bg-dark-900/50 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'crosshair' }}
    >
      {/* Canvas d'animation */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      
      {/* Zone de détection invisible */}
      <div className="absolute inset-0 w-full h-full" style={{ background: 'transparent', zIndex: 10 }} />
      
      {/* Logo NSY superposé */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 1 }}
      >
        <motion.img
          src="/nsy-logo.png"
          alt="NSY Logo"
          className="w-40 h-40 md:w-48 md:h-48 object-contain filter drop-shadow-2xl"
          animate={{
            scale: isHovering ? [1, 1.2, 1.1] : [1, 1.1, 1],
            filter: [
              "brightness(120%) contrast(110%)",
              "brightness(140%) contrast(120%) saturate(120%)",
              "brightness(120%) contrast(110%)"
            ],
            rotate: isHovering ? [0, 2, -2, 0] : 0
          }}
          transition={{
            duration: isHovering ? 1 : 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>
      
      {/* Texte animé */}
      <motion.div
        className="absolute bottom-6 left-0 right-0 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 2 }}
      >
        <motion.h3
          className="text-xl font-bold gradient-text"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          AI & Digital Solutions
        </motion.h3>
        
        {/* Indicateur interaction */}
        {isHovering && (
          <motion.p
            className="text-xs text-yellow-300 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            🧲 Effet magnétique actif
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}

export default LogoAnimation