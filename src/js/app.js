import './adblock.js';
import { state, persist, GENRES, AGE_LEVELS, addRecentlyViewed, saveContinue, getContinue, isLiked, isInWatchlist, isDisliked, isWatched, toggleLike, toggleWatchlist, toggleWatched, addDislike, recordImpression } from './state.js';
import { tmdb, aniQuery, imgUrl, normalizeAnime, fetchAnimeDetails, getContentRating, clearCachePattern } from './api.js';
import { goPage, registerLoader, goSeeAll, registerSeeAll, PAGE_LOADERS } from './router.js';
import { buildProviderBar, loadPlayer, nextProvider, cancelProviderTimer, getActiveProvider, setActiveProvider, PROVIDERS } from './player.js';
import { toast, makeCard, renderRow, skelCards, showHero, buildHeroDots, jumpHero, resetModal, renderModalInfo, renderModalActions, renderCast, renderRelated, scrollRow, buildGenreChips, emptyState, esc, hideSection, showSection, showConfirm } from './ui.js';
import { loadForYou, loadBecauseYouLiked, loadGenreRow } from './recommendations.js';
import { initSearch, loadSearchDefault, doSearch, searchTmdbAutocomplete } from './search.js';
import { renderLibrary, renderSeeAll, loadMoreSeeAll, clearSection, clearAllData } from './library.js';

/* ── THEMES ──────────────────────────────────────────────────────── */
const THEMES = ['dark', 'light', 'midnight', 'warm'];
const THEME_ICONS = { dark: 'dark_mode', light: 'light_mode', midnight: 'nights_stay', warm: 'wb_sunny' };

function initTheme() {
  const saved = localStorage.getItem('sv_theme') || 'dark';
  applyTheme(saved);
}
function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem('sv_theme', name);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.querySelector('.material-icons-round').textContent = THEME_ICONS[name] || 'palette';
}
function cycleTheme() {
  const cur = document.documentElement.dataset.theme || 'dark';
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  applyTheme(next);
  toast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, THEME_ICONS[next] || 'palette');
}

/* ── LEGAL ───────────────────────────────────────────────────────── */
const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    body: `
      <h3>Information We Collect</h3>
      <p>StaticVault931 stores your preferences, watchlist, and viewing history locally in your browser using localStorage. We do not collect, transmit, or store any personal data on our servers.</p>
      <h3>Third-Party Services</h3>
      <p>We use The Movie Database (TMDB) API and AniList API to fetch content metadata. These services may collect data per their own privacy policies. Video content is streamed via third-party embed providers which operate independently.</p>
      <h3>Cookies & Storage</h3>
      <p>We use browser localStorage to save your settings and preferences. No tracking cookies are set by StaticVault931.</p>
      <h3>Advertising</h3>
      <p>Third-party video providers may display advertisements. StaticVault931 has no control over these ads and does not receive revenue from them.</p>
      <h3>Contact</h3>
      <p>For privacy concerns, contact us at StaticQuasar931Games@gmail.com.</p>`
  },
  tos: {
    title: 'Terms of Service',
    body: `
      <h3>Acceptance of Terms</h3>
      <p>By using StaticVault931, you agree to these terms. If you do not agree, please do not use this service.</p>
      <h3>Content</h3>
      <p>StaticVault931 is a content discovery platform. We do not host, store, or distribute any media files. All video content is sourced from third-party embed providers.</p>
      <h3>Use of Service</h3>
      <p>You agree to use StaticVault931 for lawful purposes only. You must not attempt to circumvent any technical measures or exploit the service.</p>
      <h3>Disclaimer</h3>
      <p>StaticVault931 is provided "as is" without warranties of any kind. We are not responsible for content displayed by third-party providers.</p>
      <h3>Changes</h3>
      <p>We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of updated terms.</p>`
  },
  dmca: {
    title: 'DMCA Notice',
    body: `
      <h3>Copyright Policy</h3>
      <p>StaticVault931 respects intellectual property rights. We do not host any media content — all video is embedded from third-party providers.</p>
      <h3>Filing a DMCA Notice</h3>
      <p>If you believe content accessible through our platform infringes your copyright, please contact the third-party provider that is hosting the content directly.</p>
      <p>For concerns specifically about StaticVault931's functionality or metadata, contact us at StaticQuasar931Games@gmail.com with:</p>
      <p>• A description of the copyrighted work<br>• The specific URL or content in question<br>• Your contact information<br>• A statement of good faith belief</p>
      <h3>Response</h3>
      <p>We will respond to valid DMCA notices within a reasonable timeframe and take appropriate action.</p>`
  }
};

function showLegal(type) {
  const data = LEGAL_CONTENT[type];
  if (!data) return;
  const overlay = document.getElementById('legal-overlay');
  const content = document.getElementById('legal-content');
  if (!overlay || !content) return;
  content.innerHTML = `<h2>${data.title}</h2>${data.body}`;
  overlay.classList.add('open');
}
function closeLegal() {
  document.getElementById('legal-overlay')?.classList.remove('open');
}

/* ── INIT ────────────────────────────────────────────────────────── */
(async function init() {
  initTheme();
  applyLoadingScreenState();
  initEventDelegation();
  initKeyboard();
  initHeader();
  initHoverTrailer();
  initModalPanelToggles();
  initShortcutsModal();
  initTestMode();
  buildRatingDescriptions();
  registerAllLoaders();
  registerAllSeeAll();
  initSearch();
  loadGenresUI();

  // Start home data loading
  loadHero().catch(() => {});
  loadHomeRows().catch(() => {});

  // URL param deep-link
  const sp = new URLSearchParams(location.search);
  if (sp.get('id') && sp.get('type')) {
    document.getElementById('loading-screen')?.classList.add('out');
    setTimeout(() => openMedia(+sp.get('id'), sp.get('type')), 400);
  }
})();

/* ── LOADING SCREEN ──────────────────────────────────────────────── */
function applyLoadingScreenState() {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;

  // Skip loading screen entirely after first visit
  if (localStorage.getItem('sv_visited')) {
    ls.classList.add('instant-out');
    return;
  }
  localStorage.setItem('sv_visited', '1');

  document.body.classList.add('ls-open');
  const enterBtn = document.getElementById('ls-enter');
  if (enterBtn) enterBtn.addEventListener('click', dismissLoadingScreen);
  setTimeout(dismissLoadingScreen, 2500);
}

function dismissLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  if (!ls || ls.classList.contains('out')) return;
  ls.classList.add('out');
  document.body.classList.remove('ls-open');
}

/* ── HEADER SCROLL ───────────────────────────────────────────────── */
function initHeader() {
  window.addEventListener('scroll', () => {
    document.getElementById('header')?.classList.toggle('solid', scrollY > 60);
  }, { passive: true });

  // Search pill opens search page
  document.getElementById('header-search-pill')?.addEventListener('click', () => {
    goPage('search');
    setTimeout(() => document.getElementById('search-input')?.focus(), 150);
  });
}

/* ── PAGE LOADERS ────────────────────────────────────────────────── */
function registerAllLoaders() {
  registerLoader('home', () => { /* already loaded at init */ });
  registerLoader('movies', loadMoviesPage);
  registerLoader('tv', loadTvPage);
  registerLoader('anime', loadAnimePage);
  registerLoader('search', () => {
    loadSearchDefault();
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
  });
  registerLoader('library', renderLibrary);
  registerLoader('prefs', loadPrefsPage);
  registerLoader('seeall', renderSeeAll);
}

