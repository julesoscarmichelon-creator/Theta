'use strict';

/**
 * Chargement du fichier `.env` en développement local, sans dépendance.
 * En production (Vercel, Render…), les variables sont déjà dans
 * l'environnement : ce module ne fait alors rien.
 */

var fs = require('fs');
var path = require('path');

var file = path.join(__dirname, '..', '.env');

if (fs.existsSync(file)) {
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
    var trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;

    var eq = trimmed.indexOf('=');
    if (eq === -1) return;

    var key = trimmed.slice(0, eq).trim();
    var value = trimmed.slice(eq + 1).trim();

    // Les guillemets autour de la valeur sont optionnels.
    if (value.length > 1 && /^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);

    // Une variable déjà définie dans l'environnement reste prioritaire.
    if (!(key in process.env)) process.env[key] = value;
  });
}
