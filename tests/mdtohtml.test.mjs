#!/usr/bin/env node
/**
 * Tests unitaires de mdToHtml (js/app.js) sur le code RÉEL : la fonction est
 * extraite du fichier par équilibrage d'accolades puis évaluée — toute dérive
 * du source casse les tests. Lancer via tests/run-tests.sh.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'app.js'), 'utf8');
const start = src.indexOf('function mdToHtml(');
if (start === -1) { console.error('mdToHtml introuvable dans js/app.js'); process.exit(1); }
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const mdToHtml = new Function(`${src.slice(start, end)}; return mdToHtml;`)();

let fail = 0;
const t = (name, ok) => { console.log((ok ? '  ✓ ' : '  ✗ ÉCHEC ') + name); if (!ok) fail++; };

let o = mdToHtml('Voir [Contact](contact.html) et **gras**.');
t('lien interne cliquable', o.includes('<a href="contact.html">Contact</a>'));
t('gras rendu', o.includes('<b>gras</b>'));

o = mdToHtml('Voir [NSY](https://www.linkedin.com/company/nsy-new-software-yard).');
t('officiel markdown → _blank noopener', o.includes('target="_blank" rel="noopener">NSY</a>'));

o = mdToHtml('Le site https://www.lecerfthym.fr. Fin.');
t('officiel nu auto-lié', o.includes('<a href="https://www.lecerfthym.fr"') && o.includes('>www.lecerfthym.fr</a>. Fin.'));

o = mdToHtml('Profil https://www.linkedin.com/in/c%C3%A9dric-barme/ ici.');
t('profil fondateur (%C3%A9) auto-lié', o.includes('href="https://www.linkedin.com/in/c%C3%A9dric-barme/"'));

o = mdToHtml('Article [SEO vs GEO](https://www.linkedin.com/pulse/seo-vs-geo-votre-site-est-bien-class%C3%A9-sur-google-0znee) ici.');
t('article LinkedIn Pulse whitelisté', o.includes('href="https://www.linkedin.com/pulse/seo-vs-geo-votre-site-est-bien-class%C3%A9-sur-google-0znee"'));

o = mdToHtml('Post [Facebook](https://www.facebook.com/share/17vyLQjakE/?mibextid=wwXIfr) ici.');
t('post Facebook whitelisté', o.includes('href="https://www.facebook.com/share/17vyLQjakE/?mibextid=wwXIfr"'));

o = mdToHtml('Article [forum & IA](https://www.linkedin.com/pulse/votre-forum-est-une-mine-dor-pour-lia-%25C3%25A0-condition-1icee) ici.');
t('article LinkedIn Pulse n°2 whitelisté', o.includes('href="https://www.linkedin.com/pulse/votre-forum-est-une-mine-dor-pour-lia-%25C3%25A0-condition-1icee"'));
o = mdToHtml('Article [un site IA en un week-end](https://www.linkedin.com/pulse/un-site-web-en-week-end-gr%25C3%25A2ce-%25C3%25A0-lia-verdict-chiffr%25C3%25A9-hqq8e) ici.');
t('article LinkedIn Pulse n°3 whitelisté', o.includes('href="https://www.linkedin.com/pulse/un-site-web-en-week-end-gr%25C3%25A2ce-%25C3%25A0-lia-verdict-chiffr%25C3%25A9-hqq8e"'));
o = mdToHtml('Post https://www.facebook.com/reel/2812928635744339 ici.');
t('post Facebook n°3 (URL nue) whitelisté', o.includes('href="https://www.facebook.com/reel/2812928635744339"'));
o = mdToHtml('Article [LinkedIn](https://www.linkedin.com/pulse/des-t%25C3%25A9raoctets-au-m%25C3%25A9gaoctet-la-supervision-est-une-duyee) et reel https://www.facebook.com/reel/1080327827884467 ici.');
t('article LinkedIn Pulse n°4 whitelisté', o.includes('href="https://www.linkedin.com/pulse/des-t%25C3%25A9raoctets-au-m%25C3%25A9gaoctet-la-supervision-est-une-duyee"'));
t('post Facebook n°4 (URL nue) whitelisté', o.includes('href="https://www.facebook.com/reel/1080327827884467"'));

o = mdToHtml('Post [Facebook](https://www.facebook.com/share/p/1Ey4FXBYDA) ici.');
t('post Facebook n°2 whitelisté', o.includes('href="https://www.facebook.com/share/p/1Ey4FXBYDA"'));

o = mdToHtml('Essayez [Wix](https://www.wix.com) ou https://evil.com/x directement.');
t('externe markdown → libellé inerte', o.includes('Wix') && !o.includes('href="https://www.wix.com'));
t('externe nu reste texte inerte', !o.includes('href="https://evil.com'));

o = mdToHtml('<script>alert(1)</script> [x](javascript:alert(1))');
t('HTML échappé', o.includes('&lt;script&gt;') && !o.includes('<script>'));
t('javascript: jamais lié', !o.includes('href="javascript'));

o = mdToHtml('- point un\n- point deux');
t('puces normalisées', o.includes('• point un<br>• point deux'));

console.log(fail === 0 ? 'MDTOHTML : TOUS LES TESTS PASSENT' : `MDTOHTML : ${fail} ÉCHEC(S)`);
process.exit(fail === 0 ? 0 : 1);
