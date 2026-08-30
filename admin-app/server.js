'use strict';

/**
 * Serveur local de développement : reproduit ce que fait Vercel — les
 * fichiers de `public/` en statique, les modules de `api/` sur `/api/*`.
 * Aucune dépendance, `node server.js` suffit.
 *
 * En production, ce fichier n'est jamais exécuté.
 */

require('./lib/load-env').loadEnvFile();

var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = parseInt(process.env.PORT, 10) || 3100;
var PUBLIC_DIR = path.join(__dirname, 'public');

var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function notFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('404');
}

function serveStatic(res, pathname) {
  var rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  var file = path.join(PUBLIC_DIR, rel);

  // Empêche toute remontée hors de `public/` via des `..`.
  if (path.relative(PUBLIC_DIR, file).startsWith('..')) return notFound(res);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound(res);

  res.statusCode = 200;
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}

var server = http.createServer(function (req, res) {
  var url = new URL(req.url, 'http://localhost');

  if (url.pathname.indexOf('/api/') === 0) {
    var name = url.pathname.slice('/api/'.length).replace(/\.js$/, '');
    if (!/^[a-z-]+$/.test(name)) return notFound(res);

    var file = path.join(__dirname, 'api', name + '.js');
    if (!fs.existsSync(file)) return notFound(res);

    // `req.query` est fourni par Vercel en production ; on l'imite ici.
    req.query = {};
    url.searchParams.forEach(function (value, key) { req.query[key] = value; });

    return Promise.resolve()
      .then(function () { return require(file)(req, res); })
      .catch(function (err) {
        console.error('[admin] erreur non rattrapée :', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Erreur interne.' }));
        }
      });
  }

  return serveStatic(res, url.pathname);
});

server.listen(PORT, function () {
  console.log('Administration Theta : http://localhost:' + PORT);
  if (String(process.env.ADMIN_COOKIE_INSECURE || '') !== 'true') {
    console.log('Rappel : en http:// local, ajoutez ADMIN_COOKIE_INSECURE=true dans .env');
  }
});

module.exports = server;
