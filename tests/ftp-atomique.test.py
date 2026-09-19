#!/usr/bin/env python3
"""Tests de l'envoi FTP ATOMIQUE (scripts/ftp_atomique.py + scripts/ftp-deploy.py — code RÉEL).

Aucun réseau : un faux serveur FTP en mémoire remplace FTP_TLS, le `git fetch` du
garde-fou « arbre en retard » est simulé, et toute ouverture de socket fait échouer
le test. Vérifie que la cible n'est JAMAIS écrite sur place (vécu prv-concept.com le
19/09/2026 à 21:36:36 : un PHP lu pendant son STOR → « Class … not found »), qu'une
taille fausse laisse la cible intacte et ne laisse aucun temporaire, que la variante
EN MÉMOIRE (envoie_octets, journal de la newsletter) suit la même mécanique, et que les
garde-fous de ftp-deploy.py tiennent (exclusions, arbre en retard, connexion unique).
L'écriture atomique du journal de la newsletter est testée dans newsletter-envoi.test.py.
Pendant de tests/ftp-atomique-test.py du dépôt prv-concept.
Lancer : python3 -B tests/ftp-atomique.test.py (branché dans tests/run-tests.sh)
"""
import contextlib
import ftplib
import io
import os
import runpy
import shutil
import socket
import subprocess
import sys
import tempfile
from ftplib import error_perm, error_temp

sys.dont_write_bytecode = True           # pas de __pycache__ laissé dans le dépôt
RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SCRIPTS = os.path.join(RACINE, "scripts")
DEPLOY_PY = os.path.join(SCRIPTS, "ftp-deploy.py")
sys.path.insert(0, SCRIPTS)
import ftp_atomique  # noqa: E402

echecs = 0


def t(nom, ok, info=""):
    global echecs
    print(("  ✓ " if ok else "  ✗ ÉCHEC ") + nom + ("" if ok or not info else " — " + str(info)))
    if not ok:
        echecs += 1


def pas_de_reseau(*a, **k):
    raise AssertionError("ouverture de socket pendant un test hors réseau")


socket.socket.connect = pas_de_reseau
socket.create_connection = pas_de_reseau
ftp_atomique.time.sleep = lambda s: None  # les relances n'attendent pas


class FauxFTP:
    """Serveur FTP en mémoire. `lecteur` est appelé PENDANT chaque STOR : c'est le
    visiteur qui charge la cible au mauvais moment."""

    def __init__(self, fichiers=None, tronque=False, refus_stor=0, refus_rename=0, lecteur=None,
                 coupe_stor=0):
        self.fichiers = dict(fichiers or {})
        self.dossiers = set()
        self.commandes = []
        self.blocs = []                   # blocksize de chaque STOR
        self.connexions = 0
        self.tronque = tronque
        self.refus_stor = refus_stor
        self.refus_rename = refus_rename
        self.coupe_stor = coupe_stor      # canal de données coupé APRÈS quelques octets lus
        self.lecteur = lecteur

    # ce que ftp-deploy.py appelle sur FTP_TLS
    def __call__(self, *a, **k):
        return self

    def connect(self, *a, **k):
        self.connexions += 1
        self.commandes.append("CONNECT")

    def login(self, *a):
        pass

    def prot_p(self):
        pass

    def set_pasv(self, v):
        pass

    def quit(self):
        self.commandes.append("QUIT")

    def mkd(self, d):
        if d in self.dossiers:
            raise error_perm("550 exists")
        self.dossiers.add(d)

    def storbinary(self, cmd, fh, blocksize=8192):
        nom = cmd[len("STOR "):]
        self.commandes.append(cmd)
        self.blocs.append(blocksize)
        if self.refus_stor:
            self.refus_stor -= 1
            raise error_temp("450 anti-flood")
        self.fichiers[nom] = b""          # comme le vrai : STOR VIDE d'abord le fichier…
        if self.lecteur:
            self.lecteur(self)            # … et un visiteur peut passer pendant le transfert
        if self.coupe_stor:
            self.coupe_stor -= 1
            self.fichiers[nom] = fh.read(3)   # le flux est ENTAMÉ quand la coupure tombe
            raise error_temp("426 connection closed; transfer aborted")
        donnees = fh.read()
        self.fichiers[nom] = donnees[:-1] if self.tronque else donnees

    def size(self, nom):
        self.commandes.append("SIZE " + nom)
        if nom not in self.fichiers:
            raise error_perm("550 no such file")
        return len(self.fichiers[nom])

    def rename(self, de, vers):
        self.commandes.append(f"RNFR {de} RNTO {vers}")
        if self.refus_rename:
            self.refus_rename -= 1
            raise error_perm("550 rename refused")
        self.fichiers[vers] = self.fichiers.pop(de)

    def delete(self, nom):
        self.commandes.append("DELE " + nom)
        if nom not in self.fichiers:
            raise error_perm("550 no such file")
        del self.fichiers[nom]

    def temporaires(self):
        return [n for n in self.fichiers if ftp_atomique.SUFFIXE in n]

    def stor_sur_place(self):
        return [c for c in self.commandes if c.startswith("STOR ") and ftp_atomique.SUFFIXE not in c]


