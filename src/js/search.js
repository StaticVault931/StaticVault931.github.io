import { tmdb, aniQuery, normalizeAnime, getProviderLogoUrl } from './api.js';
import { makeCard, skelCards, esc, toast } from './ui.js';
import { state, GENRES, AGE_LEVELS, addRecentSearch, clearRecentSearches } from './state.js';
import { initSearchPipeline, prepareQuery, svFlag } from './search/searchPipeline.js';
import { recordSearchStat } from './stats.js';
import { rankResults } from './search/ranking.js';
import { titleScore } from './search/fuzzy.js';
import { descriptionKeywordTerms, localDescriptionMatch, scoreDescriptionEntry } from './search/descriptionSearch.js';
import { filterSafeItems, isAnimeContent } from './contentSafety.js';
import { searchPath } from './routes.js';

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

// Provider filter state. Includes use OR semantics; blocked providers are
// excluded even when a title also appears on an included service.
const _readProviderSet = key => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]').map(Number).filter(Boolean)); }
  catch { return new Set(); }
};
let _providerIncludes = _readProviderSet('sv_search_provider_includes');
let _providerExcludes = _readProviderSet('sv_search_provider_excludes');
const _providerAvailabilityCache = new Map();

function _saveProviderFilters() {
  localStorage.setItem('sv_search_provider_includes', JSON.stringify([..._providerIncludes]));
  localStorage.setItem('sv_search_provider_excludes', JSON.stringify([..._providerExcludes]));
}

function _mediaType(item) {
  const type = item?._type || item?.media_type;
  return type === 'movie' || type === 'tv' ? type : null;
}

function _mediaKey(item) {
  return `${_mediaType(item) || item?._type || 'unknown'}:${item?.id}`;
}

async function _providerOfferIds(item) {
  const type = _mediaType(item);
  if (!type || !item?.id) return new Set();
  const key = `${type}:${item.id}`;
  if (_providerAvailabilityCache.has(key)) return _providerAvailabilityCache.get(key);

  const check = tmdb(`/${type}/${item.id}/watch/providers`).then(data => {
    const region = data?.results?.US || {};
    const offers = ['flatrate', 'free', 'ads', 'rent', 'buy']
      .flatMap(kind => region[kind] || []);
    return new Set(offers.map(provider => +provider.provider_id).filter(Boolean));
  }).catch(err => {
    _providerAvailabilityCache.delete(key);
    throw err;
  });
  _providerAvailabilityCache.set(key, check);
  return check;
}

async function _filterByProvider(items) {
  if (!_providerIncludes.size && !_providerExcludes.size) return items;
  const candidates = items.filter(item => _mediaType(item));
  const matches = new Array(candidates.length).fill(false);
  let completed = 0;
  let failed = 0;

  // Keep concurrency low so a provider-filtered search does not burst.
  for (let start = 0; start < candidates.length; start += 6) {
    const batch = candidates.slice(start, start + 6);
    const settled = await Promise.allSettled(batch.map(_providerOfferIds));
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        completed++;
        const offers = result.value;
        const included = !_providerIncludes.size || [..._providerIncludes].some(id => offers.has(id));
        const blocked = [..._providerExcludes].some(id => offers.has(id));
        matches[start + index] = included && !blocked;
      } else {
        failed++;
      }
    });
  }

  if (!completed && failed) throw new Error('Provider availability could not be checked');
  return candidates.filter((item, index) => matches[index]);
}

const _PROVIDER_LIST = [
  { id: 8,    name: 'Netflix' },
  { id: 337,  name: 'Disney+' },
  { id: 9,    name: 'Prime Video' },
  { id: 1899, name: 'Max' },
  { id: 15,   name: 'Hulu' },
  { id: 350,  name: 'Apple TV+' },
  { id: 531,  name: 'Paramount+' },
  { id: 386,  name: 'Peacock' },
  { id: 283,  name: 'Crunchyroll' },
  { id: 100,  name: 'Tubi' },
  { id: 73,   name: 'Pluto TV' },
];
const _providerName = id => _PROVIDER_LIST.find(p => p.id === +id)?.name || `Provider ${id}`;
const _providerLogo = provider => getProviderLogoUrl(provider.name, 32);

// Everything browse state
let _everythingSort = 'popularity.desc';
let _everythingPage = 1;
let _everythingLoading = false;
let _everythingType = 'all'; // all | movie | tv
let _everythingObs = null;

export function getSearchFilters() { return { ..._filters }; }

