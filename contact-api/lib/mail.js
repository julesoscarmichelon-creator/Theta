'use strict';

/**
 * Rendu et envoi de l'e-mail de notification.
 *
 * Deux fournisseurs interchangeables :
 *  - Resend  : une simple requête HTTPS, aucune dépendance à installer ;
 *  - SMTP    : via Nodemailer (utile pour une boîte OVH, Gmail, Infomaniak…).
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Construit sujet, corps texte et corps HTML à partir des données validées. */
function renderEmail(data, cfg, meta) {
  meta = meta || {};

  var subject = cfg.subjectPrefix + ' — ' + data.nom +
    (data.entreprise ? ' (' + data.entreprise + ')' : '');

  var rows = [
    ['Nom', data.nom],
    ['E-mail', data.email],
    ['Entreprise', data.entreprise],
    ['Téléphone', data.telephone],
    ['Sujet', data.sujet]
  ].filter(function (r) { return r[1]; });

  var text = rows.map(function (r) { return r[0] + ' : ' + r[1]; }).join('\n') +
    '\n\nMessage :\n' + data.message +
    '\n\n---\nReçu le ' + new Date().toISOString() +
    (meta.origin ? '\nOrigine : ' + meta.origin : '') +
    (meta.ip ? '\nIP : ' + meta.ip : '');

  var html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.6;color:#0F172A;max-width:640px">' +
    '<h2 style="font-size:17px;margin:0 0 16px">' + escapeHtml(subject) + '</h2>' +
    '<table style="border-collapse:collapse;width:100%;margin-bottom:20px">' +
    rows.map(function (r) {
      return '<tr>' +
        '<td style="padding:6px 12px 6px 0;color:#64748B;white-space:nowrap;vertical-align:top">' +
        escapeHtml(r[0]) + '</td>' +
        '<td style="padding:6px 0">' + escapeHtml(r[1]) + '</td></tr>';
    }).join('') +
    '</table>' +
    '<div style="white-space:pre-wrap;padding:16px;background:#F8FAFC;' +
    'border:1px solid #E2E8F0;border-radius:8px">' + escapeHtml(data.message) + '</div>' +
    '<p style="margin-top:20px;font-size:12px;color:#94A3B8">' +
    'Reçu le ' + escapeHtml(new Date().toLocaleString('fr-FR')) +
    (meta.origin ? ' · ' + escapeHtml(meta.origin) : '') +
    (meta.ip ? ' · IP ' + escapeHtml(meta.ip) : '') +
    '</p></div>';

  return { subject: subject, text: text, html: html };
}

async function sendWithResend(mail, data, cfg) {
  var res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.resendApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: cfg.from,
      to: cfg.to,
      reply_to: data.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html
    })
  });

  if (!res.ok) {
    var detail = await res.text().catch(function () { return ''; });
    throw new Error('Resend a répondu ' + res.status + ' : ' + detail.slice(0, 500));
  }
  return res.json();
}

// Le transporteur SMTP est coûteux à créer : on le garde entre deux appels
// (utile sur un serveur Express, sans effet néfaste en serverless).
var transporter = null;

async function sendWithSmtp(mail, data, cfg) {
  var nodemailer = require('nodemailer');

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.secure,
      auth: { user: cfg.smtp.user, pass: cfg.smtp.pass }
    });
  }

  return transporter.sendMail({
    from: cfg.from,
    to: cfg.to.join(', '),
    replyTo: data.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html
  });
}

/** Envoie la demande sur la boîte configurée. Lève une erreur en cas d'échec. */
async function sendContactEmail(data, cfg, meta) {
  var mail = renderEmail(data, cfg, meta);
  if (cfg.provider === 'resend') return sendWithResend(mail, data, cfg);
  return sendWithSmtp(mail, data, cfg);
}

module.exports = {
  sendContactEmail: sendContactEmail,
  renderEmail: renderEmail,
  escapeHtml: escapeHtml
};
