/*
  SPELLCHECK: SymSpell-style symmetric-delete correction

  StaticVault uses this module before the local/TMDB result retry path. It keeps
  the existing public API while making the dictionary more tolerant of
  apostrophes, hyphens, punctuation, and missing spaces.

  The algorithm:
  - Index each dictionary term plus practical variants.
  - Generate delete-only candidates from those variants.
  - Generate delete-only candidates from the user query.
  - Intersect both sets, then verify with Damerau-Levenshtein distance.

  It catches common search mistakes:
  - missing letters, extra letters, wrong letters, and adjacent swaps
  - "spidermna" -> delete variants -> "spider-man" candidate -> verified
  - "dont worry" -> apostrophe-free form -> "don't worry darling"
  - "madmax" -> no-space variant -> "mad max"
  - "spider man" -> hyphen/space variant -> "spider-man"

  It does not understand meaning or synonyms, and it intentionally avoids
  aggressive rewrites of short or already-good searches.
*/

import { fold } from './normalize.js';

const MAX_EDIT = 2;
const PREFIX_LEN = 7;
const MIN_WORD_LEN = 3;
const MIN_PHRASE_LEN = 5;

const _deletes = new Map();
const _freq = new Map();
const _canonical = new Map();
const _canonicalFreq = new Map();
let _seeded = false;

/* -------------------------------------------------------------------------
   Normalization and variant helpers
   ------------------------------------------------------------------------- */

