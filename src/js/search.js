import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, skelCards, esc, toast } from './ui.js';
import { state, GENRES, addRecentSearch, clearRecentSearches } from './state.js';

let _debounce = null;
let _sfActive = 'all';
let _searchState = { query: '', page: 1, results: [], loading: false, done: false };

// Advanced filters
let _filters = {
  genre: null,
  yearFrom: null,
  yearTo: null,
  minRating: null,
  contentType: 'all',
};

// Provider filter state
let _providerFilter = null; // { id, name } | null

// "Not on my services" filter state
let _excludeMyServices = false;
let _myProviders = new Set(JSON.parse(localStorage.getItem('sv_my_providers') || '[]'));
function _saveMyProviders() { localStorage.setItem('sv_my_providers', JSON.stringify([..._myProviders])); }

const _MY_PROV_LIST = [
  { id: 8,    name: 'Netflix' },
  { id: 337,  name: 'Disney+' },
  { id: 9,    name: 'Prime Video' },
  { id: 1899, name: 'Max' },
  { id: 15,   name: 'Hulu' },
  { id: 350,  name: 'Apple TV+' },
  { id: 531,  name: 'Paramount+' },
  { id: 386,  name: 'Peacock' },
  { id: 283,  name: 'Crunchyroll' },
];

// Everything browse state
let _everythingSort = 'popularity.desc';
let _everythingPage = 1;
let _everythingLoading = false;
let _everythingType = 'all'; // all | movie | tv
let _everythingObs = null;

export function getSearchFilters() { return { ..._filters }; }

export function setProviderFilter(prov) {
  _providerFilter = prov || null;
  _sfActive = 'everything';
}

