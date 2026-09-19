#!/usr/bin/env python3
"""Tests du script d'envoi de la newsletter (scripts/newsletter-envoi.py — code RÉEL).

Uniquement le DRY-RUN, avec une liste d'abonnés FACTICE (--abonnes-fichier), et les
fonctions pures (lecture d'article, message, en-têtes, lecture de config.php, liste).
--go et --test ne sont JAMAIS exécutés ici. Pendant le dry-run en processus, toute
ouverture de socket fait échouer le test : aucun appel réseau possible. L'écriture du
journal des envois (ftp_ecrire_json) passe par un FAUX serveur FTP en mémoire : elle doit
être atomique (scripts/ftp_atomique.py), jamais un STOR sur place.
Lancer via tests/run-tests.sh (python3 3.9+ du poste).
"""
import contextlib
import importlib.util
import io
import json
import os
import socket
import subprocess
import sys
import tempfile

RACINE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SCRIPT = os.path.join(RACINE, "scripts", "newsletter-envoi.py")
SLUG = "reunir-site-forum-boutique-compte-unique"
echecs = 0


def t(nom, ok, info=""):
    global echecs
    print(("  ✓ " if ok else "  ✗ ÉCHEC ") + nom + ("" if ok or not info else " — " + str(info)))
    if not ok:
        echecs += 1


sys.dont_write_bytecode = True           # pas de scripts/__pycache__ laissé dans le dépôt
spec = importlib.util.spec_from_file_location("newsletter_envoi", SCRIPT)
nl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nl)

TMP = tempfile.mkdtemp(prefix="nsy-newsletter-envoi-test-")
J = ["%032x" % i for i in range(1, 8)]
ABONNES = {"format": 1, "abonnes": [
    {"email": "alice.essai@exemple.invalid", "langue": "fr", "etat": "confirme", "jeton": J[0], "inscrit": "2026-09-01T10:00:00+02:00", "confirme": "2026-09-01T10:05:00+02:00", "desinscrit": None},
    {"email": "bruno.essai@exemple.invalid", "langue": "fr", "etat": "confirme", "jeton": J[1], "inscrit": "2026-09-02T10:00:00+02:00", "confirme": "2026-09-02T10:05:00+02:00", "desinscrit": None},
    {"email": "carol.essai@exemple.invalid", "langue": "en", "etat": "confirme", "jeton": J[2], "inscrit": "2026-09-03T10:00:00+02:00", "confirme": "2026-09-03T10:05:00+02:00", "desinscrit": None},
    {"email": "denis.essai@exemple.invalid", "langue": "fr", "etat": "attente", "jeton": J[3], "inscrit": "2026-09-17T10:00:00+02:00", "confirme": None, "desinscrit": None},
    {"email": "emma.essai@exemple.invalid", "langue": "en", "etat": "desinscrit", "jeton": J[4], "inscrit": "2026-08-01T10:00:00+02:00", "confirme": "2026-08-01T10:05:00+02:00", "desinscrit": "2026-09-10T10:00:00+02:00"},
    {"email": "fanny.essai@exemple.invalid", "langue": "fr", "etat": "confirme", "jeton": "pas-un-jeton", "inscrit": "", "confirme": "", "desinscrit": None},
    {"email": "alice.essai@exemple.invalid", "langue": "fr", "etat": "confirme", "jeton": J[6], "inscrit": "", "confirme": "", "desinscrit": None},
]}
FICHIER = os.path.join(TMP, "abonnes.json")
with open(FICHIER, "w", encoding="utf-8") as fh:
    json.dump(ABONNES, fh)

# ── Dry-run, en sous-processus (comme le owner le lance) ──
env = dict(os.environ, TMPDIR=TMP)
r = subprocess.run([sys.executable, SCRIPT, SLUG, "--abonnes-fichier", FICHIER], capture_output=True, text=True, env=env, timeout=60)
sortie = r.stdout + r.stderr
t("dry-run : code 0", r.returncode == 0, sortie)
t("dry-run : 3 confirmés comptés, fr 2 · en 1", "Abonnés confirmés : 3 (fr : 2 · en : 1)" in sortie, sortie)
t("dry-run : attente, désinscrit et fiches douteuses exclus et comptés",
  "1 en attente de confirmation, 1 désinscrit(s), 2 fiche(s) ignorée(s)" in sortie, sortie)