/* Keep a displayable dictionary term while normalizing case and spacing. */
function _canonicalize(term) {
  return String(term || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* Shared folded form. Handles null safely and follows search normalization. */
function _foldForm(term) {
  return fold(term);
}

/* Space-free form for missing-space searches like "lordoftherings". */
function _tightForm(term) {
  return _foldForm(term).replace(/ /g, '');
}

/* Create lookup variants for one dictionary term.
   Variants cover apostrophes, hyphens as spaces, hyphens removed, and no-space
   phrase forms. All variants point back to the canonical dictionary term. */
function _termForms(term) {
  const raw = _canonicalize(term);
  const forms = new Set();
  const folded = _foldForm(raw);
  if (folded) forms.add(folded);

  const apostropheless = _foldForm(raw.replace(/['']/g, ''));
  if (apostropheless) forms.add(apostropheless);

  if (/-/.test(raw)) {
    const hyphenAsSpace = _foldForm(raw.replace(/-/g, ' '));
    const hyphenless = _foldForm(raw.replace(/-/g, ''));
    if (hyphenAsSpace) forms.add(hyphenAsSpace);
    if (hyphenless) forms.add(hyphenless);
  }

  const tight = _tightForm(raw);
  if (tight && tight !== folded) forms.add(tight);
  return [...forms].filter(form => form.length >= 2);
}

/* Mirror dictionary variants for user input. This lets "wall e" meet "wall-e"
   and "spiderman" meet "spider-man" from either direction. */
function _queryForms(query) {
  const raw = String(query || '').toLowerCase().trim();
  const forms = new Set();
  const folded = _foldForm(raw);
  if (folded) forms.add(folded);

  const tight = _tightForm(raw);
  if (tight) forms.add(tight);

  if (/-/.test(raw)) {
    const hyphenAsSpace = _foldForm(raw.replace(/-/g, ' '));
    const hyphenless = _foldForm(raw.replace(/-/g, ''));
    if (hyphenAsSpace) forms.add(hyphenAsSpace);
    if (hyphenless) forms.add(hyphenless);
  }

  return [...forms].filter(Boolean);
}

/* Allow a typed phrase to match the start of a longer title. This is useful for
   "dont worry" -> "don't worry darling", but only phrase-like inputs use it. */
function _prefixDistance(queryForm, candidateForm, maxEdit) {
  if (!queryForm || !candidateForm || candidateForm.length < queryForm.length) return maxEdit + 1;
  return damerau(queryForm, candidateForm.slice(0, queryForm.length), maxEdit);
}

/* Stable ranking: distance first, then frequency, then shorter canonical term. */
function _isBetterCandidate(next, best) {
  if (!best) return true;
  if (next.distance !== best.distance) return next.distance < best.distance;
  if (next.freq !== best.freq) return next.freq > best.freq;
  if (next.term.length !== best.term.length) return next.term.length < best.term.length;
  return next.term.localeCompare(best.term) < 0;
}

/* -------------------------------------------------------------------------
   Symmetric-delete indexing
   ------------------------------------------------------------------------- */

/* Generate delete variants up to maxDepth. This is why a typo and a correct
   dictionary term can meet through a shared shortened form. */
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

/* Store one folded lookup form in the delete index. */
function _indexForm(form) {
  const prefix = form.slice(0, PREFIX_LEN);
  const variants = _deleteVariants(prefix, MAX_EDIT);
  variants.add(prefix);
  variants.forEach(variant => {
    let set = _deletes.get(variant);
    if (!set) {
      set = new Set();
      _deletes.set(variant, set);
    }
    set.add(form);
  });
}

/* Add one term to the dictionary. Null, empty, and one-letter forms are ignored.
   Repeated terms update frequency without duplicating delete entries. */
export function addTerm(term, frequency = 1) {
  const canonical = _canonicalize(term);
  if (!canonical || canonical.length < 2) return;

  const freq = Number.isFinite(Number(frequency)) ? Number(frequency) : 1;
  _canonicalFreq.set(canonical, Math.max(_canonicalFreq.get(canonical) || 0, freq));

  _termForms(canonical).forEach(form => {
    const existing = _freq.get(form) || 0;
    _freq.set(form, Math.max(existing, freq));
    if (!_canonical.has(form) || freq >= existing) _canonical.set(form, canonical);
    if (!existing) _indexForm(form);
  });
}

/* Load the seed entertainment dictionary once. The live index still adds real
   TMDB and user-library titles on top of this seed. */
export function loadSeedDictionary() {
  if (_seeded) return Promise.resolve();
  _seeded = true;
  return fetch('src/data/search-custom-dictionary.json')
    .then(r => r.json())
    .then(d => {
      Object.entries(d?.terms || {}).forEach(([term, freq]) => {
        addTerm(term, freq);
        String(term || '').split(/\s+/).forEach(w => {
          if (w.length > 3) addTerm(w, Math.round(Number(freq || 1) / 2));
        });
      });
    })
    .catch(err => console.warn('[SV Search] Seed dictionary failed:', err?.message));
}

/* -------------------------------------------------------------------------
   Distance verification
   ------------------------------------------------------------------------- */

/* Damerau-Levenshtein with early cutoff. It verifies insertions, deletions,
   substitutions, and adjacent swaps after the fast delete-index pass. */
export function damerau(a, b, max = MAX_EDIT) {
  a = String(a || '');
  b = String(b || '');
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;

  const al = a.length;
  const bl = b.length;
  let prevPrev = null;
  let prev = Array.from({ length: bl + 1 }, (_, j) => j);

  for (let i = 1; i <= al; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }
      cur[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = cur;
  }
  return prev[bl];
}

/* -------------------------------------------------------------------------
   Lookup
   ------------------------------------------------------------------------- */

function _candidateForms(form, maxEdit) {
  const prefix = form.slice(0, PREFIX_LEN);
  const variants = _deleteVariants(prefix, maxEdit);
  const candidates = new Set();
  variants.add(prefix);
  variants.forEach(variant => {
    const set = _deletes.get(variant);
    if (set) set.forEach(candidate => candidates.add(candidate));
  });
  return candidates;
}

/* Look up a single word or compact query form. Returns canonical output. */
export function lookupWord(word, maxEdit = MAX_EDIT) {
  const forms = _queryForms(word).filter(form => form.length >= MIN_WORD_LEN);
  if (!forms.length) return null;

  let best = null;
  forms.forEach(form => {
    if (_freq.has(form)) {
      const exact = { term: _canonical.get(form) || form, distance: 0, freq: _freq.get(form) || 1 };
      if (_isBetterCandidate(exact, best)) best = exact;
    }
    _candidateForms(form, maxEdit).forEach(candidate => {
      const distance = damerau(form, candidate, maxEdit);
      if (distance > maxEdit) return;
      const canonical = _canonical.get(candidate) || candidate;
      const next = { term: canonical, distance, freq: _freq.get(candidate) || _canonicalFreq.get(canonical) || 1 };
      if (_isBetterCandidate(next, best)) best = next;
    });
  });
  return best;
}

/* Phrase lookup runs before word-by-word correction. It catches word-boundary
   mistakes like "lordoftherings" and phrase typos like "jujutsu kaisan". */
export function lookupPhrase(q, maxEdit = MAX_EDIT) {
  const forms = _queryForms(q).filter(form => form.length >= MIN_PHRASE_LEN);
  if (!forms.length) return null;

  const folded = _foldForm(q);
  const phraseLike = folded.includes(' ') || forms.some(form => form.length >= 8);
  if (!phraseLike) return null;

  let best = null;
  forms.forEach(form => {
    if (_freq.has(form)) {
      const exact = { term: _canonical.get(form) || form, distance: 0, freq: _freq.get(form) || 1 };
      if (_isBetterCandidate(exact, best)) best = exact;
    }
    _candidateForms(form, maxEdit).forEach(candidate => {
      const canonical = _canonical.get(candidate) || candidate;
      const candidateForms = new Set([candidate, _foldForm(canonical), _tightForm(canonical)].filter(Boolean));
      candidateForms.forEach(candidateForm => {
        let distance = damerau(form, candidateForm, maxEdit);
        if (distance > maxEdit && folded.includes(' ')) {
          const prefixDistance = _prefixDistance(form, candidateForm, maxEdit);
          distance = prefixDistance <= maxEdit ? prefixDistance + 1 : prefixDistance;
        }
        if (distance > maxEdit) return;
        const next = { term: canonical, distance, freq: _freq.get(candidate) || _canonicalFreq.get(canonical) || 1 };
        if (_isBetterCandidate(next, best)) best = next;
      });
    });
  });
  return best && (_foldForm(best.term).includes(' ') || /-/.test(best.term)) ? best : null;
}

/* -------------------------------------------------------------------------
   Query correction
   ------------------------------------------------------------------------- */

function _acceptPhraseCorrection(original, hit) {
  if (!hit) return false;
  const folded = _foldForm(original);
  if (!folded || hit.term === folded) return false;
  if (hit.distance === 0) return hit.term !== folded;
  return hit.distance <= (folded.length > 10 ? 2 : 1);
}

function _acceptWordCorrection(word, hit) {
  if (!hit) return false;
  if (word.length < 4 || /^\d+$/.test(word)) return false;
  // distance 0 with a different canonical form is a variant rewrite
  // ("madmax" → "mad max", "xmen" → "x-men") — accept those too
  if (hit.distance === 0) return hit.term !== word;
  return hit.distance <= (word.length > 6 ? 2 : 1);
}

/* Correct a query in two passes: whole phrase first, word-by-word second. */
export function correctQuery(q) {
  const folded = _foldForm(q);
  if (!folded) return { corrected: '', changed: false };

  const phraseHit = lookupPhrase(folded);
  if (_acceptPhraseCorrection(folded, phraseHit)) {
    return { corrected: phraseHit.term, changed: true };
  }

  const words = folded.split(' ').filter(Boolean);
  let changed = false;
  const out = words.map(word => {
    const hit = lookupWord(word);
    if (_acceptWordCorrection(word, hit)) {
      changed = true;
      return hit.term;
    }
    return word;
  });
  const corrected = out.join(' ');
  return { corrected, changed: changed && corrected !== folded };
}

export function dictionarySize() {
  return _canonicalFreq.size;
}
