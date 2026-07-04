/* ── SEARCH PIPELINE ─────────────────────────────────────────────────
   Orchestrates the query-preparation steps in front of the TMDB search:

   raw → normalize → alias expansion → spell correction → local index

   Feature flags (togglable from the dev panel, default ON):
     sv_flag_spellcheck — SymSpell-style correction
     sv_flag_fuzzy      — RapidFuzz-style fuzzy ranking
     sv_flag_aliases    — shorthand expansion (mcu → marvel)
     sv_flag_localindex — instant local-index results */

import { fold, extractYear } from './normalize.js';
import { loadAliases, expandAliases } from './aliases.js';
import { loadSeedDictionary, correctQuery, dictionarySize } from './spellcheck.js';
import { buildIndex, localMatch, isIndexReady } from './searchIndex.js';

export function svFlag(name) {
  const v = localStorage.getItem(`sv_flag_${name}`);
  return v === null ? true : v === '1';
}
export function setSvFlag(name, on) {
  localStorage.setItem(`sv_flag_${name}`, on ? '1' : '0');
}

let _initialized = false;
export function initSearchPipeline() {
  if (_initialized) return;
  _initialized = true;
  // Kick off async loads — none of these block the first paint
  loadAliases();
  loadSeedDictionary().then(() => {
    buildIndex().then(() => {
      console.info(`[SV Search] Pipeline ready — dictionary: ${dictionarySize()} terms, index: ${isIndexReady() ? 'ready' : 'pending'}`);
    });
  });
}

/* Prepare a query. Returns:
   {
     original,      // what the user typed
     query,         // what should be sent to TMDB (aliased + corrected)
     year,          // extracted year hint or null
     corrected,     // true if spellcheck changed it
     aliased,       // true if an alias expanded it
     suggestion,    // corrected query string when corrected (for "did you mean")
     localResults,  // instant matches from the local index
   } */
export function prepareQuery(raw) {
  const original = String(raw || '').trim();
  const { clean, year } = extractYear(original);
  let q = fold(clean);
  let aliased = false, corrected = false, suggestion = null;

  if (svFlag('aliases')) {
    const a = expandAliases(q);
    q = fold(a.query);
    aliased = a.expanded;
  }

  if (svFlag('spellcheck')) {
    const c = correctQuery(q);
    if (c.changed) {
      corrected = true;
      suggestion = c.corrected;
      q = c.corrected;
    }
  }

  const localResults = svFlag('localindex') ? localMatch(q) : [];

  return { original, query: q || original, year, corrected, aliased, suggestion, localResults };
}
