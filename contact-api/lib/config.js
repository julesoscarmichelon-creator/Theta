'use strict';

/**
 * Lecture et normalisation des variables d'environnement.
 * Tout est centralisé ici pour que le handler reste lisible et que les
 * erreurs de configuration soient repérables d'un coup d'œil.
 */

function list(value) {
  return String(value || '')
    .split(',')
    .map(function (v) { return v.trim(); })
    .filter(Boolean);
}

function int(value, fallback) {
  var n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function loadConfig(env) {
  env = env || process.env;

  var provider = String(env.MAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : 'smtp')).toLowerCase();
  var port = int(env.SMTP_PORT, 587);

  return {
    provider: provider,

    // Adresses
    to: list(env.MAIL_TO),
    from: env.MAIL_FROM || '',
    subjectPrefix: env.MAIL_SUBJECT_PREFIX || 'Nouveau message',

    // Resend
    resendApiKey: env.RESEND_API_KEY || '',

    // SMTP (Nodemailer)
    smtp: {
      host: env.SMTP_HOST || '',
      port: port,
      secure: String(env.SMTP_SECURE || '') === 'true' || port === 465,
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || ''
    },

    // Repli sans JavaScript : un POST de formulaire HTML classique est
    // redirigé vers ces pages plutôt que de laisser du JSON brut à l'écran.
    successRedirect: env.SUCCESS_REDIRECT_URL || '',
    errorRedirect: env.ERROR_REDIRECT_URL || '',

    // Sécurité
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    rateLimitMax: int(env.RATE_LIMIT_MAX, 5),
    rateLimitWindowMs: int(env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    maxMessageLength: int(env.MAX_MESSAGE_LENGTH, 5000),
    minSubmitSeconds: int(env.MIN_SUBMIT_SECONDS, 2)
  };
}

/** Retourne la liste des problèmes de configuration (vide si tout va bien). */
function validateConfig(cfg) {
  var errors = [];

  if (!cfg.to.length) errors.push('MAIL_TO est vide.');
  if (!cfg.from) errors.push('MAIL_FROM est vide.');

  if (cfg.provider === 'resend') {
    if (!cfg.resendApiKey) errors.push('RESEND_API_KEY est vide (MAIL_PROVIDER=resend).');
  } else if (cfg.provider === 'smtp') {
    if (!cfg.smtp.host) errors.push('SMTP_HOST est vide (MAIL_PROVIDER=smtp).');
    if (!cfg.smtp.user) errors.push('SMTP_USER est vide (MAIL_PROVIDER=smtp).');
    if (!cfg.smtp.pass) errors.push('SMTP_PASS est vide (MAIL_PROVIDER=smtp).');
  } else {
    errors.push('MAIL_PROVIDER doit valoir "resend" ou "smtp".');
  }

  return errors;
}

/**
 * Réglages qui n'empêchent pas le service de tourner, mais méritent un
 * signalement. `ALLOWED_ORIGINS` vide n'est pas une erreur : c'est la
 * configuration normale quand le site et l'API partagent un domaine.
 */
function configWarnings(cfg) {
  var warnings = [];

  if (!cfg.allowedOrigins.length) {
    warnings.push('ALLOWED_ORIGINS est vide : seules les pages servies par ce même domaine pourront envoyer le formulaire.');
  }
  if (cfg.allowedOrigins.indexOf('*') !== -1) {
    warnings.push("ALLOWED_ORIGINS contient '*' : n'importe quel site peut utiliser ce formulaire. À réserver aux essais.");
  }

  return warnings;
}

module.exports = {
  loadConfig: loadConfig,
  validateConfig: validateConfig,
  configWarnings: configWarnings
};
