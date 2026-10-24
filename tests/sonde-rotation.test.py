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

# LIGNES ENTIÈRES (23/10/2026) : une ligne en cours d'écriture n'est ni relue ni comptée ; l'état
# s'arrête à la dernière fin de ligne et la ligne revient ENTIÈRE au passage suivant. Vécu sur
# nsy.fr : un état posé pendant qu'Apache écrivait a fait relire « hz_core:error] … » — NON VIERGE.
coupee = L % 7
open(journal, "w").write(L % 1 + L % 2)
f = appel({})
ref, ino = f["taille"], f["inode"]
t("référence sur un journal complet : la taille du fichier", ref == len((L % 1 + L % 2).encode()), f)
open(journal, "a").write(L % 3 + coupee[:44])
f = appel({"~/ik-logs/error.log": {"taille": ref, "inode": ino}})
t("ligne en cours d'écriture : seules les lignes ENTIÈRES sont relues", f.get("nouveau") == L % 3, f)
t("… l'état s'arrête à la dernière fin de ligne, la taille du fichier est rendue à part",
  f["taille"] == ref + len((L % 3).encode()) and f.get("taille_fichier") == f["taille"] + 44, f)
avant = f["taille"]
open(journal, "a").write(coupee[44:])
f = appel({"~/ik-logs/error.log": {"taille": avant, "inode": ino}})
t("au passage suivant, la ligne revient ENTIÈRE (jamais un fragment)", f.get("nouveau") == coupee and f["taille"] == f["taille_fichier"], f)
open(journal, "a").write("prv-concept.com [Thu")
g = appel({"~/ik-logs/error.log": {"taille": f["taille"], "inode": ino}})
t("delta sans aucune fin de ligne : rien de relu, état inchangé", "nouveau" not in g and g["taille"] == f["taille"], g)
h = appel({})
t("référence posée pendant l'écriture : sur la dernière fin de ligne",
  h["taille"] == f["taille"] and h.get("taille_fichier") == f["taille"] + len("prv-concept.com [Thu"), h)
# plafond de relecture plus court qu'un delta : coupé, lui aussi, sur une fin de ligne
open(os.path.join(racine, "web/s.php"), "w").write(sonde.PHP.replace("__CLE__", "k").replace("__PLAFOND__", str(len(L % 1) + 10)))
open(journal, "w").write(L % 1 + L % 2 + L % 3)
p = appel({"~/ik-logs/error.log": {"taille": 0, "inode": ino}})
t("plafond atteint au milieu d'une ligne : une ligne entière lue, l'état à sa fin",
  p.get("nouveau") == L % 1 and p["taille"] == len((L % 1).encode()) and p["taille_fichier"] == 3 * len((L % 1).encode()), p)

# COPIE PUIS VIDAGE (24/10/2026) : l'hébergeur copie le journal vers error.log-AAAAMMJJ et VIDE
# l'original, qui garde son inode. Le journal du jour, déjà plus long que l'ancien décalage, passait
# inaperçu ; la tête (première ligne) le trahit, et la copie est relue depuis l'ancien décalage.
def appel_tout(depuis):
    prep = os.path.join(racine, "web/prep.php")
    open(prep, "w").write("<?php $_SERVER['HTTP_X_SONDE']='k'; $_SERVER['HTTP_X_DEPUIS']=" + repr(json.dumps(depuis)) + ";")
    r = subprocess.run(["docker", "run", "--rm", "-e", "HOME=/r/home", "-v", racine + ":/r", "php:8.5-cli-alpine",
                        "php", "-d", "auto_prepend_file=/r/web/prep.php", "/r/web/s.php"], capture_output=True, text=True)
    if not r.stdout.strip():
        sys.exit("PHP muet : " + r.stderr[:500])
    return json.loads(r.stdout)["fichiers"]
open(os.path.join(racine, "web/s.php"), "w").write(sonde.PHP.replace("__CLE__", "k").replace("__PLAFOND__", "100000"))
for vieux in os.listdir(os.path.join(racine, "home/ik-logs")):
    os.remove(os.path.join(racine, "home/ik-logs", vieux))
JL = "~/ik-logs/error.log"; COPIE = "~/ik-logs/error.log-20261023"
open(journal, "w").write("".join(L % i for i in range(30, 33)))
ref = appel_tout({})[JL]
t("la tête (empreinte de la première ligne) est rendue", len(ref.get("tete", "")) == 32, ref)
open(journal, "a").write(L % 33)
lu = appel_tout({JL: ref})[JL]
t("même journal, même tête : la suite seulement", lu.get("nouveau") == L % 33 and not lu.get("rotation"), lu)
open(journal, "a").write(L % 34 + L % 35)                       # la soirée, jamais relue avant minuit
shutil.copy(journal, os.path.join(racine, "home/ik-logs/error.log-20261023"))
with open(journal, "r+") as fh:                                 # vidé sur place : MÊME inode
    fh.truncate(0)
open(journal, "a").write("".join(L % i for i in range(40, 50)))  # déjà plus long que l'ancien décalage
r = appel_tout({JL: {"taille": lu["taille"], "inode": lu["inode"], "tete": lu["tete"]}})
t("copie puis vidage : même inode, journal plus long que l'ancien décalage",
  r[JL]["inode"] == lu["inode"] and r[JL]["taille_fichier"] > lu["taille"], r[JL])
t("… la tête a changé : rotation vue, journal du jour relu depuis 0, lignes entières",
  r[JL].get("rotation") is True and r[JL].get("nouveau") == "".join(L % i for i in range(40, 50)), r[JL])
t("… la copie d'hier est la SUITE du journal suivi : relue depuis l'ancien décalage",
  r.get(COPIE, {}).get("suite_de") is True and r[COPIE].get("depuis") == lu["taille"]
  and r[COPIE].get("nouveau") == L % 34 + L % 35, r.get(COPIE))
r2 = appel_tout({JL: {"taille": r[JL]["taille"], "inode": r[JL]["inode"], "tete": r[JL]["tete"]},
                 COPIE: {"taille": r[COPIE]["taille"], "inode": r[COPIE]["inode"], "tete": r[COPIE]["tete"]}})
t("passage suivant : plus rien à relire, ni rotation ni suite",
  "nouveau" not in r2[JL] and "nouveau" not in r2[COPIE] and not r2[JL].get("rotation") and not r2[COPIE].get("suite_de"), r2)

shutil.rmtree(racine, ignore_errors=True)
print("✅ sonde côté serveur (rotation, lignes entières) : tout passe" if not ko else f"❌ {ko} échec(s)")
sys.exit(1 if ko else 0)
