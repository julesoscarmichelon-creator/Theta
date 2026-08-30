'use strict';

/**
 * Authentification de l'espace d'administration : un seul mot de passe,
 * une session signée déposée dans un cookie `HttpOnly`.
 *
 * Aucun compte, aucune base d'utilisateurs, aucune dépendance : le cookie
 * porte simplement une date d'expiration signée en HMAC-SHA256. Le secret
 * ne quitte jamais le serveur, un cookie forgé est donc rejeté.
 */

var crypto = require('crypto');

var COOKIE_NAME = 'theta_admin';

function int(value, fallback) {
  var n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function loadAuth(env) {
  env = env || process.env;
  return {
    password: String(env.ADMIN_PASSWORD || ''),
    secret: String(env.ADMIN_SESSION_SECRET || ''),
    ttlHours: int(env.ADMIN_SESSION_HOURS, 12),
    // Le cookie est `Secure` par défaut (HTTPS obligatoire). À passer à
    // "true" uniquement pour un essai en local sur http://localhost.
    insecureCookie: String(env.ADMIN_COOKIE_INSECURE || '') === 'true',
    loginMax: int(env.ADMIN_LOGIN_MAX, 10),
    loginWindowSeconds: int(env.ADMIN_LOGIN_WINDOW_SECONDS, 900)
  };
}

/** Liste des problèmes de configuration (vide si tout va bien). */
function validateAuth(auth) {
  var errors = [];
  if (auth.password.length < 12) errors.push('ADMIN_PASSWORD manquant ou trop court (12 caractères minimum).');
  if (auth.secret.length < 32) errors.push('ADMIN_SESSION_SECRET manquant ou trop court (32 caractères minimum).');
  return errors;
}

/** Comparaison à durée constante, quelles que soient les longueurs. */
function safeEqual(a, b) {
  var ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  var hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkPassword(auth, candidate) {
  if (!auth.password) return false;
  return safeEqual(auth.password, typeof candidate === 'string' ? candidate : '');
}

function sign(auth, payload) {
  return crypto.createHmac('sha256', auth.secret).update(payload).digest('base64url');
}

/** Jeton de session : "<expiration en ms>.<signature>". */
function issueToken(auth, now) {
  var exp = String((now || Date.now()) + auth.ttlHours * 3600 * 1000);
  return exp + '.' + sign(auth, exp);
}

function verifyToken(auth, token, now) {
  if (!auth.secret || typeof token !== 'string') return false;
  var dot = token.indexOf('.');
  if (dot <= 0) return false;

  var exp = token.slice(0, dot);
  if (!/^\d+$/.test(exp)) return false;
  if (!safeEqual(sign(auth, exp), token.slice(dot + 1))) return false;

  return parseInt(exp, 10) > (now || Date.now());
}

/** Analyse l'en-tête `Cookie` en une table simple. */
function parseCookies(header) {
  var out = {};
  String(header || '').split(';').forEach(function (part) {
    var eq = part.indexOf('=');
    if (eq <= 0) return;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  });
  return out;
}

function cookieHeader(auth, value, maxAgeSeconds) {
  var parts = [
    COOKIE_NAME + '=' + value,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + maxAgeSeconds
  ];
  if (!auth.insecureCookie) parts.push('Secure');
  return parts.join('; ');
}

function sessionCookie(auth, token) {
  return cookieHeader(auth, token, auth.ttlHours * 3600);
}

function clearedCookie(auth) {
  return cookieHeader(auth, '', 0);
}

/** Vrai si la requête porte une session valide. */
function isAuthenticated(auth, req, now) {
  var cookies = parseCookies(req.headers.cookie);
  return verifyToken(auth, cookies[COOKIE_NAME], now);
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  loadAuth: loadAuth,
  validateAuth: validateAuth,
  checkPassword: checkPassword,
  issueToken: issueToken,
  verifyToken: verifyToken,
  parseCookies: parseCookies,
  sessionCookie: sessionCookie,
  clearedCookie: clearedCookie,
  isAuthenticated: isAuthenticated
};
