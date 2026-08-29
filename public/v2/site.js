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

  /* ---- Formulaire de contact ----------------------------------------------
     Pas d'envoi câblé : le point de collecte reste à définir. On valide et on
     le dit, plutôt que de simuler un succès. */
  var form = document.getElementById('contactForm');
  var msg = document.getElementById('formMsg');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (msg) msg.textContent = 'Formulaire non encore relié à un service d’envoi.';
    });
  }
})();
