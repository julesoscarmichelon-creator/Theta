'use strict';

/** Espace privé : /api/admin/logout */

var admin = require('../../lib/admin');

module.exports = function (req, res) {
  return admin.handleLogout(req, res, process.env);
};
