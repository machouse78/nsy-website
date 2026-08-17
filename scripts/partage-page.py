#!/usr/bin/env python3
"""partage-page.py — génère la page « Partager » du site (TOUS les articles).

Publier dans un groupe tiers via l'API Meta est IMPOSSIBLE (fermé en 2018 —
vérifié le 17/08/2026 : « (#3) Missing Permission »). Le partage reste un geste
humain : cette page le réduit à « ouvrir le groupe → coller → publier », et
trace chaque partage pour que le dashboard KPI dise ensuite quel groupe a
réellement amené du trafic.

Sources (versionnées) :
  - reseaux/groupes.md            → registre : Nom — URL — thème — [EN]
  - reseaux/partages-<slug>.md    → par article : « ## Texte « thème » » + corps

Sortie : stats/partage.html (déployée dans le dossier protégé par Basic Auth).
Un sélecteur d'article en haut, puis une carte par groupe : texte prêt, lien
TRACÉ propre au groupe (utm_campaign = slug du groupe), boutons Copier /
Ouvrir, cases cochées mémorisées par (article, groupe).

  python3 scripts/partage-page.py            # régénère la page
  python3 scripts/partage-page.py --open     # …et l'ouvre en local
"""
import html
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://www.nsy.fr"
NOM_SITE = "NSY"
CHARTE = {"bg": "#0A0F1C", "bg2": "#0F1626", "line": "#1C2740", "fg": "#B8C2DC",
          "fg2": "#8993AF", "accent": "#00E5FF"}


def slugify(s: str, n: int = 40) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")[:n]


def lire_groupes() -> list[dict]:
    p = ROOT / "reseaux/groupes.md"
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("- ") or line.startswith("- Exemple"):
            continue
        parts = [x.strip() for x in line[2:].split("—")]
        if len(parts) < 3 or not parts[1].startswith("http"):
            continue
        reste = " ".join(parts[3:])
        out.append({
            "nom": parts[0],
            "url": parts[1],
            "theme": re.sub(r"\s*\(.*\)$", "", parts[2]).strip(),
            "precision": (re.search(r"\((.*)\)", parts[2]) or [None, ""])[1],
            "en": bool(re.search(r"\bEN\b", reste)),
            "regles": reste,
            "reseau": "linkedin" if "linkedin.com" in parts[1] else "facebook",
        })
    return out


def lire_articles() -> list[dict]:
    arts = []
    for p in sorted((ROOT / "reseaux").glob("partages-*.md")):
        slug = p.stem.removeprefix("partages-")
        md = p.read_text(encoding="utf-8")
        titre = (re.search(r"^# Kit de partage — (.+?)(?:\s*\(|$)", md, re.M) or [None, slug])[1]
        textes = {}
        for m in re.finditer(r"^## Texte\s+(?:[«\"]\s*([^»\"]+?)\s*[»\"]|([^(\n]+?))\s*(?:\([^)]*\))?\s*\n(.*?)(?=^## |\Z)",
                             md, re.S | re.M):
            textes[(m.group(1) or m.group(2) or "").strip()] = m.group(3).strip()
        if textes:
            arts.append({"slug": slug, "titre": titre.strip().strip("«»\" "), "textes": textes})
    return arts


def choisir_texte(textes: dict, theme: str, en: bool) -> str:
    """Texte du thème ; version EN si le groupe est anglophone."""
    def cherche(*mots):
        for nom, corps in textes.items():
            n = nom.lower()
            if all(m in n for m in mots):
                return corps
        return ""
    if en:
        t = cherche("en")
        if t:
            return t
    t = textes.get(theme, "")
    if t:
        return t
    for nom, corps in textes.items():
        n = slugify(nom)
        if theme and (theme in n or n.startswith(theme.split("-")[0])):
            return corps
    # repli : mapping thème → mot-clé de section
    cle = {"renault-modele": ("special",), "renault": ("prv",), "youngtimers": ("prv",),
           "anciennes": ("general",), "auto": ("general",),
           "dirigeants": ("dirigeant",), "tech": ("technique",), "ia": ("ia",), "local": ("local",)}
    return cherche(*cle.get(theme, ("",))) or next(iter(textes.values()), "")


