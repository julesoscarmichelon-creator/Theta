'use strict';

/**
 * Limiteur de débit minimaliste, en mémoire.
 *
 * Sur un serveur Express, le compteur est partagé par tout le processus.
 * En serverless, chaque instance a le sien : la protection est alors
 * « au mieux » — elle freine un robot bavard sans être une garantie stricte.
 * C'est suffisant ici, le honeypot et la validation faisant le gros du tri.
 */

var hits = new Map();

function cleanup(now, windowMs) {
  for (var entry of hits) {
    if (now - entry[1].start > windowMs) hits.delete(entry[0]);
  }
}

/**
 * @returns {{ allowed: boolean, retryAfter: number }} retryAfter en secondes.
 */
function check(key, cfg, now) {
  now = now || Date.now();
  if (cfg.rateLimitMax <= 0) return { allowed: true, retryAfter: 0 };

  // La table reste petite : on la balaie quand elle grossit.
  if (hits.size > 5000) cleanup(now, cfg.rateLimitWindowMs);

  var entry = hits.get(key);
  if (!entry || now - entry.start > cfg.rateLimitWindowMs) {
    hits.set(key, { start: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count += 1;
  if (entry.count > cfg.rateLimitMax) {
    return {
      allowed: false,
      retryAfter: Math.ceil((cfg.rateLimitWindowMs - (now - entry.start)) / 1000)
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function reset() {
  hits.clear();
}

module.exports = { check: check, reset: reset };
