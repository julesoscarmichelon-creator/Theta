'use strict';

/**
 * Sonde de vie : GET /api/health
 * Indique si le service est configuré, sans divulguer ni clé ni adresse.
 */

var config = require('../contact-api/lib/config');

module.exports = function (req, res) {
  var cfg = config.loadConfig(process.env);
  var errors = config.validateConfig(cfg);
  var warnings = config.configWarnings(cfg);

  res.statusCode = errors.length ? 503 : 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: errors.length === 0,
    provider: cfg.provider,
    configured: errors.length === 0,
    missing: errors,
    warnings: warnings
  }));
};
