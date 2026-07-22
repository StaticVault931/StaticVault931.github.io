import { recordTasteSignal } from './stats.js';
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
  { id: 12,    name: 'Adventure',   icon: 'explore' },
  { id: 16,    name: 'Animation',   icon: 'animation' },
  { id: 35,    name: 'Comedy',      icon: 'sentiment_very_satisfied' },
  { id: 80,    name: 'Crime',       icon: 'policy' },
  { id: 99,    name: 'Documentary', icon: 'camera_roll' },
  { id: 18,    name: 'Drama',       icon: 'theater_comedy' },
  { id: 10751, name: 'Family',      icon: 'family_restroom' },
  { id: 14,    name: 'Fantasy',     icon: 'auto_awesome' },
  { id: 36,    name: 'History',     icon: 'history_edu' },
  { id: 27,    name: 'Horror',      icon: 'whatshot' },
  { id: 10762, name: 'Kids',        icon: 'child_care' },
  { id: 10402, name: 'Music',       icon: 'music_note' },
  { id: 9648,  name: 'Mystery',     icon: 'search' },
  { id: 10764, name: 'Reality TV',  icon: 'videocam' },
  { id: 10749, name: 'Romance',     icon: 'favorite' },
  { id: 878,   name: 'Sci-Fi',      icon: 'rocket_launch' },
  { id: 53,    name: 'Thriller',    icon: 'visibility' },
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
  loved:            load('sv_loved', []),
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
  tasteSkips:      load('sv_taste_skips', {}),
  trailerPreviews: load('sv_trailer_previews', {}),
  kidsTaste:       load('sv_kids_taste', {
    liked: [], loved: [], disliked: [], watched: [], watchlist: [], prefLikes: [], prefDislikes: [], tasteSkips: {}, trailerPreviews: {},
  }),
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
  loved:            'sv_loved',
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
  tasteSkips:         'sv_taste_skips',
  trailerPreviews:    'sv_trailer_previews',
  kidsTaste:          'sv_kids_taste',
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
  const lists = ['watchlist', 'liked', 'loved', 'disliked', 'watched', 'recentlyViewed', 'prefLikes', 'prefDislikes'];
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

  // Love used to exist only as a prefLikes score. Preserve those signals.
  const lovedKeys = new Set(state.loved.map(mediaKey));
  let lovedChanged = false;
  state.prefLikes.filter(item => Number(item.score) >= 2).forEach(item => {
    const key = mediaKey(item);
    if (lovedKeys.has(key)) return;
    state.loved.push({ ...item, type: mediaType(item) });
    lovedKeys.add(key);
    lovedChanged = true;
  });
  if (lovedChanged) persist('loved');

  const kids = state.kidsTaste && typeof state.kidsTaste === 'object' ? state.kidsTaste : {};
  state.kidsTaste = {
    liked: cleanMediaArray(kids.liked),
    loved: cleanMediaArray(kids.loved),
    disliked: cleanMediaArray(kids.disliked),
    watched: cleanMediaArray(kids.watched),
    watchlist: cleanMediaArray(kids.watchlist),
    prefLikes: cleanMediaArray(kids.prefLikes),
    prefDislikes: cleanMediaArray(kids.prefDislikes),
    tasteSkips: kids.tasteSkips && typeof kids.tasteSkips === 'object' ? kids.tasteSkips : {},
    trailerPreviews: kids.trailerPreviews && typeof kids.trailerPreviews === 'object' ? kids.trailerPreviews : {},
  };
  persist('kidsTaste');

  // The genre picker dropped Western/War & Politics (v118) and then War/
  // Soap (v119). Keep old profiles meaningful instead of leaving invisible
  // selected preferences: history-adjacent picks land on History, soaps on
  // Drama.
  const genreMap = new Map([[37, 36], [10768, 36], [10752, 36], [10766, 18]]);
  ['prefGenres', 'prefGenreDislikes'].forEach(key => {
    const before = JSON.stringify(state[key] || []);
    state[key] = [...new Set((state[key] || []).map(id => genreMap.get(+id) || +id).filter(Boolean))];
    if (JSON.stringify(state[key]) !== before) persist(key);
  });
}

export function mediaType(item, fallback = 'movie') {
  const type = item?.type || item?.media_type || (item?._anime ? 'anime' : '');
  return type === 'tv' || type === 'anime' || type === 'movie' ? type : fallback;
}

export function mediaKey(item, fallback = 'movie') {
  return `${mediaType(item, fallback)}:${Number(item?.id) || 0}`;
}

function sameMedia(item, id, type) {
  if (+item?.id !== +id) return false;
  return !type || mediaType(item) === type;
}

export function persist(key) {
  if (PERSIST_MAP[key]) store(PERSIST_MAP[key], state[key]);
}

