'use strict';

/**
 * Espace privé : stockage des demandes, connexion, session, listing.
 * Le stockage utilise un fichier temporaire ; aucun réseau n'est sollicité.
 *
 *   node test/admin.test.js
 */

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { EventEmitter } = require('events');

var admin = require('../lib/admin');
var auth = require('../lib/auth');
var config = require('../lib/config');
var handler = require('../lib/handler');
var rateLimit = require('../lib/rate-limit');

var STORE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'contact-')), 'submissions.json');

var ENV = {
  MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test',
  MAIL_TO: 'contact@example.com',
  MAIL_FROM: 'Formulaire <contact@example.com>',
  ALLOWED_ORIGINS: '',
  STORE_FILE: STORE_FILE,
  ADMIN_PASSWORD: 'mot-de-passe-de-test',
  RATE_LIMIT_MAX: '100',
  ADMIN_LOGIN_MAX: '3'
};

var mailSent = [];
global.fetch = function (url, options) {
  mailSent.push(JSON.parse(options.body));
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};

function call(fn, options) {
  options = options || {};
  var req = new EventEmitter();
  req.method = options.method || 'POST';
  req.url = options.url || '/';
  req.headers = Object.assign(
    { host: 'exemple.fr', 'content-type': 'application/json', 'x-forwarded-for': options.ip || '203.0.113.30' },
    options.headers
  );
  req.body = options.body;
  req.socket = { remoteAddress: '127.0.0.1' };

  var res = {
    statusCode: 0,
    headers: {},
    setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
    end: function (body) { this.body = body ? JSON.parse(body) : null; }
  };

  return fn(req, res, Object.assign({}, ENV, options.env)).then(function () { return res; });
}

/** Extrait la valeur du cookie de session posé par une réponse. */
function cookieFrom(res) {
  var raw = res.headers['set-cookie'];
  return raw ? raw.split(';')[0] : '';
}

var tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('une demande valide est conservée et notifiée', async function () {
  mailSent.length = 0;
  var res = await call(handler.handleContact, {
    body: {
      nom: 'Jules-Oscar', email: 'client@exemple.fr', entreprise: 'ACME',
      message: 'Bonjour, je souhaite automatiser mes relances de devis.'
    },
    headers: { origin: 'https://exemple.fr', host: 'exemple.fr' }
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(mailSent.length, 1, "l'e-mail part toujours");

  var stored = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].nom, 'Jules-Oscar');
  assert.ok(stored[0].id && stored[0].date);
});

test("la demande est conservée même si l'e-mail échoue", async function () {
  var original = global.fetch;
  global.fetch = function () { return Promise.reject(new Error('Resend injoignable')); };
  try {
    var res = await call(handler.handleContact, {
      body: { nom: 'Panne', email: 'panne@exemple.fr', message: 'Le service de mail est tombé.' },
      headers: { origin: 'https://exemple.fr', host: 'exemple.fr' },
      ip: '203.0.113.31'
    });
    // Rien n'est perdu : inutile de faire recommencer le visiteur.
    assert.strictEqual(res.statusCode, 200);
    var stored = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    assert.strictEqual(stored[0].nom, 'Panne', 'la plus récente est en tête');
  } finally {
    global.fetch = original;
  }
});

test('sans session, la liste est refusée', async function () {
  var res = await call(admin.handleSubmissions, { method: 'GET', url: '/api/admin/submissions' });
  assert.strictEqual(res.statusCode, 401);
  assert.ok(!res.body.items);
});

test('un mot de passe faux est refusé', async function () {
  var res = await call(admin.handleLogin, { body: { password: 'pas-le-bon' }, ip: '203.0.113.32' });
  assert.strictEqual(res.statusCode, 401);
  assert.ok(!res.headers['set-cookie']);
});

test('le bon mot de passe ouvre une session', async function () {
  var res = await call(admin.handleLogin, { body: { password: 'mot-de-passe-de-test' }, ip: '203.0.113.33' });
  assert.strictEqual(res.statusCode, 200);
  var cookie = res.headers['set-cookie'];
  assert.ok(cookie.indexOf('HttpOnly') !== -1, 'le cookie est HttpOnly');
  assert.ok(cookie.indexOf('SameSite=Strict') !== -1);
});

