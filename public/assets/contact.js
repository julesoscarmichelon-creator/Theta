/* =====================================================================
   Formulaire de contact — envoi vers le microservice maison.

   Une seule chose à régler : l'URL de l'API. Elle se déclare dans le HTML,
   sur la balise <form>, via l'attribut `data-endpoint` :

     <form id="contactForm" data-endpoint="https://mon-api.vercel.app/api/contact">

   Le script se charge du reste : envoi en arrière-plan (aucune redirection),
   message de confirmation affiché dans la page, erreurs champ par champ.
   ===================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var endpoint = form.getAttribute('data-endpoint') || window.CONTACT_API_ENDPOINT || '';
  var status = document.getElementById('contactStatus');
  var button = form.querySelector('button[type="submit"]');
  var buttonLabel = button ? button.textContent : 'Envoyer';

  // Horodatage d'ouverture du formulaire : le serveur s'en sert pour écarter
  // les robots, qui postent en moins d'une seconde.
  var openedAt = Date.now();

  function setStatus(kind, message) {
    if (!status) return;
    status.className = 'form-status form-status--' + kind;
    status.textContent = message;
    status.hidden = false;
  }

  function clearFieldErrors() {
    form.querySelectorAll('.field-error').forEach(function (el) { el.remove(); });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
  }

  function showFieldErrors(fields) {
    Object.keys(fields).forEach(function (name) {
      var input = form.querySelector('[name="' + name + '"]');
      if (!input) return;
      input.setAttribute('aria-invalid', 'true');
      var hint = document.createElement('p');
      hint.className = 'field-error';
      hint.textContent = fields[name];
      input.insertAdjacentElement('afterend', hint);
    });
    var first = form.querySelector('[aria-invalid]');
    if (first) first.focus();
  }

  function busy(isBusy) {
    if (!button) return;
    button.disabled = isBusy;
    button.textContent = isBusy ? 'Envoi en cours…' : buttonLabel;
  }

  function succeed() {
    form.reset();
    // Le formulaire s'efface au profit du message : rien d'autre à faire ici.
    form.hidden = true;
    setStatus('ok',
      'Merci, votre message est bien parti. Je vous réponds sous 24 heures ouvrées.');
    if (status) {
      status.setAttribute('tabindex', '-1');
      status.focus();
    }
  }

  form.setAttribute('novalidate', 'novalidate');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearFieldErrors();

    if (!endpoint) {
      setStatus('error', "Le formulaire n'est pas encore relié. Écrivez-moi directement par e-mail.");
      return;
    }

    // La validation native du navigateur reste la première barrière.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var payload = {};
    new FormData(form).forEach(function (value, key) {
      payload[key] = typeof value === 'string' ? value : '';
    });
    payload._t = openedAt;

    busy(true);
    setStatus('pending', 'Envoi en cours…');

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json()
          .catch(function () { return {}; })
          .then(function (data) { return { response: response, data: data }; });
      })
      .then(function (result) {
        var data = result.data;

        if (result.response.ok && data.success) {
          succeed();
          return;
        }

        if (data.fields) {
          showFieldErrors(data.fields);
          setStatus('error', data.error || 'Certains champs sont incomplets.');
          return;
        }

        setStatus('error', data.error ||
          "L'envoi a échoué. Réessayez dans un instant ou écrivez-moi directement par e-mail.");
      })
      .catch(function () {
        // Réseau coupé, DNS, CORS mal configuré : rien d'exploitable côté client.
        setStatus('error',
          "Connexion impossible. Vérifiez votre réseau, puis réessayez — ou écrivez-moi directement par e-mail.");
      })
      .then(function () { busy(false); });
  });
})();
