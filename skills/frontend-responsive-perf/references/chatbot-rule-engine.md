# Lightweight client-side chatbot (no LLM, no API key)

A rule-based **intent engine** that feels smart while staying free, offline, and
secret-less. Good when an LLM is overkill or you can't expose a key client-side.

## Architecture
1. **Normalize** the user message: lowercase, strip accents (NFD + remove
   combining marks), strip punctuation, collapse whitespace.
2. **Score every intent** by the specificity of its matched keyword cues
   (longer / multi-word cues outrank short generic ones). Pick the highest.
3. **Rotate** 2–3 response variants per intent so it doesn't repeat itself.
4. Smalltalk (greeting/thanks/bye) only fires when no content intent matched.
5. A short follow-up ("et ? / more / details") re-opens the previous intent.
6. Fallback lists what the bot *can* help with.

```js
const norm = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
  .replace(/[^a-z0-9€$\s]/g, ' ').replace(/\s+/g, ' ').trim();
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// whole-word/stem for single cues, substring for multi-word cues
const cueHit = (cue, text, tokens) => {
  if (cue.includes(' ')) return text.includes(cue);
  for (const t of tokens) { if (t === cue) return true; if (cue.length >= 3 && t.startsWith(cue)) return true; }
  return false;
};
const scoreIntent = (intent, text, tokens) =>
  intent.cues.reduce((s, c) => s + (cueHit(c, text, tokens) ? c.length : 0), 0);

// INTENTS: [{ id, cues:[...accent-free, FR+EN mixed...], fr:[...variants], en:[...] }]
function reply(userText) {
  const text = norm(userText), tokens = text.split(' ');
  const lang = detectLang(userText);
  let best = null, bestScore = 0;
  for (const it of INTENTS) { const s = scoreIntent(it, text, tokens); if (s > bestScore) { bestScore = s; best = it; } }
  if (best) { lastIntentId = best.id; return pick(best[lang]); }
  // … follow-up (short + FOLLOWUP_CUES → re-open lastIntentId) …
  for (const it of SMALLTALK) if (scoreIntent(it, text, tokens) > 0) return pick(it[lang]);
  return pick(FALLBACK[lang]);
}
```

Notes:
- Put cues *without accents* (input is normalized). Avoid 1–2 char cues that
  collide inside words (`ia`, `ou`) unless matched as whole tokens.
- Order intents by priority so ties resolve to the more specific one.
- Keep facts (prices, dates…) in one place; they often must match the rest of
  the site.

## Per-message language detection (answer in the question's language)
Reply in the language of each message, not just the page language — cheap
stopword + accent heuristic, fall back to the page language on a tie.

```js
const FR = new Set(['vous','etes','quel','combien','votre','pourquoi','comment','merci','bonjour','ou','quand','avec','pour','faites','prix','tarif','cout']);
const EN = new Set(['you','are','is','what','how','much','the','do','does','your','where','why','who','hello','thanks','please','can','with','for','about','price','cost','website']);
function detectLang(raw) {
  const toks = norm(raw).split(' ');
  let fr = 0, en = 0;
  for (const t of toks) { if (FR.has(t)) fr++; if (EN.has(t)) en++; }
  if (/[éèêëàâäçùûüîïôö]/i.test(raw)) fr += 2;     // accents = strong FR signal
  return en > fr ? 'en' : fr > en ? 'fr' : pageLang;
}
```

## XSS safety in the bubble
The assistant copy is authored by you, so rendering it with `innerHTML` is fine
(lets you use `<b>` / links). **User input must use `textContent`** — never
inject user text as HTML.
```js
if (role === 'assistant') bubble.innerHTML = content;  // trusted static copy
else bubble.textContent = content;                     // user input, never HTML
```
