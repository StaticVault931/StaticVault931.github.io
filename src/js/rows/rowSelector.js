/* ── ROW SELECTOR ────────────────────────────────────────────────────
   Deterministic daily row selection. Same user + same day = same rows in
   the same order; tomorrow it rotates. Selection is metadata-only — no
   fetches happen here, so unselected rows cost zero API calls.

   Rules enforced here:
   • slot-template layout (ROW_SLOT_TEMPLATE cycles until target count)
   • same-kind rows never adjacent
   • chart rows need ≥4 non-chart rows between them
   • cooldowns respected (unless the page can't be filled otherwise)
   • exactly 1 seasonalHuge (if active) + 1 seasonalBig + 1 seasonalSmall
   • target 36 rows, hard cap 40; specials replace weak generic rows */

import { ROW_REGISTRY, ROW_SLOT_TEMPLATE, getRowDef } from './rowRegistry.js';
import { getRowCooldowns, isOnCooldown, dayNumber } from './rowCooldowns.js';
import { engagementBoost } from './rowEngagement.js';

/* Seeded PRNG: xmur3 hash → mulberry32 stream */
export function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHART_GAP = 4; // ≥4 non-chart rows between chart rows

function _isChart(def) { return def.kind === 'chart' || (def.tags || []).includes('trending'); }

/* Would placing `def` at the end of `placed` break adjacency/gap rules? */
export function violatesPlacement(def, placed) {
  const prev = placed[placed.length - 1];
  if (prev && prev.kind === def.kind && def.kind !== 'curated') return true; // same-kind adjacency
  if (_isChart(def)) {
    for (let i = Math.max(0, placed.length - CHART_GAP); i < placed.length; i++) {
      if (_isChart(placed[i])) return true;
    }
  }
  return false;
}

/* Main entry.
   options: {
     page: 'home'|'movies'|'tv'|'anime',
     targetCount: 36, hardCap: 40,
     profile: active profile id,
     preferences: { langs: [] },
     visitBump: integer — bump >0 reshuffles within the same day (heavy use),
     extraCandidates: [{id, kind, priority, weight, cooldownDays, pages}] —
       dynamic rows the registry can't know statically (holiday actives,
       language rows, because-you rows),
   } */
export function selectRowsForToday(options = {}) {
  const {
    page = 'home',
    targetCount = 36,
    hardCap = 40,
    profile = 'default',
    preferences = {},
    visitBump = 0,
    extraCandidates = [],
  } = options;

  const today = dayNumber();
  const rand = seededRandom(`${today}|${profile}|${page}|${(preferences.langs || []).join(',')}|v${visitBump}`);

  // Candidate pool: registry rows for this page + dynamic extras.
  // Extras override registry entries with the same id (e.g. a preferred-
  // language country row passed in with boosted priority).
  const byId = new Map();
  ROW_REGISTRY.filter(r => r.enabled !== false && (r.pages || ['home']).includes(page))
    .forEach(r => byId.set(r.id, r));
  extraCandidates.forEach(c => {
    const base = byId.get(c.id) || { weight: 1, cooldownDays: 0, priority: 50, pages: [page], tags: [] };
    byId.set(c.id, { ...base, ...c });
  });
  const pool = [...byId.values()];

  // Score: priority + subtle engagement + seeded jitter for daily rotation
  const score = def =>
    def.priority +
    engagementBoost(def.id) * 10 +
    rand() * 22 -
    (isOnCooldown(def.id, def.cooldownDays, today) ? 30 : 0);

  const scored = pool
    .map(def => ({ def, s: score(def) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.def);

  // Seasonal tiers: exactly one of each that's active (caller pre-filters
  // actives into extraCandidates with these kinds)
  const takeOne = kind => {
    const i = scored.findIndex(d => d.kind === kind);
    return i >= 0 ? scored.splice(i, 1)[0] : null;
  };
  const seasonals = ['seasonalHuge', 'seasonalBig', 'seasonalSmall'].map(takeOne).filter(Boolean);
  // Any leftover seasonal dupes are dropped entirely
  for (let i = scored.length - 1; i >= 0; i--) {
    if (scored[i].kind.startsWith('seasonal')) scored.splice(i, 1);
  }

  // Fill slots. Specials replace weaker generic rows (they're inserted at
  // their template slots and count toward the target, not on top of it).
  const placed = [];
  const used = new Set();
  const want = Math.min(targetCount + seasonals.length > hardCap ? hardCap : targetCount, hardCap);
  let slotIdx = 0;
  let starvation = 0;

  const seasonalQueue = [...seasonals];

  while (placed.length < want && starvation < ROW_SLOT_TEMPLATE.length * 4) {
    const slotKind = ROW_SLOT_TEMPLATE[slotIdx % ROW_SLOT_TEMPLATE.length];
    slotIdx++;

    let pick = null;
    if (slotKind.startsWith('seasonal')) {
      pick = seasonalQueue.find(s => s.kind === slotKind) || null;
      if (pick) seasonalQueue.splice(seasonalQueue.indexOf(pick), 1);
    }
    if (!pick) {
      pick = scored.find(d => !used.has(d.id) && d.kind === slotKind && !violatesPlacement(d, placed)) ||
             // Slot kind exhausted → any legal row keeps the page full
             scored.find(d => !used.has(d.id) && !violatesPlacement(d, placed));
    }
    if (!pick) { starvation++; continue; }
    starvation = 0;
    used.add(pick.id);
    const i = scored.indexOf(pick);
    if (i >= 0) scored.splice(i, 1);
    placed.push(pick);
  }
  // Any seasonal that never found its slot still gets in (replacing tail rows)
  seasonalQueue.forEach(s => {
    if (placed.length >= hardCap) placed.pop();
    // insert at 1/3 depth so specials aren't buried
    placed.splice(Math.floor(placed.length / 3), 0, s);
  });

  // Continue Watching is useful context, not a homepage opener. Keep it
  // available near the top, but never let template fallback place it first.
  if (placed[0]?.id === 'row-continue') {
    const replacement = placed.findIndex((row, index) => index > 0 && row.kind !== 'history');
    if (replacement > 0) [placed[0], placed[replacement]] = [placed[replacement], placed[0]];
  }

  console.info(`[SV Rows] Selected ${placed.length} rows for ${page} (day ${today}, bump ${visitBump})`, placed.map(p => p.id));
  return placed;
}

/* Dev helpers */
import { getRowEngagement, getRowStats } from './rowEngagement.js';
window.SV_DEBUG_ROWS = {
  selectRowsForToday,
  getRowEngagement,
  getRowCooldowns,
  getRowStats,
  registrySize: ROW_REGISTRY.length,
};