TMP = tempfile.mkdtemp(prefix="nsy-ftp-atomique-test-")


def fichier_local(contenu):
    chemin = os.path.join(TMP, "local-%d" % len(os.listdir(TMP)))
    with open(chemin, "wb") as fh:
        fh.write(contenu)
    return chemin


ANCIEN = b"<?php // chat.php, ancienne version\n"
NOUVEAU = b"<?php // chat.php, nouvelle version, plus longue\n"
CIBLE = "chat.php"

print("── ftp_atomique.envoie ──")

# 1. Remplacement d'un fichier en ligne : pendant le transfert, le visiteur lit l'ANCIEN
vu = []
f = FauxFTP({CIBLE: ANCIEN}, lecteur=lambda s: vu.append(s.fichiers.get(CIBLE)))
n = ftp_atomique.envoie(f, fichier_local(NOUVEAU), CIBLE)
t("la cible reçoit le nouveau contenu", f.fichiers[CIBLE] == NOUVEAU)
t("taille renvoyée = taille locale", n == len(NOUVEAU), n)
t("pendant le transfert, la cible est ENCORE l'ancienne (jamais vide ni partielle)", vu == [ANCIEN], vu)
t("aucun STOR sur la cible elle-même", not f.stor_sur_place(), f.stor_sur_place())
t("aucun temporaire laissé", not f.temporaires(), f.temporaires())
tmp = f.commandes[0][len("STOR "):]
t("temporaire = nom frère .nsy-envoi-<16 hex>, jamais en .php",
  tmp.startswith(CIBLE + ".nsy-envoi-") and len(tmp) == len(CIBLE) + 11 + 16
  and all(c in "0123456789abcdef" for c in tmp[-16:]) and not tmp.endswith(".php"), tmp)
t("séquence STOR tmp → SIZE tmp → RNFR/RNTO → SIZE cible",
  f.commandes == ["STOR " + tmp, "SIZE " + tmp, f"RNFR {tmp} RNTO {CIBLE}", "SIZE " + CIBLE],
  f.commandes)

# 2. Fichier neuf (la cible n'existe pas encore), dans un sous-dossier
f = FauxFTP()
ftp_atomique.envoie(f, fichier_local(b"neuf"), "journal/neuf.html")
t("fichier neuf créé, sans temporaire", f.fichiers == {"journal/neuf.html": b"neuf"}, f.fichiers)

# 3. Fichier vide
f = FauxFTP({"vide.txt": b"x"})
ftp_atomique.envoie(f, fichier_local(b""), "vide.txt")
t("fichier vide accepté (SIZE 0 == 0)", f.fichiers == {"vide.txt": b""}, f.fichiers)

# 4. Taille fausse : cible intacte, temporaire supprimé, arrêt net sans relance
f = FauxFTP({CIBLE: ANCIEN}, tronque=True)
try:
    ftp_atomique.envoie(f, fichier_local(NOUVEAU), CIBLE)
    t("taille fausse → EnvoiEchoue", False, "aucune exception")
except ftp_atomique.EnvoiEchoue as e:
    t("taille fausse → EnvoiEchoue", "NON touchée" in str(e), e)
t("taille fausse : la cible garde l'ancien contenu", f.fichiers[CIBLE] == ANCIEN)
t("taille fausse : temporaire supprimé", not f.temporaires(), f.temporaires())
t("taille fausse : aucun renommage, aucune relance",
  not any(c.startswith("RNFR") for c in f.commandes)
  and sum(c.startswith("STOR") for c in f.commandes) == 1, f.commandes)

