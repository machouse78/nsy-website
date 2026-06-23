#!/usr/bin/env node
/**
 * NSY — Nav & footer partial synchroniser.
 *
 * Single source of truth for the top nav and the footer:
 *   partials/nav.fr.html  · partials/nav.en.html
 *   partials/footer.fr.html · partials/footer.en.html
 *
 * Every page declares the managed regions with HTML-comment markers:
 *   <!-- @partial:nav -->   ... <!-- @endpartial:nav -->
 *   <!-- @partial:footer --> ... <!-- @endpartial:footer -->
 *
 * Running this script rewrites those regions IN PLACE in all pages from the
 * partials, so the committed .html always contains the rendered nav/footer
 * (local `python -m http.server` preview + SEO keep working — no runtime
 * include, no FOUC). Edit a partial, run `npm run partials` (or this script),
 * and EVERY page is updated at once — you can't forget half of them anymore.
 *
 * `{{P}}` in a partial = the base path for in-page anchors: '' on the home
 * pages (same-page smooth scroll + scroll-spy) and 'index.html' /
 * 'index-en.html' on sub-pages (so the nav jumps back to the homepage section).
 *
 * No build tooling required beyond Node (already used for the 3D pipeline).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const partials = {
  fr: { nav: read('partials/nav.fr.html').trim(), footer: read('partials/footer.fr.html').trim() },
  en: { nav: read('partials/nav.en.html').trim(), footer: read('partials/footer.en.html').trim() },
};

// [file, language, base-path for {{P}}]
const pages = [
  ['index.html',            'fr', ''],
  ['index-en.html',         'en', ''],
  ['mentions-legales.html', 'fr', 'index.html'],
  ['confidentialite.html',  'fr', 'index.html'],
  ['faisabilite.html',      'fr', 'index.html'],
  ['legal-notice.html',     'en', 'index-en.html'],
  ['privacy.html',          'en', 'index-en.html'],
  ['feasibility.html',      'en', 'index-en.html'],
];

function replaceRegion(html, name, content, file) {
  const re = new RegExp(`<!-- @partial:${name} -->[\\s\\S]*?<!-- @endpartial:${name} -->`);
  if (!re.test(html)) {
    console.error(`  ⚠️  ${file}: marqueurs <${name}> introuvables — page ignorée pour ce bloc`);
    return html;
  }
  return html.replace(re, `<!-- @partial:${name} -->\n${content}\n<!-- @endpartial:${name} -->`);
}

let changed = 0;
for (const [file, lang, P] of pages) {
  const before = read(file);
  let html = before;
  const nav = partials[lang].nav.replaceAll('{{P}}', P);
  const footer = partials[lang].footer.replaceAll('{{P}}', P);
  html = replaceRegion(html, 'nav', nav, file);
  html = replaceRegion(html, 'footer', footer, file);
  if (html !== before) { writeFileSync(join(ROOT, file), html); changed++; }
  console.log(`✓ ${file.padEnd(24)} (lang=${lang}, P='${P}')`);
}
console.log(`\nNav & footer synchronisés sur ${pages.length} pages (${changed} modifiées).`);
