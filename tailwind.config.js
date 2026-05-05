/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs principales basées sur le logo NSY (orange/rouge/doré)
        primary: {
          50: '#fef7ed',
          100: '#fdedd3',
          200: '#fbd6a5',
          300: '#f8b86d',
          400: '#f59332',
          500: '#f97316', // Orange principal du logo
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // On utilise les couleurs red native de Tailwind pour le rouge
        // red-500: #ef4444 (correspond exactement au rouge du logo)
        // On utilise les couleurs yellow native de Tailwind pour le doré
        // yellow-400: #fbbf24 (proche du doré du logo)
        // Couleurs d'accent pour l'IA (gardées pour cohérence)
        ai: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        // Couleurs cyber pour les aspects technologiques
        cyber: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4', // Cyan principal
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        // Display font distinctive pour les titres - Editorial/Magazine style
        display: ['Playfair Display', 'Georgia', 'serif'],
        // Sans moderne mais caractérielle pour le corps - évite Inter/Roboto
        sans: ['Clash Display', 'Epilogue', 'system-ui', 'sans-serif'], 
        // Body refined pour le texte - élégant et lisible (générera font-body)
        body: ['Satoshi', 'Source Sans Pro', 'sans-serif'],
        // Mono technique pour le code
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'nsy-gradient': 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #fbbf24 100%)',
        'nsy-warm': 'linear-gradient(135deg, #fed7aa 0%, #fecaca 50%, #fde68a 100%)',
        'ai-gradient': 'linear-gradient(135deg, #f97316 0%, #d946ef 50%, #ef4444 100%)',
        'hero-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #451a03 70%, #7c2d12 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #3b82f6, 0 0 10px #3b82f6, 0 0 15px #3b82f6' },
          '100%': { boxShadow: '0 0 10px #3b82f6, 0 0 20px #3b82f6, 0 0 30px #3b82f6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}