export function setProviderFilter(prov) {
  _providerIncludes = new Set(prov?.id ? [+prov.id] : []);
  _providerExcludes.clear();
  _saveProviderFilters();
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
        <label class="sf-filter-label">Country of Origin
          <select class="sf-filter-sel" id="sf-country">
            <option value="">Any Country</option>
            <option value="US">🇺🇸 United States</option>
            <option value="GB">🇬🇧 United Kingdom</option>
            <option value="JP">🇯🇵 Japan</option>
            <option value="KR">🇰🇷 South Korea</option>
            <option value="FR">🇫🇷 France</option>
            <option value="DE">🇩🇪 Germany</option>
            <option value="ES">🇪🇸 Spain</option>
            <option value="IT">🇮🇹 Italy</option>
            <option value="IN">🇮🇳 India</option>
            <option value="CN">🇨🇳 China</option>
            <option value="BR">🇧🇷 Brazil</option>
            <option value="MX">🇲🇽 Mexico</option>
            <option value="CA">🇨🇦 Canada</option>
            <option value="AU">🇦🇺 Australia</option>
            <option value="SE">🇸🇪 Sweden</option>
            <option value="DK">🇩🇰 Denmark</option>
            <option value="NO">🇳🇴 Norway</option>
            <option value="TR">🇹🇷 Türkiye</option>
          </select>
        </label>
        <label class="sf-filter-label" title="Blockbusters have many votes; hidden gems are highly rated but less known">Popularity
          <select class="sf-filter-sel" id="sf-poptier">
            <option value="">Any</option>
            <option value="blockbuster">Blockbusters (10k+ votes)</option>
            <option value="wellknown">Well Known (1k+ votes)</option>
            <option value="hiddengem">Hidden Gems (&lt;1k votes, 7+ rating)</option>
          </select>
        </label>
        <button class="sf-filter-clear" id="sf-filter-clear" title="Clear all filters">
          <span class="material-icons-round">filter_alt_off</span> Clear
        </button>
      </div>
      <!-- Provider filter row -->
      <div class="sf-filter-row sf-provider-row">
        <div class="sf-provider-heading">
          <span class="sf-filter-label">Streaming services</span>
          <span>Include any selected service. Block always wins.</span>
        </div>
        <button class="sf-prov-any${!_providerIncludes.size && !_providerExcludes.size ? ' on' : ''}" data-prov-clear>
          <span class="material-icons-round">apps</span>Any service
        </button>
        ${_PROVIDER_LIST.map(p => `
          <div class="sf-provider-choice${_providerIncludes.has(p.id) ? ' included' : ''}${_providerExcludes.has(p.id) ? ' excluded' : ''}" data-provider-choice="${p.id}">
            <button class="sf-prov-chip${_providerIncludes.has(p.id) ? ' on' : ''}" data-prov-id="${p.id}" data-prov-name="${p.name}"
              aria-pressed="${_providerIncludes.has(p.id)}" title="${_providerIncludes.has(p.id) ? 'Remove' : 'Include'} ${p.name}">
              <img src="${_providerLogo(p)}" alt="" loading="lazy"><span>${p.name}</span>
            </button>
            <button class="sf-prov-block${_providerExcludes.has(p.id) ? ' on' : ''}" data-prov-block="${p.id}"
              aria-pressed="${_providerExcludes.has(p.id)}" aria-label="${_providerExcludes.has(p.id) ? 'Unblock' : 'Block'} ${p.name}" title="${_providerExcludes.has(p.id) ? 'Unblock' : 'Block'} ${p.name}">
              <span class="material-icons-round">block</span>
            </button>
          </div>`).join('')}
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
    _filters.country = document.getElementById('sf-country')?.value || null;
    _filters.popTier = document.getElementById('sf-poptier')?.value || null;
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
    _filters = { genre: null, yearFrom: null, yearTo: null, minRating: null, contentType: 'all', sortBy: 'popularity.desc', language: null, runtime: null, status: null, country: null, popTier: null };
    _providerIncludes.clear();
    _providerExcludes.clear();
    _saveProviderFilters();
    container.querySelectorAll('.sf-filter-sel').forEach(sel => { sel.selectedIndex = 0; });
    container.querySelectorAll('.sf-provider-choice').forEach(c => c.classList.remove('included', 'excluded'));
    container.querySelectorAll('.sf-prov-chip, .sf-prov-block').forEach(c => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    container.querySelector('[data-prov-clear]')?.classList.add('on');
    const query = document.getElementById('search-input')?.value.trim();
    if (query) doSearch(query);
    else loadSearchDefault({ force: true });
  });

  const rerunProviderSearch = () => {
    _saveProviderFilters();
    const inp = document.getElementById('search-input');
    const q = inp?.value.trim();
    if (q) document.dispatchEvent(new CustomEvent('sv:do-search', { detail: q }));
    else if (_sfActive === 'everything') loadEverything();
    else browseByFilters();
  };

  container.querySelector('[data-prov-clear]')?.addEventListener('click', () => {
    _providerIncludes.clear();
    _providerExcludes.clear();
    buildSearchFilters(container);
    rerunProviderSearch();
  });

  // Included providers use OR semantics.
  container.querySelectorAll('.sf-prov-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = +chip.dataset.provId;
      if (_providerIncludes.has(id)) _providerIncludes.delete(id); else _providerIncludes.add(id);
      _providerExcludes.delete(id);
      buildSearchFilters(container);
      rerunProviderSearch();
    });
  });

  container.querySelectorAll('.sf-prov-block').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = +btn.dataset.provBlock;
      if (_providerExcludes.has(id)) _providerExcludes.delete(id); else _providerExcludes.add(id);
      _providerIncludes.delete(id);
      buildSearchFilters(container);
      rerunProviderSearch();
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
    if (_providerIncludes.size) { params.with_watch_providers = [..._providerIncludes].join('|'); params.watch_region = 'US'; }
    if (_providerExcludes.size) { params.without_watch_providers = [..._providerExcludes].join('|'); params.watch_region = 'US'; }
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
    // Country of origin
    if (_filters.country) params.with_origin_country = _filters.country;
    // Popularity tier
    if (_filters.popTier === 'blockbuster') params['vote_count.gte'] = 10000;
    else if (_filters.popTier === 'wellknown') params['vote_count.gte'] = 1000;
    else if (_filters.popTier === 'hiddengem') {
      params['vote_count.gte'] = 50;
      params['vote_count.lte'] = 1000;
      params['vote_average.gte'] = Math.max(_filters.minRating || 0, 7);
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
  initSearchPipeline(); // aliases + spell dictionary + local index (async)
  const inp = document.getElementById('search-input');
  if (!inp) return;
  const initialQuery = location.pathname.replace(/\/+$/, '') === '/search'
    ? new URLSearchParams(location.search).get('q')?.trim()
    : '';
  if (initialQuery) {
    inp.value = initialQuery;
    const initialClear = document.getElementById('search-clear');
    if (initialClear) initialClear.style.display = 'flex';
  }

  inp.addEventListener('input', function () {
    const clear = document.getElementById('search-clear');
    if (clear) clear.style.display = this.value ? 'flex' : 'none';

    clearTimeout(_debounce);
    clearTimeout(_acDebounce);
    const q = this.value.trim();

    if (!q) {
      closeInlineDrop();
      if (document.getElementById('page-search')?.classList.contains('active')) {
        history.replaceState({ page: 'search' }, '', searchPath());
      }
      _searchState = { query: '', page: 1, results: [], loading: false, done: false };
      loadSearchDefault({ force: true });
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
      history.replaceState({ page: 'search' }, '', searchPath());
      _searchState = { query: '', page: 1, results: [], loading: false, done: false };
      loadSearchDefault({ force: true });
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
        _searchState = { query: '', page: 1, results: [], loading: false, done: false };
        loadSearchDefault({ force: true });
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
  'Try ::astronauts near a black hole to search by story clues',
  'Try ::chemistry teacher becomes criminal for description search',
  'Use :: before a plot description when you forgot the title',
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
    const includeNames = [..._providerIncludes].map(_providerName);
    const provLabel = includeNames.length ? ` on ${includeNames.join(' or ')}` : '';
    const blockLabel = _providerExcludes.size ? ` · ${_providerExcludes.size} blocked` : '';
    area.innerHTML = `
      <div class="everything-header">
        <div class="everything-title">
          <span class="material-icons-round">apps</span>
          Browse Everything${provLabel}${blockLabel}
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
  if (_providerIncludes.size) { params.with_watch_providers = [..._providerIncludes].join('|'); params.watch_region = 'US'; }
  if (_providerExcludes.size) { params.without_watch_providers = [..._providerExcludes].join('|'); params.watch_region = 'US'; }

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
export async function loadSearchDefault({ force = false } = {}) {
  const area = document.getElementById('search-results-area');
  if (!area) return;
  const query = document.getElementById('search-input')?.value.trim();
  if (!force && (query || _searchState.query)) return;
  _searchState = { query: '', page: 1, results: [], loading: false, done: false };

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
function _eggConfetti(color, count = 20) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      const c = color === 'rainbow' ? `hsl(${Math.random() * 360},90%,60%)` : color;
      el.style.cssText = `position:fixed;top:-10px;left:${Math.random() * 100}vw;width:8px;height:8px;border-radius:50%;background:${c};z-index:9999;pointer-events:none;animation:confettiFall ${1 + Math.random() * 2}s ease-in forwards;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }, i * 60);
  }
}