/* ── RECENTLY VIEWED ─────────────────────────────────────────────── */
export function addRecentlyViewed(item) {
  if (!isValidItem(item)) return;
  const key = mediaKey(item);
  state.recentlyViewed = state.recentlyViewed.filter(x => mediaKey(x) !== key);
  state.recentlyViewed.unshift({ ...item, type: mediaType(item), viewedAt: Date.now() });
  if (state.recentlyViewed.length > 60) state.recentlyViewed = state.recentlyViewed.slice(0, 60);
  persist('recentlyViewed');
}

/* ── CONTINUE WATCHING ───────────────────────────────────────────── */
export function saveContinue(id, data) {
  const type = mediaType(data);
  const key = `${type}:${+id}`;
  state.continueWatching[key] = {
    ...state.continueWatching[key],
    ...data,
    id: +id,          // ← always store numeric id so Object.values() includes it
    updatedAt: Date.now(),
  };
  persist('continueWatching');
}

export function getContinue(id, type = null) {
  if (type) return state.continueWatching[`${type}:${+id}`] || state.continueWatching[String(id)] || null;
  return Object.values(state.continueWatching).find(item => +item?.id === +id) || state.continueWatching[String(id)] || null;
}

/* ── WATCHLIST / LIKED ───────────────────────────────────────────── */
function kidsModeActive() {
  try { return !!JSON.parse(localStorage.getItem('sv_settings') || '{}').kidsMode; }
  catch { return false; }
}

export function getActiveTasteState() {
  return kidsModeActive() ? state.kidsTaste : state;
}

export function isLiked(id, type) { return (getActiveTasteState().liked || []).some(x => sameMedia(x, id, type)); }
export function isLoved(id, type) { return (getActiveTasteState().loved || []).some(x => sameMedia(x, id, type)); }
export function isInWatchlist(id, type) { return (kidsModeActive() ? state.kidsTaste.watchlist : state.watchlist).some(x => sameMedia(x, id, type)); }
export function isDisliked(id, type) { return (getActiveTasteState().disliked || []).some(x => sameMedia(x, id, type)); }

export function toggleLike(item) {
  if (!isValidItem(item)) return false; // reject corrupt items
  const taste = getActiveTasteState();
  const idx = taste.liked.findIndex(x => mediaKey(x) === mediaKey(item));
  if (idx >= 0) {
    taste.liked.splice(idx, 1);
    taste.loved = taste.loved.filter(x => mediaKey(x) !== mediaKey(item));
    kidsModeActive() ? persist('kidsTaste') : (persist('liked'), persist('loved'));
    return false;
  }
  taste.liked.push(item);
  kidsModeActive() ? persist('kidsTaste') : persist('liked');
  recordTasteSignal('like', item); // behavioral favorites ledger
  return true;
}

export function getReaction(id, type) {
  if (isLoved(id, type)) return 'love';
  if (isLiked(id, type)) return 'like';
  return 'none';
}

export function setReaction(item, reaction = 'none') {
  if (!isValidItem(item)) return 'none';
  const key = mediaKey(item);
  const compact = { ...item, id: +item.id, type: mediaType(item), media_type: mediaType(item), title: item.title || item.name || '' };
  const without = list => (list || []).filter(entry => mediaKey(entry) !== key);
  const isKids = kidsModeActive();
  const taste = getActiveTasteState();
  taste.liked = without(taste.liked);
  taste.loved = without(taste.loved);
  taste.disliked = without(taste.disliked);
  taste.prefLikes = without(taste.prefLikes);
  taste.prefDislikes = without(taste.prefDislikes);
  if (reaction !== 'none' && taste.tasteSkips[key]) {
    delete taste.tasteSkips[key];
  }
  if (reaction === 'like' || reaction === 'love') {
    taste.liked.unshift(compact);
    if (reaction === 'love') taste.loved.unshift(compact);
    taste.prefLikes.unshift({ ...compact, score: reaction === 'love' ? 2 : 1 });
    recordTasteSignal(reaction, compact);
  }
  if (isKids) persist('kidsTaste');
  else ['liked', 'loved', 'disliked', 'prefLikes', 'prefDislikes', 'tasteSkips'].forEach(persist);
  return reaction;
}

export function cycleReaction(item) {
  const current = getReaction(item?.id, mediaType(item));
  return setReaction(item, current === 'none' ? 'like' : current === 'like' ? 'love' : 'none');
}

