'use strict';

/** Espace privé : /api/admin/login */

var admin = require('../../contact-api/lib/admin');

module.exports = function (req, res) {
  return admin.handleLogin(req, res, process.env);
};
