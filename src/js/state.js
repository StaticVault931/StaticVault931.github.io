/* ── PERSISTENCE ─────────────────────────────────────────────────── */
export function store(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}
export function load(k, def = null) {
  try {
    const v = localStorage.getItem(k);
    return v != null ? JSON.parse(v) : def;
  } catch { return def; }
}

/* ── CONSTANTS ───────────────────────────────────────────────────── */
export const GENRES = [
  { id: 28,    name: 'Action',      icon: 'sports_martial_arts' },
  { id: 35,    name: 'Comedy',      icon: 'sentiment_very_satisfied' },
  { id: 18,    name: 'Drama',       icon: 'theater_comedy' },
  { id: 27,    name: 'Horror',      icon: 'whatshot' },
  { id: 878,   name: 'Sci-Fi',      icon: 'rocket_launch' },
  { id: 10749, name: 'Romance',     icon: 'favorite' },
  { id: 16,    name: 'Animation',   icon: 'animation' },
  { id: 80,    name: 'Crime',       icon: 'policy' },
  { id: 53,    name: 'Thriller',    icon: 'visibility' },
  { id: 12,    name: 'Adventure',   icon: 'explore' },
  { id: 14,    name: 'Fantasy',     icon: 'auto_awesome' },
  { id: 99,    name: 'Documentary', icon: 'camera_roll' },
  { id: 10751, name: 'Family',      icon: 'family_restroom' },
  { id: 10762, name: 'Kids',        icon: 'child_care' },
  { id: 10402, name: 'Music',       icon: 'music_note' },
  { id: 9648,  name: 'Mystery',     icon: 'search' },
  { id: 10764, name: 'Reality TV',  icon: 'videocam' },
  { id: 10759, name: 'Action & Adventure', icon: 'explore' },
  { id: 10765, name: 'Sci-Fi & Fantasy',   icon: 'auto_fix_high' },
];

export const AGE_LEVELS = {
  'TV-Y':   0,
  'TV-Y7':  1,
  'G':      2, 'TV-G': 2,
  'PG':     3, 'TV-PG': 3,
  'PG-13':  4, 'TV-14': 4,
  'R':      5, 'TV-MA': 5,
  'NC-17':  6,
};

// All ratings in display order
export const ALL_RATINGS = [
  { r: 'TV-Y',   level: 0, desc: 'All children' },
  { r: 'TV-Y7',  level: 1, desc: 'Ages 7+' },
  { r: 'G',      level: 2, desc: 'All ages / TV-G' },
  { r: 'PG',     level: 3, desc: 'Parental guidance / TV-PG' },
  { r: 'PG-13',  level: 4, desc: 'Ages 13+ / TV-14' },
  { r: 'R',      level: 5, desc: 'Restricted / TV-MA' },
  { r: 'NC-17',  level: 6, desc: 'Adults only' },
];

/* ── APP STATE ───────────────────────────────────────────────────── */
export const state = {
  // Persisted user data
  watchlist:        load('sv_watchlist', []),
  liked:            load('sv_liked', []),
  disliked:         load('sv_disliked', []),
  watched:          load('sv_watched', []),        // [{id,type,title,poster_path}]
  impressions:      load('sv_impressions', {}),    // {id: {count, lastSeen}}
  recentlyViewed:   load('sv_recent', []),
  continueWatching: load('sv_continue', {}),
  recentSearches:   load('sv_recent_searches', []),

  // Persisted preferences
  ageRating:    load('sv_age', 'PG'),
  prefLikes:    load('sv_pref_likes', []),    // [{id,type,title,poster,score}]
  prefDislikes: load('sv_pref_dislikes', []), // [{id,type,title,poster}]
  prefGenres:         load('sv_pref_genres', []),          // [genreId] — liked genres
  prefGenreDislikes:  load('sv_pref_genre_dislikes', []),  // [genreId] — disliked genres
  prefTagLikes:    load('sv_pref_tag_likes', []),    // [{id,name}] — liked TMDB keywords
  prefTagDislikes: load('sv_pref_tag_dislikes', []), // [{id,name}] — disliked TMDB keywords
  prefLangs:       load('sv_pref_langs', []),        // [iso639] — preferred audio/content languages ('en','fr',…)
  lastProvider: load('sv_last_provider', 'vidsrc'),

  // Per-account settings
  disabledShortcuts: load('sv_disabled_shortcuts', {}),

  // Runtime (not persisted)
  currentMedia:  null,
  currentPage:   'home',
  heroItems:     [],
  heroIdx:       0,
  heroTimer:     null,
  activeGenreId: null,
  searchFilter:  'all',
  seeAll:        { key: '', title: '', fetcher: null, page: 1, items: [], loading: false },
};

