import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logoUrl = 'http://nsy.fr/wp-content/uploads/2019/05/cropped-NSY-logo-1.png';
const logoPath = path.join(__dirname, 'public', 'nsy-logo.png');

console.log('📥 Téléchargement du logo NSY...');

// Créer le dossier public s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, 'public'))) {
  fs.mkdirSync(path.join(__dirname, 'public'));
}

// Télécharger le logo
const file = fs.createWriteStream(logoPath);

const request = https.get(logoUrl.replace('http:', 'https:'), (response) => {
  if (response.statusCode === 200) {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('✅ Logo NSY téléchargé avec succès !');
      console.log('📁 Sauvegardé dans : public/nsy-logo.png');
      console.log('🔄 Rechargez votre navigateur pour voir le nouveau logo');
    });
  } else {
    console.error('❌ Erreur lors du téléchargement:', response.statusCode);
    file.close();
    fs.unlinkSync(logoPath); // Supprimer le fichier vide en cas d'erreur
  }
});

request.on('error', (err) => {
  console.error('❌ Erreur de téléchargement:', err.message);
  file.close();
  if (fs.existsSync(logoPath)) {
    fs.unlinkSync(logoPath);
  }
});

request.end();