'use strict';

/**
 * Tests du magasin. Le réseau est remplacé par un faux `fetch` : aucun
 * Redis n'est nécessaire pour lancer la suite. `node test/store.test.js`
 */

var assert = require('assert');
var store = require('../lib/store');

var env = { KV_REST_API_URL: 'https://exemple.upstash.io/', KV_REST_API_TOKEN: 'jeton' };

// --- Configuration ----------------------------------------------------
var cfg = store.loadStore(env);
assert.strictEqual(cfg.url, 'https://exemple.upstash.io', 'le slash final est retiré');
assert.ok(store.isEnabled(cfg));
assert.ok(!store.isEnabled(store.loadStore({})), 'sans variables : magasin désactivé');
assert.ok(
  store.isEnabled(store.loadStore({ UPSTASH_REDIS_REST_URL: 'https://x.io', UPSTASH_REDIS_REST_TOKEN: 't' })),
  'les noms UPSTASH_* sont acceptés'
);

// --- Faux fetch -------------------------------------------------------
var calls = [];
var replies = [];

global.fetch = function (url, options) {
  calls.push({ url: url, body: JSON.parse(options.body), headers: options.headers });
  var next = replies.shift();
  if (!next) throw new Error('réponse non préparée');
  return Promise.resolve({
    ok: next.ok !== false,
    status: next.status || 200,
    json: function () { return Promise.resolve(next.json); },
    text: function () { return Promise.resolve(next.text || ''); }
  });
};

function reply(results) { replies.push({ json: results.map(function (r) { return { result: r }; }) }); }

(async function () {
  // --- Écriture -------------------------------------------------------
  reply([ 'OK', 1, 'OK' ]);
  var record = await store.saveSubmission(cfg, {
    nom: 'Camille', email: 'camille@exemple.fr', message: 'Bonjour'
  }, { ip: '203.0.113.4', origin: 'https://theta-zeta.vercel.app' });

  assert.match(record.id, /^\d+-[0-9a-f]{8}$/, 'identifiant au format attendu');
  assert.strictEqual(record.nom, 'Camille');
  assert.strictEqual(record.ip, '203.0.113.4');
  assert.ok(record.receivedAt, 'date de réception renseignée');

  var written = calls[0].body;
  assert.strictEqual(calls[0].url, 'https://exemple.upstash.io/pipeline');
  assert.strictEqual(calls[0].headers.Authorization, 'Bearer jeton');
  assert.strictEqual(written[0][0], 'SET');
  assert.strictEqual(written[0][1], 'theta:submission:' + record.id);
  assert.deepStrictEqual(JSON.parse(written[0][2]), record);
  assert.deepStrictEqual(written[1], ['LPUSH', 'theta:submissions', record.id]);
  assert.deepStrictEqual(written[2], ['LTRIM', 'theta:submissions', '0', '999']);

  // TTL optionnel
  calls.length = 0;
  reply([ 'OK', 1, 'OK' ]);
  await store.saveSubmission(store.loadStore(Object.assign({ STORE_TTL_DAYS: '30' }, env)),
    { nom: 'X', email: 'x@y.fr', message: 'z' }, {});
  assert.deepStrictEqual(calls[0].body[0].slice(-2), ['EX', '2592000'], 'TTL en secondes');

  // --- Lecture --------------------------------------------------------
  calls.length = 0;
  var stored = { id: '1-aabbccdd', nom: 'Camille', message: 'Bonjour' };
  reply([ 3, ['1-aabbccdd'] ]);
  reply([ [JSON.stringify(stored)] ]);

  var page = await store.listSubmissions(cfg, { limit: 1, offset: 0 });
  assert.strictEqual(page.total, 3, 'le total vient de LLEN, pas de la page');
  assert.deepStrictEqual(page.items, [stored]);
  assert.deepStrictEqual(calls[0].body[1], ['LRANGE', 'theta:submissions', '0', '0']);
  assert.deepStrictEqual(calls[1].body[0], ['MGET', 'theta:submission:1-aabbccdd']);

  // Bornes de pagination
  calls.length = 0;
  reply([ 0, [] ]);
  var empty = await store.listSubmissions(cfg, { limit: 5000, offset: -3 });
  assert.deepStrictEqual(empty.items, [], 'index vide : aucun second appel');
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].body[1], ['LRANGE', 'theta:submissions', '0', '199'], 'limite plafonnée à 200');

  // Une valeur expirée entre LRANGE et MGET ne casse rien.
  reply([ 2, ['a', 'b'] ]);
  reply([ [null, JSON.stringify(stored)] ]);
  var partial = await store.listSubmissions(cfg, {});
  assert.strictEqual(partial.items.length, 1, 'les entrées disparues sont ignorées');

  // Un enregistrement illisible est signalé sans interrompre la page.
  reply([ 1, ['a'] ]);
  reply([ ['{ json casse'] ]);
  var broken = await store.listSubmissions(cfg, {});
  assert.strictEqual(broken.items.length, 1);
  assert.match(broken.items[0].nom, /illisible/);

  // --- Suppression ----------------------------------------------------
  calls.length = 0;
  reply([ 1, 1 ]);
  assert.strictEqual(await store.deleteSubmission(cfg, '1-aabbccdd'), true);
  assert.deepStrictEqual(calls[0].body, [
    ['DEL', 'theta:submission:1-aabbccdd'],
    ['LREM', 'theta:submissions', '0', '1-aabbccdd']
  ]);

  reply([ 0, 0 ]);
  assert.strictEqual(await store.deleteSubmission(cfg, 'inconnu'), false);

  // --- Erreurs --------------------------------------------------------
  replies.push({ ok: false, status: 401, text: 'Unauthorized' });
  await assert.rejects(store.listSubmissions(cfg, {}), /kv-http-401/);

  replies.push({ json: [{ error: 'WRONGTYPE' }] });
  await assert.rejects(store.pipeline(cfg, [['LLEN', 'x']]), /kv-WRONGTYPE/);

  await assert.rejects(store.pipeline(store.loadStore({}), [['PING']]), /store-not-configured/);
  assert.deepStrictEqual(await store.pipeline(cfg, []), [], 'aucune commande : aucun appel');

  console.log('store.test.js : OK');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
