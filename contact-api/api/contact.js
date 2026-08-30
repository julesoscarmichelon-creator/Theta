'use strict';

/**
 * Point d'entrée serverless (Vercel / Netlify Functions v2 en mode Node).
 * URL publique : https://<votre-projet>.vercel.app/api/contact
 */

var handler = require('../lib/handler');

module.exports = function (req, res) {
  return handler.handleContact(req, res, process.env);
};
