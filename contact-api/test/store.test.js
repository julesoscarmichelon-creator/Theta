'use strict';

/**
 * Archivage des soumissions dans le magasin partagé avec `admin-app`.
 * `fetch` est remplacé : ni Redis ni fournisseur d'e-mail n'est requis.
 *
 *   node test/store.test.js
 */

var assert = require('assert');
var { EventEmitter } = require('events');

var handler = require('../lib/handler');
var rateLimit = require('../lib/rate-limit');

var KV = 'https://faux-kv.local';

var ENV = {
  MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test',
  MAIL_TO: 'contact@example.com',
  MAIL_FROM: 'Formulaire <contact@example.com>',
  ALLOWED_ORIGINS: 'https://exemple.fr',
  KV_REST_API_URL: KV,
  KV_REST_API_TOKEN: 'jeton'
};

var kvCalls = [];
var mails = [];
var kvFails = false;

global.fetch = function (url, options) {
  if (String(url).indexOf(KV) === 0) {
    kvCalls.push(JSON.parse(options.body));
    if (kvFails) return Promise.resolve({ ok: false, status: 500, text: function () { return Promise.resolve('boum'); } });
    return Promise.resolve({
      ok: true, status: 200,
      json: function () { return Promise.resolve([{ result: 'OK' }, { result: 1 }, { result: 'OK' }]); }
    });
  }
  mails.push(JSON.parse(options.body));
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: 'test' }); } });
};

function call(env) {
  var req = new EventEmitter();
  req.method = 'POST';
  req.headers = {
    origin: 'https://exemple.fr',
    'content-type': 'application/json',
    'x-forwarded-for': '203.0.113.9',
    'user-agent': 'Mozilla/5.0 (test)'
  };
  req.body = {
    nom: 'Camille',
    email: 'Camille@Exemple.FR',
    entreprise: 'ACME',
    telephone: '0102030405',
    message: 'Bonjour, je souhaite un devis pour la prospection.'
  };
  req.socket = { remoteAddress: '127.0.0.1' };

  var res = {
    statusCode: 0, headers: {},
    setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
    end: function (body) { this.body = body ? JSON.parse(body) : null; }
  };

  rateLimit.reset();
  return handler.handleContact(req, res, Object.assign({}, ENV, env)).then(function () { return res; });
}

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('la soumission est archivée avant l’envoi de l’e-mail', async function () {
  kvCalls.length = 0; mails.length = 0;
  var res = await call();
  assert.strictEqual(res.statusCode, 200);

  assert.strictEqual(kvCalls.length, 1, 'un seul aller-retour vers le magasin');
  var commands = kvCalls[0];
  assert.strictEqual(commands[0][0], 'SET');
  assert.match(commands[0][1], /^theta:submission:\d+-[0-9a-f]{8}$/);
  assert.strictEqual(commands[1][0], 'LPUSH');
  assert.strictEqual(commands[2][0], 'LTRIM');

  var record = JSON.parse(commands[0][2]);
  assert.strictEqual(record.nom, 'Camille');
  assert.strictEqual(record.email, 'camille@exemple.fr', 'les champs archivés sont ceux, nettoyés, de la validation');
  assert.strictEqual(record.entreprise, 'ACME');
  assert.strictEqual(record.ip, '203.0.113.9');
  assert.strictEqual(record.origin, 'https://exemple.fr');
  assert.strictEqual(record.userAgent, 'Mozilla/5.0 (test)');
  assert.ok(record.receivedAt);

  assert.strictEqual(mails.length, 1, 'l’e-mail part toujours');
});

test('sans magasin configuré, le formulaire fonctionne comme avant', async function () {
  kvCalls.length = 0; mails.length = 0;
  var res = await call({ KV_REST_API_URL: '', KV_REST_API_TOKEN: '' });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(kvCalls.length, 0, 'aucun appel réseau inutile');
  assert.strictEqual(mails.length, 1);
});

test('une panne du magasin ne fait pas échouer le formulaire', async function () {
  kvCalls.length = 0; mails.length = 0;
  kvFails = true;
  try {
    var res = await call();
    assert.strictEqual(res.statusCode, 200, 'le visiteur ne doit rien voir de la panne');
    assert.deepStrictEqual(res.body, { success: true });
    assert.strictEqual(mails.length, 1, 'l’e-mail reste envoyé');
  } finally {
    kvFails = false;
  }
});

test('une soumission jugée spam n’est pas archivée', async function () {
  kvCalls.length = 0; mails.length = 0;

  var req = new EventEmitter();
  req.method = 'POST';
  req.headers = { origin: 'https://exemple.fr', 'content-type': 'application/json' };
  req.body = { nom: 'Bot', email: 'bot@exemple.fr', message: 'Bonjour bonjour', website: 'http://spam' };
  req.socket = { remoteAddress: '127.0.0.1' };
  var res = {
    statusCode: 0, headers: {},
    setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
    end: function (body) { this.body = body ? JSON.parse(body) : null; }
  };
  rateLimit.reset();
  await handler.handleContact(req, res, ENV);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(kvCalls.length, 0, 'le magasin ne se remplit pas de spam');
  assert.strictEqual(mails.length, 0);
});

test('une soumission invalide n’est pas archivée', async function () {
  kvCalls.length = 0;
  var req = new EventEmitter();
  req.method = 'POST';
  req.headers = { origin: 'https://exemple.fr', 'content-type': 'application/json' };
  req.body = { nom: 'A', email: 'pas-un-email', message: 'court' };
  req.socket = { remoteAddress: '127.0.0.1' };
  var res = {
    statusCode: 0, headers: {},
    setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
    end: function (body) { this.body = body ? JSON.parse(body) : null; }
  };
  rateLimit.reset();
  await handler.handleContact(req, res, ENV);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(kvCalls.length, 0);
});

(async function () {
  var passed = 0;
  for (var t of tests) {
    try {
      await t.fn();
      console.log('  ok   ' + t.name);
      passed++;
    } catch (err) {
      console.error('  ÉCHEC ' + t.name + '\n         ' + err.message);
    }
  }
  console.log('\n' + passed + '/' + tests.length + ' tests réussis.');
  if (passed !== tests.length) process.exit(1);
})();
