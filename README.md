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
- `api/` — **fonctions serverless du site** : `contact.js` (réception du
  formulaire) et `health.js` (état du service). Servies par Vercel sur le
  même domaine que le site, à `/api/contact` et `/api/health`.
- `contact-api/` — **le microservice de contact** dont ces fonctions se
  servent : validation, anti-spam et envoi de l'e-mail (remplace Formspree).
  Il est aussi déployable seul, sur son propre domaine — voir
  `contact-api/README.md`, et `contact-api/INTEGRATION.md` pour le
  branchement côté site.
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

L'API vit dans le même projet Vercel que le site : le formulaire poste sur
`/api/contact`, sur son propre domaine. Il n'y a donc ni CORS à régler, ni
URL à recopier — les déploiements de prévisualisation fonctionnent aussi.

Il reste à renseigner trois variables d'environnement dans le projet Vercel
(**Settings → Environment Variables**) : `RESEND_API_KEY`, `MAIL_TO` et
`MAIL_FROM`. Le détail, et la variante « API déployée à part », sont dans
`contact-api/README.md`.

## Configuration Vercel

Le dépôt se déploie en **site statique + fonctions**, et `vercel.json` le
dit explicitement plutôt que de laisser Vercel le deviner :

```json
{
  "framework": null,
  "buildCommand": null,
  "outputDirectory": "public",
  "functions": { "api/*.js": { "maxDuration": 10 } }
}
```

- `outputDirectory` : seules les pages de `public/` sont publiées — le code
  source du dépôt n'est pas servi.
- `framework` et `buildCommand` à `null` : aucun framework, aucune étape de
  compilation. Ces valeurs écrasent aussi les réglages du dashboard, qui
  l'emporteraient sinon.
- `api/*.js` devient automatiquement une fonction serverless par fichier.

Le `package.json` de la racine n'a **ni `main`, ni script `start`, ni script
`build`** : ces trois champs sont ce qui fait passer un dossier pour une
application Node à démarrer. Il ne sert qu'à déclarer la dépendance
`nodemailer`, utilisée par les fonctions en mode SMTP.

## Déployer

Voir `DEPLOIEMENT_OVH.md` pour la marche à suivre complète, de la commande
du VPS jusqu'à la mise en ligne en HTTPS.

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
