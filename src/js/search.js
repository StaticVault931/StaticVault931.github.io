import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, skelCards, esc, toast } from './ui.js';
import { state, GENRES, addRecentSearch, clearRecentSearches } from './state.js';

let _debounce = null;
let _sfActive = 'all';
let _searchState = { query: '', page: 1, results: [], loading: false, done: false };

// Advanced filters
let _filters = {
  genre: null,       // TMDB genre id
  yearFrom: null,
  yearTo: null,
  minRating: null,   // 0–10
  contentType: 'all', // all / movie / tv / anime
};

export function getSearchFilters() { return { ..._filters }; }

export function buildSearchFilters(container) {
  if (!container) return;
  const currentYear = new Date().getFullYear();
  container.innerHTML = `
    <div class="sf-advanced" id="sf-advanced">
      <div class="sf-filter-row">
        <label class="sf-filter-label">Genre
          <select class="sf-filter-sel" id="sf-genre">
            <option value="">Any Genre</option>
            ${GENRES.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
          </select>
        </label>
        <label class="sf-filter-label">Content Type
          <select class="sf-filter-sel" id="sf-ctype">
            <option value="all">All</option>
            <option value="movie">Movies Only</option>
            <option value="tv">TV Shows Only</option>
            <option value="anime">Anime Only</option>
          </select>
        </label>
        <label class="sf-filter-label">Min Rating
          <select class="sf-filter-sel" id="sf-rating">
            <option value="">Any Rating</option>
            <option value="9">★ 9+ Masterpiece</option>
            <option value="8">★ 8+ Excellent</option>
            <option value="7">★ 7+ Great</option>
            <option value="6">★ 6+ Good</option>
            <option value="5">★ 5+ Decent</option>
          </select>
        </label>
        <label class="sf-filter-label">Sort By
          <select class="sf-filter-sel" id="sf-sort">
            <option value="popularity.desc">Most Popular</option>
            <option value="vote_average.desc">Highest Rated</option>
            <option value="release_date.desc">Newest First</option>
            <option value="revenue.desc">Highest Grossing</option>
            <option value="vote_count.desc">Most Votes</option>
          </select>
        </label>
        <label class="sf-filter-label">Year From
          <select class="sf-filter-sel" id="sf-year-from">
            <option value="">Any Year</option>
            ${Array.from({length: 50}, (_, i) => currentYear - i).map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </label>
        <label class="sf-filter-label">Year To
          <select class="sf-filter-sel" id="sf-year-to">
            <option value="">Any Year</option>
            ${Array.from({length: 50}, (_, i) => currentYear - i).map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </label>
        <label class="sf-filter-label">Language
          <select class="sf-filter-sel" id="sf-lang">
            <option value="">Any</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </label>
        <button class="sf-filter-clear" id="sf-filter-clear" title="Clear all filters">
          <span class="material-icons-round">filter_alt_off</span> Clear
        </button>
      </div>
    </div>`;

  const readFilters = () => {
    _filters.genre = document.getElementById('sf-genre')?.value || null;
    _filters.contentType = document.getElementById('sf-ctype')?.value || 'all';
    _filters.minRating = document.getElementById('sf-rating')?.value ? parseFloat(document.getElementById('sf-rating').value) : null;
    _filters.sortBy = document.getElementById('sf-sort')?.value || 'popularity.desc';
    _filters.yearFrom = document.getElementById('sf-year-from')?.value ? parseInt(document.getElementById('sf-year-from').value) : null;
    _filters.yearTo = document.getElementById('sf-year-to')?.value ? parseInt(document.getElementById('sf-year-to').value) : null;
    _filters.language = document.getElementById('sf-lang')?.value || null;
  };

  container.querySelectorAll('.sf-filter-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      readFilters();
      const inp = document.getElementById('search-input');
      const q = inp?.value.trim();
      if (q) {
        // Re-trigger current search with new filters
        document.dispatchEvent(new CustomEvent('sv:do-search', { detail: q }));
      } else {
        browseByFilters();
      }
    });
  });

  document.getElementById('sf-filter-clear')?.addEventListener('click', () => {
    _filters = { genre: null, yearFrom: null, yearTo: null, minRating: null, contentType: 'all' };
    container.querySelectorAll('.sf-filter-sel').forEach(sel => { sel.selectedIndex = 0; });
    const inp = document.getElementById('search-input');
    if (inp?.value.trim()) loadSearchDefault();
    else loadSearchDefault();
  });
}

