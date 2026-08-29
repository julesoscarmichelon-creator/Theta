/* ============================================================================
   DÉMONSTRATION — Michelon & Co
   ----------------------------------------------------------------------------
   Quatre vues : vue d'ensemble (globe), envois, réponses, éléments à valider.
   Toutes les données vivent dans DEMO_CONFIG : pour adapter la démo à un
   client, il suffit de remplacer ces valeurs. Aucune dépendance.
   ========================================================================== */
(function () {
  'use strict';

  /* ==========================================================================
     ZONE À MODIFIER
     ========================================================================== */
  var DEMO_CONFIG = {

    /* --- Vue 2 : envois --- */
    sentKpis: [
      { label: 'Messages partis (7 j)', value: '412', delta: '+14 % vs semaine précédente' },
      { label: 'Taux de délivrance',    value: '98,2 %', delta: 'stable', flat: true },
      { label: 'Ouvertures',            value: '61 %',  delta: '+3 points' },
      { label: 'Coût par message',      value: '0,004 €', delta: 'crédits IA inclus', flat: true }
    ],
    week: [
      { d: 'Lun', n: 58 }, { d: 'Mar', n: 71 }, { d: 'Mer', n: 49 }, { d: 'Jeu', n: 82 },
      { d: 'Ven', n: 64 }, { d: 'Sam', n: 33 }, { d: 'Dim', n: 55 }
    ],
    sent: [
      { name: 'Léa Marchand',    org: 'Recherche T3 — Aix',        chan: 'E-mail', at: '20:48', kind: 'Première réponse' },
      { name: 'Antoine Rey',     org: 'Rey & Associés',            chan: 'E-mail', at: '09:14', kind: 'Première réponse' },
      { name: 'Sonia Berthier',  org: 'Atelier Berthier',          chan: 'E-mail', at: '08:32', kind: 'Demande de précisions' },
      { name: 'Julien Moreau',   org: 'Moreau Toiture',            chan: 'SMS',    at: '13:45', kind: 'Créneaux proposés' },
      { name: 'Nadia Bensalem',  org: 'NB Coaching',               chan: 'SMS',    at: '10:59', kind: 'Grille tarifaire' },
      { name: 'Emma Petit',      org: 'Emma P. — décoration',      chan: 'SMS',    at: '08:50', kind: 'Rappel de rendez-vous' },
      { name: 'Karim Haddad',    org: 'Haddad Immobilier',         chan: 'E-mail', at: '16:20', kind: 'Relance J+4' },
      { name: 'Thomas Girard',   org: 'Girard Rénovation',         chan: 'E-mail', at: '16:41', kind: 'Envoi de devis' }
    ],

    /* --- Vue 3 : réponses --- */
    repKpis: [
      { label: 'Réponses reçues (7 j)', value: '96',       delta: '+11' },
      { label: 'Taux de réponse',       value: '23 %',     delta: '+2 points' },
      { label: 'Délai moyen de retour', value: '4 h 20',   delta: 'stable', flat: true },
      { label: 'Rendez-vous obtenus',   value: '19',       delta: '+4' }
    ],
    funnel: [
      { l: 'Messages partis',    n: 412 },
      { l: 'Ouverts',            n: 251 },
      { l: 'Réponses reçues',    n: 96 },
      { l: 'Échanges qualifiés', n: 47 },
      { l: 'Rendez-vous',        n: 19 }
    ],
    replies: [
      { name: 'Léa Marchand',   kind: 'Intéressé', at: '20:52', msg: "Merci pour la réactivité ! Jeudi 18h30 me va très bien.",
        thread: [ { who:'out', t:'20:48', msg:"Le T3 rue des Oliviers est disponible. Jeudi 18h30 ou samedi 11h pour la visite ?" },
                  { who:'in',  t:'20:52', msg:"Merci pour la réactivité ! Jeudi 18h30 me va très bien." } ] },
      { name: 'Antoine Rey',    kind: 'Question', at: '09:41', msg: "Est-ce que ça se branche sur notre outil comptable actuel ?",
        thread: [ { who:'out', t:'09:14', msg:"Nous automatisons la relance des pièces manquantes chez vos clients." },
                  { who:'in',  t:'09:41', msg:"Est-ce que ça se branche sur notre outil comptable actuel ?" } ] },
      { name: 'Sonia Berthier', kind: 'Intéressé', at: '08:58', msg: "Voici les dimensions et l'essence souhaitée.",
        thread: [ { who:'out', t:'08:32', msg:"Trois éléments suffisent pour un chiffrage : dimensions, essence, date visée." },
                  { who:'in',  t:'08:58', msg:"Voici les dimensions et l'essence souhaitée." } ] },
      { name: 'Karim Haddad',   kind: 'Refus',    at: '17:03', msg: "Pas pour le moment, nous avons déjà un prestataire.",
        thread: [ { who:'out', t:'16:20', msg:"Je reviens vers vous au sujet de votre demande." },
                  { who:'in',  t:'17:03', msg:"Pas pour le moment, nous avons déjà un prestataire." } ] },
      { name: 'Julien Moreau',  kind: 'Intéressé', at: '14:20', msg: "Mardi 11h, c'est noté.",
        thread: [ { who:'out', t:'13:45', msg:"Mardi 11h ou mercredi 16h ? Un rappel partira la veille." },
                  { who:'in',  t:'14:20', msg:"Mardi 11h, c'est noté." } ] },
      { name: 'Nadia Bensalem', kind: 'Question', at: '11:12', msg: "Le tarif comprend-il les relances SMS ?",
        thread: [ { who:'out', t:'10:59', msg:"La grille part de 39 € par mois selon le volume." },
                  { who:'in',  t:'11:12', msg:"Le tarif comprend-il les relances SMS ?" } ] }
    ],

    /* --- Vue 4 : ce qui remonte à l'humain --- */
    todo: [
      { who: 'Antoine Rey — Rey & Associés', why: 'Demande hors périmètre défini',
        q: "« Est-ce que vous gérez aussi la déclaration de TVA ? » — la question sort du périmètre convenu. Le système n'invente pas de réponse et vous la transmet.",
        actions: ['Répondre moi-même', 'Étendre le périmètre'] },
      { who: 'Sonia Berthier — Atelier Berthier', why: 'Devis supérieur au plafond',
        q: "Chiffrage automatique à 4 800 €, au-dessus du plafond de 3 000 € que vous avez fixé. Le devis est prêt mais n'a pas été envoyé.",
        actions: ['Valider et envoyer', 'Ajuster le montant'] },
      { who: 'Karim Haddad — Haddad Immobilier', why: 'Refus explicite',
        q: "Le contact a répondu « pas pour le moment ». Il est retiré des relances automatiques. Confirmez-vous la mise en liste d'exclusion ?",
        actions: ['Confirmer l’exclusion', 'Relancer dans 6 mois'] },
      { who: 'Léa Marchand — visite T3', why: 'Double réservation possible',
        q: "Le créneau de jeudi 18h30 chevauche un rendez-vous déjà présent dans l'agenda. Aucune invitation n'a été envoyée.",
        actions: ['Proposer un autre créneau', 'Maintenir malgré tout'] }
    ]
  };
  /* ==========================================================================
     FIN DE LA ZONE À MODIFIER
     ========================================================================== */

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) {
    return String(v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var initials = function (n) {
    return n.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  };

  /* ---- Navigation entre les vues ------------------------------------------ */
  var VIEWS = ['globe', 'sent', 'replies', 'todo'];
  var tabs = document.querySelectorAll('.rail__b');
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-view');
      Array.prototype.forEach.call(tabs, function (o) {
        o.setAttribute('aria-selected', o === b ? 'true' : 'false');
      });
      VIEWS.forEach(function (name) { $('v-' + name).hidden = (name !== v); });
      if (v === 'sent') drawChart();
      if (v === 'replies') drawFunnel();
    });
  });

  /* ======================= VUE 1 — VUE D'ENSEMBLE ======================= */
  var gSentCount = 0;
  var gDests = {};

  function logDeparture(city) {
    gSentCount++;
    gDests[city] = true;
    $('gSent').textContent = gSentCount;
    $('gDest').textContent = Object.keys(gDests).length;

    var row = document.createElement('div');
    row.innerHTML = '<b>' + esc(city) + '</b><span>' +
      new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</span>';
    var feed = $('gFeed');
    feed.insertBefore(row, feed.firstChild);
    while (feed.children.length > 5) feed.removeChild(feed.lastChild);
  }

  /* Le globe expose globeSend(). On l'appelle pour le bouton, et on écoute
     l'événement qu'il émet pour tenir le compteur à jour. */
  document.addEventListener('globe:send', function (e) { logDeparture(e.detail.city); });
  var trigger = $('gTrigger');
  if (trigger) trigger.addEventListener('click', function () {
    if (window.globeSend) window.globeSend();
  });

  /* ============================ VUE 2 — ENVOIS ============================ */
  function kpiHtml(k) {
    return '<div class="kpi"><div class="kpi__l">' + esc(k.label) + '</div>' +
      '<div class="kpi__v">' + esc(k.value) + '</div>' +
      '<div class="kpi__d' + (k.flat ? ' kpi__d--flat' : '') + '">' + esc(k.delta) + '</div></div>';
  }
  $('sentKpis').innerHTML = DEMO_CONFIG.sentKpis.map(kpiHtml).join('');
  $('repKpis').innerHTML = DEMO_CONFIG.repKpis.map(kpiHtml).join('');

  var chartDrawn = false;
  function drawChart() {
    var max = Math.max.apply(null, DEMO_CONFIG.week.map(function (d) { return d.n; }));
    if (!chartDrawn) {
      $('sentChart').innerHTML = DEMO_CONFIG.week.map(function (d) {
        return '<div class="bar"><div class="bar__f" data-h="' + Math.round((d.n / max) * 100) +
          '"></div><span class="bar__l">' + esc(d.d) + '</span></div>';
      }).join('');
      $('sentTotal').textContent = DEMO_CONFIG.week.reduce(function (a, d) { return a + d.n; }, 0);
      chartDrawn = true;
    }
    // Les barres montent après insertion : une transition ne part pas de rien.
    requestAnimationFrame(function () {
      Array.prototype.forEach.call($('sentChart').querySelectorAll('.bar__f'), function (f) {
        f.style.height = f.getAttribute('data-h') + '%';
      });
    });
  }

  var sentChan = 'all';
  function renderSent() {
    var list = DEMO_CONFIG.sent.filter(function (m) { return sentChan === 'all' || m.chan === sentChan; });
    $('sentList').innerHTML = list.length ? list.map(function (m) {
      return '<div class="row"><span class="row__av">' + initials(m.name) + '</span>' +
        '<span class="row__main"><span class="row__n">' + esc(m.name) + '</span>' +
        '<span class="row__m">' + esc(m.org) + ' — ' + esc(m.kind) + '</span></span>' +
        '<span class="row__meta">' + esc(m.chan) + '<br>' + esc(m.at) + '</span></div>';
    }).join('') : '<p class="ds-muted" style="padding:var(--sp-8) 0;font-size:var(--t-sm)">Aucun message sur ce canal.</p>';
  }
  Array.prototype.forEach.call($('sentFilter').querySelectorAll('.ds-seg__b'), function (b) {
    b.addEventListener('click', function () {
      sentChan = b.getAttribute('data-chan');
      Array.prototype.forEach.call($('sentFilter').querySelectorAll('.ds-seg__b'), function (o) {
        o.setAttribute('aria-selected', o === b ? 'true' : 'false');
      });
      renderSent();
    });
  });
  renderSent();

  /* =========================== VUE 3 — RÉPONSES =========================== */
  var funnelDrawn = false;
  function drawFunnel() {
    var top = DEMO_CONFIG.funnel[0].n;
    if (!funnelDrawn) {
      $('funnel').innerHTML = DEMO_CONFIG.funnel.map(function (f) {
        var pct = Math.round((f.n / top) * 100);
        return '<div class="fn"><span class="fn__l">' + esc(f.l) + '</span>' +
          '<span class="fn__track"><span class="fn__fill" data-w="' + pct + '"></span></span>' +
          '<span class="fn__v">' + f.n + ' · ' + pct + '&nbsp;%</span></div>';
      }).join('');
      funnelDrawn = true;
    }
    requestAnimationFrame(function () {
      Array.prototype.forEach.call($('funnel').querySelectorAll('.fn__fill'), function (f) {
        f.style.width = f.getAttribute('data-w') + '%';
      });
    });
  }

  var repKind = 'all';
  function renderReplies() {
    var list = DEMO_CONFIG.replies.filter(function (r) { return repKind === 'all' || r.kind === repKind; });
    $('repList').innerHTML = list.length ? list.map(function (r, i) {
      var tone = r.kind === 'Refus' ? '' : ' ds-tag--ok';
      return '<div class="row"><span class="row__av">' + initials(r.name) + '</span>' +
        '<span class="row__main"><span class="row__n">' + esc(r.name) +
        ' <span class="ds-tag' + tone + '" style="margin-left:6px">' + esc(r.kind) + '</span></span>' +
        '<span class="row__m">' + esc(r.msg) + '</span></span>' +
        '<span class="row__meta">' + esc(r.at) + '</span>' +
        '<span class="row__act"><button class="ds-btn ds-btn--ghost" type="button" data-rep="' + i +
        '" style="padding:.5rem 1rem;font-size:var(--t-xs)">Voir</button></span></div>';
    }).join('') : '<p class="ds-muted" style="padding:var(--sp-8) 0;font-size:var(--t-sm)">Aucune réponse de ce type.</p>';

    Array.prototype.forEach.call($('repList').querySelectorAll('[data-rep]'), function (btn) {
      btn.addEventListener('click', function () {
        openThread(list[parseInt(btn.getAttribute('data-rep'), 10)]);
      });
    });
  }
  Array.prototype.forEach.call($('repFilter').querySelectorAll('.ds-seg__b'), function (b) {
    b.addEventListener('click', function () {
      repKind = b.getAttribute('data-kind');
      Array.prototype.forEach.call($('repFilter').querySelectorAll('.ds-seg__b'), function (o) {
        o.setAttribute('aria-selected', o === b ? 'true' : 'false');
      });
      renderReplies();
    });
  });
  renderReplies();

  /* ---- Modale de conversation, partagée ---------------------------------- */
  var modal = $('modal'), lastFocus = null;
  function openThread(r) {
    if (!r) return;
    lastFocus = document.activeElement;
    $('mAv').textContent = initials(r.name);
    $('mTitle').textContent = r.name;
    $('mOrg').textContent = r.kind;
    $('mThread').innerHTML = r.thread.map(function (m) {
      var out = m.who === 'out';
      return '<div style="display:flex;justify-content:' + (out ? 'flex-end' : 'flex-start') + '">' +
        '<div style="max-width:88%"><div class="ds-meta"><span>' +
        (out ? 'Envoyé automatiquement' : esc(r.name)) + '</span><span>' + esc(m.t) + '</span></div>' +
        '<div class="ds-bubble ds-bubble--' + (out ? 'out' : 'in') + '">' + esc(m.msg) + '</div>' +
        '</div></div>';
    }).join('');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('mClose').focus();
    document.addEventListener('keydown', onKey);
  }
  function closeThread() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') closeThread(); }
  $('mClose').addEventListener('click', closeThread);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeThread(); });

  /* =========================== VUE 4 — À VALIDER =========================== */
  function renderTodo() {
    $('todoList').innerHTML = DEMO_CONFIG.todo.map(function (t, i) {
      return '<article class="todo__c" data-todo="' + i + '">' +
        '<div class="todo__h"><span class="todo__id"><span class="todo__t">' + esc(t.who) + '</span>' +
        '<span class="todo__w">' + esc(t.why) + '</span></span>' +
        '<span class="ds-tag">En attente</span></div>' +
        '<div class="todo__q">' + esc(t.q) + '</div>' +
        '<div class="todo__a">' +
        t.actions.map(function (a, k) {
          return '<button class="ds-btn ds-btn--' + (k === 0 ? 'solid' : 'ghost') + '" type="button">' + esc(a) + '</button>';
        }).join('') +
        '<button class="ds-btn ds-btn--ghost" type="button">Ignorer</button>' +
        '</div></article>';
    }).join('');
    $('todoEmpty').hidden = true;

    Array.prototype.forEach.call($('todoList').querySelectorAll('.todo__c'), function (card) {
      Array.prototype.forEach.call(card.querySelectorAll('.ds-btn'), function (btn) {
        btn.addEventListener('click', function () {
          // Démonstration : l'action est acquittée visuellement, rien n'est envoyé.
          card.querySelector('.ds-tag').outerHTML = '<span class="todo__done">' + esc(btn.textContent) + ' ✓</span>';
          card.querySelector('.todo__a').remove();
          setTimeout(function () {
            card.classList.add('is-done');
            setTimeout(function () {
              card.remove();
              if (!$('todoList').children.length) $('todoEmpty').hidden = false;
            }, reduced ? 0 : 360);
          }, reduced ? 0 : 700);
        });
      });
    });
  }
  $('todoReset').addEventListener('click', renderTodo);
  renderTodo();
})();
