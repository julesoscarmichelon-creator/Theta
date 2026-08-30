'use strict';

/**
 * Routes de l'espace privé — la partie serveur du tableau de bord.
 *
 *   POST /api/admin/login        { password }        → pose le cookie de session
 *   POST /api/admin/logout                            → efface le cookie
 *   GET  /api/admin/submissions  ?limit=&offset=      → liste des demandes
 *
 * Ces routes ne répondent qu'aux pages du même domaine : le tableau de bord
 * n'a aucune raison d'être appelé depuis ailleurs, donc aucun en-tête CORS
 * n'est posé ici.
 */

var config = require('./config');
var auth = require('./auth');
var store = require('./store');
var rateLimit = require('./rate-limit');

var MAX_BODY_BYTES = 8 * 1024;

function send(res, status, payload, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'same-origin');
  Object.keys(headers || {}).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);

  return new Promise(function (resolve) {
    var chunks = [];
    var size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { req.destroy(); resolve({}); return; }
      chunks.push(chunk);
    });
    req.on('end', function () {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', function () { resolve({}); });
  });
}

function clientIp(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'inconnue';
}

/** Refuse les requêtes venant d'un autre site (protection CSRF simple). */
function isForeignOrigin(req) {
  var origin = req.headers.origin;
  if (!origin) return false; // requête sans origine : curl, ou navigation simple
  try {
    return new URL(origin).host !== req.headers.host;
  } catch (err) {
    return true;
  }
}

async function handleLogin(req, res, env) {
  var cfg = config.loadConfig(env);

  if (req.method !== 'POST') {
    return send(res, 405, { success: false, error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  }
  if (isForeignOrigin(req)) {
    return send(res, 403, { success: false, error: 'Origine non autorisée.' });
  }
  if (!cfg.admin.password && !cfg.admin.passwordSha256) {
    console.error('[admin] ADMIN_PASSWORD absent : connexion impossible.');
    return send(res, 503, { success: false, error: "L'espace privé n'est pas encore configuré." });
  }

  // Le compteur de tentatives est propre à la connexion : il ne doit pas
  // partager sa fenêtre avec les envois du formulaire public.
  var limit = rateLimit.check('admin-login:' + clientIp(req), {
    rateLimitMax: cfg.admin.loginMax,
    rateLimitWindowMs: cfg.rateLimitWindowMs
  });
  if (!limit.allowed) {
    return send(res, 429, {
      success: false,
      error: 'Trop de tentatives. Réessayez dans quelques minutes.'
    }, { 'Retry-After': String(limit.retryAfter) });
  }

  var body = await readBody(req);
  if (!auth.checkPassword(body.password, cfg)) {
    console.warn('[admin] mot de passe refusé (' + clientIp(req) + ')');
    return send(res, 401, { success: false, error: 'Mot de passe incorrect.' });
  }

  return send(res, 200, { success: true }, { 'Set-Cookie': auth.sessionCookie(req, cfg) });
}

async function handleLogout(req, res, env) {
  var cfg = config.loadConfig(env);
  return send(res, 200, { success: true }, { 'Set-Cookie': auth.clearedCookie(req, cfg) });
}

async function handleSubmissions(req, res, env) {
  var cfg = config.loadConfig(env);

  if (req.method !== 'GET') {
    return send(res, 405, { success: false, error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  }
  if (!auth.isAuthenticated(req, cfg)) {
    return send(res, 401, { success: false, error: 'Session expirée ou absente.' });
  }

  var url = new URL(req.url || '/', 'http://' + (req.headers.host || 'local'));

  try {
    var page = await store.listSubmissions(cfg, {
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset')
    });
    return send(res, 200, {
      success: true,
      storage: cfg.store.mode,
      total: page.total,
      items: page.items
    });
  } catch (err) {
    console.error('[admin] lecture du stockage impossible :', err && err.message);
    return send(res, 502, {
      success: false,
      error: "Le stockage des demandes est injoignable. Les e-mails, eux, continuent d'arriver."
    });
  }
}

/** État de la session : sert à afficher la bonne vue au chargement. */
async function handleSession(req, res, env) {
  var cfg = config.loadConfig(env);
  return send(res, 200, {
    authenticated: auth.isAuthenticated(req, cfg),
    configured: Boolean(cfg.admin.password || cfg.admin.passwordSha256),
    storage: cfg.store.mode
  });
}

module.exports = {
  handleLogin: handleLogin,
  handleLogout: handleLogout,
  handleSubmissions: handleSubmissions,
  handleSession: handleSession
};
