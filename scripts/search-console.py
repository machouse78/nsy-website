#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Interroge Google Search Console avec le compte de service du projet.

Pourquoi cet outil : la GSC n'inspecte qu'une URL à la fois dans son interface.
Quand la question est « combien de sujets du forum ont une canonique choisie par
Google différente de celle qu'ils déclarent ? », il faut en interroger cent, pas
une. C'est ce que fait `inspecte`.

Aucune dépendance à installer : le jeton OAuth est fabriqué ici même (JWT signé
RS256 avec `cryptography`, échangé contre un access_token). `google-auth` et
`googleapiclient` ne sont PAS requis.

Identifiants : _secret/gsc-service-account.json (git-ignoré, jamais déployé).
Le compte de service doit être ajouté comme UTILISATEUR de la propriété dans
Search Console → Paramètres → Utilisateurs et autorisations (Lecture seule).
Sans cette étape, l'API répond 403 alors que la clé est parfaitement valide.

    python3 scripts/search-console.py sites
    python3 scripts/search-console.py inspecte <url> [<url>…]
    python3 scripts/search-console.py inspecte --fichier urls.txt [--pause 0.4]
    python3 scripts/search-console.py sitemaps

Options communes : --cles <chemin.json>, --site <siteUrl>, --json
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from urllib.parse import quote

try:
    import requests
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
except ImportError as e:                                    # pragma: no cover
    sys.exit(f"Module manquant : {e.name}. `pip3 install requests cryptography`")

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLES_DEFAUT = os.path.join(RACINE, "_secret", "gsc-service-account.json")
# Lecture seule par défaut (moindre privilège : l'usage quotidien ne fait que
# lire). Les actions d'écriture — re-soumettre un sitemap après un incident,
# comme au déblocage du 30/08/2026 — passent par GSC_ECRITURE=1.
PORTEE = ("https://www.googleapis.com/auth/webmasters"
          if __import__("os").environ.get("GSC_ECRITURE") == "1"
          else "https://www.googleapis.com/auth/webmasters.readonly")
JETON_URL = "https://oauth2.googleapis.com/token"
API_WM = "https://www.googleapis.com/webmasters/v3"
API_SC = "https://searchconsole.googleapis.com/v1"


# ───── Authentification ──────────────────────────────────────────────────────

def _b64(donnees: bytes) -> str:
    """base64url sans padding, comme l'exige JWT."""
    return base64.urlsafe_b64encode(donnees).rstrip(b"=").decode("ascii")


def jeton_acces(chemin_cles: str) -> str:
    """Échange la clé de service contre un access_token OAuth (1 heure)."""
    if not os.path.isfile(chemin_cles):
        sys.exit(
            f"Clé introuvable : {chemin_cles}\n"
            "Dépose le JSON du compte de service dans _secret/ "
            "(il est git-ignoré, vérifie avec `git check-ignore -v`)."
        )
    with open(chemin_cles, encoding="utf-8") as f:
        cle = json.load(f)
    for champ in ("client_email", "private_key", "token_uri"):
        if champ not in cle:
            sys.exit(f"Le JSON ne ressemble pas à une clé de compte de service ({champ} absent).")

    maintenant = int(time.time())
    entete = {"alg": "RS256", "typ": "JWT"}
    charge = {
        "iss": cle["client_email"],
        "scope": PORTEE,
        "aud": cle.get("token_uri", JETON_URL),
        "iat": maintenant,
        "exp": maintenant + 3600,
    }
    a_signer = f"{_b64(json.dumps(entete).encode())}.{_b64(json.dumps(charge).encode())}".encode()
    prive = serialization.load_pem_private_key(cle["private_key"].encode(), password=None)
    signature = prive.sign(a_signer, padding.PKCS1v15(), hashes.SHA256())
    assertion = f"{a_signer.decode()}.{_b64(signature)}"

    r = requests.post(
        cle.get("token_uri", JETON_URL),
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
        timeout=30,
    )
    if r.status_code != 200:
        sys.exit(f"Échec de l'obtention du jeton ({r.status_code}) : {r.text[:400]}")
    return r.json()["access_token"]


def _appel(methode: str, url: str, jeton: str, corps=None) -> dict:
    r = requests.request(
        methode, url,
        headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json"},
        data=json.dumps(corps) if corps is not None else None,
        timeout=60,
    )
    if r.status_code == 403:
        # Deux causes très différentes se présentent sous le même code, et les
        # confondre coûte une demi-heure. On lit le message avant de conclure.
        detail = r.text
        if "has not been used in project" in detail or "is disabled" in detail:
            sys.exit(
                "403 — l'API n'est pas ACTIVÉE sur le projet Google Cloud (rien à voir avec les\n"
                "droits Search Console). Ouvre le lien que Google donne ci-dessous, clique\n"
                "« Activer », et attends une minute que ça se propage.\n\n" + detail[:600]
            )
        sys.exit(
            "403 — l'API est activée et la clé est valide, mais le compte de service n'a pas\n"
            "accès à cette propriété. Ajoute son adresse dans Search Console → Paramètres →\n"
            "Utilisateurs et autorisations (Lecture seule), puis réessaie.\n\n" + detail[:400]
        )
    if r.status_code not in (200, 204):
        sys.exit(f"HTTP {r.status_code} sur {url}\n{r.text[:500]}")
    # Les écritures (PUT sitemaps.submit) répondent 204 sans corps : ne pas
    # tenter de parser du vide.
    return r.json() if r.text.strip() else {}


