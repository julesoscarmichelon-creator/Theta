/* ============================================================================
   GLOBE DE DIFFUSION — Michelon & Co
   ----------------------------------------------------------------------------
   Sphère en matrice de points, rendue en Canvas 2D. Chaque envoi part du hub
   vers une destination le long d'un arc de grand cercle ; la destination
   s'allume à l'arrivée.

   Comme pour la vague du site, pas de WebGL : on projette N points par frame,
   coût identique, sans dépendance. Le rendu est groupé par paliers de
   profondeur pour limiter les changements d'état.
   ========================================================================== */
(function () {
  'use strict';

  var cvs = document.getElementById('globe');
  if (!cvs) return;
  var ctx = cvs.getContext('2d');
  if (!ctx) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Le hub et les destinations. Coordonnées réelles, pour que la répartition
     sur la sphère soit crédible. */
  var HUB = { name: 'Marseille', lat: 43.3, lon: 5.4 };
  var CITIES = [
    { name: 'Paris',      lat: 48.9, lon: 2.4 },
    { name: 'Lyon',       lat: 45.8, lon: 4.8 },
    { name: 'Bruxelles',  lat: 50.8, lon: 4.4 },
    { name: 'Genève',     lat: 46.2, lon: 6.1 },
    { name: 'Madrid',     lat: 40.4, lon: -3.7 },
    { name: 'Milan',      lat: 45.5, lon: 9.2 },
    { name: 'Londres',    lat: 51.5, lon: -0.1 },
    { name: 'Berlin',     lat: 52.5, lon: 13.4 },
    { name: 'Lisbonne',   lat: 38.7, lon: -9.1 },
    { name: 'Casablanca', lat: 33.6, lon: -7.6 },
    { name: 'Stockholm',  lat: 59.3, lon: 18.1 },
    { name: 'Varsovie',   lat: 52.2, lon: 21.0 },
    { name: 'Tunis',      lat: 36.8, lon: 10.2 },
    { name: 'Montréal',   lat: 45.5, lon: -73.6 },
    { name: 'Toronto',    lat: 43.7, lon: -79.4 },
    { name: 'Dakar',      lat: 14.7, lon: -17.4 },
    { name: 'Abidjan',    lat: 5.4,  lon: -4.0 },
    { name: 'New York',   lat: 40.7, lon: -74.0 },
    { name: 'São Paulo',  lat: -23.6, lon: -46.6 },
    { name: 'Le Cap',     lat: -33.9, lon: 18.4 },
    { name: 'Dubaï',      lat: 25.2, lon: 55.3 }
  ];

  var W = 0, H = 0, R = 0, DPR = 1, cx = 0, cy = 0;
  var dots = [];          // matrice de points de la sphère
  var arcs = [];          // envois en vol
  var rot = -0.25;         // rotation courante autour de l'axe polaire
  var TILT = 0.38;        // inclinaison, pour ne pas voir la sphère par l'équateur
  var raf = null;
  var bucket = [[], [], [], [], [], []];   // paliers de profondeur, réutilisés

  var D2R = Math.PI / 180;

  /* ---- Matrice de points ---------------------------------------------------
     Le pas en longitude est corrigé par cos(lat) : sans ça les points
     s'entassent aux pôles et se raréfient à l'équateur. */
  function buildDots() {
    dots = [];
    var step = W < 900 ? 4.6 : 3.4;
    for (var lat = -84; lat <= 84; lat += step) {
      var circumference = Math.cos(lat * D2R);
      var n = Math.max(6, Math.round((360 / step) * circumference));
      for (var i = 0; i < n; i++) {
        var lon = -180 + (360 / n) * i;
        dots.push({ la: lat * D2R, lo: lon * D2R });
      }
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = cvs.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * DPR));
    H = Math.max(1, Math.round(r.height * DPR));
    cvs.width = W; cvs.height = H;
    cx = W / 2; cy = H / 2;
    R = Math.min(W, H) * 0.42;
    buildDots();
  }

  /* Projette une position géographique en coordonnées écran.
     Renvoie z pour savoir si le point est sur la face visible. */
  function project(la, lo, lift) {
    var rr = R * (lift || 1);
    var x = Math.cos(la) * Math.sin(lo + rot);
    var y = Math.sin(la);
    var z = Math.cos(la) * Math.cos(lo + rot);
    // inclinaison autour de l'axe horizontal
    var y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
    var z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
    return { x: cx + x * rr, y: cy - y2 * rr, z: z2 };
  }

  /* ---- Envois -------------------------------------------------------------- */
  function launch() {
    var c = CITIES[Math.floor(Math.random() * CITIES.length)];
    arcs.push({ to: c, t: 0, speed: 0.011 + Math.random() * 0.006, glow: 0 });
    if (arcs.length > 7) arcs.shift();
    // La vue tient le compteur et le journal : elle écoute cet événement.
    document.dispatchEvent(new CustomEvent('globe:send', { detail: { city: c.name } }));
  }

  /* Interpolation sphérique entre deux points : donne un vrai arc de grand
     cercle, pas une corde qui traverserait la planète. */
  function slerp(a, b, t) {
    var ax = Math.cos(a.la) * Math.cos(a.lo), ay = Math.sin(a.la), az = Math.cos(a.la) * Math.sin(a.lo);
    var bx = Math.cos(b.la) * Math.cos(b.lo), by = Math.sin(b.la), bz = Math.cos(b.la) * Math.sin(b.lo);
    var dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
    var om = Math.acos(dot);
    if (om < 1e-4) return a;
    var s = Math.sin(om);
    var k0 = Math.sin((1 - t) * om) / s, k1 = Math.sin(t * om) / s;
    var x = ax * k0 + bx * k1, y = ay * k0 + by * k1, z = az * k0 + bz * k1;
    var len = Math.sqrt(x * x + y * y + z * z);
    return { la: Math.asin(y / len), lo: Math.atan2(z / len, x / len) };
  }

  var hubRad = { la: HUB.lat * D2R, lo: HUB.lon * D2R };

  function frame() {
    ctx.clearRect(0, 0, W, H);

    /* --- disque de fond, très pâle : donne du corps à la sphère --- */
    var g = ctx.createRadialGradient(cx - R * .32, cy - R * .38, R * .06, cx, cy, R * 1.02);
    g.addColorStop(0, 'rgba(219,234,254,.95)');   // pole eclaire, haut-gauche
    g.addColorStop(.55, 'rgba(226,232,240,.65)');
    g.addColorStop(1, 'rgba(148,163,184,.30)');   // limbe assombri
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();

    /* --- matrice de points, six paliers de profondeur --- */
    var L = 6;
    for (var b = 0; b < L; b++) bucket[b].length = 0;
    for (var i = 0; i < dots.length; i++) {
      var p = project(dots[i].la, dots[i].lo);
      if (p.z <= 0.015) continue;                    // face cachée
      var lv = (p.z * L) | 0; if (lv > L - 1) lv = L - 1;
      bucket[lv].push(p.x, p.y);
    }
    for (var s6 = 0; s6 < L; s6++) {
      var arr = bucket[s6];
      if (!arr.length) continue;
      var k = s6 / (L - 1);                          // 0 = limbe, 1 = centre
      ctx.fillStyle = 'rgba(15,23,42,' + (0.16 + 0.52 * k).toFixed(3) + ')';
      var sz = (1.25 + 1.45 * k) * DPR;
      for (var q6 = 0; q6 < arr.length; q6 += 2) ctx.fillRect(arr[q6], arr[q6 + 1], sz, sz);
    }

    /* Liseré sur le limbe : sans lui, la sphère se confond avec le fond. */
    ctx.strokeStyle = 'rgba(15,23,42,.16)';
    ctx.lineWidth = 1 * DPR;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

    /* --- arcs en vol --- */
    for (var a = arcs.length - 1; a >= 0; a--) {
      var arc = arcs[a];
      var dst = { la: arc.to.lat * D2R, lo: arc.to.lon * D2R };

      ctx.beginPath();
      var started = false, headX = 0, headY = 0, headVisible = false;
      var SEG = 44;
      var upTo = Math.min(1, arc.t);
      for (var k = 0; k <= SEG; k++) {
        var t = (k / SEG) * upTo;
        var m = slerp(hubRad, dst, t);
        var lift = 1 + 0.17 * Math.sin(Math.PI * t);   // l'arc s'élève puis redescend
        var pp = project(m.la, m.lo, lift);
        if (pp.z <= 0.02) { started = false; continue; }
        if (!started) { ctx.moveTo(pp.x, pp.y); started = true; }
        else ctx.lineTo(pp.x, pp.y);
        if (k === SEG) { headX = pp.x; headY = pp.y; headVisible = true; }
      }
      ctx.strokeStyle = 'rgba(37,99,235,.80)';
      ctx.lineWidth = 1.9 * DPR;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (headVisible && arc.t < 1) {
        ctx.fillStyle = 'rgba(59,130,246,.22)';
        ctx.beginPath(); ctx.arc(headX, headY, 7 * DPR, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#2563EB';
        ctx.beginPath(); ctx.arc(headX, headY, 3 * DPR, 0, 6.2832); ctx.fill();
      }

      arc.t += arc.speed;
      if (arc.t >= 1) { arc.glow = Math.min(1, arc.glow + 0.03); }
      if (arc.t > 2.4) arcs.splice(a, 1);
    }

    /* --- points de destination : halo qui s'allume à l'arrivée --- */
    for (var c = 0; c < CITIES.length; c++) {
      var city = CITIES[c];
      var cp = project(city.lat * D2R, city.lon * D2R);
      if (cp.z <= 0.02) continue;

      var live = 0;
      for (var q = 0; q < arcs.length; q++)
        if (arcs[q].to === city) live = Math.max(live, arcs[q].glow * Math.max(0, 1 - (arcs[q].t - 1) / 1.4));

      if (live > 0.01) {
        ctx.fillStyle = 'rgba(59,130,246,' + (0.20 * live).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cp.x, cp.y, (6 + 11 * live) * DPR, 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(cp.x, cp.y, (4 + 1.3 * live) * DPR, 0, 6.2832); ctx.fill();
      ctx.fillStyle = live > 0.01 ? '#2563EB' : 'rgba(30,41,59,.62)';
      ctx.beginPath(); ctx.arc(cp.x, cp.y, (2.1 + 1.3 * live) * DPR, 0, 6.2832); ctx.fill();
    }

    /* --- le hub, toujours marqué --- */
    var hp = project(hubRad.la, hubRad.lo);
    if (hp.z > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 7 * DPR, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,.65)';
      ctx.lineWidth = 1.4 * DPR;
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 5.5 * DPR, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 2.6 * DPR, 0, 6.2832); ctx.fill();
    }

    rot += 0.0016;
    raf = requestAnimationFrame(frame);
  }

  function still() { rot = -0.5; frame(); cancelAnimationFrame(raf); raf = null; }

  window.addEventListener('resize', function () { resize(); if (reduced) still(); }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (reduced) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) raf = requestAnimationFrame(frame);
  });

  resize();
  if (reduced) { arcs = []; still(); }
  else {
    raf = requestAnimationFrame(frame);
    setTimeout(function () { launch(); setInterval(launch, 1700); }, 350);
  }

  /* Exposé pour que la vue puisse déclencher un envoi à la demande. */
  window.globeSend = launch;
})();
