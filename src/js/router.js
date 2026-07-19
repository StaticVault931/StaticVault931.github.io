import { state, persist } from './state.js';
import { recordPageView } from './stats.js';
import { pagePath, canonicalPageUrl, browsePath } from './routes.js';

/* ── PAGE TITLES & DESCRIPTIONS ─────────────────────────────────── */
const PAGE_META = {
  home:    { title: 'StaticVault931 — Free Unblocked Movies, TV Shows & Anime',   desc: 'Watch movies, TV shows, and anime free and unblocked. Personalized picks, no account needed.' },
  movies:  { title: 'Watch Movies Free Unblocked — StaticVault931',               desc: 'Browse popular, top-rated, and new movies free online. Unblocked. No sign-up required.' },
  tv:      { title: 'Watch TV Shows Free Unblocked — StaticVault931',             desc: 'Stream top-rated TV shows unblocked. New episodes daily, no account needed.' },
  anime:   { title: 'Watch Anime Free Unblocked — StaticVault931',                desc: 'Discover trending and top-rated anime free online, unblocked. New and classic series.' },
  search:  { title: 'Search Movies & Shows — StaticVault931',                     desc: 'Search movies, TV shows, and anime. Find anything — all content free and unblocked.' },
  library: { title: 'My Library — StaticVault931',                                desc: 'Your personal watchlist, liked titles, and viewing history.' },
  prefs:   { title: 'Customize Your Feed — StaticVault931',                       desc: 'Set preferred genres, content ratings, and titles to personalize your recommendations.' },
  seeall:   { title: 'Browse All Content — StaticVault931',                       desc: 'Browse the full catalog of free unblocked movies, TV shows, and anime.' },
  mix:      { title: 'Mix & Match — Blend Titles Into New Picks | StaticVault931', desc: 'Pick a few movies or shows you love and blend them — Mix & Match finds titles that match the combination, not just one of them.' },
  clips:    { title: 'Watch Clips — StaticVault931',                              desc: 'Scroll through short clips for the latest movies and TV shows. Discover your next watch.' },
};

const PAGE_BREADCRUMBS = {
  home:    [],
  movies:  [{ name: 'Movies',       url: canonicalPageUrl('movies') }],
  tv:      [{ name: 'TV Shows',     url: canonicalPageUrl('tv') }],
  anime:   [{ name: 'Anime',        url: canonicalPageUrl('anime') }],
  search:  [{ name: 'Search',       url: canonicalPageUrl('search') }],
  library: [{ name: 'My Library',   url: canonicalPageUrl('library') }],
  prefs:    [{ name: 'Customize Feed', url: canonicalPageUrl('prefs') }],
  mix:      [{ name: 'Mix & Match',  url: canonicalPageUrl('mix') }],
  clips:    [{ name: 'Clips',           url: canonicalPageUrl('clips') }],
};
const PRIVATE_PAGES = new Set(['search', 'library', 'prefs', 'seeall', 'holidayrows']);

function updateVisibleItemList(page) {
  if (!['home', 'movies', 'tv', 'anime', 'clips', 'mix'].includes(page)) return;
  const active = document.getElementById(`page-${page}`);
  const cards = [...(active?.querySelectorAll('.card[data-id][data-type]') || [])].slice(0, 30);
  if (!cards.length) return;
  const ldEl = document.getElementById('jsonld-media');
  if (!ldEl) return;
  let data;
  try { data = JSON.parse(ldEl.textContent || '{}'); } catch { data = {}; }
  const graph = Array.isArray(data['@graph']) ? data['@graph'].filter(node => node['@type'] !== 'ItemList') : [];
  graph.push({
    '@type': 'ItemList',
    itemListElement: cards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: card.dataset.title || 'Title',
      url: new URL(card.querySelector('.card-main-link')?.getAttribute('href') || '/', location.origin).href,
    })),
  });
  ldEl.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

