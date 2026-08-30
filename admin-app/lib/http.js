'use strict';

/** Petites aides HTTP communes aux fonctions de `api/`. */

var auth = require('./auth');

function send(res, status, payload, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Une page d'administration ne doit jamais être mise en cache.
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Object.keys(headers || {}).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.end(JSON.stringify(payload === undefined ? {} : payload));
}

function methodNotAllowed(res, allowed) {
  return send(res, 405, { error: 'Méthode non autorisée.' }, { Allow: allowed });
}

/**
 * Vérifie la configuration puis la session. Renvoie la configuration
 * d'authentification si la requête peut continuer, sinon `null` (la réponse
 * a déjà été envoyée).
 */
function requireSession(req, res, env) {
  var cfg = auth.loadAuth(env);

  var errors = auth.validateAuth(cfg);
  if (errors.length) {
    console.error('[admin] configuration incomplète :', errors.join(' '));
    send(res, 500, { error: "L'espace d'administration est mal configuré." });
    return null;
  }

  if (!auth.isAuthenticated(cfg, req)) {
    send(res, 401, { error: 'Session expirée ou absente.' });
    return null;
  }

  return cfg;
}

/** Lit le corps JSON de la requête (Vercel le pré-parse parfois déjà). */
function readJson(req, maxBytes) {
  var limit = maxBytes || 8 * 1024;

  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try { return Promise.resolve(req.body ? JSON.parse(req.body) : {}); }
    catch (err) { return Promise.reject(new Error('bad-json')); }
  }

  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > limit) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(new Error('bad-json')); }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'inconnue';
}

module.exports = {
  send: send,
  methodNotAllowed: methodNotAllowed,
  requireSession: requireSession,
  readJson: readJson,
  clientIp: clientIp
};
