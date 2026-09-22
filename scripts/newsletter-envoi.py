#!/usr/bin/env python3
"""Envoi de la newsletter du journal : un e-mail par abonné confirmé, à la publication d'un article.

    python3 scripts/newsletter-envoi.py <slug-FR>                      # DRY-RUN (défaut) : rien ne part
    python3 scripts/newsletter-envoi.py <slug-FR> --test moi@exemple.fr # les deux versions (FR, EN) à UNE adresse
    python3 scripts/newsletter-envoi.py <slug-FR> --go                 # envoi réel aux abonnés confirmés
    python3 scripts/newsletter-envoi.py <slug-FR> --go --force         # … même si ce slug est déjà parti

    <slug-FR> : le nom du fichier de l'article français, avec ou sans « .html »
                (ex. reunir-site-forum-boutique-compte-unique).

Ce que fait le script :
  1. lit l'article FR et son pendant EN DANS LE DÉPÔT (lien hreflang="en") : titre (og:title),
     chapô (p.lede, sinon premier paragraphe de l'article), image (og:image) ;
  2. construit l'e-mail FR et l'e-mail EN : bouton « Lire l'article » vers l'article avec
     ?utm_source=newsletter&utm_medium=email&utm_campaign=<slug-FR>, lien de désinscription
     PERSONNEL, en-têtes List-Unsubscribe + List-Unsubscribe-Post (désinscription en un clic) ;
  3. récupère la liste par FTPS (identifiants : _secret/ftp.env, même mécanique que
     scripts/ftp-deploy.py, une connexion à la fois) — _secret/newsletter.json, gardée EN
     MÉMOIRE seulement : jamais écrite sur le disque, jamais affichée (des comptes, pas d'adresses) ;
  4. DRY-RUN : affiche les comptes par langue, écrit les deux aperçus dans un dossier temporaire
     (lien de désinscription factice, aucune donnée d'abonné) ;
     --go : envoie un par un (pause de 1 s) par SMTP (identifiants : _secret/config.php),
     s'arrête net à la première erreur SMTP, puis enregistre {slug: {date, envoyes}} dans
     _secret/newsletter-envois.json sur le serveur — un second envoi du même slug est refusé
     sans --force. Écriture ATOMIQUE (scripts/ftp_atomique.py, 19/09/2026) : nom temporaire,
     taille contrôlée, renommage — une coupure en plein STOR ne laisse jamais un journal
     vidé, que ftp_lire_json() relirait comme {} en oubliant les envois passés.

--abonnes-fichier <json> remplace le FTP par un fichier local (même format que le serveur) :
réservé aux essais du dry-run, refusé avec --go.

PORTAGE (prv-concept.com…) : seul le bloc CONFIGURATION ci-dessous change ; il reprend les
valeurs de newsletter.php. Python 3.9+, bibliothèque standard uniquement.
"""
import argparse
import html
import io
import json
import os
import re
import smtplib
import ssl
import sys
import tempfile
import time
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html.parser import HTMLParser
from urllib.parse import urlencode, urlsplit, urlunsplit

sys.dont_write_bytecode = True           # pas de scripts/__pycache__ laissé dans le dépôt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ftp_atomique import envoie_octets  # noqa: E402  — l'envoi FTP atomique commun du dépôt

