# Theta — site vitrine & démo

Site vitrine et démo commerciale de Michelon & Co. Le site présente trois
offres, une par onglet de navigation :

| Onglet | Page | Offre |
| --- | --- | --- |
| Automatisation | `public/index.html` | Systèmes d'automatisation IA (installation + suivi mensuel). Porte aussi le **formulaire de contact unique**. |
| Création de site | `public/creation-de-site.html` | Site vitrine sur mesure, forfait unique de 140 €. |
| Cartes NFC | `public/cartes-nfc.html` | Cartes à tap pour commerces, dès 20 € l'unité. |

Les trois pages partagent la même direction artistique : `michelon-ds.css`
pour les jetons, `michelon-page.css` pour la mise en page, `site.js` et
`wave.js` pour les interactions. Pour ajouter un onglet, dupliquer
`creation-de-site.html` et ajouter le lien dans la pilule de navigation et
dans le pied de page des trois pages.

## Contenu du projet

- `public/index.html` — onglet Automatisation (présentation, cas d'étude,
  simulateur de tarif, FAQ, fondateur, contact).
- `public/creation-de-site.html`, `public/cartes-nfc.html` — les deux autres
  onglets, bâtis sur la même trame : héros, métriques, offre, cas d'usage,
  tarifs, FAQ, appel à l'action.
- `public/assets/michelon-ds.css` — jetons et composants `.ds-*` partagés par
  toutes les surfaces (site, brochure, démo).
- `public/assets/michelon-page.css` — mise en page des pages d'offre :
  navigation, héros, métriques, cas, tarifs, pied de page.
- `public/demo/index.html` — démo interactive : pipeline de prospection type
  CRM (kanban), fil de conversation par prospect, flux d'activité simulé.
  **Toutes les données affichées sont fictives**, à but de démonstration
  commerciale uniquement — aucun vrai SMS/e-mail n'est envoyé.
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

## Modifier les styles

Le CSS est écrit à la main, sans étape de compilation : éditer
`public/assets/michelon-ds.css` (couleurs, typographie, espacements,
composants) ou `public/assets/michelon-page.css` (mise en page des pages
d'offre), recharger la page. Aucune dépendance, aucun `npm install`.

## Le formulaire de contact

Il n'y a **qu'un seul formulaire** sur tout le site, dans la section
`#contact` de `public/index.html`. Les onglets Création de site et Cartes NFC
n'en hébergent pas de copie : leurs appels à l'action pointent vers ce
formulaire avec un paramètre `?service=creation-de-site` ou
`?service=cartes-nfc`, que `site.js` lit pour présélectionner le menu
déroulant « Service souhaité ». Un seul endpoint Formspree à surveiller,
et le service demandé arrive dans chaque e-mail.

Le formulaire est un POST HTML classique vers **Formspree** : aucun
JavaScript pour l'envoi, aucun service à héberger. Deux valeurs se règlent
directement dans `public/index.html` :

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
 
