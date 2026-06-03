import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, skelCards, esc, toast } from './ui.js';
import { state, addRecentSearch, clearRecentSearches } from './state.js';

let _debounce = null;
let _sfActive = 'all';
let _searchState = { query: '', page: 1, results: [], loading: false, done: false };

/* ── QUERY NORMALISER ────────────────────────────────────────────── */
function normalizeQuery(q) {
  // Strip common leading articles and special chars for fallback search
  return q
    .replace(/^(the|a|an)\s+/i, '')     // strip leading "the", "a", "an"
    .replace(/[''`""]/g, '')             // strip smart quotes / apostrophes
    .replace(/[^\w\s-]/g, ' ')           // replace special chars with space
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNoSpaces(q) {
  return q.replace(/\s+/g, '').toLowerCase();
}

/* ── INIT ────────────────────────────────────────────────────────── */
export function initSearch() {
  const inp = document.getElementById('search-input');
  if (!inp) return;

  inp.addEventListener('input', function () {
    const clear = document.getElementById('search-clear');
    if (clear) clear.style.display = this.value ? 'flex' : 'none';

    clearTimeout(_debounce);
    const q = this.value.trim();

    if (!q) {
      loadSearchDefault();
      return;
    }

    document.getElementById('search-results-area').innerHTML =
      `<div class="search-spinner"><div class="spin"></div></div>`;
    _debounce = setTimeout(() => doSearch(q), 350);
  });

  const clear = document.getElementById('search-clear');
  if (clear) {
    clear.addEventListener('click', () => {
      inp.value = '';
      clear.style.display = 'none';
      loadSearchDefault();
      inp.focus();
    });
  }

  // Filter chips
  document.querySelectorAll('.sf-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _sfActive = chip.dataset.f;
      document.querySelectorAll('.sf-chip').forEach(c => c.classList.toggle('on', c.dataset.f === _sfActive));
      const q = inp.value.trim();
      if (q) doSearch(q);
      else loadSearchDefault();
    });
  });

  // Infinite scroll for search results
  const area = document.getElementById('search-results-area');
  if (area) {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !_searchState.loading && !_searchState.done && _searchState.query) {
        loadMoreSearchResults();
      }
    }, { rootMargin: '300px' });
    // We'll observe a sentinel added dynamically in search results
    window._searchScrollObs = obs;
  }
}

/* ── DEFAULT STATE (no query) ────────────────────────────────────── */
export async function loadSearchDefault() {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  const recents = state.recentSearches || [];
  const recentHtml = recents.length ? `
    <div class="search-section-title" style="margin-bottom:.5rem">
      <span class="material-icons-round">history</span> Recent Searches
      <button class="search-clear-recent" id="clear-recent-searches" title="Clear recent searches">
        <span class="material-icons-round">delete_sweep</span>
      </button>
    </div>
    <div class="recent-searches-row" id="recent-searches-chips">
      ${recents.map(q => `<button class="recent-chip" data-recent-q="${esc(q)}">${esc(q)}</button>`).join('')}
    </div>` : '';

  area.innerHTML = `
    ${recentHtml}
    <div class="search-section-title"${recents.length ? ' style="margin-top:1.5rem"' : ''}>
      <span class="material-icons-round">local_fire_department</span> Trending Now
    </div>
    <div class="search-grid" id="search-trending-grid">${skelCards(12)}</div>
    <div class="search-section-title" style="margin-top:2rem">
      <span class="material-icons-round">category</span> Browse by Genre
    </div>
    <div class="genre-scroll" id="search-genre-scroll"></div>`;

  // Wire up recent chip clicks
  document.getElementById('recent-searches-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-recent-q]');
    if (chip) {
      const q = chip.dataset.recentQ;
      const inp = document.getElementById('search-input');
      if (inp) { inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  });

  // Clear recent searches
  document.getElementById('clear-recent-searches')?.addEventListener('click', () => {
    clearRecentSearches();
    loadSearchDefault();
  });

  try {
    const d = await tmdb('/trending/all/week');
    const items = (d.results || []).slice(0, 18);
    const grid = document.getElementById('search-trending-grid');
    if (grid) grid.innerHTML = items.map(m => makeCard(m, m.media_type === 'tv' ? 'tv' : 'movie')).join('');
  } catch {
    const grid = document.getElementById('search-trending-grid');
    if (grid) grid.innerHTML = '<p class="muted-note">Could not load trending content.</p>';
  }

  // Build genre chips
  const { GENRES } = await import('./state.js');
  const { buildGenreChips } = await import('./ui.js');
  buildGenreChips('search-genre-scroll', GENRES, (id, name) => {
    import('./router.js').then(({ goSeeAll }) => goSeeAll('genre-' + id, name));
  });
}

/* ── SEARCH ──────────────────────────────────────────────────────── */
export async function doSearch(q) {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  addRecentSearch(q);
  _searchState = { query: q, page: 1, results: [], loading: true, done: false };

  try {
    const items = await fetchSearchPage(q, 1);
    _searchState.results = items;
    _searchState.loading = false;

    if (!items.length) {
      area.innerHTML = `
        <div class="search-empty">
          <span class="material-icons-round">search_off</span>
          <p>No results for "<strong>${esc(q)}</strong>"</p>
          <p class="muted-note">Try checking your spelling or use different keywords.</p>
        </div>`;
      return;
    }

    renderSearchResults(items, q, true);
  } catch {
    _searchState.loading = false;
    area.innerHTML = `<div class="search-empty">
      <span class="material-icons-round">wifi_off</span>
      <p>Search failed — check your connection.</p>
    </div>`;
  }
}

async function fetchSearchPage(q, page) {
  let movies = [], shows = [], anime = [];

  if (_sfActive !== 'tv' && _sfActive !== 'anime') {
    const d = await tmdb('/search/movie', { query: q, page });
    movies = (d.results || []).map(x => ({ ...x, _type: 'movie' }));
  }
  if (_sfActive !== 'movie' && _sfActive !== 'anime') {
    const d = await tmdb('/search/tv', { query: q, page });
    shows = (d.results || []).map(x => ({ ...x, _type: 'tv' }));
  }
  if (_sfActive === 'anime' || _sfActive === 'all') {
    const Q = `query($s:String,$p:Int){Page(page:$p,perPage:20){media(type:ANIME,search:$s,isAdult:false,sort:[POPULARITY_DESC]){id title{romaji english}coverImage{large}averageScore startDate{year}description(asHtml:false)popularity}}}`;
    const d = await aniQuery(Q, { s: q, p: page });
    anime = (d?.data?.Page?.media || []).map(m => ({ ...normalizeAnime(m), _type: 'anime' }));
  }

  let all = [...movies, ...shows, ...anime];
  if (_sfActive === 'movie') all = movies;
  else if (_sfActive === 'tv') all = shows;
  else if (_sfActive === 'anime') all = anime;
  else if (_sfActive === 'top') all = all.filter(x => (x.vote_average || 0) >= 7.5);
  else if (_sfActive === 'recent') {
    all = all.filter(x => {
      const y = parseInt(String(x.release_date || x.first_air_date || '0').slice(0, 4));
      return y >= 2022;
    });
  }

  all.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Fuzzy fallbacks if first page has too few results
  if (page === 1 && all.length < 4 && _sfActive !== 'anime') {
    const normalized = normalizeQuery(q);
    const noSpaces = normalizeNoSpaces(q);

    const fallbackQueries = [
      normalized !== q ? normalized : null,     // stripped articles / punctuation
      noSpaces !== q.toLowerCase() ? noSpaces : null, // no spaces version
    ].filter(Boolean);

    const existIds = new Set(all.map(x => x.id));

    for (const fq of fallbackQueries) {
      if (all.length >= 6) break;
      const [pm, ptv] = await Promise.allSettled([
        tmdb('/search/movie', { query: fq }),
        tmdb('/search/tv', { query: fq }),
      ]);
      if (pm.status === 'fulfilled') {
        (pm.value.results || []).forEach(x => {
          if (!existIds.has(x.id)) { all.push({ ...x, _type: 'movie', _fuzzy: true }); existIds.add(x.id); }
        });
      }
      if (ptv.status === 'fulfilled') {
        (ptv.value.results || []).forEach(x => {
          if (!existIds.has(x.id)) { all.push({ ...x, _type: 'tv', _fuzzy: true }); existIds.add(x.id); }
        });
      }
    }

    // Keyword search as last resort for TV episodes → shows
    if (all.length < 3) {
      try {
        const kwRes = await tmdb('/search/keyword', { query: q });
        const keywords = (kwRes.results || []).slice(0, 3);
        for (const kw of keywords) {
          const kwMovies = await tmdb('/discover/movie', { with_keywords: kw.id, sort_by: 'popularity.desc' }).catch(() => ({ results: [] }));
          const kwTV = await tmdb('/discover/tv', { with_keywords: kw.id, sort_by: 'popularity.desc' }).catch(() => ({ results: [] }));
          (kwMovies.results || []).slice(0, 4).forEach(x => {
            if (!existIds.has(x.id)) { all.push({ ...x, _type: 'movie', _keyword: true }); existIds.add(x.id); }
          });
          (kwTV.results || []).slice(0, 4).forEach(x => {
            if (!existIds.has(x.id)) { all.push({ ...x, _type: 'tv', _keyword: true }); existIds.add(x.id); }
          });
        }
      } catch {}
    }
  }

  return all;
}

async function loadMoreSearchResults() {
  if (_searchState.loading || _searchState.done || !_searchState.query) return;
  _searchState.loading = true;
  _searchState.page++;

  const sentinel = document.getElementById('search-sentinel');
  if (sentinel) sentinel.innerHTML = `<div class="search-spinner"><div class="spin"></div></div>`;

  try {
    const more = await fetchSearchPage(_searchState.query, _searchState.page);
    const existIds = new Set(_searchState.results.map(x => x.id));
    const newItems = more.filter(x => !existIds.has(x.id));
    if (!newItems.length) {
      _searchState.done = true;
      if (sentinel) sentinel.remove();
      return;
    }
    _searchState.results.push(...newItems);
    renderSearchResults(_searchState.results, _searchState.query, false);
  } catch {}
  _searchState.loading = false;
}

function renderSearchResults(items, q, replace) {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  const qLower = q.toLowerCase();
  const exact = items.filter(x => !x._fuzzy && !x._keyword && (x.title || x.name || '').toLowerCase().includes(qLower));
  const similar = items.filter(x => exact.indexOf(x) === -1 && !x._keyword);
  const keyword = items.filter(x => x._keyword);

  let html = '';
  const count = items.length;
  html += `<div class="search-results-meta">${count} result${count !== 1 ? 's' : ''} for "<strong>${esc(q)}</strong>"</div>`;

  if (exact.length) {
    html += `<div class="search-section-title"><span class="material-icons-round">check_circle</span> Best Matches</div>
      <div class="search-grid">${exact.slice(0, 18).map(m => makeCard(m, m._type)).join('')}</div>`;
  }
  if (similar.length) {
    html += `<div class="search-section-title" style="margin-top:1.5rem"><span class="material-icons-round">auto_awesome</span> Similar Results</div>
      <div class="search-grid">${similar.slice(0, 18).map(m => makeCard(m, m._type)).join('')}</div>`;
  }
  if (keyword.length) {
    html += `<div class="search-section-title" style="margin-top:1.5rem"><span class="material-icons-round">tag</span> Related by Tags</div>
      <div class="search-grid">${keyword.slice(0, 12).map(m => makeCard(m, m._type)).join('')}</div>`;
  }

  // Infinite scroll sentinel
  html += `<div id="search-sentinel" style="height:60px;display:flex;align-items:center;justify-content:center;"></div>`;

  if (replace) {
    area.innerHTML = html;
  } else {
    // Replace sentinel and add new results
    const old = area.querySelector('#search-sentinel');
    if (old) old.remove();
    area.insertAdjacentHTML('beforeend', html.replace(/<div class="search-results-meta">.*?<\/div>/, ''));
  }

  // Observe sentinel for infinite scroll
  const sentinel = document.getElementById('search-sentinel');
  if (sentinel && window._searchScrollObs) {
    window._searchScrollObs.observe(sentinel);
  }
}

/* ── PREF AUTOCOMPLETE ───────────────────────────────────────────── */
export async function searchTmdbAutocomplete(q) {
  if (!q || q.length < 2) return [];
  try {
    const [mv, tv] = await Promise.all([
      tmdb('/search/movie', { query: q }),
      tmdb('/search/tv', { query: q }),
    ]);
    const movies = (mv.results || []).slice(0, 5).map(x => ({ ...x, _type: 'movie' }));
    const shows = (tv.results || []).slice(0, 5).map(x => ({ ...x, _type: 'tv' }));
    const all = [...movies, ...shows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return all.slice(0, 8);
  } catch { return []; }
}
