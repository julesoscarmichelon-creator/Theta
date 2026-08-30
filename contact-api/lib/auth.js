'use strict';

/**
 * Accès à l'espace privé : un mot de passe unique, et un cookie de session
 * signé. Pas de base d'utilisateurs, pas de dépendance — le besoin est
 * d'ouvrir une seule porte à une seule personne.
 *
 * Le cookie contient sa propre date d'expiration et une signature HMAC :
 * le serveur n'a donc rien à mémoriser entre deux requêtes, ce qui convient
 * à une fonction serverless.
 */

var crypto = require('crypto');

var COOKIE_NAME = 'mc_admin';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

/** Comparaison à temps constant : une comparaison naïve fuit le mot de passe. */
function safeEqual(a, b) {
  var da = sha256(a);
  var db = sha256(b);
  return crypto.timingSafeEqual(da, db);
}

/**
 * Vérifie le mot de passe fourni. Accepte soit `ADMIN_PASSWORD` (le plus
 * simple), soit `ADMIN_PASSWORD_SHA256` pour ne pas stocker le mot de passe
 * en clair dans les variables d'environnement.
 */
function checkPassword(input, cfg) {
  if (typeof input !== 'string' || !input) return false;

  if (cfg.admin.passwordSha256) {
    var digest = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    return safeEqual(digest.toLowerCase(), cfg.admin.passwordSha256.toLowerCase());
  }
  if (cfg.admin.password) return safeEqual(input, cfg.admin.password);

  return false;
}

/**
 * Secret de signature. À défaut de `ADMIN_SESSION_SECRET`, il est dérivé du
 * mot de passe : une variable de moins à régler, et changer le mot de passe
 * invalide alors toutes les sessions ouvertes — ce qui est le comportement
 * souhaitable.
 */
function sessionSecret(cfg) {
  return cfg.admin.sessionSecret ||
    ('derive:' + (cfg.admin.passwordSha256 || cfg.admin.password || ''));
}

function sign(payload, cfg) {
  return crypto.createHmac('sha256', sessionSecret(cfg)).update(payload).digest('base64url');
}

/** Jeton de session : date d'expiration + signature. */
function createToken(cfg, now) {
  var expiry = (now || Date.now()) + cfg.admin.sessionTtlMs;
  var payload = String(expiry);
  return payload + '.' + sign(payload, cfg);
}

function verifyToken(token, cfg, now) {
  if (typeof token !== 'string') return false;

  var parts = token.split('.');
  if (parts.length !== 2) return false;

  var expected = sign(parts[0], cfg);
  var given = parts[1];
  if (given.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return false;

  var expiry = parseInt(parts[0], 10);
  return Number.isFinite(expiry) && expiry > (now || Date.now());
}

function parseCookies(header) {
  var out = {};
  String(header || '').split(';').forEach(function (part) {
    var eq = part.indexOf('=');
    if (eq === -1) return;
    var key = part.slice(0, eq).trim();
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  });
  return out;
}

/** Vrai si la requête porte un cookie de session valide. */
function isAuthenticated(req, cfg) {
  var cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME], cfg);
}

/**
 * `Secure` est indispensable en production, mais rendrait le cookie
 * inutilisable en HTTP sur localhost : on le pose donc selon le protocole
 * réellement utilisé.
 */
function isSecureRequest(req) {
  var proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return Boolean(req.socket && req.socket.encrypted);
}

function sessionCookie(req, cfg) {
  var flags = [
    COOKIE_NAME + '=' + createToken(cfg),
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + Math.floor(cfg.admin.sessionTtlMs / 1000)
  ];
  if (isSecureRequest(req)) flags.push('Secure');
  return flags.join('; ');
}

function clearedCookie(req) {
  var flags = [COOKIE_NAME + '=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (isSecureRequest(req)) flags.push('Secure');
  return flags.join('; ');
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  checkPassword: checkPassword,
  createToken: createToken,
  verifyToken: verifyToken,
  isAuthenticated: isAuthenticated,
  parseCookies: parseCookies,
  sessionCookie: sessionCookie,
  clearedCookie: clearedCookie
};
