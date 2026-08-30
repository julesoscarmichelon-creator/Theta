# Microservice de contact — Michelon & Co

Petite API qui reçoit les formulaires de contact du site et envoie leur
contenu sur votre boîte mail. Elle remplace Formspree : aucun tiers ne
stocke plus les messages, aucune redirection externe, aucune limite de
soumissions imposée de l'extérieur.

- **Zéro dépendance obligatoire** pour la version serverless (Resend est
  appelé en HTTPS). Express et Nodemailer ne servent qu'au serveur autonome
  et au mode SMTP.
- **Deux façons de déployer** au choix : fonction serverless (Vercel) ou
  serveur Node classique (Render, Railway, VPS).

## L'API

| Route | Méthode | Réponse |
| --- | --- | --- |
| `/api/contact` | `POST` | `{ "success": true }` |
| `/api/contact` | `OPTIONS` | préflight CORS (204) |
| `/api/health` | `GET` | état du service, configuration manquante et avertissements |
| `/api/admin/login` | `POST` | `{ password }` → pose le cookie de session |
| `/api/admin/logout` | `POST` | efface le cookie |
| `/api/admin/session` | `GET` | indique si la session en cours est valide |
| `/api/admin/submissions` | `GET` | liste des demandes, la plus récente d'abord (session requise) |

### Requête attendue

```json
{
  "nom": "Jean Dupont",
  "email": "jean@exemple.fr",
  "entreprise": "ACME",
  "telephone": "06 12 34 56 78",
  "sujet": "Demande de devis",
  "message": "Bonjour, je souhaite automatiser mes relances.",
  "_gotcha": "",
  "_t": 1735689600000
}
```

Seuls `nom`, `email` et `message` sont obligatoires. `_gotcha` est le champ
piège (doit rester vide) et `_t` l'horodatage d'ouverture du formulaire.
Les équivalents anglais (`name`, `company`, `phone`, `subject`) sont acceptés.

### Réponses

| Code | Corps | Signification |
| --- | --- | --- |
| 200 | `{ "success": true }` | message envoyé (ou spam ignoré silencieusement) |
| 400 | `{ "success": false, "error": "…", "fields": { "email": "…" } }` | champs invalides |
| 403 | `{ "success": false, "error": "Origine non autorisée." }` | autre domaine, absent de `ALLOWED_ORIGINS` |
| 405 | `{ "success": false, "error": "Méthode non autorisée." }` | autre chose qu'un POST |
| 413 | `{ "success": false, "error": "Demande trop volumineuse." }` | corps > 64 ko |
| 429 | `{ "success": false, "error": "Trop de demandes envoyées…" }` | limite de débit atteinte |
| 500 | `{ "success": false, "error": "…" }` | panne d'envoi ou configuration incomplète |

Les messages d'erreur sont rédigés pour être affichés tels quels au
visiteur : aucun détail technique, aucune clé, aucun nom de variable.

## Sécurité

| Protection | Fonctionnement |
| --- | --- |
| CORS | les pages du même domaine, plus les origines listées dans `ALLOWED_ORIGINS` ; les autres reçoivent un 403 |
| Honeypot | le champ invisible `_gotcha` rempli ⇒ message jeté, réponse `success: true` |
| Délai minimum | envoi en moins de `MIN_SUBMIT_SECONDS` ⇒ traité comme un robot |
| Limite de débit | `RATE_LIMIT_MAX` envois par IP et par fenêtre de temps |
| Taille | corps limité à 64 ko, message à `MAX_MESSAGE_LENGTH` caractères |
| Injection d'en-tête | sauts de ligne et caractères de contrôle retirés des champs mono-ligne |
| Échappement HTML | tout le contenu visiteur est échappé dans l'e-mail |

Le spam reçoit volontairement une réponse de succès : un robot ne doit pas
apprendre ce qui l'a trahi.

## Espace privé (/admin)

