/* ── PAGES.JS — runtime page injection ─────────────────────────────
   Injects page-movies, page-tv, page-anime, page-seeall into the DOM
   before the footer. Called once during app init (from app.js).
─────────────────────────────────────────────────────────────────── */

export function injectPages() {
  const footer = document.getElementById('footer');
  if (!footer) return;

  const pages = [
    _buildMoviesPage(),
    _buildTvPage(),
    _buildAnimePage(),
    _buildSeeAllPage(),
    _buildTrailersPage(),
  ];

  pages.forEach(el => footer.before(el));
}

/* ── Sub-nav builder ────────────────────────────────────────────── */
function _subNav(tabs) {
  return `<nav class="page-subnav" aria-label="Page sections">
    ${tabs.map((t, i) => `<button class="page-subnav-btn${i === 0 ? ' on' : ''}" data-subnav-target="${t.target}" aria-pressed="${i === 0}">${t.label}</button>`).join('')}
  </nav>`;
}

/* ── Shared row helpers ─────────────────────────────────────────── */
function _row(rowId, scrollDir = true) {
  const arrows = scrollDir ? `
      <div class="row-arrow row-arrow-l hidden"><button data-scroll-row="${rowId}" data-scroll-dir="-1"><span class="material-icons-round">chevron_left</span></button></div>
      <div class="card-row" id="${rowId}"></div>
      <div class="row-arrow row-arrow-r"><button data-scroll-row="${rowId}" data-scroll-dir="1"><span class="material-icons-round">chevron_right</span></button></div>` : `
      <div class="card-row" id="${rowId}"></div>`;
  return `<div class="row-wrap">${arrows}</div>`;
}

function _section(secId, title, icon, rowId, seeAllKey = '', seeAllTitle = '', iconColor = '') {
  const iconStyle = iconColor ? ` style="color:${iconColor}"` : '';
  const seeAllBtn = seeAllKey
    ? `<button class="see-all-btn" data-see-all="${seeAllKey}" data-see-all-title="${seeAllTitle}">See all <span class="material-icons-round">chevron_right</span></button>`
    : '';
  return `
  <div class="section" id="${secId}">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon"${iconStyle}>${icon}</span>${title}</div>
      ${seeAllBtn}
    </div>
    ${_row(rowId)}
  </div>`;
}

/* ── PAGE: MOVIES ───────────────────────────────────────────────── */
function _buildMoviesPage() {
  const el = document.createElement('main');
  el.className = 'page';
  el.id = 'page-movies';
  el.innerHTML = `
  <div style="padding-top:74px"></div>

  ${_subNav([
    { label: 'For You',    target: 'sec-movies-foryou' },
    { label: 'Popular',   target: 'sec-movies-pop' },
    { label: 'Top Rated', target: 'sec-movies-top' },
    { label: 'New',       target: 'sec-movies-new' },
    { label: 'Action',    target: 'sec-movies-action' },
    { label: 'Comedy',    target: 'sec-movies-comedy' },
    { label: 'Horror',    target: 'sec-movies-horror' },
    { label: 'Sci-Fi',    target: 'sec-movies-scifi' },
    { label: 'Romance',   target: 'sec-movies-romance' },
    { label: 'Animated',  target: 'sec-movies-animated' },
    { label: 'Docs',      target: 'sec-movies-docs' },
  ])}

  <div class="section" id="sec-movies-foryou">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon" style="color:var(--red)">auto_awesome</span>Movies For You</div>
    </div>
    ${_row('row-movies-foryou')}
  </div>

  ${_section('sec-movies-pop',      'Popular Movies',          'movie',               'row-movies-pop',      'movies-popular',   'Popular Movies',       '')}
  ${_section('sec-movies-top',      'Top Rated Movies',        'workspace_premium',   'row-movies-top',      'movies-top',       'Top Rated Movies',     '#f5c518')}
  ${_section('sec-movies-new',      'Now Playing',             'fiber_new',           'row-movies-new',      'movies-new',       'Now Playing',          '#22c55e')}
  ${_section('sec-movies-up',       'Coming Soon',             'upcoming',            'row-movies-up',       'movies-upcoming',  'Upcoming Movies',      '#06b6d4')}
  ${_section('sec-movies-2024',     `Best of ${new Date().getFullYear() - 1}`, 'calendar_today', 'row-movies-2024', 'movies-2024', `Best of ${new Date().getFullYear() - 1}`, '#a78bfa')}
  ${_section('sec-movies-action',   'Action Movies',           'sports_martial_arts', 'row-movies-action',   'genre-28',         'Action Movies',        '')}
  ${_section('sec-movies-comedy',   'Comedy Movies',           'sentiment_very_satisfied','row-movies-comedy','genre-35',        'Comedy Movies',        '#f59e0b')}
  ${_section('sec-movies-horror',   'Horror Movies',           'dark_mode',           'row-movies-horror',   'genre-27',         'Horror Movies',        '#ef4444')}
  ${_section('sec-movies-thriller', 'Thrillers',               'visibility',          'row-movies-thriller', 'genre-53',         'Thrillers',            '')}
  ${_section('sec-movies-scifi',    'Sci-Fi Movies',           'rocket_launch',       'row-movies-scifi',    'genre-878',        'Sci-Fi Movies',        '#6366f1')}
  ${_section('sec-movies-romance',  'Romance Movies',          'favorite',            'row-movies-romance',  'genre-10749',      'Romance Movies',       '#ec4899')}
  ${_section('sec-movies-animated', 'Animated Movies',         'animation',           'row-movies-animated', 'genre-16',         'Animated Movies',      '#22c55e')}
  ${_section('sec-movies-crime',    'Crime Movies',            'policy',              'row-movies-crime',    'genre-80',         'Crime Movies',         '')}
  ${_section('sec-movies-docs',     'Documentaries',           'camera_roll',         'row-movies-docs',     'genre-99',         'Documentaries',        '')}
  ${_section('sec-movies-2010s',    'Best of the 2010s',       'history',             'row-movies-2010s',    'movies-2010s',     'Best of the 2010s',    '#f97316')}
  ${_section('sec-movies-foreign',  'Foreign Language Films',  'language',            'row-movies-foreign',  'movies-foreign',   'Foreign Language Films','')}

  <div style="height:3rem"></div>`;
  return el;
}

