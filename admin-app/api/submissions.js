'use strict';

/**
 * GET    /api/submissions?limit=50&offset=0 — les soumissions, récentes d'abord
 * DELETE /api/submissions?id=<id>           — supprime une soumission
 *
 * Les deux exigent une session valide (voir `lib/auth.js`).
 */

var http = require('../lib/http');
var store = require('../lib/store');

function query(req) {
  // `req.query` existe sur Vercel ; en local on retombe sur l'URL brute.
  if (req.query && typeof req.query === 'object') return req.query;
  var url = new URL(req.url, 'http://localhost');
  var out = {};
  url.searchParams.forEach(function (value, key) { out[key] = value; });
  return out;
}

module.exports = async function (req, res) {
  var env = process.env;

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return http.methodNotAllowed(res, 'GET, DELETE');
  }

  if (!http.requireSession(req, res, env)) return;

  var kv = store.loadStore(env);
  if (!store.isEnabled(kv)) {
    return http.send(res, 500, {
      error: 'Aucun magasin configuré (KV_REST_API_URL / KV_REST_API_TOKEN).'
    });
  }

  var params = query(req);

  try {
    if (req.method === 'DELETE') {
      var id = String(params.id || '');
      // L'identifiant sert à composer une clé Redis : on n'accepte que le
      // format que nous produisons nous-mêmes.
      if (!/^\d+-[0-9a-f]{8}$/.test(id)) {
        return http.send(res, 400, { error: 'Identifiant invalide.' });
      }
      var deleted = await store.deleteSubmission(kv, id);
      return http.send(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: 'Introuvable.' });
    }

    var page = await store.listSubmissions(kv, {
      limit: params.limit,
      offset: params.offset
    });
    return http.send(res, 200, page);
  } catch (err) {
    console.error('[admin] magasin injoignable :', err && err.message);
    return http.send(res, 502, { error: 'Le magasin de données est injoignable.' });
  }
};
