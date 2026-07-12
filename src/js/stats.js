/* ── LONG-TERM STATISTICS LEDGER ─────────────────────────────────────
   Per-profile, day-bucketed usage stats designed so future features fall
   out of the data naturally: yearly "Wrapped"-style recaps, achievements,
   milestones, watch-time analytics, taste evolution.

   Storage (localStorage, per profile):  sv_stats_v1_<profileId>
   {
     v: 1,
     firstUse: ts,
     life: {                       // lifetime aggregates (fast reads)
       watchMs, plays, searches, clipViews, pageViews,
       genres:  { [genreId]: watchMs },
       types:   { movie: watchMs, tv: watchMs, anime: watchMs },
       titles:  { "movie:603": { ms, plays, title } },   // capped at 500
       hours:   { [0-23]: watchMs },   // time-of-day profile
       days:    { [0-6]:  watchMs },   // day-of-week profile
     },
     daily: { "YYYY-MM-DD": { watchMs, plays, searches, clipViews, pageViews } } // 400 days
   }

   Everything is local-only; included in Export All Data; cleared with the
   profile. Writes are batched (800ms) to avoid localStorage thrash.      */

const V = 2;
const MAX_TITLES = 500;
const MAX_DAYS = 400;

function _pid() {
  try { return localStorage.getItem('sv_active_profile') || 'default'; } catch { return 'default'; }
}
const _key = () => `sv_stats_v1_${_pid()}`;

let _cache = null;
let _cacheKey = null;
let _saveT = null;

function _blank() {
  return {
    v: V, firstUse: Date.now(),
    life: { watchMs: 0, plays: 0, searches: 0, clipViews: 0, pageViews: 0, genres: {}, types: {}, titles: {}, hours: {}, days: {} },
    daily: {}, yearly: {},
  };
}

function _aggregate() {
  return {
    watchMs: 0, plays: 0, searches: 0, clipViews: 0, pageViews: 0,
    genres: {}, types: {}, titles: {}, hours: {}, days: {},
    // behavioral favorites — derived from what people actually DO
    langs: {},        // { iso639: watchMs }
    providers: {},    // { providerId: plays }
    actors: {},       // { personId: { ms, name } } capped at 200
    signals: { likeGenres: {}, likeLangs: {}, saveGenres: {} },
  };
}

function _normalize(st) {
  if (!st || typeof st !== 'object') return _blank();
  st.life = { ..._aggregate(), ...(st.life || {}) };
  st.daily ||= {};
  st.yearly ||= {};
  st.v = V;
  st.firstUse ||= Date.now();
  st.lastUse ||= st.firstUse;
  return st;
}

function _load() {
  const k = _key();
  if (_cache && _cacheKey === k) return _cache;
  if (_cache && _cacheKey && _cacheKey !== k) flushStats();
  try { _cache = _normalize(JSON.parse(localStorage.getItem(k) || 'null') || _blank()); }
  catch { _cache = _blank(); }
  _cacheKey = k;
  return _cache;
}

function _save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try { localStorage.setItem(_cacheKey || _key(), JSON.stringify(_cache)); } catch {}
  }, 800);
}

export function flushStats() {
  clearTimeout(_saveT);
  _saveT = null;
  if (!_cache || !_cacheKey) return;
  try { localStorage.setItem(_cacheKey, JSON.stringify(_cache)); } catch {}
}

function _year(st, now = new Date()) {
  const key = String(now.getFullYear());
  st.yearly[key] ||= _aggregate();
  return st.yearly[key];
}

function _touch(st) { st.lastUse = Date.now(); }

function _bumpTitle(agg, item, ms = 0, play = false) {
  if (!item.id || !item.type) return;
  const key = `${item.type}:${item.id}`;
  const title = agg.titles[key] || { ms: 0, plays: 0, title: item.title || '' };
  title.ms += ms;
  if (play) title.plays++;
  if (item.title) title.title = item.title;
  agg.titles[key] = title;
}

function _day(st) {
  const d = new Date().toISOString().slice(0, 10);
  if (!st.daily[d]) {
    st.daily[d] = { watchMs: 0, plays: 0, searches: 0, clipViews: 0, pageViews: 0 };
    // prune oldest days beyond the window
    const keys = Object.keys(st.daily).sort();
    while (keys.length > MAX_DAYS) delete st.daily[keys.shift()];
  }
  return st.daily[d];
}

/* ── Recorders ─────────────────────────────────────────────────────── */