def tracer(texte: str, camp: str, reseau: str, en: bool) -> str:
    def repl(m: re.Match) -> str:
        raw = m.group(0)
        clean = raw.rstrip(".,;:!?)]")
        tail = raw[len(clean):]
        if "utm_source=" in clean:
            return raw
        sep = "&" if "?" in clean else "?"
        return f"{clean}{sep}utm_source={reseau}&utm_medium=groupe&utm_campaign={camp}{tail}"
    return re.sub(rf"{re.escape(SITE)}\S*", repl, texte)


def main() -> int:
    groupes, articles = lire_groupes(), lire_articles()
    data = {"site": NOM_SITE, "articles": []}
    for a in articles:
        cartes = []
        for g in groupes:
            corps = choisir_texte(a["textes"], g["theme"], g["en"])
            if not corps:
                continue
            camp = slugify(g["nom"])
            cartes.append({"nom": g["nom"], "url": g["url"], "theme": g["theme"],
                           "precision": g["precision"], "regles": g["regles"], "reseau": g["reseau"],
                           "camp": camp, "texte": tracer(corps, camp, g["reseau"], g["en"])})
        data["articles"].append({"slug": a["slug"], "titre": a["titre"], "cartes": cartes})

    out = ROOT / "stats/partage.html"
    out.parent.mkdir(exist_ok=True)
    c = CHARTE
    out.write_text(f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Partager — {html.escape(NOM_SITE)}</title><style>
:root{{--bg:{c['bg']};--bg2:{c['bg2']};--line:{c['line']};--fg:{c['fg']};--fg2:{c['fg2']};--acc:{c['accent']}}}
*{{box-sizing:border-box;margin:0}} body{{background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,sans-serif;padding:26px 20px 60px}}
.wrap{{max-width:920px;margin:0 auto}} h1{{font-size:23px}} .sub{{color:var(--fg2);font-size:13px;margin:6px 0 20px}}
.bar{{display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px;position:sticky;top:0;z-index:5}}
select,button,.btn,input{{background:transparent;border:1px solid var(--line);border-radius:8px;color:var(--fg);font:600 13px system-ui;padding:8px 12px;cursor:pointer}}
select{{max-width:420px}} .prim{{background:var(--acc);color:var(--bg);border-color:var(--acc)}}
.prog{{color:var(--fg2);font-size:12.5px;margin:0 0 16px}}
.g{{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}}
.g.ok{{opacity:.45}} .g h3{{font-size:15.5px;display:flex;align-items:center;gap:9px;margin-bottom:2px}}
.meta{{color:var(--fg2);font-size:12px;margin:2px 0 9px}} code{{color:var(--acc)}}
textarea{{width:100%;height:104px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px;font:13px/1.5 system-ui;resize:vertical}}
.act{{display:flex;gap:9px;margin-top:9px;flex-wrap:wrap}} a{{color:var(--acc);text-decoration:none}}
.empty{{background:var(--bg2);border:1px dashed var(--line);border-radius:12px;padding:22px;color:var(--fg2)}}
</style></head><body><div class="wrap">
<h1>Partager un article — {html.escape(NOM_SITE)}</h1>
<div class="sub">Publier dans un groupe via l'API est impossible (Meta l'a fermé en 2018) : ici tout est prêt —
ouvrir le groupe, coller, publier. Chaque texte porte le lien tracé du groupe, le dashboard KPI dira lequel a marché.</div>
<div class="bar">
  <select id="art"></select>
  <select id="filtre"><option value="">Tous les thèmes</option></select>
  <button id="hide">Masquer les faits</button>
  <button id="reset">Décocher tout</button>
