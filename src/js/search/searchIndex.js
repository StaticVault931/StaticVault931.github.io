/* ── LOCAL SEARCH INDEX ──────────────────────────────────────────────
   A small client-side index of titles the user is likely to search:
   trending + popular movies/TV from TMDB, plus everything in the user's
   own library (watchlist / liked / history). Powers instant local
   matches and feeds the spellcheck dictionary with real title words.

   Cached in localStorage for 24h; rebuilt in the background when stale. */

import { tmdb } from '../api.js';
import { state } from '../state.js';
import { addTerm } from './spellcheck.js';
import { fold } from './normalize.js';

const CACHE_KEY = 'sv_search_index_v1';
const TTL = 24 * 3600 * 1000;

let _index = [];          // [{ id, title, type, year, pop, votes, rating, poster, backdrop }]
let _ready = false;
let _building = false;

function _entry(m, type) {
  return {
    id: m.id,
    title: m.title || m.name || '',
    type,
    year: String(m.release_date || m.first_air_date || '').slice(0, 4),
    pop: Math.round(m.popularity || 0),
    votes: m.vote_count || 0,
    rating: m.vote_average || 0,
    poster: m.poster_path || '',
    backdrop: m.backdrop_path || '',
  };
}

function _feedDictionary(entries) {
  entries.forEach(e => {
    if (!e.title) return;
    addTerm(e.title, Math.min(999, 10 + Math.round(e.pop / 5)));
    fold(e.title).split(' ').forEach(w => { if (w.length > 3) addTerm(w, 5); });
  });
}

export function isIndexReady() { return _ready; }

export async function buildIndex() {
  if (_building) return _index;
  _building = true;

  // 1) Serve cache immediately if fresh
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { items, ts } = JSON.parse(raw);
      if (items?.length) {
        _index = items;
        _ready = true;
        _feedDictionary(items);
        if (Date.now() - ts < TTL) { _building = false; return _index; }
        // stale → fall through and rebuild in background
      }
    }
  } catch {}

  // 2) Rebuild from TMDB (trending + popular, movies + tv, 2 pages each)
  try {
    const reqs = [
      tmdb('/trending/movie/week'), tmdb('/trending/tv/week'),
      tmdb('/movie/popular'), tmdb('/tv/popular'),
      tmdb('/movie/popular', { page: 2 }), tmdb('/tv/popular', { page: 2 }),
      tmdb('/movie/top_rated'), tmdb('/tv/top_rated'),
    ];
    const settled = await Promise.allSettled(reqs);
    const seen = new Set();
    const items = [];
    settled.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const type = [0, 2, 4, 6].includes(i) ? 'movie' : 'tv';
      (r.value.results || []).forEach(m => {
        if (!m.id || seen.has(`${type}${m.id}`)) return;
        seen.add(`${type}${m.id}`);
        items.push(_entry(m, type));
      });
    });

    // 3) The user's own content is the most likely search target
    const userItems = [
      ...(state.watchlist || []), ...(state.liked || []),
      ...(state.recentlyViewed || []).slice(0, 40),
    ];
    userItems.forEach(m => {
      const type = m.type === 'tv' ? 'tv' : 'movie';
      if (!m.id || seen.has(`${type}${m.id}`)) return;
      seen.add(`${type}${m.id}`);
      items.push({ id: m.id, title: m.title || '', type, year: m.year || '', pop: 50, votes: 100, rating: m.rating || 0, poster: m.poster || '', backdrop: m.backdrop || '' });
    });

    if (items.length) {
      _index = items;
      _ready = true;
      _feedDictionary(items);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ items, ts: Date.now() })); } catch {}
      console.info(`[SV Search] Local index built: ${items.length} titles`);
    }
  } catch (err) {
    console.warn('[SV Search] Index build failed:', err?.message);
  }
  _building = false;
  return _index;
}

/* Instant local matches for a query — folded substring / prefix scan.
   Fast (array scan over ~600 entries), returns raw entries. */
export function localMatch(query, limit = 8) {
  if (!_ready || !query) return [];
  const q = fold(query);
  if (q.length < 2) return [];
  const starts = [], contains = [];
  for (const e of _index) {
    const t = fold(e.title);
    if (!t) continue;
    if (t === q || t.startsWith(q)) starts.push(e);
    else if (t.includes(q)) contains.push(e);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains]
    .sort((a, b) => (b.votes * b.rating) - (a.votes * a.rating))
    .slice(0, limit);
}

export function getIndex() { return _index; }

export function invalidateIndex() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
  _ready = false;
  _index = [];
}
