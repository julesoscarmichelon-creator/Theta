'use strict';

/**
 * Stockage des soumissions dans un Redis REST (Vercel KV / Upstash).
 *
 * Ce fichier est VOLONTAIREMENT DUPLIQUÉ à l'identique dans `admin-app/lib/`.
 * Les deux dossiers sont déployés comme deux projets Vercel distincts : chacun
 * n'embarque que son propre répertoire racine, un `require('../../…')` ne
 * serait donc pas inclus dans le bundle. Toute modification ici doit être
 * recopiée dans `admin-app/lib/store.js` (les deux fichiers sont identiques).
 *
 * Modèle de données, réduit au strict nécessaire :
 *   theta:submission:<id>  chaîne JSON  — une soumission
 *   theta:submissions      liste d'ids  — la plus récente en tête (LPUSH)
 *
 * Zéro dépendance : l'API REST d'Upstash se pilote au `fetch` (Node >= 18).
 */

var crypto = require('crypto');

var KEY_PREFIX = 'theta:submission:';
var INDEX_KEY = 'theta:submissions';

function int(value, fallback) {
  var n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Lit la configuration du magasin. Les intégrations Vercel exposent des noms
 * différents selon leur millésime : on accepte les deux jeux de variables.
 */
function loadStore(env) {
  env = env || process.env;
  return {
    url: String(env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, ''),
    token: String(env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || ''),
    // Au-delà, les plus anciennes soumissions sortent de l'index.
    maxStored: int(env.STORE_MAX_SUBMISSIONS, 1000),
    // 0 = conservation illimitée. Sinon, expiration automatique (RGPD).
    ttlDays: int(env.STORE_TTL_DAYS, 0)
  };
}

/** Vrai si le magasin est configuré ; sinon le site fonctionne sans archive. */
function isEnabled(store) {
  return Boolean(store && store.url && store.token);
}

/**
 * Exécute une suite de commandes Redis en un seul aller-retour.
 * @param {Array<Array<string>>} commands ex. [['SET','k','v'], ['LLEN','l']]
 * @returns {Promise<Array>} les résultats, dans l'ordre.
 */
async function pipeline(store, commands) {
  if (!isEnabled(store)) throw new Error('store-not-configured');
  if (!commands.length) return [];

  var res = await fetch(store.url + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + store.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  if (!res.ok) {
    var detail = await res.text().catch(function () { return ''; });
    throw new Error('kv-http-' + res.status + (detail ? ' ' + detail.slice(0, 200) : ''));
  }

  var payload = await res.json();
  if (!Array.isArray(payload)) throw new Error('kv-bad-response');

  return payload.map(function (entry) {
    if (entry && entry.error) throw new Error('kv-' + entry.error);
    return entry ? entry.result : null;
  });
}

/** Identifiant trié par date de création, sans collision réaliste. */
function newId(now) {
  return String(now || Date.now()) + '-' + crypto.randomBytes(4).toString('hex');
}

/**
 * Archive une soumission déjà validée.
 * @param {object} data champs nettoyés par `validate.validateSubmission`
 * @param {{ ip?: string, origin?: string, userAgent?: string }} meta
 * @returns {Promise<object>} l'enregistrement écrit.
 */
async function saveSubmission(store, data, meta) {
  var now = Date.now();
  var record = {
    id: newId(now),
    receivedAt: new Date(now).toISOString(),
    nom: data.nom || '',
    email: data.email || '',
    entreprise: data.entreprise || '',
    telephone: data.telephone || '',
    sujet: data.sujet || '',
    message: data.message || '',
    ip: (meta && meta.ip) || '',
    origin: (meta && meta.origin) || '',
    userAgent: (meta && meta.userAgent) || ''
  };

  var setCmd = ['SET', KEY_PREFIX + record.id, JSON.stringify(record)];
  if (store.ttlDays > 0) setCmd.push('EX', String(store.ttlDays * 86400));

  await pipeline(store, [
    setCmd,
    ['LPUSH', INDEX_KEY, record.id],
    ['LTRIM', INDEX_KEY, '0', String(Math.max(store.maxStored, 1) - 1)]
  ]);

  return record;
}

/**
 * Liste les soumissions, de la plus récente à la plus ancienne.
 * @returns {Promise<{ total: number, items: object[] }>}
 */
async function listSubmissions(store, options) {
  var opts = options || {};
  var offset = Math.max(int(opts.offset, 0), 0);
  var limit = Math.min(Math.max(int(opts.limit, 50), 1), 200);

  var head = await pipeline(store, [
    ['LLEN', INDEX_KEY],
    ['LRANGE', INDEX_KEY, String(offset), String(offset + limit - 1)]
  ]);

  var total = int(head[0], 0);
  var ids = Array.isArray(head[1]) ? head[1] : [];
  if (!ids.length) return { total: total, items: [] };

  var values = await pipeline(store, [
    ['MGET'].concat(ids.map(function (id) { return KEY_PREFIX + id; }))
  ]);

  var raw = Array.isArray(values[0]) ? values[0] : [];
  var items = [];
  raw.forEach(function (value, i) {
    if (value === null || value === undefined) return; // expiré entre-temps
    try {
      items.push(typeof value === 'string' ? JSON.parse(value) : value);
    } catch (err) {
      // Un enregistrement illisible ne doit pas casser toute la page.
      items.push({ id: ids[i], receivedAt: '', nom: '(enregistrement illisible)', message: '' });
    }
  });

  return { total: total, items: items };
}

/** Supprime une soumission (valeur + entrée d'index). */
async function deleteSubmission(store, id) {
  var results = await pipeline(store, [
    ['DEL', KEY_PREFIX + id],
    ['LREM', INDEX_KEY, '0', id]
  ]);
  return int(results[0], 0) > 0;
}

module.exports = {
  loadStore: loadStore,
  isEnabled: isEnabled,
  pipeline: pipeline,
  saveSubmission: saveSubmission,
  listSubmissions: listSubmissions,
  deleteSubmission: deleteSubmission,
  KEY_PREFIX: KEY_PREFIX,
  INDEX_KEY: INDEX_KEY
};