# ═══════════════════════════ CONFIGURATION DU SITE ═══════════════════════════
SITE_NOM = "NSY"
SITE_URL = "https://www.nsy.fr"                       # sans « / » final
ENDPOINT = SITE_URL + "/newsletter.php"
LOGO_URL = SITE_URL + "/public/nsy-logo.png"
LOGO_LARGEUR = 110
EXPEDITEUR_NOM = "NSY · Journal"
COULEURS = {
    "fond": "#05080F", "carte": "#0F1626", "bord": "rgba(140,170,220,0.15)",
    "titre": "#F2F6FF", "texte": "#C5CEE3", "discret": "#8993AF", "pale": "#5B6485",
    "accent": "#00E5FF", "sur_accent": "#021018",
}
POLICE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
TEXTES = {
    "fr": {
        "sujet": "Nouvel article : {titre}",
        "etiquette": "Journal NSY · Nouvel article",
        "bouton": "Lire l'article",
        "pourquoi": "Vous recevez cet e-mail parce que votre adresse est inscrite au journal NSY.",
        "desinscrire": "Se désinscrire",
        "lire_texte": "Lire l'article :",
        "desinscrire_texte": "Se désinscrire :",
        "aussi_texte": "L'article est aussi sur :",
    },
    "en": {
        "sujet": "New article: {titre}",
        "etiquette": "NSY Journal · New article",
        "bouton": "Read the article",
        "pourquoi": "You are receiving this email because your address is subscribed to the NSY journal.",
        "desinscrire": "Unsubscribe",
        "lire_texte": "Read the article:",
        "desinscrire_texte": "Unsubscribe:",
        "aussi_texte": "The article is also on:",
    },
}
# Les publications de l'article (owner, 22/09/2026) : sous le bouton « Lire l'article », une
# petite icône par publication. Les liens sont lus DANS L'ARTICLE, dans ses boutons de retour
# « Lire sur LinkedIn / Facebook » (skill journal-nsy §4) : un article pas encore publié ailleurs
# n'a pas le lien, et l'e-mail n'a pas l'icône. Le MOTIF ne retient que les adresses de
# PUBLICATION — jamais la page Facebook (facebook.com/nsy.france/) ni le profil LinkedIn
# (linkedin.com/in/…) de l'en-tête et du pied de page. `classe` : None (les boutons NSY n'en ont
# pas de propre) ; sur prv-concept.com c'est la classe des pastilles (a.fb / a.ig / a.fo).
PUBLICATIONS = (
    {"cle": "linkedin", "classe": None, "motif": r"https://(?:[a-z]+\.)?linkedin\.com/(?:pulse|posts|feed/update)/",
     "libelle": {"fr": "LinkedIn", "en": "LinkedIn"}, "icone": SITE_URL + "/public/newsletter/linkedin.png"},
    {"cle": "facebook", "classe": None,
     "motif": r"https://(?:www\.|m\.)?facebook\.com/(?:share/|reel/|watch|story\.php|permalink\.php|[^/?#]+/(?:posts|videos)/)",
     "libelle": {"fr": "Facebook", "en": "Facebook"}, "icone": SITE_URL + "/public/newsletter/facebook.png"},
)
ICONE_TAILLE = 28                                     # px affichés (PNG en 84 px : écrans denses)
DISTANT_ABONNES = "_secret/newsletter.json"          # relatif à FTP_DIR
DISTANT_ENVOIS = "_secret/newsletter-envois.json"
PAUSE_S = 1.0
# ═════════════════════════ FIN DE LA CONFIGURATION ═══════════════════════════

LANGUES = ("fr", "en")
JETON_APERCU = "JETON-PERSONNEL-DE-L-ABONNE"
# Objet des e-mails de --test (22/09/2026). « [TEST] » en tête ne suffisait pas : Gmail ignore ce
# genre d'étiquette pour regrouper, et le vrai envoi s'est rangé dans la conversation du test — dont
# le titre, celui du premier message, restait « [TEST]… » (le owner a cru que le vrai l'avait gardé).
# Un objet réellement différent ouvre sa propre conversation.
PREFIXE_TEST = "Aperçu de la newsletter (test) — "
RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
# Secrets (ftp.env, config.php) : _secret/ du dépôt, ou le dossier désigné par
# NL_SECRETS — un worktree git n'a pas de _secret/ (gitignoré) : on y lance
#   NL_SECRETS="<dépôt principal>/_secret" python3 scripts/newsletter-envoi.py <slug>
SECRETS = os.environ.get("NL_SECRETS") or os.path.join(RACINE, "_secret")
RE_JETON = re.compile(r"[a-f0-9]{32}\Z")
RE_ADRESSE = re.compile(r"[^\s<>()\[\]\"'@,;:]+@[^\s<>()\[\]\"'@,;:]+")


class Arret(Exception):
    """Erreur attendue : message clair, code de sortie non nul, jamais de pile."""


def masquer(texte):
    """Masque toute adresse e-mail (messages d'erreur SMTP, par exemple)."""
    return RE_ADRESSE.sub("[adresse]", str(texte))


# ───────────────────────────── Article ─────────────────────────────

