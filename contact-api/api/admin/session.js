'use strict';

/** Espace privé : /api/admin/session */

var admin = require('../../lib/admin');

module.exports = function (req, res) {
  return admin.handleSession(req, res, process.env);
};
