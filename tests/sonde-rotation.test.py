#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Banc de la sonde CÔTÉ SERVEUR — détection de la rotation de minuit (22/10/2026).

Le PHP jetable de la sonde tourne pour de vrai, en conteneur PHP 8.5, sur un faux ~/ik-logs/.
Vécu : la rotation n'était vue que si le nouveau journal était PLUS PETIT que l'ancien décalage ;
le journal du jour l'avait déjà dépassé, la lecture repartait au milieu d'une ligne (« NON
VIERGE » sur un fragment) et sautait le début de la journée. Désormais l'inode tranche aussi.

    python3 -B tests/sonde-rotation-test.py            (Docker requis)
"""
import importlib.util, json, os, shutil, subprocess, sys, tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
for rel in ("../tools/sonde-journal.py", "../scripts/sonde-journal.py"):
    chemin = os.path.join(ICI, rel)
    if os.path.exists(chemin):
        break
spec = importlib.util.spec_from_file_location("sonde", chemin)
sonde = importlib.util.module_from_spec(spec); spec.loader.exec_module(sonde)

ko = 0
def t(nom, ok, info=None):
    global ko
    print(("  ✓ " if ok else "  ✗ ÉCHEC ") + nom + ("" if ok or info is None else " — " + json.dumps(info, ensure_ascii=False)[:300]))
    ko += 0 if ok else 1

racine = tempfile.mkdtemp(prefix=".sonde-rot-", dir=ICI)   # dans le dépôt : Docker ne voit pas /var/folders
os.makedirs(os.path.join(racine, "home/ik-logs")); os.makedirs(os.path.join(racine, "web"))
open(os.path.join(racine, "web/s.php"), "w").write(sonde.PHP.replace("__CLE__", "k").replace("__PLAFOND__", "100000"))
journal = os.path.join(racine, "home/ik-logs/error.log")

def appel(depuis):
    prep = os.path.join(racine, "web/prep.php")
    open(prep, "w").write("<?php $_SERVER['HTTP_X_SONDE']='k'; $_SERVER['HTTP_X_DEPUIS']=" + repr(json.dumps(depuis)) + ";")
    r = subprocess.run(["docker", "run", "--rm", "-e", "HOME=/r/home", "-v", racine + ":/r", "php:8.5-cli-alpine",
                        "php", "-d", "auto_prepend_file=/r/web/prep.php", "/r/web/s.php"], capture_output=True, text=True)
    if not r.stdout.strip():
        sys.exit("PHP muet : " + r.stderr[:500])
    return json.loads(r.stdout)["fichiers"]["~/ik-logs/error.log"]

L = "prv-concept.com [Thu Oct 22 00:00:%02d.000000 2026] [authz_core:error] AH01630: client denied: /web/.env\n"
open(journal, "w").write("".join(L % i for i in range(3)))
f = appel({})
t("premier appel : taille et inode rendus, rien relu", f["taille"] > 0 and f["inode"] > 0 and "nouveau" not in f, f)
ino, taille = f["inode"], f["taille"]

open(journal, "a").write(L % 3)
f = appel({"~/ik-logs/error.log": taille})
t("ANCIEN format (taille seule) : la suite seulement", f.get("nouveau") == L % 3 and not f.get("rotation"), f)
f = appel({"~/ik-logs/error.log": {"taille": taille, "inode": ino}})
t("nouveau format, même fichier : la suite seulement", f.get("nouveau") == L % 3 and not f.get("rotation"), f)

# rotation : l'ancien fichier renommé, un NOUVEAU fichier déjà plus long que l'ancien décalage
os.rename(journal, journal + "-20261021")
open(journal, "w").write("".join(L % i for i in range(10, 20)))
f = appel({"~/ik-logs/error.log": {"taille": taille, "inode": ino}})
t("rotation, nouveau journal PLUS GRAND : vue par l'inode, relu depuis 0, lignes entières",
  f.get("rotation") is True and f.get("nouveau", "").startswith("prv-concept.com [") and f["nouveau"].count("\n") == 10, f)
f = appel({"~/ik-logs/error.log": {"taille": 10 ** 6, "inode": f["inode"]}})
t("rotation, nouveau journal PLUS PETIT : vue par la taille, comme avant", f.get("rotation") is True, f)

shutil.rmtree(racine, ignore_errors=True)
print("✅ sonde, rotation côté serveur : tout passe" if not ko else f"❌ {ko} échec(s)")
sys.exit(1 if ko else 0)
