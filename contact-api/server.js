'use strict';

/**
 * Serveur autonome (Express) — pour Render, Railway, un VPS OVH, ou un
 * simple `npm start` en local. Il expose exactement les mêmes routes que
 * la version serverless, en réutilisant le même handler.
 *
 *   POST /api/contact
 *   GET  /api/health
 */

require('./lib/load-env');

var express = require('express');
var handler = require('./lib/handler');
var config = require('./lib/config');

var app = express();
var PORT = parseInt(process.env.PORT, 10) || 3000;

// Render, Railway et OVH placent un proxy devant l'application : sans cela,
// toutes les requêtes sembleraient venir de la même IP locale.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

app.all('/api/contact', function (req, res) {
  handler.handleContact(req, res, process.env);
});

app.get('/api/health', function (req, res) {
  var cfg = config.loadConfig(process.env);
  var errors = config.validateConfig(cfg);
  res.status(errors.length ? 503 : 200).json({
    ok: errors.length === 0,
    provider: cfg.provider,
    configured: errors.length === 0,
    missing: errors,
    warnings: config.configWarnings(cfg)
  });
});

app.use(function (req, res) {
  res.status(404).json({ success: false, error: 'Route inconnue.' });
});

if (require.main === module) {
  var startupErrors = config.validateConfig(config.loadConfig(process.env));
  if (startupErrors.length) {
    console.warn('[contact] configuration incomplète : ' + startupErrors.join(' '));
  }
  app.listen(PORT, function () {
    console.log('Microservice de contact à l\'écoute sur http://localhost:' + PORT);
  });
}

module.exports = app;
