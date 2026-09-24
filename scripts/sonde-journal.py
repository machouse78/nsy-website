#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lit le journal d'erreurs du serveur, par une sonde JETABLE (règle du 30/08/2026).

Pourquoi : aucune exécution serveur — collecteur KPI, cron de veille, rejeu,
batch, ou même une campagne de tests contre chat.php — ne se lance sans lire le
journal d'erreurs AVANT et APRÈS, et sans STOPPER à la première erreur. Le
week-end des 29-30/08/2026, nsy.fr et prv-concept.com sont restés hors ligne
tout le week-end : Infomaniak les avait bloqués pour « nombre trop important
d'erreurs ». Une réponse applicative `{"ok":true}` ne prouve rien.

Le FTP est chrooté sur la racine web : `~/ik-logs/` n'est pas accessible par FTP.
D'où cette sonde PHP à nom et clé aléatoires, envoyée, interrogée et SUPPRIMÉE
dans la même exécution — elle ne reste jamais sur le serveur. Elle porte le
garde-fou d'erreurs obligatoire, masque compris (un gestionnaire posé sans
masque journalise lui-même les dépréciations PHP 8.5 — vécu le 09/09/2026).

⚠️ Jamais de filtre par DATE : le journal est au format Apache, et une sonde qui
filtrait sur « 2026-09-03 » a rendu « journal vierge » toute une journée pendant
que le fichier grossissait. On note la TAILLE, et on relit ce qui dépasse.

    python3 scripts/sonde-journal.py                  # 1er appel : pose la référence
    python3 scripts/sonde-journal.py                  # appels suivants : le delta
    python3 scripts/sonde-journal.py --tolere-amont   # un refus 429/503/0 du
                                                    # fournisseur LLM, dans le
                                                    # journal du chatbot SEUL,
                                                    # est signalé sans arrêter
    python3 scripts/sonde-journal.py --tolere-scanners  # le bruit de scanners
                                                    # qu'Apache refuse, dans le
                                                    # journal de l'HÉBERGEMENT
                                                    # seul, est DÉCOMPTÉ par
                                                    # motif sans arrêter
    python3 scripts/sonde-journal.py --etat <fichier> # autre fichier d'état

--tolere-scanners (17/09/2026). Un serveur public reçoit chaque jour des
scanners qui demandent `/.git`, `/.env`, `/.well-known/`… Apache les refuse
AVANT tout script, et l'écrit au journal. Ces lignes rendaient « NON VIERGE »
avant chaque mise en ligne : on relisait à la main, et le STOP se banalisait.
L'option en tolère QUATRE motifs, validés par le owner, pas un de plus :
  - AH01276 [autoindex:error]  « Cannot serve directory … » (listage refusé) ;
  - AH01630 [authz_core:error] « client denied by server configuration » ;
  - AH10244 [core:error]       « invalid URI path » (traversée de répertoires) ;
  - ModSecurity [-:error]      « Access denied with code … » — le pare-feu de
    l'hébergeur refuse la requête avant nos scripts. Les autres messages de
    ModSecurity (Warning, corps de requête trop gros…) ne sont PAS tolérés ;
  - AH02032 [ssl:error]        « Hostname <nom>. provided via SNI … no compatible
    SSL setup » — et UNIQUEMENT quand le nom d'hôte finit par un POINT (la forme
    DNS absolue). Des robots gardent en mémoire « https://forum.prv-concept.com./
    robots.txt » : le certificat ne couvre pas ce nom-là sous la politique
    « secure », Apache répond 421 AVANT tout .htaccess et tout code à nous. Rien
    n'est réparable de notre côté — seule la configuration de vhost de
    l'hébergeur le pourrait. Relevé le 24/09/2026 : 5 lignes en huit jours, cinq
    adresses différentes, toujours le même nom. ⚠️ Un AH02032 sur un nom SANS
    point final reste GRAVE : ce serait un vrai défaut de certificat.
