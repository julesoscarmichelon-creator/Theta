'use strict';

/**
 * Tests de bout en bout du handler, sans réseau : `fetch` est remplacé par
 * un espion, ce qui permet de vérifier aussi le contenu de l'e-mail.
 *
 *   node test/smoke.test.js
 */

var assert = require('assert');
var { EventEmitter } = require('events');

var handler = require('../lib/handler');
var rateLimit = require('../lib/rate-limit');

var ENV = {
  MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test',
  MAIL_TO: 'contact@example.com',
  MAIL_FROM: 'Formulaire <contact@example.com>',
  ALLOWED_ORIGINS: 'https://exemple.fr',
  RATE_LIMIT_MAX: '3',
  MIN_SUBMIT_SECONDS: '2'
};

var sent = [];
global.fetch = function (url, options) {
  sent.push(JSON.parse(options.body));
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: 'test' }); } });
};

function call(options) {
  options = options || {};
  var req = new EventEmitter();
  req.method = options.method || 'POST';
  req.headers = Object.assign(
    { origin: 'https://exemple.fr', 'content-type': 'application/json', 'x-forwarded-for': options.ip || '203.0.113.1' },
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

  return handler.handleContact(req, res, Object.assign({}, ENV, options.env)).then(function () { return res; });
}

function valid(extra) {
  return Object.assign({
    nom: 'Jules-Oscar',
    email: 'client@exemple.fr',
    entreprise: 'ACME',
    message: 'Bonjour, je souhaite automatiser la relance de mes devis.'
  }, extra);
}

var tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('une demande valide part par e-mail', async function () {
  sent.length = 0;
  var res = await call({ body: valid() });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].reply_to, 'client@exemple.fr');
  assert.ok(sent[0].text.indexOf('automatiser la relance') !== -1);
});

test('les champs invalides sont détaillés au client', async function () {
  var res = await call({ body: { nom: 'X', email: 'pas-un-email', message: 'court' }, ip: '203.0.113.2' });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.ok(res.body.fields.nom && res.body.fields.email && res.body.fields.message);
});

test('le honeypot est ignoré silencieusement', async function () {
  sent.length = 0;
  var res = await call({ body: valid({ _gotcha: 'robot' }), ip: '203.0.113.3' });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true });
  assert.strictEqual(sent.length, 0, 'aucun e-mail ne doit partir');
});

test('un envoi instantané est traité comme du spam', async function () {
  sent.length = 0;
  var res = await call({ body: valid({ _t: String(Date.now()) }), ip: '203.0.113.4' });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(sent.length, 0);
});

test('une origine inconnue est refusée', async function () {
  var res = await call({ body: valid(), headers: { origin: 'https://pirate.example' }, ip: '203.0.113.5' });
  assert.strictEqual(res.statusCode, 403);
});

test('le préflight CORS répond 204 avec les bons en-têtes', async function () {
  var res = await call({ method: 'OPTIONS', ip: '203.0.113.6' });
  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.headers['access-control-allow-origin'], 'https://exemple.fr');
  assert.ok(res.headers['access-control-allow-methods'].indexOf('POST') !== -1);
});

test('GET renvoie 405', async function () {
  var res = await call({ method: 'GET', ip: '203.0.113.7' });
  assert.strictEqual(res.statusCode, 405);
});

test('le débit est limité par IP', async function () {
  rateLimit.reset();
  var last;
  for (var i = 0; i < 4; i++) {
    last = await call({ body: valid(), ip: '203.0.113.8' });
  }
  assert.strictEqual(last.statusCode, 429);
  assert.ok(last.headers['retry-after']);
});

test('une configuration incomplète ne divulgue rien', async function () {
  var res = await call({ body: valid(), ip: '203.0.113.9', env: { RESEND_API_KEY: '' } });
  assert.strictEqual(res.statusCode, 500);
  assert.ok(res.body.error.indexOf('RESEND') === -1);
});

test("l'injection d'en-tête est neutralisée", async function () {
  sent.length = 0;
  var res = await call({
    body: valid({ nom: 'Jean\nBcc: pirate@example.com' }),
    ip: '203.0.113.10'
  });
  assert.strictEqual(res.statusCode, 200);
  assert.ok(sent[0].subject.indexOf('\n') === -1, 'le sujet ne doit pas contenir de saut de ligne');
});

test("le HTML de l'e-mail est échappé", async function () {
  sent.length = 0;
  await call({ body: valid({ message: 'Bonjour <script>alert(1)</script> merci beaucoup' }), ip: '203.0.113.11' });
  assert.ok(sent[0].html.indexOf('<script>') === -1);
  assert.ok(sent[0].html.indexOf('&lt;script&gt;') !== -1);
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
  console.log('\n' + (tests.length - failed) + '/' + tests.length + ' tests réussis.');
  process.exit(failed ? 1 : 0);
})();
