#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Essais HORS LIGNE de scripts/sonde-journal.py sur le code RÉEL.

`interroge()` est remplacée : rien ne part au serveur, aucun identifiant n'est
lu. Les lignes de journal ont le FORMAT exact relevé sur l'hébergement, avec des
adresses de documentation (RFC 5737) et un identifiant client inventé. `deploy/`
est un arbre fabriqué : le résultat ne dépend pas de ce que livre le dépôt.

    python3 tests/sonde-journal.test.py
"""
import contextlib
import ftplib
import importlib.util
import io
import json
import os
import shutil
import sys
import tempfile
import urllib.error

ICI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("sonde", os.path.join(ICI, "..", "scripts", "sonde-journal.py"))
sonde = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sonde)

# ---- un deploy/ fabriqué : une page, un script, un répertoire à index ----
FAUX = tempfile.mkdtemp(prefix="sonde-test-")
for chemin in ("deploy/index.html", "deploy/chat.php", "deploy/stats/index.html"):
    os.makedirs(os.path.dirname(os.path.join(FAUX, chemin)), exist_ok=True)
    open(os.path.join(FAUX, chemin), "w").close()
sonde.RACINE = FAUX

WEB = "/home/clients/0123456789abcdef0123456789abcdef/web"
H = "nsy.fr [Thu Sep 17 09:00:00.000000 2026] "
P = "[pid 1234:tid 140000000000000] [client 192.0.2.10:0] "


def autoindex(rep):
    return (H + "[autoindex:error] " + P + f"AH01276: Cannot serve directory {WEB}{rep}: No matching "
            "DirectoryIndex (index.html,index.php) found, and server-generated directory index "
            "forbidden by Options directive")


def refuse(cible, referer=""):
    return H + "[authz_core:error] " + P + f"AH01630: client denied by server configuration: {WEB}{cible}{referer}"


def uri_invalide(uri):
    return H + "[core:error] " + P + f"AH10244: invalid URI path ({uri})"


def modsec(uri, message="Access denied with code 403 (phase 2)."):
    return (H + "[-:error] " + P + f'[client 192.0.2.10] ModSecurity: {message} Match of "rx phpxref" against '
            '"REQUEST_URI" required. [file "/etc/modsecurity/regles.conf"] [line "7"] [id "60008"] '
            f'[hostname "www.nsy.fr"] [uri "{uri}"] [unique_id "aaaaaaaaaaaaaaaaaaaaaaaaaaa"]')


SCAN = "\n".join([autoindex("/.well-known/"), autoindex("/.well-known/"), autoindex("/public/"),
                  refuse("/.git"), refuse("/.git"), refuse("/.env"), refuse("/vendor/.env", ", referer: http://exemple.test/"),
                  uri_invalide("/icons/.%2e/%2e%2e/apache2/icons/sphere1.png"),
                  modsec("/phpinfo.php.old"), modsec("/phpinfo.php.save")])
FCGI_1 = H + "[proxy_fcgi:error] [pid 1234:tid 140000000000000] [client 10.0.0.1:0] AH01067: Failed to read FastCGI header"
FCGI_2 = (H + "[proxy_fcgi:error] [pid 1234:tid 140000000000000] (104)Connection reset by peer: "
          "[client 10.0.0.1:0] AH01075: Error dispatching request to : ")
def ssl_sni(hote):
    return (H + "[ssl:error] " + P + f"AH02032: Hostname {hote} provided via SNI and hostname "
            f"{hote.rstrip('.')} provided via HTTP have no compatible SSL setup for policy 'secure', "
            f"referer https://{hote}/robots.txt")


# Le POINT FINAL fait toute la différence : forme DNS absolue qu'Apache refuse
# AVANT tout code à nous (rien de réparable), contre un vrai défaut de certificat.
def limite(uri, referer=""):
    # format relevé le 04/10/2026 : ni code AH, une parenthèse finale posée par l'hébergeur
    return (H + "[-:error] " + P + f"Rejected, too many connections from this host. "
            f"(vhost:nsy.fr uri:{uri} current:31 limit:30{referer}")


def trop_long(uri, errno="(36)File name too long"):
    # format relevé le 11/10/2026 : l'errno se glisse AVANT [client …]
    return (H + "[core:error] [pid 1234:tid 140000000000000] " + errno + ": [client 192.0.2.10:0] "
            f"AH00036: access to {uri} failed (filesystem path '{WEB}{uri}'), "
            "referer https://www.nsy.fr/blog.html")


def sans_variante(doc="HTTP_BAD_REQUEST", chemin="/usr/share/apache2/error/"):
    # format relevé le 13/10/2026 sur prv-concept.com
    return H + "[negotiation:error] " + P + f"AH00690: no acceptable variant: {chemin}{doc}.html.var"

def fichier_woo(chemin="/boutique/wp-content/uploads/woocommerce_uploads/2013/06/Guide_durites.pdf"):
    # format relevé le 17/10/2026 sur prv-concept.com (robots qui passent par wp-json/wp/v2/media)
    return (H + "[access_compat:error] " + P + f"AH01797: client denied by server configuration: {WEB}{chemin}, "
            "referer https://www.prv-concept.com/boutique/en/wp-json/wp/v2/media?parent=323")


MCP_REFUS = ('PHP message: [ERROR] Permission denied for MCP API access. User ID 0 does not have capability "read"'
             ' | Context: ["HttpTransport::check_permission"] | User ID: 0')


def mcp(n=4, autre=None):
    # format relevé le 17/10/2026 : le même refus anonyme répété, séparé par « ; »
    messages = [MCP_REFUS] * n + ([autre] if autre else [])
    return H + "[proxy_fcgi:error] " + P + "AH01071: Got error '" + "; ".join(messages) + "'"


LONG = "/blog/OnFriday,itwasofftothesouthoftheisland" + "x" * 300


SSL_POINT = ssl_sni("nsy.fr.")
SSL = ssl_sni("nsy.fr")
PHP_WARN = (H + "[proxy_fcgi:error] " + P + "AH01071: Got error 'PHP message: PHP Warning:  Undefined "
            f"variable $x in {WEB}/chat.php on line 3'")
PHP_DEPR = PHP_WARN.replace("PHP Warning:  Undefined variable $x", "PHP Deprecated:  str_getcsv(): the $escape parameter")
PHP_FATAL = PHP_WARN.replace("PHP Warning:  Undefined variable $x", "PHP Fatal error:  Uncaught Error")
# La sonde de DISPONIBILITÉ de chat.php (le voyant du widget) écrit dans
# chat-errors.log. Elle a longtemps écrit « sonde modèle <modèle> → HTTP 429 »,
# que le motif AMONT ne reconnaissait pas : un seul 429 du voyant — et small et
# medium sont à 0 req/min depuis le 13/09/2026 — faisait rendre 2 à la sonde du
# journal, donc bloquait tout déploiement. Alignée le 20/09/2026 sur le même
# préfixe que le parcours de génération.
VOYANT = "2026-09-20T09:00:00+02:00 upstream HTTP 429 — sonde modèle ministral-8b-2512 : capacity"
VOYANT_403 = "2026-09-20T09:00:00+02:00 upstream HTTP 403 — sonde modèle mistral-medium : plan inactif"
CHAT_AMONT = H + "[proxy_fcgi:error] " + P + "AH01071: Got error 'PHP message: NSY chat: upstream HTTP 429 — capacity'"
AMONT = "2026-09-17T09:00:00+02:00 upstream HTTP 429 (mistral-small-latest)"

LOG = "~/ik-logs/error.log"
CHAT = "~/web/_secret/chat-errors.log"


def joue(args, fichiers, etat=None, rotation=False):
    """(code, sortie, état écrit). `fichiers` : {clé: texte} ou {clé: (texte, taille du fichier)}."""
    etat = etat or {LOG: {"taille": 1000}, CHAT: {"taille": 1000}}
    rep = {"ok": True, "php": "8.5.9", "fichiers": {k: {"taille": v["taille"]} for k, v in etat.items()}}
    for k, v in fichiers.items():
        texte, taille = v if isinstance(v, tuple) else (v, None)
        rep["fichiers"][k] = {"nouveau": texte + "\n",
                              "taille": taille if taille is not None else etat[k]["taille"] + len(texte.encode()) + 1}
        if rotation:
            rep["fichiers"][k]["rotation"] = True
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(etat, fh)
    sonde.interroge = lambda depuis: json.loads(json.dumps(rep))
    sys.argv = ["sonde-journal.py", "--etat", fh.name] + args
    tampon = io.StringIO()
    with contextlib.redirect_stdout(tampon):
        code = sonde.main()
    with open(fh.name, encoding="utf-8") as lu:
        ecrit = json.load(lu)
    os.unlink(fh.name)
    return code, tampon.getvalue(), ecrit


echecs = 0


def t(nom, code, attendu, sortie="", contient=(), absent=(), vrai=True):
    global echecs
    ok = (code == attendu and vrai and all(c in sortie for c in contient)
          and not any(a in sortie for a in absent))
    echecs += 0 if ok else 1
    print(("  ✓ " if ok else "  ✗ ÉCHEC ") + nom)
    if not ok:
        print(f"      code {code}, attendu {attendu}\n" + "\n".join("      " + l for l in sortie.splitlines()))


S = ["--tolere-scanners"]

c, s, _ = joue([], {LOG: SCAN})
t("sans option, le bruit de scanners ARRÊTE (comportement d'origine)", c, 2, s, ["NON VIERGE"], ["toléré"])

c, s, _ = joue(S, {LOG: SCAN})
t("--tolere-scanners : les quatre motifs sont décomptés, code 0", c, 0, s,
  ["AH01276 × 3", "AH01630 × 4", "AH10244 × 1", "ModSecurity × 2", "AUCUNE ERREUR À NOUS"],
  ["JOURNAL VIERGE", "NON VIERGE", "⚠️"])
t("les cibles sont affichées relatives au site, sans le chemin de l'hébergement", c, 0, s,
  ["2 × /.git", "2 × /.well-known/", "1 × /public/", "1 × /vendor/.env", "1 × /phpinfo.php.old"],
  ["/home/clients/", "referer"])

c, s, _ = joue(S, {LOG: SCAN + "\n" + SSL_POINT})
t("--tolere-scanners : AH02032 à POINT FINAL est toléré et décompté", c, 0, s,
  ["AH02032 × 1", "AUCUNE ERREUR À NOUS"], ["NON VIERGE"])
c, s, _ = joue([], {LOG: SSL_POINT})
t("sans l'option, AH02032 à point final ARRÊTE quand même", c, 2, s, ["NON VIERGE"])

c, s, _ = joue(S, {LOG: SCAN + "\n" + limite("/wp-login.php") + "\n" + limite("/xmlrpc.php", ", referer http://exemple.test/")})
t("--tolere-scanners : les refus de l'hébergeur (trop de connexions) sont tolérés et décomptés", c, 0, s,
  ["trop-de-connexions (refus du limiteur de l'hébergeur, plus de 30 connexions depuis une adresse) : 2 ligne(s)",
   "trop-de-connexions × 2", "1 × /wp-login.php", "1 × /xmlrpc.php",
   "AUCUNE ERREUR À NOUS"], ["NON VIERGE", "⚠️"])
c, s, _ = joue([], {LOG: limite("/wp-login.php")})
t("sans l'option, un refus de l'hébergeur ARRÊTE quand même", c, 2, s, ["NON VIERGE"])
c, s, _ = joue(S, {LOG: limite("/")})
t("refus de l'hébergeur sur la page d'accueil → toléré mais ⚠️ (deploy/index.html)", c, 0, s,
  ["L'hébergeur a refoulé (trop de connexions) une requête vers / (deploy/index.html",
   "1 cible(s) À NOUS refusée(s) par l'hébergeur"])
c, s, _ = joue(S, {LOG: SCAN + "\n" + trop_long(LONG) + "\n" + trop_long(LONG)})
t("--tolere-scanners : AH00036 « File name too long » est toléré et décompté", c, 0, s,
  ["AH00036 core (adresse trop longue pour être un fichier, refusée par Apache) : 2 ligne(s)",
   "AH00036 × 2", "AUCUNE ERREUR À NOUS"], ["NON VIERGE", "/home/clients/"])
c, s, _ = joue([], {LOG: trop_long(LONG)})
t("sans l'option, AH00036 ARRÊTE quand même", c, 2, s, ["NON VIERGE"])
c, s, _ = joue(S, {LOG: SCAN + "\n" + sans_variante() + "\n" + sans_variante("HTTP_NOT_FOUND")})
t("--tolere-scanners : AH00690 sur une page d'erreur d'Apache est toléré et décompté", c, 0, s,
  ["AH00690 negotiation (page d'erreur d'Apache sans variante acceptable) : 2 ligne(s)",
   "AH00690 × 2", "AUCUNE ERREUR À NOUS"], ["NON VIERGE"])
c, s, _ = joue([], {LOG: sans_variante()})
t("sans l'option, AH00690 ARRÊTE quand même", c, 2, s, ["NON VIERGE"])

c, s, _ = joue(S, {LOG: SCAN + "\n" + fichier_woo() + "\n" + fichier_woo()})
t("--tolere-scanners : AH01797 sur un fichier protégé de WooCommerce est toléré et décompté", c, 0, s,
  ["AH01797 access_compat (fichier de produit WooCommerce protégé, téléchargement direct refusé) : 2 ligne(s)",
   "AH01797 × 2", "AUCUNE ERREUR À NOUS"], ["NON VIERGE"])
c, s, _ = joue(S, {LOG: fichier_woo("/boutique/wp-content/uploads/2026/10/photo.jpg")})
t("AH01797 HORS de woocommerce_uploads ARRÊTE, même avec l'option", c, 2, s, ["NON VIERGE"])
c, s, _ = joue([], {LOG: fichier_woo()})
t("sans l'option, AH01797 ARRÊTE quand même", c, 2, s, ["NON VIERGE"])
c, s, _ = joue(S, {LOG: SCAN + "\n" + mcp() + "\n" + mcp(1)})
t("--tolere-scanners : AH01071 du module MCP (appel anonyme refusé) est toléré et décompté", c, 0, s,
  ["AH01071 MCP (module MCP de la boutique, appel anonyme refusé) : 2 ligne(s)",
   "AH01071 × 2", "AUCUNE ERREUR À NOUS"], ["NON VIERGE"])
c, s, _ = joue(S, {LOG: mcp(2, "PHP message: PHP Warning:  Undefined variable $x in /web/boutique/x.php on line 3")})
t("AH01071 MCP suivi d'une VRAIE erreur PHP ARRÊTE, même avec l'option", c, 2, s, ["NON VIERGE"])
c, s, _ = joue(S, {LOG: mcp(1).replace("User ID 0", "User ID 7", 1)})
t("AH01071 MCP pour un compte CONNECTÉ (User ID 7) ARRÊTE", c, 2, s, ["NON VIERGE"])
c, s, _ = joue([], {LOG: mcp()})
t("sans l'option, AH01071 MCP ARRÊTE quand même", c, 2, s, ["NON VIERGE"])

# AH01075 : délai expiré pendant la LECTURE de la requête du client (format relevé le 19/10/2026,
# robot Baidu sur une fiche produit) — toléré sous cette forme seule (owner, 19/10/2026).
def lecture_expiree(errno="(70007)The timeout specified has expired", fin="(reading input brigade)"):
    return (H + "[proxy_fcgi:error] [pid 1234:tid 140000000000000] " + errno + ": [client 116.179.33.12:0] "
            "AH01075: Error dispatching request to : " + fin
            + ", referer https://www.prv-concept.com/boutique/en/product/durites-vase-ldr-r25-v6-turbo/")


c, s, _ = joue(S, {LOG: SCAN + "\n" + lecture_expiree() + "\n" + lecture_expiree()})
t("--tolere-scanners : AH01075 lecture expirée de la requête du client est tolérée et décomptée", c, 0, s,
  ["AH01075 proxy_fcgi (lecture de la requête du client interrompue, avant PHP) : 2 ligne(s)",
   "AUCUNE ERREUR À NOUS"], ["NON VIERGE"])
c, s, _ = joue(S, {LOG: lecture_expiree(errno="(104)Connection reset by peer") + "\n"
                        + lecture_expiree(errno="(70008)Partial results are valid but processing is incomplete")})
t("--tolere-scanners : la même lecture coupée (104) ou partielle (70008) est tolérée aussi (22/10/2026)", c, 0, s,
  ["AH01075 proxy_fcgi (lecture de la requête du client interrompue, avant PHP) : 2 ligne(s)"], ["NON VIERGE"])
c, s, _ = joue(S, {LOG: lecture_expiree(fin="")})
t("AH01075 sans « reading input brigade » ARRÊTE, même avec l'option", c, 2, s, ["NON VIERGE"])
c, s, _ = joue(S, {LOG: FCGI_2})
t("AH01075 (coupure FastCGI ordinaire) ARRÊTE toujours", c, 2, s, ["NON VIERGE"])
c, s, _ = joue([], {LOG: lecture_expiree()})
t("sans l'option, AH01075 lecture expirée ARRÊTE quand même", c, 2, s, ["NON VIERGE"])

# --bref : une seule ligne, et SURTOUT le code de sortie intact. C'est l'option qui rend
# « sonde && envoi » sûr — sans elle on pipe, et « && » lit le code de `tail` (vécu
# deux fois : 22/09 vers nsy.fr, 24/09 vers prv-concept.com).
c, s, _ = joue(S + ["--bref"], {LOG: SCAN})
t("--bref : le verdict seul, code 0", c, 0, s, ["AUCUNE ERREUR À NOUS"], ["-> ", "NOUVEAU"])
c, s, _ = joue(["--bref"], {LOG: SCAN})
t("--bref : le code 2 est CONSERVÉ quand le journal n'est pas vierge", c, 2, s, ["NON VIERGE"])
c, s, _ = joue(["--bref"], {LOG: SCAN})
t("--bref : rien d'autre que les lignes [sonde]", c, 2,
  "\n".join(l for l in s.splitlines() if l and not l.startswith("[sonde]")) or "(vide)",
  ["(vide)"])

for nom, ligne in (("proxy_fcgi AH01067 (coupure FastCGI)", FCGI_1), ("proxy_fcgi AH01075 (coupure FastCGI)", FCGI_2),
                   ("ssl AH02032 sur un nom SANS point final (vrai défaut de certificat)", SSL),
                   ("PHP Warning", PHP_WARN), ("PHP Deprecated", PHP_DEPR), ("PHP Fatal", PHP_FATAL),
                   ("refus amont écrit par chat.php au journal de l'hébergement", CHAT_AMONT),
                   ("ModSecurity Warning (pas un Access denied)", modsec("/x", "Warning.")),
                   ("AH00690 hors des pages d'erreur d'Apache", sans_variante("index", WEB + "/journal/")),
                   ("AH00690 RECOPIÉ dans un message PHP", PHP_WARN[:-1] + " " + sans_variante() + "'"),
                   ("AH00036 avec un AUTRE errno que 36 (droits)", trop_long("/blog.html", "(13)Permission denied")),
                   ("AH00036 RECOPIÉ dans un message PHP", PHP_WARN[:-1] + " " + trop_long(LONG) + "'"),
                   ("refus de l'hébergeur RECOPIÉ dans un message PHP", PHP_WARN[:-1] + " " + limite("/x") + "'"),
                   ("un autre refus de l'hébergeur que « too many connections »",
                    H + "[-:error] " + P + "Rejected, request rate exceeded. (vhost:nsy.fr uri:/ current:31 limit:30"),
                   ("ModSecurity corps de requête trop gros", modsec("/contact.php", "Request body (Content-Length) is larger than the configured limit (13107200).")),
                   ("ligne de scanner RECOPIÉE dans un message PHP", PHP_WARN[:-1] + " " + refuse("/.git") + "'"),
                   ("ligne ModSecurity RECOPIÉE dans un message PHP", PHP_WARN[:-1] + " " + modsec("/x") + "'"),
                   ("en-tête de scanner imité dans un message PHP",
                    H + "[proxy_fcgi:error] " + P + "AH01071: Got error 'PHP message: [autoindex:error] [pid 1] "
                    "[client 192.0.2.1:0] AH01276: Cannot serve directory /x/: No matching DirectoryIndex (index.html) found'"),
                   ("ligne inconnue", "n'importe quoi")):
    c, s, _ = joue(S, {LOG: SCAN + "\n" + ligne})
    t(f"ARRÊTE malgré l'option : {nom}", c, 2, s, ["NON VIERGE", ligne, "toléré, bruit de scanners"])

c, s, _ = joue(S, {CHAT: SCAN})
t("les motifs de scanners dans le journal du CHATBOT arrêtent", c, 2, s, ["NON VIERGE"], ["toléré"])

c, s, _ = joue(["--tolere-amont"], {CHAT: AMONT})
t("--tolere-amont : refus du fournisseur au journal du chatbot → 0", c, 0, s,
  ["refus amont du fournisseur, toléré", "JOURNAL VIERGE"])
c, s, _ = joue(["--tolere-amont"], {LOG: AMONT})
t("--tolere-amont ne vaut pas pour le journal de l'hébergement", c, 2, s)
c, s, _ = joue(["--tolere-amont"], {LOG: SCAN})
t("--tolere-amont ne tolère pas les scanners", c, 2, s, ["NON VIERGE"], ["toléré"])
c, s, _ = joue(S, {CHAT: AMONT})
t("--tolere-scanners ne tolère pas le refus amont", c, 2, s)
c, s, _ = joue(["--tolere-amont"] + S, {LOG: SCAN, CHAT: AMONT})
t("les deux options ensemble → 0", c, 0, s, ["AUCUNE ERREUR À NOUS", "refus amont"])

c, s, _ = joue(S, {LOG: autoindex("/stats/")})
t("AH01276 sur un répertoire dont deploy/ livre l'index → ARRÊTE", c, 2, s,
  ["nous livrons deploy/stats/index.html", "NON VIERGE"])

c, s, _ = joue(S, {LOG: SCAN + "\n" + modsec("/chat.php")})
t("ModSecurity sur un fichier À NOUS → toléré, mais ⚠️ jusque dans la ligne finale", c, 0, s,
  ["ModSecurity a refusé une requête vers /chat.php (deploy/chat.php", "1 cible(s) À NOUS refusée(s) par l'hébergeur"])
c, s, _ = joue(S, {LOG: modsec("/")})
t("ModSecurity sur la page d'accueil → ⚠️ (deploy/index.html)", c, 0, s, ["(deploy/index.html"])
c, s, _ = joue(S, {LOG: modsec("/../_secret/ftp.env")})
t("une cible qui remonte hors de deploy/ n'est jamais comparée", c, 0, s, [], ["⚠️", "fichier À NOUS"])

gros = "\n".join([refuse("/.git")] * 400)[:sonde.PLAFOND - 1]
c, s, e = joue(S, {LOG: (gros, 1000 + sonde.PLAFOND + 4321)})
t("delta plus gros que le plafond : rien n'est toléré, l'état s'arrête à ce qui a été LU", c, 2, s,
  ["4321 o NON RELUS"], vrai=e[LOG]["taille"] == 1000 + sonde.PLAFOND)

c, s, _ = joue(S, {LOG: (SCAN, 500)}, etat={LOG: {"taille": 90000}, CHAT: {"taille": 1000}}, rotation=True)
t("rotation du journal : relu depuis 0, pas de faux « non relus »", c, 0, s,
  ["ROTATION", "AUCUNE ERREUR À NOUS"], ["NON RELUS"])

c, s, _ = joue(S, {})
t("aucun octet de plus → JOURNAL VIERGE", c, 0, s, ["JOURNAL VIERGE"], ["toléré"])
c, s, _ = joue(["--tolere-scanner"], {LOG: SCAN})
t("option mal orthographiée → reste strict", c, 2, s)


# La sonde qui ÉCHOUE : le seul chemin que `joue()` ne traverse jamais, puisqu'elle
# remplace interroge() par une réponse toute faite. Vécu : la clause s'était écrite
# `except (all_errors, ...)` au lieu de `(*all_errors, ...)` — all_errors est un
# TUPLE, un tuple imbriqué dans un except lève TypeError au lieu d'attraper, et la
# CAUSE de l'échec (identifiants absents, FTP refusé, 450 anti-flood) était perdue
# derrière une trace d'exécution.
def joue_echec(erreur):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump({LOG: {"taille": 1000}, CHAT: {"taille": 1000}}, fh)

    def boum(depuis):
        raise erreur
    sonde.interroge = boum
    sys.argv = ["sonde-journal.py", "--etat", fh.name]
    tampon = io.StringIO()
    with contextlib.redirect_stdout(tampon):
        code = sonde.main()
    os.unlink(fh.name)
    return code, tampon.getvalue()


for nom, erreur in (("FTP refusé (ftplib.error_perm)", ftplib.error_perm("550 interdit")),
                    ("identifiants absents (OSError d'env())", OSError("identifiants FTP absents (FTP_PASS)")),
                    ("réseau coupé (URLError)", urllib.error.URLError("nom introuvable")),
                    ("réponse illisible (ValueError)", ValueError("JSON tronqu\u00e9")),
                    ("connexion fermée (EOFError)", EOFError("coupure"))):
    c, s_ = joue_echec(erreur)
    t(f"sonde en échec — {nom} : code 1 et la CAUSE affichée", c, 1, s_, ["sonde en échec", str(erreur)[:20]])


c, s_, _ = joue(["--tolere-amont"], {CHAT: VOYANT})
t("--tolere-amont : le 429 du VOYANT de chat.php est toléré (format aligné 20/09)", c, 0, s_,
  ["refus amont du fournisseur, toléré", "JOURNAL VIERGE"])
c, s_, _ = joue([], {CHAT: VOYANT})
t("sans l'option, le 429 du voyant arrête quand même", c, 2, s_)
c, s_, _ = joue(["--tolere-amont"], {CHAT: VOYANT_403})
t("un 403 du voyant (modèle hors du palier) ARRÊTE, comme en génération", c, 2, s_)
c, s_, _ = joue(["--tolere-amont"], {LOG: VOYANT})
t("la même ligne dans le journal de l'HÉBERGEMENT arrête toujours", c, 2, s_)

shutil.rmtree(FAUX, ignore_errors=True)
print("SONDE-JOURNAL : TOUS LES TESTS PASSENT" if not echecs else f"SONDE-JOURNAL : {echecs} ÉCHEC(S)")
sys.exit(0 if not echecs else 1)