class _Extracteur(HTMLParser):
    """Lit d'un article : og:title, og:image, canonical, hreflang, h1, p.lede, 1er <p> de <article>."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.alternates = {}, {}
        self.canonical = None
        self.textes = {}                  # 'title', 'h1', 'lede', 'p' → texte
        self.liens = []                   # (classes, href) de chaque <a>, dans l'ordre
        self._dans_article = 0
        self._capture, self._balise, self._tampon = None, None, []

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag == "meta" and a.get("property"):
            self.meta.setdefault(a["property"], a.get("content", ""))
        elif tag == "link":
            if a.get("rel") == "canonical":
                self.canonical = a.get("href")
            elif a.get("rel") == "alternate" and a.get("hreflang"):
                self.alternates[a["hreflang"]] = a.get("href", "")
        elif tag == "article":
            self._dans_article += 1
        elif tag == "a" and a.get("href"):
            self.liens.append((set(a.get("class", "").split()), a["href"]))
        elif tag == "br" and self._capture:
            self._tampon.append(" ")
        if self._capture:
            return
        cible = None
        if tag == "title" and "title" not in self.textes:
            cible = "title"
        elif tag == "h1" and "h1" not in self.textes:
            cible = "h1"
        elif tag == "p" and self._dans_article:
            if "lede" in a.get("class", "").split() and "lede" not in self.textes:
                cible = "lede"
            elif "p" not in self.textes:
                cible = "p"
        if cible:
            self._capture, self._balise, self._tampon = cible, tag, []

    def handle_endtag(self, tag):
        if tag == "article":
            self._dans_article -= 1
        if self._capture and tag == self._balise:
            self.textes[self._capture] = re.sub(r"\s+", " ", "".join(self._tampon)).strip()
            self._capture = None

    def handle_data(self, data):
        if self._capture:
            self._tampon.append(data)


def slug_normalise(brut):
    s = str(brut).strip()                       # un chemin (« ../x ») est refusé, jamais réécrit
    s = s[:-5] if s.endswith(".html") else s
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,80}", s):
        raise Arret("slug invalide : « %s » (attendu : le nom du fichier de l'article FR)" % brut)
    return s


def lire_article(racine, fichier):
    chemin = os.path.join(racine, fichier)
    if not os.path.isfile(chemin):
        raise Arret("article introuvable dans le dépôt : %s" % fichier)
    x = _Extracteur()
    with open(chemin, encoding="utf-8") as fh:
        x.feed(fh.read())
    titre = (x.meta.get("og:title") or x.textes.get("h1")
             or re.sub(r"\s*\|\s*%s\s*$" % re.escape(SITE_NOM), "", x.textes.get("title", ""))).strip()
    chapo = x.textes.get("lede") or x.textes.get("p") or ""
    if not titre or not chapo:
        raise Arret("%s : titre ou chapô introuvable" % fichier)
    return {
        "fichier": fichier,
        "titre": titre,
        "chapo": chapo,
        "image": x.meta.get("og:image", ""),
        "url": x.canonical or "%s/%s" % (SITE_URL, fichier),
        "alternates": x.alternates,
        "publications": publications_de(x.liens),
    }


def publications_de(liens):
    """[(cle, url)] dans l'ordre de PUBLICATIONS : le premier lien de chaque sorte qui porte
    sa classe (si elle en a une) ET dont l'adresse suit son motif ; une sorte sans lien est absente."""
    out = []
    for p in PUBLICATIONS:
        for classes, href in liens:
            if (not p["classe"] or p["classe"] in classes) and re.match(p["motif"], href):
                out.append((p["cle"], href))
                break
    return out


def lire_paire(racine, slug):
    """L'article FR et son pendant EN (lu par le lien hreflang="en" de la page FR)."""
    fr = lire_article(racine, slug + ".html")
    href_en = fr["alternates"].get("en", "")
    fichier_en = os.path.basename(urlsplit(href_en).path) if href_en else ""
    if not fichier_en or fichier_en == fr["fichier"]:
        raise Arret("%s : pas de pendant anglais (lien hreflang=\"en\" absent)" % fr["fichier"])
    en = lire_article(racine, fichier_en)
    if not en["publications"]:                  # pendant EN sans ses boutons : mêmes publications
        en["publications"] = fr["publications"]
    return {"fr": fr, "en": en}


