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

const V = 1;
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
    daily: {},
  };
}

function _load() {
  const k = _key();
  if (_cache && _cacheKey === k) return _cache;
  try { _cache = JSON.parse(localStorage.getItem(k) || 'null') || _blank(); }
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
  _day(st).plays++;
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
  L.watchMs += ms;
  _day(st).watchMs += ms;
  const now = new Date();
  L.hours[now.getHours()] = (L.hours[now.getHours()] || 0) + ms;
  L.days[now.getDay()] = (L.days[now.getDay()] || 0) + ms;
  if (item.type) L.types[item.type] = (L.types[item.type] || 0) + ms;
  (item.genre_ids || []).forEach(g => { L.genres[g] = (L.genres[g] || 0) + ms; });
  if (item.id && item.type) {
    const k = `${item.type}:${item.id}`;
    const t = L.titles[k] || { ms: 0, plays: 0, title: item.title || '' };
    t.ms += ms; t.plays++; if (item.title) t.title = item.title;
    L.titles[k] = t;
    const keys = Object.keys(L.titles);
    if (keys.length > MAX_TITLES) { // evict the least-watched
      keys.sort((a, b) => L.titles[a].ms - L.titles[b].ms);
      keys.slice(0, keys.length - MAX_TITLES).forEach(x => delete L.titles[x]);
    }
  }
  _save();
}

export function recordSearchStat() { const st = _load(); st.life.searches++; _day(st).searches++; _save(); }
export function recordClipView()   { const st = _load(); st.life.clipViews++; _day(st).clipViews++; _save(); }
export function recordPageView()   { const st = _load(); st.life.pageViews++; _day(st).pageViews++; _save(); }

/* ── Readers ───────────────────────────────────────────────────────── */

export function getStats() { return _load(); }

/* Human summary for a profile card: "12h watched · 34 plays" */
export function profileUsageSummary(profileId) {
  try {
    const raw = JSON.parse(localStorage.getItem(`sv_stats_v1_${profileId}`) || 'null');
    if (!raw?.life?.watchMs) return null;
    const h = raw.life.watchMs / 3600000;
    const t = h >= 100 ? `${Math.round(h)}h` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(raw.life.watchMs / 60000)}m`;
    return `${t} watched`;
  } catch { return null; }
}

/* Building block for a future yearly recap ("Wrapped") */
export function yearSummary(year = new Date().getFullYear()) {
  const st = _load();
  const days = Object.entries(st.daily).filter(([d]) => d.startsWith(String(year)));
  const total = k => days.reduce((a, [, v]) => a + (v[k] || 0), 0);
  const topTitles = Object.entries(st.life.titles)
    .sort((a, b) => b[1].ms - a[1].ms).slice(0, 10)
    .map(([k, v]) => ({ key: k, title: v.title, hours: +(v.ms / 3600000).toFixed(1) }));
  const topGenres = Object.entries(st.life.genres)
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
    peakHour: Object.entries(st.life.hours).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}

export function clearStats() {
  _cache = _blank();
  _save();
}

/* Everything, for Export All Data */
export function exportStats() { return _load(); }