t("dry-run : AUCUNE adresse affichée", "@" not in sortie, sortie)
t("dry-run : aucun jeton affiché", not any(j in sortie for j in J), sortie)
t("dry-run : annonce clairement que rien n'est parti", "DRY-RUN — aucun e-mail envoyé" in sortie)
t("dry-run : les deux articles identifiés (FR + pendant EN par hreflang)",
  "reunir-site-forum-boutique-compte-unique.html" in sortie and "one-site-forum-shop-single-account.html" in sortie, sortie)
chemins = {lg: next((l.split(": ", 1)[1].strip() for l in sortie.splitlines() if l.strip().startswith(lg.upper() + " : ")), "")
           for lg in ("fr", "en")}
t("dry-run : deux aperçus écrits dans le dossier temporaire", all(p.startswith(TMP) and os.path.isfile(p) for p in chemins.values()), chemins)
fr = open(chemins["fr"], encoding="utf-8").read() if os.path.isfile(chemins["fr"]) else ""
en = open(chemins["en"], encoding="utf-8").read() if os.path.isfile(chemins["en"]) else ""
t("aperçu FR : titre, chapô, bouton « Lire l'article »", "Un site, un forum, une boutique, un seul compte" in fr
  and "Pendant des années, PRV Concept" in fr and "Lire l&#x27;article" in fr)
t("aperçu FR : lien tracé utm_source=newsletter, utm_medium=email, utm_campaign=<slug-FR>",
  "reunir-site-forum-boutique-compte-unique.html?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=" + SLUG in fr)
t("aperçu FR : image og:image et logo du site", "public/compte-unique-article.jpg" in fr and "public/nsy-logo.png" in fr)
t("aperçu FR : lien de désinscription FACTICE (aucun jeton d'abonné sur le disque)",
  "action=desinscrire&amp;t=JETON-PERSONNEL-DE-L-ABONNE" in fr and not any(j in fr + en for j in J))
t("aperçu EN : article anglais, même campagne (slug FR)", "One site, one forum, one shop" in en and "Read the article" in en
  and "one-site-forum-shop-single-account.html?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=" + SLUG in en, en[:300])
t("aperçus : aucune adresse d'abonné", "exemple.invalid" not in fr + en)

r = subprocess.run([sys.executable, SCRIPT, SLUG + ".html", "--abonnes-fichier", FICHIER], capture_output=True, text=True, env=env, timeout=60)
t("slug avec « .html » accepté", r.returncode == 0, r.stderr)
r = subprocess.run([sys.executable, SCRIPT, "article-qui-nexiste-pas", "--abonnes-fichier", FICHIER], capture_output=True, text=True, env=env, timeout=60)
t("article inconnu → arrêt clair, code 2", r.returncode == 2 and "article introuvable" in r.stderr, r.stderr)
r = subprocess.run([sys.executable, SCRIPT, "../_secret/config", "--abonnes-fichier", FICHIER], capture_output=True, text=True, env=env, timeout=60)
t("slug hors motif → refusé", r.returncode == 2 and "slug invalide" in r.stderr, r.stderr)

# ── Dry-run en processus, réseau INTERDIT ──
class _Interdit(socket.socket):
    def __init__(self, *a, **k):
        raise AssertionError("appel réseau pendant le dry-run")


socket_orig, create_orig = socket.socket, socket.create_connection
socket.socket = _Interdit
socket.create_connection = lambda *a, **k: (_ for _ in ()).throw(AssertionError("appel réseau pendant le dry-run"))
os.environ["TMPDIR"] = TMP
tempfile.tempdir = TMP
tampon = io.StringIO()
try:
    with contextlib.redirect_stdout(tampon):
        code = nl.main([SLUG, "--abonnes-fichier", FICHIER])
    reseau = None
except AssertionError as e:
    code, reseau = None, str(e)
finally:
    socket.socket, socket.create_connection = socket_orig, create_orig