export function buildSearchFilters(container) {
  if (!container) return;
  const currentYear = new Date().getFullYear();
  // Year range: 1900 → current
  const allYears = Array.from({length: currentYear - 1899}, (_, i) => currentYear - i);

  // Decade quick-select presets
  const decades = [
    { label: 'Any Decade', from: '', to: '' },
    { label: '2020s', from: 2020, to: currentYear },
    { label: '2010s', from: 2010, to: 2019 },
    { label: '2000s', from: 2000, to: 2009 },
    { label: '90s', from: 1990, to: 1999 },
    { label: '80s', from: 1980, to: 1989 },
    { label: '70s', from: 1970, to: 1979 },
    { label: 'Classics', from: 1900, to: 1969 },
  ];

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
            <option value="4">★ 4+ Average</option>
          </select>
        </label>
        <label class="sf-filter-label">Sort By
          <select class="sf-filter-sel" id="sf-sort">
            <option value="popularity.desc">Most Popular</option>
            <option value="vote_average.desc">Highest Rated</option>
            <option value="release_date.desc">Newest First</option>
            <option value="release_date.asc">Oldest First</option>
            <option value="revenue.desc">Highest Grossing</option>
            <option value="vote_count.desc">Most Votes</option>
          </select>
        </label>
        <label class="sf-filter-label">Decade
          <select class="sf-filter-sel" id="sf-decade">
            ${decades.map(d => `<option value="${d.from}:${d.to}">${d.label}</option>`).join('')}
          </select>
        </label>
        <label class="sf-filter-label">Year From
          <select class="sf-filter-sel" id="sf-year-from">
            <option value="">Any Year</option>
            ${allYears.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </label>
        <label class="sf-filter-label">Year To
          <select class="sf-filter-sel" id="sf-year-to">
            <option value="">Any Year</option>
            ${allYears.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </label>
        <label class="sf-filter-label">Runtime
          <select class="sf-filter-sel" id="sf-runtime">
            <option value="">Any Length</option>
            <option value="short">Short (&lt;90 min)</option>
            <option value="medium">Medium (90–150 min)</option>
            <option value="long">Long (150–210 min)</option>
            <option value="epic">Epic (&gt;210 min)</option>
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
            <option value="hi">Hindi</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="zh">Chinese</option>
          </select>
        </label>
        <label class="sf-filter-label" title="Movies: released/upcoming. TV: returning/ended/cancelled">Status
          <select class="sf-filter-sel" id="sf-status">
            <option value="">Any Status</option>
            <option value="released">Released</option>
            <option value="upcoming">Upcoming</option>
            <option value="airing">Currently Airing</option>
            <option value="ended">Ended/Cancelled</option>
          </select>
        </label>
        <button class="sf-filter-clear" id="sf-filter-clear" title="Clear all filters">
          <span class="material-icons-round">filter_alt_off</span> Clear
        </button>
      </div>
      <!-- Provider filter row -->
      <div class="sf-filter-row sf-provider-row">
        <span class="sf-filter-label" style="font-size:.75rem;font-weight:700;color:var(--dim);align-self:center">Filter by Provider:</span>
        <button class="sf-prov-chip${!_providerFilter ? ' on' : ''}" data-prov-id="" data-prov-name="">Any Provider</button>
        <button class="sf-prov-chip${_providerFilter?.id === 8 ? ' on' : ''}" data-prov-id="8" data-prov-name="Netflix">Netflix</button>
        <button class="sf-prov-chip${_providerFilter?.id === 337 ? ' on' : ''}" data-prov-id="337" data-prov-name="Disney+">Disney+</button>
        <button class="sf-prov-chip${_providerFilter?.id === 9 ? ' on' : ''}" data-prov-id="9" data-prov-name="Prime Video">Prime Video</button>
        <button class="sf-prov-chip${_providerFilter?.id === 1899 ? ' on' : ''}" data-prov-id="1899" data-prov-name="Max">Max</button>
        <button class="sf-prov-chip${_providerFilter?.id === 15 ? ' on' : ''}" data-prov-id="15" data-prov-name="Hulu">Hulu</button>
        <button class="sf-prov-chip${_providerFilter?.id === 350 ? ' on' : ''}" data-prov-id="350" data-prov-name="Apple TV+">Apple TV+</button>
        <button class="sf-prov-chip${_providerFilter?.id === 531 ? ' on' : ''}" data-prov-id="531" data-prov-name="Paramount+">Paramount+</button>
        <button class="sf-prov-chip${_providerFilter?.id === 386 ? ' on' : ''}" data-prov-id="386" data-prov-name="Peacock">Peacock</button>
        <button class="sf-prov-chip${_providerFilter?.id === 283 ? ' on' : ''}" data-prov-id="283" data-prov-name="Crunchyroll">Crunchyroll</button>
      </div>
      <!-- Not on my services row -->
      <div class="sf-filter-row sf-exclude-row">
        <span class="sf-filter-label" style="font-size:.75rem;font-weight:700;color:var(--dim);align-self:center">Not on my services:</span>
        <button class="sf-exclude-toggle${_excludeMyServices ? ' on' : ''}" id="sf-exclude-btn" title="Show only content not available on your selected subscriptions">
          <span class="material-icons-round" style="font-size:.9rem">${_excludeMyServices ? 'toggle_on' : 'toggle_off'}</span>
          ${_excludeMyServices ? 'Active' : 'Off'}
        </button>
        ${_MY_PROV_LIST.map(p => `<button class="sf-my-prov-chip${_myProviders.has(p.id) ? ' on' : ''}" data-my-prov="${p.id}" title="I subscribe to ${p.name}">${p.name}</button>`).join('')}
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
    _filters.runtime = document.getElementById('sf-runtime')?.value || null;
    _filters.status = document.getElementById('sf-status')?.value || null;
  };

  // Decade preset wires year-from and year-to selects
  document.getElementById('sf-decade')?.addEventListener('change', (e) => {
    const [from, to] = e.target.value.split(':');
    const fromSel = document.getElementById('sf-year-from');
    const toSel   = document.getElementById('sf-year-to');
    if (fromSel) fromSel.value = from || '';
    if (toSel)   toSel.value   = to   || '';
    readFilters();
    // Also update _filters directly from decade selection
    _filters.yearFrom = from ? parseInt(from) : null;
    _filters.yearTo   = to   ? parseInt(to)   : null;
    const inp = document.getElementById('search-input');
    const q = inp?.value.trim();
    if (q) document.dispatchEvent(new CustomEvent('sv:do-search', { detail: q }));
    else browseByFilters();
  });

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
    _filters = { genre: null, yearFrom: null, yearTo: null, minRating: null, contentType: 'all', sortBy: 'popularity.desc', language: null, runtime: null, status: null };
    _providerFilter = null;
    _excludeMyServices = false;
    container.querySelectorAll('.sf-filter-sel').forEach(sel => { sel.selectedIndex = 0; });
    container.querySelectorAll('.sf-prov-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
    const btn = document.getElementById('sf-exclude-btn');
    if (btn) { btn.classList.remove('on'); btn.innerHTML = `<span class="material-icons-round" style="font-size:.9rem">toggle_off</span>Off`; }
    loadSearchDefault();
  });

  // Provider chips
  container.querySelectorAll('.sf-prov-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.provId ? +chip.dataset.provId : null;
      const name = chip.dataset.provName || null;
      _providerFilter = id ? { id, name } : null;
      container.querySelectorAll('.sf-prov-chip').forEach(c => c.classList.toggle('on', c === chip));
      const inp = document.getElementById('search-input');
      const q = inp?.value.trim();
      if (q) document.dispatchEvent(new CustomEvent('sv:do-search', { detail: q }));
      else if (_sfActive === 'everything') loadEverything();
      else browseByFilters();
    });
  });

  // "Not on my services" — toggle button
  document.getElementById('sf-exclude-btn')?.addEventListener('click', () => {
    _excludeMyServices = !_excludeMyServices;
    const btn = document.getElementById('sf-exclude-btn');
    if (btn) {
      btn.classList.toggle('on', _excludeMyServices);
      btn.innerHTML = `<span class="material-icons-round" style="font-size:.9rem">${_excludeMyServices ? 'toggle_on' : 'toggle_off'}</span>${_excludeMyServices ? 'Active' : 'Off'}`;
    }
    const inp = document.getElementById('search-input');
    const q = inp?.value.trim();
    if (q) document.dispatchEvent(new CustomEvent('sv:do-search', { detail: q }));
    else if (_sfActive === 'everything') loadEverything();
    else browseByFilters();
  });

  // "My subscriptions" — multi-select chips
  container.querySelectorAll('.sf-my-prov-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = +chip.dataset.myProv;
      if (_myProviders.has(id)) _myProviders.delete(id); else _myProviders.add(id);
      chip.classList.toggle('on', _myProviders.has(id));
      _saveMyProviders();
      if (_excludeMyServices) {
        const inp = document.getElementById('search-input');
        const q = inp?.value.trim();
        if (q) document.dispatchEvent(new CustomEvent('sv:do-search', { detail: q }));
        else if (_sfActive === 'everything') loadEverything();
        else browseByFilters();
      }
    });
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
    if (_providerFilter?.id) { params.with_watch_providers = _providerFilter.id; params.watch_region = 'US'; }
    if (_excludeMyServices && _myProviders.size > 0) { params.without_watch_providers = [..._myProviders].join('|'); params.watch_region = 'US'; }
    if (_filters.yearFrom && _filters.contentType !== 'tv') params['primary_release_date.gte'] = `${_filters.yearFrom}-01-01`;
    if (_filters.yearTo && _filters.contentType !== 'tv') params['primary_release_date.lte'] = `${_filters.yearTo}-12-31`;
    if (_filters.yearFrom && _filters.contentType === 'tv') params['first_air_date.gte'] = `${_filters.yearFrom}-01-01`;
    if (_filters.yearTo && _filters.contentType === 'tv') params['first_air_date.lte'] = `${_filters.yearTo}-12-31`;
    // Runtime filter (TMDB uses minutes)
    if (_filters.runtime) {
      const rtMap = { short: [0, 90], medium: [90, 150], long: [150, 210], epic: [210, 9999] };
      const [rMin, rMax] = rtMap[_filters.runtime] || [];
      if (rMin != null) params['with_runtime.gte'] = rMin;
      if (rMax && rMax < 9999) params['with_runtime.lte'] = rMax;
    }
    // Status filter
    if (_filters.status) {
      if (_filters.status === 'upcoming' && _filters.contentType !== 'tv') {
        params['primary_release_date.gte'] = new Date().toISOString().slice(0, 10);
      } else if (_filters.status === 'released' && _filters.contentType !== 'tv') {
        params['primary_release_date.lte'] = new Date().toISOString().slice(0, 10);
      } else if (_filters.status === 'airing') {
        params['with_status'] = '0'; // TMDB status 0 = Returning Series
      } else if (_filters.status === 'ended') {
        params['with_status'] = '2|3|4'; // Ended, Cancelled, In Production
      }
    }

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
  return q
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[''`""]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNoSpaces(q) {
  return q.replace(/\s+/g, '').toLowerCase();
}

/* ── LEVENSHTEIN (fuzzy / typo correction) ───────────────────────── */
function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({length: a.length + 1}, (_, i) =>
    Array.from({length: b.length + 1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

// Fold a string for matching: lowercase, strip accents, punctuation, collapse spaces
function foldTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''`""&.:!?,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score how similar a title is to a query (0 = perfect, higher = worse)
function titleSimilarity(query, title) {
  if (!title) return 999;
  const q = foldTitle(query);
  const t = foldTitle(title);
  if (!q || !t) return 999;
  if (t === q) return 0;
  const qNS = q.replace(/ /g, '');
  const tNS = t.replace(/ /g, '');
  if (tNS === qNS) return 0;                       // "spider man" ↔ "spiderman"
  if (t.startsWith(q) || tNS.startsWith(qNS)) return 1;
  if (t.includes(q) || tNS.includes(qNS)) return 2;
  // Word-level: every query word is a prefix of some title word ("stranger thing" → "stranger things")
  const qWords = q.split(' ');
  const tWords = t.split(' ');
  if (qWords.length > 1 && qWords.every(qw => tWords.some(tw => tw.startsWith(qw)))) return 2;
  // Typo tolerance on the space-free forms ("spidrman" ↔ "spiderman")
  const dist = levenshtein(qNS, tNS);
  return dist <= Math.max(2, Math.ceil(qNS.length * 0.3)) ? 3 + dist : 999;
}

// Compute a single relevance score (higher = more relevant to show first)
function computeRelevance(item, qLow) {
  const title = (item.title || item.name || item.romaji || '').toLowerCase();
  const sim = titleSimilarity(qLow, title);
  // Title match: exact=500, starts-with=400, contains=200, close=100, else=0
  const titleScore = sim === 0 ? 500 : sim === 1 ? 400 : sim === 2 ? 200 : sim <= 6 ? 100 : 0;
  // Quality signal: log-weighted vote count × rating (normalised to 0-100)
  const quality = Math.log10((item.vote_count || 1) + 1) * (item.vote_average || item.averageScore || 0);
  // Popularity signal (small weight so quality/title win)
  const pop = Math.log10((item.popularity || 1) + 1);
  return titleScore + quality * 3 + pop;
}

// Build a variant spelling list for a query (catches common misspellings)
function queryVariants(q) {
  const variants = new Set([q]);
  // Double letters → single (e.g. "jurrasic" → "jurasic")
  variants.add(q.replace(/(.)\1+/g, '$1'));
  // Common vowel swaps
  variants.add(q.replace(/[aeiou]/gi, m => ({ a:'e',e:'a',i:'e',o:'u',u:'o' }[m.toLowerCase()] || m)));
  // Remove trailing s/es
  if (q.endsWith('s')) variants.add(q.slice(0, -1));
  if (q.endsWith('es')) variants.add(q.slice(0, -2));
  return [...variants].filter(v => v !== q && v.length >= 3);
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
    _debounce = setTimeout(() => { closeInlineDrop(); doSearch(q); }, 280);
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
      if (_sfActive === 'everything') {
        loadEverything(true);
      } else if (q) {
        doSearch(q);
      } else {
        loadSearchDefault();
      }
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

/* ── SEARCH TIPS (rotate in placeholder with fade animation) ──────── */
const SEARCH_TIPS = [
  // Regular title/person search examples
  'Search "The Dark Knight" — direct title search',
  'Search "Christopher Nolan" — find all their work',
  'Search "Breaking Bad" — jump straight to a show',
  'Search "Meryl Streep" — browse an actor\'s filmography',
  'Search "2001" or "Inception" — any title, any year',
  // :topic / keyword search (colon syntax)
  'Try :comedy to browse by topic',
  'Try :space adventure to discover themed content',
  'Try :heist to find all the best heist films',
  'Try :coming of age — use : prefix for topic search',
  'Try :serial killer for thriller genre deep-dives',
  'Try :time travel to find all time-travel stories',
  'Try :based on true story for real-event dramas',
  'Try :found footage — niche genre topics work too',
  'Try :superhero for the full Marvel & DC catalogue',
  // Filter tips
  'Use Filters → Genre + Decade for precise browsing',
  'Filter by Runtime to find short or epic-length films',
  'Filter by Language to discover world cinema',
  'Filter Highest Rated + 2010s to find decade gems',
  'Filter Movies Only + ★8+ for critically acclaimed picks',
];

let _lastTipIdx = -1;
export function rotateTip() {
  const inp = document.getElementById('search-input');
  if (!inp || inp.value) return;
  // Pick a different tip each time
  let idx;
  do { idx = Math.floor(Math.random() * SEARCH_TIPS.length); } while (idx === _lastTipIdx && SEARCH_TIPS.length > 1);
  _lastTipIdx = idx;
  const tip = SEARCH_TIPS[idx];
  // Fade animation via class toggle
  inp.classList.remove('tip-fade-in');
  void inp.offsetWidth; // force reflow to restart animation
  inp.placeholder = tip;
  inp.classList.add('tip-fade-in');
}

/* ── EVERYTHING BROWSE ───────────────────────────────────────────── */
const EVERYTHING_SORTS = [
  { value: 'popularity.desc',    label: 'Popularity',    icon: 'local_fire_department' },
  { value: 'original_title.asc', label: 'A – Z',         icon: 'sort_by_alpha' },
  { value: 'release_date.desc',  label: 'Release Date',  icon: 'calendar_today' },
  { value: 'vote_average.desc',  label: 'Top Rated',     icon: 'star' },
  { value: 'release_date.asc',   label: 'Oldest First',  icon: 'history' },
  { value: 'vote_count.desc',    label: 'Most Voted',    icon: 'how_to_vote' },
];

export async function loadEverything(reset = true) {
  const area = document.getElementById('search-results-area');
  if (!area) return;
  if (reset) {
    _everythingPage = 1;
    _everythingLoading = false;
    const provLabel = _providerFilter ? ` on ${_providerFilter.name}` : '';
    area.innerHTML = `
      <div class="everything-header">
        <div class="everything-title">
          <span class="material-icons-round">apps</span>
          Browse Everything${provLabel}
        </div>
        <div class="everything-sort-row" role="group" aria-label="Sort order">
          ${EVERYTHING_SORTS.map(s => `
            <button class="everything-sort-btn${s.value === _everythingSort ? ' on' : ''}" data-sort="${esc(s.value)}" aria-pressed="${s.value === _everythingSort}">
              <span class="material-icons-round">${s.icon}</span>${s.label}
            </button>`).join('')}
        </div>
        <div class="everything-type-row" role="group" aria-label="Content type">
          <button class="everything-type-btn${_everythingType === 'all' ? ' on' : ''}" data-type="all">All</button>
          <button class="everything-type-btn${_everythingType === 'movie' ? ' on' : ''}" data-type="movie">Movies</button>
          <button class="everything-type-btn${_everythingType === 'tv' ? ' on' : ''}" data-type="tv">TV Shows</button>
        </div>
      </div>
      <div class="search-grid" id="everything-grid"></div>
      <div id="everything-sentinel" style="height:1px"></div>`;

    // Wire sort buttons
    area.querySelectorAll('.everything-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _everythingSort = btn.dataset.sort;
        area.querySelectorAll('.everything-sort-btn').forEach(b => {
          b.classList.toggle('on', b === btn);
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        loadEverything(true);
      });
    });

    // Wire type buttons
    area.querySelectorAll('.everything-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _everythingType = btn.dataset.type;
        area.querySelectorAll('.everything-type-btn').forEach(b => b.classList.toggle('on', b === btn));
        loadEverything(true);
      });
    });

    // Infinite scroll sentinel — disconnect old observer first to prevent stacking
    if (_everythingObs) { _everythingObs.disconnect(); _everythingObs = null; }
    const sentinel = document.getElementById('everything-sentinel');
    _everythingObs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !_everythingLoading) loadEverything(false);
    }, { rootMargin: '300px' });
    if (sentinel) _everythingObs.observe(sentinel);
  }

  if (_everythingLoading) return;
  _everythingLoading = true;

  const grid = document.getElementById('everything-grid');
  if (!grid) { _everythingLoading = false; return; }

  // Show skeletons on first page
  if (_everythingPage === 1) grid.innerHTML = skelCards(20);

  const params = {
    sort_by: _everythingSort,
    page: _everythingPage,
    'vote_count.gte': _everythingSort.startsWith('vote_average') ? 200 : 10,
  };
  if (_providerFilter?.id) { params.with_watch_providers = _providerFilter.id; params.watch_region = 'US'; }
  if (_excludeMyServices && _myProviders.size > 0) { params.without_watch_providers = [..._myProviders].join('|'); params.watch_region = 'US'; }

  try {
    let items = [];
    if (_everythingType === 'movie') {
      const d = await tmdb('/discover/movie', params);
      items = (d.results || []).map(m => ({ ...m, _type: 'movie' }));
    } else if (_everythingType === 'tv') {
      const d = await tmdb('/discover/tv', params);
      items = (d.results || []).map(m => ({ ...m, _type: 'tv' }));
    } else {
      const tvParams = { ...params };
      // TV uses first_air_date for date sorting
      if (params.sort_by === 'release_date.desc') tvParams.sort_by = 'first_air_date.desc';
      if (params.sort_by === 'release_date.asc') tvParams.sort_by = 'first_air_date.asc';
      const [mv, tv] = await Promise.allSettled([
        tmdb('/discover/movie', params),
        tmdb('/discover/tv', tvParams),
      ]);
      const movies = mv.status === 'fulfilled' ? (mv.value.results || []).map(m => ({ ...m, _type: 'movie' })) : [];
      const shows  = tv.status === 'fulfilled' ? (tv.value.results || []).map(m => ({ ...m, _type: 'tv' })) : [];
      // Interleave by popularity
      items = [...movies, ...shows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }

    if (_everythingPage === 1) grid.innerHTML = '';
    items.forEach(item => {
      grid.insertAdjacentHTML('beforeend', makeCard(item, item._type));
    });
    if (items.length === 0 && _everythingPage === 1) {
      grid.innerHTML = `<p class="muted-note" style="padding:2rem 0">No results found.</p>`;
    }
    _everythingPage++;
  } catch (err) {
    if (_everythingPage === 1) grid.innerHTML = `<p class="muted-note">Could not load content.</p>`;
  } finally {
    _everythingLoading = false;
  }
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

/* ── EASTER EGGS ─────────────────────────────────────────────────── */
function checkSearchEasterEgg(q) {
  const lower = q.toLowerCase().trim();
  const area = document.getElementById('search-results-area');
  if (!area) return false;

  const eggs = {
    'staticvault931': { msg: 'You found the source! This is StaticVault931 — your personal cinema. Made with love by StaticQuasar931.', color: '#e50914', icon: 'movie' },
    'staticquasar931': { msg: "Hey! That's us! Hi there, explorer! StaticQuasar931 is the creator of StaticVault931. Check out our Instagram @StaticQuasar931!", color: '#6366f1', icon: 'auto_awesome' },
    'sv931': { msg: 'Short and sweet! SV931 = StaticVault931. You\'ve found the secret shorthand!', color: '#22c55e', icon: 'celebration' },
    'themoviedb': { msg: "TMDB powers StaticVault931's entire catalog! We love their API. Check them out at themoviedb.org.", color: '#06b6d4', icon: 'storage' },
    'anilist': { msg: 'AniList powers all the anime you see here! Amazing community and API.', color: '#8b5cf6', icon: 'auto_awesome' },
  };

  const egg = eggs[lower];
  if (!egg) return false;

  const emojiMap = { movie: '🎬', celebration: '🎉', science: '🧪', auto_awesome: '✨', storage: '💡' };
  const emoji = emojiMap[egg.icon] || '✨';

  area.innerHTML = `
    <div class="easter-egg-result" style="text-align:center;padding:3rem 1rem;animation:eggReveal .6s var(--ease)">
      <div style="font-size:4rem;margin-bottom:1rem">${emoji}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${egg.color};margin-bottom:.75rem;font-family:'Bebas Neue',Impact,sans-serif;letter-spacing:.05em;text-transform:uppercase">Easter Egg Found!</div>
      <div style="font-size:.95rem;color:var(--muted);max-width:500px;margin:0 auto;line-height:1.7">${egg.msg}</div>
    </div>`;

  // Confetti animation
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;top:-10px;left:${Math.random() * 100}vw;width:8px;height:8px;border-radius:50%;background:${egg.color};z-index:9999;pointer-events:none;animation:confettiFall ${1 + Math.random() * 2}s ease-in forwards;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }, i * 80);
  }
  return true;
}