function registerAllSeeAll() {
  registerSeeAll('trending', p => tmdb('/trending/all/week', { page: p }));
  registerSeeAll('movies-popular', p => tmdb('/movie/popular', { page: p }));
  registerSeeAll('movies-top', p => tmdb('/movie/top_rated', { page: p }));
  registerSeeAll('movies-new', p => tmdb('/movie/now_playing', { page: p }));
  registerSeeAll('movies-upcoming', p => tmdb('/movie/upcoming', { page: p }));
  registerSeeAll('tv-popular', p => tmdb('/tv/popular', { page: p }));
  registerSeeAll('tv-top', p => tmdb('/tv/top_rated', { page: p }));
  registerSeeAll('tv-airing', p => tmdb('/tv/airing_today', { page: p }));
  registerSeeAll('anime-trending', p => aniQuery(`query($p:Int){Page(page:$p,perPage:20){media(type:ANIME,sort:[TRENDING_DESC],isAdult:false){id title{romaji english}coverImage{large}averageScore popularity startDate{year}}}}`, { p }).then(d => ({ results: (d?.data?.Page?.media || []).map(normalizeAnime) })));

  // Genre see-alls are registered dynamically
  GENRES.forEach(g => {
    registerSeeAll('genre-' + g.id, p => tmdb('/discover/movie', { with_genres: g.id, sort_by: 'popularity.desc', page: p }));
  });
}

/* ── HERO ────────────────────────────────────────────────────────── */
async function loadHero() {
  try {
    const d = await tmdb('/trending/movie/week');
    state.heroItems = (d.results || []).filter(x => x.backdrop_path).slice(0, 7);
    buildHeroDots();
    showHero(0);
    clearInterval(state.heroTimer);
    state.heroTimer = setInterval(() => {
      showHero((state.heroIdx + 1) % state.heroItems.length);
    }, 10000);
  } catch {}
}

/* ── ROW DEDUP ───────────────────────────────────────────────────── */
// Global set tracking IDs already rendered in home page rows (reset on page load)
const _homeSeenIds = new Set();

/* ── LAZY ROW HELPER ─────────────────────────────────────────────── */
const _lazyObs = new Map();

function lazyRow(rowId, secId, fetchFn, type, numbered = false) {
  const row = document.getElementById(rowId);
  const sec = secId ? document.getElementById(secId) : null;
  if (!row) return;

  // Disconnect any existing observer for this row
  _lazyObs.get(rowId)?.disconnect();
  _lazyObs.delete(rowId);

  row.innerHTML = skelCards(6);

  const target = sec || row;
  const obs = new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    _lazyObs.delete(rowId);

    fetchFn()
      .then(items => {
        if (!items || !items.length) {
          if (sec) sec.style.display = 'none'; else row.innerHTML = '';
          return;
        }
        // Dedup: filter out IDs already shown in other rows
        const deduped = items.filter(m => m.id && !_homeSeenIds.has(m.id));
        deduped.forEach(m => _homeSeenIds.add(m.id));
        if (!deduped.length) { if (sec) sec.style.display = 'none'; return; }
        renderRow(rowId, deduped.slice(0, 14), type, numbered);
      })
      .catch(() => { if (sec) sec.style.display = 'none'; });
  }, { rootMargin: '400px 0px' });

  obs.observe(target);
  _lazyObs.set(rowId, obs);
}

/* ── HOME ROWS ───────────────────────────────────────────────────── */
async function loadHomeRows() {
  // Show skeletons for above-fold rows immediately
  ['row-trending', 'row-foryou', 'row-continue', 'row-recent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skelCards(8);
  });

  // Continue watching and recently viewed — instant from localStorage
  renderContinueRow();
  renderRecentRow();

  // Reset dedup set for fresh home load
  _homeSeenIds.clear();

  // Above-fold: load immediately
  await Promise.allSettled([
    tmdb('/trending/all/week')
      .then(d => {
        const items = (d.results || []).slice(0, 14);
        items.forEach(m => _homeSeenIds.add(m.id));
        renderRow('row-trending', items, null, true);
      })
      .catch(() => hideSection('sec-trending')),
    loadForYou(),
  ]);

  // Below-fold: lazy load when scrolled near
  const animeQ = `query{Page(perPage:16){media(type:ANIME,sort:[TRENDING_DESC],isAdult:false){id title{romaji english}coverImage{large}averageScore popularity startDate{year}}}}`;

  lazyRow('row-new',       'sec-new',       () => tmdb('/movie/now_playing').then(d => d.results || []), 'movie');
  lazyRow('row-toprated',  'sec-toprated',  () => tmdb('/movie/top_rated').then(d => d.results || []), 'movie');
  lazyRow('row-tv-pop',    'sec-tv-pop',    () => tmdb('/tv/popular').then(d => d.results || []), 'tv');
  lazyRow('row-airing',    'sec-airing',    () => tmdb('/tv/airing_today').then(d => d.results || []), 'tv');
  lazyRow('row-action',    'sec-action',    () => tmdb('/discover/movie', { with_genres: 28, sort_by: 'popularity.desc' }).then(d => d.results || []), 'movie');
  lazyRow('row-comedy',    'sec-comedy',    () => tmdb('/discover/movie', { with_genres: 35, sort_by: 'popularity.desc' }).then(d => d.results || []), 'movie');
  lazyRow('row-horror',    'sec-horror',    () => tmdb('/discover/movie', { with_genres: 27, sort_by: 'popularity.desc' }).then(d => d.results || []), 'movie');
  lazyRow('row-drama',     'sec-drama',     () => tmdb('/discover/movie', { with_genres: 18, sort_by: 'vote_average.desc', 'vote_count.gte': 300 }).then(d => d.results || []), 'movie');
  lazyRow('row-scifi',     'sec-scifi',     () => tmdb('/discover/movie', { with_genres: 878, sort_by: 'popularity.desc' }).then(d => d.results || []), 'movie');
  lazyRow('row-animated',  'sec-animated',  () => tmdb('/discover/movie', { with_genres: 16, sort_by: 'popularity.desc' }).then(d => d.results || []), 'movie');
  lazyRow('row-home-anime','sec-home-anime',() => aniQuery(animeQ).then(d => (d?.data?.Page?.media || []).map(normalizeAnime)), 'anime');

  // Because You Liked rows (load after above-fold settles)
  loadBecauseYouLiked().catch(() => {});
}

function renderContinueRow() {
  const sec = document.getElementById('sec-continue');
  const row = document.getElementById('row-continue');
  if (!row) return;

  const items = Object.values(state.continueWatching)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 12);

  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  row.innerHTML = items.map(item => makeCard(item, item.type || 'movie', { showProgress: true })).join('');
}

function renderRecentRow() {
  const sec = document.getElementById('sec-recent');
  const row = document.getElementById('row-recent');
  if (!row) return;

  const items = state.recentlyViewed.slice(0, 14);
  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  row.innerHTML = items.map(m => makeCard(m, m.type || 'movie')).join('');
}