def lien_article(url, slug):
    p = urlsplit(url)
    utm = urlencode({"utm_source": "newsletter", "utm_medium": "email", "utm_campaign": slug})
    return urlunsplit((p.scheme, p.netloc, p.path, (p.query + "&" if p.query else "") + utm, p.fragment))


def lien_desinscription(jeton):
    return ENDPOINT + "?" + urlencode({"action": "desinscrire", "t": jeton})


# ───────────────────────────── Message ─────────────────────────────

def icones_html(langue, article):
    """La rangée de petites icônes des publications, sous le bouton ; vide sans publication."""
    e, par_cle = html.escape, {p["cle"]: p for p in PUBLICATIONS}
    cases = "".join(
        '<td style="padding:0 14px 0 0;"><a href="%s" title="%s"><img src="%s" width="%d" height="%d" alt="%s" '
        'style="display:block;border:0;" /></a></td>'
        % (e(url), e(par_cle[cle]["libelle"][langue]), e(par_cle[cle]["icone"]), ICONE_TAILLE, ICONE_TAILLE,
           e(par_cle[cle]["libelle"][langue]))
        for cle, url in article.get("publications", []))
    if not cases:
        return ""
    return ('<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">'
            '<tr>%s</tr></table>' % cases)


def html_mail(langue, article, lien, lien_desinscr):
    c, t, e = COULEURS, TEXTES[langue], html.escape
    image = ""
    if article["image"]:
        image = ('<tr><td style="padding:0;"><a href="%s"><img src="%s" width="560" alt="" '
                 'style="display:block;width:100%%;max-width:560px;height:auto;border:0;border-radius:18px 18px 0 0;" /></a></td></tr>'
                 % (e(lien), e(article["image"])))
    apercu = article["chapo"][:140]
    return (
        '<!doctype html><html lang="%s"><head><meta charset="utf-8" />'
        '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        '<meta name="color-scheme" content="dark light" /><title>%s</title></head>'
        '<body style="margin:0;padding:0;background:%s;">'
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">%s</div>'
        '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" bgcolor="%s" style="background:%s;">'
        '<tr><td align="center" style="padding:32px 16px;">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:560px;font-family:%s;">'
        '<tr><td style="padding:0 0 20px;"><a href="%s/"><img src="%s" width="%d" alt="%s" style="display:block;border:0;height:auto;" /></a></td></tr>'
        '<tr><td bgcolor="%s" style="background:%s;border:1px solid %s;border-radius:18px;">'
        '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0">%s'
        '<tr><td style="padding:28px 28px 32px;">'
        '<p style="margin:0 0 12px;font-family:Consolas,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:%s;">%s</p>'
        '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;"><a href="%s" style="color:%s;text-decoration:none;">%s</a></h1>'
        '<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:%s;">%s</p>'
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="%s" style="background:%s;border-radius:999px;">'
        '<a href="%s" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:%s;text-decoration:none;">%s</a>'
        '</td></tr></table>%s'
        '</td></tr></table></td></tr>'
        '<tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:%s;">%s<br />'
        '<a href="%s" style="color:%s;">%s</a> · %s · <a href="%s/" style="color:%s;">%s</a></td></tr>'
        '</table></td></tr></table></body></html>'
    ) % (
        langue, e(article["titre"]), c["fond"], e(apercu), c["fond"], c["fond"], POLICE,
        e(SITE_URL), e(LOGO_URL), LOGO_LARGEUR, e(SITE_NOM),
        c["carte"], c["carte"], c["bord"], image,
        c["accent"], e(t["etiquette"]),
        e(lien), c["titre"], e(article["titre"]),
        c["texte"], e(article["chapo"]),
        c["accent"], c["accent"], e(lien), c["sur_accent"], e(t["bouton"]), icones_html(langue, article),
        c["pale"], e(t["pourquoi"]),
        e(lien_desinscr), c["discret"], e(t["desinscrire"]), e(SITE_NOM), e(SITE_URL), c["pale"], e(urlsplit(SITE_URL).netloc),
    )


