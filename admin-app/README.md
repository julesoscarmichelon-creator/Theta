# Espace d'administration Theta

Projet **indépendant** du site public : il ne contient qu'une page de
connexion par mot de passe et la liste des demandes reçues par le
formulaire de contact. Aucun fichier du site vitrine n'y figure.

Il se déploie comme **son propre projet Vercel**, avec son propre domaine.
Le lien avec le site principal ne passe pas par le code mais par un
**magasin Redis partagé** : `contact-api/` y écrit chaque demande, cet
espace la lit.

```
  Site public (public/)            Admin (admin-app/)
        │ formulaire                      │ lecture
        ▼                                 ▼
   contact-api/  ──── écrit ────►  Redis (Vercel Storage)
        │
        └──── e-mail (Resend / SMTP)
```

## Contenu

| Fichier | Rôle |
| --- | --- |
| `public/index.html` | page de connexion (mot de passe unique) |
| `public/submissions.html` | liste des demandes, filtre, suppression |
| `public/admin.css` | styles, autonomes (rien n'est repris du site) |
| `api/login.js` | vérifie le mot de passe, ouvre la session |
| `api/logout.js` | ferme la session |
| `api/session.js` | état de la session, pour les pages statiques |
| `api/submissions.js` | liste et supprime les demandes (session requise) |
| `lib/auth.js` | mot de passe et cookie de session signé |
| `lib/store.js` | client Redis REST — **copie conforme** de `contact-api/lib/store.js` |
| `lib/http.js` | aides HTTP communes aux fonctions |
| `server.js` | serveur local de développement (non utilisé en production) |

> `lib/store.js` est volontairement dupliqué : les deux projets Vercel ont
> des répertoires racines différents, un `require` traversant les dossiers
> ne serait pas embarqué dans le bundle. **Toute modification doit être
> recopiée dans les deux fichiers.**

## Sécurité

- Mot de passe unique, comparé à durée constante (pas de fuite par timing).
- Session dans un cookie `HttpOnly` + `Secure` + `SameSite=Strict`, signé en
  HMAC-SHA256 : un cookie forgé est rejeté, JavaScript ne peut pas le lire.
- Tentatives de connexion limitées par IP, comptées dans le Redis (donc
  partagées entre toutes les instances serverless).
- `noindex` sur toutes les pages, `robots.txt` fermé, `Cache-Control:
  no-store` sur les réponses.
- Les pages HTML sont publiques mais vides : **toutes** les données passent
  par `/api/submissions`, qui exige une session valide.

## Variables d'environnement

Voir `.env.example`. Les indispensables :

| Variable | Rôle |
| --- | --- |
| `ADMIN_PASSWORD` | mot de passe de connexion (12 caractères minimum) |
| `ADMIN_SESSION_SECRET` | clé de signature des cookies (32 caractères minimum) |
| `KV_REST_API_URL` | magasin Redis — **la même valeur que `contact-api`** |
| `KV_REST_API_TOKEN` | idem |

Générer un secret :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## En local

```bash
cd admin-app
cp .env.example .env      # renseigner ADMIN_PASSWORD, ADMIN_SESSION_SECRET, KV_*
echo "ADMIN_COOKIE_INSECURE=true" >> .env   # le cookie Secure ne passe pas en http://
npm run dev               # http://localhost:3100
```

## Tests

```bash
npm test
```

Aucun réseau n'est requis : le Redis et l'envoi d'e-mail sont simulés.

## Déploiement

Voir `DEPLOIEMENT_ADMIN.md` à la racine du dépôt.