function _eggReveal(area, emoji, color, title, msg, extraHtml = '') {
  area.innerHTML = `
    <div class="easter-egg-result" style="text-align:center;padding:3rem 1rem;animation:eggReveal .6s var(--ease)">
      <div style="font-size:4rem;margin-bottom:1rem">${emoji}</div>
      <div style="font-size:1.4rem;font-weight:900;color:${color};margin-bottom:.75rem;font-family:'Bebas Neue',Impact,sans-serif;letter-spacing:.05em;text-transform:uppercase">${title}</div>
      <div style="font-size:.95rem;color:var(--muted);max-width:500px;margin:0 auto;line-height:1.7">${msg}</div>
      ${extraHtml}
    </div>`;
}

// Useful egg: render one random top-rated pick as a clickable card
async function _eggSurprisePick(area, color, headline) {
  _eggReveal(area, '🎲', color, headline, 'Rolling the dice on something great…');
  try {
    const page = 1 + Math.floor(Math.random() * 10);
    const d = await tmdb('/movie/top_rated', { page });
    const picks = (d.results || []).filter(m => m.backdrop_path);
    const pick = picks[Math.floor(Math.random() * picks.length)];
    if (!pick) return;
    _eggReveal(area, '🎲', color, headline,
      'The vault has chosen. Click the card to dive in — or search "surprise me" again to reroll.',
      `<div class="search-grid" style="max-width:420px;margin:1.5rem auto 0">${makeCard({ ...pick }, 'movie')}</div>`);
  } catch {}
}

function checkSearchEasterEgg(q) {
  const lower = q.toLowerCase().trim();
  const area = document.getElementById('search-results-area');
  if (!area) return false;

  const eggs = {
    'staticvault931':  { emoji: '🎬', color: '#e50914', msg: 'You found the source! This is StaticVault931 — your personal cinema. Made with love by StaticQuasar931.' },
    'staticquasar931': { emoji: '✨', color: '#6366f1', msg: "Hey! That's us! StaticQuasar931 is the creator of StaticVault931. Check out our Instagram @StaticQuasar931!" },
    'sv931':           { emoji: '🎉', color: '#22c55e', msg: "Short and sweet! SV931 = StaticVault931. You've found the secret shorthand!" },
    'themoviedb':      { emoji: '💡', color: '#06b6d4', msg: "TMDB powers StaticVault931's entire catalog! We love their API. Check them out at themoviedb.org." },
    'anilist':         { emoji: '🌸', color: '#8b5cf6', msg: 'AniList powers all the anime you see here! Amazing community and API.' },
    'hello there':     { emoji: '⚔️', color: '#4ade80', msg: 'General Kenobi! You are a bold one. (Try searching "Star Wars" for the real thing.)' },
    'i am the danger': { emoji: '🧪', color: '#f5c518', msg: 'A guy opens his door and gets shot, and you think that of me? No. I AM the one who knocks. — Try "Breaking Bad".' },
  };

  // Useful: random great movie
  if (['surprise me', 'random', 'roll the dice', 'dice'].includes(lower)) {
    _eggSurprisePick(area, '#f59e0b', 'Surprise Pick');
    _eggConfetti('#f59e0b', 12);
    return true;
  }

  // Fun: barrel roll — spins the whole app once
  if (lower === 'do a barrel roll' || lower === 'barrel roll') {
    _eggReveal(area, '🛩️', '#06b6d4', 'Wheeee!', 'Peppy would be proud.');
    document.body.style.transition = 'transform 1.2s ease-in-out';
    document.body.style.transform = 'rotate(360deg)';
    setTimeout(() => { document.body.style.transform = ''; setTimeout(() => { document.body.style.transition = ''; }, 1300); }, 1250);
    return true;
  }

  // Fun: disco — quick tour through every theme, then back home
  if (lower === 'disco' || lower === 'party mode') {
    _eggReveal(area, '🪩', '#ec4899', 'Disco Mode!', 'Taking every theme for a spin…');
    _eggConfetti('rainbow', 30);
    const original = document.documentElement.dataset.theme || 'dark';
    const themes = ['dark', 'midnight', 'warm', 'ocean', 'mist', 'light'];
    themes.forEach((t, i) => setTimeout(() => { document.documentElement.dataset.theme = t; }, 400 * (i + 1)));
    setTimeout(() => { document.documentElement.dataset.theme = original; }, 400 * (themes.length + 1));
    return true;
  }

  // Useful: 42 — the answer, plus the film that goes with it
  if (lower === '42' || lower === 'meaning of life') {
    _eggReveal(area, '🐬', '#4ade80', "Don't Panic", 'The answer to life, the universe, and everything. Finding the film that explains the question…');
    tmdb('/search/movie', { query: "Hitchhiker's Guide to the Galaxy" }).then(d => {
      const m = (d.results || [])[0];
      if (m) _eggReveal(area, '🐬', '#4ade80', "Don't Panic",
        'The answer to life, the universe, and everything is 42. So long, and thanks for all the fish.',
        `<div class="search-grid" style="max-width:420px;margin:1.5rem auto 0">${makeCard(m, 'movie')}</div>`);
    }).catch(() => {});
    return true;
  }

  const egg = eggs[lower];
  if (!egg) return false;

  _eggReveal(area, egg.emoji, egg.color, 'Easter Egg Found!', egg.msg);
  _eggConfetti(egg.color);
  return true;
}