# ───── Propriétés ────────────────────────────────────────────────────────────

def liste_sites(jeton: str) -> list[dict]:
    return _appel("GET", f"{API_WM}/sites", jeton).get("siteEntry", [])


def site_pour(url: str, sites: list[dict]) -> str | None:
    """La propriété qui couvre cette URL, la plus spécifique d'abord.

    Deux formes existent et ne se comportent pas pareil : un préfixe d'URL
    (`https://www.exemple.fr/`) ne couvre QUE ce préfixe — les URLs en http lui
    échappent —, là où une propriété de domaine (`sc-domain:exemple.fr`) couvre
    les deux protocoles et tous les sous-domaines.
    """
    prefixes = sorted(
        (s["siteUrl"] for s in sites if not s["siteUrl"].startswith("sc-domain:")),
        key=len, reverse=True,
    )
    for p in prefixes:
        if url.startswith(p):
            return p
    hote = url.split("//", 1)[-1].split("/", 1)[0].lower()
    for s in sites:
        su = s["siteUrl"]
        if su.startswith("sc-domain:"):
            domaine = su[len("sc-domain:"):].lower()
            if hote == domaine or hote.endswith("." + domaine):
                return su
    return None


# ───── Inspection d'URL ──────────────────────────────────────────────────────

def inspecte(jeton: str, url: str, site: str) -> dict:
    return _appel("POST", f"{API_SC}/urlInspection/index:inspect", jeton,
                  {"inspectionUrl": url, "siteUrl": site, "languageCode": "fr"})


def resume(url: str, reponse: dict) -> dict:
    """Ne garde que ce qu'on vient chercher, à plat."""
    r = reponse.get("inspectionResult", {})
    i = r.get("indexStatusResult", {})
    declaree, choisie = i.get("userCanonical"), i.get("googleCanonical")
    return {
        "url": url,
        "verdict": i.get("verdict"),
        "etat": i.get("coverageState"),
        "canonique_declaree": declaree,
        "canonique_google": choisie,
        # Le cas qui nous intéresse : Google a retenu une autre URL que celle
        # que la page déclare. Vu sur le forum le 28/08/2026, avec en prime une
        # canonique choisie en http et pointant sur un TOUT AUTRE sujet.
        "desaccord": bool(declaree and choisie and declaree != choisie),
        "google_en_http": bool(choisie and choisie.startswith("http://")),
        "dernier_crawl": i.get("lastCrawlTime"),
        "crawle_comme": i.get("crawledAs"),
        "robots": i.get("robotsTxtState"),
        "indexation": i.get("indexingState"),
        "sitemaps": i.get("sitemap") or [],
        "pages_referentes": i.get("referringUrls") or [],
    }


# ───── Sorties ───────────────────────────────────────────────────────────────

def affiche(r: dict) -> None:
    marque = "⚠️ " if r["desaccord"] else "   "
    print(f"{marque}{r['url']}")
    print(f"      verdict {r['verdict'] or '—'} · {r['etat'] or '—'}")
    if r["canonique_declaree"] or r["canonique_google"]:
        print(f"      déclarée : {r['canonique_declaree'] or '—'}")
        print(f"      Google   : {r['canonique_google'] or '—'}"
              + ("   ← en http !" if r["google_en_http"] else ""))
    print(f"      sitemap : {', '.join(r['sitemaps']) if r['sitemaps'] else 'aucun référent'}"
          f" · dernier crawl : {r['dernier_crawl'] or '—'}")


def bilan(resultats: list[dict]) -> None:
    n = len(resultats)
    d = sum(1 for r in resultats if r["desaccord"])
    h = sum(1 for r in resultats if r["google_en_http"])
    s = sum(1 for r in resultats if not r["sitemaps"])
    ok = sum(1 for r in resultats if r["verdict"] == "PASS")
    print(f"\n── {n} URL(s) inspectée(s) ──")
    print(f"   indexées (PASS)                          : {ok}")
    print(f"   canonique Google ≠ canonique déclarée    : {d}")
    print(f"   canonique Google en http                 : {h}")
    print(f"   sans sitemap référent                    : {s}")


