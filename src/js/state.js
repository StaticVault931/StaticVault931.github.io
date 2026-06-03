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
  { id: 10402, name: 'Music',       icon: 'music_note' },
  { id: 9648,  name: 'Mystery',     icon: 'search' },
];

export const AGE_LEVELS = {
  'G': 0, 'TV-Y': 0, 'TV-G': 0,
  'PG': 1, 'TV-Y7': 1, 'TV-PG': 1,
  'PG-13': 2, 'TV-14': 2,
  'R': 3, 'TV-MA': 3,
  'NC-17': 4,
};

/* ── APP STATE ───────────────────────────────────────────────────── */
export const state = {
  // Persisted user data
  watchlist:        load('sv_watchlist', []),
  liked:            load('sv_liked', []),
  disliked:         load('sv_disliked', []),
  recentlyViewed:   load('sv_recent', []),
  continueWatching: load('sv_continue', {}),

  // Persisted preferences
  ageRating:    load('sv_age', 'PG'),
  prefLikes:    load('sv_pref_likes', []),    // [{id,type,title,poster,score}]
  prefDislikes: load('sv_pref_dislikes', []), // [{id,type,title,poster}]
  prefGenres:   load('sv_pref_genres', []),   // [genreId]
  lastProvider: load('sv_last_provider', 'vidsrc'),

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
  recentlyViewed:   'sv_recent',
  continueWatching: 'sv_continue',
  ageRating:        'sv_age',
  prefLikes:        'sv_pref_likes',
  prefDislikes:     'sv_pref_dislikes',
  prefGenres:       'sv_pref_genres',
  lastProvider:     'sv_last_provider',
};

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
  const idx = state.liked.findIndex(x => x.id == item.id);
  if (idx >= 0) { state.liked.splice(idx, 1); persist('liked'); return false; }
  state.liked.push(item);
  persist('liked');
  return true;
}

export function toggleWatchlist(item) {
  const idx = state.watchlist.findIndex(x => x.id == item.id);
  if (idx >= 0) { state.watchlist.splice(idx, 1); persist('watchlist'); return false; }
  state.watchlist.push(item);
  persist('watchlist');
  return true;
}

export function addDislike(item) {
  if (!state.disliked.some(x => x.id == item.id)) {
    state.disliked.push(item);
    persist('disliked');
  }
}
