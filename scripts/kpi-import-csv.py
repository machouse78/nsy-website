#!/usr/bin/env python3
"""kpi-import-csv.py — importe l'historique AWStats (exports CSV Infomaniak)
dans _secret/kpi-history.json du serveur, pour les jours ANTÉRIEURS à la
rétention des logs (~1 mois). Ne touche jamais un jour déjà collecté depuis
les logs (source « logs » = plus fiable, bots exclus).

  python3 scripts/kpi-import-csv.py <export-mai.csv> [export-juin.csv ...]

Format attendu (export « journalier » des stats Infomaniak) :
  "Date","Jour","Visiteurs uniques","Visites","Pages","Hits","Fichiers","Données"
  "20260504",4,245,232,661,987,545,158285626
⚠️ Ces chiffres incluent les robots — les jours importés portent
source="awstats-brut" et le dashboard les distingue.
"""
import csv, io, json, sys
from ftplib import FTP_TLS

ROOT = __import__('pathlib').Path(__file__).resolve().parent.parent

def ftp():
    env = {}
    for line in open(ROOT / '_secret/ftp.env', encoding='utf-8'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1); env[k.strip()] = v.strip().strip('"')
    f = FTP_TLS(env['FTP_HOST'], timeout=30)
    f.login(env['FTP_USER'], env['FTP_PASS']); f.prot_p()
    return f

def main():
    files = sys.argv[1:]
    if not files:
        sys.exit(__doc__)
    conn = ftp()
    buf = io.BytesIO()
    conn.retrbinary('RETR /_secret/kpi-history.json', buf.write)
    hist = json.loads(buf.getvalue() or b'{"site":"nsy.fr","days":{}}')
    added = skipped = 0
    for path in files:
        for row in csv.DictReader(open(path, encoding='utf-8-sig')):
            raw = (row.get('Date') or '').strip()
            if len(raw) != 8 or not raw.isdigit():
                continue
            day = f"{raw[:4]}-{raw[4:6]}-{raw[6:]}"
            existing = hist['days'].get(day, {})
            if existing.get('source') == 'logs' or 'ai_hits' in existing:
                skipped += 1
                continue
            hist['days'][day] = {
                'visiteurs': int(row.get('Visiteurs uniques') or 0),
                'pages_vues': int(row.get('Pages') or 0),
                'hits': int(row.get('Hits') or 0),
                'source': 'awstats-brut',
            }
            added += 1
    hist['days'] = dict(sorted(hist['days'].items()))
    conn.storbinary('STOR /_secret/kpi-history.json', io.BytesIO(
        json.dumps(hist, ensure_ascii=False).encode('utf-8')))
    conn.quit()
    print(f"✓ {added} jours importés (awstats-brut), {skipped} ignorés (déjà collectés depuis les logs)")
    print(f"  historique total : {len(hist['days'])} jours")

if __name__ == '__main__':
    main()