/* ── PAGE: TV SHOWS ─────────────────────────────────────────────── */
function _buildTvPage() {
  const el = document.createElement('main');
  el.className = 'page';
  el.id = 'page-tv';
  el.innerHTML = `
  <div style="padding-top:74px"></div>

  ${_subNav([
    { label: 'For You',   target: 'sec-tv-foryou' },
    { label: 'Popular',   target: 'sec-tv-popular' },
    { label: 'Top Rated', target: 'sec-tv-top' },
    { label: 'Airing',    target: 'sec-tv-air' },
    { label: 'Crime',     target: 'sec-tv-crime' },
    { label: 'Sci-Fi',    target: 'sec-tv-scifi' },
    { label: 'Comedy',    target: 'sec-tv-comedy' },
    { label: 'K-Drama',   target: 'sec-tv-kdrama' },
    { label: 'Thriller',  target: 'sec-tv-thriller' },
    { label: 'Animation', target: 'sec-tv-animated' },
    { label: 'Reality',   target: 'sec-tv-reality' },
  ])}

  <div class="section" id="sec-tv-foryou">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon" style="color:var(--red)">auto_awesome</span>TV Shows For You</div>
    </div>
    ${_row('row-tv-foryou')}
  </div>

  ${_section('sec-tv-popular',  'Popular TV Shows',       'tv',               'row-tv-popular',  'tv-popular',   'Popular TV Shows',      '')}
  ${_section('sec-tv-top',      'Top Rated TV',           'workspace_premium','row-tv-top',      'tv-top',       'Top Rated TV',          '#f5c518')}
  ${_section('sec-tv-air',      'Airing Today',           'live_tv',          'row-tv-air',      'tv-airing',    'Airing Today',          '#22c55e')}
  ${_section('sec-tv-crime',    'Crime &amp; Drama',      'policy',           'row-tv-crime',    'tv-crime',     'Crime &amp; Drama',     '')}
  ${_section('sec-tv-scifi',    'Sci-Fi &amp; Fantasy',   'rocket_launch',    'row-tv-scifi',    'tv-scifi',     'Sci-Fi &amp; Fantasy',  '#6366f1')}
  ${_section('sec-tv-thriller', 'Thriller Series',        'visibility',       'row-tv-thriller', 'tv-thriller',  'Thriller Series',       '')}
  ${_section('sec-tv-comedy',   'Comedy Shows',           'sentiment_very_satisfied','row-tv-comedy','genre-35-tv','Comedy Shows',         '#f59e0b')}
  ${_section('sec-tv-kdrama',   'Korean Dramas',          'flag',             'row-tv-kdrama',   'tv-kdrama',    'Korean Dramas',         '#ec4899')}
  ${_section('sec-tv-mystery',  'Mystery &amp; Crime',    'search',           'row-tv-mystery',  'tv-mystery',   'Mystery &amp; Crime',   '')}
  ${_section('sec-tv-reality',  'Reality TV',             'emoji_events',     'row-tv-reality',  'tv-reality',   'Reality TV',            '#f97316')}
  ${_section('sec-tv-animated', 'Animated Series',        'animation',        'row-tv-animated', 'tv-animated',  'Animated Series',       '#22c55e')}
  ${_section('sec-tv-limited',  'Limited Series',         'auto_stories',     'row-tv-limited',  'tv-limited',   'Limited Series',        '#a78bfa')}
  ${_section('sec-tv-family',   'Family TV',              'family_restroom',  'row-tv-family',   'tv-family',    'Family TV',             '')}

  <div style="height:3rem"></div>`;
  return el;
}

