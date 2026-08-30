'use strict';

/**
 * Test d'intégration : le vrai serveur Express, interrogé en HTTP.
 * Seul l'appel sortant vers Resend est remplacé par un espion.
 *
 *   node test/server.test.js
 */

var assert = require('assert');
var http = require('http');

Object.assign(process.env, {
  MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test',
  MAIL_TO: 'contact@example.com',
  MAIL_FROM: 'Formulaire <contact@example.com>',
  ALLOWED_ORIGINS: 'https://exemple.fr',
  SUCCESS_REDIRECT_URL: 'https://exemple.fr/merci.html',
  RATE_LIMIT_MAX: '50'
});

var sent = [];
global.fetch = function (url, options) {
  sent.push(JSON.parse(options.body));
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};

var app = require('../server');

function request(options, body) {
  return new Promise(function (resolve, reject) {
    var req = http.request(options, function (res) {
      var chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, headers: res.headers, body: chunks });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

var server = app.listen(0, async function () {
  var port = server.address().port;
  var base = { host: '127.0.0.1', port: port, path: '/api/contact', method: 'POST' };
  var failed = 0;

  function check(name, fn) {
    try { fn(); console.log('  ok   ' + name); }
    catch (err) { failed++; console.error('  FAIL ' + name + '\n       ' + err.message); }
  }

  // 1. Envoi JSON depuis le site (cas normal).
  var payload = JSON.stringify({
    nom: 'Jules-Oscar',
    email: 'client@exemple.fr',
    message: 'Bonjour, je souhaite automatiser mes relances de devis.'
  });
  var json = await request(Object.assign({}, base, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      Origin: 'https://exemple.fr'
    }
  }), payload);

  check('POST JSON renvoie { success: true }', function () {
    assert.strictEqual(json.status, 200);
    assert.deepStrictEqual(JSON.parse(json.body), { success: true });
    assert.strictEqual(json.headers['access-control-allow-origin'], 'https://exemple.fr');
    assert.strictEqual(sent.length, 1);
  });

  // 2. Formulaire HTML classique (JavaScript indisponible) : redirection.
  var form = 'nom=Jean&email=jean%40exemple.fr&message=Bonjour+je+cherche+de+l%27aide+sur+mes+devis';
  var html = await request(Object.assign({}, base, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(form),
      Accept: 'text/html'
    }
  }), form);

  check('POST formulaire HTML redirige vers la page de remerciement', function () {
    assert.strictEqual(html.status, 303);
    assert.strictEqual(html.headers.location, 'https://exemple.fr/merci.html');
  });

  // 3. Sonde de vie.
  var health = await request({ host: '127.0.0.1', port: port, path: '/api/health', method: 'GET' });
  check('GET /api/health confirme la configuration', function () {
    assert.strictEqual(health.status, 200);
    assert.strictEqual(JSON.parse(health.body).ok, true);
  });

  server.close();
  console.log('\n' + (3 - failed) + '/3 tests réussis.');
  process.exit(failed ? 1 : 0);
});
