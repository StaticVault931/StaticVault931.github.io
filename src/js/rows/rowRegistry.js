/* ── UNIFIED ROW REGISTRY ────────────────────────────────────────────
   One metadata record per selectable row. Fetch functions stay where they
   live today (app.js / recommendations.js) — the registry only describes
   rows so the selector can pick + order them. `id` must match the
   existing row/section ids so no fetcher or HTML changes are needed.

   kinds: hero personal chart seasonalHuge seasonalBig seasonalSmall genre
          mood provider country language anime tv movie curated history   */

export const ROW_SLOT_TEMPLATE = [
  'hero', 'personal', 'chart', 'seasonalHuge', 'movie', 'curated',
  'seasonalBig', 'tv', 'anime', 'mood', 'provider', 'seasonalSmall',
  'country', 'genre', 'language', 'curated',
];

/* [month, day] windows (may wrap New Year) */
export function inDateWindow(from, to, now = new Date()) {
  if (!from || !to) return true;
  const cur = (now.getMonth() + 1) * 100 + now.getDate();
  const f = from[0] * 100 + from[1];
  const t = to[0] * 100 + to[1];
  return f <= t ? (cur >= f && cur <= t) : (cur >= f || cur <= t);
}

const R = (id, kind, group, priority, opts = {}) => ({
  id, kind, group, priority,
  weight: 1, cooldownDays: 0, minItems: 10, maxItems: 24,
  pages: ['home'], enabled: true, tags: [],
  ...opts,
});

