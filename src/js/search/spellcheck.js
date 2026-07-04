/* ── SPELLCHECK — SymSpell-style symmetric-delete correction ─────────
   JS adaptation of the Symmetric Delete algorithm from SymSpell
   (github.com/wolfgarbe/SymSpell, MIT, © Wolf Garbe). The C# library
   can't run in the browser, so this reimplements the core idea:

   Instead of generating every possible edit of a query word (huge), we
   precompute DELETE-only variants of every dictionary term. A lookup
   then generates deletes of the query word and intersects them with the
   precomputed map — covering inserts/replaces/transposes of the query
   because those become deletes of the dictionary term. Candidates are
   verified with real Damerau-Levenshtein distance and ranked by
   (distance, frequency). */

import { fold } from './normalize.js';

const MAX_EDIT = 2;
const PREFIX_LEN = 7; // like SymSpell's prefix optimization — index only word prefixes

const _deletes = new Map();   // deleteVariant → Set of dictionary terms
const _freq = new Map();      // term → frequency weight
let _seeded = false;

function _deleteVariants(word, maxDepth, out = new Set(), depth = 0) {
  if (depth >= maxDepth || word.length <= 2) return out;
  for (let i = 0; i < word.length; i++) {
    const del = word.slice(0, i) + word.slice(i + 1);
    if (!out.has(del)) {
      out.add(del);
      _deleteVariants(del, maxDepth, out, depth + 1);
    }
  }
  return out;
}

/* Add one term (word or phrase word) to the dictionary. */
export function addTerm(term, frequency = 1) {
  const t = fold(term);
  if (!t || t.length < 2) return;
  const existing = _freq.get(t) || 0;
  _freq.set(t, Math.max(existing, frequency));
  if (existing) return; // deletes already indexed

  const prefix = t.slice(0, PREFIX_LEN);
  const variants = _deleteVariants(prefix, MAX_EDIT);
  variants.add(prefix);
  variants.forEach(v => {
    let set = _deletes.get(v);
    if (!set) { set = new Set(); _deletes.set(v, set); }
    set.add(t);
  });
}

/* Load the seed entertainment dictionary (once). */
export function loadSeedDictionary() {
  if (_seeded) return Promise.resolve();
  _seeded = true;
  return fetch('src/data/search-custom-dictionary.json')
    .then(r => r.json())
    .then(d => {
      Object.entries(d.terms || {}).forEach(([term, freq]) => {
        addTerm(term, freq);
        // Also index each word of multi-word terms so single-word typos correct
        term.split(/\s+/).forEach(w => { if (w.length > 3) addTerm(w, Math.round(freq / 2)); });
      });
    })
    .catch(err => console.warn('[SV Search] Seed dictionary failed:', err?.message));
}

/* Damerau-Levenshtein (optimal string alignment) with early cutoff. */
export function damerau(a, b, max = MAX_EDIT) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  let prevPrev = null;
  let prev = Array.from({ length: bl + 1 }, (_, j) => j);
  for (let i = 1; i <= al; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      let cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1; // early exit — row can't recover
    prevPrev = prev;
    prev = cur;
  }
  return prev[bl];
}

/* Look up the best correction for a single word.
   Returns { term, distance, freq } or null when no good candidate. */
export function lookupWord(word, maxEdit = MAX_EDIT) {
  const w = fold(word);
  if (!w || w.length < 3) return null;
  if (_freq.has(w)) return { term: w, distance: 0, freq: _freq.get(w) };

  const prefix = w.slice(0, PREFIX_LEN);
  const candidates = new Set();
  const variants = _deleteVariants(prefix, maxEdit);
  variants.add(prefix);
  variants.forEach(v => {
    const set = _deletes.get(v);
    if (set) set.forEach(t => candidates.add(t));
  });

  let best = null;
  candidates.forEach(t => {
    const d = damerau(w, t, maxEdit);
    if (d > maxEdit) return;
    const freq = _freq.get(t) || 1;
    if (!best || d < best.distance || (d === best.distance && freq > best.freq)) {
      best = { term: t, distance: d, freq };
    }
  });
  return best;
}

/* Correct a whole query word-by-word.
   Returns { corrected, changed } — only proposes when confident. */
export function correctQuery(q) {
  const words = fold(q).split(' ').filter(Boolean);
  let changed = false;
  const out = words.map(w => {
    if (w.length < 4 || /^\d+$/.test(w)) return w; // short/numeric words: leave alone
    const hit = lookupWord(w);
    if (hit && hit.distance > 0 && hit.distance <= (w.length > 6 ? 2 : 1)) {
      changed = true;
      return hit.term;
    }
    return w;
  });
  return { corrected: out.join(' '), changed };
}

export function dictionarySize() { return _freq.size; }
