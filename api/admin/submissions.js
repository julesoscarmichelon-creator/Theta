'use strict';

/** Espace privé : liste des demandes reçues (/api/admin/submissions). */

var admin = require('../../contact-api/lib/admin');

module.exports = function (req, res) {
  return admin.handleSubmissions(req, res, process.env);
};
