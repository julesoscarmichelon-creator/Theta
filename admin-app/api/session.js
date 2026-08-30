'use strict';

/**
 * GET /api/session — l'état de la session, pour que les pages statiques
 * sachent si elles doivent rediriger vers la connexion.
 */

var auth = require('../lib/auth');
var http = require('../lib/http');

module.exports = function (req, res) {
  if (req.method !== 'GET') return http.methodNotAllowed(res, 'GET');
  var cfg = auth.loadAuth(process.env);
  return http.send(res, 200, { authenticated: auth.isAuthenticated(cfg, req) });
};