const PERSIST_MAP = {
  watchlist:        'sv_watchlist',
  liked:            'sv_liked',
  disliked:         'sv_disliked',
  watched:          'sv_watched',
  impressions:      'sv_impressions',
  recentlyViewed:   'sv_recent',
  continueWatching: 'sv_continue',
  recentSearches:   'sv_recent_searches',
  ageRating:        'sv_age',
  prefLikes:        'sv_pref_likes',
  prefDislikes:     'sv_pref_dislikes',
  prefGenres:         'sv_pref_genres',
  prefGenreDislikes:  'sv_pref_genre_dislikes',
  prefTagLikes:       'sv_pref_tag_likes',
  prefTagDislikes:    'sv_pref_tag_dislikes',
  prefLangs:          'sv_pref_langs',
  lastProvider:       'sv_last_provider',
  disabledShortcuts:    'sv_disabled_shortcuts',
};

/* ── ITEM VALIDATION ─────────────────────────────────────────────── */
// A valid media item must have a numeric positive ID
export function isValidItem(item) {
  if (!item) return false;
  const id = +item.id;
  return !isNaN(id) && id > 0;
}

// Strip null/corrupt entries from arrays that hold media items
export function cleanMediaArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => isValidItem(item));
}

// Run cleanup on loaded state to remove any corrupt entries
export function cleanState() {
  const lists = ['watchlist', 'liked', 'disliked', 'watched', 'prefLikes', 'prefDislikes'];
  lists.forEach(key => {
    const before = state[key]?.length || 0;
    state[key] = cleanMediaArray(state[key]);
    if (state[key].length !== before) persist(key); // save if anything removed
  });
  // Clean continueWatching
  let cwChanged = false;
  Object.keys(state.continueWatching).forEach(k => {
    const entry = state.continueWatching[k];
    if (!entry || !isValidItem(entry)) { delete state.continueWatching[k]; cwChanged = true; }
  });
  if (cwChanged) persist('continueWatching');
}

export function persist(key) {
  if (PERSIST_MAP[key]) store(PERSIST_MAP[key], state[key]);
}

/* ── RECENTLY VIEWED ─────────────────────────────────────────────── */
export function addRecentlyViewed(item) {
  state.recentlyViewed = state.recentlyViewed.filter(x => x.id !== item.id);
  state.recentlyViewed.unshift({ ...item, viewedAt: Date.now() });
  if (state.recentlyViewed.length > 60) state.recentlyViewed = state.recentlyViewed.slice(0, 60);
  persist('recentlyViewed');
}

/* ── CONTINUE WATCHING ───────────────────────────────────────────── */
export function saveContinue(id, data) {
  state.continueWatching[String(id)] = {
    ...state.continueWatching[String(id)],
    ...data,
    id: +id,          // ← always store numeric id so Object.values() includes it
    updatedAt: Date.now(),
  };
  persist('continueWatching');
}

export function getContinue(id) {
  return state.continueWatching[String(id)] || null;
}

/* ── WATCHLIST / LIKED ───────────────────────────────────────────── */
export function isLiked(id) { return state.liked.some(x => x.id == id); }
export function isInWatchlist(id) { return state.watchlist.some(x => x.id == id); }
export function isDisliked(id) { return state.disliked.some(x => x.id == id); }

export function toggleLike(item) {
  if (!isValidItem(item)) return false; // reject corrupt items
  const idx = state.liked.findIndex(x => x.id == item.id);
  if (idx >= 0) { state.liked.splice(idx, 1); persist('liked'); return false; }
  state.liked.push(item);
  persist('liked');
  return true;
}

