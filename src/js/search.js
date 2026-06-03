import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, skelCards, esc, toast } from './ui.js';
import { state, addRecentSearch, clearRecentSearches } from './state.js';

let _debounce = null;
let _sfActive = 'all';

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

  // Save to recent searches
  addRecentSearch(q);

  try {
    let movies = [], shows = [], anime = [];

    if (_sfActive !== 'tv' && _sfActive !== 'anime') {
      const d = await tmdb('/search/movie', { query: q });
      movies = (d.results || []).map(x => ({ ...x, _type: 'movie' }));
    }
    if (_sfActive !== 'movie' && _sfActive !== 'anime') {
      const d = await tmdb('/search/tv', { query: q });
      shows = (d.results || []).map(x => ({ ...x, _type: 'tv' }));
    }
    if (_sfActive === 'anime' || _sfActive === 'all') {
      const Q = `query($s:String){Page(perPage:20){media(type:ANIME,search:$s,isAdult:false,sort:[POPULARITY_DESC]){id title{romaji english}coverImage{large}averageScore startDate{year}description(asHtml:false)popularity}}}`;
      const d = await aniQuery(Q, { s: q });
      anime = (d?.data?.Page?.media || []).map(m => ({ ...normalizeAnime(m), _type: 'anime' }));
    }

    // Filters
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

    // Partial fallback if too few results
    if (all.length < 4 && _sfActive !== 'anime') {
      const partial = q.slice(0, Math.max(3, Math.ceil(q.length * 0.6)));
      const [pm, ptv] = await Promise.allSettled([
        tmdb('/search/movie', { query: partial }),
        tmdb('/search/tv', { query: partial }),
      ]);
      const existIds = new Set(all.map(x => x.id));
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

    if (!all.length) {
      area.innerHTML = `
        <div class="search-empty">
          <span class="material-icons-round">search_off</span>
          <p>No results for "<strong>${esc(q)}</strong>"</p>
          <p class="muted-note">Try different keywords or check spelling.</p>
        </div>`;
      return;
    }

    // Split into exact / similar
    const qLower = q.toLowerCase();
    const exact = all.filter(x => !x._fuzzy && (x.title || x.name || '').toLowerCase().includes(qLower));
    const similar = all.filter(x => !exact.includes(x));

    let html = '';

    if (exact.length) {
      html += `<div class="search-section-title"><span class="material-icons-round">check_circle</span> Exact Matches</div>
        <div class="search-grid">${exact.slice(0, 12).map(m => makeCard(m, m._type)).join('')}</div>`;
    }
    if (similar.length) {
      html += `<div class="search-section-title" style="margin-top:1.5rem"><span class="material-icons-round">auto_awesome</span> Similar Results</div>
        <div class="search-grid">${similar.slice(0, 12).map(m => makeCard(m, m._type)).join('')}</div>`;
    }

    area.innerHTML = html;
  } catch (e) {
    area.innerHTML = `<div class="search-empty">
      <span class="material-icons-round">wifi_off</span>
      <p>Search failed — check your connection.</p>
    </div>`;
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
