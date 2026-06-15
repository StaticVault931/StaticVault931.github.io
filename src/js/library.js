import { state, persist, isLiked, isInWatchlist } from './state.js';
import { makeCard, skelCards, emptyState, toast } from './ui.js';
import { tmdb } from './api.js';
import { goPage } from './router.js';

/* ── RENDER LIBRARY PAGE ─────────────────────────────────────────── */
export function renderLibrary() {
  renderContinueSection();
  renderWatchlistSection();
  renderLikedSection();
  renderRecentSection();
}

function renderContinueSection() {
  const sec = document.getElementById('lib-continue-sec');
  const grid = document.getElementById('lib-continue-grid');
  if (!grid) return;

  // Use Object.entries to backfill numeric id from key (same fix as renderContinueRow in app.js)
  const items = Object.entries(state.continueWatching)
    .map(([key, val]) => {
      const numKey = +key;
      return {
        ...val,
        id:         val.id ?? (isNaN(numKey) ? null : numKey),
        type:       val.type || 'movie',
        title:      val.title || val.name || 'Unknown',
        media_type: val.type || 'movie',
      };
    })
    .filter(item => item.id && !isNaN(+item.id))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 20);

  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';

  // Render continue watching with episode/season info overlaid
  grid.innerHTML = items.map(item => {
    const card = makeCard(item, item.type || 'movie', { showProgress: false });
    // Inject episode/season info as a small badge
    const epInfo = item.type === 'tv' || item.type === 'anime'
      ? `<div class="cw-ep-badge">${item.season ? `S${item.season}` : ''}${item.episode ? ` E${item.episode}` : ''}</div>`
      : '';
    return card.replace('class="card-poster">', `class="card-poster">${epInfo}`);
  }).join('');
}

function renderWatchlistSection() {
  const grid = document.getElementById('lib-watchlist-grid');
  if (!grid) return;

  if (!state.watchlist.length) {
    grid.innerHTML = emptyState('bookmark_add', 'Your watchlist is empty.', [
      { action: 'go-home', label: 'Browse Trending' },
      { action: 'go-search', label: 'Search' },
    ]);
    return;
  }
  grid.innerHTML = state.watchlist.map(m => makeCard(m, m.type || 'movie')).join('');
}

function renderLikedSection() {
  const grid = document.getElementById('lib-liked-grid');
  if (!grid) return;

  if (!state.liked.length) {
    grid.innerHTML = emptyState('favorite_border', "Nothing liked yet. Tap ❤ on any title.", [
      { action: 'go-home', label: 'Browse Home' },
    ]);
    return;
  }
  grid.innerHTML = state.liked.map(m => makeCard(m, m.type || 'movie')).join('');
}

function renderRecentSection() {
  const sec = document.getElementById('lib-recent-sec');
  const grid = document.getElementById('lib-recent-grid');
  if (!grid) return;

  const items = state.recentlyViewed.slice(0, 36);
  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';

  // Use compact cards when there are many items (>12 = likely more than 4 rows)
  const compact = items.length > 12;
  if (compact) grid.classList.add('lib-grid-compact'); else grid.classList.remove('lib-grid-compact');
  grid.innerHTML = items.map(m => makeCard(m, m.type || 'movie', { compact })).join('');
}

/* ── SEE ALL PAGE ────────────────────────────────────────────────── */
export async function renderSeeAll() {
  const { seeAll } = state;
  const titleEl = document.getElementById('seeall-title');
  const grid = document.getElementById('seeall-grid');
  const moreBtn = document.getElementById('seeall-more');
  if (!grid) return;

  if (titleEl) titleEl.textContent = seeAll.title || 'Browse';

  const backBtn = document.querySelector('.seeall-back-btn');
  if (backBtn) backBtn.dataset.page = seeAll.prevPage || 'home';

  if (!seeAll.fetcher) {
    grid.innerHTML = '<p class="muted-note">Could not load content.</p>';
    if (moreBtn) moreBtn.style.display = 'none';
    return;
  }

  grid.innerHTML = skelCards(12);
  seeAll.loading = true;

  try {
    const data = await seeAll.fetcher(1);
    const results = data.results || data.media || [];
    seeAll.items = results;
    seeAll.page = 1;
    seeAll.totalPages = data.total_pages || 1;

    if (!results.length) {
      grid.innerHTML = '<p class="muted-note">Nothing to show here.</p>';
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }

    grid.innerHTML = results.map(m => {
      const t = seeAll.type || (m.media_type === 'tv' ? 'tv' : m._anime ? 'anime' : 'movie');
      return makeCard(m, t);
    }).join('');

    if (moreBtn) moreBtn.style.display = 'none'; // replaced by infinite scroll

    // Set up infinite scroll sentinel
    if (grid && seeAll.page < seeAll.totalPages) {
      const sentinel = document.createElement('div');
      sentinel.id = 'seeall-sentinel';
      sentinel.style.height = '40px';
      grid.after(sentinel);
      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) loadMoreSeeAll();
      }, { rootMargin: '300px' });
      obs.observe(sentinel);
      state._seeAllObs = obs;
    }
  } catch (e) {
    grid.innerHTML = '<p class="muted-note">Failed to load. Try again.</p>';
  } finally {
    seeAll.loading = false;
  }
}

export async function loadMoreSeeAll() {
  const { seeAll } = state;
  const grid = document.getElementById('seeall-grid');
  const moreBtn = document.getElementById('seeall-more');
  if (!seeAll.fetcher || seeAll.loading) return;

  seeAll.loading = true;
  if (moreBtn) { moreBtn.disabled = true; moreBtn.textContent = 'Loading…'; }

  try {
    const nextPage = seeAll.page + 1;
    const data = await seeAll.fetcher(nextPage);
    const results = data.results || [];
    seeAll.items = [...seeAll.items, ...results];
    seeAll.page = nextPage;

    if (grid) {
      results.forEach(m => {
        const t = seeAll.type || (m.media_type === 'tv' ? 'tv' : m._anime ? 'anime' : 'movie');
        grid.insertAdjacentHTML('beforeend', makeCard(m, t));
      });
    }

    // Hide Load More button (using infinite scroll now)
    if (moreBtn) moreBtn.style.display = 'none';

    // Add new sentinel if more pages exist
    const existingSentinel = document.getElementById('seeall-sentinel');
    if (existingSentinel && nextPage >= (seeAll.totalPages || 1)) {
      existingSentinel.remove();
      state._seeAllObs?.disconnect?.();
    }
  } catch {
    if (moreBtn) { moreBtn.disabled = false; moreBtn.textContent = 'Load More'; }
  } finally {
    seeAll.loading = false;
  }
}

/* ── DATA MANAGEMENT ─────────────────────────────────────────────── */
export function clearSection(key, label) {
  state[key] = Array.isArray(state[key]) ? [] : {};
  persist(key);
  renderLibrary();
  toast(`${label} cleared`, 'delete');
}

export function clearAllData() {
  const keys = ['watchlist', 'liked', 'disliked', 'recentlyViewed', 'continueWatching',
    'prefLikes', 'prefDislikes', 'prefGenres', 'prefGenreDislikes', 'prefTagLikes', 'prefTagDislikes'];
  keys.forEach(k => {
    state[k] = Array.isArray(state[k]) ? [] : {};
    persist(k);
  });
  renderLibrary();
  toast('All data cleared', 'delete_forever');
}