export function recordTasteSkip(item) {
  if (!isValidItem(item)) return;
  const key = mediaKey(item);
  const taste = getActiveTasteState();
  const previous = taste.tasteSkips[key] || {};
  taste.tasteSkips[key] = {
    item: { id: +item.id, type: mediaType(item), title: item.title || item.name || '', genre_ids: item.genre_ids || [], original_language: item.original_language || item.lang || '' },
    count: Math.min(20, (previous.count || 0) + 1),
    lastAt: Date.now(),
  };
  const keys = Object.keys(taste.tasteSkips);
  if (keys.length > 300) {
    keys.sort((a, b) => (taste.tasteSkips[b]?.lastAt || 0) - (taste.tasteSkips[a]?.lastAt || 0));
    keys.slice(300).forEach(oldKey => delete taste.tasteSkips[oldKey]);
  }
  kidsModeActive() ? persist('kidsTaste') : persist('tasteSkips');
  recordTasteSignal('skip', item);
}

export function recordTrailerPreview(item, seconds = 0) {
  if (!isValidItem(item) || seconds < 15) return null;
  const taste = getActiveTasteState();
  taste.trailerPreviews ||= {};
  const key = mediaKey(item);
  const previous = taste.trailerPreviews[key] ? { ...taste.trailerPreviews[key] } : null;
  taste.trailerPreviews[key] = {
    item: { id: +item.id, type: mediaType(item), title: item.title || item.name || '', genre_ids: item.genre_ids || [] },
    seconds: Math.min(600, (previous?.seconds || 0) + seconds),
    count: Math.min(10, (previous?.count || 0) + 1),
    lastAt: Date.now(),
  };
  kidsModeActive() ? persist('kidsTaste') : persist('trailerPreviews');
  return previous;
}

export function restoreTrailerPreview(item, previous = null) {
  if (!isValidItem(item)) return;
  const taste = getActiveTasteState();
  taste.trailerPreviews ||= {};
  const key = mediaKey(item);
  if (previous) taste.trailerPreviews[key] = previous;
  else delete taste.trailerPreviews[key];
  kidsModeActive() ? persist('kidsTaste') : persist('trailerPreviews');
}

export function getDiscoveryControls() {
  let stored = {};
  try {
    const pid = localStorage.getItem('sv_active_profile') || 'default';
    stored = JSON.parse(localStorage.getItem(`sv_discovery_controls_${pid}`) || '{}');
  } catch {}
  return {
    familiarity: Math.max(0, Math.min(100, Number(stored.familiarity ?? 55))),
    novelty: Math.max(0, Math.min(100, Number(stored.novelty ?? 50))),
    variety: Math.max(0, Math.min(100, Number(stored.variety ?? 65))),
  };
}

export function setDiscoveryControls(next = {}) {
  const value = { ...getDiscoveryControls(), ...next };
  try {
    const pid = localStorage.getItem('sv_active_profile') || 'default';
    localStorage.setItem(`sv_discovery_controls_${pid}`, JSON.stringify(value));
  } catch {}
  return value;
}

export function getTasteScore(item) {
  if (!item) return 0;
  const genres = new Set((item.genre_ids || []).map(Number));
  const key = mediaKey(item);
  let score = 0;
  const controls = getDiscoveryControls();
  const tasteScale = 0.7 + controls.familiarity / 100 * 0.6;
  const taste = getActiveTasteState();
  if (!kidsModeActive()) {
    (state.prefGenres || []).forEach(g => { if (genres.has(+g)) score += 0.9; });
    (state.prefGenreDislikes || []).forEach(g => { if (genres.has(+g)) score -= 1.8; });
  }
  const matchingContribution = (list, weight, cap) => {
    let contribution = 0;
    for (const source of list || []) {
      const overlap = (source.genre_ids || []).filter(g => genres.has(+g)).length;
      contribution += Math.min(2, overlap) * weight;
      if (Math.abs(contribution) >= Math.abs(cap)) return cap;
    }
    return contribution;
  };
  if ((taste.loved || []).some(source => mediaKey(source) === key)) score += 8;
  else if ((taste.liked || []).some(source => mediaKey(source) === key)) score += 5;
  if ((taste.disliked || []).some(source => mediaKey(source) === key)) score -= 10;
  if ((taste.watched || []).some(source => mediaKey(source) === key)) score += 3;
  if ((taste.watchlist || []).some(source => mediaKey(source) === key)) score += 2;
  score += matchingContribution(taste.loved, 0.55, 3.3) * tasteScale;
  score += matchingContribution(taste.liked, 0.24, 1.8) * tasteScale;
  score += matchingContribution(taste.prefLikes, 0.18, 1.2) * tasteScale;
  score += matchingContribution(taste.disliked, -0.55, -3.3);
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    const anime = item._anime || item._type === 'anime' || item.type === 'anime'
      || (item.original_language === 'ja' && genres.has(16));
    if (anime && settings.animePreference === 'yes') score += 1.1;
  } catch {}
  const now = Date.now();
  let relatedSkipPenalty = 0;
  Object.entries(taste.tasteSkips || {}).forEach(([skipKey, rec]) => {
    const ageDays = (now - (rec?.lastAt || 0)) / 86400000;
    if (ageDays > 45) return;
    const decay = Math.max(0, 1 - ageDays / 45);
    if (skipKey === key) score -= 2 * decay;
    else if ((rec?.item?.genre_ids || []).some(g => genres.has(+g))) {
      relatedSkipPenalty += Math.min(0.18, (rec.count || 1) * 0.04) * decay;
    }
  });
  score -= Math.min(0.9, relatedSkipPenalty);
  Object.entries(taste.trailerPreviews || {}).forEach(([previewKey, rec]) => {
    const ageDays = (now - (rec?.lastAt || 0)) / 86400000;
    if (ageDays > 30) return;
    const decay = Math.max(0, 1 - ageDays / 30);
    if (previewKey === key) score += Math.min(0.7, (rec.seconds || 0) / 60 * 0.35) * decay;
    else if ((rec?.item?.genre_ids || []).some(g => genres.has(+g))) score += 0.08 * decay * tasteScale;
  });
  const impression = state.impressions[key] || state.impressions[item.id];
  const impressionCount = typeof impression === 'number' ? impression : impression?.count || 0;
  score += Math.max(-0.5, (controls.novelty - 50) / 100 * (impressionCount ? -0.7 : 0.45));
  return score;
}