/* ── SEARCH ──────────────────────────────────────────────────────── */
export async function doSearch(q) {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  addRecentSearch(q);
  if (checkSearchEasterEgg?.(q)) return; // stop if easter egg found

  // ── :topic SEARCH ──────────────────────────────────────────────────
  // Prefix with : to search by topic/keyword instead of title
  // e.g. ":funny" ":coming out" ":space adventure"
  if (q.startsWith(':')) {
    const topic = q.slice(1).trim();
    if (!topic) return;
    area.innerHTML = `<div class="search-spinner"><div class="spin"></div></div>`;
    try {
      // Run keyword + company searches in parallel for best coverage
      const [kwRes, coRes] = await Promise.allSettled([
        tmdb('/search/keyword', { query: topic }),
        tmdb('/search/company', { query: topic }),
      ]);
      const keywords = (kwRes.status === 'fulfilled' ? kwRes.value.results : []).slice(0, 5);
      const companies = (coRes.status === 'fulfilled' ? coRes.value.results : []).slice(0, 3);

      let allItems = [];
      const existIds = new Set();

      // Keyword-based discover
      for (const kw of keywords) {
        const [mv, tv] = await Promise.allSettled([
          tmdb('/discover/movie', { with_keywords: kw.id, sort_by: 'popularity.desc', 'vote_count.gte': 30 }),
          tmdb('/discover/tv', { with_keywords: kw.id, sort_by: 'popularity.desc' }),
        ]);
        if (mv.status === 'fulfilled') (mv.value.results || []).forEach(m => { if (!existIds.has(m.id)) { allItems.push({...m, _type:'movie', _keyword: kw.name}); existIds.add(m.id); }});
        if (tv.status === 'fulfilled') (tv.value.results || []).forEach(m => { if (!existIds.has(m.id)) { allItems.push({...m, _type:'tv', _keyword: kw.name}); existIds.add(m.id); }});
      }

      // Company-based discover (e.g., searching ":Marvel" finds Marvel Studios)
      for (const co of companies.slice(0, 2)) {
        const [mv, tv] = await Promise.allSettled([
          tmdb('/discover/movie', { with_companies: co.id, sort_by: 'popularity.desc', 'vote_count.gte': 50 }),
          tmdb('/discover/tv', { with_companies: co.id, sort_by: 'popularity.desc' }),
        ]);
        if (mv.status === 'fulfilled') (mv.value.results || []).forEach(m => { if (!existIds.has(m.id)) { allItems.push({...m, _type:'movie'}); existIds.add(m.id); }});
        if (tv.status === 'fulfilled') (tv.value.results || []).forEach(m => { if (!existIds.has(m.id)) { allItems.push({...m, _type:'tv'}); existIds.add(m.id); }});
      }

      allItems.sort((a,b) => (b.popularity||0) - (a.popularity||0));
      
      if (!allItems.length) {
        area.innerHTML = `<div class="search-empty"><span class="material-icons-round">search_off</span><p>No topic results for "<strong>${esc(topic)}</strong>"</p><p class="muted-note">Try different keywords like :funny, :space, :romance</p></div>`;
        return;
      }
      
      const matchedKw = keywords.map(k => k.name).filter(Boolean);
      const matchedCo = companies.map(c => c.name).filter(Boolean);
      const matchedAll = [...matchedKw, ...matchedCo].slice(0, 4).join(', ');
      area.innerHTML = `
        <div class="search-did-you-mean" style="border-color:rgba(99,102,241,.3);background:rgba(99,102,241,.08);color:#a78bfa">
          <span class="material-icons-round">tag</span>
          <span>Topic search${matchedAll ? `: <strong>${esc(matchedAll)}</strong>` : ''}</span>
          <span style="font-size:.72rem;color:var(--dim);margin-left:auto">Tip: Use : prefix to search by topic</span>
        </div>
        <div class="search-section-title"><span class="material-icons-round">auto_awesome</span> "${esc(topic)}" — ${allItems.length} results</div>
        <div class="search-grid">${allItems.slice(0,24).map(m => makeCard(m, m._type)).join('')}</div>`;
    } catch {
      area.innerHTML = `<div class="search-empty"><span class="material-icons-round">wifi_off</span><p>Topic search failed.</p></div>`;
    }
    return;
  }
  _searchState = { query: q, page: 1, results: [], loading: true, done: false };

  try {
    let items = await fetchSearchPage(q, 1);
    // Filter anime from search results if hideAnime is enabled
    try {
      const svSettings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
      if (svSettings.hideAnime) items = items.filter(m => m._type !== 'anime' && m.media_type !== 'anime');
    } catch {}
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
  } catch (err) {
    console.error('[SV Search] failed:', err?.message || err);
    _searchState.loading = false;
    area.innerHTML = `<div class="search-empty">
      <span class="material-icons-round">wifi_off</span>
      <p>Search failed — check your connection.</p>
    </div>`;
  }
}

