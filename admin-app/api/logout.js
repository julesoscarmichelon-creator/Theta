'use strict';

/** POST /api/logout — efface le cookie de session. */

var auth = require('../lib/auth');
var http = require('../lib/http');

module.exports = function (req, res) {
  if (req.method !== 'POST') return http.methodNotAllowed(res, 'POST');
  var cfg = auth.loadAuth(process.env);
  return http.send(res, 200, { ok: true }, { 'Set-Cookie': auth.clearedCookie(cfg) });
};
