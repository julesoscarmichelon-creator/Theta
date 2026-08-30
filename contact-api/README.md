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
| `/api/health` | `GET` | état du service et configuration manquante |

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
| 403 | `{ "success": false, "error": "Origine non autorisée." }` | domaine absent de `ALLOWED_ORIGINS` |
| 405 | `{ "success": false, "error": "Méthode non autorisée." }` | autre chose qu'un POST |
| 413 | `{ "success": false, "error": "Demande trop volumineuse." }` | corps > 64 ko |
| 429 | `{ "success": false, "error": "Trop de demandes envoyées…" }` | limite de débit atteinte |
| 500 | `{ "success": false, "error": "…" }` | panne d'envoi ou configuration incomplète |

Les messages d'erreur sont rédigés pour être affichés tels quels au
visiteur : aucun détail technique, aucune clé, aucun nom de variable.

## Sécurité

| Protection | Fonctionnement |
| --- | --- |
| CORS | seules les origines listées dans `ALLOWED_ORIGINS` reçoivent une réponse |
| Honeypot | le champ invisible `_gotcha` rempli ⇒ message jeté, réponse `success: true` |
| Délai minimum | envoi en moins de `MIN_SUBMIT_SECONDS` ⇒ traité comme un robot |
| Limite de débit | `RATE_LIMIT_MAX` envois par IP et par fenêtre de temps |
| Taille | corps limité à 64 ko, message à `MAX_MESSAGE_LENGTH` caractères |
| Injection d'en-tête | sauts de ligne et caractères de contrôle retirés des champs mono-ligne |
| Échappement HTML | tout le contenu visiteur est échappé dans l'e-mail |

Le spam reçoit volontairement une réponse de succès : un robot ne doit pas
apprendre ce qui l'a trahi.

## Déploiement sur Vercel (2 minutes)

1. Créer un compte sur [resend.com](https://resend.com), puis une clé API
   (**API Keys → Create**). Le plan gratuit couvre 3 000 e-mails par mois.
2. Sur [vercel.com](https://vercel.com) : **Add New → Project**, importer ce
   dépôt, et **régler « Root Directory » sur `contact-api`**.
3. Dans **Environment Variables**, coller les variables du fichier
   `.env.example` (au minimum `RESEND_API_KEY`, `MAIL_TO`, `MAIL_FROM`,
   `ALLOWED_ORIGINS`).
4. **Deploy**. L'URL obtenue est celle de l'API :
   `https://<projet>.vercel.app/api/contact`.
5. Vérifier avec `https://<projet>.vercel.app/api/health` — la réponse doit
   afficher `"ok": true`.

Tant que votre domaine n'est pas vérifié chez Resend, utilisez
`MAIL_FROM=onboarding@resend.dev` : les envois fonctionnent immédiatement,
vers votre propre adresse. Une fois le domaine vérifié (Resend → Domains,
trois enregistrements DNS à ajouter), remettez votre adresse.

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
npm test                  # 14 tests, aucun e-mail réellement envoyé
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

1. Ajouter l'origine du site dans `ALLOWED_ORIGINS` (séparateur : virgule).
2. Copier `public/assets/contact.js` du site principal, et renseigner
   `data-endpoint` sur la balise `<form>`.

## Fichiers

```
contact-api/
├── api/contact.js       point d'entrée serverless (Vercel)
├── api/health.js        sonde de vie
├── server.js            serveur Express (Render, Railway, VPS, local)
├── lib/handler.js       logique commune aux deux : CORS, spam, envoi
├── lib/config.js        lecture des variables d'environnement
├── lib/validate.js      validation et nettoyage des champs
├── lib/mail.js          rendu de l'e-mail + envoi Resend ou SMTP
├── lib/rate-limit.js    limite de débit en mémoire
├── lib/load-env.js      lecture du .env en local
└── test/                tests unitaires et d'intégration
```

## Archivage des demandes (optionnel)

Si `KV_REST_API_URL` et `KV_REST_API_TOKEN` sont renseignées, chaque demande
validée est aussi écrite dans un Redis (Vercel Storage / Upstash) avant
l'envoi de l'e-mail. C'est ce magasin que lit l'espace d'administration
`admin-app/`, déployé comme un projet Vercel séparé.

Trois garanties, vérifiées par `test/store.test.js` :

- sans ces variables, l'API se comporte exactement comme avant ;
- une panne du magasin est journalisée mais ne fait **jamais** échouer le
  formulaire (le visiteur voit un succès, l'e-mail part quand même) ;
- ni le spam ni les soumissions invalides ne sont archivés.

L'archivage a lieu **avant** l'envoi de l'e-mail : si le fournisseur de mail
tombe, la demande reste consultable dans l'admin.

Le client Redis (`lib/store.js`) est une copie conforme de
`admin-app/lib/store.js` — les deux projets ayant des répertoires racines
distincts sur Vercel, un fichier partagé ne serait pas embarqué dans les
bundles. Toute modification doit être recopiée dans les deux.

Voir `DEPLOIEMENT_ADMIN.md` à la racine du dépôt pour la marche à suivre.
