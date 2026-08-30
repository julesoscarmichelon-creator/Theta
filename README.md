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

Le formulaire est un POST HTML classique vers **Formspree** : aucun
JavaScript, aucun service à héberger. Deux valeurs se règlent directement
dans `public/index.html` :

```html
<form action="https://formspree.io/f/VOTRE-ID" method="POST">
  <input type="hidden" name="_next" value="https://VOTRE-DOMAINE/merci.html">
```

- `action` — l'identifiant du formulaire, donné par Formspree à la création.
- `_next` — la page de remerciement affichée après l'envoi, à la place de
  celle de Formspree. **L'URL doit être absolue et suivre le domaine de
  production.**

Le champ caché `_gotcha` est un piège à robots : Formspree ignore toute
soumission dans laquelle il est rempli.

## Déployer

Le dépôt est un site entièrement statique : un seul projet Vercel, servant
le dossier `public/` (voir `vercel.json`). Aucune fonction serverless,
aucune variable d'environnement, aucune base de données.

Voir `DEPLOIEMENT_OVH.md` pour la mise en ligne sur un VPS OVH en HTTPS.

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
 
