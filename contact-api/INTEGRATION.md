# Relier un formulaire à l'API

Le site principal utilise déjà `public/assets/contact.js`, qui gère tout
(envoi, message de confirmation, erreurs champ par champ). Ce fichier-ci
sert de référence pour comprendre l'échange, ou pour brancher un autre site.

## 1. Régler l'URL de l'API

Dans `public/index.html`, une seule valeur à changer après le déploiement :

```html
<form id="contactForm" data-endpoint="https://VOTRE-API.vercel.app/api/contact">
```

Et côté API, ajouter l'origine du site dans la variable `ALLOWED_ORIGINS`
(`https://mon-site.fr`, sans slash final).

## 2. Le HTML minimal attendu

```html
<form id="contactForm" data-endpoint="https://VOTRE-API.vercel.app/api/contact">
  <!-- Piège à robots : invisible, doit rester vide. -->
  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true"
         style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">

  <input name="nom" type="text" placeholder="Nom" required autocomplete="name">
  <input name="email" type="email" placeholder="Adresse e-mail" required autocomplete="email">
  <input name="entreprise" type="text" placeholder="Entreprise (facultatif)" autocomplete="organization">
  <textarea name="message" rows="6" required placeholder="Votre message"></textarea>

  <button type="submit">Envoyer</button>
</form>

<!-- La confirmation s'affiche ici, sans changer de page. -->
<p class="form-status" id="contactStatus" role="status" aria-live="polite" hidden></p>

<script src="/assets/contact.js" defer></script>
```

## 3. L'échange, en version courte

Si vous préférez écrire votre propre script, voici le strict nécessaire —
c'est exactement ce que fait `contact.js`, en plus court :

```js
const form = document.getElementById('contactForm');
const status = document.getElementById('contactStatus');
const openedAt = Date.now();   // sert au filtre anti-robot côté serveur

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = Object.fromEntries(new FormData(form));
  payload._t = openedAt;

  status.hidden = false;
  status.textContent = 'Envoi en cours…';

  try {
    const response = await fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (response.ok && data.success) {
      form.hidden = true;
      status.className = 'form-status form-status--ok';
      status.textContent = 'Merci, votre message est bien parti. Je vous réponds sous 24 heures ouvrées.';
    } else {
      status.className = 'form-status form-status--error';
      status.textContent = data.error || "L'envoi a échoué. Réessayez dans un instant.";
    }
  } catch {
    status.className = 'form-status form-status--error';
    status.textContent = 'Connexion impossible. Vérifiez votre réseau, puis réessayez.';
  }
});
```

La version complète du site ajoute trois choses utiles : le bouton passe en
« Envoi en cours… » et se désactive pendant la requête, les erreurs de
validation (`data.fields`) s'affichent sous le champ concerné, et le message
de confirmation reçoit le focus pour être annoncé aux lecteurs d'écran.

## 4. Vérifier que tout est branché

1. Ouvrir `https://VOTRE-API.vercel.app/api/health` → doit répondre `"ok": true`.
2. Envoyer un vrai message depuis le site : la confirmation s'affiche dans la
   page, et l'e-mail arrive dans la minute.
3. En cas d'échec, ouvrir la console du navigateur (F12) :
   - « blocked by CORS policy » ⇒ l'origine du site manque dans `ALLOWED_ORIGINS` ;
   - erreur 500 ⇒ regarder les journaux de l'hébergeur (clé API, adresse
     d'expéditeur non vérifiée chez Resend).