/* ── PAGE: ANIME ────────────────────────────────────────────────── */
function _buildAnimePage() {
  const el = document.createElement('main');
  el.className = 'page';
  el.id = 'page-anime';
  el.innerHTML = `
  <div style="padding-top:74px"></div>

  ${_subNav([
    { label: 'Trending',  target: 'sec-anime-trend' },
    { label: 'Top Rated', target: 'sec-anime-top' },
    { label: 'Airing',    target: 'sec-anime-airing' },
    { label: 'Action',    target: 'sec-anime-action' },
    { label: 'Romance',   target: 'sec-anime-romance' },
    { label: 'Fantasy',   target: 'sec-anime-isekai' },
    { label: 'Sports',    target: 'sec-anime-sports' },
    { label: 'Comedy',    target: 'sec-anime-comedy' },
    { label: 'Horror',    target: 'sec-anime-horror' },
    { label: 'Mecha',     target: 'sec-anime-mecha' },
    { label: 'Movies',    target: 'sec-anime-movie' },
  ])}

  ${_section('sec-anime-trend',   'Trending Anime',          'local_fire_department','row-anime-trend',   'anime-trending', 'Trending Anime',           '#f97316')}
  ${_section('sec-anime-top',     'Top Rated Anime',         'workspace_premium',    'row-anime-top',     'anime-top',      'Top Rated Anime',          '#f5c518')}
  ${_section('sec-anime-airing',  'Currently Airing',        'fiber_new',            'row-anime-airing',  'anime-airing',   'Currently Airing',         '#22c55e')}
  ${_section('sec-anime-action',  'Action Anime',            'sports_martial_arts',  'row-anime-action',  'anime-action',   'Action Anime',             '')}
  ${_section('sec-anime-romance', 'Romance &amp; Slice of Life','favorite',          'row-anime-romance', 'anime-romance',  'Romance Anime',            '#ec4899')}
  ${_section('sec-anime-isekai',  'Fantasy &amp; Isekai',    'auto_awesome',         'row-anime-isekai',  'anime-isekai',   'Fantasy &amp; Isekai',     '#a78bfa')}
  ${_section('sec-anime-sports',  'Sports Anime',            'sports_soccer',        'row-anime-sports',  'anime-sports',   'Sports Anime',             '#06b6d4')}
  ${_section('sec-anime-comedy',  'Comedy Anime',            'sentiment_very_satisfied','row-anime-comedy','anime-comedy',  'Comedy Anime',             '#f59e0b')}
  ${_section('sec-anime-horror',  'Horror &amp; Dark Anime', 'dark_mode',            'row-anime-horror',  'anime-horror',   'Horror Anime',             '#ef4444')}
  ${_section('sec-anime-mecha',   'Mecha &amp; Sci-Fi',      'rocket_launch',        'row-anime-mecha',   'anime-mecha',    'Mecha Anime',              '#6366f1')}
  ${_section('sec-anime-movie',   'Anime Movies',            'movie',                'row-anime-movie',   'anime-movies',   'Anime Movies',             '')}

  <div style="height:3rem"></div>`;
  return el;
}

/* ── PAGE: TRAILERS ─────────────────────────────────────────────── */
function _buildTrailersPage() {
  const el = document.createElement('main');
  el.className = 'page';
  el.id = 'page-trailers';
  el.innerHTML = `
  <div id="trailers-feed" class="trailers-feed" aria-label="Trailer feed">
    <div class="trailers-empty" id="trailers-empty" style="display:none">
      <span class="material-icons-round" style="font-size:3rem;color:var(--muted)">videocam_off</span>
      <p>No trailers found</p>
    </div>
  </div>
  <div id="trailers-spinner" class="trailers-spinner" style="display:none">
    <div class="trailers-spinner-dot"></div>
  </div>`;
  return el;
}

/* ── PAGE: SEE ALL ──────────────────────────────────────────────── */
function _buildSeeAllPage() {
  const el = document.createElement('main');
  el.className = 'page';
  el.id = 'page-seeall';
  el.innerHTML = `
  <button class="seeall-back-btn" data-page="home" aria-label="Go back">
    <span class="material-icons-round">arrow_back</span> Back
  </button>
  <h1 id="seeall-title">Browse</h1>
  <div id="seeall-grid"></div>
  <button id="seeall-more" style="display:none">Load More</button>
  <div style="height:3rem"></div>`;
  return el;
}
