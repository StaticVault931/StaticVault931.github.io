import { state, persist, mediaKey, getActiveTasteState } from './state.js';
import { makeCard, skelCards, emptyState, toast, esc } from './ui.js';
import { getStats, getFavorites, lifetimeSummary } from './stats.js';
import { GENRES } from './state.js';
import { undoManager } from './undoManager.js';
import { getActiveProfileId } from './profiles.js';

/* ── RENDER LIBRARY PAGE ─────────────────────────────────────────── */
/* Library stats banner — your viewing at a glance (reads the local
   stats ledger; hidden until there is anything to show) */
function ensureLibStatsBanner() {
  const tabs = document.querySelector('#page-library .lib-tabs');
  if (!tabs) return;
  let banner = document.getElementById('lib-stats-banner');
  try {
    const st = getStats();
    const fav = getFavorites(1);
    if (!st?.life?.watchMs && !st?.life?.plays) { banner?.remove(); return; }
    const h = st.life.watchMs / 3600000;
    const hours = h >= 100 ? Math.round(h) + 'h' : h >= 1 ? h.toFixed(1) + 'h' : Math.round(st.life.watchMs / 60000) + 'm';
    const topGenre = fav.genres?.[0] ? (GENRES.find(g => g.id === fav.genres[0].genreId)?.name || '') : '';
    const topTitle = fav.titles?.[0]?.title || '';
    const cells = [
      ['schedule', hours, 'watched'],
      ['play_circle', String(st.life.plays || 0), 'plays'],
      topGenre ? ['category', topGenre, 'top genre'] : null,
      topTitle ? ['star', topTitle, 'most watched'] : null,
    ].filter(Boolean);
    const html = cells.map(([ic, big, small]) => `
      <div class="lib-stat">
        <span class="material-icons-round">${ic}</span>
        <span class="lib-stat-big">${big}</span>
        <span class="lib-stat-small">${small}</span>
      </div>`).join('');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'lib-stats-banner';
      tabs.after(banner);
    }
    banner.innerHTML = html;
  } catch { banner?.remove(); }
}

/* Service chips: mouse wheel scrolls the row horizontally */
function wireServiceWheel() {
  const row = document.getElementById('lib-qp-row');
  if (!row || row.dataset.wheelWired) return;
  row.dataset.wheelWired = '1';
  row.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // native horizontal
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }, { passive: false });
}

export function renderLibrary() {
  ensureLibStatsBanner();
  wireServiceWheel();
  renderContinueSection();
  renderWatchlistSection();
  renderLikedSection();
  renderRecentSection();
  renderTasteProfile();
  ensureLibJumpFab();
}

function renderTasteProfile() {
  const host = document.getElementById('lib-taste-summary');
  if (!host) return;
  const favorites = getFavorites(5);
  const summary = lifetimeSummary();
  const genreNames = favorites.genres.map(entry => GENRES.find(genre => genre.id === entry.genreId)?.name).filter(Boolean);
  const actors = favorites.actors.map(actor => actor.name).filter(Boolean);
  const taste = getActiveTasteState();
  const kidsMode = taste !== state;
  const signals = (taste.prefLikes || []).length + (taste.prefDislikes || []).length + (kidsMode ? 0 : state.prefGenres.length + state.prefGenreDislikes.length);
  const insightRows = [
    genreNames.length ? ['category', 'Genres shaping your feed', genreNames.join(', ')] : null,
    actors.length ? ['groups', 'Actors you return to', actors.join(', ')] : null,
    favorites.langs.length ? ['language', 'Languages you watch', favorites.langs.map(item => item.lang.toUpperCase()).join(', ')] : null,
    favorites.types.length ? ['movie_filter', 'Your viewing mix', favorites.types.map(item => `${item.type}: ${item.hours}h`).join(' | ')] : null,
    summary.calibration && Object.values(summary.calibration).some(Boolean)
      ? ['tune', 'Taste tuner results', `${summary.calibration.love || 0} loved, ${summary.calibration.like || 0} liked, ${summary.calibration.skip || 0} skipped`]
      : null,
    summary.clips?.views ? ['timer', 'Trailer attention', `${summary.clips.averageSeconds || 0}s average play, ${summary.clips.completionRate || 0}% completion`] : null,
  ].filter(Boolean);
  host.innerHTML = `
    <section class="taste-overview">
      <div class="taste-overview-head">
        <div><span class="material-icons-round">auto_awesome</span><div><h3>Your Taste Profile</h3><p>A local summary of the signals used to shape this profile's rows.</p></div></div>
        <button type="button" class="pref-apply-btn" data-open-calibration><span class="material-icons-round">swipe</span>Tune with titles</button>
      </div>
      <div class="taste-metrics">
        <div><strong>${signals}</strong><span>explicit signals</span></div>
        <div><strong>${taste.loved?.length || 0}</strong><span>loved titles</span></div>
        <div><strong>${summary.watchHours}h</strong><span>watch time</span></div>
        <div><strong>${summary.searches}</strong><span>searches</span></div>
      </div>
      <div class="taste-insights">${insightRows.length ? insightRows.map(([icon, label, value]) => `
        <div class="taste-insight"><span class="material-icons-round">${icon}</span><div><strong>${esc(label)}</strong><span>${esc(value)}</span></div></div>`).join('') : `
        <div class="taste-insight taste-insight-empty"><span class="material-icons-round">explore</span><div><strong>Still learning your taste</strong><span>Like titles, watch something, or use the tuner to build useful recommendations.</span></div></div>`}</div>
      <div class="taste-actions">
        <button type="button" class="data-btn" data-page="prefs"><span class="material-icons-round">settings</span>Detailed feed settings</button>
        <button type="button" class="data-btn" data-open-calibration><span class="material-icons-round">style</span>Rate more titles</button>
      </div>
    </section>`;
}