Elle affiche le décompte par motif et les cibles visées — à parcourir d'un
œil : une cible qui serait un fichier À NOUS n'est pas forcément un scanner.
Un refus ModSecurity visant un fichier que `deploy/` livre est tout de même
toléré (nos pages réelles sont aussi la cible des scanners), mais SIGNALÉ d'un
⚠️ jusque dans la ligne finale : c'est peut-être un visiteur légitime refusé.
Restent bloquants, avec ou sans l'option :
  - toute autre ligne — PHP Warning/Deprecated/Fatal en tête. Ce qui n'est pas
    reconnu ARRÊTE ;
  - [proxy_fcgi:error] AH01067 / AH01075 (coupure FastCGI) : même venue d'une
    IP interne de l'hébergeur, elle peut être le fait d'un de NOS scripts. Ne
    pas l'ajouter aux motifs sans l'accord du owner ;
  - un AH01276 sur un répertoire dont `deploy/` livre l'index : ce n'est pas
    un scanner, c'est notre index qui manque en ligne ;
  - ces mêmes motifs ailleurs que dans `~/ik-logs/error.log*` ;
  - un delta plus gros que le plafond de relecture : rien n'est toléré sur une
    lecture partielle, et l'état s'arrête à ce qui a été LU (l'appel suivant
    montre la suite).

Codes de sortie : 0 = journal vierge, ou rien d'autre que du toléré (ou
référence posée), 2 = NON vierge (STOP), 1 = la sonde elle-même a échoué.

Identifiants : `_secret/ftp.env` (FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR), à
défaut les mêmes variables dans l'environnement (comme `scripts/ftp-deploy.py`).
Depuis un WORKTREE git, `_secret/ftp.env` est gitignoré donc absent : l'outil
lit celui du dépôt principal, et y range aussi son état — une seule référence
pour tous les worktrees, sinon chaque worktree neuf « poserait la référence »
au lieu de montrer le delta.

