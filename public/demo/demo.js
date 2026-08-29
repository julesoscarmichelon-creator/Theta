/* ============================================================================
   DÉMONSTRATION — Michelon & Co
   ----------------------------------------------------------------------------
   Toutes les données affichées vivent dans DEMO_CONFIG ci-dessous. Pour adapter
   la démo à un client, il suffit de remplacer ces valeurs : le reste du fichier
   se contente de les lire et de les afficher.
   Aucune dépendance.
   ========================================================================== */
(function () {
  'use strict';

  /* ==========================================================================
     ZONE À MODIFIER
     ========================================================================== */
  var DEMO_CONFIG = {

    kpis: [
      { label: 'Demandes reçues (7 j)',   value: '112', delta: '+18 % vs semaine précédente' },
      { label: 'Traitées sans intervention', value: '86 %', delta: '+6 points' },
      { label: 'Délai de première réponse', value: '1 min 40', delta: 'stable', flat: true },
      { label: 'Rendez-vous obtenus',      value: '19',  delta: '+4' }
    ],

    // Hauteurs du graphique : demandes traitées par jour.
    week: [
      { d: 'Lun', n: 14 }, { d: 'Mar', n: 19 }, { d: 'Mer', n: 12 },
      { d: 'Jeu', n: 22 }, { d: 'Ven', n: 17 }, { d: 'Sam', n: 9 }, { d: 'Dim', n: 19 }
    ],

    today: [
      { label: 'E-mails envoyés', value: '31' },
      { label: 'SMS envoyés',     value: '12' },
      { label: "Taux d'ouverture", value: '64 %' },
      { label: 'RDV pris',        value: '3' }
    ],

    stages: ['Demande reçue', 'Qualifiée', 'Réponse envoyée', 'Rendez-vous', 'Signé'],

    leads: [
      { name: 'Léa Marchand', org: 'Particulier — recherche T3', chan: 'Formulaire', stage: 0, at: '20:47',
        thread: [
          { who: 'in',  t: '20:47', msg: "Bonjour, je viens de voir votre annonce pour le T3 avec terrasse rue des Oliviers. Est-il toujours disponible ? Et serait-il possible de le visiter cette semaine ?" }
        ] },
      { name: 'Antoine Rey', org: 'Rey & Associés — cabinet comptable', chan: 'E-mail', stage: 0, at: '09:12',
        thread: [
          { who: 'in', t: '09:12', msg: "Nous cherchons à automatiser la relance des pièces manquantes chez nos clients. Est-ce dans votre périmètre ?" }
        ] },
      { name: 'Sonia Berthier', org: 'Atelier Berthier — menuiserie', chan: 'E-mail', stage: 1, at: '08:31',
        thread: [
          { who: 'in',  t: '08:31', msg: "Bonjour, j'ai une demande de devis pour un aménagement complet. Vous gérez ce type de projet ?" },
          { who: 'out', t: '08:32', msg: "Bonjour Sonia, oui. Pour préparer un chiffrage utile, trois éléments suffisent : les dimensions, l'essence souhaitée et la date visée. Je vous envoie le formulaire correspondant." }
        ] },
      { name: 'Marc Aubert', org: 'Rivage Immobilier', chan: 'Formulaire', stage: 2, at: '20:52',
        thread: [
          { who: 'in',  t: '20:47', msg: "Le T3 rue des Oliviers est-il toujours disponible ?" },
          { who: 'out', t: '20:48', msg: "Oui : 68 m², terrasse de 12 m², 2e étage avec ascenseur. Je vous envoie le dossier complet — diagnostics, charges et taxe foncière. Pour la visite, jeudi 18h30 ou samedi 11h ?" },
          { who: 'in',  t: '20:52', msg: "Merci pour la réactivité ! Jeudi 18h30 me va très bien." }
        ] },
      { name: 'Nadia Bensalem', org: 'NB Coaching', chan: 'SMS', stage: 2, at: '11:05',
        thread: [
          { who: 'in',  t: '10:58', msg: "Bonjour, quels sont vos tarifs pour un accompagnement mensuel ?" },
          { who: 'out', t: '10:59', msg: "Bonjour Nadia, la grille part de 39 € par mois selon le volume. Je vous l'envoie en détail par e-mail à l'instant." }
        ] },
      { name: 'Julien Moreau', org: 'Moreau Toiture', chan: 'E-mail', stage: 3, at: '14:20',
        thread: [
          { who: 'in',  t: '13:44', msg: "D'accord pour un échange, envoyez-moi vos disponibilités." },
          { who: 'out', t: '13:45', msg: "Deux créneaux : mardi 11h ou mercredi 16h. Un rappel automatique vous parviendra la veille." },
          { who: 'in',  t: '14:20', msg: "Mardi 11h, c'est noté." }
        ] },
      { name: 'Emma Petit', org: 'Emma P. — décoration', chan: 'SMS', stage: 3, at: '08:53',
        thread: [
          { who: 'out', t: '08:50', msg: "Bonjour Emma, votre rendez-vous de jeudi 14h est confirmé. L'invitation vient d'être ajoutée à votre agenda." },
          { who: 'in',  t: '08:53', msg: "Parfait, merci !" }
        ] },
      { name: 'Thomas Girard', org: 'Girard Rénovation', chan: 'E-mail', stage: 4, at: '17:02',
        thread: [
          { who: 'in',  t: '16:40', msg: "On part sur la formule Multicanal. Vous m'envoyez le devis ?" },
          { who: 'out', t: '16:41', msg: "Devis envoyé à l'instant, signature électronique incluse. Installation possible dès la semaine prochaine." },
          { who: 'in',  t: '17:02', msg: "Signé. À la semaine prochaine." }
        ] }
    ],

    templates: [
      { name: 'Première réponse — demande entrante', chan: 'E-mail', delay: '< 2 min',
        body: "Bonjour {{prénom}}, merci pour votre message concernant {{sujet}}. {{réponse_qualifiée}} Je vous propose deux créneaux : {{créneau_1}} ou {{créneau_2}}." },
      { name: 'Relance sans réponse', chan: 'E-mail', delay: 'J+4',
        body: "Bonjour {{prénom}}, je reviens vers vous au sujet de {{sujet}}. Souhaitez-vous que je vous réserve {{créneau_1}} ? Sinon, dites-moi ce qui vous conviendrait." },
      { name: 'Confirmation de rendez-vous', chan: 'SMS', delay: 'immédiat',
        body: "{{prénom}}, votre rendez-vous du {{date}} à {{heure}} est confirmé. L'invitation est dans votre agenda." },
      { name: 'Rappel la veille', chan: 'SMS', delay: 'J-1',
        body: "Rappel : rendez-vous demain {{heure}} avec {{interlocuteur}}. Répondez STOP pour ne plus recevoir ces rappels." }
    ],

    events: [
      'Nouvelle demande reçue — {{n}}',
      'Demande qualifiée automatiquement — {{n}}',
      'Réponse envoyée à {{n}}',
      'Dossier transmis à {{n}}',
      'Rendez-vous inscrit à l’agenda — {{n}}',
      'Rappel programmé pour {{n}}'
    ]
  };
  /* ==========================================================================
     FIN DE LA ZONE À MODIFIER
     ========================================================================== */

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var initials = function (n) {
    return n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  };

  /* ---- Navigation entre les vues ------------------------------------------ */
  var tabs = document.querySelectorAll('.side__b');
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-view');
      Array.prototype.forEach.call(tabs, function (o) {
        o.setAttribute('aria-selected', o === b ? 'true' : 'false');
      });
      ['pipeline', 'perf', 'feed', 'tpl'].forEach(function (name) {
        $('v-' + name).hidden = (name !== v);
      });
      if (v === 'perf') drawChart();
    });
  });

  /* ---- Pipeline ------------------------------------------------------------ */
  function renderBoard() {
    $('board').innerHTML = DEMO_CONFIG.stages.map(function (stage, i) {
      var items = DEMO_CONFIG.leads.filter(function (l) { return l.stage === i; });
      return '<div class="col">' +
        '<div class="col__h"><span class="col__n">' + esc(stage) + '</span>' +
        '<span class="col__c">' + items.length + '</span></div>' +
        '<div class="col__body">' + items.map(cardHtml).join('') + '</div></div>';
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('.lead'), function (el) {
      el.addEventListener('click', function () { openLead(el.getAttribute('data-name')); });
    });
  }

  function cardHtml(l) {
    var last = l.thread[l.thread.length - 1];
    return '<button type="button" class="lead" data-name="' + esc(l.name) + '">' +
      '<div class="lead__top"><span class="lead__av">' + initials(l.name) + '</span>' +
      '<span><span class="lead__n">' + esc(l.name) + '</span><br>' +
      '<span class="lead__o">' + esc(l.org) + '</span></span></div>' +
      '<div class="lead__m">' + esc(last.msg) + '</div>' +
      '<div class="lead__f"><span class="chan">' + esc(l.chan) + '</span><span>' + esc(l.at) + '</span></div>' +
      '</button>';
  }

  /* ---- Modale de conversation ---------------------------------------------- */
  var modal = $('modal'), lastFocus = null;
  function openLead(name) {
    var l = DEMO_CONFIG.leads.filter(function (x) { return x.name === name; })[0];
    if (!l) return;
    lastFocus = document.activeElement;
    $('mAv').textContent = initials(l.name);
    $('mTitle').textContent = l.name;
    $('mOrg').textContent = l.org;
    $('mThread').innerHTML = l.thread.map(function (m) {
      var out = m.who === 'out';
      return '<div style="display:flex;justify-content:' + (out ? 'flex-end' : 'flex-start') + '">' +
        '<div style="max-width:88%">' +
        '<div class="ds-meta"><span>' + (out ? 'Envoyé automatiquement' : esc(l.name)) + '</span>' +
        '<span>' + esc(m.t) + '</span></div>' +
        '<div class="ds-bubble ds-bubble--' + (out ? 'out' : 'in') + '">' + esc(m.msg) + '</div>' +
        '</div></div>';
    }).join('');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('mClose').focus();
    document.addEventListener('keydown', onKey);
  }
  function closeLead() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') closeLead(); }
  $('mClose').addEventListener('click', closeLead);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeLead(); });

  /* ---- Performance --------------------------------------------------------- */
  function renderKpis() {
    $('kpis').innerHTML = DEMO_CONFIG.kpis.map(function (k) {
      return '<div class="kpi"><div class="kpi__l">' + esc(k.label) + '</div>' +
        '<div class="kpi__v">' + esc(k.value) + '</div>' +
        '<div class="kpi__d' + (k.flat ? ' kpi__d--flat' : '') + '">' + esc(k.delta) + '</div></div>';
    }).join('');

    $('today').innerHTML = DEMO_CONFIG.today.map(function (k) {
      return '<div class="kpi" style="padding:var(--sp-6)"><div class="kpi__l">' + esc(k.label) + '</div>' +
        '<div class="kpi__v" style="font-size:1.5rem">' + esc(k.value) + '</div></div>';
    }).join('');
  }

  var chartDrawn = false;
  function drawChart() {
    var max = Math.max.apply(null, DEMO_CONFIG.week.map(function (d) { return d.n; }));
    if (!chartDrawn) {
      $('chart').innerHTML = DEMO_CONFIG.week.map(function (d) {
        return '<div class="bar"><div class="bar__f" data-h="' +
          Math.round((d.n / max) * 100) + '"></div><span class="bar__l">' + esc(d.d) + '</span></div>';
      }).join('');
      $('weekTotal').textContent = DEMO_CONFIG.week.reduce(function (a, d) { return a + d.n; }, 0);
      chartDrawn = true;
    }
    // Les barres montent après insertion : une transition ne part pas de rien.
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.bar__f'), function (f) {
        f.style.height = f.getAttribute('data-h') + '%';
      });
    });
  }

  /* ---- Modèles de messages -------------------------------------------------- */
  function renderTemplates() {
    $('tpls').innerHTML = DEMO_CONFIG.templates.map(function (t) {
      var body = esc(t.body).replace(/\{\{([^}]+)\}\}/g, '<span class="tpl__v">{{$1}}</span>');
      return '<div class="tpl__c"><div class="tpl__h"><span class="tpl__n">' + esc(t.name) + '</span>' +
        '<span class="chan" style="font:500 var(--t-xs)/1 var(--f-mono);color:var(--c-ink-faint)">' +
        esc(t.chan) + '</span></div>' +
        '<div class="tpl__b">' + body + '</div>' +
        '<div class="tpl__s"><span>Déclenchement : ' + esc(t.delay) + '</span></div></div>';
    }).join('');
  }

  /* ---- Flux d'activité ------------------------------------------------------ */
  function pushEvent() {
    var tpl = DEMO_CONFIG.events[Math.floor(Math.random() * DEMO_CONFIG.events.length)];
    var who = DEMO_CONFIG.leads[Math.floor(Math.random() * DEMO_CONFIG.leads.length)].name;
    var now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    var el = document.createElement('div');
    el.className = 'ev';
    el.innerHTML = '<span class="ev__i"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5l3 2"/></svg></span>' +
      '<div><div class="ev__t">' + esc(tpl.replace('{{n}}', who)) + '</div>' +
      '<div class="ev__d">' + now + '</div></div>';
    var feed = $('feed');
    feed.insertBefore(el, feed.firstChild);
    while (feed.children.length > 14) feed.removeChild(feed.lastChild);
  }

  /* ---- Initialisation ------------------------------------------------------- */
  renderBoard();
  renderKpis();
  renderTemplates();
  for (var i = 0; i < 6; i++) pushEvent();
  if (!reduced) setInterval(pushEvent, 4200);
})();