/* Floating jump button — the library gets LONG; one tap to the bottom
   (or back to the top once you're there). Only visible on the library page. */
function ensureLibJumpFab() {
  if (document.getElementById('lib-jump-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'lib-jump-fab';
  fab.setAttribute('aria-label', 'Jump to bottom');
  fab.innerHTML = '<span class="material-icons-round">keyboard_double_arrow_down</span>';
  document.getElementById('page-library')?.appendChild(fab);

  const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
  const sync = () => {
    const down = !atBottom();
    fab.querySelector('.material-icons-round').textContent =
      down ? 'keyboard_double_arrow_down' : 'keyboard_double_arrow_up';
    fab.setAttribute('aria-label', down ? 'Jump to bottom' : 'Back to top');
  };
  fab.addEventListener('click', () => {
    window.scrollTo({ top: atBottom() ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
  });
  window.addEventListener('scroll', () => {
    if (document.getElementById('page-library')?.classList.contains('active')) sync();
  }, { passive: true });
  sync();
}

function renderContinueSection() {
  const sec = document.getElementById('lib-continue-sec');
  const grid = document.getElementById('lib-continue-grid');
  if (!grid) return;
  if (getActiveTasteState() !== state) { if (sec) sec.style.display = 'none'; grid.innerHTML = ''; return; }

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
  const watchlist = getActiveTasteState().watchlist || [];

  grid.classList.toggle('lib-grid-empty', !watchlist.length);
  if (!watchlist.length) {
    grid.innerHTML = emptyState('bookmark_add', 'Nothing saved yet — tap the bookmark on any title.', [
      { action: 'go-home', label: 'Browse Trending' },
      { action: 'go-search', label: 'Search' },
    ]);
    return;
  }
  grid.innerHTML = watchlist.map(m => makeCard(m, m.type || 'movie')).join('');
}

function renderLikedSection() {
  const grid = document.getElementById('lib-liked-grid');
  if (!grid) return;
  const liked = getActiveTasteState().liked || [];

  grid.classList.toggle('lib-grid-empty', !liked.length);
  if (!liked.length) {
    grid.innerHTML = emptyState('favorite_border', 'Nothing liked yet — tap ❤ on any title to shape your feed.', [
      { action: 'go-home', label: 'Browse Home' },
    ]);
    return;
  }
  grid.innerHTML = liked.map(m => makeCard(m, m.type || 'movie')).join('');
}

function renderRecentSection() {
  const sec = document.getElementById('lib-recent-sec');
  const grid = document.getElementById('lib-recent-grid');
  if (!grid) return;
  if (getActiveTasteState() !== state) { if (sec) sec.style.display = 'none'; grid.innerHTML = ''; return; }

  const items = [...state.recentlyViewed]
    .sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0))
    .filter((item, index, all) => all.findIndex(other => mediaKey(other) === mediaKey(item)) === index)
    .slice(0, 60);
  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';

  grid.classList.add('lib-grid-compact');
  const relative = timestamp => {
    if (!timestamp) return 'Viewed earlier';
    const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `${days}d ago` : new Date(timestamp).toLocaleDateString();
  };
  grid.innerHTML = items.map(m => makeCard(m, m.type || m.media_type || 'movie', { compact: true, showProgress: false, removableRecent: true })
    .replace('<div class="card-poster">', `<div class="card-poster"><span class="recent-time-badge">${esc(relative(m.viewedAt))}</span>`)).join('');
  grid.querySelectorAll('[data-action="remove-recent"]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const key = `${button.dataset.type}:${button.dataset.id}`;
      const index = state.recentlyViewed.findIndex(item => mediaKey(item) === key);
      if (index < 0) return;
      const [removed] = state.recentlyViewed.splice(index, 1);
      persist('recentlyViewed');
      renderRecentSection();
      const undoId = undoManager.record({ label: 'Removed from Recently Viewed', title: removed.title || removed.name || '', icon: 'history', undo: () => {
        state.recentlyViewed.splice(Math.min(index, state.recentlyViewed.length), 0, removed);
        persist('recentlyViewed');
        renderRecentSection();
      } });
      toast('Removed from Recently Viewed', 'history', { actionLabel: 'Undo', onAction: () => undoManager.undo(undoId) });
    });
  });
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
  const keys = ['watchlist', 'liked', 'loved', 'disliked', 'watched', 'recentlyViewed', 'continueWatching', 'recentSearches',
    'prefLikes', 'prefDislikes', 'prefGenres', 'prefGenreDislikes', 'prefTagLikes', 'prefTagDislikes', 'tasteSkips'];
  keys.forEach(k => {
    state[k] = Array.isArray(state[k]) ? [] : {};
    persist(k);
  });
  state.kidsTaste = { liked: [], loved: [], disliked: [], watched: [], watchlist: [], prefLikes: [], prefDislikes: [], tasteSkips: {} };
  persist('kidsTaste');
  const profileId = getActiveProfileId() || 'default';
  [`sv_stats_v1_${profileId}`, `sv_clips_seen_v1_${profileId}`, `sv_kids_pin_v1_${profileId}`, 'sv_search_log']
    .forEach(key => localStorage.removeItem(key));
  const localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
  localKeys.filter(key => key?.startsWith(`sv_clips_dwell_v2_${profileId}_`)).forEach(key => localStorage.removeItem(key));
  undoManager.clearForProfile(profileId);
  renderLibrary();
  toast('All data cleared', 'delete_forever');
}
