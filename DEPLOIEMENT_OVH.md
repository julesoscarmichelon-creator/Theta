# Déployer Theta sur un VPS OVH — guide débutant

Ce guide suppose que tu n'as **jamais** utilisé de serveur. Chaque commande
est à copier-coller telle quelle (en remplaçant les valeurs entre `< >`).

Le site (`public/index.html` + `public/demo/`) est 100% statique : pas de
base de données, pas de backend à faire tourner. On installe juste un petit
logiciel (**Caddy**) qui sert ces fichiers en HTTPS.

---

## Étape 1 — Commander le VPS

1. Va sur https://www.ovhcloud.com/fr/vps/ → **Commander**.
2. Modèle **le moins cher suffit** (1-2 Go de RAM) puisqu'on ne sert que des
   fichiers statiques — pas besoin de sur-dimensionner pour l'instant.
3. **OS : Debian 12**, **Datacenter : France**, facturation mensuelle pour
   commencer (tu pourras annuler à tout moment).
4. Valide la commande. OVH t'envoie par e-mail :
   - une **IP** (ex : `51.83.12.34`)
   - un **nom d'utilisateur** (`debian` ou `ubuntu` selon l'image)
   - un **mot de passe** SSH

Note bien ces trois informations, tu en as besoin pour la suite.

---

## Étape 2 — Se connecter au serveur

Depuis ton PC, ouvre un terminal (PowerShell sur Windows, Terminal sur
Mac/Linux) :

```bash
ssh debian@<IP_DU_VPS>
```

Tape `yes` quand on te demande de faire confiance à l'empreinte, puis entre
le mot de passe reçu par e-mail. Tu es maintenant connecté au serveur.

> **Sécuriser l'accès dès le départ (recommandé, 2 minutes) :** un VPS n'a
> souvent qu'un seul moyen d'y accéder. Avant de faire quoi que ce soit
> d'autre, génère une clé SSH sur ton PC et ajoute-la au serveur — ça évite
> de tout perdre si tu oublies le mot de passe :
> ```bash
> # Sur ton PC, dans un AUTRE terminal
> ssh-keygen -t ed25519 -f ~/.ssh/theta_ovh -C "theta" -N ""
> ssh-copy-id -i ~/.ssh/theta_ovh.pub debian@<IP_DU_VPS>
> ```
> Ensuite connecte-toi toujours avec `ssh -i ~/.ssh/theta_ovh debian@<IP_DU_VPS>`.
> **Ne ferme jamais ta session SSH en cours tant que tu n'as pas vérifié que
> la nouvelle clé fonctionne depuis un second terminal** — sinon, en cas
> d'erreur, tu perds l'accès pour de bon (il ne resterait que la console de
> secours dans l'espace client OVH).

---

## Étape 3 — Installer Caddy

Toujours dans le serveur (session SSH) :

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

Ouvre les ports nécessaires :

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
```

Vérifie aussi dans l'**espace client OVH** (Bare Metal Cloud → ton VPS →
Firewall réseau) que les ports 80 et 443 ne sont pas bloqués côté OVH.

---

## Étape 4 — Envoyer le site sur le serveur

Depuis ton PC (pas dans le serveur), à la racine de ce projet :

```bash
scp -r public debian@<IP_DU_VPS>:~/theta-public
ssh debian@<IP_DU_VPS> "mv ~/theta-public ~/theta/public 2>/dev/null || (mkdir -p ~/theta && mv ~/theta-public ~/theta/public)"
```

(Si tu as configuré une clé SSH à l'étape 2, ajoute `-i ~/.ssh/theta_ovh`
après `scp -r` et `ssh`.)

---

## Étape 5 — Configurer Caddy

Dans le serveur :

```bash
sudo nano /etc/caddy/Caddyfile
```

Colle le contenu de `deploy/Caddyfile.example` (fourni dans ce projet), en
remplaçant `VOTRE-IP-EN-TIRETS.nip.io` par ton IP avec les points remplacés
par des tirets. Exemple pour l'IP `51.83.12.34` :

```
51-83-12-34.nip.io {
    root * /home/debian/theta/public
    encode gzip
    file_server
}
```

Enregistre (**Ctrl+O**, Entrée) puis quitte (**Ctrl+X**). Recharge Caddy :

```bash
sudo systemctl reload caddy
```

Caddy obtient automatiquement un certificat HTTPS (Let's Encrypt) en
quelques secondes — aucun nom de domaine à acheter, `nip.io` fait le lien
entre l'IP et un nom de domaine utilisable.

---

## Étape 6 — Vérifier

Ouvre dans ton navigateur : `https://51-83-12-34.nip.io` (avec ta propre IP).

- Le site vitrine doit s'afficher.
- `https://51-83-12-34.nip.io/demo/` doit afficher la démo interactive.

Si tu obtiens une erreur de certificat, attends 30 secondes (le temps que
Let's Encrypt délivre le certificat) et recharge.

---

## Mettre à jour le site plus tard

Une fois que tu modifies `public/index.html` ou `public/demo/index.html`,
pas besoin de refaire toutes les étapes. Depuis ce projet, sur ton PC :

```bash
./deploy/update.sh <IP_DU_VPS> debian
```

Ce script envoie les nouveaux fichiers et recharge Caddy automatiquement.

---

## Acheter un vrai nom de domaine (optionnel, plus tard)

`nip.io` suffit largement pour une démo commerciale. Le jour où tu veux une
adresse du type `theta-automatisation.fr` :

1. Achète le nom de domaine chez OVH (ou un autre registrar).
2. Pointe un enregistrement DNS de type `A` vers l'IP de ton VPS.
3. Remplace `VOTRE-IP-EN-TIRETS.nip.io` par `theta-automatisation.fr` dans le
   Caddyfile, puis `sudo systemctl reload caddy`. Caddy renouvelle le
   certificat HTTPS tout seul, y compris pour un vrai domaine.

---

## Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Permission denied (publickey)` en SSH | Mauvaise clé ou utilisateur | Vérifie le nom d'utilisateur reçu par e-mail OVH (`debian` ou `ubuntu`) |
| Site inaccessible en HTTPS | Certificat en cours d'émission, ou port bloqué | Attends 1 min, vérifie `ufw status` et le firewall réseau OVH |
| Page blanche / 404 | Chemin `root` du Caddyfile incorrect | Vérifie que `~/theta/public/index.html` existe bien sur le serveur (`ls ~/theta/public`) |
| `deploy/update.sh` échoue | `rsync` absent sur ta machine | Installe-le (`sudo apt install rsync` sur Linux, ou via Homebrew sur Mac) |
