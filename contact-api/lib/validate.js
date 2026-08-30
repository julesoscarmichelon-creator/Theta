'use strict';

/**
 * Validation et nettoyage des données du formulaire.
 * Aucune dépendance : les règles sont volontairement simples et explicites.
 */

// Volontairement permissif : le but est d'écarter les fautes de frappe
// évidentes, pas de rejeter une adresse exotique mais valide.
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Caractères de contrôle (hors tabulation et sauts de ligne) : supprimés.
var CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Sauts de ligne dans un champ d'une seule ligne : ils permettraient une
// injection d'en-tête e-mail (un « Bcc: » glissé dans le sujet, par exemple).
var NEWLINE_RE = /[\r\n\t]+/g;

/** Nettoie un champ mono-ligne (nom, e-mail, sujet…). */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_RE, '').replace(NEWLINE_RE, ' ').trim().slice(0, max);
}

/** Nettoie un champ multi-ligne (le message) en conservant les retours. */
function cleanMultiline(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_RE, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

/**
 * @returns {{ ok: true, data: object } | { ok: false, errors: object }}
 */
function validateSubmission(body, cfg) {
  var errors = {};
  var raw = body && typeof body === 'object' ? body : {};
  var rawMessage = typeof raw.message === 'string' ? raw.message : '';

  var nom = clean(raw.nom || raw.name, 120);
  var email = clean(raw.email, 200).toLowerCase();
  var entreprise = clean(raw.entreprise || raw.company, 160);
  var telephone = clean(raw.telephone || raw.phone, 40);
  var sujet = clean(raw.sujet || raw.subject, 160);
  var message = cleanMultiline(rawMessage, cfg.maxMessageLength);

  if (nom.length < 2) errors.nom = 'Merci d’indiquer votre nom (2 caractères minimum).';
  if (!EMAIL_RE.test(email)) errors.email = 'Adresse e-mail invalide.';
  if (message.length < 10) errors.message = 'Merci de détailler votre demande (10 caractères minimum).';
  if (rawMessage.length > cfg.maxMessageLength) {
    errors.message = 'Message trop long (' + cfg.maxMessageLength + ' caractères maximum).';
  }

  if (Object.keys(errors).length) return { ok: false, errors: errors };

  return {
    ok: true,
    data: {
      nom: nom,
      email: email,
      entreprise: entreprise,
      telephone: telephone,
      sujet: sujet,
      message: message
    }
  };
}

/**
 * Signaux anti-spam qui ne doivent PAS être renvoyés au client : on répond
 * `success: true` pour ne pas apprendre au robot ce qui l'a trahi.
 * @returns {string|null} la raison du rejet silencieux, ou null.
 */
function detectSpam(body, cfg) {
  var raw = body && typeof body === 'object' ? body : {};

  // 1. Honeypot : champ invisible qu'un humain ne remplit jamais.
  var honeypot = raw._gotcha || raw.website || raw.hp;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') return 'honeypot';

  // 2. Temps de remplissage : un robot poste instantanément.
  var startedAt = parseInt(raw._t, 10);
  if (Number.isFinite(startedAt) && startedAt > 0) {
    var elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed >= 0 && elapsed < cfg.minSubmitSeconds) return 'too-fast';
  }

  // 3. Heuristique liens : un message bourré d'URL est du spam.
  var message = typeof raw.message === 'string' ? raw.message : '';
  var links = (message.match(/https?:\/\//gi) || []).length;
  if (links >= 4) return 'too-many-links';

  return null;
}

module.exports = {
  validateSubmission: validateSubmission,
  detectSpam: detectSpam,
  clean: clean,
  cleanMultiline: cleanMultiline
};