/* A play started (player opened) */
export function recordPlay(item = {}) {
  const st = _load();
  st.life.plays++;
  const year = _year(st);
  year.plays++;
  _bumpTitle(st.life, item, 0, true);
  _bumpTitle(year, item, 0, true);
  _day(st).plays++;
  _touch(st);
  _save();
}

/* Watch time accumulated — call with elapsed ms when a session ends.
   item: { id, type, title, genre_ids } — all optional but the richer the
   data now, the richer the recaps later. */
export function recordWatchTime(ms, item = {}) {
  if (!ms || ms < 1000) return; // ignore sub-second noise
  ms = Math.min(ms, 6 * 3600000); // cap one sitting at 6h (left-open tabs)
  const st = _load();
  const L = st.life;
  const Y = _year(st);
  L.watchMs += ms;
  Y.watchMs += ms;
  _day(st).watchMs += ms;
  const now = new Date();
  L.hours[now.getHours()] = (L.hours[now.getHours()] || 0) + ms;
  L.days[now.getDay()] = (L.days[now.getDay()] || 0) + ms;
  Y.hours[now.getHours()] = (Y.hours[now.getHours()] || 0) + ms;
  Y.days[now.getDay()] = (Y.days[now.getDay()] || 0) + ms;
  if (item.type) {
    L.types[item.type] = (L.types[item.type] || 0) + ms;
    Y.types[item.type] = (Y.types[item.type] || 0) + ms;
  }
  (item.genre_ids || []).forEach(g => {
    L.genres[g] = (L.genres[g] || 0) + ms;
    Y.genres[g] = (Y.genres[g] || 0) + ms;
  });
  if (item.lang) {
    L.langs[item.lang] = (L.langs[item.lang] || 0) + ms;
    Y.langs[item.lang] = (Y.langs[item.lang] || 0) + ms;
  }
  if (item.provider) {
    L.providers[item.provider] = (L.providers[item.provider] || 0) + 1;
    Y.providers[item.provider] = (Y.providers[item.provider] || 0) + 1;
  }
  (item.cast || []).slice(0, 4).forEach(a => {
    if (!a?.id) return;
    for (const agg of [L, Y]) {
      const rec = agg.actors[a.id] || { ms: 0, name: a.name || '' };
      rec.ms += ms; if (a.name) rec.name = a.name;
      agg.actors[a.id] = rec;
    }
  });
  // cap actor map (lifetime only — yearly stays small naturally)
  const aKeys = Object.keys(L.actors);
  if (aKeys.length > 200) {
    aKeys.sort((x, y) => L.actors[x].ms - L.actors[y].ms);
    aKeys.slice(0, aKeys.length - 200).forEach(x => delete L.actors[x]);
  }
  if (item.id && item.type) {
    const k = `${item.type}:${item.id}`;
    const t = L.titles[k] || { ms: 0, plays: 0, title: item.title || '' };
    t.ms += ms; if (item.title) t.title = item.title;
    L.titles[k] = t;
    const keys = Object.keys(L.titles);
    if (keys.length > MAX_TITLES) { // evict the least-watched
      keys.sort((a, b) => L.titles[a].ms - L.titles[b].ms);
      keys.slice(0, keys.length - MAX_TITLES).forEach(x => delete L.titles[x]);
    }
  }
  _bumpTitle(Y, item, ms);
  _touch(st);
  _save();
}

function _recordCounter(key) {
  const st = _load();
  st.life[key]++;
  _year(st)[key]++;
  _day(st)[key]++;
  _touch(st);
  _save();
}
export function recordSearchStat() { _recordCounter('searches'); }
export function recordClipView()   { _recordCounter('clipViews'); }
export function recordPageView()   { _recordCounter('pageViews'); }

/* ── Readers ───────────────────────────────────────────────────────── */

export function getStats() { return _load(); }

