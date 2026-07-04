/* ── RESULT RANKING ──────────────────────────────────────────────────
   Combines fuzzy title similarity with quality, popularity, and user
   signals into one comparable score. Higher = shown first. */

import { titleScore } from './fuzzy.js';
import { state } from '../state.js';

/* Score one result item against the query. 0–~200 range. */
export function scoreResult(item, query) {
  const title = item.title || item.name || item.romaji || '';
  const tScore = titleScore(query, title);          // 0–100

  // Quality: log-weighted votes × rating (≈0–30)
  const quality = Math.log10((item.vote_count || 1) + 1) * ((item.vote_average || 0) / 3);
  // Popularity (≈0–8)
  const pop = Math.log10((item.popularity || 1) + 1) * 2;

  // User relevance
  let user = 0;
  const id = item.id;
  if (id) {
    if ((state.watchlist || []).some(x => x.id === id)) user += 8;
    if ((state.liked || []).some(x => x.id === id)) user += 6;
    if (state.continueWatching?.[id]) user += 8;
    if ((state.disliked || []).some(x => x.id === id)) user -= 20;
  }
  // Preferred genres nudge
  if (state.prefGenres?.length && item.genre_ids?.length) {
    user += item.genre_ids.filter(g => state.prefGenres.includes(g)).length * 1.5;
  }

  // Keyword/fuzzy-fallback results rank below direct matches
  const fallbackPenalty = (item._keyword ? 25 : 0) + (item._fuzzy ? 10 : 0);

  // No-signal junk (0 votes, no rating) sinks unless the title is a dead-on match
  const junkPenalty = (!item.vote_count && tScore < 95) ? 15 : 0;

  return tScore * 1.4 + quality + pop + user - fallbackPenalty - junkPenalty;
}

/* Sort a result array in place by relevance to the query. */
export function rankResults(items, query) {
  const cache = new Map();
  const score = it => {
    let s = cache.get(it);
    if (s === undefined) { s = scoreResult(it, query); cache.set(it, s); }
    return s;
  };
  items.sort((a, b) => score(b) - score(a));
  return items;
}