test('la session donne accès aux demandes, la plus récente en tête', async function () {
  var login = await call(admin.handleLogin, { body: { password: 'mot-de-passe-de-test' }, ip: '203.0.113.34' });
  var res = await call(admin.handleSubmissions, {
    method: 'GET',
    url: '/api/admin/submissions?limit=50',
    headers: { cookie: cookieFrom(login) }
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.storage, 'file');
  assert.strictEqual(res.body.items[0].nom, 'Panne');
  assert.ok(res.body.total >= 2);
});

test('un cookie forgé est rejeté', async function () {
  var res = await call(admin.handleSubmissions, {
    method: 'GET',
    url: '/api/admin/submissions',
    headers: { cookie: auth.COOKIE_NAME + '=' + (Date.now() + 60000) + '.signature-inventee' }
  });
  assert.strictEqual(res.statusCode, 401);
});

test('un jeton expiré est rejeté', function () {
  var cfg = config.loadConfig(ENV);
  var token = auth.createToken(cfg, Date.now() - cfg.admin.sessionTtlMs - 1000);
  assert.strictEqual(auth.verifyToken(token, cfg), false);
});

test('changer le mot de passe invalide les sessions ouvertes', function () {
  var cfg = config.loadConfig(ENV);
  var token = auth.createToken(cfg);
  var autre = config.loadConfig(Object.assign({}, ENV, { ADMIN_PASSWORD: 'nouveau-mot-de-passe' }));
  assert.strictEqual(auth.verifyToken(token, cfg), true);
  assert.strictEqual(auth.verifyToken(token, autre), false);
});

test('les tentatives de connexion sont limitées', async function () {
  rateLimit.reset();
  var last;
  for (var i = 0; i < 4; i++) {
    last = await call(admin.handleLogin, { body: { password: 'faux' }, ip: '203.0.113.35' });
  }
  assert.strictEqual(last.statusCode, 429);
});

test('la connexion depuis un autre site est refusée', async function () {
  var res = await call(admin.handleLogin, {
    body: { password: 'mot-de-passe-de-test' },
    headers: { origin: 'https://pirate.example' },
    ip: '203.0.113.36'
  });
  assert.strictEqual(res.statusCode, 403);
});

test('la déconnexion efface le cookie', async function () {
  var res = await call(admin.handleLogout, { ip: '203.0.113.37' });
  assert.ok(res.headers['set-cookie'].indexOf('Max-Age=0') !== -1);
});

test('sans ADMIN_PASSWORD, la connexion est impossible', async function () {
  var res = await call(admin.handleLogin, {
    body: { password: 'peu importe' },
    env: { ADMIN_PASSWORD: '' },
    ip: '203.0.113.38'
  });
  assert.strictEqual(res.statusCode, 503);
});

test('le mot de passe peut être fourni sous forme de condensat', function () {
  var crypto = require('crypto');
  var hash = crypto.createHash('sha256').update('secret-du-jour', 'utf8').digest('hex');
  var cfg = config.loadConfig(Object.assign({}, ENV, { ADMIN_PASSWORD: '', ADMIN_PASSWORD_SHA256: hash }));
  assert.strictEqual(auth.checkPassword('secret-du-jour', cfg), true);
  assert.strictEqual(auth.checkPassword('autre', cfg), false);
});

test("le formulaire fonctionne sans stockage configuré", async function () {
  mailSent.length = 0;
  var res = await call(handler.handleContact, {
    body: { nom: 'Sans stockage', email: 'x@exemple.fr', message: 'Message envoyé sans base de données.' },
    headers: { origin: 'https://exemple.fr', host: 'exemple.fr' },
    env: { STORE_FILE: '' },
    ip: '203.0.113.39'
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(mailSent.length, 1);
});

test('le mode KV envoie les bonnes commandes Redis', async function () {
  // Faux serveur Upstash : rejoue une vraie liste Redis pour verifier la
  // forme des commandes, seul chemin de production non testable en local.
  var list = [];
  var commandes = [];
  var original = global.fetch;

  global.fetch = function (url, options) {
    if (String(url).indexOf('faux-kv') === -1) return original(url, options);

    var args = JSON.parse(options.body);
    commandes.push(args[0]);
    assert.strictEqual(options.headers.Authorization, 'Bearer jeton-test');

    var result = null;
    if (args[0] === 'LPUSH') { list.unshift(args[2]); result = list.length; }
    else if (args[0] === 'LTRIM') { list = list.slice(args[2], args[3] + 1); result = 'OK'; }
    else if (args[0] === 'LLEN') { result = list.length; }
    else if (args[0] === 'LRANGE') { result = list.slice(args[2], args[3] + 1); }

    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ result: result }); } });
  };

  var kvEnv = {
    STORE_FILE: '',
    KV_REST_API_URL: 'https://faux-kv.exemple',
    KV_REST_API_TOKEN: 'jeton-test'
  };

  try {
    await call(handler.handleContact, {
      body: { nom: 'Via KV', email: 'kv@exemple.fr', message: 'Demande passee par le stockage KV.' },
      headers: { origin: 'https://exemple.fr', host: 'exemple.fr' },
      env: kvEnv,
      ip: '203.0.113.40'
    });

    var login = await call(admin.handleLogin, {
      body: { password: 'mot-de-passe-de-test' }, env: kvEnv, ip: '203.0.113.41'
    });
    var res = await call(admin.handleSubmissions, {
      method: 'GET',
      url: '/api/admin/submissions',
      headers: { cookie: cookieFrom(login) },
      env: kvEnv,
      ip: '203.0.113.41'
    });

    assert.deepStrictEqual(commandes, ['LPUSH', 'LTRIM', 'LLEN', 'LRANGE']);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.storage, 'kv');
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.items[0].nom, 'Via KV');
  } finally {
    global.fetch = original;
  }
});

test('une panne du stockage KV ne perd pas la demande', async function () {
  mailSent.length = 0;
  var original = global.fetch;
  global.fetch = function (url, options) {
    if (String(url).indexOf('faux-kv') !== -1) return Promise.reject(new Error('KV injoignable'));
    return original(url, options);
  };
  try {
    var res = await call(handler.handleContact, {
      body: { nom: 'KV en panne', email: 'kv@exemple.fr', message: 'Le stockage ne repond plus du tout.' },
      headers: { origin: 'https://exemple.fr', host: 'exemple.fr' },
      env: { STORE_FILE: '', KV_REST_API_URL: 'https://faux-kv.exemple', KV_REST_API_TOKEN: 'jeton-test' },
      ip: '203.0.113.42'
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(mailSent.length, 1, "l'e-mail prend le relais");
  } finally {
    global.fetch = original;
  }
});

(async function run() {
  var failed = 0;
  for (var i = 0; i < tests.length; i++) {
    rateLimit.reset();
    try {
      await tests[i][1]();
      console.log('  ok   ' + tests[i][0]);
    } catch (err) {
      failed++;
      console.error('  FAIL ' + tests[i][0] + '\n       ' + err.message);
    }
  }
  fs.rmSync(path.dirname(STORE_FILE), { recursive: true, force: true });
  console.log('\n' + (tests.length - failed) + '/' + tests.length + ' tests réussis.');
  process.exit(failed ? 1 : 0);
})();