# 5. 450 transitoire au premier STOR : relance sous un NOUVEAU temporaire
f = FauxFTP({CIBLE: ANCIEN}, refus_stor=1)
ftp_atomique.envoie(f, fichier_local(NOUVEAU), CIBLE)
stors = [c for c in f.commandes if c.startswith("STOR")]
t("450 transitoire → relance réussie", f.fichiers[CIBLE] == NOUVEAU and len(stors) == 2, f.commandes)
t("450 transitoire → deux temporaires distincts, aucun laissé",
  stors[0] != stors[1] and not f.temporaires(), stors)
with contextlib.redirect_stdout(io.StringIO()) as sortie:
    ftp_atomique.envoie(FauxFTP(refus_stor=1), fichier_local(b"a"), "a.txt")
t("STOR refusé d'emblée : pas de fausse alerte « temporaire resté »", sortie.getvalue() == "",
  sortie.getvalue())

# 6. Renommage refusé à chaque essai : erreur remontée, cible intacte, temporaires effacés
f = FauxFTP({CIBLE: ANCIEN}, refus_rename=3)
try:
    ftp_atomique.envoie(f, fichier_local(NOUVEAU), CIBLE)
    t("renommage refusé → erreur remontée", False, "aucune exception")
except error_perm:
    t("renommage refusé → erreur remontée", True)
t("renommage refusé : cible intacte, aucun temporaire", f.fichiers == {CIBLE: ANCIEN}, f.fichiers)

# 7. Trois 450 d'affilée : l'erreur remonte (comme avant), rien n'est laissé
f = FauxFTP({CIBLE: ANCIEN}, refus_stor=3)
try:
    ftp_atomique.envoie(f, fichier_local(NOUVEAU), CIBLE)
    t("3 × 450 → erreur remontée", False, "aucune exception")
except error_temp:
    t("3 × 450 → erreur remontée", True)
t("3 × 450 : cible intacte", f.fichiers == {CIBLE: ANCIEN}, f.fichiers)

# 8. Canal de données coupé EN PLEIN transfert : la relance repart du DÉBUT du fichier
f = FauxFTP({CIBLE: ANCIEN}, coupe_stor=1)
ftp_atomique.envoie(f, fichier_local(NOUVEAU), CIBLE)
t("426 en plein transfert → relance depuis le début, contenu entier, aucun temporaire",
  f.fichiers == {CIBLE: NOUVEAU}, f.fichiers)
f = FauxFTP()
ftp_atomique.envoie(f, fichier_local(b"x"), "x.txt")
t("taille de bloc par défaut inchangée (8192)", f.blocs == [8192], f.blocs)
f = FauxFTP()
ftp_atomique.envoie(f, fichier_local(b"x"), "x.txt", blocksize=65536)
t("taille de bloc transmise au STOR du temporaire", f.blocs == [65536], f.blocs)


print("── ftp_atomique.envoie_octets (en mémoire) ──")
JSON_ANCIEN = b'{"ancien": true}\n'
JSON_NOUVEAU = b'{\n  "nouveau": true,\n  "long": "plus long que l\'ancien"\n}\n'
J = "_secret/newsletter-envois.json"

vu = []
f = FauxFTP({J: JSON_ANCIEN}, lecteur=lambda s: vu.append(s.fichiers.get(J)))
n = ftp_atomique.envoie_octets(f, JSON_NOUVEAU, J)
tmp = f.commandes[0][len("STOR "):]
t("octets : la cible reçoit le nouveau contenu, taille renvoyée",
  f.fichiers == {J: JSON_NOUVEAU} and n == len(JSON_NOUVEAU), (n, f.fichiers))
t("octets : pendant le transfert, la cible est ENCORE l'ancienne, entière", vu == [JSON_ANCIEN], vu)
t("octets : même séquence STOR tmp → SIZE tmp → RNFR/RNTO → SIZE cible",
  f.commandes == ["STOR " + tmp, "SIZE " + tmp, f"RNFR {tmp} RNTO {J}", "SIZE " + J]
  and tmp.startswith(J + ".nsy-envoi-") and ftp_atomique.est_temporaire(tmp), f.commandes)

f = FauxFTP({J: JSON_ANCIEN}, tronque=True)
try:
    ftp_atomique.envoie_octets(f, JSON_NOUVEAU, J)
    t("octets : taille fausse → EnvoiEchoue", False, "aucune exception")