async function browseByFilters() {
  const area = document.getElementById('search-results-area');
  if (!area) return;
  area.innerHTML = `<div class="search-spinner"><div class="spin"></div></div>`;

  try {
    const sort = _filters.sortBy || 'popularity.desc';
    const params = { sort_by: sort, 'vote_count.gte': 20 };
    if (_filters.genre) params.with_genres = _filters.genre;
    if (_filters.minRating) params['vote_average.gte'] = _filters.minRating;
    if (_filters.language) params.with_original_language = _filters.language;
    if (_filters.yearFrom && _filters.contentType !== 'tv') params['primary_release_date.gte'] = `${_filters.yearFrom}-01-01`;
    if (_filters.yearTo && _filters.contentType !== 'tv') params['primary_release_date.lte'] = `${_filters.yearTo}-12-31`;
    if (_filters.yearFrom && _filters.contentType === 'tv') params['first_air_date.gte'] = `${_filters.yearFrom}-01-01`;
    if (_filters.yearTo && _filters.contentType === 'tv') params['first_air_date.lte'] = `${_filters.yearTo}-12-31`;

    let items = [];
    if (_filters.contentType === 'anime') {
      const Q = `query{Page(perPage:20){media(type:ANIME,sort:[POPULARITY_DESC],isAdult:false,${_filters.genre ? `genre:"${_filters.genre}"` : ''}){id title{romaji english}coverImage{large}averageScore startDate{year}popularity}}}`;
      const d = await aniQuery(Q);
      items = (d?.data?.Page?.media || []).map(m => ({ ...normalizeAnime(m), _type: 'anime' }));
    } else if (_filters.contentType === 'tv') {
      const d = await tmdb('/discover/tv', params);
      items = (d.results || []).map(x => ({ ...x, _type: 'tv' }));
    } else {
      const [mv, tv] = await Promise.allSettled([
        _filters.contentType !== 'tv' ? tmdb('/discover/movie', params) : Promise.resolve({ results: [] }),
        _filters.contentType !== 'movie' ? tmdb('/discover/tv', params) : Promise.resolve({ results: [] }),
      ]);
      const movies = mv.status === 'fulfilled' ? (mv.value.results || []).map(x => ({ ...x, _type: 'movie' })) : [];
      const shows = tv.status === 'fulfilled' ? (tv.value.results || []).map(x => ({ ...x, _type: 'tv' })) : [];
      items = [...movies, ...shows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }

    if (!items.length) {
      area.innerHTML = `<div class="search-empty"><span class="material-icons-round">search_off</span><p>No content matches these filters.</p></div>`;
      return;
    }
    area.innerHTML = `
      <div class="search-section-title"><span class="material-icons-round">filter_list</span>Filtered Results (${items.length})</div>
      <div class="search-grid">${items.slice(0, 24).map(m => makeCard(m, m._type || (m.media_type === 'tv' ? 'tv' : 'movie'))).join('')}</div>`;
  } catch {
    area.innerHTML = `<div class="search-empty"><span class="material-icons-round">wifi_off</span><p>Could not load filtered content.</p></div>`;
  }
}

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

let _acDebounce = null;

/* ── INIT ────────────────────────────────────────────────────────── */
export function initSearch() {
  const inp = document.getElementById('search-input');
  if (!inp) return;

  inp.addEventListener('input', function () {
    const clear = document.getElementById('search-clear');
    if (clear) clear.style.display = this.value ? 'flex' : 'none';

    clearTimeout(_debounce);
    clearTimeout(_acDebounce);
    const q = this.value.trim();

    if (!q) {
      closeInlineDrop();
      loadSearchDefault();
      return;
    }

    // Show autocomplete suggestions after short delay
    _acDebounce = setTimeout(() => showInlineSuggestions(q), 200);

    document.getElementById('search-results-area').innerHTML =
      `<div class="search-spinner"><div class="spin"></div></div>`;
    _debounce = setTimeout(() => { closeInlineDrop(); doSearch(q); }, 400);
  });

  inp.addEventListener('focus', () => {
    if (!inp.value.trim()) showInlineRecents();
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeInlineDrop(); inp.blur(); }
    if (e.key === 'Enter' && inp.value.trim()) {
      closeInlineDrop();
      clearTimeout(_debounce);
      doSearch(inp.value.trim());
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#search-page-input-wrap')) closeInlineDrop();
  });

  const clear = document.getElementById('search-clear');
  if (clear) {
    clear.addEventListener('click', () => {
      inp.value = '';
      clear.style.display = 'none';
      closeInlineDrop();
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
    window._searchScrollObs = obs;
  }
}

/* ── INLINE DROPDOWN ─────────────────────────────────────────────── */
function showInlineRecents() {
  const drop = document.getElementById('search-inline-drop');
  if (!drop) return;
  const recents = state.recentSearches || [];
  if (!recents.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = `
    <div class="sid-section-label">Recent Searches</div>
    ${recents.slice(0, 6).map(q => `
      <div class="sid-item" data-sid-q="${esc(q)}">
        <span class="material-icons-round sid-icon">history</span>
        <span class="sid-text">${esc(q)}</span>
        <span class="material-icons-round sid-arrow">north_west</span>
      </div>`).join('')}
    <div class="sid-clear-btn" id="sid-clear">Clear Recent</div>`;
  drop.style.display = '';
  wireInlineDrop(drop);
}

async function showInlineSuggestions(q) {
  const drop = document.getElementById('search-inline-drop');
  if (!drop) return;

  // Show recents first, then autocomplete
  const recents = (state.recentSearches || []).filter(r => r.toLowerCase().includes(q.toLowerCase())).slice(0, 3);
  let html = recents.map(r => `
    <div class="sid-item" data-sid-q="${esc(r)}">
      <span class="material-icons-round sid-icon">history</span>
      <span class="sid-text">${esc(r)}</span>
    </div>`).join('');

  drop.innerHTML = html || `<div class="sid-section-label">Searching…</div>`;
  drop.style.display = '';

  try {
    const results = await searchTmdbAutocomplete(q);
    if (!results.length && !html) { drop.style.display = 'none'; return; }
    const acHtml = results.slice(0, 5).map(r => `
      <div class="sid-item sid-result" data-sid-id="${r.id}" data-sid-type="${r._type}">
        ${r.poster_path ? `<img class="sid-poster" src="https://image.tmdb.org/t/p/w92${r.poster_path}" alt="">` : `<span class="material-icons-round sid-icon">movie</span>`}
        <div class="sid-info">
          <span class="sid-text">${esc(r.title || r.name || '')}</span>
          <span class="sid-sub">${r._type === 'tv' ? 'TV Show' : 'Movie'} · ${String(r.release_date || r.first_air_date || '').slice(0, 4)}</span>
        </div>
      </div>`).join('');
    drop.innerHTML = (recents.length ? `<div class="sid-section-label">Recent</div>${html}` : '') +
      (results.length ? `<div class="sid-section-label">Suggestions</div>${acHtml}` : '');
    drop.style.display = '';
    wireInlineDrop(drop);
  } catch {}
}

function wireInlineDrop(drop) {
  drop.querySelectorAll('[data-sid-q]').forEach(el => {
    el.addEventListener('click', () => {
      const q = el.dataset.sidQ;
      const inp = document.getElementById('search-input');
      if (inp) { inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      closeInlineDrop();
    });
  });
  drop.querySelectorAll('[data-sid-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = +el.dataset.sidId;
      const type = el.dataset.sidType;
      closeInlineDrop();
      // Use custom event to avoid circular import — app.js listens for this
      document.dispatchEvent(new CustomEvent('sv:open-media', { detail: { id, type } }));
    });
  });
  document.getElementById('sid-clear')?.addEventListener('click', () => {
    clearRecentSearches();
    closeInlineDrop();
  });
}

function closeInlineDrop() {
  const drop = document.getElementById('search-inline-drop');
  if (drop) drop.style.display = 'none';
}

/* ── SEARCH TIPS (rotate randomly in placeholder) ───────────────── */
const SEARCH_TIPS = [
  'Try "laugh" to find comedy content that might make you smile',
  'Search "marvel" to find any Marvel movie or show',
  'Type a year like "2024" to see recent releases',
  'Search an actor\'s name to find their movies',
  'Try "anime thriller" to combine genres',
  'Type a director\'s name to find their work',
  'Search "award winning" to find critically acclaimed films',
  'Try "based on book" to find literary adaptations',
  'Type "sequel" to find part 2s and continuations',
  'Search "family friendly" to find content for all ages',
  'Try "animated" for Pixar, Disney, Studio Ghibli and more',
  'Type a franchise name like "star wars" or "harry potter"',
];

export function rotateTip() {
  const inp = document.getElementById('search-input');
  if (!inp || inp.value) return;
  const tip = SEARCH_TIPS[Math.floor(Math.random() * SEARCH_TIPS.length)];
  inp.placeholder = tip;
}

/* ── DEFAULT STATE (no query) ────────────────────────────────────── */
export async function loadSearchDefault() {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  // Rotate tip
  rotateTip();

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
      // Check if filters are active — if so, try without filters as "Did you mean"
      const hasActiveFilters = _filters.genre || _filters.minRating ||
        _filters.yearFrom || _filters.yearTo || _filters.language ||
        (_filters.contentType && _filters.contentType !== 'all');

      if (hasActiveFilters) {
        // Try search without filters
        const savedFilters = { ..._filters };
        _filters = { genre: null, yearFrom: null, yearTo: null, minRating: null, contentType: 'all', sortBy: 'popularity.desc', language: null };
        const fallbackItems = await fetchSearchPage(q, 1).catch(() => []);
        _filters = savedFilters; // restore

        if (fallbackItems.length) {
          area.innerHTML = `
            <div class="search-did-you-mean">
              <span class="material-icons-round">info_outline</span>
              <span>No results with current filters. Did you mean:</span>
              <button class="search-clear-filters-btn" id="didyoumean-clear">Show all results</button>
            </div>
            <div class="search-section-title"><span class="material-icons-round">auto_awesome</span>Results without filters</div>
            <div class="search-grid">${fallbackItems.slice(0, 12).map(m => makeCard(m, m._type || (m.media_type === 'tv' ? 'tv' : 'movie'))).join('')}</div>`;
          document.getElementById('didyoumean-clear')?.addEventListener('click', () => {
            _filters = { genre: null, yearFrom: null, yearTo: null, minRating: null, contentType: 'all', sortBy: 'popularity.desc', language: null };
            document.querySelectorAll('.sf-filter-sel').forEach(s => s.selectedIndex = 0);
            doSearch(q);
          });
          return;
        }
      }

      area.innerHTML = `
        <div class="search-empty">
          <span class="material-icons-round">search_off</span>
          <p>No results for "<strong>${esc(q)}</strong>"</p>
          <p class="muted-note">Try different keywords, check spelling, or clear filters.</p>
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

  // Person search — only for queries that look like names (2+ words) or when results are sparse
  const looksLikeName = q.trim().split(/\s+/).length >= 2 && !/[0-9:!?]/.test(q);

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

  // Normalize anime scores for consistent sorting
  all.forEach(m => {
    if (m._type === 'anime' && !m.vote_average && m.averageScore) {
      m.vote_average = m.averageScore / 10;
      m.popularity = m.popularity || 1; // low priority without explicit popularity
    }
  });
  all.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Apply language filter
  if (_filters.language) {
    all = all.filter(x => x.original_language === _filters.language || !_filters.language);
  }

  // Apply sortBy filter
  if (_filters.sortBy === 'vote_average.desc') {
    all.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  } else if (_filters.sortBy === 'release_date.desc') {
    all.sort((a, b) => new Date(b.release_date || b.first_air_date || 0) - new Date(a.release_date || a.first_air_date || 0));
  }

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

    // Company/network search (for "Marvel", "Disney", "HBO" etc)
    if (all.length < 12) {
      try {
        const companyRes = await tmdb('/search/company', { query: q });
        const companies = (companyRes.results || []).slice(0, 2);
        const existIds2 = new Set(all.map(x => x.id));
        for (const co of companies) {
          const coMovies = await tmdb('/discover/movie', {
            with_companies: co.id,
            sort_by: 'popularity.desc',
            'vote_count.gte': 50,
          }).catch(() => ({ results: [] }));
          (coMovies.results || []).slice(0, 8).forEach(x => {
            if (!existIds2.has(x.id)) { all.push({ ...x, _type: 'movie', _fuzzy: true }); existIds2.add(x.id); }
          });
        }
      } catch {}
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

  // Only do person search if query looks like a name or we need more results
  let _personResults = [];
  if ((looksLikeName || all.length < 4) && page === 1 && (_sfActive === 'all' || _sfActive === 'movie' || _sfActive === 'tv')) {
    try {
      const personData = await tmdb('/search/person', { query: q });
      const people = (personData.results || []).slice(0, 2).filter(p => p.known_for_department);
      for (const person of people) {
        const credits = await tmdb(`/person/${person.id}/combined_credits`);
        const existIds = new Set(all.map(x => x.id));
        const personMovies = (credits.cast || [])
          .filter(m => m.media_type === 'movie' && m.poster_path && !existIds.has(m.id))
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 6)
          .map(m => ({ ...m, _type: 'movie', _viaActor: person.name }));
        const personShows = (credits.cast || [])
          .filter(m => m.media_type === 'tv' && m.poster_path && !existIds.has(m.id))
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 6)
          .map(m => ({ ...m, _type: 'tv', _viaActor: person.name }));
        _personResults.push(...personMovies, ...personShows);
      }
    } catch {}
  }

  // Return combined — person results come AFTER main results
  return [...all, ..._personResults];
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
  const exact = items.filter(x => !x._fuzzy && !x._keyword && !x._viaActor && (x.title || x.name || '').toLowerCase().includes(qLower));
  const viaActor = items.filter(x => x._viaActor);
  const similar = items.filter(x => exact.indexOf(x) === -1 && !x._keyword && !x._viaActor);
  const keyword = items.filter(x => x._keyword);

  let html = '';
  const count = items.filter(x => !x._viaActor).length;
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
  // Show actor/person results grouped
  if (viaActor.length) {
    // Group by actor
    const byActor = {};
    viaActor.forEach(m => { if (!byActor[m._viaActor]) byActor[m._viaActor] = []; byActor[m._viaActor].push(m); });
    for (const [actor, actorItems] of Object.entries(byActor)) {
      html += `<div class="search-section-title" style="margin-top:1.5rem">
        <span class="material-icons-round">person</span> Known for ${esc(actor)}
      </div>
      <div class="search-grid">${actorItems.slice(0, 8).map(m => makeCard(m, m._type)).join('')}</div>`;
    }
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