Chaque demande valide est **conservée puis notifiée par e-mail** — les deux,
pas l'un ou l'autre. Elles se consultent sur `/admin`, une page protégée par
mot de passe, absente de la navigation du site et exclue des moteurs de
recherche.

L'ordre compte : la demande est écrite avant l'envoi de l'e-mail. Si Resend
tombe, le visiteur reçoit quand même sa confirmation et la demande est dans
l'espace privé — rien n'est perdu ni à ressaisir.

### Stockage

| Mode | Quand | Configuration |
| --- | --- | --- |
| `kv` | production | une base KV (Redis) ajoutée au projet Vercel — l'intégration injecte `KV_REST_API_URL` et `KV_REST_API_TOKEN` |
| `file` | local, VPS | `STORE_FILE=.data/submissions.json` |
| `none` | par défaut | aucun stockage : e-mail seul, et l'espace privé le signale |

Le stockage n'est jamais bloquant : une panne de la base est journalisée,
la demande part quand même par e-mail. `STORE_MAX` (500 par défaut) borne
l'historique conservé.

### Accès

| Variable | Rôle |
| --- | --- |
| `ADMIN_PASSWORD` | le mot de passe d'accès (ou `ADMIN_PASSWORD_SHA256` pour n'en stocker que le condensat) |
| `ADMIN_SESSION_SECRET` | facultatif : à défaut, dérivé du mot de passe, donc le changer ferme les sessions |
| `ADMIN_SESSION_HOURS` | durée d'une session (12 h par défaut) |
| `ADMIN_LOGIN_MAX` | tentatives de connexion par IP et par fenêtre (10 par défaut) |

La session tient dans un cookie signé (HMAC-SHA256) : `HttpOnly` — donc
hors de portée du JavaScript —, `SameSite=Strict`, `Secure` en HTTPS, et
porteur de sa propre date d'expiration, ce qui évite au serveur d'avoir à
mémoriser quoi que ce soit. Le mot de passe est comparé à temps constant,
et les tentatives sont limitées par IP.

La page `/admin` elle-même est un fichier statique : elle ne contient
aucune donnée. Tout passe par `/api/admin/submissions`, qui ne répond rien
sans session valide.

## Deux façons de le déployer

### A. Intégré au site (recommandé, et ce qui est configuré aujourd'hui)

Les fonctions `api/contact.js` et `api/health.js` à la racine du dépôt
appellent la logique de ce dossier. Le site et l'API partagent alors un seul
projet Vercel et un seul domaine :

- rien à régler côté CORS, et les URL de prévisualisation marchent aussi ;
- le formulaire pointe sur `/api/contact` (chemin relatif) ;
- un seul déploiement à surveiller.

Il suffit d'ajouter les variables d'environnement au projet du site
(**Settings → Environment Variables**), puis de redéployer :

| Variable | Valeur |
| --- | --- |
| `RESEND_API_KEY` | la clé créée sur resend.com |
| `MAIL_TO` | votre adresse de réception |
| `MAIL_FROM` | `onboarding@resend.dev` tant que le domaine n'est pas vérifié |
| `ADMIN_PASSWORD` | le mot de passe de l'espace privé |

`ALLOWED_ORIGINS` reste vide dans ce cas.

Pour que les demandes soient archivées, ajouter une base KV au projet :
**Storage → Create Database → KV (Redis)**, puis la relier au projet. Les
variables `KV_REST_API_*` sont injectées automatiquement ; un redéploiement
suffit à les prendre en compte.

### B. Déployé à part, sur son propre domaine

Utile pour servir plusieurs sites depuis une seule API.