except ftp_atomique.EnvoiEchoue as e:
    t("octets : taille fausse → EnvoiEchoue", "NON touchée" in str(e), e)
t("octets : taille fausse → ancien contenu intact, temporaire supprimé, aucun renommage",
  f.fichiers == {J: JSON_ANCIEN} and not any(c.startswith("RNFR") for c in f.commandes), f.commandes)

f = FauxFTP({J: JSON_ANCIEN}, coupe_stor=1)
ftp_atomique.envoie_octets(f, JSON_NOUVEAU, J)
t("octets : 426 en plein transfert → la relance renvoie TOUS les octets (flux neuf)",
  f.fichiers == {J: JSON_NOUVEAU}, f.fichiers)
f = FauxFTP({J: JSON_ANCIEN}, refus_stor=1)
ftp_atomique.envoie_octets(f, JSON_NOUVEAU, J)
t("octets : 450 transitoire → relance réussie, aucun temporaire", f.fichiers == {J: JSON_NOUVEAU}, f.fichiers)
f = FauxFTP({J: JSON_ANCIEN})
ftp_atomique.envoie_octets(f, b"", J)
t("octets : contenu vide accepté (SIZE 0 == 0)", f.fichiers == {J: b""}, f.fichiers)
try:
    ftp_atomique.envoie_octets(FauxFTP(), "du texte", J)
    t("octets : une chaîne (str) est refusée avant toute commande", False, "acceptée")
except TypeError:
    t("octets : une chaîne (str) est refusée avant toute commande", True)

print("── ftp_atomique.est_temporaire ──")
t("reconnaît <cible>.nsy-envoi-<16 hex>", ftp_atomique.est_temporaire("chat.php.nsy-envoi-0123456789abcdef"))
t("ignore les faux amis (hex trop court, majuscules, suffixe ajouté, suffixe PRV, nom ordinaire)",
  not any(ftp_atomique.est_temporaire(n) for n in (
      "chat.php.nsy-envoi-0123", "chat.php.nsy-envoi-0123456789ABCDEF",
      "chat.php.nsy-envoi-0123456789abcdef.php", "chat.php.prv-envoi-0123456789abcdef",
      "nsy-envoi.php", "chat.php")))


print("── scripts/ftp-deploy.py ──")

# Le garde-fou « arbre en retard » lance `git fetch` puis `git rev-list` : simulés ici,
# aucun autre sous-processus n'est permis.
RETARD = {"n": 0}
_run = subprocess.run


def faux_run(cmd, *a, **k):
    if cmd[:1] == ["git"] and "fetch" in cmd:
        return subprocess.CompletedProcess(cmd, 0, "", "")
    if cmd[:1] == ["git"] and "rev-list" in cmd:
        return subprocess.CompletedProcess(cmd, 0, "%d\n" % RETARD["n"], "")
    raise AssertionError("sous-processus inattendu pendant le test : %r" % (cmd,))


subprocess.run = faux_run
os.environ.update({"FTP_HOST": "h", "FTP_USER": "u", "FTP_PASS": "p", "FTP_DIR": ""})
os.environ.pop("DEPLOY_EN_RETARD", None)


def deploie(script, faux):
    """Lance ftp-deploy.py (code réel) contre le faux serveur ; (sortie, code de sortie)."""
    ftplib.FTP_TLS = faux                  # ftp-deploy.py fait `from ftplib import FTP_TLS`
    code = None
    with contextlib.redirect_stdout(io.StringIO()) as sortie:
        try:
            runpy.run_path(script, run_name="__main__")
        except SystemExit as e:
            code = e.code
    return sortie.getvalue(), code


# a. Le vrai deploy/ du dépôt : la vitrine part, _secret/ jamais
lu = lambda p: open(os.path.join(RACINE, "deploy", p), "rb").read()  # noqa: E731
faux = FauxFTP({"index.html": b"ancienne page", "chat.php": ANCIEN})
sortie, code = deploie(DEPLOY_PY, faux)
envoyes = list(faux.fichiers)
t("ftp-deploy : la vitrine part (index.html et chat.php remplacés)",
  code is None and faux.fichiers.get("index.html") == lu("index.html")
  and faux.fichiers.get("chat.php") == lu("chat.php") and len(envoyes) > 50, (code, len(envoyes)))
