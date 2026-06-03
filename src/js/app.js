import { state, persist, GENRES, AGE_LEVELS, addRecentlyViewed, saveContinue, getContinue, isLiked, isInWatchlist, isDisliked, toggleLike, toggleWatchlist, addDislike } from './state.js';
import { tmdb, aniQuery, imgUrl, normalizeAnime, fetchAnimeDetails, getContentRating } from './api.js';
import { goPage, registerLoader, goSeeAll, registerSeeAll, PAGE_LOADERS } from './router.js';
import { buildProviderBar, loadPlayer, nextProvider, getActiveProvider, setActiveProvider, PROVIDERS } from './player.js';
import { toast, makeCard, renderRow, skelCards, showHero, buildHeroDots, jumpHero, resetModal, renderModalInfo, renderModalActions, renderCast, renderRelated, scrollRow, buildGenreChips, emptyState, esc, hideSection, showSection } from './ui.js';
import { loadForYou, loadBecauseYouLiked, loadGenreRow } from './recommendations.js';
import { initSearch, loadSearchDefault, doSearch, searchTmdbAutocomplete } from './search.js';
import { renderLibrary, renderSeeAll, loadMoreSeeAll, clearSection, clearAllData } from './library.js';

/* ── INIT ────────────────────────────────────────────────────────── */
(async function init() {
  applyLoadingScreenState();
  initEventDelegation();
  initKeyboard();
  initHeader();
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

  // Auto-dismiss after brief animation (1.8s), or on Enter button
  const enterBtn = document.getElementById('ls-enter');
  if (enterBtn) {
    enterBtn.addEventListener('click', dismissLoadingScreen);
  }

  // Auto-dismiss after 2.5s so the app feels responsive
  setTimeout(dismissLoadingScreen, 2500);
}

function dismissLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  if (!ls || ls.classList.contains('out')) return;
  ls.classList.add('out');
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
    }, 7000);
  } catch {}
}

/* ── HOME ROWS ───────────────────────────────────────────────────── */
async function loadHomeRows() {
  const rowIds = ['row-trending', 'row-foryou', 'row-continue', 'row-recent',
    'row-new', 'row-toprated', 'row-tv-pop', 'row-airing', 'row-action', 'row-comedy', 'row-horror'];
  rowIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skelCards(8);
  });

  // Continue watching from localStorage
  renderContinueRow();
  renderRecentRow();

  await Promise.allSettled([
    tmdb('/trending/all/week').then(d => renderRow('row-trending', (d.results || []).slice(0, 14), null, true)).catch(() => hideSection('sec-trending')),
    loadForYou(),
    tmdb('/movie/now_playing').then(d => renderRow('row-new', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-new')),
    tmdb('/movie/top_rated').then(d => renderRow('row-toprated', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-toprated')),
    tmdb('/tv/popular').then(d => renderRow('row-tv-pop', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-pop')),
    tmdb('/tv/airing_today').then(d => renderRow('row-airing', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-airing')),
    tmdb('/discover/movie', { with_genres: 28, sort_by: 'popularity.desc' }).then(d => renderRow('row-action', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-action')),
    tmdb('/discover/movie', { with_genres: 35, sort_by: 'popularity.desc' }).then(d => renderRow('row-comedy', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-comedy')),
    tmdb('/discover/movie', { with_genres: 27, sort_by: 'popularity.desc' }).then(d => renderRow('row-horror', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-horror')),
  ]);

  // Because You Liked rows
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
    const useId = imdbId || id;

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

    renderModalInfo(details, type);
    renderModalActions(state.currentMedia);
    buildProviderBar(useId, type, 1, 1);
    renderCast(credits);

    if (type === 'tv') {
      buildTvEpisodes(id, useId, details);
    } else if (type === 'anime') {
      buildAnimeEpisodes(details);
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
  const colRight = document.getElementById('modal-main-col');
  if (!colRight) return;

  const total = details.number_of_seasons || 1;
  colRight.innerHTML = `
    <div class="ep-section">
      <div class="ep-header">
        <h3>Episodes</h3>
        <select id="season-sel" aria-label="Select season">
          ${Array.from({ length: total }, (_, i) => `<option value="${i + 1}">Season ${i + 1}</option>`).join('')}
        </select>
      </div>
      <div class="ep-grid" id="ep-grid">${skelCards(4)}</div>
    </div>`;

  const sel = document.getElementById('season-sel');
  if (sel) sel.addEventListener('change', () => fetchEpisodes(tmdbId, useId, +sel.value));

  // Restore last watched season
  const cont = getContinue(tmdbId);
  const startSeason = cont?.season || 1;
  if (sel) sel.value = String(startSeason);
  await fetchEpisodes(tmdbId, useId, startSeason, cont?.episode);
}

async function fetchEpisodes(tmdbId, useId, season, highlightEp) {
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

    // Play first (or highlighted) episode
    const targetEp = highlightEp || 1;
    if (eps.length) loadPlayer(useId, 'tv', season, targetEp);
  } catch {
    grid.innerHTML = '<p class="muted-note">Could not load episodes.</p>';
  }
}

/* ── ANIME EPISODES ──────────────────────────────────────────────── */
function buildAnimeEpisodes(details) {
  const colRight = document.getElementById('modal-main-col');
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
  const colRight = document.getElementById('modal-main-col');
  if (!colRight) return;
  colRight.innerHTML = `<div class="section-label">More Like This</div><div class="related-grid" id="related-grid">${skelCards(6)}</div>`;

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
  clearTimeout(window._providerTimer);
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
  document.getElementById('modal-overlay')?.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Modal close
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Modal actions
  document.getElementById('modal-actions')?.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action || !state.currentMedia) return;
    const { id, type, title, details } = state.currentMedia;
    const meta = { id, type, title, poster_path: details?.poster_path || null, coverImage_large: details?.coverImage_large || null };

    if (action === 'modal-play') playNow();
    else if (action === 'modal-watchlist') { handleWatchlist(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-like') { handleLike(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-dislike') {
      addDislike(meta);
      toast("Got it — we'll show less like this", 'thumb_down');
      closeModal();
    }
    else if (action === 'modal-share') shareMedia();
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
    document.getElementById('modal-overlay')?.scrollTo({ top: 0, behavior: 'smooth' });

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

  // Prefs apply
  document.getElementById('pref-apply-btn')?.addEventListener('click', () => {
    toast('Feed updated!', 'check');
    loadForYou().catch(() => {});
    loadBecauseYouLiked().catch(() => {});
    goPage('home');
  });

  // Data management
  document.getElementById('btn-clear-watchlist')?.addEventListener('click', () => clearSection('watchlist', 'Watchlist'));
  document.getElementById('btn-clear-liked')?.addEventListener('click', () => clearSection('liked', 'Liked'));
  document.getElementById('btn-clear-recent')?.addEventListener('click', () => clearSection('recentlyViewed', 'Recently Viewed'));
  document.getElementById('btn-clear-continue')?.addEventListener('click', () => clearSection('continueWatching', 'Continue Watching'));
  document.getElementById('btn-clear-disliked')?.addEventListener('click', () => clearSection('disliked', 'Disliked'));
  document.getElementById('btn-reset-all')?.addEventListener('click', clearAllData);

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

/* ── KEYBOARD ────────────────────────────────────────────────────── */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Escape closes modal
    if (e.key === 'Escape') closeModal();

    // / opens search (if not in an input)
    if (e.key === '/' && !e.target.matches('input,textarea,select')) {
      e.preventDefault();
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 150);
    }
  });
}