1. Créer un compte sur [resend.com](https://resend.com), puis une clé API
   (**API Keys → Create**). Le plan gratuit couvre 3 000 e-mails par mois.
2. Sur [vercel.com](https://vercel.com) : **Add New → Project**, importer ce
   dépôt, et **régler « Root Directory » sur `contact-api`**.
3. Dans **Environment Variables**, coller les variables du fichier
   `.env.example` — dont `ALLOWED_ORIGINS`, qui doit alors lister les
   domaines des sites appelants.
4. **Deploy**. L'URL obtenue est celle de l'API :
   `https://<projet>.vercel.app/api/contact`.
5. Vérifier `https://<projet>.vercel.app/api/health` — la réponse doit
   afficher `"ok": true`.
6. Côté site, remplacer `data-endpoint="/api/contact"` par l'URL complète.

Tant que votre domaine n'est pas vérifié chez Resend, utilisez
`MAIL_FROM=onboarding@resend.dev` : les envois fonctionnent immédiatement,
vers votre propre adresse. Une fois le domaine vérifié (Resend → Domains,
trois enregistrements DNS à ajouter), remettez votre adresse.

### Pourquoi `framework`, `buildCommand` et `outputDirectory` sont explicites

Les deux `vercel.json` (racine et `contact-api/`) fixent ces trois clés à des
valeurs explicites. Sans elles, Vercel devine le type de projet : un
`package.json` doté d'un champ `main` ou d'un script `start` suffit à le
faire passer pour une application Node à démarrer, d'où l'erreur
*« No entrypoint found in output directory 'public' »*. Une clé à `null`
neutralise aussi tout réglage contraire enregistré dans le dashboard, qui
sans cela l'emporterait silencieusement.

## Déploiement sur Render

1. **New → Web Service**, connecter le dépôt.
2. **Root Directory** : `contact-api` · **Build** : `npm install` ·
   **Start** : `npm start`.
3. Ajouter les mêmes variables d'environnement.
4. L'URL est `https://<service>.onrender.com/api/contact`.

Sur le plan gratuit de Render, le service s'endort après inactivité : le
premier message d'une journée peut mettre une trentaine de secondes à
partir. Le formulaire affiche « Envoi en cours… » pendant ce temps.

## En local

```bash
cd contact-api
cp .env.example .env      # puis remplir les valeurs
npm install
npm start                 # http://localhost:3000/api/contact
npm test                  # 34 tests, aucun e-mail réellement envoyé
```

Test manuel :

```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:8000' \
  -d '{"nom":"Test","email":"moi@exemple.fr","message":"Ceci est un essai."}'
```

## Utiliser SMTP plutôt que Resend

Mettre `MAIL_PROVIDER=smtp` et renseigner `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`. Exemple pour une boîte OVH :

```
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=465
SMTP_SECURE=true
```

Nodemailer est déjà dans les dépendances ; rien d'autre à installer.

## Relier un nouveau site

1. Ajouter l'origine du site dans `ALLOWED_ORIGINS` (séparateur : virgule) —
   inutile si le site est servi par le même domaine que l'API.
2. Copier `public/assets/contact.js` du site principal, et renseigner
   `data-endpoint` sur la balise `<form>`.

## Fichiers

```
contact-api/
├── api/contact.js       point d'entrée serverless (déploiement autonome)
├── api/health.js        sonde de vie
├── api/admin/*.js       routes de l'espace privé (déploiement autonome)
├── public/index.html    page d'accueil du service (déploiement autonome)
├── server.js            serveur Express (Render, Railway, VPS, local)
├── lib/handler.js       logique commune aux deux : CORS, spam, envoi
├── lib/store.js         conservation des demandes (KV, fichier, ou rien)
├── lib/auth.js          mot de passe et cookie de session de l'espace privé
├── lib/admin.js         routes de l'espace privé
├── lib/config.js        lecture des variables d'environnement
├── lib/validate.js      validation et nettoyage des champs
├── lib/mail.js          rendu de l'e-mail + envoi Resend ou SMTP
├── lib/rate-limit.js    limite de débit en mémoire
├── lib/load-env.js      lecture du .env en local
└── test/                tests unitaires et d'intégration
```