export function toggleWatchlist(item) {
  if (!isValidItem(item)) return false; // reject corrupt items
  const idx = state.watchlist.findIndex(x => x.id == item.id);
  if (idx >= 0) { state.watchlist.splice(idx, 1); persist('watchlist'); return false; }
  state.watchlist.push(item);
  persist('watchlist');
  return true;
}

export function addDislike(item) {
  if (!isValidItem(item)) return; // reject corrupt items
  if (!state.disliked.some(x => x.id == item.id)) {
    state.disliked.push(item);
    persist('disliked');
  }
}

/* ── RECENT SEARCHES ─────────────────────────────────────────────── */
/* ── WATCHED ─────────────────────────────────────────────────────── */
export function isWatched(id) { return state.watched.some(x => x.id == id); }

export function toggleWatched(item) {
  const idx = state.watched.findIndex(x => x.id == item.id);
  if (idx >= 0) { state.watched.splice(idx, 1); persist('watched'); return false; }
  state.watched.push(item);
  persist('watched');
  return true;
}

/* ── IMPRESSIONS ─────────────────────────────────────────────────── */
export function recordImpression(id) {
  state.impressions[id] = (state.impressions[id] || 0) + 1;
  // Persist in batches (every 5 impressions) to avoid thrashing localStorage
  if (state.impressions[id] % 5 === 0) persist('impressions');
}

export function getImpressionPenalty(id) {
  const count = state.impressions[id] || 0;
  // After 20 unseen impressions, penalize. Linear penalty up to -5 at 100 impressions.
  return Math.min(5, Math.max(0, (count - 20) / 16));
}

/* ── TAG PREFERENCES ─────────────────────────────────────────────── */
export function isTagLiked(id) { return state.prefTagLikes.some(x => x.id == id); }
export function isTagDisliked(id) { return state.prefTagDislikes.some(x => x.id == id); }

export function toggleTagLike(tag) {
  // tag = {id, name}
  // If already liked, remove. If disliked, move to liked. Else add to liked.
  const disIdx = state.prefTagDislikes.findIndex(x => x.id == tag.id);
  if (disIdx >= 0) { state.prefTagDislikes.splice(disIdx, 1); persist('prefTagDislikes'); }

  const likeIdx = state.prefTagLikes.findIndex(x => x.id == tag.id);
  if (likeIdx >= 0) {
    state.prefTagLikes.splice(likeIdx, 1);
    persist('prefTagLikes');
    return false; // removed
  }
  state.prefTagLikes.push({ id: tag.id, name: tag.name });
  if (state.prefTagLikes.length > 40) state.prefTagLikes = state.prefTagLikes.slice(-40);
  persist('prefTagLikes');
  return true; // added
}

export function toggleTagDislike(tag) {
  // tag = {id, name}
  const likeIdx = state.prefTagLikes.findIndex(x => x.id == tag.id);
  if (likeIdx >= 0) { state.prefTagLikes.splice(likeIdx, 1); persist('prefTagLikes'); }

  const disIdx = state.prefTagDislikes.findIndex(x => x.id == tag.id);
  if (disIdx >= 0) {
    state.prefTagDislikes.splice(disIdx, 1);
    persist('prefTagDislikes');
    return false; // removed
  }
  state.prefTagDislikes.push({ id: tag.id, name: tag.name });
  if (state.prefTagDislikes.length > 40) state.prefTagDislikes = state.prefTagDislikes.slice(-40);
  persist('prefTagDislikes');
  return true; // added
}

/* ── RECENT SEARCHES ─────────────────────────────────────────────── */
export function addRecentSearch(q) {
  if (!q || q.length < 2) return;
  state.recentSearches = state.recentSearches.filter(s => s.toLowerCase() !== q.toLowerCase());
  state.recentSearches.unshift(q);
  if (state.recentSearches.length > 10) state.recentSearches = state.recentSearches.slice(0, 10);
  persist('recentSearches');
}

export function clearRecentSearches() {
  state.recentSearches = [];
  persist('recentSearches');
}
