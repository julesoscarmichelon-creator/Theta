'use strict';

/**
 * Chargement d'un fichier `.env` pour le développement local uniquement.
 * En production (Vercel), les variables viennent de l'hébergeur et ce
 * fichier n'existe pas : la fonction est alors sans effet.
 */

var fs = require('fs');
var path = require('path');

function loadEnvFile(file) {
  var target = file || path.join(__dirname, '..', '.env');
  if (!fs.existsSync(target)) return;

  fs.readFileSync(target, 'utf8').split(/\r?\n/).forEach(function (line) {
    var trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;

    var eq = trimmed.indexOf('=');
    if (eq <= 0) return;

    var key = trimmed.slice(0, eq).trim();
    var value = trimmed.slice(eq + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);

    // Une variable déjà définie dans l'environnement reste prioritaire.
    if (!(key in process.env)) process.env[key] = value;
  });
}

module.exports = { loadEnvFile: loadEnvFile };