t("ftp-deploy : jamais _secret/ (config SMTP du serveur)",
  not [n for n in envoyes if n.split("/")[0] == "_secret"])
t("ftp-deploy : aucun STOR sur place, aucun temporaire laissé",
  not faux.stor_sur_place() and not faux.temporaires(), faux.stor_sur_place()[:3])
t("ftp-deploy : UNE seule connexion, fermée à la fin",
  faux.connexions == 1 and faux.commandes[-1] == "QUIT", (faux.connexions, faux.commandes[-1:]))
t("ftp-deploy : bilan ✅ affiché", "✅ %d fichiers envoyés" % len(envoyes) in sortie, sortie[-200:])

# b. Arbre de démonstration : TOUTES les exclusions existantes, sur une copie du code réel
DEMO = os.path.join(TMP, "depot")
os.makedirs(os.path.join(DEMO, "scripts"))
for nom in ("ftp-deploy.py", "ftp_atomique.py"):
    shutil.copy(os.path.join(SCRIPTS, nom), os.path.join(DEMO, "scripts", nom))
ARBRE = {
    "index.html": b"<html>accueil</html>",
    ".htaccess": b"RewriteEngine On\n",
    "chat.php": NOUVEAU,
    "css/style.css": b"body{}",
    "journal/article.html": b"<html>article</html>",
    "_secret/config.php": b"<?php return ['smtp_password' => 'x'];",
    "_secret/.htaccess": b"Require all denied\n",
    "old-wp/wp-config.php": b"<?php",
    "_old/ancien.html": b"x",
    "boutique/index.php": b"<?php",
    "forum/config.php": b"<?php",
    ".DS_Store": b"\0",
    "css/.DS_Store": b"\0",
    "journal/_secret/garde.txt": b"un _secret/ plus bas est exclu lui aussi",
}
for rel, contenu in ARBRE.items():
    chemin = os.path.join(DEMO, "deploy", rel)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "wb") as fh:
        fh.write(contenu)
faux = FauxFTP({"chat.php": ANCIEN})
sortie, code = deploie(os.path.join(DEMO, "scripts", "ftp-deploy.py"), faux)
t("arbre démo : exactement la vitrine, rien d'autre",
  sorted(faux.fichiers) == [".htaccess", "chat.php", "css/style.css", "index.html", "journal/article.html"],
  sorted(faux.fichiers))
t("arbre démo : jamais _secret/, old-wp/, _old/, boutique/, forum/, .DS_Store",
  not [n for n in faux.fichiers if set(n.split("/")) & {"_secret", "old-wp", "_old", "boutique", "forum", ".DS_Store"}])
t("arbre démo : contenus exacts, aucun temporaire, aucun STOR sur place",
  all(faux.fichiers[k] == ARBRE[k] for k in faux.fichiers)
  and not faux.temporaires() and not faux.stor_sur_place(), faux.commandes[:4])
t("arbre démo : .htaccess lui aussi par temporaire + renommage",
  any(c.startswith("RNFR .htaccess.nsy-envoi-") and c.endswith(" RNTO .htaccess") for c in faux.commandes))
t("arbre démo : dossiers distants créés (css, journal)", faux.dossiers == {"css", "journal"}, faux.dossiers)

# c. Taille fausse : ARRÊT au premier fichier, rien en ligne, connexion fermée
faux = FauxFTP(tronque=True)
sortie, code = deploie(DEPLOY_PY, faux)
t("ftp-deploy : taille fausse → ARRÊT au premier fichier, rien en ligne, connexion fermée",
  str(code).startswith("\n❌") and "ARRÊTÉ après 0 fichier" in str(code) and not faux.fichiers
  and faux.commandes[-1] == "QUIT", (code, sorted(faux.fichiers)[:5]))

# d. Garde-fou « arbre en retard » conservé : refus AVANT toute connexion
RETARD["n"] = 3
faux = FauxFTP()
sortie, code = deploie(DEPLOY_PY, faux)
t("ftp-deploy : arbre en retard → refus, code 1, aucune connexion",
  code == 1 and faux.connexions == 0 and "3 commit(s) de retard" in sortie, (code, faux.connexions))
RETARD["n"] = 0

subprocess.run = _run
shutil.rmtree(TMP, ignore_errors=True)
print()
print("✅ tous les tests passent" if not echecs else f"❌ {echecs} échec(s)")
sys.exit(1 if echecs else 0)