/* ── TYPED FILTERS ───────────────────────────────────────────────────
   Lets users type filters directly: ":netflix", "include:disney",
   "country:kr", "genre:horror", "year:1999". Matching tokens activate
   the corresponding filter UI chip with a flash animation so the user
   sees it took effect, and are stripped from the query. */
const _TYPED_PROVIDERS = {
  netflix: 8, disney: 337, 'disney+': 337, hulu: 15, max: 1899, hbo: 1899,
  prime: 9, 'prime video': 9, amazon: 9, apple: 350, 'apple tv': 350,
  paramount: 531, 'paramount+': 531, peacock: 386, crunchyroll: 283,
};

function _flashEl(el) {
  if (!el) return;
  el.classList.add('sf-chip-flash');
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  setTimeout(() => el.classList.remove('sf-chip-flash'), 1400);
}

function _applyTypedFilters(q) {
  let cleaned = q;
  let activated = false;

  // Provider: ":netflix" or "include:netflix"
  const provRe = /(?:^|\s)(?:include:|:)([a-z+]+(?: video| tv)?)/i;
  const pm = cleaned.match(provRe);
  if (pm) {
    const name = pm[1].toLowerCase().trim();
    const pid = _TYPED_PROVIDERS[name];
    if (pid) {
      cleaned = cleaned.replace(pm[0], ' ').replace(/\s+/g, ' ').trim();
      const chip = document.querySelector(`.sf-prov-chip[data-prov-id="${pid}"]`);
      if (chip) { chip.click(); _flashEl(chip); }
      else {
        _providerIncludes.add(pid);
        _providerExcludes.delete(pid);
        _saveProviderFilters();
      }
      activated = true;
      toast(`Filtering by ${name.charAt(0).toUpperCase() + name.slice(1)}`, 'filter_alt');
    }
  }

  // Genre: "genre:horror"
  const gm = cleaned.match(/(?:^|\s)genre:([a-z -]+?)(?=\s|$)/i);
  if (gm) {
    const g = GENRES.find(x => x.name.toLowerCase().startsWith(gm[1].toLowerCase().trim()));
    if (g) {
      cleaned = cleaned.replace(gm[0], ' ').replace(/\s+/g, ' ').trim();
      const sel = document.getElementById('sf-genre');
      if (sel) { sel.value = String(g.id); _flashEl(sel.closest('.sf-filter-label') || sel); }
      _filters.genre = String(g.id);
      activated = true;
      toast(`Genre: ${g.name}`, 'filter_alt');
    }
  }

  // Country: "country:kr"
  const cm = cleaned.match(/(?:^|\s)country:([a-z]{2})(?=\s|$)/i);
  if (cm) {
    cleaned = cleaned.replace(cm[0], ' ').replace(/\s+/g, ' ').trim();
    const code = cm[1].toUpperCase();
    const sel = document.getElementById('sf-country');
    if (sel) { sel.value = code; _flashEl(sel.closest('.sf-filter-label') || sel); }
    _filters.country = code;
    activated = true;
    toast(`Country: ${code}`, 'filter_alt');
  }

  // Year: "year:1999"
  const ym = cleaned.match(/(?:^|\s)year:(\d{4})(?=\s|$)/i);
  if (ym) {
    cleaned = cleaned.replace(ym[0], ' ').replace(/\s+/g, ' ').trim();
    _filters.yearFrom = +ym[1]; _filters.yearTo = +ym[1];
    const sel = document.getElementById('sf-year-from');
    if (sel) { sel.value = ym[1]; _flashEl(sel.closest('.sf-filter-label') || sel); }
    activated = true;
    toast(`Year: ${ym[1]}`, 'filter_alt');
  }

  return { cleaned, activated };
}

/* ── SEARCH ──────────────────────────────────────────────────────── */
/* Search diagnostics log — last 100 searches with what the engine did to
   them (correction used, result count). Included in "Export All Data" so
   real-world queries can drive search improvements. */
function _logSearch(entry) {
  recordSearchStat(); // long-term ledger
  try {
    const log = JSON.parse(localStorage.getItem('sv_search_log') || '[]');
    log.unshift({ ...entry, ts: Date.now() });
    localStorage.setItem('sv_search_log', JSON.stringify(log.slice(0, 100)));
  } catch {}
}

/* Space-variant candidates for the weak-result retry ladder.
   "wall e"      → "walle"          (they added a space the title doesn't have)
   "moonknight"  → "moon knight"    (they merged words the title separates)
   "spiderman2"  → "spiderman 2"    (digits usually stand apart in titles)
   Capped at 3 candidates so a bad query costs at most 3 extra requests. */
