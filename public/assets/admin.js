/* =====================================================================
   Espace privé — affichage des demandes reçues.

   Tout passe par /api/admin/* : la page elle-même ne contient aucune
   donnée, et le cookie de session (HttpOnly) reste hors de portée du
   JavaScript. Sans session valide, l'API ne renvoie rien.
   ===================================================================== */
(function () {
  'use strict';

  var gate = document.getElementById('gate');
  var board = document.getElementById('board');
  var loginForm = document.getElementById('loginForm');
  var password = document.getElementById('password');
  var loginError = document.getElementById('loginError');
  var logoutBtn = document.getElementById('logout');
  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var searchEl = document.getElementById('search');
  var refreshBtn = document.getElementById('refresh');
  var boardError = document.getElementById('boardError');
  var storageWarning = document.getElementById('storageWarning');

  var submissions = [];

  function show(el, visible) { el.hidden = !visible; }

  function setError(el, message) {
    if (!message) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = message;
    el.hidden = false;
  }

  function api(path, options) {
    return fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin'
    }, options)).then(function (response) {
      return response.json()
        .catch(function () { return {}; })
        .then(function (data) { return { response: response, data: data }; });
    });
  }

  /* ---- Mise en forme ------------------------------------------------- */

  function formatDate(iso) {
    var date = new Date(iso);
    if (isNaN(date)) return iso || '';

    var diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return "à l'instant";
    if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'il y a ' + Math.floor(diff / 3600) + ' h';
    if (diff < 7 * 86400) return 'il y a ' + Math.floor(diff / 86400) + ' j';

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function exactDate(iso) {
    var date = new Date(iso);
    return isNaN(date) ? '' : date.toLocaleString('fr-FR');
  }

  /**
   * Les demandes sont écrites par des inconnus : elles ne sont jamais
   * injectées en HTML, seulement posées en texte.
   */
  function element(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function renderItem(entry) {
    var item = element('article', 'item');

    var top = element('div', 'item__top');
    top.appendChild(element('span', 'item__nom', entry.nom || '(sans nom)'));
    if (entry.entreprise) top.appendChild(element('span', 'item__soc', entry.entreprise));

    var date = element('span', 'item__date', formatDate(entry.date));
    date.title = exactDate(entry.date);
    top.appendChild(date);
    item.appendChild(top);

    if (entry.email) {
      var mail = element('a', 'item__mail', entry.email);
      mail.href = 'mailto:' + encodeURIComponent(entry.email) +
        '?subject=' + encodeURIComponent('Re : votre message — Michelon & Co');
      item.appendChild(mail);
    }

    item.appendChild(element('p', 'item__msg', entry.message || ''));

    var meta = [];
    if (entry.telephone) meta.push('tél. ' + entry.telephone);
    if (entry.sujet) meta.push('sujet : ' + entry.sujet);
    if (entry.origine) meta.push(entry.origine);
    if (entry.ip) meta.push('IP ' + entry.ip);
    if (meta.length) item.appendChild(element('p', 'item__meta', meta.join(' · ')));

    return item;
  }

  function matches(entry, needle) {
    return ['nom', 'email', 'entreprise', 'telephone', 'sujet', 'message'].some(function (key) {
      return String(entry[key] || '').toLowerCase().indexOf(needle) !== -1;
    });
  }

  function render() {
    var needle = searchEl.value.trim().toLowerCase();
    var visible = needle ? submissions.filter(function (e) { return matches(e, needle); }) : submissions;

    listEl.textContent = '';

    if (!visible.length) {
      listEl.appendChild(element('p', 'empty', submissions.length
        ? 'Aucune demande ne correspond à ce filtre.'
        : 'Aucune demande pour le moment. Les prochaines apparaîtront ici.'));
    } else {
      visible.forEach(function (entry) { listEl.appendChild(renderItem(entry)); });
    }

    countEl.textContent = needle
      ? visible.length + ' / ' + submissions.length
      : submissions.length + (submissions.length > 1 ? ' demandes' : ' demande');
  }

  /* ---- Chargement ---------------------------------------------------- */

  function load() {
    setError(boardError, '');
    refreshBtn.disabled = true;

    return api('/api/admin/submissions?limit=200').then(function (result) {
      if (result.response.status === 401) { showGate(); return; }

      if (!result.response.ok || !result.data.success) {
        setError(boardError, result.data.error || 'Lecture impossible pour le moment.');
        return;
      }

      submissions = result.data.items || [];
      if (result.data.storage === 'none') {
        setError(storageWarning,
          "Aucun stockage n'est configuré : les demandes arrivent par e-mail mais ne sont pas conservées ici. " +
          'Ajoutez une base KV au projet pour les archiver.');
      } else {
        setError(storageWarning, '');
      }
      render();
    }).catch(function () {
      setError(boardError, 'Connexion impossible. Vérifiez votre réseau, puis actualisez.');
    }).then(function () {
      refreshBtn.disabled = false;
    });
  }

  function showGate() {
    show(gate, true);
    show(board, false);
    show(logoutBtn, false);
    password.value = '';
    password.focus();
  }

  function showBoard() {
    show(gate, false);
    show(board, true);
    show(logoutBtn, true);
    load();
  }

  /* ---- Événements ---------------------------------------------------- */

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    setError(loginError, '');

    var button = loginForm.querySelector('button');
    button.disabled = true;
    button.textContent = 'Vérification…';

    api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: password.value })
    }).then(function (result) {
      if (result.response.ok && result.data.success) { showBoard(); return; }
      setError(loginError, result.data.error || 'Connexion refusée.');
      password.select();
    }).catch(function () {
      setError(loginError, 'Connexion impossible. Vérifiez votre réseau.');
    }).then(function () {
      button.disabled = false;
      button.textContent = 'Entrer';
    });
  });

  logoutBtn.addEventListener('click', function () {
    api('/api/admin/logout', { method: 'POST' }).then(showGate).catch(showGate);
  });

  refreshBtn.addEventListener('click', load);
  searchEl.addEventListener('input', render);

  // État initial : une session encore valide évite de redemander le mot de passe.
  api('/api/admin/session').then(function (result) {
    if (result.data && result.data.authenticated) { showBoard(); return; }
    showGate();
    if (result.data && result.data.configured === false) {
      setError(loginError, "L'espace privé n'est pas encore configuré (ADMIN_PASSWORD manquant).");
    }
  }).catch(showGate);
})();
