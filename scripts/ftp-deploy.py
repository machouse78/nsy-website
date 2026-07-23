#!/usr/bin/env python3
"""Envoi de deploy/ vers le FTP Infomaniak en UNE SEULE connexion FTPS.

Un curl par fichier ouvrait 63 connexions rapides -> l'anti-flood du serveur
renvoie 450. Ici : une connexion FTP_TLS persistante, STOR séquentiel, avec
retry sur erreur transitoire. N'efface JAMAIS rien côté serveur.

Identifiants via l'environnement : FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR.
Exclusions : _secret/, old-wp/, _old/, boutique/, forum/, .DS_Store.
"""
import os
import sys
import time
from ftplib import FTP_TLS, error_perm, all_errors

HOST = os.environ["FTP_HOST"]
USER = os.environ["FTP_USER"]
PW = os.environ["FTP_PASS"]
BASE = os.environ.get("FTP_DIR", "").strip("/")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "deploy"))
EXCL_DIRS = {"_secret", "old-wp", "_old", "boutique", "forum"}

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


def stor(local, remote, tries=3):
    for i in range(tries):
        try:
            with open(local, "rb") as fh:
                ftp.storbinary("STOR " + remote, fh)
            return
        except all_errors:
            if i == tries - 1:
                raise
            time.sleep(1.5)


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
    stor(lp, remote)
    count += 1
    total += os.path.getsize(lp)
    print("  ↑ " + rel, flush=True)

ftp.quit()
dest = HOST + "/" + BASE + "/" if BASE else HOST + "/ (racine)"
print("\n✅ %d fichiers envoyés (%.1f Mo) vers %s" % (count, total / 1048576, dest))
