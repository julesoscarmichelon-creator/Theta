'use strict';

/** Tests de l'authentification. `node test/auth.test.js` */

var assert = require('assert');
var auth = require('../lib/auth');

var env = {
  ADMIN_PASSWORD: 'un-mot-de-passe-assez-long',
  ADMIN_SESSION_SECRET: 'a'.repeat(64),
  ADMIN_SESSION_HOURS: '2'
};

var cfg = auth.loadAuth(env);

// --- Configuration ----------------------------------------------------
assert.deepStrictEqual(auth.validateAuth(cfg), [], 'configuration valide attendue');
assert.strictEqual(auth.validateAuth(auth.loadAuth({})).length, 2, 'deux erreurs attendues');
assert.strictEqual(
  auth.validateAuth(auth.loadAuth({ ADMIN_PASSWORD: 'court', ADMIN_SESSION_SECRET: 'a'.repeat(64) })).length,
  1,
  'un mot de passe trop court doit être refusé'
);

// --- Mot de passe -----------------------------------------------------
assert.ok(auth.checkPassword(cfg, 'un-mot-de-passe-assez-long'));
assert.ok(!auth.checkPassword(cfg, 'un-mot-de-passe-assez-lonG'));
assert.ok(!auth.checkPassword(cfg, ''));
assert.ok(!auth.checkPassword(cfg, undefined));
assert.ok(!auth.checkPassword(cfg, 'x'), 'longueur différente : pas de plantage');
assert.ok(!auth.checkPassword(auth.loadAuth({}), ''), 'sans mot de passe configuré, tout est refusé');

// --- Jetons de session ------------------------------------------------
var token = auth.issueToken(cfg);
assert.ok(auth.verifyToken(cfg, token), 'un jeton frais doit être accepté');
assert.ok(!auth.verifyToken(cfg, token, Date.now() + 3 * 3600 * 1000), 'jeton expiré refusé');
assert.ok(!auth.verifyToken(cfg, token + 'x'), 'signature altérée refusée');
assert.ok(!auth.verifyToken(cfg, 'nimportequoi'), 'jeton sans point refusé');
assert.ok(!auth.verifyToken(cfg, '.abc'), 'expiration vide refusée');
assert.ok(!auth.verifyToken(cfg, 'abc.def'), 'expiration non numérique refusée');

// Une expiration repoussée sans re-signature doit être rejetée.
var far = String(Date.now() + 10 * 24 * 3600 * 1000);
assert.ok(!auth.verifyToken(cfg, far + '.' + token.split('.')[1]), 'jeton rejoué/modifié refusé');

// Un autre secret ne doit pas valider nos jetons.
var other = auth.loadAuth({ ADMIN_PASSWORD: env.ADMIN_PASSWORD, ADMIN_SESSION_SECRET: 'b'.repeat(64) });
assert.ok(!auth.verifyToken(other, token), 'jeton d’un autre secret refusé');

// --- Cookies ----------------------------------------------------------
var cookies = auth.parseCookies('a=1; theta_admin=' + token + '; b=2');
assert.strictEqual(cookies.theta_admin, token);
assert.deepStrictEqual(auth.parseCookies(''), {});
assert.deepStrictEqual(auth.parseCookies(undefined), {});

var setCookie = auth.sessionCookie(cfg, token);
assert.ok(setCookie.indexOf('HttpOnly') !== -1, 'cookie HttpOnly');
assert.ok(setCookie.indexOf('Secure') !== -1, 'cookie Secure');
assert.ok(setCookie.indexOf('SameSite=Strict') !== -1, 'cookie SameSite=Strict');
assert.ok(setCookie.indexOf('Max-Age=7200') !== -1, 'durée de vie alignée sur la session');
assert.ok(auth.clearedCookie(cfg).indexOf('Max-Age=0') !== -1, 'déconnexion : cookie expiré');

var localCfg = auth.loadAuth(Object.assign({}, env, { ADMIN_COOKIE_INSECURE: 'true' }));
assert.ok(auth.sessionCookie(localCfg, token).indexOf('Secure') === -1, 'Secure retirable en local');

// --- isAuthenticated --------------------------------------------------
assert.ok(auth.isAuthenticated(cfg, { headers: { cookie: 'theta_admin=' + token } }));
assert.ok(!auth.isAuthenticated(cfg, { headers: {} }), 'sans cookie : pas de session');
assert.ok(!auth.isAuthenticated(cfg, { headers: { cookie: 'theta_admin=faux' } }));

console.log('auth.test.js : OK');
