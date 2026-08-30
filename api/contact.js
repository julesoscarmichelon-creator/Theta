'use strict';

/**
 * Fonction serverless du site : POST /api/contact
 *
 * Le formulaire de la page d'accueil appelle cette route sur son propre
 * domaine — donc sans CORS, et sans dépendre d'un service tiers. Toute la
 * logique vit dans `contact-api/lib/`, partagée avec le microservice
 * autonome : ce fichier n'est qu'un point d'entrée.
 */

var handler = require('../contact-api/lib/handler');

module.exports = function (req, res) {
  return handler.handleContact(req, res, process.env);
};
