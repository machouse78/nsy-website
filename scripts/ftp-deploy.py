#!/usr/bin/env python3
"""Envoi de deploy/ vers le FTP Infomaniak en UNE SEULE connexion FTPS.

Un curl par fichier ouvrait 63 connexions rapides -> l'anti-flood du serveur
renvoie 450. Ici : une connexion FTP_TLS persistante, envois séquentiels, avec
retry sur erreur transitoire. Chaque envoi est ATOMIQUE (ftp_atomique.py,
19/09/2026) : nom temporaire, contrôle de taille, renommage sur la cible — un
visiteur ne charge jamais un PHP à moitié écrit. N'efface JAMAIS un fichier en
ligne (seul DELE : notre propre temporaire, après un envoi raté).

Identifiants via l'environnement : FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR.
Exclusions : _secret/, old-wp/, _old/, boutique/, forum/, .DS_Store.
"""
import os
import subprocess
import sys
from ftplib import FTP_TLS, error_perm

sys.dont_write_bytecode = True           # pas de scripts/__pycache__ laissé dans le dépôt
from ftp_atomique import EnvoiEchoue, envoie  # noqa: E402

HOST = os.environ["FTP_HOST"]
USER = os.environ["FTP_USER"]
PW = os.environ["FTP_PASS"]
BASE = os.environ.get("FTP_DIR", "").strip("/")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "deploy"))
EXCL_DIRS = {"_secret", "old-wp", "_old", "boutique", "forum"}

# ───── Garde-fou : ne jamais envoyer un arbre en retard sur origin/main ─────
# Vécu 17/09/2026 : un worktree resté sur un commit du 12/09 a renvoyé ses 145
# fichiers et remis en production d'anciennes versions de chat.php, de
# formulaires.php, de js/app.js et des articles, corrigés entre-temps par un
# autre chantier. L'envoi est INTÉGRAL : l'arbre doit contenir tout origin/main.
# Passer outre en connaissance de cause : DEPLOY_EN_RETARD=1.
def commits_de_retard():
    racine = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    try:
        subprocess.run(["git", "-C", racine, "fetch", "-q", "origin"], check=True, timeout=90)
        sortie = subprocess.run(["git", "-C", racine, "rev-list", "--count", "HEAD..origin/main"],
                                check=True, capture_output=True, text=True, timeout=30).stdout
        return int(sortie.strip())
    except Exception as e:  # pas de réseau, pas de dépôt : on prévient sans bloquer
        print("⚠️  Retard sur origin/main non vérifiable (%s) — envoi poursuivi." % e.__class__.__name__)
        return 0


retard = commits_de_retard()
if retard and os.environ.get("DEPLOY_EN_RETARD") != "1":
    print("⛔ Envoi refusé : cet arbre a %d commit(s) de retard sur origin/main." % retard)
    print("   L'envoi est intégral : il écraserait en production ce que ces commits ont mis en ligne.")
    print("   → git fetch origin && git rebase origin/main, relancer ./prepare-deploy.sh, puis renvoyer.")
    sys.exit(1)

ftp = FTP_TLS()
ftp.connect(HOST, 21, timeout=60)
ftp.login(USER, PW)
ftp.prot_p()            # canal de données chiffré
ftp.set_pasv(True)

_made = set()


def ensure(remote_dir):
    """Crée récursivement un dossier distant (ignore 550 = existe déjà)."""
    if not remote_dir or remote_dir in _made:
        return
    cur = ""
    for part in remote_dir.split("/"):
        cur = part if not cur else cur + "/" + part
        if cur in _made:
            continue
        try:
            ftp.mkd(cur)
        except error_perm as e:
            if not str(e).startswith("550"):
                raise
        _made.add(cur)


# Liste des fichiers à envoyer (exclusions appliquées).
files = []
for dp, dns, fns in os.walk(ROOT):
    dns[:] = [d for d in dns if d not in EXCL_DIRS]
    for fn in fns:
        if fn == ".DS_Store":
            continue
        files.append(os.path.join(dp, fn))
files.sort()

if BASE:
    ensure(BASE)

count = 0
total = 0
for lp in files:
    rel = os.path.relpath(lp, ROOT).replace(os.sep, "/")
    remote = (BASE + "/" + rel) if BASE else rel
    rdir = "/".join(remote.split("/")[:-1])
    ensure(rdir)
    try:
        envoie(ftp, lp, remote)
    except EnvoiEchoue as e:
        ftp.quit()
        sys.exit("\n❌ %s\n   Déploiement ARRÊTÉ après %d fichier(s) envoyé(s)." % (e, count))
    count += 1
    total += os.path.getsize(lp)
    print("  ↑ " + rel, flush=True)

ftp.quit()
dest = HOST + "/" + BASE + "/" if BASE else HOST + "/ (racine)"
print("\n✅ %d fichiers envoyés (%.1f Mo) vers %s" % (count, total / 1048576, dest))