export const ROW_REGISTRY = [
  // ── Core (pinned — never cool down) ─────────────────────────────
  R('row-continue',        'history',  'core', 100, { pages: ['home'] }),
  R('row-recent',          'history',  'core', 95,  { pages: ['home'] }),
  R('row-foryou',          'personal', 'core', 98,  { pages: ['home', 'movies', 'tv'] }),
  R('row-trending',        'chart',    'core', 96,  { tags: ['trending'] }),
  R('row-top10',           'chart',    'core', 90,  { tags: ['trending'] }),
  R('row-new',             'movie',    'core', 88),
  R('row-boxoffice',       'chart',    'core', 70,  { tags: ['trending'] }),
  R('row-recently-added',  'movie',    'core', 66),
  R('row-new-episodes',    'tv',       'core', 64),
  R('row-sequels',         'movie',    'core', 60),
  R('row-new-to-you',      'personal', 'core', 58),
  R('row-imdb250',         'chart',    'core', 56, { tags: ['trending'], cooldownDays: 2 }),
  R('row-best-tv-ever',    'chart',    'core', 54, { tags: ['trending'], cooldownDays: 2 }),
  R('row-home-anime',      'anime',    'core', 52),
  R('row-seasonal',        'mood',     'core', 50),

  // ── Standard pool (rotating) ────────────────────────────────────
  R('row-toprated',    'movie', 'std', 45, { cooldownDays: 2 }),
  R('row-tv-pop',      'tv',    'std', 44, { cooldownDays: 2 }),
  R('row-airing',      'tv',    'std', 43, { cooldownDays: 2 }),
  R('row-action',      'genre', 'std', 42, { cooldownDays: 2 }),
  R('row-comedy',      'genre', 'std', 41, { cooldownDays: 2 }),
  R('row-horror',      'genre', 'std', 40, { cooldownDays: 2 }),
  R('row-drama',       'genre', 'std', 39, { cooldownDays: 2 }),
  R('row-scifi',       'genre', 'std', 38, { cooldownDays: 2 }),
  R('row-animated',    'genre', 'std', 37, { cooldownDays: 2 }),
  R('row-romance',     'genre', 'std', 36, { cooldownDays: 2 }),
  R('row-kdrama',      'tv',    'std', 35, { cooldownDays: 2 }),
  R('row-thriller-tv', 'tv',    'std', 34, { cooldownDays: 2 }),
  R('row-2020s',       'movie', 'std', 33, { cooldownDays: 3 }),
  R('row-classics',    'movie', 'std', 32, { cooldownDays: 3 }),
  R('row-family',      'genre', 'std', 31, { cooldownDays: 2 }),
  R('row-crime-tv',    'tv',    'std', 30, { cooldownDays: 2 }),
  R('row-comedy-tv',   'tv',    'std', 29, { cooldownDays: 2 }),
  R('row-anime-home2', 'anime', 'std', 28, { cooldownDays: 2 }),

  // ── Country trending ─────────────────────────────────────────────
  R('row-trend-jp', 'country', 'country', 26, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-kr', 'country', 'country', 26, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-gb', 'country', 'country', 25, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-in', 'country', 'country', 25, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-fr', 'country', 'country', 25, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-de', 'country', 'country', 24, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-br', 'country', 'country', 24, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-es', 'country', 'country', 24, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-mx', 'country', 'country', 24, { cooldownDays: 3, tags: ['trending'] }),
  R('row-trend-it', 'country', 'country', 24, { cooldownDays: 3, tags: ['trending'] }),

  // ── Curated catalog (rotating moods & concepts) ──────────────────
  R('row-boredom',        'mood',    'curated', 48),
  R('row-new-streaming',  'movie',   'curated', 47),
  R('row-love-these',     'personal','curated', 46),
  R('row-awards',         'curated', 'curated', 44, { cooldownDays: 2 }),
  R('row-tv-faves',       'tv',      'curated', 27, { cooldownDays: 3 }),
  R('row-retro-tv',       'tv',      'curated', 26, { cooldownDays: 3 }),
  R('row-binge-drama',    'tv',      'curated', 26, { cooldownDays: 2 }),
  R('row-weekend',        'mood',    'curated', 26, { cooldownDays: 2 }),
  R('row-hidden-gems',    'curated', 'curated', 25, { cooldownDays: 2 }),
  R('row-feel-good',      'mood',    'curated', 25, { cooldownDays: 2 }),
  R('row-intense',        'mood',    'curated', 25, { cooldownDays: 2 }),
  R('row-documentary',    'curated', 'curated', 24, { cooldownDays: 3 }),
  R('row-international',  'curated', 'curated', 24, { cooldownDays: 3 }),
  R('row-teen-drama',     'tv',      'curated', 23, { cooldownDays: 3 }),
  R('row-sci-fi-tv',      'tv',      'curated', 23, { cooldownDays: 3 }),
  R('row-comfort',        'mood',    'curated', 23, { cooldownDays: 2 }),
  R('row-discover-new',   'curated', 'curated', 22, { cooldownDays: 2 }),
  R('row-miniseries',     'tv',      'curated', 22, { cooldownDays: 3 }),
  R('row-based-on',       'curated', 'curated', 22, { cooldownDays: 3 }),
  R('row-dark-comedy',    'mood',    'curated', 21, { cooldownDays: 3 }),
  R('row-superhero',      'curated', 'curated', 21, { cooldownDays: 2 }),
  R('row-mystery-film',   'genre',   'curated', 21, { cooldownDays: 3 }),
  R('row-prestige-tv',    'tv',      'curated', 20, { cooldownDays: 3 }),
  R('row-90s-nostalgia',  'curated', 'curated', 20, { cooldownDays: 3 }),
  R('row-anime-mix',      'anime',   'curated', 20, { cooldownDays: 2 }),
  R('row-indie-cinema',   'curated', 'curated', 19, { cooldownDays: 3 }),
  R('row-heist',          'curated', 'curated', 19, { cooldownDays: 3 }),
  R('row-time-travel',    'curated', 'curated', 19, { cooldownDays: 3 }),
  R('row-post-apoc',      'curated', 'curated', 18, { cooldownDays: 3 }),
  R('row-adult-animation','curated', 'curated', 18, { cooldownDays: 3 }),
  R('row-space',          'curated', 'curated', 18, { cooldownDays: 3 }),
  R('row-musicals',       'curated', 'curated', 17, { cooldownDays: 3 }),
  R('row-2000s',          'curated', 'curated', 17, { cooldownDays: 3 }),
  R('row-one-season',     'tv',      'curated', 17, { cooldownDays: 3 }),
];

export function getRowDef(id) {
  return ROW_REGISTRY.find(r => r.id === id) || null;
}
