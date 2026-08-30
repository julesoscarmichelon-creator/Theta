/* ============================================================================
   VAGUE DE PARTICULES — Michelon & Co
   ----------------------------------------------------------------------------
   Un ruban paramétrique en 3D, projeté en perspective et rendu en Canvas 2D.

   Pourquoi Canvas 2D et non Three.js : la scène est un unique nuage de points
   sans éclairage, sans matériau et sans géométrie chargée. Le coût réel est la
   projection de N points par frame, identique dans les deux cas ; WebGL
   n'apporterait ici qu'une dépendance de 600 ko. Le rendu est groupé par
   paliers de couleur, ce qui ramène le nombre de changements d'état de
   plusieurs milliers à une quinzaine par frame.

   Géométrie :  u parcourt la longueur du ruban, v sa largeur.
   Le ruban vrille autour de son axe (twist), ce qui produit les pincements et
   les croisements visibles au centre. La vrille et l'ondulation sont deux
   sinusoïdes déphasées : le motif ne se répète pas à l'œil.
   ========================================================================== */
(function () {
  'use strict';

  var cvs = document.getElementById('wave');
  if (!cvs) return;
  var ctx = cvs.getContext('2d');
  if (!ctx) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1;
  var spread = 1;                        // etirement horizontal de l'ondulation
  var narrow = 0;                        // 0 = desktop, 1 = le plus etroit
  var parts = [];
  var t = 0;
  var flatten = 1;                       // 1 = pleine amplitude, 0 = aplatie
  var mx = -1e5, my = -1e5, mOn = false;
  var raf = null;

  /* Densité adaptée à la surface : un mobile ne doit pas payer le prix d'un
     écran large. */
  function targetCount() {
    var w = window.innerWidth;
    if (w < 640) return 3200;
    if (w < 1100) return 6800;
    return 11000;
  }

  function build() {
    var n = targetCount();
    parts = new Array(n);
    for (var i = 0; i < n; i++) {
      var rv = Math.random();
      var edgeBias = 0.5 + 0.5 * (rv < 0.5 ? -1 : 1) * Math.pow(Math.abs(2 * rv - 1), 0.45);
      parts[i] = {
        u: Math.random(),
        v: edgeBias,
        j: (Math.random() - 0.5) * 2,     // gigue perpendiculaire
        p: Math.random() * Math.PI * 2,   // phase propre
        r: 0.62 + Math.random() * 0.95    // rayon du point
      };
    }
  }

  /* ---- Etalement de l'ondulation sur les petites largeurs -----------------
     Les periodes du ruban sont exprimees en u, c'est-a-dire en fraction de la
     largeur : le meme nombre d'oscillations tient donc dans 390 px comme dans
     1440 px, et la vague se retrouve tassee sur telephone. On etire donc
     l'ondulation a mesure que l'ecran retrecit — moins d'oscillations, plus
     d'air entre elles.

     L'etirement ne porte que sur l'ondulation de l'axe. La vrille garde sa
     frequence : c'est elle qui produit les pincements et le grain du ruban,
     l'etaler transformerait la vague en simple bande diagonale. L'amplitude
     et la largeur du ruban se resserrent un peu en parallele, pour que la
     vague reste dans le bas du hero au lieu de remonter derriere le titre.

     A partir de 700 px le facteur vaut exactement 1 : au-dessus de cette
     largeur, le calcul est rigoureusement celui d'avant. */
  var SPREAD_MIN = 0.62;

  function narrowFor(cssWidth) {
    if (cssWidth >= 700) return 0;
    var k = (700 - cssWidth) / 380;
    return k > 1 ? 1 : k;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var r = cvs.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width  * DPR));
    H = Math.max(1, Math.round(r.height * DPR));
    cvs.width = W; cvs.height = H;
    narrow = narrowFor(r.width);
    spread = 1 - (1 - SPREAD_MIN) * narrow;
    build();
  }

  /* ---- Paliers de couleur -------------------------------------------------
     14 styles précalculés, du bleu clair (particules lointaines) à l'ardoise
     profonde (particules proches). On règle fillStyle 14 fois par frame au
     lieu d'une fois par particule. */
  var LEVELS = 14, styles = [], buckets = [];
  (function makeStyles() {
    for (var i = 0; i < LEVELS; i++) {
      var k = i / (LEVELS - 1);                 // 0 = loin, 1 = proche
      var r = Math.round(0x8F + (0x1E - 0x8F) * k);
      var g = Math.round(0xA8 + (0x29 - 0xA8) * k);
      var b = Math.round(0xC8 + (0x3B - 0xC8) * k);
      var a = (0.20 + 0.72 * k).toFixed(3);
      styles.push('rgba(' + r + ',' + g + ',' + b + ',' + a + ')');
      buckets.push([]);
    }
  })();

  function frame() {
    ctx.clearRect(0, 0, W, H);

    var cx = W * 0.5;
    /* Le ruban vit sous le titre — et descend encore sur les ecrans etroits,
       ou une crete monterait sinon jusque dans le sous-titre. */
    var cy = H * (0.70 + 0.09 * narrow);
    var ribbon = Math.min(H * 0.15, 132 * DPR) * (1 - 0.20 * narrow);
    var amp = Math.min(H * 0.16, 128 * DPR) * flatten * (1 - 0.28 * narrow);
    var focal = 780 * DPR;
    var repelR = 130 * DPR, repelR2 = repelR * repelR;

    for (var b = 0; b < LEVELS; b++) buckets[b].length = 0;

    for (var i = 0; i < parts.length; i++) {
      var P = parts[i];
      var u = P.u;

      /* Ondulation de l'axe : deux sinusoïdes de périodes non harmoniques,
         donc sans répétition perceptible. */
      var spine = Math.sin(u * 5.1 * spread + t * 0.62) * amp
                + Math.sin(u * 2.3 * spread - t * 0.41 + P.p * 0.04) * amp * 0.42;

      /* Vrille du ruban autour de son axe : source des pincements. */
      var twist = u * 9.2 + t * 0.30;

      /* Largeur variable : le ruban s'ouvre et se referme le long de u. */
      var halfW = ribbon * (0.30 + 0.70 * Math.abs(Math.sin(u * 3.4 + 0.55)));
      var rr = (P.v - 0.5) * 2 * halfW + P.j * 3.5 * DPR;

      var y3 = spine + rr * Math.cos(twist);
      var z3 = rr * Math.sin(twist);

      var persp = focal / (focal + z3);
      var px = cx + (u * W - cx) * persp;
      var py = cy + y3 * persp;

      /* Répulsion douce au pointeur : décroissance quadratique, jamais de
         saut brutal. */
      if (mOn) {
        var dx = px - mx, dy = py - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < repelR2 && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var f = (1 - d / repelR);
          f = f * f * 26 * DPR;
          px += (dx / d) * f;
          py += (dy / d) * f;
        }
      }

      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

      /* Fondu aux deux extrémités : le ruban se dissout au lieu d'être coupé.
         Plus marqué à gauche, comme sur la maquette. */
      var edge = Math.min(1, u / 0.26) * Math.min(1, (1 - u) / 0.12);
      if (edge <= 0.01) continue;

      /* Profondeur -> palier de couleur. */
      var depth = (persp - 0.72) / 0.56;
      if (depth < 0) depth = 0; else if (depth > 1) depth = 1;

      var lvl = (depth * edge * (LEVELS - 1)) | 0;
      if (lvl < 0) lvl = 0; else if (lvl > LEVELS - 1) lvl = LEVELS - 1;

      var size = P.r * persp * DPR;
      buckets[lvl].push(px, py, size);
    }

    for (var s = 0; s < LEVELS; s++) {
      var arr = buckets[s];
      if (!arr.length) continue;
      ctx.fillStyle = styles[s];
      for (var k = 0; k < arr.length; k += 3) {
        ctx.fillRect(arr[k], arr[k + 1], arr[k + 2], arr[k + 2]);
      }
    }

    t += 0.0075;
    raf = requestAnimationFrame(frame);
  }

  /* ---- Rendu figé si l'utilisateur limite les animations ------------------ */
  function still() { flatten = 1; frame(); cancelAnimationFrame(raf); raf = null; }

  /* ---- Entrées ------------------------------------------------------------ */
  window.addEventListener('resize', function () {
    resize();
    if (reduced) still();
  }, { passive: true });

  window.addEventListener('pointermove', function (e) {
    if (reduced) return;
    mx = e.clientX * DPR; my = e.clientY * DPR; mOn = true;
  }, { passive: true });

  window.addEventListener('pointerleave', function () { mOn = false; }, { passive: true });

  /* La vague s'aplatit à mesure que le héros sort du champ : elle cède la
     place au contenu au lieu de continuer à s'agiter derrière. */
  var ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        var h = window.innerHeight || 1;
        var k = 1 - Math.min(1, window.scrollY / h);
        flatten = 0.18 + 0.82 * k * k;
        ticking = false;
      });
    }
  }
  if (!reduced) window.addEventListener('scroll', onScroll, { passive: true });

  /* On suspend la boucle quand l'onglet passe en arrière-plan. */
  document.addEventListener('visibilitychange', function () {
    if (reduced) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) { raf = requestAnimationFrame(frame); }
  });

  resize();
  if (reduced) still(); else raf = requestAnimationFrame(frame);
})();
