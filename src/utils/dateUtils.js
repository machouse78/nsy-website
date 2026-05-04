/**
 * Utilitaires pour les calculs de dates et d'expérience
 */

// Année de début d'expérience de Cédric Barme (basée sur les données NSY.fr originales)
const EXPERIENCE_START_YEAR = 2012

/**
 * Calcule le nombre d'années d'expérience depuis l'année de début
 * @returns {number} Nombre d'années d'expérience
 */
export const calculateExperience = () => {
  const currentYear = new Date().getFullYear()
  return currentYear - EXPERIENCE_START_YEAR
}

/**
 * Obtient l'année courante pour le copyright
 * @returns {number} Année courante
 */
export const getCurrentYear = () => {
  return new Date().getFullYear()
}

/**
 * Formate l'expérience pour l'affichage (ex: "14+")
 * @returns {string} Expérience formatée
 */
export const getFormattedExperience = () => {
  return `${calculateExperience()}+`
}

/**
 * Obtient le texte descriptif avec l'expérience dynamique
 * @returns {string} Texte avec années d'expérience
 */
export const getExperienceDescription = () => {
  const years = calculateExperience()
  return `Avec plus de ${years} ans d'expérience`
}

/**
 * Calcule les statistiques avec expérience dynamique et technologies fixes
 * @returns {object} Statistiques calculées
 */
export const calculateStats = () => {
  const experience = calculateExperience()
  
  return {
    experience: `${experience}+`,
    technologies: "20+", // Valeur fixe comme demandé
    clients: "2", // Reste constant
    expertise: "Full-Stack" // Reste constant
  }
}