/* Human summary for a profile card: "12h watched · 34 plays" */
export function profileUsageSummary(profileId) {
  try {
    const raw = JSON.parse(localStorage.getItem(`sv_stats_v1_${profileId}`) || 'null');
    if (!raw?.life || (!raw.life.watchMs && !raw.life.plays && !raw.life.pageViews)) return null;
    const h = raw.life.watchMs / 3600000;
    const t = h >= 100 ? `${Math.round(h)}h` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(raw.life.watchMs / 60000)}m`;
    return raw.life.watchMs ? `${t} watched Â· ${raw.life.plays || 0} plays` : `${raw.life.plays || 0} plays`;
  } catch { return null; }
}

/* Building block for a future yearly recap ("Wrapped") */
export function yearSummary(year = new Date().getFullYear()) {
  const st = _load();
  const days = Object.entries(st.daily).filter(([d]) => d.startsWith(String(year)));
  const total = k => days.reduce((a, [, v]) => a + (v[k] || 0), 0);
  const yearly = st.yearly?.[String(year)] || _aggregate();
  const topTitles = Object.entries(yearly.titles)
    .sort((a, b) => b[1].ms - a[1].ms).slice(0, 10)
    .map(([k, v]) => ({ key: k, title: v.title, hours: +(v.ms / 3600000).toFixed(1) }));
  const topGenres = Object.entries(yearly.genres)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([g, ms]) => ({ genreId: +g, hours: +(ms / 3600000).toFixed(1) }));
  return {
    year,
    watchHours: +(total('watchMs') / 3600000).toFixed(1),
    plays: total('plays'),
    searches: total('searches'),
    clipViews: total('clipViews'),
    activeDays: days.filter(([, v]) => v.watchMs > 0 || v.plays > 0).length,
    topTitles, topGenres,
    topTypes: Object.entries(yearly.types).sort((a, b) => b[1] - a[1])
      .map(([type, ms]) => ({ type, hours: +(ms / 3600000).toFixed(1) })),
    peakHour: Object.entries(yearly.hours).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    busiestDay: Object.entries(yearly.days).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    detailTrackingSince: st.v >= 2 ? st.firstUse : null,
  };
}

export function lifetimeSummary() {
  const st = _load();
  const L = st.life;
  return {
    firstUse: st.firstUse,
    lastUse: st.lastUse,
    watchHours: +(L.watchMs / 3600000).toFixed(1),
    plays: L.plays,
    searches: L.searches,
    clipViews: L.clipViews,
    pageViews: L.pageViews,
    activeDays: Object.values(st.daily).filter(v => v.watchMs || v.plays || v.searches || v.clipViews || v.pageViews).length,
  };
}

/* Taste signals from explicit actions (like / save) — a second axis of
   "favorite" beyond raw watch time */
export function recordTasteSignal(kind, item = {}) {
  const st = _load();
  const sig = st.life.signals || (st.life.signals = { likeGenres: {}, likeLangs: {}, saveGenres: {} });
  const bump = (map, key) => { if (key !== undefined && key !== null && key !== '') map[key] = (map[key] || 0) + 1; };
  if (kind === 'like') {
    (item.genre_ids || []).forEach(g => bump(sig.likeGenres, g));
    bump(sig.likeLangs, item.lang);
  } else if (kind === 'save') {
    (item.genre_ids || []).forEach(g => bump(sig.saveGenres, g));
  }
  _touch(st);
  _save();
}

/* Favorites across every tracked axis, blending watch time with explicit
   signals — this is what recap/"Wrapped" features read */
export function getFavorites(limit = 5) {
  const st = _load();
  const L = st.life;
  const sig = L.signals || {};
  const top = (obj, map = (k, v) => ({ key: k, value: v })) =>
    Object.entries(obj || {}).sort((a, b) => (b[1].ms ?? b[1]) - (a[1].ms ?? a[1])).slice(0, limit).map(([k, v]) => map(k, v));
  // Genres: watch-time hours + like/save counts blended into one score
  const genreScore = {};
  Object.entries(L.genres || {}).forEach(([g, ms]) => { genreScore[g] = (genreScore[g] || 0) + ms / 3600000; });
  Object.entries(sig.likeGenres || {}).forEach(([g, n]) => { genreScore[g] = (genreScore[g] || 0) + n * 0.75; });
  Object.entries(sig.saveGenres || {}).forEach(([g, n]) => { genreScore[g] = (genreScore[g] || 0) + n * 0.4; });
  return {
    genres: Object.entries(genreScore).sort((a, b) => b[1] - a[1]).slice(0, limit)
      .map(([g, score]) => ({ genreId: +g, score: +score.toFixed(2) })),
    langs: top(L.langs, (k, ms) => ({ lang: k, hours: +(ms / 3600000).toFixed(1) })),
    providers: top(L.providers, (k, n) => ({ providerId: k, plays: n })),
    actors: top(L.actors, (k, v) => ({ personId: +k, name: v.name, hours: +(v.ms / 3600000).toFixed(1) })),
    types: top(L.types, (k, ms) => ({ type: k, hours: +(ms / 3600000).toFixed(1) })),
    titles: top(L.titles, (k, v) => ({ key: k, title: v.title, hours: +(v.ms / 3600000).toFixed(1) })),
  };
}

export function clearStats() {
  _cache = _blank();
  _save();
}

/* Everything, for Export All Data */
export function exportStats() { return _load(); }

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushStats);
