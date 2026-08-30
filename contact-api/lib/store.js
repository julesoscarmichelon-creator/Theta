'use strict';

/**
 * Conservation des demandes reçues.
 *
 * Trois modes, choisis automatiquement selon l'environnement :
 *
 *  - `kv`   : Redis en REST (Vercel KV / Upstash). C'est le mode de
 *             production : une simple requête HTTPS, aucune dépendance npm.
 *  - `file` : un fichier JSON local, pour le développement et le serveur
 *             Express sur VPS.
 *  - `none` : aucun stockage configuré. Les demandes partent alors par
 *             e-mail uniquement, comme avant l'ajout du tableau de bord.
 *
 * Le stockage ne doit jamais faire échouer une demande : en cas de panne,
 * on journalise et on laisse l'e-mail faire son travail.
 */

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

/** Commande Redis via l'API REST d'Upstash / Vercel KV. */
async function kvCommand(cfg, args) {
  var res = await fetch(cfg.store.url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + cfg.store.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });

  if (!res.ok) {
    var detail = await res.text().catch(function () { return ''; });
    throw new Error('KV a répondu ' + res.status + ' : ' + detail.slice(0, 300));
  }

  var payload = await res.json();
  if (payload && payload.error) throw new Error('KV : ' + payload.error);
  return payload ? payload.result : null;
}

/* ---- Mode fichier ------------------------------------------------------ */

function readFileStore(file) {
  try {
    var raw = fs.readFileSync(file, 'utf8');
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[store] lecture impossible :', err.message);
    return [];
  }
}

function writeFileStore(file, items) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
}

/* ---- API publique ------------------------------------------------------ */

/** Construit l'enregistrement conservé, à partir des données validées. */
function buildEntry(data, meta) {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    nom: data.nom,
    email: data.email,
    entreprise: data.entreprise,
    telephone: data.telephone,
    sujet: data.sujet,
    message: data.message,
    origine: (meta && meta.origin) || '',
    ip: (meta && meta.ip) || ''
  };
}

/**
 * Enregistre une demande. Ne lève jamais : renvoie `false` si le stockage
 * est absent ou en panne, à charge de l'appelant de le journaliser.
 */
async function saveSubmission(entry, cfg) {
  if (cfg.store.mode === 'none') return false;

  if (cfg.store.mode === 'kv') {
    // LPUSH place la plus récente en tête ; LTRIM borne l'historique.
    await kvCommand(cfg, ['LPUSH', cfg.store.key, JSON.stringify(entry)]);
    await kvCommand(cfg, ['LTRIM', cfg.store.key, 0, cfg.store.max - 1]);
    return true;
  }

  var items = readFileStore(cfg.store.file);
  items.unshift(entry);
  writeFileStore(cfg.store.file, items.slice(0, cfg.store.max));
  return true;
}

/**
 * Liste les demandes, la plus récente d'abord.
 * @returns {{ items: object[], total: number }}
 */
async function listSubmissions(cfg, options) {
  options = options || {};
  var offset = Math.max(0, parseInt(options.offset, 10) || 0);
  var limit = Math.min(200, Math.max(1, parseInt(options.limit, 10) || 50));

  if (cfg.store.mode === 'none') return { items: [], total: 0 };

  if (cfg.store.mode === 'kv') {
    var total = await kvCommand(cfg, ['LLEN', cfg.store.key]);
    var rows = await kvCommand(cfg, ['LRANGE', cfg.store.key, offset, offset + limit - 1]);
    var items = (rows || []).map(function (row) {
      try {
        return typeof row === 'string' ? JSON.parse(row) : row;
      } catch (err) {
        return null;
      }
    }).filter(Boolean);
    return { items: items, total: Number(total) || items.length };
  }

  var all = readFileStore(cfg.store.file);
  return { items: all.slice(offset, offset + limit), total: all.length };
}

module.exports = {
  buildEntry: buildEntry,
  saveSubmission: saveSubmission,
  listSubmissions: listSubmissions
};
