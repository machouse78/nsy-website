import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('📝 Création du favicon basé sur le logo NSY...');

// Favicon SVG simple basé sur le concept du logo NSY
const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <!-- Dégradé basé sur les couleurs du logo NSY -->
    <linearGradient id="nsyBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f97316"/>
      <stop offset="50%" style="stop-color:#ef4444"/>
      <stop offset="100%" style="stop-color:#fbbf24"/>
    </linearGradient>
    <linearGradient id="textGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff"/>
      <stop offset="100%" style="stop-color:#f0f0f0"/>
    </linearGradient>
  </defs>
  
  <!-- Fond avec coins arrondis modernes -->
  <rect width="32" height="32" rx="8" fill="url(#nsyBg)"/>
  
  <!-- Lettres NSY avec style moderne -->
  <text x="16" y="21" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" 
        font-size="12" 
        font-weight="700" 
        text-anchor="middle" 
        fill="url(#textGlow)">NSY</text>
  
  <!-- Badge IA discret -->
  <circle cx="26" cy="6" r="3" fill="#d946ef"/>
  <text x="26" y="8" 
        font-family="system-ui" 
        font-size="4" 
        font-weight="700" 
        text-anchor="middle" 
        fill="white">AI</text>
</svg>`;

// Sauvegarder le favicon
const faviconPath = path.join(__dirname, 'public', 'favicon.svg');
fs.writeFileSync(faviconPath, faviconSVG);

console.log('✅ Favicon SVG créé avec succès !');
console.log('📁 Sauvegardé dans : public/favicon.svg');
console.log('🎨 Design basé sur les couleurs du logo NSY');
console.log('🔄 Rechargez votre navigateur pour voir le nouveau favicon');

// Créer aussi un favicon.ico simple
console.log('💡 Pour un favicon.ico parfait, vous pouvez :');
console.log('1. Ouvrir le logo NSY dans un éditeur d\'image');
console.log('2. Le redimensionner en 32x32 puis 16x16');
console.log('3. L\'exporter en .ico');
console.log('4. Le placer dans public/favicon.ico');