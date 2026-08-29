/* ============================================================================
   INTERACTIONS DE PAGE — Michelon & Co
   ----------------------------------------------------------------------------
   Aucune dépendance : défilement fluide, révélation au scroll, compteurs,
   glisseur de navigation et modale reposent sur des API natives.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Cascade d'entrée du héros -----------------------------------------
     Une classe sur <html> plutôt qu'un IntersectionObserver : le héros est
     déjà dans le viewport, l'observer ferait tout apparaître d'un bloc. */
  requestAnimationFrame(function () { document.documentElement.classList.add('ready'); });

  /* ---- Glisseur de la pilule de navigation -------------------------------
     Un seul fond déplacé en transform, plutôt qu'un fond par lien. */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var glider = document.getElementById('glider');
  var pill = document.getElementById('pill');

  function moveGlider(el) {
    if (!glider || !el || !pill) return;
    var a = el.getBoundingClientRect(), b = pill.getBoundingClientRect();
    glider.style.width = a.width + 'px';
    glider.style.transform = 'translateX(' + (a.left - b.left) + 'px)';
    glider.style.opacity = '1';
  }
  function hideGlider() { if (glider) glider.style.opacity = '0'; }

  links.forEach(function (l) {
    l.addEventListener('mouseenter', function () { moveGlider(l); });
    l.addEventListener('focus', function () { moveGlider(l); });
  });
  if (pill) {
    pill.addEventListener('mouseleave', hideGlider);
    pill.addEventListener('focusout', hideGlider);
  }

  /* ---- Lien actif selon la section visible -------------------------------- */
  var sections = links
    .map(function (l) { return document.querySelector(l.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---- Révélation au défilement -------------------------------------------
     rootMargin négatif : la section s'anime quand elle est franchement entrée,
     pas au premier pixel. */
  var revealables = document.querySelectorAll('.ds-reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---- Compteurs ---------------------------------------------------------- */
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var pre = el.getAttribute('data-prefix') || '';
    var suf = el.getAttribute('data-suffix') || '';
    if (reduced) { el.innerHTML = pre + target + suf; return; }

    var dur = 1400, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);           // décélération cubique
      el.innerHTML = pre + Math.round(target * eased) + suf;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  } else {
    Array.prototype.forEach.call(counters, runCount);
  }

  /* ---- Étapes du workflow : allumage séquentiel --------------------------- */
  var flow = document.getElementById('flow');
  if (flow && 'IntersectionObserver' in window) {
    var steps = flow.querySelectorAll('.flow__step');
    var fio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(steps, function (s, i) {
          setTimeout(function () { s.classList.add('is-on'); }, reduced ? 0 : i * 260);
        });
        fio.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    fio.observe(flow);
  }

  /* ---- Modale de démo ------------------------------------------------------ */
  var modal = document.getElementById('demoModal');
  var lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var first = modal.querySelector('a,button');
    if (first) first.focus();
    document.addEventListener('keydown', onKey);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') closeModal(); }

  ['openDemo', 'demoBtn'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
  });
  ['closeDemo', 'closeDemo2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', closeModal);
  });
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  /* ---- Accordéon FAQ -------------------------------------------------------
     La hauteur est animée depuis scrollHeight puis remise à auto : une
     transition sur height ne part pas depuis `auto`. */
  var accItems = document.querySelectorAll('.ds-acc__item');
  Array.prototype.forEach.call(accItems, function (item) {
    var btn = item.querySelector('.ds-acc__btn');
    var panel = item.querySelector('.ds-acc__panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        panel.style.height = panel.scrollHeight + 'px';
        panel.addEventListener('transitionend', function once() {
          panel.style.height = 'auto';
          panel.removeEventListener('transitionend', once);
        });
      } else {
        panel.style.height = panel.scrollHeight + 'px';
        requestAnimationFrame(function () { panel.style.height = '0px'; });
      }
    });
  });

  /* ---- Simulateur de tarifs ------------------------------------------------
     Les montants d'installation sont fixes ; seul le suivi mensuel suit le
     volume. Le résultat reste une estimation, dit comme tel sur la page. */
  var PACKS = {
    essentiel: {
      setup: 125, base: 39, perUnit: 0.46,
      feats: [
        "Tri et réponses automatiques des messages entrants",
        "Vérification des disponibilités d'agenda en temps réel",
        "Envoi automatique de vos documents et tarifs",
        "Relance programmée après 4 jours sans réponse",
        "Support technique et maintenance mensuelle inclus"
      ]
    },
    multicanal: {
      setup: 200, base: 79, perUnit: 0.54,
      feats: [
        "Tout ce que comprend la formule Essentiel",
        "800 SMS par mois inclus (relances, rappels, prospection)",
        "Alertes instantanées sur mobile",
        "Prise de contact multicanal e-mail et SMS",
        "Agent IA dédié sur un périmètre défini avec vous",
        "Support prioritaire"
      ]
    }
  };
  var pack = 'essentiel';
  var vol = document.getElementById('vol');
  var volLabel = document.getElementById('volLabel');
  var pSetup = document.getElementById('pSetup');
  var pMonth = document.getElementById('pMonth');
  var feats = document.getElementById('feats');
  var segs = document.querySelectorAll('.ds-seg__b');

  function renderPrice() {
    if (!vol) return;
    var n = parseInt(vol.value, 10);
    var d = PACKS[pack];
    if (volLabel) volLabel.textContent = n + ' messages / jour';
    if (pSetup) pSetup.textContent = d.setup + ' €';
    if (pMonth) pMonth.textContent = Math.round(d.base + n * d.perUnit) + ' €';
    if (feats) {
      feats.innerHTML = d.feats.map(function (f) { return '<li>' + f + '</li>'; }).join('');
    }
  }
  Array.prototype.forEach.call(segs, function (b) {
    b.addEventListener('click', function () {
      pack = b.getAttribute('data-pack');
      Array.prototype.forEach.call(segs, function (o) {
        o.setAttribute('aria-selected', o === b ? 'true' : 'false');
      });
      renderPrice();
    });
  });
  if (vol) vol.addEventListener('input', renderPrice);
  renderPrice();

})();
