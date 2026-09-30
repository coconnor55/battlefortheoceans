// src/utils/uniqueId.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: UUID helper that works on non-secure origins (http://spinney.local)
//         - crypto.randomUUID is missing outside secure contexts
//         - Falls back to RFC4122-ish random hex when unavailable

const version = 'v0.1.0';

/**
 * Return a unique id string. Prefer crypto.randomUUID when available.
 * @returns {string}
 */
export function uniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (_) {
      // fall through — some environments expose the fn but reject outside secure contexts
    }
  }
  // FALLBACK: non-secure LAN origins (e.g. http://spinney.local) — remove when served over HTTPS
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