Pendant de `tools/sonde-journal.py` du dépôt prv-concept : toute évolution des
motifs tolérés se reporte des deux côtés. Essais hors ligne :
`python3 tests/sonde-journal.test.py`.
"""
import builtins
import io
import json
import os
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from ftplib import FTP_TLS, all_errors

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def depot_principal() -> str:
    """Le dépôt principal quand l'outil tourne dans un worktree git, sinon RACINE.

    `_secret/ftp.env` est gitignoré : un worktree ne l'a pas. On remonte au
    dépôt principal par le répertoire git commun (`<principal>/.git`).
    """
    try:
        commun = subprocess.run(["git", "-C", RACINE, "rev-parse", "--git-common-dir"],
                                capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return RACINE
    commun = os.path.abspath(os.path.join(RACINE, commun)) if commun else ""
    principal = os.path.dirname(commun) if os.path.basename(commun) == ".git" else ""
    return principal if os.path.isfile(os.path.join(principal, "_secret", "ftp.env")) else RACINE


SECRETS = os.path.join(depot_principal(), "_secret")
ETAT = os.path.join(SECRETS, "sonde-journal-etat.json")
SITE = "https://www.nsy.fr/"
AMONT = r"upstream HTTP (0|429|503)\b"      # refus du fournisseur LLM, pas une erreur PHP
PLAFOND = 30000                              # octets relus au maximum par fichier
CIBLES_MAX = 12                              # cibles affichées par motif toléré

# Bruit de scanners (--tolere-scanners) : des requêtes qu'Apache refuse AVANT
# tout script. Le motif est ANCRÉ sur l'en-tête de la ligne (hôte, [date],
# [module], [pid], [client], code) : un texte glissé dans un message PHP ne s'y
# fait pas passer pour une ligne d'Apache. Le champ [date] est sauté tel quel —
# ce n'est PAS un filtre par date. proxy_fcgi (AH01067/AH01075) n'y figure pas,
# volontairement : voir la docstring.
# Troisième champ = ce que vaut une cible que `deploy/` livre : "index" → la
# ligne REDEVIENT grave (notre index manque en ligne) ; "fichier" → tolérée,
# mais signalée d'un ⚠️ ; None → rien à comparer.
_DEBUT = r"^\S+ \[[^\]]+\] \[%s\] \[pid [^\]]+\] \[client [^\]]+\] "
_ENTETE = _DEBUT + "%s: "
INDEX_DEFAUT = ("index.html", "index.php")
SCANNERS = (
    ("AH01276 autoindex (répertoire sans index, listage refusé)",
     re.compile(_ENTETE % ("autoindex:error", "AH01276")
                + r"Cannot serve directory (?P<cible>.+?): "
                  r"No matching DirectoryIndex \((?P<index>[^)]*)\)"), "index"),
    ("AH01630 authz_core (client denied by server configuration)",
     re.compile(_ENTETE % ("authz_core:error", "AH01630")
                + r"client denied by server configuration: "
                  r"(?P<cible>.+?)(?:, referer: .*)?$"), None),
    ("AH10244 core (invalid URI path, traversée de répertoires)",
     re.compile(_ENTETE % ("core:error", "AH10244")
                + r"invalid URI path \((?P<cible>.*)\)"), None),
    # Pas de code AH, et l'adresse du client est répétée. Seul « Access denied »
    # passe ; la cible est le DERNIER [uri "…"] (celui que pose ModSecurity en
    # fin de ligne, pas un texte glissé par le client dans la requête).
    ("ModSecurity (Access denied, pare-feu de l'hébergeur)",
     re.compile(_DEBUT % "-:error" + r"(?:\[client [^\]]+\] )?"
                r"ModSecurity: Access denied with code \d+ .*"
                r"\[uri \"(?P<cible>[^\"]*)\"\]"), "fichier"),
    # Le POINT FINAL est la condition, pas un détail : « \S+\. » n'accepte que la
    # forme DNS absolue. Sur un nom normal, le motif NE MORD PAS (essayé : il
    # faudrait que « provided via SNI » suive le dernier point, ce qui n'arrive
    # pas) — et la ligne redevient grave, comme doit l'être un vrai défaut de
    # certificat. La cible est un nom d'hôte, pas un chemin : rien à comparer
    # avec `deploy/`, d'où None.
    ("AH02032 ssl (nom d'hôte à POINT FINAL, refusé par la politique TLS)",
     re.compile(_ENTETE % ("ssl:error", "AH02032")
                + r"Hostname (?P<cible>\S+\.) provided via SNI and hostname \S+ "
                  r"provided via HTTP have no compatible SSL setup"), None),
)
RACINE_WEB = re.compile(r"^/home/clients/[^/]+/web(?=/|$)")

# Le garde-fou du skill `execution-scripts-serveur` : COPIÉ, jamais réécrit de
# mémoire (une sonde écrite à la main le 11/09/2026 avait oublié le filtre
# `error_reporting() & $no` et journalisait elle-même des dépréciations).
PHP = r'''<?php
$prvErreurs = 0;
set_error_handler(static function ($no, $msg, $fichier, $ligne) use (&$prvErreurs) {
    if (!(error_reporting() & $no)) {
        return true;
    }
    if (++$prvErreurs <= 5) {
        error_log("sonde-journal: [$no] $msg @ $fichier:$ligne");
    }
    if ($prvErreurs > 10) {
        http_response_code(500);
        die(json_encode(['ok' => false,
            'erreur' => "traitement STOPPÉ : $prvErreurs erreurs PHP — règle du 30/08/2026"]));
    }
    return true;
}, E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (!hash_equals('__CLE__', (string)($_SERVER['HTTP_X_SONDE'] ?? ''))) {
    http_response_code(404);
    exit;
}
$home = getenv('HOME') ?: dirname(__DIR__);
$depuis = json_decode((string)($_SERVER['HTTP_X_DEPUIS'] ?? '{}'), true) ?: [];
$cibles = glob($home . '/ik-logs/error.log*') ?: [];
$cibles[] = __DIR__ . '/_secret/chat-errors.log';
$out = ['ok' => true, 'php' => PHP_VERSION, 'fichiers' => []];
foreach ($cibles as $f) {
    if (!is_file($f)) {
        continue;
    }
    $cle = str_replace($home, '~', $f);
    $t = filesize($f);
    $e = ['taille' => $t];
    if (array_key_exists($cle, $depuis) && substr($f, -3) !== '.gz') {
        $d = (int)$depuis[$cle];
        if ($t < $d) {          // le journal a tourné (minuit) : on relit tout
            $e['rotation'] = true;
            $d = 0;
        }
        if ($t > $d) {
            $h = fopen($f, 'rb');
            fseek($h, $d);
            $e['nouveau'] = fread($h, min($t - $d, __PLAFOND__));
            fclose($h);
        }
    }
    $out['fichiers'][$cle] = $e;
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
'''


def env():
    """Identifiants FTP — _secret/ftp.env, à défaut l'environnement. Jamais affichés."""
    e = {k: v for k, v in os.environ.items() if k.startswith("FTP_")}
    fichier = os.path.join(SECRETS, "ftp.env")
    if os.path.isfile(fichier):
        with open(fichier, encoding="utf-8") as fh:
            for ligne in fh:
                ligne = ligne.strip()
                if ligne and not ligne.startswith("#") and "=" in ligne:
                    k, v = ligne.split("=", 1)
                    e[k.strip().removeprefix("export ").strip()] = v.strip().strip('"').strip("'")
    manque = [k for k in ("FTP_HOST", "FTP_USER", "FTP_PASS") if not e.get(k)]
    if manque:
        raise OSError(f"identifiants FTP absents ({', '.join(manque)}) : ni _secret/ftp.env ni environnement")
    return e