function _spaceVariantCandidates(q) {
  const t = String(q || '').trim();
  const out = [];
  if (/\s/.test(t)) {
    out.push(t.replace(/\s+/g, '')); // try the no-space spelling
  } else {
    const digitSplit = t.replace(/(\d+)/g, ' $1 ').replace(/\s+/g, ' ').trim();
    if (digitSplit !== t) out.push(digitSplit);
    // Try one artificial split: prefer a break before a common title word,
    // otherwise split in the middle
    if (t.length >= 6 && t.length <= 18) {
      const common = ['man', 'men', 'woman', 'girl', 'boy', 'war', 'wars', 'world', 'king', 'house', 'game', 'story', 'night', 'day', 'land', 'ball', 'fall', 'walker', 'runner', 'hunter'];
      let split = null;
      for (const w of common) {
        const at = t.length - w.length;
        if (at >= 3 && t.endsWith(w)) { split = t.slice(0, at) + ' ' + w; break; }
      }
      out.push(split || t.slice(0, Math.ceil(t.length / 2)) + ' ' + t.slice(Math.ceil(t.length / 2)));
    }
  }
  return [...new Set(out)].filter(v => v && v.toLowerCase() !== t.toLowerCase()).slice(0, 3);
}

async function _searchByDescription(query) {
  const terms = descriptionKeywordTerms(query, 4);
  const local = localDescriptionMatch(query, 24).map(entry => ({
    id: entry.id,
    title: entry.title,
    release_date: entry.type === 'movie' && entry.year ? `${entry.year}-01-01` : '',
    first_air_date: entry.type === 'tv' && entry.year ? `${entry.year}-01-01` : '',
    vote_average: entry.rating || 0,
    vote_count: entry.votes || 0,
    popularity: entry.pop || 0,
    poster_path: entry.poster || '',
    backdrop_path: entry.backdrop || '',
    overview: entry.overview || '',
    genre_ids: entry.genres || [],
    original_language: entry.language || '',
    media_type: entry.type,
    _type: entry.type,
    _description: ['overview'],
    _descriptionScore: entry._descriptionScore || 0,
  }));

  const keywordSearches = await Promise.allSettled(terms.map(term =>
    tmdb('/search/keyword', { query: term }).then(data => ({ term, results: data.results || [] }))));
  const keywords = [];
  const keywordIds = new Set();
  for (const result of keywordSearches) {
    if (result.status !== 'fulfilled') continue;
    const foldedTerm = result.value.term.toLowerCase();
    const matches = result.value.results
      .sort((a, b) => {
        const ae = String(a.name || '').toLowerCase() === foldedTerm ? 1 : 0;
        const be = String(b.name || '').toLowerCase() === foldedTerm ? 1 : 0;
        return be - ae;
      })
      .slice(0, 1);
    for (const keyword of matches) {
      if (!keyword?.id || keywordIds.has(keyword.id)) continue;
      keywordIds.add(keyword.id);
      keywords.push({ ...keyword, term: result.value.term });
    }
  }

  const requests = keywords.flatMap(keyword => [
    tmdb('/discover/movie', { with_keywords: keyword.id, sort_by: 'popularity.desc', 'vote_count.gte': 20 })
      .then(data => ({ type: 'movie', keyword, items: data.results || [] })),
    tmdb('/discover/tv', { with_keywords: keyword.id, sort_by: 'popularity.desc' })
      .then(data => ({ type: 'tv', keyword, items: data.results || [] })),
  ]);
  const discovered = await Promise.allSettled(requests);
  const candidates = new Map();
  for (const result of discovered) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value.items) {
      const typed = { ...item, media_type: result.value.type, _type: result.value.type };
      const key = _mediaKey(typed);
      const existing = candidates.get(key) || { ...typed, _description: [], _descriptionHits: 0 };
      existing._descriptionHits++;
      if (!existing._description.includes(result.value.keyword.name)) existing._description.push(result.value.keyword.name);
      candidates.set(key, existing);
    }
  }

  const merged = new Map();
  for (const item of [...local, ...candidates.values()]) {
    if (_sfActive === 'movie' && item._type !== 'movie') continue;
    if (_sfActive === 'tv' && item._type !== 'tv') continue;
    if (_sfActive === 'anime' && item._type !== 'anime') continue;
    const key = _mediaKey(item);
    const existing = merged.get(key);
    if (!existing || (item._descriptionHits || 0) > (existing._descriptionHits || 0)) merged.set(key, item);
  }

  let items = [...merged.values()];
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    if ((settings.animePreference || (settings.hideAnime ? 'no' : 'neutral')) === 'no') {
      items = items.filter(item => !isAnimeContent(item));
    }
    if (settings.kidsMode) items = await filterSafeItems(items, {
      kidsMode: true,
      maxLevel: Math.min(3, AGE_LEVELS[state.ageRating] ?? 3),
    });
  } catch {}
  if (_providerIncludes.size || _providerExcludes.size) items = await _filterByProvider(items);

  return items.sort((a, b) => {
    const score = item => (item._descriptionHits || 0) * 32
      + (item._descriptionScore || scoreDescriptionEntry(item, query))
      + Math.min(8, Math.log10((item.vote_count || 0) + 1) * 2)
      + (item.vote_average || 0) / 2;
    return score(b) - score(a);
  }).slice(0, 36);
}

