/* ============================================================================
   CARTE D'ACTIVITÉ — Michelon & Co
   ----------------------------------------------------------------------------
   Une carte stylisée posée sur une sphère, rendue en Canvas 2D.

   Trois principes :
   1. Rien ne tourne tout seul. La carte reste où l'utilisateur l'a laissée ;
      elle pivote uniquement pendant un glisser-déposer.
   2. Les continents sont suggérés, pas décrits : contours très simplifiés,
      remplis d'une trame de points. Aucune frontière de pays.
   3. Chaque zone d'activité est un point bleu clair. Il fonce à chaque envoi :
      au fil de la séance, la carte se lit comme une carte de chaleur.

   Comme pour la vague du site, pas de WebGL et pas de dépendance.
   ========================================================================== */
(function () {
  'use strict';

  var cvs = document.getElementById('globe');
  if (!cvs) return;
  var ctx = cvs.getContext('2d');
  if (!ctx) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D2R = Math.PI / 180;

  /* ---- Contours de continents ---------------------------------------------
     Volontairement grossiers : une dizaine de sommets par masse. On cherche la
     silhouette reconnaissable, pas la géographie. Aucun contour ne franchit
     l'antiméridien, ce qui évite tout cas particulier de projection. */
  var LANDS = [
    /* Europe */
    [[-9,36],[-9,44],[-4,44],[-2,48],[2,51],[6,53],[9,57],[12,59],[18,60],[25,61],[31,60],
     [38,57],[41,49],[36,45],[29,45],[26,41],[22,40],[17,42],[13,45],[8,44],[3,42],[-2,37]],
    /* Afrique */
    [[-17,14],[-16,22],[-6,31],[0,35],[11,37],[25,32],[34,30],[37,21],[43,12],[51,11],[48,2],
     [41,-3],[40,-12],[35,-20],[32,-26],[27,-33],[20,-35],[15,-27],[12,-17],[13,-8],[9,4],
     [3,6],[-5,5],[-12,8]],
    /* Asie */
    [[41,49],[50,55],[60,58],[70,63],[80,68],[95,72],[110,74],[125,73],[140,70],[160,68],
     [175,65],[178,62],[168,58],[158,54],[148,45],[140,36],[130,35],[122,30],[120,22],
     [110,20],[105,10],[100,5],[96,15],[90,21],[80,9],[73,20],[68,23],[60,25],[52,28],
     [46,35],[41,41]],
    /* Amérique du Nord */
    [[-168,65],[-160,70],[-140,70],[-125,70],[-110,68],[-95,68],[-85,70],[-75,75],[-60,70],
     [-55,52],[-65,45],[-70,42],[-75,35],[-81,25],[-90,29],[-97,26],[-105,22],[-110,24],
     [-115,32],[-124,40],[-130,54],[-140,60],[-150,60],[-160,58]],
    /* Amérique centrale */
    [[-97,26],[-92,17],[-84,10],[-77,8],[-83,15],[-88,21],[-93,22]],
    /* Amérique du Sud */
    [[-77,8],[-72,11],[-62,10],[-52,5],[-45,-2],[-38,-6],[-35,-9],[-39,-16],[-44,-23],
     [-48,-27],[-55,-35],[-58,-39],[-63,-42],[-67,-46],[-68,-52],[-73,-53],[-72,-45],
     [-73,-37],[-71,-30],[-70,-20],[-74,-12],[-79,-5],[-80,0]],
    /* Océanie */
    [[113,-22],[114,-27],[118,-34],[125,-32],[132,-31],[138,-35],[145,-38],[150,-37],
     [153,-28],[147,-19],[142,-11],[136,-12],[130,-11],[125,-14],[118,-19]],
    /* Groenland */
    [[-45,60],[-52,68],[-58,75],[-45,82],[-30,82],[-22,74],[-30,68],[-38,63]],
    /* Japon */
    [[130,32],[136,35],[141,40],[145,44],[142,38],[137,34],[133,31]],
    /* Madagascar */
    [[44,-12],[50,-16],[48,-24],[44,-22],[43,-17]]
  ];

  /* Boîtes englobantes : le test d'appartenance est appelé plusieurs milliers
     de fois par construction de trame, autant l'écourter tôt. */
  var BOXES = LANDS.map(function (poly) {
    var b = { x0: 180, x1: -180, y0: 90, y1: -90 };
    for (var i = 0; i < poly.length; i++) {
      if (poly[i][0] < b.x0) b.x0 = poly[i][0];
      if (poly[i][0] > b.x1) b.x1 = poly[i][0];
      if (poly[i][1] < b.y0) b.y0 = poly[i][1];
      if (poly[i][1] > b.y1) b.y1 = poly[i][1];
    }
    return b;
  });

  /* Contours densifiés : entre deux sommets, la sphère courbe la ligne droite.
     On interpole donc en lon/lat pour que le remplissage épouse le globe. */
  var LANDS_FINE = LANDS.map(function (poly) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var d = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      var n = Math.max(1, Math.ceil(d / 4));
      for (var k = 0; k < n; k++) {
        var t = k / n;
        out.push([(a[0] + (b[0] - a[0]) * t) * D2R, (a[1] + (b[1] - a[1]) * t) * D2R]);
      }
    }
    return out;
  });

  function onLand(lon, lat) {
    for (var p = 0; p < LANDS.length; p++) {
      var b = BOXES[p];
      if (lon < b.x0 || lon > b.x1 || lat < b.y0 || lat > b.y1) continue;
      var poly = LANDS[p], inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  /* ---- Le hub et les zones d'activité --------------------------------------
     Une zone n'est pas une ville : c'est un bassin d'activité. Le poids règle
     la fréquence des envois, pour que la carte de chaleur se construise là où
     l'activité est réellement la plus dense. */
  var HUB = { name: 'Marseille', lat: 43.3, lon: 5.4 };
  var ZONES = [
    { name: 'Provence',            lat: 43.7,  lon: 5.6,   w: 9 },
    { name: 'Île-de-France',       lat: 48.9,  lon: 2.4,   w: 8 },
    { name: 'Rhône-Alpes',         lat: 45.8,  lon: 4.8,   w: 7 },
    { name: 'Occitanie',           lat: 43.6,  lon: 1.5,   w: 5 },
    { name: 'Nouvelle-Aquitaine',  lat: 44.9,  lon: -0.6,  w: 4 },
    { name: 'Grand Ouest',         lat: 47.5,  lon: -1.6,  w: 4 },
    { name: 'Grand Est',           lat: 48.6,  lon: 7.2,   w: 3 },
    { name: 'Benelux',             lat: 50.8,  lon: 4.4,   w: 3 },
    { name: 'Suisse romande',      lat: 46.3,  lon: 6.2,   w: 3 },
    { name: 'Nord de l’Italie', lat: 45.5, lon: 9.2,  w: 3 },
    { name: 'Catalogne',           lat: 41.5,  lon: 2.1,   w: 3 },
    { name: 'Madrid',              lat: 40.4,  lon: -3.7,  w: 2 },
    { name: 'Portugal',            lat: 38.8,  lon: -9.0,  w: 2 },
    { name: 'Îles Britanniques',   lat: 51.6,  lon: -1.0,  w: 3 },
    { name: 'Allemagne',           lat: 52.3,  lon: 13.0,  w: 3 },
    { name: 'Scandinavie',         lat: 59.2,  lon: 17.6,  w: 2 },
    { name: 'Europe centrale',     lat: 52.0,  lon: 20.6,  w: 2 },
    { name: 'Maghreb',             lat: 36.6,  lon: 8.5,   w: 2 },
    { name: 'Maroc',               lat: 33.4,  lon: -7.2,  w: 2 },
    { name: 'Afrique de l’Ouest', lat: 13.8, lon: -15.5, w: 2 },
    { name: 'Golfe de Guinée',     lat: 6.0,   lon: -3.5,  w: 1 },
    { name: 'Québec',              lat: 46.2,  lon: -72.0, w: 2 },
    { name: 'Grands Lacs',         lat: 43.4,  lon: -79.0, w: 1 },
    { name: 'Côte Est US',         lat: 40.4,  lon: -76.0, w: 2 },
    { name: 'Brésil',              lat: -22.4, lon: -45.0, w: 1 },
    { name: 'Afrique australe',    lat: -29.0, lon: 25.0,  w: 1 },
    { name: 'Golfe',               lat: 24.6,  lon: 52.0,  w: 1 },
    { name: 'Asie du Sud',         lat: 24.0,  lon: 78.0,  w: 1 },
    { name: 'Asie de l’Est',  lat: 31.5,  lon: 118.0, w: 1 },
    { name: 'Australie',           lat: -32.5, lon: 148.0, w: 1 }
  ];
  ZONES.forEach(function (z) { z.count = 0; z.pulse = 0; });

  var PICK = [];
  ZONES.forEach(function (z, i) { for (var k = 0; k < z.w; k++) PICK.push(i); });

  var W = 0, H = 0, R = 0, DPR = 1, cx = 0, cy = 0;
  var landDots = [];
  var arcs = [];
  var rot = -0.10;        /* orientation courante : l'Europe face à l'écran */
  var tilt = 0.34;        /* inclinaison : on ne regarde pas par l'équateur */
  var raf = null;
  var bucket = [[], [], [], [], [], []];

  /* ---- Trame de points sur les terres --------------------------------------
     Le pas en longitude est corrigé par cos(lat) : sans ça les points
     s'entassent aux pôles et se raréfient à l'équateur. */
  function buildDots() {
    landDots = [];
    var step = W < 900 ? 3.4 : 2.6;
    for (var lat = -56; lat <= 84; lat += step) {
      var circumference = Math.cos(lat * D2R);
      var n = Math.max(6, Math.round((360 / step) * circumference));
      for (var i = 0; i < n; i++) {
        var lon = -180 + (360 / n) * i;
        if (onLand(lon, lat)) landDots.push({ la: lat * D2R, lo: lon * D2R });
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
    var y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    var z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    return { x: cx + x * rr, y: cy - y2 * rr, z: z2 };
  }

  /* ---- Envois --------------------------------------------------------------
     Un envoi part du hub vers une zone. À l'arrivée, le compteur de la zone
     monte d'un cran : c'est lui, et lui seul, qui règle la teinte du point. */
  function launch(zone) {
    var z = zone || ZONES[PICK[Math.floor(Math.random() * PICK.length)]];
    arcs.push({ to: z, t: 0, speed: 0.011 + Math.random() * 0.006, landed: false });
    if (arcs.length > 7) arcs.shift();
    ensureLoop();
    return z;
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

  /* ---- Échelle de chaleur --------------------------------------------------
     Du bleu clair (zone connue, aucun envoi) au bleu profond (zone saturée).
     L'échelle est logarithmique : les premiers envois se voient tout de suite,
     et une zone très active continue de se distinguer sans jamais saturer. */
  var HEAT_LO = [147, 197, 253];   /* #93C5FD */
  var HEAT_HI = [23, 46, 138];     /* bleu profond, dans la lignée de #1D4ED8 */

  function heat(count) {
    if (count <= 0) return 0;
    return Math.min(1, Math.log(1 + count) / Math.log(1 + 14));
  }
  function heatColor(t, alpha) {
    var r = Math.round(HEAT_LO[0] + (HEAT_HI[0] - HEAT_LO[0]) * t);
    var g = Math.round(HEAT_LO[1] + (HEAT_HI[1] - HEAT_LO[1]) * t);
    var b = Math.round(HEAT_LO[2] + (HEAT_HI[2] - HEAT_LO[2]) * t);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha === undefined ? 1 : alpha) + ')';
  }

  /* ---- Rendu --------------------------------------------------------------- */
  function drawLandMass(poly) {
    var anyFront = false;
    for (var i = 0; i < poly.length; i++) {
      if (project(poly[i][1], poly[i][0]).z > 0) { anyFront = true; break; }
    }
    if (!anyFront) return;

    ctx.beginPath();
    for (var k = 0; k < poly.length; k++) {
      var p = project(poly[k][1], poly[k][0]);
      /* Sommet passé derrière : on le rabat sur le limbe, la silhouette reste
         close et le remplissage ne déborde pas de la sphère. */
      if (p.z <= 0) {
        var dx = p.x - cx, dy = p.y - cy;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        p = { x: cx + (dx / d) * R, y: cy + (dy / d) * R };
      }
      if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);

    /* --- disque de fond, très pâle : donne du corps à la sphère --- */
    var g = ctx.createRadialGradient(cx - R * .32, cy - R * .38, R * .06, cx, cy, R * 1.02);
    g.addColorStop(0, 'rgba(241,245,249,.95)');
    g.addColorStop(.55, 'rgba(226,232,240,.62)');
    g.addColorStop(1, 'rgba(148,163,184,.28)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();

    /* --- masses continentales, aplat très doux --- */
    ctx.fillStyle = 'rgba(15,23,42,.10)';
    for (var m = 0; m < LANDS_FINE.length; m++) drawLandMass(LANDS_FINE[m]);

    /* --- trame de points sur les terres, six paliers de profondeur --- */
    var L = 6;
    for (var b = 0; b < L; b++) bucket[b].length = 0;
    for (var i = 0; i < landDots.length; i++) {
      var p = project(landDots[i].la, landDots[i].lo);
      if (p.z <= 0.015) continue;
      var lv = (p.z * L) | 0; if (lv > L - 1) lv = L - 1;
      bucket[lv].push(p.x, p.y);
    }
    for (var s6 = 0; s6 < L; s6++) {
      var arr = bucket[s6];
      if (!arr.length) continue;
      var k6 = s6 / (L - 1);                         /* 0 = limbe, 1 = centre */
      ctx.fillStyle = 'rgba(15,23,42,' + (0.14 + 0.46 * k6).toFixed(3) + ')';
      var sz = (1.1 + 1.25 * k6) * DPR;
      for (var q6 = 0; q6 < arr.length; q6 += 2) ctx.fillRect(arr[q6], arr[q6 + 1], sz, sz);
    }

    /* Liseré sur le limbe : sans lui, la sphère se confond avec le fond. */
    ctx.strokeStyle = 'rgba(15,23,42,.16)';
    ctx.lineWidth = 1 * DPR;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

    /* --- envois en vol --- */
    for (var a = arcs.length - 1; a >= 0; a--) {
      var arc = arcs[a];
      var dst = { la: arc.to.lat * D2R, lo: arc.to.lon * D2R };

      ctx.beginPath();
      var started = false, headX = 0, headY = 0, headVisible = false;
      var SEG = 44;
      var upTo = Math.min(1, arc.t);
      for (var s = 0; s <= SEG; s++) {
        var t = (s / SEG) * upTo;
        var mid = slerp(hubRad, dst, t);
        var lift = 1 + 0.17 * Math.sin(Math.PI * t);
        var pp = project(mid.la, mid.lo, lift);
        if (pp.z <= 0.02) { started = false; continue; }
        if (!started) { ctx.moveTo(pp.x, pp.y); started = true; }
        else ctx.lineTo(pp.x, pp.y);
        if (s === SEG) { headX = pp.x; headY = pp.y; headVisible = true; }
      }
      ctx.strokeStyle = 'rgba(37,99,235,.72)';
      ctx.lineWidth = 1.7 * DPR;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (headVisible && arc.t < 1) {
        ctx.fillStyle = 'rgba(59,130,246,.22)';
        ctx.beginPath(); ctx.arc(headX, headY, 7 * DPR, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#2563EB';
        ctx.beginPath(); ctx.arc(headX, headY, 3 * DPR, 0, 6.2832); ctx.fill();
      }

      arc.t += arc.speed;
      if (!arc.landed && arc.t >= 1) {
        arc.landed = true;
        arc.to.count++;
        arc.to.pulse = 1;
        /* La vue tient le compteur, le journal et la liste des zones :
           elle écoute cet événement. */
        document.dispatchEvent(new CustomEvent('globe:send', {
          detail: { zone: arc.to.name, count: arc.to.count }
        }));
      }
      if (arc.t > 1.6) arcs.splice(a, 1);
    }

    /* --- points de zone : bleu clair au repos, de plus en plus foncé --- */
    for (var c = 0; c < ZONES.length; c++) {
      var zone = ZONES[c];
      var zp = project(zone.lat * D2R, zone.lon * D2R);
      if (zp.z <= 0.02) continue;

      var t2 = heat(zone.count);
      var fade = 0.45 + 0.55 * Math.min(1, zp.z * 1.6);   /* atténué vers le limbe */
      var rad = (2.4 + 2.6 * t2) * DPR;

      if (zone.pulse > 0.01) {
        ctx.fillStyle = heatColor(t2, 0.22 * zone.pulse);
        ctx.beginPath(); ctx.arc(zp.x, zp.y, rad + 13 * zone.pulse * DPR, 0, 6.2832); ctx.fill();
        zone.pulse *= 0.94;
      }
      if (t2 > 0) {
        ctx.fillStyle = heatColor(t2, 0.16 * fade);
        ctx.beginPath(); ctx.arc(zp.x, zp.y, rad + 5 * DPR, 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * fade).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(zp.x, zp.y, rad + 1.5 * DPR, 0, 6.2832); ctx.fill();
      ctx.fillStyle = heatColor(t2, fade);
      ctx.beginPath(); ctx.arc(zp.x, zp.y, rad, 0, 6.2832); ctx.fill();
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

    /* Rien ne tourne de soi-même : la boucle ne sert qu'aux envois en vol,
       aux halos qui s'éteignent et au glisser en cours. */
    if (arcs.length || dragging || pulsing()) raf = requestAnimationFrame(frame);
    else raf = null;
  }

  function pulsing() {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].pulse > 0.01) return true;
    return false;
  }

  function ensureLoop() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  function redraw() { if (!raf) frame(); }

  /* ---- Rotation manuelle ---------------------------------------------------
     La carte est un objet qu'on prend en main : elle ne bouge que tant que le
     bouton est enfoncé, et reste ensuite exactement où on l'a laissée. */
  var dragging = false, dragId = null, sx = 0, sy = 0, sRot = 0, sTilt = 0, moved = 0;
  var TILT_MAX = 1.15;

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; dragId = e.pointerId; moved = 0;
    sx = e.clientX; sy = e.clientY; sRot = rot; sTilt = tilt;
    cvs.classList.add('is-grabbing');
    if (cvs.setPointerCapture) { try { cvs.setPointerCapture(e.pointerId); } catch (err) {} }
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging || e.pointerId !== dragId) return;
    var box = cvs.getBoundingClientRect();
    var k = Math.PI / Math.max(120, box.width * 0.85);   /* traverser la carte ≈ un demi-tour */
    var dx = e.clientX - sx, dy = e.clientY - sy;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    rot = sRot + dx * k;
    tilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, sTilt + dy * k));
    redraw();
    e.preventDefault();
  }
  function onUp(e) {
    if (!dragging || (e.pointerId !== undefined && e.pointerId !== dragId)) return;
    dragging = false; dragId = null;
    cvs.classList.remove('is-grabbing');
    redraw();
  }

  if (window.PointerEvent) {
    cvs.addEventListener('pointerdown', onDown);
    cvs.addEventListener('pointermove', onMove);
    cvs.addEventListener('pointerup', onUp);
    cvs.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
  }

  /* Au clavier : mêmes degrés de liberté, sans souris. */
  cvs.addEventListener('keydown', function (e) {
    var s = e.shiftKey ? 0.30 : 0.10, used = true;
    if (e.key === 'ArrowLeft') rot -= s;
    else if (e.key === 'ArrowRight') rot += s;
    else if (e.key === 'ArrowUp') tilt = Math.max(-TILT_MAX, tilt - s);
    else if (e.key === 'ArrowDown') tilt = Math.min(TILT_MAX, tilt + s);
    else used = false;
    if (used) { e.preventDefault(); redraw(); }
  });

  window.addEventListener('resize', function () { resize(); redraw(); }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else ensureLoop();
  });

  resize();
  frame();

  /* Les envois, eux, continuent : c'est l'activité du système, pas une
     animation décorative. En mouvement réduit, rien ne part sans un clic. */
  if (!reduced) setTimeout(function () { launch(); setInterval(launch, 1700); }, 400);

  /* Exposé pour que la vue puisse déclencher un envoi à la demande. */
  window.globeSend = function () { return launch().name; };
  window.globeZones = function () {
    return ZONES.map(function (z) { return { name: z.name, count: z.count }; });
  };
})();
