'use strict';

/**
 * POST /api/login  { password }
 *   204 — session ouverte (cookie déposé)
 *   401 — mot de passe incorrect
 *   429 — trop de tentatives depuis cette adresse IP
 *
 * Le compteur de tentatives vit dans le même Redis que les soumissions :
 * il est donc partagé par toutes les instances serverless, contrairement à
 * un compteur en mémoire qui se réinitialiserait à chaque démarrage à froid.
 */

var auth = require('../lib/auth');
var http = require('../lib/http');
var store = require('../lib/store');

var ATTEMPT_PREFIX = 'theta:admin:login:';

/** @returns {Promise<{ allowed: boolean, retryAfter: number }>} */
async function checkAttempts(cfg, env, ip) {
  var kv = store.loadStore(env);
  if (!store.isEnabled(kv) || cfg.loginMax <= 0) return { allowed: true, retryAfter: 0 };

  var key = ATTEMPT_PREFIX + ip;
  try {
    var results = await store.pipeline(kv, [
      ['INCR', key],
      ['EXPIRE', key, String(cfg.loginWindowSeconds), 'NX'],
      ['TTL', key]
    ]);
    var count = parseInt(results[0], 10) || 0;
    if (count > cfg.loginMax) {
      var ttl = parseInt(results[2], 10);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : cfg.loginWindowSeconds };
    }
  } catch (err) {
    // Un magasin injoignable ne doit pas verrouiller l'accès : on laisse
    // passer, le mot de passe reste la protection principale.
    console.error('[admin] compteur de tentatives indisponible :', err && err.message);
  }
  return { allowed: true, retryAfter: 0 };
}

async function clearAttempts(env, ip) {
  var kv = store.loadStore(env);
  if (!store.isEnabled(kv)) return;
  try {
    await store.pipeline(kv, [['DEL', ATTEMPT_PREFIX + ip]]);
  } catch (err) {
    console.error('[admin] remise à zéro impossible :', err && err.message);
  }
}

module.exports = async function (req, res) {
  var env = process.env;

  if (req.method !== 'POST') return http.methodNotAllowed(res, 'POST');

  var cfg = auth.loadAuth(env);
  var errors = auth.validateAuth(cfg);
  if (errors.length) {
    console.error('[admin] configuration incomplète :', errors.join(' '));
    return http.send(res, 500, { error: "L'espace d'administration est mal configuré." });
  }

  var ip = http.clientIp(req);
  var attempts = await checkAttempts(cfg, env, ip);
  if (!attempts.allowed) {
    return http.send(res, 429, {
      error: 'Trop de tentatives. Réessayez dans ' + Math.ceil(attempts.retryAfter / 60) + ' minutes.'
    }, { 'Retry-After': String(attempts.retryAfter) });
  }

  var body;
  try {
    body = await http.readJson(req);
  } catch (err) {
    return http.send(res, 400, { error: 'Requête illisible.' });
  }

  if (!auth.checkPassword(cfg, body && body.password)) {
    console.warn('[admin] tentative de connexion refusée depuis ' + ip);
    return http.send(res, 401, { error: 'Mot de passe incorrect.' });
  }

  await clearAttempts(env, ip);
  return http.send(res, 200, { ok: true }, {
    'Set-Cookie': auth.sessionCookie(cfg, auth.issueToken(cfg))
  });
};