function updatePageMeta(p) {
  const m = PAGE_META[p] || PAGE_META.home;
  document.title = m.title;
  const base = 'https://staticvault931.github.io/';
  const pageUrl = canonicalPageUrl(p);
  const siteImg = `${base}assets/icons/favicon.png`;

  document.querySelector('meta[name="description"]')?.setAttribute('content', m.desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', m.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', m.desc);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', pageUrl);
  document.querySelector('meta[property="og:image"]')?.setAttribute('content', siteImg);
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', 'website');
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', m.title);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', siteImg);
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', pageUrl);
  document.querySelector('meta[name="robots"]')?.setAttribute('content', PRIVATE_PAGES.has(p)
    ? 'noindex, nofollow'
    : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');

  // Inject per-page JSON-LD: BreadcrumbList + a CollectionPage node so
  // browse pages (movies/tv/anime/search) carry their own identity for
  // rendered crawls instead of reading as copies of home
  const ldEl = document.getElementById('jsonld-media');
  if (ldEl) {
    const crumbs = PAGE_BREADCRUMBS[p] || [];
    const graph = [];
    if (crumbs.length) {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base },
          ...crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.name, item: c.url })),
        ],
      });
    }
    if (['movies', 'tv', 'anime', 'search', 'clips', 'mix'].includes(p)) {
      graph.push({
        '@type': 'CollectionPage',
        name: m.title,
        description: m.desc,
        url: pageUrl,
        isPartOf: { '@type': 'WebSite', name: 'StaticVault931', url: base },
      });
    }
    ldEl.textContent = graph.length
      ? JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
      : '';
  }
}

/* ── PAGE LOADERS registry ───────────────────────────────────────── */
export const PAGE_LOADERS = {};

export function registerLoader(page, fn) {
  PAGE_LOADERS[page] = fn;
}

/* ── NAVIGATE ────────────────────────────────────────────────────── */
export function goPage(p, options = {}) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => {
    const on = el.dataset.page === p;
    el.classList.toggle('on', on);
    el.classList.toggle('active', on);
  });
  document.querySelectorAll('.bottom-nav-btn').forEach(el => {
    el.classList.toggle('on', el.dataset.page === p);
  });

  let pg = document.getElementById('page-' + p);
  let loadedBeforeActivation = false;
  if (!pg && PAGE_LOADERS[p]) {
    PAGE_LOADERS[p]();
    loadedBeforeActivation = true;
    pg = document.getElementById('page-' + p);
  }
  if (pg) {
    pg.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Update URL, title, and meta for each page
  if (options.history !== 'none') {
    const method = options.history === 'replace' ? 'replaceState' : 'pushState';
    history[method]({ page: p }, '', pagePath(p));
  }
  updatePageMeta(p);

  // Show/hide header search pill on search page
  const pill = document.getElementById('header-search-pill');
  if (pill) pill.style.display = p === 'search' ? 'none' : '';

  // Auto-apply CYF changes when navigating away from prefs
  if (state.currentPage === 'prefs' && p !== 'prefs' && window._prefsDirty) {
    window._prefsDirty = false;
    // Trigger a soft feed refresh (stays on target page)
    if (typeof window._autoApplyFeed === 'function') window._autoApplyFeed();
  }

  state.currentPage = p;
  recordPageView(); // stats ledger
  if (!loadedBeforeActivation && PAGE_LOADERS[p]) PAGE_LOADERS[p]();
  setTimeout(() => updateVisibleItemList(p), 1200);
}

/* ── SEE-ALL ─────────────────────────────────────────────────────── */
const SEE_ALL_REGISTRY = {};

export function registerSeeAll(key, fetcher) {
  SEE_ALL_REGISTRY[key] = fetcher;
}

export function getSeeAllFetcher(key) {
  return SEE_ALL_REGISTRY[key] || null;
}

export function goSeeAll(key, title, options = {}) {
  state.seeAll = {
    key,
    title,
    fetcher: SEE_ALL_REGISTRY[key] || null,
    page: 1,
    items: [],
    loading: false,
    prevPage: state.currentPage || 'home',
  };
  goPage('seeall', { history: 'none' });
  const method = options.history === 'replace' ? 'replaceState' : 'pushState';
  history[method]({ page: 'seeall', key, title }, '', browsePath(key, title));
}
