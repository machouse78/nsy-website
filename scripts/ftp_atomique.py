#!/usr/bin/env python3
"""Envoi FTP ATOMIQUE d'un fichier : nom temporaire, contrôle de taille, renommage.

Pourquoi : `STOR cible` VIDE le fichier en ligne puis l'écrit au fil du
transfert. Une requête arrivée entre les deux charge un PHP à moitié écrit —
vécu sur prv-concept.com le 19/09/2026 à 21:36:36 (« Class
prv\\traduction\\event\\listener not found », erreur fatale au journal, page
d'erreur pour le visiteur). nsy.fr sert chat.php, formulaires.php,
contact.php… : même risque à chaque `./deploy.sh`.

Ici, le fichier en ligne n'est touché qu'au RENOMMAGE (RNFR/RNTO = rename() côté
serveur, atomique) : le visiteur voit l'ancien fichier ou le nouveau, jamais un
morceau.
  1. STOR <cible>.nsy-envoi-<hex>  — nom frère, aléatoire, jamais exécuté (il
                                     ne finit pas par .php) ;
  2. SIZE du temporaire == taille locale, sinon DELE du temporaire et ÉCHEC :
     la cible n'a pas été touchée ;
  3. RNFR/RNTO temporaire → cible ;
  4. SIZE de la cible == taille locale.

Seul DELE possible : notre propre temporaire, après un échec. Un fichier en ligne
n'est jamais supprimé. Le renommage donne à la cible les droits d'un fichier neuf
(un STOR sur place gardait ceux de l'ancien) — sans effet ici : aucun fichier
envoyé n'a de droits particuliers, _secret/ ne part pas avec le site (le journal
des envois de la newsletter, dans _secret/, n'est lu que par FTP).

  envoie(ftp, local, remote)          un fichier du disque ;
  envoie_octets(ftp, donnees, remote) des octets en mémoire (un JSON réécrit) —
                                      même mécanique, rien n'est écrit sur le disque.

Pendant de scripts/ftp_atomique.py du dépôt prv-concept (commits 5725033d et
447483ae, suffixe .prv-envoi-) : toute évolution se reporte des deux côtés.
Utilisé par scripts/ftp-deploy.py et scripts/newsletter-envoi.py, sur LEUR
connexion unique (aucune connexion ouverte ici).
Test hors réseau : python3 -B tests/ftp-atomique.test.py
"""
import io
import os
import re
import secrets
import time
from ftplib import all_errors, error_perm

SUFFIXE = ".nsy-envoi-"
_RE_TEMPORAIRE = re.compile(re.escape(SUFFIXE) + r"[0-9a-f]{16}\Z")


class EnvoiEchoue(Exception):
    """Taille fausse : envoi arrêté net (voir le message pour l'état de la cible)."""


def _efface_temporaire(ftp, tmp):
    """DELE de NOTRE temporaire après un échec ; ne masque jamais l'erreur d'origine."""
    try:
        ftp.delete(tmp)
        return
    except all_errors:
        pass
    try:
        ftp.size(tmp)
    except error_perm:
        return          # 550 : jamais créé (STOR refusé d'emblée) — rien à retirer
    except all_errors:
        pass
    print(f"  ⚠️  temporaire peut-être resté sur le serveur, à retirer : {tmp}", flush=True)


def est_temporaire(nom):
    """Nom d'un temporaire de ce module (`<cible>.nsy-envoi-<16 hex>`) : jamais un
    contenu du site — un envoi interrompu (coupure, Ctrl-C) peut en laisser un."""
    return _RE_TEMPORAIRE.search(nom) is not None


def envoie(ftp, local, remote, essais=3, pause=1.5, blocksize=8192):
    """Envoie le fichier `local` sur `remote` par nom temporaire + renommage. Renvoie la taille.

    Une erreur FTP transitoire (450 anti-flood, coupure du canal de données…)
    relance tout l'envoi sous un nouveau temporaire ; une TAILLE fausse arrête
    net (EnvoiEchoue) — on ne renomme jamais un fichier incomplet sur la cible.
    """
    return _envoie(ftp, lambda: open(local, "rb"), remote, essais, pause, blocksize)


def envoie_octets(ftp, donnees, remote, essais=3, pause=1.5):
    """Comme envoie(), pour des octets EN MÉMOIRE (rien sur le disque). Renvoie la taille."""
    if not isinstance(donnees, bytes):
        raise TypeError("envoie_octets attend des bytes, pas %s" % type(donnees).__name__)
    return _envoie(ftp, lambda: io.BytesIO(donnees), remote, essais, pause, 8192)


def _envoie(ftp, ouvre, remote, essais, pause, blocksize):
    """`ouvre()` rend un flux NEUF, relu depuis le début à chaque essai."""
    for i in range(essais):
        tmp = remote + SUFFIXE + secrets.token_hex(8)
        try:
            with ouvre() as fh:
                attendu = fh.seek(0, os.SEEK_END)     # taille du flux, fichier ou mémoire
                fh.seek(0)
                ftp.storbinary("STOR " + tmp, fh, blocksize=blocksize)  # pose TYPE I : SIZE en octets
            recu = ftp.size(tmp)
            if recu == attendu:
                ftp.rename(tmp, remote)               # RNFR + RNTO : la bascule atomique
        except all_errors:
            _efface_temporaire(ftp, tmp)
            if i == essais - 1:
                raise
            time.sleep(pause)
            continue
        if recu != attendu:
            _efface_temporaire(ftp, tmp)
            raise EnvoiEchoue(f"{remote} : {recu} octets reçus sur {attendu} — "
                              "temporaire supprimé, cible NON touchée")
        final = ftp.size(remote)
        if final != attendu:
            raise EnvoiEchoue(f"{remote} : {final} octets en ligne après renommage, "
                              f"{attendu} attendus — à vérifier")
        return attendu
