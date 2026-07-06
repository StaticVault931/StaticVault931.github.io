/* ── ROW COOLDOWNS ───────────────────────────────────────────────────
   Tracks when each row last appeared so rows genuinely rotate instead of
   the same set showing every day. localStorage: sv_row_cooldowns_v1
   Format: { [rowId]: lastShownDayNumber } (dayNumber = days since epoch) */

const KEY = 'sv_row_cooldowns_v1';

export const dayNumber = (d = new Date()) => Math.floor(d.getTime() / 86400000);

export function getRowCooldowns() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

/* Is this row resting? true = shown too recently, avoid unless needed. */
export function isOnCooldown(rowId, cooldownDays, today = dayNumber()) {
  if (!cooldownDays) return false;
  const last = getRowCooldowns()[rowId];
  return last !== undefined && (today - last) < cooldownDays;
}

/* Record today's shown rows. Also prunes entries older than 30 days. */
export function saveShownRows(rowIds, today = dayNumber()) {
  try {
    const map = getRowCooldowns();
    rowIds.forEach(id => { map[id] = today; });
    Object.keys(map).forEach(k => { if (today - map[k] > 30) delete map[k]; });
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[SV Rows] cooldown save failed:', err?.message);
  }
}

export function clearRowCooldowns() {
  try { localStorage.removeItem(KEY); } catch {}
}
