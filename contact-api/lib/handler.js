'use strict';

/**
 * Cœur du microservice : un handler Node classique (req, res) utilisable
 * tel quel par une fonction serverless Vercel comme par Express.
 *
 * Contrat de réponse, volontairement stable :
 *   200 { success: true }
 *   400 { success: false, error: "...", fields: { champ: "raison" } }
 *   403 { success: false, error: "..." }   origine non autorisée
 *   405 { success: false, error: "..." }   méthode non autorisée
 *   429 { success: false, error: "..." }   trop de demandes
 *   500 { success: false, error: "..." }   panne côté serveur
 */

var config = require('./config');
var validate = require('./validate');
var mail = require('./mail');
var rateLimit = require('./rate-limit');

var MAX_BODY_BYTES = 64 * 1024;

function send(res, status, payload, headers) {
  var body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.keys(headers || {}).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.end(body);
}

/**
 * Vrai lorsque la requête vient de la page servie par ce même déploiement.
 * Ce cas n'a rien à voir avec le CORS — il couvre le site et l'API sur un
 * seul domaine — et il évite d'avoir à déclarer chaque URL de
 * prévisualisation Vercel, qui change à chaque commit.
 */
function isSameOrigin(req) {
  var origin = req.headers.origin;
  if (!origin || !req.headers.host) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch (err) {
    return false;
  }
}

/**
 * Applique les en-têtes CORS. L'origine doit figurer dans ALLOWED_ORIGINS ;
 * la valeur `*` y est acceptée pour les tests, mais déconseillée en production.
 */
function applyCors(req, res, cfg) {
  var origin = req.headers.origin;
  var wildcard = cfg.allowedOrigins.indexOf('*') !== -1;

  res.setHeader('Vary', 'Origin');

  if (wildcard) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && (cfg.allowedOrigins.indexOf(origin) !== -1 || isSameOrigin(req))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    return false; // origine présente mais inconnue
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}

/** Lit le corps de la requête, qu'il soit déjà parsé (Express/Vercel) ou non. */
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string' && req.body) return Promise.resolve(parse(req.body, req));

  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload-too-large'), { code: 'TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      try {
        resolve(parse(Buffer.concat(chunks).toString('utf8'), req));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parse(raw, req) {
  if (!raw) return {};
  var type = String(req.headers['content-type'] || '');

  // Accepté pour rester compatible avec un formulaire HTML sans JavaScript.
  if (type.indexOf('application/x-www-form-urlencoded') !== -1) {
    var out = {};
    new URLSearchParams(raw).forEach(function (value, key) { out[key] = value; });
    return out;
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw Object.assign(new Error('invalid-json'), { code: 'BAD_JSON' });
  }
}

/**
 * Vrai lorsque la requête vient d'un formulaire HTML classique (JavaScript
 * indisponible) : on la termine alors par une redirection, pas par du JSON.
 */
function wantsRedirect(req, cfg) {
  if (!cfg.successRedirect) return false;
  var type = String(req.headers['content-type'] || '');
  var accept = String(req.headers.accept || '');
  return type.indexOf('application/x-www-form-urlencoded') !== -1 &&
    accept.indexOf('application/json') === -1;
}

function redirect(res, url) {
  res.statusCode = 303;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function clientIp(req) {
  var fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'inconnue';
}

async function handleContact(req, res, env) {
  var cfg = config.loadConfig(env);

  if (!applyCors(req, res, cfg)) {
    return send(res, 403, { success: false, error: 'Origine non autorisée.' });
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return send(res, 405, { success: false, error: 'Méthode non autorisée.' }, { Allow: 'POST, OPTIONS' });
  }

  var configErrors = config.validateConfig(cfg);
  if (configErrors.length) {
    // Le détail part dans les journaux, jamais dans la réponse HTTP.
    console.error('[contact] configuration incomplète :', configErrors.join(' '));
    return send(res, 500, {
      success: false,
      error: "Le service de contact est mal configuré. Écrivez-nous directement par e-mail."
    });
  }

  var body;
  try {
    body = await readBody(req);
  } catch (err) {
    var tooLarge = err && err.code === 'TOO_LARGE';
    return send(res, tooLarge ? 413 : 400, {
      success: false,
      error: tooLarge ? 'Demande trop volumineuse.' : 'Requête illisible.'
    });
  }

  var limit = rateLimit.check(clientIp(req), cfg);
  if (!limit.allowed) {
    return send(res, 429, {
      success: false,
      error: 'Trop de demandes envoyées. Réessayez dans quelques minutes.'
    }, { 'Retry-After': String(limit.retryAfter) });
  }

  // Piégé : on répond comme un succès pour ne rien apprendre au robot.
  var spam = validate.detectSpam(body, cfg);
  if (spam) {
    console.warn('[contact] soumission ignorée (' + spam + ')');
    if (wantsRedirect(req, cfg)) return redirect(res, cfg.successRedirect);
    return send(res, 200, { success: true });
  }

  var result = validate.validateSubmission(body, cfg);
  if (!result.ok) {
    if (wantsRedirect(req, cfg) && cfg.errorRedirect) return redirect(res, cfg.errorRedirect);
    return send(res, 400, {
      success: false,
      error: 'Certains champs sont incomplets.',
      fields: result.errors
    });
  }

  try {
    await mail.sendContactEmail(result.data, cfg, {
      origin: req.headers.origin || '',
      ip: clientIp(req)
    });
  } catch (err) {
    console.error('[contact] envoi impossible :', err && err.message);
    if (wantsRedirect(req, cfg) && cfg.errorRedirect) return redirect(res, cfg.errorRedirect);
    return send(res, 500, {
      success: false,
      error: "L'envoi a échoué. Réessayez dans un instant ou écrivez-nous directement."
    });
  }

  if (wantsRedirect(req, cfg)) return redirect(res, cfg.successRedirect);
  return send(res, 200, { success: true });
}

module.exports = { handleContact: handleContact, applyCors: applyCors, isSameOrigin: isSameOrigin };