def texte_mail(langue, article, lien, lien_desinscr):
    t, par_cle = TEXTES[langue], {p["cle"]: p for p in PUBLICATIONS}
    aussi = ""
    if article.get("publications"):
        aussi = "\n%s\n%s\n" % (t["aussi_texte"], "\n".join(
            "- %s : %s" % (par_cle[cle]["libelle"][langue], url) for cle, url in article["publications"]))
    return "%s\n\n%s\n\n%s\n%s\n%s\n—\n%s\n%s\n%s\n%s · %s\n" % (
        article["titre"], article["chapo"], t["lire_texte"], lien, aussi,
        t["pourquoi"], t["desinscrire_texte"], lien_desinscr, SITE_NOM, SITE_URL)


def construire_message(langue, article, slug, jeton, destinataire, expediteur, repondre_a=None, prefixe=""):
    lien = lien_article(article["url"], slug)
    lien_d = lien_desinscription(jeton)
    m = EmailMessage()
    m["Subject"] = prefixe + TEXTES[langue]["sujet"].format(titre=article["titre"])
    m["From"] = formataddr((EXPEDITEUR_NOM, expediteur))
    m["To"] = destinataire
    if repondre_a:
        m["Reply-To"] = repondre_a
    m["Date"] = formatdate(localtime=True)
    m["Message-ID"] = make_msgid(domain=expediteur.split("@")[-1])
    m["Content-Language"] = langue
    m["List-Unsubscribe"] = "<%s>" % lien_d
    m["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    m.set_content(texte_mail(langue, article, lien, lien_d))
    m.add_alternative(html_mail(langue, article, lien, lien_d), subtype="html")
    return m


# ───────────────────────────── Abonnés et journal des envois ─────────────────────────────

def abonnes_par_langue(donnees):
    """{'fr': [(email, jeton)], 'en': [...]} pour les seuls confirmés, et les comptes des autres états."""
    if not isinstance(donnees, dict) or not isinstance(donnees.get("abonnes"), list):
        raise Arret("liste des abonnés illisible (format inattendu) — rien n'est envoyé")
    out = {lg: [] for lg in LANGUES}
    autres = {"attente": 0, "desinscrit": 0, "ignores": 0}
    vus = set()
    for a in donnees["abonnes"]:
        if not isinstance(a, dict):
            autres["ignores"] += 1
            continue
        etat, email, jeton = a.get("etat"), a.get("email"), a.get("jeton")
        if etat in ("attente", "desinscrit"):
            autres[etat] += 1
            continue
        if (etat != "confirme" or not isinstance(email, str) or "@" not in email
                or not isinstance(jeton, str) or not RE_JETON.match(jeton) or email in vus):
            autres["ignores"] += 1
            continue
        vus.add(email)
        out[a.get("langue") if a.get("langue") in LANGUES else LANGUES[0]].append((email, jeton))
    return out, autres


def deja_envoye(envois, slug):
    e = envois.get(slug) if isinstance(envois, dict) else None
    return e if isinstance(e, dict) else None


# ───────────────────────────── Secrets ─────────────────────────────

def lire_env(chemin):
    """KEY="valeur" par ligne (format de _secret/ftp.env, lu aussi par deploy.sh)."""
    if not os.path.isfile(chemin):
        raise Arret("%s manquant (modèle : %s.example)" % (os.path.relpath(chemin, RACINE), os.path.relpath(chemin, RACINE)))
    env = {}
    with open(chemin, encoding="utf-8") as fh:
        for ligne in fh:
            m = re.match(r"\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$", ligne)
            if not m:
                continue
            v = m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            env[m.group(1)] = v
    return env


def _chaine_php(litteral):
    q, corps = litteral[0], litteral[1:-1]
    if q == "'":
        return re.sub(r"\\([\\'])", r"\1", corps)
    if "$" in corps.replace("\\$", ""):
        raise Arret("config.php : chaîne entre guillemets doubles avec variable — non lisible sans PHP")
    return re.sub(r"\\([\\\"$])", r"\1", corps).replace("\\n", "\n").replace("\\t", "\t")


def lire_config_php(chemin):
    """Lit le tableau `return [ 'cle' => valeur, … ];` de _secret/config.php SANS exécuter de PHP.
    Prudence : lignes de commentaire ignorées, clé en double = refus, clés SMTP obligatoires."""
    if not os.path.isfile(chemin):
        raise Arret("%s manquant — nécessaire pour envoyer" % os.path.relpath(chemin, RACINE))
    with open(chemin, encoding="utf-8") as fh:
        return lire_config_php_texte(fh.read())


def lire_config_php_texte(texte):
    """Même lecture, depuis le texte du fichier (config du serveur lue en mémoire)."""
    lignes = [l for l in texte.splitlines() if not re.match(r"\s*(//|#|/?\*)", l)]
    motif = re.compile(r"""(['"])(\w+)\1\s*=>\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+|true|false|null)""", re.I)
    cfg = {}
    for cle_q, cle, val in motif.findall("\n".join(lignes)):
        if cle in cfg:
            raise Arret("config.php : clé « %s » en double — lecture refusée" % cle)
        if val[0] in "'\"":
            cfg[cle] = _chaine_php(val)
        elif re.fullmatch(r"-?\d+", val):
            cfg[cle] = int(val)
        else:
            cfg[cle] = {"true": True, "false": False, "null": None}[val.lower()]
    manquantes = [k for k in ("smtp_host", "smtp_port", "smtp_username", "smtp_password") if not cfg.get(k)]
    if manquantes:
        raise Arret("config.php : clé(s) manquante(s) : %s" % ", ".join(manquantes))
    if str(cfg["smtp_password"]).startswith("CHANGE_ME"):
        raise Arret("config.php : mot de passe SMTP non renseigné (CHANGE_ME)")
    return cfg


# ───────────────────────────── FTPS (une connexion à la fois) ─────────────────────────────

def ftp_ouvrir(env):
    from ftplib import FTP_TLS
    for k in ("FTP_HOST", "FTP_USER", "FTP_PASS"):
        if not env.get(k):
            raise Arret("_secret/ftp.env : %s vide" % k)
    ftp = FTP_TLS()
    ftp.connect(env["FTP_HOST"], 21, timeout=60)
    ftp.login(env["FTP_USER"], env["FTP_PASS"])
    ftp.prot_p()
    ftp.set_pasv(True)
    return ftp


def _distant(env, chemin):
    base = env.get("FTP_DIR", "").strip("/")
    return base + "/" + chemin if base else chemin


def ftp_lire_json(ftp, chemin, defaut):
    """Lit un JSON distant EN MÉMOIRE. Fichier absent (550) → defaut."""
    from ftplib import error_perm
    tampon = io.BytesIO()
    try:
        ftp.retrbinary("RETR " + chemin, tampon.write)
    except error_perm as e:
        if str(e).startswith("550"):
            return defaut
        raise
    try:
        return json.loads(tampon.getvalue().decode("utf-8") or "null") or defaut
    except ValueError:
        raise Arret("%s illisible sur le serveur (écriture en cours ?) — relancez dans un instant" % chemin)


def ftp_ecrire_json(ftp, chemin, obj):
    """Écrit un JSON distant depuis la MÉMOIRE, sans jamais le vider en ligne : un STOR sur
    place tronque d'abord le fichier (coupure = journal vide = envois passés oubliés). Ici,
    temporaire + taille contrôlée + renommage ; taille fausse → EnvoiEchoue, ancien intact."""
    donnees = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
    envoie_octets(ftp, donnees, chemin)


def config_smtp():
    """Configuration SMTP : _secret/config.php local ; à défaut (absent, incomplet ou
    CHANGE_ME), celle du SERVEUR, lue par FTPS et gardée EN MÉMOIRE — jamais écrite sur
    le disque, jamais affichée. Vécu 19/09/2026 : sur PRV Concept le mot de passe SMTP
    n'existe que sur le serveur, le config.php local porte CHANGE_ME."""
    try:
        return lire_config_php(os.path.join(SECRETS, "config.php"))
    except Arret as e:
        if "CHANGE_ME" not in str(e) and "manquant" not in str(e):
            raise
    env = lire_env(os.path.join(SECRETS, "ftp.env"))
    ftp = ftp_ouvrir(env)
    tampon = io.BytesIO()
    try:
        ftp.retrbinary("RETR " + _distant(env, "_secret/config.php"), tampon.write)
    finally:
        ftp.quit()
    cfg = lire_config_php_texte(tampon.getvalue().decode("utf-8"))
    print("Configuration SMTP : celle du serveur (lue par FTPS, gardée en mémoire)")
    return cfg


# ───────────────────────────── SMTP ─────────────────────────────

def smtp_ouvrir(cfg):
    hote, port = str(cfg["smtp_host"]), int(cfg["smtp_port"])
    ctx = ssl.create_default_context()
    if str(cfg.get("smtp_secure", "ssl")).lower() == "ssl":
        s = smtplib.SMTP_SSL(hote, port, timeout=30, context=ctx)
    else:
        s = smtplib.SMTP(hote, port, timeout=30)
        s.starttls(context=ctx)
    s.login(str(cfg["smtp_username"]), str(cfg["smtp_password"]))
    return s


def expediteur(cfg):
    return str(cfg.get("newsletter_from") or cfg["smtp_username"])


# ───────────────────────────── Programme ─────────────────────────────

def arguments(argv):
    p = argparse.ArgumentParser(description="Newsletter du journal : dry-run par défaut.")
    p.add_argument("slug", help="slug de l'article FR (nom du fichier, avec ou sans .html)")
    p.add_argument("--go", action="store_true", help="envoyer réellement aux abonnés confirmés")
    p.add_argument("--force", action="store_true", help="avec --go : renvoyer un slug déjà parti")
    p.add_argument("--test", metavar="ADRESSE", help="envoyer les versions FR et EN à cette seule adresse")
    p.add_argument("--abonnes-fichier", metavar="JSON", help="liste locale à la place du FTP (dry-run uniquement)")
    a = p.parse_args(argv)
    if a.go and a.test:
        raise Arret("--go et --test s'excluent")
    if a.abonnes_fichier and (a.go or a.test):
        raise Arret("--abonnes-fichier sert aux essais du dry-run : refusé avec --go ou --test")
    if a.force and not a.go:
        raise Arret("--force ne s'utilise qu'avec --go")
    return a


def ecrire_apercus(paire, slug):
    dossier = tempfile.mkdtemp(prefix="newsletter-apercu-")
    chemins = {}
    for lg in LANGUES:
        art = paire[lg]
        lien, lien_d = lien_article(art["url"], slug), lien_desinscription(JETON_APERCU)
        chemins[lg] = os.path.join(dossier, "apercu-%s.html" % lg)
        with open(chemins[lg], "w", encoding="utf-8") as fh:
            fh.write(html_mail(lg, art, lien, lien_d))
        with open(os.path.join(dossier, "apercu-%s.txt" % lg), "w", encoding="utf-8") as fh:
            fh.write("Subject: %s\n\n%s" % (TEXTES[lg]["sujet"].format(titre=art["titre"]), texte_mail(lg, art, lien, lien_d)))
    return chemins


def main(argv=None):
    a = arguments(sys.argv[1:] if argv is None else argv)
    slug = slug_normalise(a.slug)
    paire = lire_paire(RACINE, slug)
    for lg in LANGUES:
        print("Article %s : %s — « %s »" % (lg.upper(), paire[lg]["fichier"], paire[lg]["titre"]))
    pubs = [c for c, _ in paire["fr"]["publications"]]
    manque = [p["cle"] for p in PUBLICATIONS if p["cle"] not in pubs]
    print("Publications sous le bouton : %s%s" % (", ".join(pubs) or "aucune",
          (" — ABSENTES de l'article : %s (publier, puis câbler les boutons de retour — skill journal-nsy §4)"
           % ", ".join(manque)) if manque else ""))

    # ── Test : les deux versions à une seule adresse, ni FTP ni journal ──
    if a.test:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", a.test):
            raise Arret("--test : adresse invalide")
        cfg = config_smtp()
        s = smtp_ouvrir(cfg)
        try:
            for lg in LANGUES:
                s.send_message(construire_message(lg, paire[lg], slug, JETON_APERCU, a.test, expediteur(cfg),
                                                  cfg.get("to_address"), prefixe=PREFIXE_TEST))
                time.sleep(PAUSE_S)
        finally:
            s.quit()
        print("Test : 2 messages (FR, EN) envoyés à l'adresse fournie. Aucun abonné contacté, rien d'enregistré.")
        return 0

    # ── Abonnés : fichier local (essais) ou FTPS, en mémoire ──
    envois, env = None, None
    if a.abonnes_fichier:
        with open(a.abonnes_fichier, encoding="utf-8") as fh:
            donnees = json.load(fh)
        source = "fichier local (essai)"
    else:
        env = lire_env(os.path.join(SECRETS, "ftp.env"))
        ftp = ftp_ouvrir(env)
        try:
            donnees = ftp_lire_json(ftp, _distant(env, DISTANT_ABONNES), {"format": 1, "abonnes": []})
            envois = ftp_lire_json(ftp, _distant(env, DISTANT_ENVOIS), {})
        finally:
            ftp.quit()
        source = "serveur (FTPS)"
    listes, autres = abonnes_par_langue(donnees)
    total = sum(len(v) for v in listes.values())
    print("Abonnés confirmés : %d (%s) — source : %s" % (
        total, " · ".join("%s : %d" % (lg, len(listes[lg])) for lg in LANGUES), source))
    print("Non destinataires : %d en attente de confirmation, %d désinscrit(s), %d fiche(s) ignorée(s)" % (
        autres["attente"], autres["desinscrit"], autres["ignores"]))

    precedent = deja_envoye(envois, slug) if envois is not None else None
    if envois is None:
        print("Journal des envois : non consulté (fichier local)")
    elif precedent:
        print("Journal des envois : « %s » DÉJÀ ENVOYÉ le %s (%s destinataire(s)%s)" % (
            slug, precedent.get("date", "?"), precedent.get("envoyes", "?"),
            ", interrompu" if precedent.get("interrompu") else ""))
    else:
        print("Journal des envois : aucun envoi précédent de « %s »" % slug)

    # ── Dry-run ──
    if not a.go:
        chemins = ecrire_apercus(paire, slug)
        print("Aperçus (lien de désinscription factice) :")
        for lg in LANGUES:
            print("  %s : %s" % (lg.upper(), chemins[lg]))
        print("DRY-RUN — aucun e-mail envoyé. Pour envoyer : --test <adresse>, puis --go.")
        return 0

    # ── Envoi réel ──
    if precedent and not a.force:
        raise Arret("« %s » est déjà parti le %s — second envoi refusé (--force pour passer outre)."
                    % (slug, precedent.get("date", "?")))
    if total == 0:
        print("Aucun abonné confirmé : rien à envoyer, rien d'enregistré.")
        return 0
    cfg = config_smtp()
    exp, envoyes, erreur = expediteur(cfg), 0, None
    s = None
    try:
        s = smtp_ouvrir(cfg)
        for lg in LANGUES:
            for email, jeton in listes[lg]:
                if envoyes:
                    time.sleep(PAUSE_S)
                s.send_message(construire_message(lg, paire[lg], slug, jeton, email, exp, cfg.get("to_address")))
                envoyes += 1
                print("  ✓ %d/%d (%s)" % (envoyes, total, lg), flush=True)
    except (smtplib.SMTPException, OSError) as e:
        erreur = masquer("%s : %s" % (e.__class__.__name__, e))
        print("⛔ ARRÊT à la première erreur SMTP, après %d envoi(s) : %s" % (envoyes, erreur))
    finally:
        if s is not None:
            try:
                s.quit()
            except (smtplib.SMTPException, OSError):
                pass

    trace = {"date": datetime.now().astimezone().isoformat(timespec="seconds"), "envoyes": envoyes}
    if erreur:
        trace.update({"interrompu": True, "erreur": erreur})
    try:
        ftp = ftp_ouvrir(env)
        try:
            chemin = _distant(env, DISTANT_ENVOIS)
            journal = ftp_lire_json(ftp, chemin, {})
            journal[slug] = trace
            ftp_ecrire_json(ftp, chemin, journal)
        finally:
            ftp.quit()
        print("Journal des envois mis à jour sur le serveur : %s" % json.dumps({slug: trace}, ensure_ascii=False))
    except Exception as e:  # l'envoi a eu lieu : le dire, et donner de quoi l'inscrire à la main
        print("⚠️  Journal des envois NON mis à jour (%s) — à ajouter dans %s : %s" % (
            masquer(e), DISTANT_ENVOIS, json.dumps({slug: trace}, ensure_ascii=False)))
        return 1
    if erreur:
        print("Relancer avec --go --force renverra à TOUS les abonnés, y compris les %d déjà servis." % envoyes)
        return 1
    print("✅ %d e-mail(s) envoyé(s)." % envoyes)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Arret as e:
        print("⛔ %s" % e, file=sys.stderr)
        sys.exit(2)