async function fetchSearchPage(q, page) {
  let _personResults = [];

  // Extract year from query (e.g. "Die Hard 1988" → query="Die Hard", year=1988)
  const yearMatch = q.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  const yearHint = yearMatch ? parseInt(yearMatch[0]) : null;
  const qClean = yearHint ? q.replace(yearMatch[0], '').trim() : q;

  // Person search — only for queries that look like names (2+ words) or when results are sparse
  const looksLikeName = qClean.trim().split(/\s+/).length >= 2 && !/[0-9:!?]/.test(qClean);

  // ── Run movie / TV / anime searches IN PARALLEL for speed ──────────
  const wantMovies = _sfActive !== 'tv' && _sfActive !== 'anime';
  const wantTV     = _sfActive !== 'movie' && _sfActive !== 'anime';
  const wantAnime  = _sfActive === 'anime' || _sfActive === 'all';
  const aniGQL = `query($s:String,$p:Int){Page(page:$p,perPage:20){media(type:ANIME,search:$s,isAdult:false,sort:[POPULARITY_DESC]){id title{romaji english}coverImage{large}averageScore startDate{year}description(asHtml:false)popularity}}}`;

  const [movieRes, tvRes, animeRes] = await Promise.allSettled([
    wantMovies ? tmdb('/search/movie', { query: qClean, page, ...(yearHint ? { year: yearHint } : {}) }) : Promise.resolve(null),
    wantTV     ? tmdb('/search/tv',    { query: qClean, page, ...(yearHint ? { first_air_date_year: yearHint } : {}) }) : Promise.resolve(null),
    wantAnime  ? aniQuery(aniGQL, { s: qClean, p: page })       : Promise.resolve(null),
  ]);

  const movies = (movieRes.status === 'fulfilled' && movieRes.value?.results)
    ? movieRes.value.results.map(x => ({ ...x, _type: 'movie' })) : [];
  const shows  = (tvRes.status === 'fulfilled' && tvRes.value?.results)
    ? tvRes.value.results.map(x => ({ ...x, _type: 'tv' })) : [];
  const anime  = (animeRes.status === 'fulfilled' && animeRes.value?.data?.Page?.media)
    ? animeRes.value.data.Page.media.map(m => ({ ...normalizeAnime(m), _type: 'anime' })) : [];

  let all = [...movies, ...shows, ...anime];
  if (_sfActive === 'movie') all = movies;
  else if (_sfActive === 'tv') all = shows;
  else if (_sfActive === 'anime') all = anime;
  else if (_sfActive === 'top') all = all.filter(x => (x.vote_average || 0) >= 7.5);
  else if (_sfActive === 'recent') {
    const cutoff = new Date().getFullYear() - 2;
    all = all.filter(x => {
      const y = parseInt(String(x.release_date || x.first_air_date || '0').slice(0, 4));
      return y >= cutoff;
    });
  }

  // Normalize anime scores for consistent sorting
  all.forEach(m => {
    if (m._type === 'anime' && !m.vote_average && m.averageScore) {
      m.vote_average = m.averageScore / 10;
      m.popularity = m.popularity || 1;
    }
  });

  // ── SORT: relevance (title match + quality) with anime de-prioritised ──
  const qLow = (yearHint ? qClean : q).toLowerCase().trim();
  all.sort((a, b) => {
    const aIsAnime = a._type === 'anime';
    const bIsAnime = b._type === 'anime';
    const aRel = computeRelevance(a, qLow);
    const bRel = computeRelevance(b, qLow);
    const aSim = titleSimilarity(qLow, a.title || a.name || '');
    const bSim = titleSimilarity(qLow, b.title || b.name || '');
    const aExact = aSim <= 2;
    const bExact = bSim <= 2;
    // In 'all' mode: anime only beats non-anime on exact title match
    if (_sfActive === 'all') {
      if (aIsAnime && !bIsAnime && aExact && !bExact) return -1;
      if (bIsAnime && !aIsAnime && bExact && !aExact) return 1;
      if (aIsAnime && !bIsAnime && !aExact) return 1;
      if (bIsAnime && !aIsAnime && !bExact) return -1;
    }
    return bRel - aRel;
  });

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
    const normalized = normalizeQuery(qClean);
    const noSpaces = normalizeNoSpaces(qClean);
    // Levenshtein-based variants (catches "jurrasic world", "avengrs", etc.)
    const typoVariants = queryVariants(qClean);

    const fallbackQueries = [
      normalized !== q ? normalized : null,
      noSpaces !== q.toLowerCase() ? noSpaces : null,
      ...typoVariants,
    ].filter(Boolean).slice(0, 4);

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
  if ((looksLikeName || all.length < 4) && page === 1 && (_sfActive === 'all' || _sfActive === 'movie' || _sfActive === 'tv')) {
    try {
      const personData = await tmdb('/search/person', { query: qClean });
      const people = (personData.results || []).slice(0, 2).filter(p => p.known_for_department);
      // Fetch all person credits in parallel
      const creditResults = await Promise.allSettled(
        people.map(p => tmdb(`/person/${p.id}/combined_credits`))
      );
      const existIds = new Set(all.map(x => x.id));
      people.forEach((person, i) => {
        if (creditResults[i].status !== 'fulfilled') return;
        const credits = creditResults[i].value;
        const personMovies = (credits.cast || [])
          .filter(m => m.media_type === 'movie' && m.poster_path && !existIds.has(m.id))
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 6)
          .map(m => ({ ...m, _type: 'movie', _viaActor: person.name, _viaActorId: person.id }));
        const personShows = (credits.cast || [])
          .filter(m => m.media_type === 'tv' && m.poster_path && !existIds.has(m.id))
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 6)
          .map(m => ({ ...m, _type: 'tv', _viaActor: person.name, _viaActorId: person.id }));
        _personResults.push(...personMovies, ...personShows);
        personMovies.forEach(m => existIds.add(m.id));
        personShows.forEach(m => existIds.add(m.id));
      });
    } catch {}
  }

  // Return combined — person results come AFTER main results (deduped)
  const allIds = new Set(all.map(x => x.id));
  const dedupedPersonResults = _personResults.filter(x => x.id && !allIds.has(x.id));
  return [...all, ...dedupedPersonResults];
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
      const actorId = actorItems[0]?._viaActorId;
      html += `<div class="search-section-title" style="margin-top:1.5rem">
        <span class="material-icons-round">person</span> Known for ${actorId ? `<span class="search-actor-link" data-person-id="${actorId}" style="cursor:pointer;color:var(--red);text-decoration:underline">${esc(actor)}</span>` : esc(actor)}
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
