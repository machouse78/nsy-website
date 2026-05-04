# 🔧 Debug des liens externes

## 🎯 **Problème : Liens GitHub et LinkedIn ne s'ouvrent pas**

### **URLs configurées :**
- **GitHub** : `https://github.com/cedricbarme/nsy-website`
- **LinkedIn** : `https://www.linkedin.com/in/cédric-barme/`

## ✅ **Corrections appliquées**

### **Changement de `motion.a` vers `a` standard :**

#### **AVANT :**
```javascript
<motion.a
  href={url}
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
```

#### **APRÈS :**
```javascript
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  className="...hover:scale-105 active:scale-95"
>
```

## 🔍 **Tests de diagnostic**

### **1. Vérifier les URLs dans la console**
Ouvrez F12 → Console et tapez :
```javascript
console.log(window.siteContent?.construction?.resources?.github?.url)
console.log(window.siteContent?.construction?.resources?.linkedin?.url)
```

### **2. Test manuel des liens**
Dans la console, testez l'ouverture :
```javascript
window.open('https://github.com/cedricbarme/nsy-website', '_blank')
window.open('https://www.linkedin.com/in/cédric-barme/', '_blank')
```

### **3. Inspection des éléments**
- Clic droit sur le bouton → Inspecter
- Vérifier que `href` est bien présent
- Vérifier que `target="_blank"` est appliqué

## 🔧 **Solutions alternatives si le problème persiste**

### **Option 1 : Fonction JavaScript**
```javascript
const openGitHub = () => {
  window.open('https://github.com/cedricbarme/nsy-website', '_blank')
}

<button onClick={openGitHub}>Voir sur GitHub</button>
```

### **Option 2 : Forcer l'ouverture**
```javascript
const handleExternalLink = (url) => {
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
```

## 🚀 **Test immédiat**

Visitez **http://localhost:3001/#construction** et :

1. **Scrollez** jusqu'à "Code source et ressources"
2. **Cliquez** sur "Voir sur GitHub" 
3. **Cliquez** sur "Voir le profil" (LinkedIn)
4. **Vérifiez** que les liens s'ouvrent dans de nouveaux onglets

## ⚠️ **Causes possibles du problème**

### **1. Bloqueur de popups**
- Navigateur bloque les fenêtres popup
- Solution : Autoriser les popups pour localhost

### **2. Framer Motion conflit**
- `motion.a` peut interferer avec les liens natifs
- Solution : Balises `<a>` standard (✅ appliqué)

### **3. Event propagation**
- Event handler parent empêche le clic
- Solution : `e.stopPropagation()` si nécessaire

### **4. CSP (Content Security Policy)**
- Headers de sécurité bloquent l'ouverture
- Solution : Configuration .htaccess adaptée

Les liens devraient maintenant fonctionner correctement ! 🔗✅