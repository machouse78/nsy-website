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

// [file, language, base-path for {{P}}, active nav data-target]
// `active` = which top-nav link is highlighted on that page. The home pages use
// 'top' but their scroll-spy overrides it live; sub-pages have no scroll-spy so
// this value is what stays shown. The Réalisations page belongs to the offer →
// highlight "Services".
const pages = [
  ['index.html',            'fr', '',               'top'],
  ['index-en.html',         'en', '',               'top'],
  ['mentions-legales.html', 'fr', 'index.html',     'top'],
  ['confidentialite.html',  'fr', 'index.html',     'top'],
  ['faisabilite.html',      'fr', 'index.html',     'top'],
  ['realisations.html',     'fr', 'index.html',     'services'],
  ['faq.html',              'fr', 'index.html',     'top'],
  ['legal-notice.html',     'en', 'index-en.html',  'top'],
  ['privacy.html',          'en', 'index-en.html',  'top'],
  ['feasibility.html',      'en', 'index-en.html',  'top'],
  ['portfolio.html',        'en', 'index-en.html',  'services'],
  ['faq-en.html',           'en', 'index-en.html',  'top'],
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
for (const [file, lang, P, active = 'top'] of pages) {
  const before = read(file);
  let html = before;
  let nav = partials[lang].nav.replaceAll('{{P}}', P);
  // Highlight the right top-nav link for this page: clear every active, then
  // set it on the link whose data-target matches `active`.
  nav = nav.replace(/class="nav-link active"/g, 'class="nav-link"')
           .replace(`class="nav-link" data-target="${active}"`, `class="nav-link active" data-target="${active}"`);
  const footer = partials[lang].footer.replaceAll('{{P}}', P);
  html = replaceRegion(html, 'nav', nav, file);
  html = replaceRegion(html, 'footer', footer, file);
  if (html !== before) { writeFileSync(join(ROOT, file), html); changed++; }
  console.log(`✓ ${file.padEnd(24)} (lang=${lang}, P='${P}')`);
}
console.log(`\nNav & footer synchronisés sur ${pages.length} pages (${changed} modifiées).`);
