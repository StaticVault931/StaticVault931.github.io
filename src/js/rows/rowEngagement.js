/* ── ROW ENGAGEMENT + STATS ──────────────────────────────────────────
   Everything is stored LOCALLY in the browser, used only to improve the
   feed and debug row issues, and only leaves the device when the user
   manually exports their data.

   sv_row_engagement_v1 : { [rowId]: { imp, clicks, skips, dwellMs } }
   sv_row_stats_v1      : rolling daily diagnostics (last 14 days)       */

const ENG_KEY = 'sv_row_engagement_v1';
const STATS_KEY = 'sv_row_stats_v1';
const STATS_DAYS = 14;

/* ── Engagement ─────────────────────────────────────────────────── */
let _eng = null;
function _load() {
  if (_eng) return _eng;
  try { _eng = JSON.parse(localStorage.getItem(ENG_KEY) || '{}'); } catch { _eng = {}; }
  return _eng;
}
let _saveT = null;
function _save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try { localStorage.setItem(ENG_KEY, JSON.stringify(_eng)); } catch {}
  }, 800); // batch writes — no localStorage thrash
}
function _row(rowId) {
  const e = _load();
  return e[rowId] || (e[rowId] = { imp: 0, clicks: 0, skips: 0, dwellMs: 0 });
}

export function getRowEngagement(rowId) {
  return rowId ? { ..._row(rowId) } : { ..._load() };
}
export function recordRowImpression(rowId) { _row(rowId).imp++; _save(); }
export function recordRowClick(rowId)      { _row(rowId).clicks++; _save(); }
export function recordRowSkip(rowId)       { _row(rowId).skips++; _save(); }
export function recordRowDwell(rowId, ms)  { if (ms > 0) { _row(rowId).dwellMs += Math.min(ms, 60000); _save(); } }

/* Subtle score modifier: clicks and dwell nudge up, skips nudge down.
   Clamped to ±0.25 so engagement can never dominate selection. */
export function engagementBoost(rowId) {
  const r = _row(rowId);
  if (!r.imp) return 0;
  const clickRate = r.clicks / r.imp;                 // 0..~1
  const skipRate = r.skips / r.imp;                   // 0..1
  const dwellAvg = r.dwellMs / r.imp / 1000;          // seconds per impression
  const boost = clickRate * 0.6 + Math.min(dwellAvg / 20, 1) * 0.1 - skipRate * 0.3;
  return Math.max(-0.25, Math.min(0.25, boost));
}

export function clearRowEngagement() {
  _eng = {};
  try { localStorage.removeItem(ENG_KEY); } catch {}
}

/* ── Daily stats / diagnostics ──────────────────────────────────── */
function _loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '[]'); } catch { return []; }
}
function _todayStats() {
  const all = _loadStats();
  const key = new Date().toISOString().slice(0, 10);
  let day = all.find(d => d.date === key);
  if (!day) {
    day = { date: key, page: 'home', selected: [], shown: [], hiddenThin: [], failed: [], loadTimes: {}, itemCounts: {}, dedupRemoved: {}, errors: [] };
    all.push(day);
    while (all.length > STATS_DAYS) all.shift();
  }
  return { all, day };
}
let _statsT = null;
function _saveStats(all) {
  clearTimeout(_statsT);
  _statsT = setTimeout(() => {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(all)); } catch {}
  }, 800);
}

/* Record one row event. type: selected|shown|hiddenThin|failed|loadTime|
   itemCount|dedupRemoved|error */
export function recordRowStat(type, rowId, value) {
  const { all, day } = _todayStats();
  if (type === 'loadTime') day.loadTimes[rowId] = Math.round(value);
  else if (type === 'itemCount') day.itemCounts[rowId] = value;
  else if (type === 'dedupRemoved') day.dedupRemoved[rowId] = value;
  else if (type === 'error') day.errors.push({ rowId, msg: String(value).slice(0, 120), ts: Date.now() });
  else if (Array.isArray(day[type]) && !day[type].includes(rowId)) day[type].push(rowId);
  _saveStats(all);
}

export function setStatsPageMode(page) {
  const { all, day } = _todayStats();
  day.page = page;
  _saveStats(all);
}

export function getRowStats() { return _loadStats(); }

export function clearRowStats() {
  try { localStorage.removeItem(STATS_KEY); } catch {}
}

/* Compact bundle for Export All Data */
export function exportRowDiagnostics() {
  let cooldowns = {};
  try { cooldowns = JSON.parse(localStorage.getItem('sv_row_cooldowns_v1') || '{}'); } catch {}
  const eng = _load();
  const stats = _loadStats();
  const today = stats[stats.length - 1] || {};
  const topClicked = Object.entries(eng)
    .filter(([, v]) => v.clicks > 0)
    .sort((a, b) => b[1].clicks - a[1].clicks)
    .slice(0, 10)
    .map(([id, v]) => ({ id, clicks: v.clicks, imp: v.imp }));
  return {
    engagement: eng,
    cooldowns,
    stats,
    summary: {
      todaySelected: today.selected?.length || 0,
      todayHiddenThin: today.hiddenThin || [],
      todayFailed: today.failed || [],
      topClicked,
      avgLoadMs: today.loadTimes
        ? Math.round(Object.values(today.loadTimes).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(today.loadTimes).length))
        : 0,
    },
  };
}