def interroge(depuis: dict) -> dict:
    """STOR de la sonde -> une requête -> DELE, quoi qu'il arrive."""
    cle = secrets.token_hex(24)
    nom = "sonde-" + secrets.token_hex(12) + ".php"
    e = env()
    base = e.get("FTP_DIR", "").strip("/")
    corps = PHP.replace("__CLE__", cle).replace("__PLAFOND__", str(PLAFOND))

    ftp = FTP_TLS()
    ftp.connect(e["FTP_HOST"], 21, timeout=60)
    ftp.login(e["FTP_USER"], e["FTP_PASS"])
    ftp.prot_p()
    if base:
        ftp.cwd("/" + base)
    ftp.storbinary("STOR " + nom, io.BytesIO(corps.encode()))
    try:
        time.sleep(1)
        req = urllib.request.Request(SITE + nom, headers={
            "X-Sonde": cle,
            "X-Depuis": json.dumps(depuis),
            "User-Agent": "nsy-sonde-journal",
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.loads(r.read().decode("utf-8"))
    finally:
        try:
            ftp.delete(nom)
            restant = [n for n in ftp.nlst() if n.startswith("sonde-")]
            if restant:
                print(f"⚠️  {len(restant)} sonde(s) OUBLIÉE(S) sur le serveur : {', '.join(restant)}")
        except all_errors as err:
            print(f"⚠️  SUPPRESSION IMPOSSIBLE de {nom} — à retirer à la main : {err}")
        finally:
            try:
                ftp.quit()
            except all_errors:
                pass
    return out


def chez_nous(cible: str, noms=("",)) -> str:
    """Le fichier `deploy/…` que NOUS livrons à cette adresse, sinon ''."""
    base = os.path.join(RACINE, "deploy")
    for nom in noms:
        p = os.path.normpath(os.path.join(base, cible.strip("/"), nom.strip()))
        if p.startswith(base + os.sep) and os.path.isfile(p):
            return os.path.relpath(p, RACINE)
    return ""


def scanner(ligne: str):
    """(motif, cible, grave, alerte) d'une ligne de scanner, sinon quatre None.

    `grave` : la ligne a la forme d'un scanner mais ne peut pas être tolérée
    (AH01276 sur un répertoire dont `deploy/` livre l'index : c'est NOTRE index
    qui manque en ligne). `alerte` : tolérée, mais à lire (ModSecurity a refusé
    une requête vers un fichier que nous livrons).
    """
    for motif, rx, compare in SCANNERS:
        m = rx.match(ligne)
        if not m:
            continue
        cible = RACINE_WEB.sub("", m.group("cible")) or "/"
        grave = alerte = None
        if compare == "index":
            livre = chez_nous(cible, (m.group("index") or "").split(","))
            if livre:
                grave = (f"⛔ {cible} : nous livrons {livre} — l'index manque "
                         "EN LIGNE, ce n'est pas un scanner")
        elif compare == "fichier":
            livre = chez_nous(cible) or chez_nous(cible, INDEX_DEFAUT)
            if livre:
                alerte = (f"⚠️  ModSecurity a refusé une requête vers {cible} ({livre}, un "
                          "fichier À NOUS) — scanner ou visiteur légitime ? À lire")
        return motif, cible, grave, alerte
    return None, None, None, None


def trie(f: str, lignes: list, tolere_amont: bool, tolere_scanners: bool):
    """Sépare ce qui ARRÊTE de ce qui est toléré. Ce qui n'est pas reconnu arrête.

    Chaque tolérance ne vaut que pour SON journal : le refus amont pour celui du
    chatbot, le bruit de scanners pour celui de l'hébergement.
    """
    graves, amont, bruit, notes, alertes = [], [], {}, [], []
    chatbot = f.endswith("chat-errors.log")
    hebergement = "/ik-logs/error.log" in f
    for l in lignes:
        if tolere_amont and chatbot and re.search(AMONT, l):
            amont.append(l)
            continue
        if tolere_scanners and hebergement:
            motif, cible, grave, alerte = scanner(l)
            if motif and not grave:
                bruit.setdefault(motif, Counter())[cible] += 1
                if alerte and alerte not in alertes:
                    alertes.append(alerte)
                continue
            if grave:
                notes.append(grave)
        graves.append(l)
    return graves, amont, bruit, notes, alertes


def main() -> int:

    def print(*a, **k):                     # noqa: A001 — filtre local au mode --bref
        """En mode --bref, seules les lignes de VERDICT sortent ; le code de sortie,
        lui, ne change pas. builtins.print, et non la globale : définir « print » ici
        en fait un nom LOCAL à toute la fonction."""
        if "--bref" not in sys.argv or (a and str(a[0]).startswith("[sonde]")):
            builtins.print(*a, **k)
    etat_f = sys.argv[sys.argv.index("--etat") + 1] if "--etat" in sys.argv else ETAT
    tolere_amont = "--tolere-amont" in sys.argv
    bref = "--bref" in sys.argv        # seul le verdict final s'affiche
    tolere_scanners = "--tolere-scanners" in sys.argv
    etat = {}
    if os.path.exists(etat_f):
        with open(etat_f, encoding="utf-8") as fh:
            etat = json.load(fh)

    try:
        out = interroge({k: v["taille"] for k, v in etat.items()})
    except (*all_errors, urllib.error.URLError, OSError, ValueError) as err:
        print(f"❌ sonde en échec : {err}")
        return 1

    print(f"[sonde] PHP {out.get('php')} — {SITE}")
    vierge = True
    toleres = Counter()                      # bruit de scanners, par motif, tous fichiers
    a_lire = 0                               # refus ModSecurity visant un fichier à nous
    for f, v in sorted(out["fichiers"].items()):
        if f not in etat:
            print(f"  {f} : {v['taille']} o (référence)")
            continue
        delta = v["taille"] - etat[f]["taille"]
        print(f"  {f} : {etat[f]['taille']} -> {v['taille']} o (delta {delta:+d})"
              f"{' ROTATION' if v.get('rotation') else ''}")
        if not v.get("nouveau"):
            continue
        lignes = [l for l in v["nouveau"].splitlines() if l.strip()]
        # Le journal de l'HÉBERGEMENT est celui dont le débordement fait bloquer
        # le site : il ne tolère que le bruit de scanners (--tolere-scanners),
        # refusé par Apache avant tout script. --tolere-amont ne vaut que pour
        # le journal du chatbot, et seulement pour un refus du fournisseur LLM.
        graves, amont, bruit, notes, alertes = trie(f, lignes, tolere_amont, tolere_scanners)
        a_lire += len(alertes)
        # Une lecture PARTIELLE ne tolère rien : la fin du delta n'a pas été vue.
        # L'état s'arrête à ce qui a été lu — l'appel suivant montrera la suite.
        depart = 0 if v.get("rotation") else etat[f]["taille"]
        tronque = v["taille"] - depart > PLAFOND
        if tronque:
            notes.append(f"⛔ delta de {v['taille'] - depart} o, plafond de relecture {PLAFOND} o : "
                         f"{v['taille'] - depart - PLAFOND} o NON RELUS — relancer la sonde pour la suite")
            v["taille"] = depart + PLAFOND
        vierge = vierge and not graves and not tronque
        if graves:
            print("  ----- NOUVEAU -----")
            print("\n".join(graves))
            print("  -------------------")
        if amont:
            print("  ----- NOUVEAU (refus amont du fournisseur, toléré) -----")
            print("\n".join(amont))
            print("  -------------------")
        for motif, cibles in bruit.items():
            toleres[motif] += sum(cibles.values())
            print(f"  toléré, bruit de scanners — {motif} : {sum(cibles.values())} ligne(s)")
            for cible, n in cibles.most_common(CIBLES_MAX):
                print(f"      {n:>4} × {cible}")
            if len(cibles) > CIBLES_MAX:
                print(f"           … et {len(cibles) - CIBLES_MAX} autre(s) cible(s)")
        for note in notes + alertes:
            print("  " + note)

    os.makedirs(os.path.dirname(etat_f), exist_ok=True)
    with open(etat_f, "w", encoding="utf-8") as fh:
        json.dump(out["fichiers"], fh)
    if not etat:
        print("[sonde] référence posée — relance la sonde après l'exécution à surveiller")
        return 0
    if not vierge:
        print("[sonde] ⛔ JOURNAL NON VIERGE — STOPPER le traitement")
        return 2
    if toleres:
        # Jamais « VIERGE » quand des lignes ont été tolérées : le rapport au
        # owner doit pouvoir reprendre cette ligne telle quelle, et être vrai.
        detail = ", ".join(f"{m.split()[0]} × {n}" for m, n in toleres.items())
        print(f"[sonde] AUCUNE ERREUR À NOUS — bruit de scanners toléré : {detail}"
              + (f" — ⚠️ {a_lire} cible(s) À NOUS refusée(s) par ModSecurity, à lire" if a_lire else ""))
    else:
        print("[sonde] JOURNAL VIERGE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
