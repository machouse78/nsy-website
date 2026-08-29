#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rejoue des journées déjà collectées, pour leur appliquer le collecteur actuel.

Pourquoi : le collecteur ne savait situer un visiteur qu'au niveau du PAYS. Il
sait maintenant le situer à la ville. Les journées passées gardent leur ancienne
mesure tant qu'on ne les repasse pas — d'où ce rattrapage, qui relit l'archive
brute conservée dans `_secret/log-archive/<date>.log.gz` et réécrit l'entrée.

Ce que le rejeu NE casse PAS (garde-fous déjà dans le collecteur, vérifiés) :
  · une date sans aucune ligne de log n'écrase rien (`conserve: true`) ;
  · Search Console, YouTube, forum et boutique sont reportés depuis l'existant
    quand la source est muette — un rattrapage ne creuse pas de trou.

L'URL de collecte porte une clé : elle est lue dans `_secret/`, jamais affichée.

    python3 rejoue-jours.py <racine du site> <première date> <dernière date> [pause s]
"""
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

# ⚠️ 120 s par défaut — leçon du 29/08/2026 : des rejeux enchaînés toutes les
# ~50 s ont fait déborder le journal d'erreurs du serveur (une dépréciation PHP
# émise par ligne lue, corrigée depuis) et Infomaniak a bloqué LES DEUX sites.
# Même la cause corrigée, on n'enchaîne plus jamais des collectes sans souffler.
PAUSE = 120        # respiration entre deux journées (surchargez : 4e argument)
TIMEOUT = 420      # une journée dense prend ~50 s ; large de côté


def url_cron(racine):
    t = io.open(os.path.join(racine, "_secret", "kpi-cron-url.txt"), encoding="utf-8").read()
    u = re.findall(r"https://\S+", t)
    if not u:
        sys.exit("aucune URL dans _secret/kpi-cron-url.txt")
    return u[0]


def jours(a, b):
    d0 = date.fromisoformat(a)
    d1 = date.fromisoformat(b)
    out = []
    while d0 <= d1:
        out.append(d0.isoformat())
        d0 += timedelta(days=1)
    return out


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    racine, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
    pause = int(sys.argv[4]) if len(sys.argv) > 4 else PAUSE
    base = url_cron(racine)
    site = os.path.basename(racine.rstrip("/"))
    liste = jours(a, b)
    print(f"{site} — {len(liste)} journée(s) à rejouer, du {a} au {b}", flush=True)

    ok = conserve = echec = 0
    t0 = time.time()
    for i, j in enumerate(liste, 1):
        t1 = time.time()
        try:
            with urllib.request.urlopen(base + "&date=" + j, timeout=TIMEOUT) as r:
                d = json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, OSError, ValueError) as e:
            echec += 1
            print(f"  {i:2}/{len(liste)} {j}  ✗ {type(e).__name__}: {e}", flush=True)
            continue
        dt = time.time() - t1
        if d.get("conserve"):
            conserve += 1
            print(f"  {i:2}/{len(liste)} {j}  — conservée ({d.get('motif', '')[:60]}) {dt:.0f}s", flush=True)
        elif d.get("ok"):
            ok += 1
            print(f"  {i:2}/{len(liste)} {j}  ✓ {d.get('visiteurs')} visiteurs, "
                  f"{d.get('pages_vues')} pages  {dt:.0f}s", flush=True)
        else:
            echec += 1
            print(f"  {i:2}/{len(liste)} {j}  ✗ {str(d)[:120]}", flush=True)
        time.sleep(pause)

    print(f"── {site} : {ok} rejouée(s), {conserve} conservée(s), {echec} en échec "
          f"— {(time.time() - t0) / 60:.0f} min", flush=True)
    return 1 if echec else 0


if __name__ == "__main__":
    sys.exit(main())
