'use strict';

/**
 * Sonde de vie : indique si le service tourne et si sa configuration est
 * complète, sans jamais divulguer de clé ni d'adresse.
 */

var config = require('../lib/config');

module.exports = function (req, res) {
  var cfg = config.loadConfig(process.env);
  var errors = config.validateConfig(cfg);

  res.statusCode = errors.length ? 503 : 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: errors.length === 0,
    provider: cfg.provider,
    configured: errors.length === 0,
    missing: errors
  }));
};