</div>
<div class="prog" id="prog"></div>
<div id="list"></div>
</div>
<script>
const DATA = {json.dumps(data, ensure_ascii=False)};
const $ = (i) => document.getElementById(i);
const KEY = 'partage-{slugify(NOM_SITE)}';
const st = JSON.parse(localStorage.getItem(KEY) || '{{}}');
const save = () => localStorage.setItem(KEY, JSON.stringify(st));
let masque = false;

$('art').innerHTML = DATA.articles.map((a, i) => `<option value="${{i}}">${{a.titre}}</option>`).join('')
  || '<option>aucun article</option>';

function render() {{
  const a = DATA.articles[$('art').value | 0];
  if (!a) {{ $('list').innerHTML = `<div class="empty"><b>Rien à partager pour l'instant.</b><br><br>
    1. Renseigner les groupes ciblés dans <code>reseaux/groupes.md</code> (le fichier explique le format).<br>
    2. Créer le kit de textes d'un article : <code>reseaux/partages-&lt;slug&gt;.md</code>
       (sections <code>## Texte « thème »</code>, un thème par public visé).<br>
    3. Régénérer cette page : <code>python3 scripts/partage-page.py</code>.</div>`; return; }}
  const themes = [...new Set(a.cartes.map((c) => c.theme))];
  const cur = $('filtre').value;
  $('filtre').innerHTML = '<option value="">Tous les thèmes</option>' +
    themes.map((t) => `<option value="${{t}}">${{t}}</option>`).join('');
  $('filtre').value = cur;
  const vis = a.cartes.filter((c) => !cur || c.theme === cur);
  const faits = vis.filter((c) => st[a.slug + '|' + c.camp]).length;
  $('prog').textContent = `${{vis.length}} groupe(s) · ${{faits}} déjà partagé(s) · ${{vis.length - faits}} restant(s)`;
  $('list').innerHTML = vis.filter((c) => !(masque && st[a.slug + '|' + c.camp])).map((c) => {{
    const k = a.slug + '|' + c.camp, done = !!st[k];
    return `<div class="g ${{done ? 'ok' : ''}}" data-k="${{k}}">
      <h3><input type="checkbox" ${{done ? 'checked' : ''}}> ${{c.nom}}</h3>
      <div class="meta">${{c.reseau}} · thème <code>${{c.theme}}</code>${{c.precision ? ' · ' + c.precision : ''}} · campagne <code>${{c.camp}}</code>${{c.regles && !/^EN$/i.test(c.regles) ? ' · ⚠ ' + c.regles : ''}}</div>
      <textarea readonly>${{c.texte.replace(/</g, '&lt;')}}</textarea>
      <div class="act"><button class="prim copy">Copier le texte</button>
      <a class="btn" href="${{c.url}}" target="_blank" rel="noopener">Ouvrir le groupe →</a></div>
    </div>`;
  }}).join('') || '<div class="empty">Rien à afficher (tout est fait, ou aucun groupe pour ce thème).</div>';

  document.querySelectorAll('.g').forEach((g) => {{
    g.querySelector('input').addEventListener('change', (e) => {{ st[g.dataset.k] = e.target.checked; save(); render(); }});
    g.querySelector('.copy').addEventListener('click', async (e) => {{
      await navigator.clipboard.writeText(g.querySelector('textarea').value);
      e.target.textContent = '✓ Copié'; setTimeout(() => e.target.textContent = 'Copier le texte', 1400);
    }});
  }});
}}
$('art').addEventListener('change', render);
$('filtre').addEventListener('change', render);
$('hide').addEventListener('click', (e) => {{ masque = !masque; e.target.textContent = masque ? 'Afficher tout' : 'Masquer les faits'; render(); }});
$('reset').addEventListener('click', () => {{ const a = DATA.articles[$('art').value | 0]; if (!a) return;
  a.cartes.forEach((c) => delete st[a.slug + '|' + c.camp]); save(); render(); }});
render();
</script></body></html>""", encoding="utf-8")
    print(f"✅ {len(articles)} article(s) × {len(groupes)} groupe(s) → {out.relative_to(ROOT)}")
    if "--open" in sys.argv:
        subprocess.run(["open", str(out)], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
