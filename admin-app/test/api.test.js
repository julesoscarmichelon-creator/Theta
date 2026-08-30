'use strict';

/**
 * Test de bout en bout des quatre fonctions de `api/`, à travers le serveur
 * local. Le Redis est simulé : `fetch` est intercepté pour les seules URL
 * du magasin, les appels au serveur de test passent normalement.
 * `node test/api.test.js`
 */

var assert = require('assert');

var PORT = 3199;
var BASE = 'http://localhost:' + PORT;
var KV = 'https://faux-kv.local';

process.env.PORT = String(PORT);
process.env.ADMIN_PASSWORD = 'mot-de-passe-de-test-long';
process.env.ADMIN_SESSION_SECRET = 'c'.repeat(64);
process.env.ADMIN_COOKIE_INSECURE = 'true'; // le test tourne en http://
process.env.KV_REST_API_URL = KV;
process.env.KV_REST_API_TOKEN = 'jeton-de-test';

// --- Redis simulé -----------------------------------------------------
var realFetch = global.fetch;
var replies = [];
var kvCalls = [];

global.fetch = function (url, options) {
  if (String(url).indexOf(KV) !== 0) return realFetch(url, options);
  kvCalls.push(JSON.parse(options.body));
  var next = replies.shift();
  if (!next) return Promise.resolve({ ok: false, status: 500, text: function () { return Promise.resolve('vide'); } });
  return Promise.resolve({
    ok: true,
    status: 200,
    json: function () { return Promise.resolve(next.map(function (r) { return { result: r }; })); }
  });
};

var server = require('../server');

function call(path, options) {
  var opts = options || {};
  return realFetch(BASE + path, {
    method: opts.method || 'GET',
    headers: Object.assign(
      opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.cookie ? { Cookie: opts.cookie } : {}
    ),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  }).then(function (res) {
    return res.text().then(function (text) {
      var json = null;
      try { json = JSON.parse(text); } catch (err) { /* réponse non-JSON */ }
      return { status: res.status, json: json, text: text, headers: res.headers };
    });
  });
}

/** Extrait `theta_admin=…` d'un en-tête Set-Cookie pour le renvoyer ensuite. */
function cookieFrom(res) {
  var raw = res.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

(async function () {
  // --- Pages statiques ------------------------------------------------
  var page = await call('/');
  assert.strictEqual(page.status, 200, 'la page de connexion est servie');
  assert.match(page.text, /Administration/);
  assert.strictEqual((await call('/../package.json')).status, 404, 'pas de remontée hors de public/');

  // --- Session absente ------------------------------------------------
  var anon = await call('/api/session');
  assert.deepStrictEqual(anon.json, { authenticated: false });

  var denied = await call('/api/submissions');
  assert.strictEqual(denied.status, 401, 'la liste exige une session');
  assert.strictEqual(kvCalls.length, 0, 'aucun accès au magasin sans session');

  // --- Connexion ------------------------------------------------------
  assert.strictEqual((await call('/api/login')).status, 405, 'GET refusé sur /api/login');

  replies.push([1, 1, 900]); // compteur de tentatives
  var bad = await call('/api/login', { method: 'POST', body: { password: 'faux' } });
  assert.strictEqual(bad.status, 401);
  assert.ok(!bad.headers.get('set-cookie'), 'aucun cookie sur échec');

  replies.push([2, 0, 880]); // compteur
  replies.push([1]);         // remise à zéro (DEL)
  var good = await call('/api/login', { method: 'POST', body: { password: 'mot-de-passe-de-test-long' } });
  assert.strictEqual(good.status, 200);

  var cookie = cookieFrom(good);
  assert.match(cookie, /^theta_admin=/);
  assert.ok(good.headers.get('set-cookie').indexOf('HttpOnly') !== -1);

  // --- Blocage après trop de tentatives -------------------------------
  replies.push([11, 0, 700]);
  var blocked = await call('/api/login', { method: 'POST', body: { password: 'faux' } });
  assert.strictEqual(blocked.status, 429);
  assert.strictEqual(blocked.headers.get('retry-after'), '700');

  // --- Session ouverte ------------------------------------------------
  assert.deepStrictEqual((await call('/api/session', { cookie: cookie })).json, { authenticated: true });

  // --- Liste ----------------------------------------------------------
  kvCalls.length = 0;
  var item = { id: '1700000000000-aabbccdd', nom: 'Camille', email: 'c@exemple.fr', message: 'Bonjour' };
  replies.push([1, [item.id]]);
  replies.push([[JSON.stringify(item)]]);

  var listed = await call('/api/submissions?limit=10&offset=0', { cookie: cookie });
  assert.strictEqual(listed.status, 200);
  assert.strictEqual(listed.json.total, 1);
  assert.deepStrictEqual(listed.json.items, [item]);
  assert.strictEqual(listed.headers.get('cache-control'), 'no-store, private');
  assert.deepStrictEqual(kvCalls[0][1], ['LRANGE', 'theta:submissions', '0', '9']);

  // --- Suppression ----------------------------------------------------
  var badId = await call('/api/submissions?id=../autre', { method: 'DELETE', cookie: cookie });
  assert.strictEqual(badId.status, 400, 'un identifiant hors format est refusé');

  kvCalls.length = 0;
  replies.push([1, 1]);
  var removed = await call('/api/submissions?id=' + item.id, { method: 'DELETE', cookie: cookie });
  assert.strictEqual(removed.status, 200);
  assert.deepStrictEqual(kvCalls[0][0], ['DEL', 'theta:submission:' + item.id]);

  replies.push([0, 0]);
  assert.strictEqual((await call('/api/submissions?id=1-00000000', { method: 'DELETE', cookie: cookie })).status, 404);

  assert.strictEqual((await call('/api/submissions', { method: 'POST', cookie: cookie })).status, 405);

  // --- Magasin en panne -----------------------------------------------
  var down = await call('/api/submissions', { cookie: cookie });
  assert.strictEqual(down.status, 502, 'une panne du magasin est signalée proprement');

  // --- Déconnexion ----------------------------------------------------
  var out = await call('/api/logout', { method: 'POST', cookie: cookie });
  assert.strictEqual(out.status, 200);
  assert.ok(out.headers.get('set-cookie').indexOf('Max-Age=0') !== -1, 'le cookie est effacé');

  console.log('api.test.js : OK');
  server.close();
})().catch(function (err) {
  console.error(err);
  server.close();
  process.exit(1);
});