export async function doSearch(q) {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  q = String(q || '').trim();
  if (!q) return;
  _searchState = { query: q, page: 1, results: [], loading: true, done: false };
  const input = document.getElementById('search-input');
  if (input && input.value !== q) input.value = q;
  if (document.getElementById('page-search')?.classList.contains('active')) {
    history.replaceState({ page: 'search', query: q }, '', searchPath(q));
  }

  addRecentSearch(q);
  if (checkSearchEasterEgg?.(q)) return; // stop if easter egg found

  // Typed filters ("include:netflix", "genre:horror", "country:kr", "year:1999")
  // — but NOT bare ":topic" queries whose word isn't a provider name
  if (/(?:include|genre|country|year):/i.test(q) || (q.startsWith(':') && _TYPED_PROVIDERS[q.slice(1).toLowerCase().trim()])) {
    const tf = _applyTypedFilters(q);
    if (tf.activated) {
      q = tf.cleaned;
      if (!q) { browseByFilters(); return; }
    }
  }

  // ── :topic SEARCH ──────────────────────────────────────────────────
  // Double-colon searches natural-language descriptions. It is explicit so
  // ordinary title queries keep their fast, title-first ranking behavior.
  if (q.startsWith('::')) {
    const description = q.slice(2).trim();
    if (!description) return;
    area.innerHTML = `<div class="search-spinner"><div class="spin"></div></div>`;
    try {
      const items = await _searchByDescription(description);
      _logSearch({ q, mode: 'description', n: items.length });
      if (!items.length) {
        area.innerHTML = `<div class="search-empty"><span class="material-icons-round">manage_search</span><p>No strong description matches for "<strong>${esc(description)}</strong>"</p><p class="muted-note">Try the most distinctive plot details, such as ::astronauts near a black hole.</p></div>`;
        return;
      }
      _searchState = { query: q, page: 1, results: items, loading: false, done: true };
      renderSearchResults(items, description, true);
      area.insertAdjacentHTML('afterbegin', `<div class="search-did-you-mean search-description-note"><span class="material-icons-round">manage_search</span><span>Plot and description search for <strong>${esc(description)}</strong></span><span class="muted-note">Use one : for topics, two :: for story clues</span></div>`);
    } catch (error) {
      console.warn('[SV Search] description search failed:', error?.message || error);
      area.innerHTML = `<div class="search-empty"><span class="material-icons-round">wifi_off</span><p>Description search could not load.</p></div>`;
    }
    return;
  }

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
        if (mv.status === 'fulfilled') (mv.value.results || []).forEach(m => { const item = {...m, _type:'movie', _keyword: kw.name}; const key = _mediaKey(item); if (!existIds.has(key)) { allItems.push(item); existIds.add(key); }});
        if (tv.status === 'fulfilled') (tv.value.results || []).forEach(m => { const item = {...m, _type:'tv', _keyword: kw.name}; const key = _mediaKey(item); if (!existIds.has(key)) { allItems.push(item); existIds.add(key); }});
      }

      // Company-based discover (e.g., searching ":Marvel" finds Marvel Studios)
      for (const co of companies.slice(0, 2)) {
        const [mv, tv] = await Promise.allSettled([
          tmdb('/discover/movie', { with_companies: co.id, sort_by: 'popularity.desc', 'vote_count.gte': 50 }),
          tmdb('/discover/tv', { with_companies: co.id, sort_by: 'popularity.desc' }),
        ]);
        if (mv.status === 'fulfilled') (mv.value.results || []).forEach(m => { const item = {...m, _type:'movie'}; const key = _mediaKey(item); if (!existIds.has(key)) { allItems.push(item); existIds.add(key); }});
        if (tv.status === 'fulfilled') (tv.value.results || []).forEach(m => { const item = {...m, _type:'tv'}; const key = _mediaKey(item); if (!existIds.has(key)) { allItems.push(item); existIds.add(key); }});
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
  // ── Pipeline: normalize → aliases → spellcheck → local index ─────
  const prep = prepareQuery(q);
  let effectiveQ = prep.aliased ? prep.query : q;
  let correctionUsed = null;

  _searchState = { query: effectiveQ, page: 1, results: [], loading: true, done: false };

  try {
    let items = await fetchSearchPage(effectiveQ, 1);

    // Merge exact and prefix matches from the existing local index into
    // ordinary searches instead of building the index and ignoring it.
    const canUseLocal = !_providerIncludes.size && !_providerExcludes.size && !_filters.genre && !_filters.minRating &&
      !_filters.yearFrom && !_filters.yearTo && !_filters.language &&
      ['all', 'movie', 'tv'].includes(_sfActive);
    if (canUseLocal && prep.localResults?.length) {
      const localItems = prep.localResults
        .filter(entry => _sfActive === 'all' || entry.type === _sfActive)
        .map(entry => ({
          id: entry.id,
          title: entry.title,
          release_date: entry.type === 'movie' && entry.year ? `${entry.year}-01-01` : '',
          first_air_date: entry.type === 'tv' && entry.year ? `${entry.year}-01-01` : '',
          vote_average: entry.rating || 0,
          vote_count: entry.votes || 0,
          popularity: entry.pop || 0,
          poster_path: entry.poster || '',
          backdrop_path: entry.backdrop || '',
          media_type: entry.type,
          _type: entry.type,
          _local: true,
        }));
      const seen = new Set();
      items = [...localItems, ...items].filter(item => {
        const key = _mediaKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Weak results + a spellcheck suggestion → try the corrected query.
    // (Never correct when the original already returns strong results.)
    const strong = items.length >= 4 ||
      (items[0] && titleScore(effectiveQ, items[0].title || items[0].name || '') >= 85);
    if (!strong && prep.corrected && prep.suggestion && prep.suggestion !== effectiveQ.toLowerCase()) {
      const correctedItems = await fetchSearchPage(prep.suggestion, 1).catch(() => []);
      if (correctedItems.length > items.length) {
        correctionUsed = { from: q, to: prep.suggestion };
        items = correctedItems;
        effectiveQ = prep.suggestion;
        _searchState.query = effectiveQ;
      }
    }

    // Still weak → space-variant ladder: the user may have guessed wrong
    // about where (or whether) the title has spaces. Try removing all
    // spaces, then inserting artificial ones ("spiderman2" → "spiderman 2",
    // "moonknight" → "moon knight"). Max 3 extra requests, stops early.
    if (items.length < 3) {
      for (const cand of _spaceVariantCandidates(effectiveQ)) {
        const alt = await fetchSearchPage(cand, 1).catch(() => []);
        if (alt.length > items.length) {
          correctionUsed = { from: q, to: cand };
          items = alt;
          effectiveQ = cand;
          _searchState.query = cand;
          if (alt.length >= 5) break; // good enough — stop burning requests
        }
      }
    }

    // Filter anime from search results if hideAnime is enabled
    try {
      const svSettings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
      if ((svSettings.animePreference || (svSettings.hideAnime ? 'no' : 'neutral')) === 'no') {
        items = items.filter(m => !isAnimeContent(m));
      }
    } catch {}
    // Kid-Guided is fail-closed: close title matches never bypass a verified
    // family rating. Adult profiles keep the softer maturity ordering.
    try {
      const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
      if (settings.kidsMode) {
        items = await filterSafeItems(items, { kidsMode: true, maxLevel: 3 });
      }
      const lvl = { 'TV-Y': 0, 'TV-Y7': 1, 'G': 2, 'TV-G': 2, 'PG': 3, 'TV-PG': 3, 'PG-13': 4, 'TV-14': 4 }[state.ageRating];
      if (!settings.kidsMode && lvl !== undefined && lvl <= 4) {
        const mature = m => m.adult || (lvl <= 3 && (m.genre_ids || []).includes(27));
        const closeMatch = m => titleScore(effectiveQ, m.title || m.name || '') >= 88;
        const safe = [], demoted = [];
        items.forEach(m => (mature(m) && !closeMatch(m) ? demoted : safe).push(m));
        items = [...safe, ...demoted];
        if (lvl <= 2) items = items.filter(m => !m.adult); // G: adult never shows
      }
    } catch {}

    _searchState.results = items;
    _searchState.loading = false;

    _logSearch({
      q,
      effective: effectiveQ !== q ? effectiveQ : undefined,
      corrected: correctionUsed ? correctionUsed.to : undefined,
      aliased: prep.aliased || undefined,
      n: items.length,
    });

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

    renderSearchResults(items, effectiveQ, true);

    // Subtle correction / alias note at the top of the results
    if (correctionUsed || prep.aliased) {
      const note = document.createElement('div');
      note.className = 'search-did-you-mean search-correction-note';
      note.innerHTML = correctionUsed
        ? `<span class="material-icons-round">spellcheck</span>
           <span>Showing results for <strong>${esc(correctionUsed.to)}</strong></span>
           <button class="search-clear-filters-btn" id="search-orig-btn">Search "${esc(correctionUsed.from)}" instead</button>`
        : `<span class="material-icons-round">auto_awesome</span>
           <span>Expanded to <strong>${esc(prep.query)}</strong></span>`;
      area.prepend(note);
      document.getElementById('search-orig-btn')?.addEventListener('click', () => {
        localStorage.setItem('sv_flag_spellcheck_skip_once', '1');
        renderSearchResults([], correctionUsed.from, true);
        fetchSearchPage(correctionUsed.from, 1).then(orig => renderSearchResults(orig, correctionUsed.from, true));
      });
    }
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

  // ── SORT: relevance with anime de-prioritised ─────────────────────
  const qLow = (yearHint ? qClean : q).toLowerCase().trim();
  const _animePass = (a, b) => {
    if (_sfActive !== 'all') return 0;
    const aIsAnime = a._type === 'anime', bIsAnime = b._type === 'anime';
    if (aIsAnime === bIsAnime) return 0;
    const aExact = titleSimilarity(qLow, a.title || a.name || '') <= 2;
    const bExact = titleSimilarity(qLow, b.title || b.name || '') <= 2;
    if (aIsAnime && aExact && !bExact) return -1;
    if (bIsAnime && bExact && !aExact) return 1;
    if (aIsAnime && !aExact) return 1;
    if (bIsAnime && !bExact) return -1;
    return 0;
  };
  if (svFlag('fuzzy')) {
    // RapidFuzz-style combined scoring (fuzzy + quality + user signals)
    rankResults(all, qLow);
    all.sort((a, b) => _animePass(a, b)); // stable sort keeps rank within groups
  } else {
    all.sort((a, b) => {
      const pass = _animePass(a, b);
      if (pass) return pass;
      return computeRelevance(b, qLow) - computeRelevance(a, qLow);
    });
  }

  // Apply language filter
  if (_filters.language) {
    all = all.filter(x => x.original_language === _filters.language || !_filters.language);
  }
  // Country filter (client-side; origin_country present on TV results, use language as movie proxy)
  if (_filters.country) {
    const langByCountry = { US:'en', GB:'en', JP:'ja', KR:'ko', FR:'fr', DE:'de', ES:'es', IT:'it', IN:'hi', CN:'zh', BR:'pt', MX:'es', CA:'en', AU:'en', SE:'sv', DK:'da', NO:'no', TR:'tr' };
    all = all.filter(x => x.origin_country?.length
      ? x.origin_country.includes(_filters.country)
      : (!langByCountry[_filters.country] || x.original_language === langByCountry[_filters.country]));
  }
  // Popularity tier filter (client-side for text search)
  if (_filters.popTier === 'blockbuster') all = all.filter(x => (x.vote_count || 0) >= 10000);
  else if (_filters.popTier === 'wellknown') all = all.filter(x => (x.vote_count || 0) >= 1000);
  else if (_filters.popTier === 'hiddengem') all = all.filter(x => (x.vote_count || 0) < 1000 && (x.vote_average || 0) >= 7);

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

    const existIds = new Set(all.map(_mediaKey));

    for (const fq of fallbackQueries) {
      if (all.length >= 6) break;
      const [pm, ptv] = await Promise.allSettled([
        tmdb('/search/movie', { query: fq }),
        tmdb('/search/tv', { query: fq }),
      ]);
      if (pm.status === 'fulfilled') {
        (pm.value.results || []).forEach(x => {
          const item = { ...x, _type: 'movie', _fuzzy: true }; const key = _mediaKey(item);
          if (!existIds.has(key)) { all.push(item); existIds.add(key); }
        });
      }
      if (ptv.status === 'fulfilled') {
        (ptv.value.results || []).forEach(x => {
          const item = { ...x, _type: 'tv', _fuzzy: true }; const key = _mediaKey(item);
          if (!existIds.has(key)) { all.push(item); existIds.add(key); }
        });
      }
    }

    // Company/network search (for "Marvel", "Disney", "HBO" etc)
    if (all.length < 12) {
      try {
        const companyRes = await tmdb('/search/company', { query: q });
        const companies = (companyRes.results || []).slice(0, 2);
        const existIds2 = new Set(all.map(_mediaKey));
        for (const co of companies) {
          const coMovies = await tmdb('/discover/movie', {
            with_companies: co.id,
            sort_by: 'popularity.desc',
            'vote_count.gte': 50,
          }).catch(() => ({ results: [] }));
          (coMovies.results || []).slice(0, 8).forEach(x => {
            const item = { ...x, _type: 'movie', _fuzzy: true }; const key = _mediaKey(item);
            if (!existIds2.has(key)) { all.push(item); existIds2.add(key); }
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
            const item = { ...x, _type: 'movie', _keyword: true }; const key = _mediaKey(item);
            if (!existIds.has(key)) { all.push(item); existIds.add(key); }
          });
          (kwTV.results || []).slice(0, 4).forEach(x => {
            const item = { ...x, _type: 'tv', _keyword: true }; const key = _mediaKey(item);
            if (!existIds.has(key)) { all.push(item); existIds.add(key); }
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
      const existIds = new Set(all.map(_mediaKey));
      people.forEach((person, i) => {
        if (creditResults[i].status !== 'fulfilled') return;
        const credits = creditResults[i].value;
        const personMovies = (credits.cast || [])
          .filter(m => m.media_type === 'movie' && m.poster_path)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .map(m => ({ ...m, _type: 'movie', _viaActor: person.name, _viaActorId: person.id }))
          .filter(m => !existIds.has(_mediaKey(m)))
          .slice(0, 6);
        const personShows = (credits.cast || [])
          .filter(m => m.media_type === 'tv' && m.poster_path)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .map(m => ({ ...m, _type: 'tv', _viaActor: person.name, _viaActorId: person.id }))
          .filter(m => !existIds.has(_mediaKey(m)))
          .slice(0, 6);
        _personResults.push(...personMovies, ...personShows);
        personMovies.forEach(m => existIds.add(_mediaKey(m)));
        personShows.forEach(m => existIds.add(_mediaKey(m)));
      });
    } catch {}
  }

  // Return combined — person results come AFTER main results (deduped)
  const allKeys = new Set(all.map(_mediaKey));
  const dedupedPersonResults = _personResults.filter(x => x.id && !allKeys.has(_mediaKey(x)));
  let combined = await _filterByProvider([...all, ...dedupedPersonResults]);
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    if (settings.kidsMode) combined = await filterSafeItems(combined, { kidsMode: true, maxLevel: 3 });
  } catch {}
  return combined;
}

async function loadMoreSearchResults() {
  if (_searchState.loading || _searchState.done || !_searchState.query) return;
  _searchState.loading = true;
  _searchState.page++;

  const sentinel = document.getElementById('search-sentinel');
  if (sentinel) sentinel.innerHTML = `<div class="search-spinner"><div class="spin"></div></div>`;

  try {
    const more = await fetchSearchPage(_searchState.query, _searchState.page);
    const existing = new Set(_searchState.results.map(_mediaKey));
    const newItems = more.filter(x => !existing.has(_mediaKey(x)));
    if (!newItems.length) {
      _searchState.done = true;
      if (sentinel) sentinel.remove();
      return;
    }
    _searchState.results.push(...newItems);
    renderSearchResults(newItems, _searchState.query, false);
  } catch (err) {
    _searchState.page--;
    if (sentinel) sentinel.innerHTML = '<p class="muted-note">Could not load more results. Scroll away and back to retry.</p>';
    console.warn('[SV Search] load more failed:', err?.message || err);
  }
  _searchState.loading = false;
}

function renderSearchResults(items, q, replace) {
  const area = document.getElementById('search-results-area');
  if (!area) return;

  if (!replace) {
    area.querySelector('#search-sentinel')?.remove();
    let grid = area.querySelector('#search-more-grid');
    if (!grid) {
      const section = document.createElement('div');
      section.innerHTML = `<div class="search-section-title" style="margin-top:1.5rem"><span class="material-icons-round">expand_more</span> More Results</div>
        <div class="search-grid" id="search-more-grid"></div>`;
      area.append(...section.childNodes);
      grid = area.querySelector('#search-more-grid');
    }
    grid?.insertAdjacentHTML('beforeend', items.map(m => makeCard(m, m._type)).join(''));
    const meta = area.querySelector('.search-results-meta');
    if (meta) {
      const count = _searchState.results.filter(x => !x._viaActor).length;
      meta.innerHTML = `${count} result${count !== 1 ? 's' : ''} for "<strong>${esc(q)}</strong>"`;
    }
    area.insertAdjacentHTML('beforeend', '<div id="search-sentinel" style="height:60px;display:flex;align-items:center;justify-content:center;"></div>');
    const sentinel = area.querySelector('#search-sentinel');
    if (sentinel && window._searchScrollObs) window._searchScrollObs.observe(sentinel);
    return;
  }

  const qLower = q.toLowerCase();
  const exact = items.filter(x => !x._fuzzy && !x._keyword && !x._description && !x._viaActor && (x.title || x.name || '').toLowerCase().includes(qLower));
  const viaActor = items.filter(x => x._viaActor);
  const description = items.filter(x => x._description);
  const similar = items.filter(x => exact.indexOf(x) === -1 && !x._keyword && !x._description && !x._viaActor);
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
  if (description.length) {
    html += `<div class="search-section-title" style="margin-top:1.5rem"><span class="material-icons-round">manage_search</span> Story Matches</div>
      <div class="search-grid">${description.slice(0, 24).map(m => makeCard(m, m._type)).join('')}</div>`;
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