export function toggleWatchlist(item) {
  if (!isValidItem(item)) return false; // reject corrupt items
  const isKids = kidsModeActive();
  const list = isKids ? state.kidsTaste.watchlist : state.watchlist;
  const idx = list.findIndex(x => mediaKey(x) === mediaKey(item));
  if (idx >= 0) { list.splice(idx, 1); persist(isKids ? 'kidsTaste' : 'watchlist'); return false; }
  list.push(item);
  persist(isKids ? 'kidsTaste' : 'watchlist');
  recordTasteSignal('save', item); // behavioral favorites ledger
  return true;
}

export function addDislike(item) {
  if (!isValidItem(item)) return; // reject corrupt items
  const key = mediaKey(item);
  const without = list => (list || []).filter(entry => mediaKey(entry) !== key);
  const isKids = kidsModeActive();
  const taste = getActiveTasteState();
  taste.liked = without(taste.liked);
  taste.loved = without(taste.loved);
  taste.prefLikes = without(taste.prefLikes);
  delete taste.tasteSkips[key];
  if (!taste.disliked.some(x => mediaKey(x) === key)) {
    taste.disliked.push(item);
  }
  if (isKids) persist('kidsTaste');
  else ['liked', 'loved', 'prefLikes', 'tasteSkips', 'disliked'].forEach(persist);
}

/* ── RECENT SEARCHES ─────────────────────────────────────────────── */
/* ── WATCHED ─────────────────────────────────────────────────────── */
export function isWatched(id, type) { return (kidsModeActive() ? state.kidsTaste.watched : state.watched).some(x => sameMedia(x, id, type)); }

export function toggleWatched(item) {
  const isKids = kidsModeActive();
  const list = isKids ? state.kidsTaste.watched : state.watched;
  const idx = list.findIndex(x => mediaKey(x) === mediaKey(item));
  if (idx >= 0) { list.splice(idx, 1); persist(isKids ? 'kidsTaste' : 'watched'); return false; }
  list.push(item);
  persist(isKids ? 'kidsTaste' : 'watched');
  return true;
}

/* ── IMPRESSIONS ─────────────────────────────────────────────────── */
let _impressionSaveTimer = null;
export function recordImpression(id, type = 'movie') {
  const key = `${type}:${+id}`;
  const previous = state.impressions[key] ?? state.impressions[id] ?? 0;
  const count = typeof previous === 'number' ? previous + 1 : (previous.count || 0) + 1;
  state.impressions[key] = { count, lastSeen: Date.now() };
  delete state.impressions[id];
  clearTimeout(_impressionSaveTimer);
  _impressionSaveTimer = setTimeout(() => persist('impressions'), 1000);
}

export function getImpressionPenalty(item, type = 'movie') {
  const id = typeof item === 'object' ? item.id : item;
  const itemType = typeof item === 'object' ? mediaType(item) : type;
  const record = state.impressions[`${itemType}:${+id}`] ?? state.impressions[id] ?? 0;
  const count = typeof record === 'number' ? record : record.count || 0;
  // After 20 unseen impressions, penalize. Linear penalty up to -5 at 100 impressions.
  return Math.min(5, Math.max(0, (count - 20) / 16));
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (_impressionSaveTimer) persist('impressions');
  });
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