t("dry-run sans aucune ouverture de socket", reseau is None and code == 0, reseau or tampon.getvalue())

# ── Fonctions pures ──
paire = nl.lire_paire(RACINE, SLUG)
m = nl.construire_message("fr", paire["fr"], SLUG, J[0], "alice.essai@exemple.invalid", "noreply@exemple.invalid", "contact@exemple.invalid")
t("message : List-Unsubscribe = lien personnel de désinscription",
  m["List-Unsubscribe"] == "<https://www.nsy.fr/newsletter.php?action=desinscrire&t=%s>" % J[0], m["List-Unsubscribe"])
t("message : List-Unsubscribe-Post (un clic, RFC 8058)", m["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click")
t("message : expéditeur nommé, destinataire, réponse, sujet", "NSY" in str(m["From"]) and m["To"] == "alice.essai@exemple.invalid"
  and m["Reply-To"] == "contact@exemple.invalid" and str(m["Subject"]).startswith("Nouvel article : Un site, un forum"))
t("message : multipart/alternative, texte + HTML", m.get_content_type() == "multipart/alternative"
  and [p.get_content_type() for p in m.iter_parts()] == ["text/plain", "text/html"])
texte = m.get_body(preferencelist=("plain",)).get_content()
t("message texte : lien tracé et lien de désinscription", "utm_campaign=" + SLUG in texte and "t=" + J[0] in texte)
m_en = nl.construire_message("en", paire["en"], SLUG, J[2], "carol.essai@exemple.invalid", "noreply@exemple.invalid")
t("message EN : sujet anglais, sans Reply-To si absent", str(m_en["Subject"]).startswith("New article: One site") and m_en["Reply-To"] is None)

listes, autres = nl.abonnes_par_langue(ABONNES)
t("liste : seuls les confirmés, dédoublonnés, jeton valide", listes == {"fr": [("alice.essai@exemple.invalid", J[0]), ("bruno.essai@exemple.invalid", J[1])],
                                                                        "en": [("carol.essai@exemple.invalid", J[2])]}, listes)
try:
    nl.abonnes_par_langue({"pas": "le bon format"})
    t("liste au format inattendu → arrêt", False)
except nl.Arret:
    t("liste au format inattendu → arrêt", True)

t("journal : slug déjà envoyé détecté", nl.deja_envoye({SLUG: {"date": "2026-09-18", "envoyes": 3}}, SLUG) == {"date": "2026-09-18", "envoyes": 3})
t("journal : autre slug → rien", nl.deja_envoye({"autre": {"date": "x"}}, SLUG) is None and nl.deja_envoye({}, SLUG) is None)

t("masquage des adresses dans les erreurs", nl.masquer("550 <alice.essai@exemple.invalid>: refusé") == "550 <[adresse]>: refusé")

CFG = os.path.join(TMP, "config.php")
with open(CFG, "w", encoding="utf-8") as fh:
    fh.write("<?php\n/**\n * 'smtp_host' => 'commentaire',\n */\nreturn [\n"
             "    'smtp_host'     => 'mail.exemple.invalid',\n"
             "    'smtp_port'     => 465,\n"
             "    'smtp_secure'   => 'ssl',           // 'ssl' for 465, 'tls' for 587\n"
             "    // 'smtp_port' => 587,\n"
             "    'smtp_username' => 'noreply@exemple.invalid',\n"
             "    'smtp_password' => 'mot\\'de//passe#1',\n"
             "    \"to_address\"    => \"contact@exemple.invalid\",\n"
             "];\n")
cfg = nl.lire_config_php(CFG)
t("config.php lu sans PHP : chaînes, entier, échappement, commentaires ignorés",
  cfg == {"smtp_host": "mail.exemple.invalid", "smtp_port": 465, "smtp_secure": "ssl", "smtp_username": "noreply@exemple.invalid",
          "smtp_password": "mot'de//passe#1", "to_address": "contact@exemple.invalid"}, cfg)
try:
    nl.lire_config_php(os.path.join(RACINE, "_secret", "config.php.example"))
    t("config.php.example du dépôt : lu, puis refusé (mot de passe CHANGE_ME)", False)
except nl.Arret as e:
    t("config.php.example du dépôt : lu, puis refusé (mot de passe CHANGE_ME)", "CHANGE_ME" in str(e), e)
with open(CFG, "w", encoding="utf-8") as fh:
    fh.write("<?php return ['smtp_host' => 'a', 'smtp_port' => 465, 'smtp_username' => 'b', 'smtp_password' => 'CHANGE_ME_X'];")
try:
    nl.lire_config_php(CFG)
    t("config.php encore en CHANGE_ME → refus", False)
except nl.Arret:
    t("config.php encore en CHANGE_ME → refus", True)
with open(CFG, "w", encoding="utf-8") as fh:
    fh.write("<?php return ['smtp_host' => 'a', 'smtp_host' => 'b', 'smtp_port' => 465, 'smtp_username' => 'c', 'smtp_password' => 'd'];")
try:
    nl.lire_config_php(CFG)
    t("config.php avec clé en double → refus", False)
except nl.Arret:
    t("config.php avec clé en double → refus", True)

for args, attendu in ((["x", "--go", "--abonnes-fichier", FICHIER], "--abonnes-fichier"),
                      (["x", "--test", "a@b.fr", "--go"], "s'excluent"),
                      (["x", "--force"], "--force")):
    try:
        nl.arguments(args)
        t("arguments incohérents refusés (%s)" % attendu, False)
    except nl.Arret as e:
        t("arguments incohérents refusés AVANT toute action (%s)" % attendu, attendu in str(e), e)

# ── Configuration SMTP : repli sur celle du SERVEUR quand la locale porte CHANGE_ME ──
REP = tempfile.mkdtemp(prefix="nl-repli-")
with open(os.path.join(REP, "config.php"), "w", encoding="utf-8") as fh:
    fh.write("<?php return ['smtp_host' => 'mail.exemple.invalid', 'smtp_port' => 465, 'smtp_username' => 'a@exemple.invalid', 'smtp_password' => 'CHANGE_ME'];\n")
with open(os.path.join(REP, "ftp.env"), "w", encoding="utf-8") as fh:
    fh.write('FTP_HOST="ftp.exemple.invalid"\nFTP_USER="u"\nFTP_PASS="p"\nFTP_DIR=""\n')
class FtpFactice:
    lu = None
    def retrbinary(self, cmd, rappel):
        FtpFactice.lu = cmd
        rappel(b"<?php return ['smtp_host' => 'mail.exemple.invalid', 'smtp_port' => 465, 'smtp_username' => 'a@exemple.invalid', 'smtp_password' => 'secret-du-serveur'];\n")
    def quit(self):
        pass
avant = sorted(os.listdir(REP))
nl.SECRETS, ouvrir = REP, nl.ftp_ouvrir
nl.ftp_ouvrir = lambda env: FtpFactice()
with contextlib.redirect_stdout(io.StringIO()) as sortie_repli:
    cfg = nl.config_smtp()
nl.ftp_ouvrir = ouvrir
t("config locale CHANGE_ME → celle du serveur, lue par FTPS", cfg.get("smtp_password") == "secret-du-serveur" and FtpFactice.lu == "RETR _secret/config.php", FtpFactice.lu)
t("… rien écrit sur le disque, le mot de passe jamais affiché", sorted(os.listdir(REP)) == avant and "secret-du-serveur" not in sortie_repli.getvalue())
subprocess.run(["rm", "-rf", REP])

# ── Journal des envois : écriture ATOMIQUE, jamais un STOR sur place (19/09/2026) ──
# Un STOR sur place VIDE d'abord le fichier : une coupure à ce moment laisse un journal vide,
# ftp_lire_json le lit comme {} et un second --go du même slug n'est plus refusé.
import ftp_atomique  # noqa: E402  (chemin posé par newsletter-envoi.py : scripts/)
from ftplib import error_perm  # noqa: E402


class FtpMemoire:
    """Faux serveur FTP : STOR vide d'abord la cible, `lecteur` passe PENDANT le transfert."""

    def __init__(self, fichiers, tronque=False, lecteur=None):
        self.fichiers, self.tronque, self.lecteur, self.commandes = dict(fichiers), tronque, lecteur, []

    def storbinary(self, cmd, fh, blocksize=8192):
        nom = cmd[len("STOR "):]
        self.commandes.append(cmd)
        self.fichiers[nom] = b""
        if self.lecteur:
            self.lecteur(self)
        donnees = fh.read()
        self.fichiers[nom] = donnees[:-1] if self.tronque else donnees

    def retrbinary(self, cmd, rappel):
        nom = cmd[len("RETR "):]
        if nom not in self.fichiers:
            raise error_perm("550 no such file")
        rappel(self.fichiers[nom])

    def size(self, nom):
        if nom not in self.fichiers:
            raise error_perm("550 no such file")
        return len(self.fichiers[nom])

    def rename(self, de, vers):
        self.commandes.append("RNFR %s RNTO %s" % (de, vers))
        self.fichiers[vers] = self.fichiers.pop(de)

    def delete(self, nom):
        self.commandes.append("DELE " + nom)
        del self.fichiers[nom]


JOURNAL = "_secret/newsletter-envois.json"
PASSE = {"article-precedent": {"date": "2026-09-01T10:00:00+02:00", "envoyes": 12}}
PASSE_OCTETS = json.dumps(PASSE, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
t("le piège : un journal VIDE se relit comme {} — d'où l'écriture atomique",
  nl.ftp_lire_json(FtpMemoire({JOURNAL: b""}), JOURNAL, {}) == {})
vus = []
f = FtpMemoire({JOURNAL: PASSE_OCTETS}, lecteur=lambda s: vus.append(nl.ftp_lire_json(s, JOURNAL, {})))
journal = nl.ftp_lire_json(f, JOURNAL, {})
journal[SLUG] = {"date": "2026-09-19T22:30:00+02:00", "envoyes": 3}
nl.ftp_ecrire_json(f, JOURNAL, journal)
t("journal des envois : relu tel qu'écrit (envoi passé gardé, nouveau slug ajouté)",
  nl.ftp_lire_json(f, JOURNAL, {}) == dict(PASSE, **{SLUG: journal[SLUG]}), f.fichiers.get(JOURNAL))
t("journal des envois : un --go lancé PENDANT l'écriture lit l'ancien journal, entier (pas {})",
  vus == [PASSE], vus)
tmp = f.commandes[0][len("STOR "):]
t("journal des envois : STOR sur un temporaire frère dans _secret/, puis renommage — jamais sur place",
  tmp.startswith(JOURNAL + ".nsy-envoi-") and "STOR " + JOURNAL not in f.commandes
  and f.commandes[-1] == "RNFR %s RNTO %s" % (tmp, JOURNAL), f.commandes)
t("journal des envois : aucun temporaire laissé", sorted(f.fichiers) == [JOURNAL], sorted(f.fichiers))

f = FtpMemoire({JOURNAL: PASSE_OCTETS}, tronque=True)
try:
    nl.ftp_ecrire_json(f, JOURNAL, dict(PASSE, **{SLUG: {"envoyes": 3}}))
    t("journal des envois : taille fausse → erreur", False, "aucune erreur")
except ftp_atomique.EnvoiEchoue:
    t("journal des envois : taille fausse → erreur (main() la signale : « NON mis à jour »)", True)
t("journal des envois : taille fausse → l'ancien journal reste INTACT, temporaire supprimé",
  f.fichiers == {JOURNAL: PASSE_OCTETS}, f.fichiers)
t("newsletter-envoi.py : plus aucun STOR direct, l'envoi atomique est celui de scripts/ (pas une copie)",
  "storbinary" not in open(SCRIPT, encoding="utf-8").read() and nl.envoie_octets is ftp_atomique.envoie_octets)

subprocess.run(["rm", "-rf", TMP])
print("NEWSLETTER-ENVOI : TOUS LES TESTS PASSENT" if echecs == 0 else "NEWSLETTER-ENVOI : %d ÉCHEC(S)" % echecs)
sys.exit(0 if echecs == 0 else 1)
