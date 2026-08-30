# Déployer l'espace d'administration sur Vercel

Guide pas-à-pas. À la fin, vous aurez **trois projets Vercel distincts**
alimentés par le même dépôt GitHub, et un espace d'administration accessible
par mot de passe qui liste les demandes reçues par le formulaire du site.

| Projet Vercel | Répertoire racine | Rôle | Adresse |
| --- | --- | --- | --- |
| `theta` (existant) | *(racine)* | site vitrine public | theta-zeta.vercel.app |
| `theta-contact-api` (existant) | `contact-api` | reçoit le formulaire | …vercel.app/api/contact |
| **`theta-admin` (à créer)** | **`admin-app`** | **connexion + liste des demandes** | **theta-admin.vercel.app** |

Les trois vivent dans le **même dépôt**, mais chacun ne déploie que son
répertoire racine : le code de l'admin ne part jamais sur le site public, et
inversement. C'est le fonctionnement « monorepo » natif de Vercel — le dépôt
l'utilise déjà pour `contact-api`.

> **Pourquoi pas deux dépôts ?** Ce serait possible (il suffirait de déplacer
> `admin-app/` dans un nouveau dépôt, rien d'autre à changer), mais cela
> obligerait à maintenir `lib/store.js` dans deux historiques Git séparés,
> à ouvrir deux fois chaque changement, et à jongler entre deux clones.
> L'isolation de déploiement — le vrai besoin ici — est déjà totale avec des
> répertoires racines distincts.

---

## Étape 1 — Créer le magasin de données partagé

C'est ce qui relie les deux projets. **À faire en premier.**

1. Sur [vercel.com](https://vercel.com), ouvrir l'onglet **Storage** (menu du
   haut, au niveau de l'équipe — pas d'un projet).
2. **Create Database** → choisir **Upstash for Redis** (anciennement
   « Vercel KV ») → offre gratuite → **Continue**.
3. Nom : `theta-submissions`. Région : **Frankfurt (fra1)** ou **Paris**
   (au plus près de vos visiteurs). → **Create**.

Le magasin est créé. Il expose deux valeurs, `KV_REST_API_URL` et
`KV_REST_API_TOKEN`, que Vercel injectera automatiquement dans les projets
qu'on lui connecte.

## Étape 2 — Connecter le magasin à `theta-contact-api`

Sans cette étape, rien ne serait archivé et l'admin resterait vide.

1. Storage → `theta-submissions` → onglet **Projects** → **Connect Project**.
2. Choisir **theta-contact-api**, cocher les trois environnements
   (Production, Preview, Development) → **Connect**.
3. Projet `theta-contact-api` → **Deployments** → sur le dernier déploiement,
   menu `…` → **Redeploy** (les nouvelles variables ne s'appliquent qu'au
   prochain déploiement).

Vérification : envoyer un message depuis le formulaire du site. L'e-mail doit
arriver comme avant — il est maintenant aussi archivé.

## Étape 3 — Créer le projet Vercel de l'admin

1. Vercel → **Add New…** → **Project**.
2. Importer le dépôt **`julesoscarmichelon-creator/Theta`** (le même que le
   site — Vercel accepte plusieurs projets sur un même dépôt).
3. **Project Name** : `theta-admin`.
4. **Root Directory** : cliquer **Edit** et sélectionner **`admin-app`**.
   ⚠️ C'est le réglage central : sans lui, Vercel déploierait le site public.
5. **Framework Preset** : `Other`. Laisser les commandes de build vides —
   `admin-app/vercel.json` s'en charge.
6. **Ne pas encore déployer** : déplier **Environment Variables** et passer à
   l'étape 4.

## Étape 4 — Les variables d'environnement de l'admin

Générer d'abord la clé de signature des sessions :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Puis saisir ces deux variables (Production + Preview + Development) :

| Nom | Valeur |
| --- | --- |
| `ADMIN_PASSWORD` | votre mot de passe, **12 caractères minimum**, différent de tous les autres |
| `ADMIN_SESSION_SECRET` | la chaîne de 64 caractères produite ci-dessus |

Facultatif : `ADMIN_SESSION_HOURS` (durée d'une session, 12 par défaut),
`ADMIN_LOGIN_MAX` (tentatives autorisées par IP, 10 par défaut).

**Ne pas saisir `KV_REST_API_URL` ni `KV_REST_API_TOKEN` à la main** :
l'étape 5 les ajoute automatiquement, avec les bonnes valeurs.

Cliquer **Deploy**. Le premier déploiement échouera à afficher les données —
c'est normal, le magasin n'est pas encore branché.

## Étape 5 — Connecter le même magasin à l'admin

C'est **l'étape qui relie les deux projets**. Le magasin doit être le même
qu'à l'étape 2, sinon l'admin lira une base vide.

1. Storage → `theta-submissions` → **Projects** → **Connect Project**.
2. Choisir **theta-admin**, cocher les trois environnements → **Connect**.
3. Projet `theta-admin` → **Deployments** → `…` → **Redeploy**.

Vérifier dans `theta-admin` → **Settings → Environment Variables** que
`KV_REST_API_URL` et `KV_REST_API_TOKEN` sont bien présentes, marquées
« from Upstash ».

## Étape 6 — Vérifier

1. Ouvrir `https://theta-admin.vercel.app` → la page de connexion s'affiche.
2. Saisir `ADMIN_PASSWORD` → la liste des demandes apparaît.
3. Depuis le site public, envoyer un message par le formulaire.
4. Revenir sur l'admin, cliquer **Actualiser** → la demande est là.

Si la liste reste vide alors qu'un e-mail est bien arrivé : les deux projets
ne pointent pas sur le même magasin. Comparer `KV_REST_API_URL` dans les
réglages des deux projets — les valeurs doivent être **identiques**.

---

## Ce qu'il reste à faire (facultatif)

- **Nom de domaine** : projet `theta-admin` → Settings → Domains →
  `admin.michelon-co.fr`. L'admin n'a aucun lien depuis le site public, et
  `robots.txt` en interdit l'indexation : l'adresse reste discrète.
- **Protection supplémentaire** : Settings → Deployment Protection →
  **Vercel Authentication** ajoute une seconde barrière (compte Vercel
  requis en plus du mot de passe). Recommandé si l'admin contient à terme
  des données sensibles.
- **Durée de conservation** : ajouter `STORE_TTL_DAYS` (ex. `365`) sur
  `theta-contact-api` pour que les demandes s'effacent d'elles-mêmes, en
  cohérence avec la politique de confidentialité du site.

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| « L'espace d'administration est mal configuré » | `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET` absent / trop court. Après correction : **redéployer**. |
| Connexion acceptée puis retour à la page de connexion | Cookie rejeté. Vérifier l'accès en `https://` (le cookie est `Secure`). |
| « Le magasin de données est injoignable » | Étape 5 non faite, ou pas de redéploiement depuis. |
| Liste vide malgré des e-mails reçus | Les deux projets utilisent deux magasins différents (voir étape 6), ou le formulaire tourne encore sur un déploiement antérieur à l'étape 2. |
| « Trop de tentatives » | Limite atteinte pour votre IP : attendre 15 minutes, ou augmenter `ADMIN_LOGIN_MAX`. |
