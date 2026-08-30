# Theta — site vitrine & démo

Site vitrine et démo commerciale pour Theta, un système de prospection
automatique (email + SMS) vendu aux indépendants et petites entreprises.

## Contenu du projet

- `public/index.html` — site vitrine (présentation, cas d'étude, simulateur
  de tarif, FAQ, contact).
- `public/demo/index.html` — démo interactive : pipeline de prospection type
  CRM (kanban), fil de conversation par prospect, flux d'activité simulé.
  **Toutes les données affichées sont fictives**, à but de démonstration
  commerciale uniquement — aucun vrai SMS/e-mail n'est envoyé.
- `public/assets/theta.css` — CSS compilé (Tailwind), généré à partir des
  classes utilisées dans les deux pages ci-dessus.
- `contact-api/` — **microservice de contact** : l'API maison qui reçoit le
  formulaire du site et envoie son contenu par e-mail (remplace Formspree).
  Déployable en quelques minutes sur Vercel ou Render — voir
  `contact-api/README.md`, et `contact-api/INTEGRATION.md` pour le
  branchement côté site.
- `admin-app/` — **espace d'administration**, projet totalement séparé du
  site public : une page de connexion par mot de passe et la liste des
  demandes reçues par le formulaire, rien d'autre. Il se déploie comme son
  propre projet Vercel et ne partage avec le site qu'un magasin Redis — voir
  `admin-app/README.md` et `DEPLOIEMENT_ADMIN.md`.
- `deploy/Caddyfile.example` — configuration prête à l'emploi pour servir le
  site en HTTPS gratuit sur un VPS OVH (via Caddy + nip.io, sans nom de
  domaine à acheter).
- `deploy/update.sh` — script pour renvoyer le site sur le serveur après une
  modification.
- `DEPLOIEMENT_OVH.md` — guide pas-à-pas (niveau débutant) pour commander un
  VPS OVH et mettre le site en ligne.

## Voir le site en local

```bash
cd public && python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 (site) et http://localhost:8000/demo/
(démo).

## Régénérer le CSS après une modification des pages HTML

Le CSS est compilé à l'avance (pas de dépendance au CDN Tailwind en
production, plus rapide et plus fiable). Si tu ajoutes de nouvelles classes
Tailwind dans les pages HTML, il faut recompiler :

```bash
npm install -D tailwindcss@3   # une seule fois, dans un dossier à part
npx tailwindcss -i input.css -o public/assets/theta.css --minify
```

(voir la configuration `tailwind.config.js` utilisée pour ce projet — thème
`bg`/`panel`/`ink`/`gold` — à recréer si besoin, ou demander à Claude Code de
la régénérer.)

## Le formulaire de contact

Le formulaire n'appelle plus aucun service tiers : il envoie ses données au
microservice du dossier `contact-api/`, qui les relaie sur la boîte mail
configurée. La confirmation s'affiche dans la page, sans redirection.

Après avoir déployé l'API, une seule valeur est à mettre à jour dans
`public/index.html` :

```html
<form id="contactForm" data-endpoint="https://VOTRE-API.vercel.app/api/contact">
```

Et l'origine du site doit figurer dans la variable `ALLOWED_ORIGINS` de
l'API. Le détail est dans `contact-api/README.md`.

## Trois projets, un seul dépôt

Le dépôt alimente trois projets Vercel indépendants, chacun limité à son
répertoire racine : ce qui est déployé pour l'un ne l'est jamais pour les
autres.

| Projet Vercel | Répertoire racine | Rôle |
| --- | --- | --- |
| `theta` | *(racine)* | site vitrine public |
| `theta-contact-api` | `contact-api` | reçoit le formulaire, envoie l'e-mail, archive |
| `theta-admin` | `admin-app` | connexion + liste des demandes |

Le seul lien entre eux est un magasin Redis (Vercel Storage) partagé :
`contact-api` y écrit chaque demande, `admin-app` la lit. Aucun code n'est
importé d'un projet à l'autre.

## Déployer

- Site public et API de contact : `DEPLOIEMENT_OVH.md` (VPS) ou l'import
  Vercel habituel.
- Espace d'administration : `DEPLOIEMENT_ADMIN.md`.

## Prochaines étapes (hors périmètre de ce dépôt)

1. **Mettre le site en ligne** sur un VPS OVH (guide fourni).
2. **Constituer des listes de prospects qualifiés en France** : ceci est une
   démarche commerciale/juridique (RGPD, démarchage téléphonique encadré par
   le Code des postes et communications électroniques) plutôt que technique
   — à préparer avec un annuaire professionnel conforme (ex: Société.com,
   Pappers, LinkedIn Sales Navigator) plutôt que du scraping automatisé non
   consenti.
3. **Prise de rendez-vous par appel direct** : hors du champ de ce dépôt de
   code (aucun outil d'appel automatisé n'est inclus ici) — à organiser
   manuellement ou via un outil de téléphonie dédié.
4. **Construire le vrai moteur d'automatisation** (envoi réel de SMS/email)
   une fois les premiers clients signés : nécessite un fournisseur SMS/email
   (ex: Brevo, Twilio) et le respect du consentement RGPD pour la prospection
   B2B/B2C.
 
