#!/usr/bin/env python3
"""Adresse du siège : la COMMUNE partout, la rue SEULEMENT aux mentions légales (owner, 18/11/2026).

Doctrine : depuis la présence sur YouTube, on ne doit pas remonter trop facilement à l'adresse personnelle.
Pied de page, données structurées (JSON-LD), page de confidentialité, llms.txt et llms-full.txt (lus par les
assistants IA et par Ansley) ne portent que « Épieds-en-Beauce ». La rue reste sur mentions-legales.html et
legal-notice.html, où la loi (LCEN) impose le siège social d'une société.

Échoue si la rue réapparaît ailleurs dans un fichier suivi (hors deploy/, qui est généré), ou si elle
disparaît des mentions légales.
    python3 -B tests/adresse-commune.test.py
"""
import os, subprocess, sys

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
RUE = "Hameau de Poiseaux"
AUTORISES = {"mentions-legales.html", "legal-notice.html"}
ICI = os.path.relpath(os.path.abspath(__file__), RACINE)

fichiers = subprocess.check_output(["git", "ls-files"], cwd=RACINE, text=True).split("\n")
fuites, legales = [], set()
for f in fichiers:
    if not f or f.startswith("deploy/") or f == ICI:
        continue
    try:
        texte = open(os.path.join(RACINE, f), encoding="utf-8").read()
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        continue
    if RUE in texte:
        (legales.add(f) if f in AUTORISES else fuites.append(f))

# SIREN et lien vers le registre (qui affiche l'adresse) retirés des fichiers lus par les IA (owner 18/11/2026)
SIREN = ("842 078 453", "842078453", "annuaire-entreprises.data.gouv.fr")
llms = [f for f in ("llms.txt", "llms-full.txt") if any(x in open(os.path.join(RACINE, f), encoding="utf-8").read() for x in SIREN)]

ok = True
if llms:
    ok = False
    print("✗ SIREN ou lien du registre dans :", ", ".join(llms))
if fuites:
    ok = False
    print("✗ la rue du siège apparaît hors des mentions légales :", ", ".join(sorted(fuites)))
if legales != AUTORISES:
    ok = False
    print("✗ siège social absent de :", ", ".join(sorted(AUTORISES - legales)), "(obligation LCEN)")
if not ok:
    sys.exit(1)
print("  ✓ adresse : commune seule partout, rue uniquement aux mentions légales (FR + EN) ; ni SIREN ni registre dans llms")