/* ── MOVIES PAGE ─────────────────────────────────────────────────── */
async function loadMoviesPage() {
  const rows = ['row-movies-pop', 'row-movies-top', 'row-movies-new', 'row-movies-up', 'row-movies-action', 'row-movies-thriller'];
  rows.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  await Promise.allSettled([
    tmdb('/movie/popular').then(d => renderRow('row-movies-pop', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-pop')),
    tmdb('/movie/top_rated').then(d => renderRow('row-movies-top', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-top')),
    tmdb('/movie/now_playing').then(d => renderRow('row-movies-new', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-new')),
    tmdb('/movie/upcoming').then(d => renderRow('row-movies-up', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-up')),
    tmdb('/discover/movie', { with_genres: 28, sort_by: 'popularity.desc' }).then(d => renderRow('row-movies-action', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-action')),
    tmdb('/discover/movie', { with_genres: 53, sort_by: 'vote_average.desc', 'vote_count.gte': 200 }).then(d => renderRow('row-movies-thriller', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-thriller')),
  ]);
}

/* ── TV PAGE ─────────────────────────────────────────────────────── */
async function loadTvPage() {
  const rows = ['row-tv-popular', 'row-tv-top', 'row-tv-air', 'row-tv-crime', 'row-tv-scifi'];
  rows.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  await Promise.allSettled([
    tmdb('/tv/popular').then(d => renderRow('row-tv-popular', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-popular')),
    tmdb('/tv/top_rated').then(d => renderRow('row-tv-top', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-top')),
    tmdb('/tv/airing_today').then(d => renderRow('row-tv-air', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-air')),
    tmdb('/discover/tv', { with_genres: 80, sort_by: 'popularity.desc' }).then(d => renderRow('row-tv-crime', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-crime')),
    tmdb('/discover/tv', { with_genres: 10765, sort_by: 'popularity.desc' }).then(d => renderRow('row-tv-scifi', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-scifi')),
  ]);
}

/* ── ANIME PAGE ──────────────────────────────────────────────────── */
async function loadAnimePage() {
  const rows = ['row-anime-trend', 'row-anime-top', 'row-anime-airing', 'row-anime-action'];
  rows.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  const Q = `query($sort:[MediaSort],$status:MediaStatus,$genre:String){Page(perPage:16){media(type:ANIME,sort:$sort,status:$status,isAdult:false,genre:$genre){id title{romaji english}coverImage{large}bannerImage averageScore popularity episodes status startDate{year}description(asHtml:false)}}}`;

  const [trend, top, airing, action] = await Promise.allSettled([
    aniQuery(Q, { sort: ['TRENDING_DESC'] }),
    aniQuery(Q, { sort: ['SCORE_DESC'] }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], status: 'RELEASING' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Action' }),
  ]);

  const fix = r => {
    if (r.status !== 'fulfilled') return [];
    return (r.value?.data?.Page?.media || []).map(normalizeAnime);
  };

  renderRow('row-anime-trend', fix(trend), 'anime');
  renderRow('row-anime-top', fix(top), 'anime');
  renderRow('row-anime-airing', fix(airing), 'anime');
  renderRow('row-anime-action', fix(action), 'anime');

  if (!fix(trend).length) hideSection('sec-anime-trend');
  if (!fix(top).length) hideSection('sec-anime-top');
  if (!fix(airing).length) hideSection('sec-anime-airing');
  if (!fix(action).length) hideSection('sec-anime-action');
}

/* ── GENRES UI ───────────────────────────────────────────────────── */
function loadGenresUI() {
  buildGenreChips('genre-scroll', GENRES, (id, name) => {
    if (state.activeGenreId === id) {
      state.activeGenreId = null;
      document.getElementById('genre-results-section')?.style && (document.getElementById('genre-results-section').style.display = 'none');
      document.querySelectorAll('#genre-scroll .genre-chip').forEach(c => c.classList.remove('on'));
      return;
    }
    state.activeGenreId = id;
    document.querySelectorAll('#genre-scroll .genre-chip').forEach(c => c.classList.toggle('on', +c.dataset.genreId === id));
    loadGenreRow(id, name);
  }, state.activeGenreId ? [state.activeGenreId] : []);
}

/* ── PREFS PAGE ──────────────────────────────────────────────────── */
function loadPrefsPage() {
  renderPrefLists();
  buildRatingDescriptions();
  buildGenreChips('pref-genres', GENRES, (id, chip) => {
    const i = state.prefGenres.indexOf(id);
    if (i >= 0) state.prefGenres.splice(i, 1); else state.prefGenres.push(id);
    persist('prefGenres');
    chip.classList.toggle('on', state.prefGenres.includes(id));
  }, state.prefGenres);
  buildAgeRatingUI();
  initPrefAutocomplete();
}

function buildAgeRatingUI() {
  const container = document.getElementById('pref-age-row');
  if (!container) return;
  const ratings = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
  container.innerHTML = ratings.map(r => `
    <button class="age-btn${state.ageRating === r ? ' on' : ''}" data-age="${r}">${r}</button>
  `).join('');
  container.querySelectorAll('.age-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ageRating = btn.dataset.age;
      persist('ageRating');
      container.querySelectorAll('.age-btn').forEach(b => b.classList.toggle('on', b.dataset.age === state.ageRating));
      toast(`Content rating set to ${state.ageRating}`, 'child_care');
      buildRatingDescriptions();
    });
  });
}

function renderPrefLists() {
  const ll = document.getElementById('pref-likes-list');
  if (ll) {
    ll.innerHTML = state.prefLikes.map(x => `
      <div class="pref-tag pref-tag-like">
        ${x.poster ? `<img src="${esc(x.poster)}" alt="" class="pref-tag-poster">` : ''}
        <span>${esc(x.title || x.name || '')}</span>
        <button class="pref-tag-remove" data-pref-remove-like="${esc(x.id)}" aria-label="Remove">
          <span class="material-icons-round">close</span>
        </button>
      </div>`).join('') || '<p class="muted-note" style="font-size:.8rem">No liked titles yet.</p>';
  }

  const dl = document.getElementById('pref-dislikes-list');
  if (dl) {
    dl.innerHTML = state.prefDislikes.map(x => `
      <div class="pref-tag pref-tag-dis">
        ${x.poster ? `<img src="${esc(x.poster)}" alt="" class="pref-tag-poster">` : ''}
        <span>${esc(x.title || x.name || '')}</span>
        <button class="pref-tag-remove" data-pref-remove-dis="${esc(x.id)}" aria-label="Remove">
          <span class="material-icons-round">close</span>
        </button>
      </div>`).join('') || '<p class="muted-note" style="font-size:.8rem">No disliked titles yet.</p>';
  }
}

/* ── PREF AUTOCOMPLETE ───────────────────────────────────────────── */
function initPrefAutocomplete() {
  setupAC('pref-like-input', 'pref-like-ac', item => {
    state.prefLikes = state.prefLikes.filter(x => x.id !== item.id);
    state.prefLikes.push({
      id: item.id,
      type: item._type || 'movie',
      title: item.title || item.name || '',
      poster: imgUrl(item.poster_path, 'w92'),
      score: 5,
    });
    persist('prefLikes');
    renderPrefLists();
    toast(`Added "${item.title || item.name}" to liked`, 'favorite');
    loadBecauseYouLiked().catch(() => {});
  });

  setupAC('pref-dis-input', 'pref-dis-ac', item => {
    state.prefDislikes = state.prefDislikes.filter(x => x.id !== item.id);
    state.prefDislikes.push({
      id: item.id,
      type: item._type || 'movie',
      title: item.title || item.name || '',
      poster: imgUrl(item.poster_path, 'w92'),
    });
    persist('prefDislikes');
    renderPrefLists();
    toast(`Added "${item.title || item.name}" to disliked`, 'thumb_down');
  });
}

let _acTimer = null;
function setupAC(inputId, dropId, onSelect) {
  const inp = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if (!inp || !drop) return;

  inp.addEventListener('input', () => {
    clearTimeout(_acTimer);
    const q = inp.value.trim();
    if (q.length < 2) { drop.style.display = 'none'; return; }
    _acTimer = setTimeout(async () => {
      const results = await searchTmdbAutocomplete(q);
      if (!results.length) { drop.style.display = 'none'; return; }
      drop.innerHTML = results.map(r =>
        `<div class="ac-item" data-ac-id="${r.id}" data-ac-type="${r._type}">
           ${r.poster_path ? `<img src="${imgUrl(r.poster_path, 'w92')}" alt="" class="ac-poster">` : '<div class="ac-poster-ph"></div>'}
           <div class="ac-info">
             <div class="ac-title">${esc(r.title || r.name || '')}</div>
             <div class="ac-meta">${r._type === 'tv' ? 'TV Show' : 'Movie'} · ${String(r.release_date || r.first_air_date || '').slice(0, 4)}</div>
           </div>
         </div>`).join('');
      drop.style.display = 'block';

      drop.querySelectorAll('.ac-item').forEach(el => {
        el.addEventListener('click', () => {
          const item = results.find(r => r.id == el.dataset.acId);
          if (item) { onSelect(item); inp.value = ''; drop.style.display = 'none'; }
        });
      });
    }, 300);
  });

  document.addEventListener('click', e => {
    if (!inp.contains(e.target) && !drop.contains(e.target)) drop.style.display = 'none';
  });
}

/* ── OPEN MEDIA / MODAL ──────────────────────────────────────────── */
export async function openMedia(id, type, hint = {}) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  clearHoverTrailer(); // stop any active hover preview
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  resetModal();

  state.currentMedia = { id, type, ...hint };

  try {
    let details, credits;
    if (type === 'anime') {
      details = await fetchAnimeDetails(id);
      credits = { cast: [], _cast: details._cast || [] };
    } else {
      [details, credits] = await Promise.all([
        tmdb(`/${type}/${id}`, { append_to_response: 'external_ids,content_ratings,release_dates,videos' }),
        tmdb(`/${type}/${id}/credits`),
      ]);
    }

    const title = details.title || details.name || details.romaji || 'Unknown';
    const imdbId = details.external_ids?.imdb_id || null;
    // TV/anime: always use TMDB ID — embed providers need it for episode routing
    // Movies: prefer IMDB ID when available
    const useId = (type === 'tv' || type === 'anime') ? id : (imdbId || id);

    state.currentMedia = { id, type, title, imdbId, useId, details };

    // Age check
    const contentRating = getContentRating(details, type);
    const ageLevel = AGE_LEVELS[contentRating] ?? 1;
    const maxLevel = AGE_LEVELS[state.ageRating] ?? 2;

    if (contentRating && ageLevel > maxLevel) {
      showAgeWarning(contentRating, useId, type);
    } else {
      loadPlayer(useId, type, 1, 1);
    }

    buildProviderBar(useId, type, 1, 1);
    renderModalInfo(details, type);
    renderModalActions(state.currentMedia);
    renderCast(credits);

    if (type === 'tv') {
      buildTvEpisodes(id, useId, details);
      loadRelated(id, type, details);
    } else if (type === 'anime') {
      buildAnimeEpisodes(details);
      loadRelated(id, type, details);
    } else {
      loadRelated(id, type, details);
    }

    // Track
    addRecentlyViewed({ id, type, title, poster_path: details.poster_path || null, coverImage_large: details.coverImage_large || null, backdrop_path: details.backdrop_path || null });

  } catch (e) {
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = 'Failed to load';
    const loading = document.getElementById('player-loading');
    if (loading) loading.innerHTML = `<p style="color:var(--muted)">Could not load content. Try again.</p>`;
    console.error(e);
  }
}

/* ── AGE WARNING ─────────────────────────────────────────────────── */
function showAgeWarning(rating, useId, type) {
  const warn = document.getElementById('age-warn');
  if (!warn) return;
  const msg = document.getElementById('age-warn-msg');
  if (msg) msg.textContent = `This content is rated "${rating}" which is above your selected rating of "${state.ageRating}".`;
  warn.style.display = 'flex';
}

/* ── TV EPISODES ─────────────────────────────────────────────────── */
async function buildTvEpisodes(tmdbId, useId, details) {
  const sidebar = document.getElementById('modal-ep-sidebar');
  if (!sidebar) return;

  const total = details.number_of_seasons || 1;
  sidebar.innerHTML = `
    <div class="ep-section">
      <div class="ep-header">
        <h3>Episodes</h3>
        <select id="season-sel" aria-label="Select season">
          ${Array.from({ length: total }, (_, i) => `<option value="${i + 1}">Season ${i + 1}</option>`).join('')}
        </select>
      </div>
      <div class="ep-grid" id="ep-grid">${skelCards(4)}</div>
      <div class="ep-footer">
        <button class="ep-jump-related" id="ep-jump-related" title="Jump to similar titles">
          <span class="material-icons-round">arrow_downward</span> More Like This
        </button>
      </div>
    </div>`;

  const sel = document.getElementById('season-sel');
  // Season change: load episodes but do NOT auto-play — user is browsing
  if (sel) sel.addEventListener('change', () => fetchEpisodes(tmdbId, useId, +sel.value, undefined, false));

  // Restore last watched season (auto-play on initial open)
  const cont = getContinue(tmdbId);
  const startSeason = cont?.season || 1;
  if (sel) sel.value = String(startSeason);
  await fetchEpisodes(tmdbId, useId, startSeason, cont?.episode, true);
}

async function fetchEpisodes(tmdbId, useId, season, highlightEp, autoLoad = true) {
  const grid = document.getElementById('ep-grid');
  if (!grid) return;
  grid.innerHTML = skelCards(4);

  try {
    const d = await tmdb(`/tv/${tmdbId}/season/${season}`);
    const eps = d.episodes || [];
    grid.innerHTML = eps.map((ep, i) => {
      const th = imgUrl(ep.still_path, 'w300');
      const isCurrent = highlightEp ? ep.episode_number === highlightEp : i === 0;
      return `<div class="ep-card${isCurrent ? ' on' : ''}"
          data-ep="${ep.episode_number}"
          data-season="${season}"
          data-ep-tmdb="${tmdbId}"
          data-ep-use="${useId}"
          role="button" tabindex="0">
          ${th ? `<img class="ep-thumb" src="${th}" loading="lazy" alt="Episode ${ep.episode_number}">` : `<div class="ep-th-ph"><span class="material-icons-round">play_circle</span></div>`}
          <div class="ep-info">
            <div class="ep-n">Ep ${ep.episode_number}${ep.vote_average ? ` · ★${ep.vote_average.toFixed(1)}` : ''}</div>
            <div class="ep-name" title="${esc(ep.name)}">${esc(ep.name || 'Episode ' + ep.episode_number)}</div>
            ${ep.runtime ? `<div class="ep-rt"><span class="material-icons-round">schedule</span>${ep.runtime}m</div>` : ''}
          </div>
        </div>`;
    }).join('');

    // Play first (or highlighted) episode only on initial open — not on season change
    const targetEp = highlightEp || 1;
    if (eps.length && autoLoad) loadPlayer(useId, 'tv', season, targetEp);
  } catch {
    grid.innerHTML = '<p class="muted-note">Could not load episodes.</p>';
  }
}

/* ── ANIME EPISODES ──────────────────────────────────────────────── */
function buildAnimeEpisodes(details) {
  const colRight = document.getElementById('modal-ep-sidebar');
  if (!colRight) return;

  const total = details.number_of_episodes || 1;
  const cont = getContinue(details.id);
  const lastEp = cont?.episode || 1;

  colRight.innerHTML = `
    <div class="ep-section">
      <div class="ep-header"><h3>Episodes</h3></div>
      <div class="ep-grid">
        ${Array.from({ length: Math.min(total, 100) }, (_, i) => {
          const ep = i + 1;
          return `<div class="ep-card${ep === lastEp ? ' on' : ''}"
            data-ep="${ep}"
            data-anime-id="${details.id}"
            role="button" tabindex="0">
            <div class="ep-th-ph"><span class="material-icons-round">play_circle</span></div>
            <div class="ep-info">
              <div class="ep-n">Episode ${ep}</div>
              <div class="ep-name">Episode ${ep}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  loadPlayer(details.id, 'anime', 1, lastEp);
}

/* ── RELATED (movies) ────────────────────────────────────────────── */
async function loadRelated(id, type, details) {
  const section = document.getElementById('modal-related-section');
  if (!section) return;
  section.innerHTML = `<div class="section-label">More Like This</div><div class="related-grid" id="related-grid">${skelCards(6)}</div>`;

  try {
    let items = [];
    if (type === 'anime') {
      items = (details._recommendations || []);
    } else {
      const d = await tmdb(`/${type}/${id}/recommendations`);
      items = (d.results || []).slice(0, 12);
    }
    renderRelated(items, type);
  } catch {
    const grid = document.getElementById('related-grid');
    if (grid) grid.innerHTML = '<p class="muted-note">No recommendations available.</p>';
  }
}

/* ── MODAL CLOSE ─────────────────────────────────────────────────── */
export function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
  document.getElementById('player-frame')?.removeAttribute('src');
  document.body.style.overflow = '';
  state.currentMedia = null;
  cancelProviderTimer();

  // Remove trailer fallback button
  document.getElementById('trailer-fallback-btn')?.remove();

  // Reset panel states for next open
  document.getElementById('modal-left-panel')?.classList.remove('panel-collapsed');
  document.getElementById('modal-right-panel')?.classList.remove('panel-collapsed');
  document.getElementById('left-panel-toggle')?.classList.remove('panel-toggle-active');
  document.getElementById('right-panel-toggle')?.classList.remove('panel-toggle-active');
  const li = document.getElementById('left-panel-toggle')?.querySelector('.material-icons-round');
  const ri = document.getElementById('right-panel-toggle')?.querySelector('.material-icons-round');
  if (li) li.textContent = 'dock_to_right';
  if (ri) ri.textContent = 'dock_to_left';
}

/* ── PLAY NOW ────────────────────────────────────────────────────── */
function playNow() {
  if (!state.currentMedia) return;
  const { useId, id, type } = state.currentMedia;
  const uid = useId || id;

  if (type === 'tv') {
    const selEl = document.getElementById('season-sel');
    const s = selEl ? +selEl.value : 1;
    const activeEp = document.querySelector('.ep-card.on');
    const ep = activeEp ? +activeEp.dataset.ep : 1;
    loadPlayer(uid, type, s, ep);
  } else if (type === 'anime') {
    const activeEp = document.querySelector('.ep-card.on');
    const ep = activeEp ? +activeEp.dataset.ep : 1;
    loadPlayer(uid, type, 1, ep);
  } else {
    loadPlayer(uid, type, 1, 1);
  }
}

/* ── EVENT DELEGATION ────────────────────────────────────────────── */
function initEventDelegation() {
  // Card clicks
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-id][data-type]');
    if (!card) return;

    // Like button
    const likeBtn = e.target.closest('[data-action="like"]');
    if (likeBtn) {
      e.stopPropagation();
      const itemId = +likeBtn.dataset.id;
      const itemType = likeBtn.dataset.type;
      handleLike(itemId, itemType, likeBtn);
      return;
    }

    // Watchlist button
    const wlBtn = e.target.closest('[data-action="watchlist"]');
    if (wlBtn) {
      e.stopPropagation();
      const itemId = +wlBtn.dataset.id;
      const itemType = wlBtn.dataset.type;
      handleWatchlist(itemId, itemType, wlBtn);
      return;
    }

    // Watched button
    const watchedBtn = e.target.closest('[data-action="watched"]');
    if (watchedBtn) {
      e.stopPropagation();
      const itemId = +watchedBtn.dataset.id;
      const itemType = watchedBtn.dataset.type;
      handleWatched(itemId, itemType, watchedBtn, card);
      return;
    }

    // Don't trigger card click if it's a button inside
    if (e.target.closest('button')) return;

    const itemId = +card.dataset.id;
    const itemType = card.dataset.type;
    if (itemId && itemType) openMedia(itemId, itemType, {
      title: card.dataset.title,
      poster_path: card.dataset.poster,
      backdrop_path: card.dataset.backdrop,
    });
  });

  // Keyboard on cards
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-id][data-type]');
    if (!card || e.target.closest('button')) return;
    e.preventDefault();
    const itemId = +card.dataset.id;
    const itemType = card.dataset.type;
    if (itemId && itemType) openMedia(itemId, itemType);
  });

  // Nav: any [data-page] element not inside a card
  document.addEventListener('click', e => {
    // data-lib-jump takes precedence — handled separately below
    if (e.target.closest('[data-lib-jump]')) return;
    const pageEl = e.target.closest('[data-page]');
    if (!pageEl) return;
    if (pageEl.closest('[data-id]')) return; // skip card internals
    goPage(pageEl.dataset.page);
  });

  // Shortcuts button in footer
  document.getElementById('footer-shortcuts-btn')?.addEventListener('click', showShortcuts);

  // Logo click → home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', () => goPage('home'));
    logo.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPage('home'); } });
  }

  // Hero area
  document.getElementById('hero')?.addEventListener('click', e => {
    if (!e.target.closest('button') && !e.target.closest('.hdot')) {
      const m = state.heroItems[state.heroIdx];
      if (m) openMedia(m.id, m.media_type === 'tv' ? 'tv' : 'movie', m);
    }
  });

  // Hero buttons
  document.getElementById('hero-play-btn')?.addEventListener('click', e => { e.stopPropagation(); const m = state.heroItems[state.heroIdx]; if (m) openMedia(m.id, m.media_type === 'tv' ? 'tv' : 'movie', m); });
  document.getElementById('hero-info-btn')?.addEventListener('click', e => { e.stopPropagation(); const m = state.heroItems[state.heroIdx]; if (m) openMedia(m.id, m.media_type === 'tv' ? 'tv' : 'movie', m); });

  // Hero dots
  document.getElementById('hero-dots')?.addEventListener('click', e => {
    const dot = e.target.closest('[data-hero-dot]');
    if (dot) jumpHero(+dot.dataset.heroDot);
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);

  // Hero right-click → next slide
  document.getElementById('hero')?.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (state.heroItems.length) jumpHero((state.heroIdx + 1) % state.heroItems.length);
  });

  // Modal close
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Modal actions — document-level so dislike and trailer work even after re-render
  document.addEventListener('click', e => {
    const btn = e.target.closest('#modal-actions [data-action]');
    if (!btn || !state.currentMedia) return;
    const action = btn.dataset.action;
    const { id, type, title, details } = state.currentMedia;
    const meta = { id, type, title, poster_path: details?.poster_path || null, coverImage_large: details?.coverImage_large || null };

    if (action === 'modal-play') playNow();
    else if (action === 'modal-trailer') {
      const key = btn.dataset.key;
      if (key) {
        cancelProviderTimer();
        const iframe = document.getElementById('player-frame');
        const loading = document.getElementById('player-loading');
        if (iframe) {
          if (loading) {
            loading.classList.remove('hidden');
            loading.innerHTML = `<div class="spin"></div><p>Loading trailer…</p>`;
          }
          iframe.removeAttribute('src');
          setTimeout(() => {
            iframe.src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}`;
            iframe.onload = () => { if (loading) loading.classList.add('hidden'); };
            // Fallback for Error 153 / embedding disabled — show helpful message after 5s
            setTimeout(() => {
              if (loading && !loading.classList.contains('hidden')) return;
              // Check if iframe shows YouTube error (can't detect directly, add "Watch on YouTube" overlay)
              showTrailerFallback(key);
            }, 6000);
          }, 50);
        }
      }
    }
    else if (action === 'modal-watchlist') { handleWatchlist(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-like') { handleLike(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-dislike') {
      addDislike(meta);
      toast("Got it — we'll show less like this", 'thumb_down');
      closeModal();
    }
    else if (action === 'modal-share') shareMedia();
  });

  // Legal overlay
  document.addEventListener('click', e => {
    const legalBtn = e.target.closest('[data-legal]');
    if (legalBtn) { showLegal(legalBtn.dataset.legal); return; }
    const lcloseBtn = e.target.closest('#legal-close');
    if (lcloseBtn) { closeLegal(); return; }
    const loverlay = document.getElementById('legal-overlay');
    if (loverlay && e.target === loverlay) closeLegal();
  });

  // Library tabs
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-lib-tab]');
    if (!tab) return;
    document.querySelectorAll('.lib-tab').forEach(t => t.classList.toggle('on', t === tab));
    const tabName = tab.dataset.libTab;
    const libEl = document.getElementById('lib-tab-library');
    const prefsEl = document.getElementById('lib-tab-prefs');
    if (libEl) libEl.style.display = tabName === 'library' ? '' : 'none';
    if (prefsEl) prefsEl.style.display = tabName === 'prefs' ? '' : 'none';
    if (tabName === 'prefs') {
      const likedGrid = document.getElementById('lib-preftab-liked');
      if (likedGrid) {
        const items = [...state.liked, ...state.prefLikes].slice(0, 12);
        likedGrid.innerHTML = items.length
          ? items.map(m => makeCard(m, m.type || 'movie')).join('')
          : `<p class="muted-note">Like some titles to see them here.</p>`;
      }
    }
  });

  // Age warn buttons
  document.getElementById('warn-proceed-btn')?.addEventListener('click', () => {
    document.getElementById('age-warn').style.display = 'none';
    if (state.currentMedia) loadPlayer(state.currentMedia.useId || state.currentMedia.id, state.currentMedia.type, 1, 1);
  });
  document.getElementById('warn-back-btn')?.addEventListener('click', closeModal);

  // Provider bar
  document.addEventListener('click', e => {
    const pBtn = e.target.closest('[data-provider]');
    if (pBtn && pBtn.closest('#provider-bar')) {
      if (!state.currentMedia) return;
      setActiveProvider(pBtn.dataset.provider);
      const { useId, id, type } = state.currentMedia;
      const uid = useId || id;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      buildProviderBar(uid, type, s, ep);
      loadPlayer(uid, type, s, ep);
    }
    const nextBtn = e.target.closest('#prov-next-btn, #player-next-btn');
    if (nextBtn && state.currentMedia) {
      const { useId, id, type } = state.currentMedia;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      const next = nextProvider(useId || id, type, s, ep);
      toast(`Trying ${next.label}`, 'sync');
    }
  });

  // Episode cards
  document.addEventListener('click', e => {
    const epCard = e.target.closest('.ep-card');
    if (!epCard || !state.currentMedia) return;
    document.querySelectorAll('.ep-card').forEach(c => c.classList.remove('on'));
    epCard.classList.add('on');
    const ep = +epCard.dataset.ep;
    const season = +epCard.dataset.season || 1;
    const { useId, id, type } = state.currentMedia;
    const uid = useId || id;
    loadPlayer(uid, type, season, ep);

    // Save continue watching for TV/anime
    if (type === 'tv' || type === 'anime') {
      saveContinue(id, { season, episode: ep, type, title: state.currentMedia.title, poster_path: state.currentMedia.details?.poster_path || null });
    }
  });

  // Episode keyboard
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const epCard = e.target.closest('.ep-card');
    if (!epCard) return;
    e.preventDefault();
    epCard.click();
  });

  // Jump to "More Like This"
  document.addEventListener('click', e => {
    if (e.target.closest('#ep-jump-related')) {
      const related = document.getElementById('modal-related-section');
      if (related) related.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Row scroll arrows
  document.addEventListener('click', e => {
    const scrollBtn = e.target.closest('[data-scroll-row]');
    if (scrollBtn) {
      const rowId = scrollBtn.dataset.scrollRow;
      const dir = +scrollBtn.dataset.scrollDir;
      const row = document.getElementById(rowId);
      if (row) row.scrollBy({ left: dir * (row.clientWidth * 0.85), behavior: 'smooth' });
    }
  });

  // See all buttons
  document.addEventListener('click', e => {
    const seeAllBtn = e.target.closest('[data-see-all]');
    if (seeAllBtn) {
      const key = seeAllBtn.dataset.seeAll;
      const title = seeAllBtn.dataset.seeAllTitle || 'Browse';
      goSeeAll(key, title);
    }
    const moreBtn = e.target.closest('#seeall-more');
    if (moreBtn) loadMoreSeeAll();
  });

  // Genre clear
  document.getElementById('genre-clear-btn')?.addEventListener('click', () => {
    state.activeGenreId = null;
    document.getElementById('genre-results-section').style.display = 'none';
    document.querySelectorAll('#genre-scroll .genre-chip').forEach(c => c.classList.remove('on'));
  });

  // Prefs remove tags
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-pref-remove-like]');
    if (btn) {
      const id = btn.dataset.prefRemoveLike;
      state.prefLikes = state.prefLikes.filter(x => String(x.id) !== id);
      persist('prefLikes');
      renderPrefLists();
      return;
    }
    const btn2 = e.target.closest('[data-pref-remove-dis]');
    if (btn2) {
      const id = btn2.dataset.prefRemoveDis;
      state.prefDislikes = state.prefDislikes.filter(x => String(x.id) !== id);
      persist('prefDislikes');
      renderPrefLists();
    }
  });

  // Prefs apply — clear all content caches and reload everything
  document.getElementById('pref-apply-btn')?.addEventListener('click', () => {
    refreshFeed(false);
  });

  // Feed randomize
  document.getElementById('pref-randomize-btn')?.addEventListener('click', () => {
    refreshFeed(true);
  });

  // Data management — use in-app confirm dialog
  document.getElementById('btn-clear-watchlist')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Watchlist', 'Remove all saved titles? This cannot be undone.')) clearSection('watchlist', 'Watchlist');
  });
  document.getElementById('btn-clear-liked')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Liked', 'Remove all liked titles? This cannot be undone.')) clearSection('liked', 'Liked');
  });
  document.getElementById('btn-clear-recent')?.addEventListener('click', async () => {
    if (await showConfirm('Clear History', 'Remove all recently viewed titles? This cannot be undone.')) clearSection('recentlyViewed', 'Recently Viewed');
  });
  document.getElementById('btn-clear-continue')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Continue Watching', 'Remove all progress? This cannot be undone.')) clearSection('continueWatching', 'Continue Watching');
  });
  document.getElementById('btn-clear-disliked')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Disliked', 'Clear your disliked list? This cannot be undone.')) clearSection('disliked', 'Disliked');
  });
  document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
    if (await showConfirm('Reset All Data', 'This clears your watchlist, liked, history, preferences, and settings. This cannot be undone.')) clearAllData();
  });

  // Provider auto-switch on timeout — try next provider after brief delay
  document.addEventListener('sv:provider-timeout', () => {
    if (!state.currentMedia) return;
    setTimeout(() => {
      // Only switch if player is still showing error (not loaded)
      const loading = document.getElementById('player-loading');
      if (!loading || loading.classList.contains('hidden')) return;
      const { useId, id, type } = state.currentMedia;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      const next = nextProvider(useId || id, type, s, ep);
      toast(`Auto-switching to ${next.label}…`, 'sync');
    }, 3500);
  });

  // Empty state actions
  document.addEventListener('click', e => {
    const act = e.target.closest('.empty-action');
    if (!act) return;
    if (act.dataset.action === 'go-home') goPage('home');
    else if (act.dataset.action === 'go-search') { goPage('search'); setTimeout(() => document.getElementById('search-input')?.focus(), 100); }
    else if (act.dataset.action === 'go-prefs') goPage('prefs');
  });

  // Library section jump
  document.querySelectorAll('[data-lib-jump]').forEach(el => {
    el.addEventListener('click', () => {
      goPage('library');
      const target = document.getElementById('lib-' + el.dataset.libJump);
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    });
  });

  // Plot expand
  document.addEventListener('click', e => {
    if (e.target.closest('#modal-plot')) {
      document.getElementById('modal-plot')?.classList.toggle('exp');
    }
  });

  // Header search pill
  document.getElementById('header-search-pill')?.addEventListener('click', () => {
    goPage('search');
    setTimeout(() => document.getElementById('search-input')?.focus(), 150);
  });
}

/* ── LIKE/WATCHLIST HELPERS ──────────────────────────────────────── */
function handleLike(id, type, btn, metaOverride) {
  const item = metaOverride || buildItemMeta(id, type);
  const added = toggleLike(item);
  if (added) toast('Liked!', 'favorite');
  else toast('Removed from liked', 'heart_broken');
  refreshCardBadges(id);
  if (btn) {
    btn.classList.toggle('liked', isLiked(id));
    btn.querySelector('.material-icons-round').textContent = isLiked(id) ? 'favorite' : 'favorite_border';
  }
}

function handleWatched(id, type, btn, card) {
  const item = buildItemMeta(id, type);
  const added = toggleWatched(item);
  if (added) toast('Marked as watched', 'visibility');
  else toast('Removed from watched', 'visibility_off');
  if (btn) {
    btn.classList.toggle('done', isWatched(id));
    btn.querySelector('.material-icons-round').textContent = isWatched(id) ? 'visibility' : 'visibility_off';
  }
  // Refresh badge on card
  const badgesEl = card?.querySelector('.card-badges');
  if (badgesEl) {
    // Re-render badges — simplest approach: rebuild card badges section
    const existing = badgesEl.querySelector('.badge-watched');
    if (isWatched(id) && !existing) {
      const span = document.createElement('span');
      span.className = 'card-badge badge-watched';
      span.textContent = 'Watched';
      badgesEl.appendChild(span);
    } else if (!isWatched(id) && existing) {
      existing.remove();
    }
  }
}

function handleWatchlist(id, type, btn, metaOverride) {
  const item = metaOverride || buildItemMeta(id, type);
  const added = toggleWatchlist(item);
  if (added) toast('Saved to Watchlist', 'bookmark_added');
  else toast('Removed from Watchlist', 'bookmark_remove');
  refreshCardBadges(id);
  if (btn) {
    btn.classList.toggle('saved', isInWatchlist(id));
    btn.querySelector('.material-icons-round').textContent = isInWatchlist(id) ? 'bookmark' : 'bookmark_add';
  }
}

function buildItemMeta(id, type) {
  // Try to get from current media or a visible card
  if (state.currentMedia && state.currentMedia.id == id) {
    const { title, details } = state.currentMedia;
    return { id, type, title, poster_path: details?.poster_path || null };
  }
  const card = document.querySelector(`[data-id="${id}"][data-type="${type}"]`);
  return { id, type, title: card?.dataset.title || '', poster_path: card?.dataset.poster || null };
}

function refreshCardBadges(id) {
  document.querySelectorAll(`.card[data-id="${id}"]`).forEach(card => {
    const likeBtn = card.querySelector('[data-action="like"]');
    const wlBtn = card.querySelector('[data-action="watchlist"]');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLiked(id));
      const ic = likeBtn.querySelector('.material-icons-round');
      if (ic) ic.textContent = isLiked(id) ? 'favorite' : 'favorite_border';
    }
    if (wlBtn) {
      wlBtn.classList.toggle('saved', isInWatchlist(id));
      const ic = wlBtn.querySelector('.material-icons-round');
      if (ic) ic.textContent = isInWatchlist(id) ? 'bookmark' : 'bookmark_add';
    }
  });
}

/* ── SHARE ───────────────────────────────────────────────────────── */
function shareMedia() {
  if (!state.currentMedia) return;
  const url = `${location.origin}${location.pathname}?id=${state.currentMedia.id}&type=${state.currentMedia.type}`;
  if (navigator.share) {
    navigator.share({ title: state.currentMedia.title, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => toast('Link copied!', 'link')).catch(() => toast('Copy failed', 'error'));
  }
}

/* ── FEED REFRESH ────────────────────────────────────────────────── */
function refreshFeed(randomize = false) {
  // Clear ALL content caches from sessionStorage
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('svc_')) keysToRemove.push(k);
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));

  // Clear stale "Because You Liked" sections
  document.querySelectorAll('[id^="sec-because-"]').forEach(el => el.remove());

  // Disconnect lazy observers so rows reload
  _lazyObs.forEach(obs => obs.disconnect());
  _lazyObs.clear();
  _homeSeenIds.clear();

  if (randomize) {
    // Add random page offset to API calls via a temp state var
    state._randomPage = Math.floor(Math.random() * 5) + 2;
    toast('Feed randomized!', 'shuffle');
  } else {
    state._randomPage = null;
    toast('Feed updated!', 'check');
  }

  loadForYou().catch(() => {});
  loadBecauseYouLiked().catch(() => {});
  goPage('home');
  // Reload lazy rows
  setTimeout(() => loadHomeRows().catch(() => {}), 200);
}

/* ── TRAILER FALLBACK ────────────────────────────────────────────── */
function showTrailerFallback(key) {
  // Add a small "Watch on YouTube" button over the player without interrupting playback
  const existing = document.getElementById('trailer-fallback-btn');
  if (existing) return;
  const playerWrap = document.querySelector('.player-wrap');
  if (!playerWrap) return;
  const btn = document.createElement('a');
  btn.id = 'trailer-fallback-btn';
  btn.href = `https://www.youtube.com/watch?v=${key}`;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.className = 'trailer-fallback-btn';
  btn.innerHTML = `<span class="material-icons-round">open_in_new</span> Can't play? Watch on YouTube`;
  playerWrap.appendChild(btn);
  // Remove when modal closes
}

/* ── SHORTCUTS MODAL ─────────────────────────────────────────────── */
const SHORTCUTS = [
  { key: '/', desc: 'Open search' },
  { key: 'Esc', desc: 'Close modal / dialog' },
  { key: '?', desc: 'Show keyboard shortcuts' },
  { key: '← / A', desc: 'Previous hero slide' },
  { key: '→ / D', desc: 'Next hero slide' },
  { key: 'T', desc: 'Cycle theme' },
  { key: 'H', desc: 'Go to Home' },
  { key: 'L', desc: 'Go to Library' },
];

function showShortcuts() {
  const ov = document.getElementById('shortcuts-overlay');
  if (ov) ov.classList.add('open');
}

function initShortcutsModal() {
  const ov = document.getElementById('shortcuts-overlay');
  if (!ov) return;
  const grid = document.getElementById('shortcuts-grid');
  if (grid) {
    grid.innerHTML = SHORTCUTS.map(s =>
      `<div class="sc-item"><kbd class="sc-key">${esc(s.key)}</kbd><span class="sc-desc">${esc(s.desc)}</span></div>`
    ).join('');
  }
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  document.getElementById('shortcuts-close')?.addEventListener('click', () => ov.classList.remove('open'));
}

/* ── TESTING MODE (konami code) ──────────────────────────────────── */
const _konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let _konamiIdx = 0;

/* ── RATING DESCRIPTIONS ─────────────────────────────────────────── */
function buildRatingDescriptions() {
  const el = document.getElementById('pref-rating-descs');
  if (!el) return;
  const descs = [
    { r: 'G',     label: 'General Audiences',  desc: 'All ages. No offensive content.' },
    { r: 'PG',    label: 'Parental Guidance',   desc: 'May not suit young children. Mild language or themes.' },
    { r: 'PG-13', label: 'Parents Strongly Cautioned', desc: 'May be inappropriate for children under 13. Some strong language, violence.' },
    { r: 'R',     label: 'Restricted',          desc: 'Under 17 requires parent/guardian. Strong language, violence, adult themes.' },
    { r: 'NC-17', label: 'Adults Only',         desc: 'No one under 17 admitted. Explicit adult content.' },
  ];
  el.innerHTML = descs.map(d => `
    <div class="rating-desc${state.ageRating === d.r ? ' active' : ''}">
      <span class="rd-badge">${d.r}</span>
      <div><div class="rd-label">${d.label}</div><div class="rd-text">${d.desc}</div></div>
    </div>`).join('');
}

function initTestMode() {
  document.addEventListener('keydown', e => {
    if (e.key === _konami[_konamiIdx]) {
      _konamiIdx++;
      if (_konamiIdx === _konami.length) {
        _konamiIdx = 0;
        document.body.classList.toggle('test-mode');
        toast(document.body.classList.contains('test-mode') ? '🧪 Test mode ON' : '🧪 Test mode OFF', 'science');
      }
    } else {
      _konamiIdx = 0;
    }
  });
}

/* ── PROVIDER NOTIFICATION ───────────────────────────────────────── */
function checkProviderNotification() {
  const active = getActiveProvider();
  const usual = state.lastProvider || 'vidsrc';
  if (active.id !== usual && state.currentMedia) {
    const usualProv = PROVIDERS.find(p => p.id === usual);
    const usualLabel = usualProv?.label || usual;
    toast(`Using ${active.label} instead of ${usualLabel}`, 'swap_horiz');
  }
}

/* ── HOVER TRAILER PREVIEW ───────────────────────────────────────── */
const _hoverTrailerCache = new Map();
let _hoverTimer = null;
let _hoverActive = false;
let _hoverCurrentCard = null;

function initHoverTrailer() {
  // Mouse enter on cards
  document.addEventListener('mouseover', e => {
    if (document.getElementById('modal-overlay')?.classList.contains('open')) return;

    const card = e.target.closest('.card[data-id][data-type]');
    if (!card || card.dataset.type === 'anime') {
      if (!e.target.closest('#hover-preview') && !e.target.closest('.card')) {
        clearHoverTrailer();
      }
      return;
    }

    if (card === _hoverCurrentCard) return; // same card, do nothing
    clearHoverTrailer(); // reset timer if hovering new card
    _hoverCurrentCard = card;
    _hoverTimer = setTimeout(async () => {
      if (_hoverCurrentCard === card) {
        _hoverActive = true;
        await triggerHoverTrailer(card);
      }
    }, 1500);
  });

  document.addEventListener('mouseleave', e => {
    if (e.target === document.documentElement) clearHoverTrailer();
  });

  document.getElementById('hover-preview')?.addEventListener('mouseleave', clearHoverTrailer);
}

function clearHoverTrailer() {
  clearTimeout(_hoverTimer);
  _hoverTimer = null;
  _hoverActive = false;
  _hoverCurrentCard = null;
  const preview = document.getElementById('hover-preview');
  const frame = document.getElementById('hover-frame');
  if (preview) preview.classList.remove('visible');
  // Delay src removal to avoid flash when preview is reused quickly
  setTimeout(() => { if (!_hoverActive && frame) frame.removeAttribute('src'); }, 300);
}

async function triggerHoverTrailer(card) {
  const id = card.dataset.id;
  const type = card.dataset.type;
  if (!_hoverActive) return;

  let key = _hoverTrailerCache.get(id);
  if (!key) {
    try {
      const data = await tmdb(`/${type === 'tv' ? 'tv' : 'movie'}/${id}/videos`);
      const vids = data.results || [];
      const vid = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                  vids.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
                  vids.find(v => v.site === 'YouTube');
      key = vid?.key || '__none__';
    } catch {
      key = '__none__';
    }
    _hoverTrailerCache.set(id, key);
  }

  if (!_hoverActive || !key || key === '__none__') return;

  const preview = document.getElementById('hover-preview');
  const frame = document.getElementById('hover-frame');
  if (!preview || !frame) return;

  // Position relative to card
  const rect = card.getBoundingClientRect();
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const pW = 320, pH = 196;

  let left = rect.right + 12;
  let top = rect.top + (rect.height / 2) - (pH / 2);

  if (left + pW > vpW - 12) left = rect.left - pW - 12;
  if (left < 8) left = 8;
  if (top + pH > vpH - 8) top = vpH - pH - 8;
  if (top < 8) top = 8;

  preview.style.left = `${left}px`;
  preview.style.top = `${top}px`;
  frame.src = `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&mute=1&controls=0&rel=0&loop=1&playlist=${key}&modestbranding=1`;
  preview.classList.add('visible');
}

/* ── COLLAPSIBLE MODAL SIDEBARS ──────────────────────────────────── */
function initModalPanelToggles() {
  document.getElementById('left-panel-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('modal-left-panel');
    const btn = document.getElementById('left-panel-toggle');
    if (!panel) return;
    const collapsed = panel.classList.toggle('panel-collapsed');
    const icon = btn?.querySelector('.material-icons-round');
    if (icon) icon.textContent = collapsed ? 'dock_to_right' : 'view_sidebar';
    btn?.classList.toggle('panel-toggle-active', collapsed);
    if (btn) btn.title = collapsed ? 'Show info panel' : 'Hide info panel';
  });

  document.getElementById('right-panel-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('modal-right-panel');
    const btn = document.getElementById('right-panel-toggle');
    if (!panel) return;
    const collapsed = panel.classList.toggle('panel-collapsed');
    const icon = btn?.querySelector('.material-icons-round');
    if (icon) icon.textContent = collapsed ? 'dock_to_left' : 'view_sidebar';
    btn?.classList.toggle('panel-toggle-active', collapsed);
    if (btn) btn.title = collapsed ? 'Show episodes panel' : 'Hide episodes panel';
  });
}

/* ── KEYBOARD ────────────────────────────────────────────────────── */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select')) return;

    // Escape closes modal
    if (e.key === 'Escape') { closeModal(); return; }

    // / opens search
    if (e.key === '/') {
      e.preventDefault();
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 150);
      return;
    }

    // ? opens shortcuts
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }

    // WASD / Arrow keys — hero navigation and row scrolling
    const modalOpen = document.getElementById('modal-overlay')?.classList.contains('open');
    if (modalOpen) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      jumpHero((state.heroIdx - 1 + state.heroItems.length) % state.heroItems.length);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      jumpHero((state.heroIdx + 1) % state.heroItems.length);
    } else if (e.key === 't' || e.key === 'T') {
      cycleTheme();
    } else if (e.key === 'h' || e.key === 'H') {
      goPage('home');
    } else if (e.key === 'l' || e.key === 'L') {
      goPage('library');
    }
  });
}
