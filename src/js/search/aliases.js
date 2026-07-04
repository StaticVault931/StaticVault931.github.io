/* ── SEARCH ALIASES ──────────────────────────────────────────────────
   Expands shorthand like "mcu" → "marvel", "lotr" → "lord of the rings".
   Alias data lives in src/data/search-aliases.json so it can be edited
   without touching code. */

import { fold } from './normalize.js';

let _aliases = null;
let _loading = null;

export function loadAliases() {
  if (_aliases) return Promise.resolve(_aliases);
  if (_loading) return _loading;
  _loading = fetch('src/data/search-aliases.json')
    .then(r => r.json())
    .then(d => { _aliases = d.aliases || {}; return _aliases; })
    .catch(err => {
      console.warn('[SV Search] Alias file failed to load:', err?.message);
      _aliases = {};
      return _aliases;
    });
  return _loading;
}

/* Expand a query using the alias map. Whole-query match wins; otherwise
   each token is checked. Returns { query, expanded } where expanded is
   true when something was replaced. */
export function expandAliases(q) {
  if (!_aliases) return { query: q, expanded: false };
  const folded = fold(q);

  // Whole-query alias ("got" → "game of thrones")
  if (_aliases[folded]) return { query: _aliases[folded], expanded: true };

  // Token-level aliases ("mcu movies" → "marvel movies")
  const words = folded.split(' ');
  let changed = false;
  const out = words.map(w => {
    if (_aliases[w]) { changed = true; return _aliases[w]; }
    return w;
  });
  return changed ? { query: out.join(' '), expanded: true } : { query: q, expanded: false };
}
