'use strict';

/** Espace privé : /api/admin/login */

var admin = require('../../lib/admin');

module.exports = function (req, res) {
  return admin.handleLogin(req, res, process.env);
};