# ───── Entrée ────────────────────────────────────────────────────────────────

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("commande", choices=["sites", "inspecte", "sitemaps", "soumets"])
    p.add_argument("urls", nargs="*", help="URLs à inspecter")
    p.add_argument("--fichier", help="fichier d'URLs, une par ligne (# = commentaire)")
    p.add_argument("--cles", default=CLES_DEFAUT)
    p.add_argument("--site", help="siteUrl à forcer (sinon déduit de l'URL)")
    p.add_argument("--pause", type=float, default=0.35, help="secondes entre deux appels")
    p.add_argument("--limite", type=int, default=0, help="s'arrêter après N URLs")
    p.add_argument("--json", action="store_true", help="sortie JSON brute")
    a = p.parse_args()

    jeton = jeton_acces(a.cles)

    if a.commande == "sites":
        sites = liste_sites(jeton)
        if a.json:
            print(json.dumps(sites, ensure_ascii=False, indent=1)); return
        if not sites:
            sys.exit("Aucune propriété visible : le compte de service n'a été ajouté à aucune "
                     "propriété dans Search Console.")
        print(f"{len(sites)} propriété(s) accessible(s) :")
        for s in sites:
            forme = "domaine" if s["siteUrl"].startswith("sc-domain:") else "préfixe d'URL"
            print(f"   · {s['siteUrl']:52} {forme:14} ({s.get('permissionLevel', '?')})")
        return

    sites = liste_sites(jeton)

    if a.commande == "sitemaps":
        cible = a.site or (sites[0]["siteUrl"] if sites else None)
        if not cible:
            sys.exit("Aucune propriété accessible.")
        d = _appel("GET", f"{API_WM}/sites/{quote(cible, safe='')}/sitemaps", jeton)
        if a.json:
            print(json.dumps(d, ensure_ascii=False, indent=1)); return
        for s in d.get("sitemap", []):
            n = sum(int(c.get("submitted", 0)) for c in s.get("contents", []))
            print(f"   · {s['path']}\n      soumises {n} · erreurs {s.get('errors', 0)} "
                  f"· avertissements {s.get('warnings', 0)} · dernier téléchargement "
                  f"{s.get('lastDownloaded', '—')}")
        return

    if a.commande == "soumets":
        # (Re)soumettre un sitemap : Google le relit dans les heures qui suivent au
        # lieu d'attendre son propre cycle. Cas d'usage vécu (02/09/2026) : le
        # sitemap du forum corrigé le 29/08 (URL canoniques) alors que Google
        # l'avait téléchargé le 28/08 — sans re-soumission, il gardait l'ancien.
        # C'est une ÉCRITURE : elle exige GSC_ECRITURE=1 (portée webmasters).
        if PORTEE.endswith("webmasters.readonly"):
            sys.exit("Re-soumettre un sitemap est une écriture : relancer avec GSC_ECRITURE=1 "
                     "(la portée par défaut est la lecture seule, à dessein).")
        if not a.urls:
            sys.exit("Indiquer l'URL complète du sitemap à soumettre.")
        for feed in a.urls:
            cible = a.site or site_pour(feed, sites)
            if not cible:
                sys.exit(f"Aucune propriété accessible ne couvre {feed} — préciser --site.")
            base = f"{API_WM}/sites/{quote(cible, safe='')}/sitemaps/{quote(feed, safe='')}"
            avant = _appel("GET", base, jeton)
            _appel("PUT", base, jeton)          # 204 sans corps = accepté
            apres = _appel("GET", base, jeton)
            print(f"   · {feed}\n      propriété {cible}\n"
                  f"      dernier téléchargement avant : {avant.get('lastDownloaded', '—')}\n"
                  f"      soumission enregistrée      : {apres.get('lastSubmitted', '—')}\n"
                  f"      (le téléchargement suit dans les heures ; relancer `sitemaps` pour le voir)")
        return

    urls = list(a.urls)
    if a.fichier:
        with open(a.fichier, encoding="utf-8") as f:
            urls += [l.strip() for l in f if l.strip() and not l.startswith("#")]
    if not urls:
        sys.exit("Aucune URL. Passe-les en arguments ou via --fichier.")
    if a.limite:
        urls = urls[:a.limite]

    resultats = []
    for n, u in enumerate(urls, 1):
        cible = a.site or site_pour(u, sites)
        if not cible:
            print(f"   ⚠️ {u} — aucune propriété ne couvre cette URL "
                  f"(propriétés : {', '.join(s['siteUrl'] for s in sites) or 'aucune'})")
            continue
        r = resume(u, inspecte(jeton, u, cible))
        resultats.append(r)
        if not a.json:
            affiche(r)
        if n < len(urls):
            time.sleep(a.pause)

    if a.json:
        print(json.dumps(resultats, ensure_ascii=False, indent=1))
    elif len(resultats) > 1:
        bilan(resultats)


if __name__ == "__main__":
    main()
