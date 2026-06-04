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
  ];

  pages.forEach(el => footer.before(el));
}

/* ── Shared row helper ──────────────────────────────────────────── */
function _row(rowId, scrollDir = true) {
  const arrows = scrollDir ? `
      <div class="row-arrow row-arrow-l"><button data-scroll-row="${rowId}" data-scroll-dir="-1"><span class="material-icons-round">chevron_left</span></button></div>
      <div class="card-row" id="${rowId}"></div>
      <div class="row-arrow row-arrow-r"><button data-scroll-row="${rowId}" data-scroll-dir="1"><span class="material-icons-round">chevron_right</span></button></div>` : `
      <div class="card-row" id="${rowId}"></div>`;
  return `<div class="row-wrap">${arrows}</div>`;
}

function _section(secId, title, icon, rowId, seeAllKey, seeAllTitle, iconColor = '') {
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

  <div class="section" id="sec-movies-foryou">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon" style="color:var(--red)">auto_awesome</span>Movies For You</div>
    </div>
    ${_row('row-movies-foryou')}
  </div>
  ${_section('sec-movies-pop',      'Popular Movies',     'movie',               'row-movies-pop',      'movies-popular',  'Popular Movies')}
  ${_section('sec-movies-top',      'Top Rated Movies',   'workspace_premium',   'row-movies-top',      'movies-top',      'Top Rated Movies')}
  ${_section('sec-movies-new',      'Now Playing',        'fiber_new',           'row-movies-new',      'movies-new',      'Now Playing')}
  ${_section('sec-movies-up',       'Upcoming',           'upcoming',            'row-movies-up',       'movies-upcoming', 'Upcoming Movies')}
  ${_section('sec-movies-action',   'Action Movies',      'sports_martial_arts', 'row-movies-action',   'genre-28',        'Action Movies')}
  ${_section('sec-movies-thriller', 'Top Rated Thrillers','visibility',          'row-movies-thriller', 'genre-53',        'Thrillers')}

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

  <div class="section" id="sec-tv-foryou">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon" style="color:var(--red)">auto_awesome</span>TV Shows For You</div>
    </div>
    ${_row('row-tv-foryou')}
  </div>
  ${_section('sec-tv-popular', 'Popular TV Shows',  'tv',               'row-tv-popular', 'tv-popular', 'Popular TV Shows')}
  ${_section('sec-tv-top',     'Top Rated TV',       'workspace_premium','row-tv-top',     'tv-top',     'Top Rated TV')}
  ${_section('sec-tv-air',     'Airing Today',       'live_tv',          'row-tv-air',     'tv-airing',  'Airing Today')}
  ${_section('sec-tv-crime',   'Crime &amp; Drama',  'policy',           'row-tv-crime',   'genre-80',   'Crime &amp; Drama')}

  <div class="section" id="sec-tv-scifi">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon">rocket_launch</span>Sci-Fi &amp; Fantasy</div>
    </div>
    ${_row('row-tv-scifi')}
  </div>

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

  ${_section('sec-anime-trend',  'Trending Anime',    'local_fire_department', 'row-anime-trend',  'anime-trending', 'Trending Anime')}

  <div class="section" id="sec-anime-top">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon">workspace_premium</span>Top Rated Anime</div>
    </div>
    ${_row('row-anime-top')}
  </div>

  <div class="section" id="sec-anime-airing">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon">fiber_new</span>Currently Airing</div>
    </div>
    ${_row('row-anime-airing')}
  </div>

  <div class="section" id="sec-anime-action">
    <div class="sec-header">
      <div class="sec-title"><span class="material-icons-round sec-icon">sports_martial_arts</span>Action Anime</div>
    </div>
    ${_row('row-anime-action')}
  </div>

  <div style="height:3rem"></div>`;
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
