'use strict';

/** Espace privé : /api/admin/session */

var admin = require('../../contact-api/lib/admin');

module.exports = function (req, res) {
  return admin.handleSession(req, res, process.env);
};
