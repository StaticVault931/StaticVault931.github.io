import { state, persist } from './state.js';

/* ── PAGE TITLES & DESCRIPTIONS ─────────────────────────────────── */
const PAGE_META = {
  home:    { title: 'StaticVault931 — Free Unblocked Movies, TV Shows & Anime',   desc: 'Watch movies, TV shows, and anime free and unblocked. Personalized picks, no account needed.' },
  movies:  { title: 'Watch Movies Free Unblocked — StaticVault931',               desc: 'Browse popular, top-rated, and new movies free online. Unblocked. No sign-up required.' },
  tv:      { title: 'Watch TV Shows Free Unblocked — StaticVault931',             desc: 'Stream top-rated TV shows unblocked. New episodes daily, no account needed.' },
  anime:   { title: 'Watch Anime Free Unblocked — StaticVault931',                desc: 'Discover trending and top-rated anime free online, unblocked. New and classic series.' },
  search:  { title: 'Search Movies & Shows — StaticVault931',                     desc: 'Search movies, TV shows, and anime. Find anything — all content free and unblocked.' },
  library: { title: 'My Library — StaticVault931',                                desc: 'Your personal watchlist, liked titles, and viewing history.' },
  prefs:   { title: 'Customize Your Feed — StaticVault931',                       desc: 'Set preferred genres, content ratings, and titles to personalize your recommendations.' },
  seeall:  { title: 'Browse All Content — StaticVault931',                        desc: 'Browse the full catalog of free unblocked movies, TV shows, and anime.' },
};

function updatePageMeta(p) {
  const m = PAGE_META[p] || PAGE_META.home;
  document.title = m.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', m.desc);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', m.title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', m.desc);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    const base = 'https://staticvault931.github.io/';
    canonical.setAttribute('href', p === 'home' ? base : `${base}?page=${p}`);
  }
}

/* ── PAGE LOADERS registry ───────────────────────────────────────── */
export const PAGE_LOADERS = {};

export function registerLoader(page, fn) {
  PAGE_LOADERS[page] = fn;
}

/* ── NAVIGATE ────────────────────────────────────────────────────── */
export function goPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => {
    const on = el.dataset.page === p;
    el.classList.toggle('on', on);
    el.classList.toggle('active', on);
  });
  document.querySelectorAll('.bottom-nav-btn').forEach(el => {
    el.classList.toggle('on', el.dataset.page === p);
  });

  const pg = document.getElementById('page-' + p);
  if (pg) {
    pg.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Update URL, title, and meta for each page
  if (p === 'home') {
    history.replaceState({ page: p }, '', location.pathname);
  } else {
    history.pushState({ page: p }, '', `${location.pathname}?page=${p}`);
  }
  updatePageMeta(p);

  // Show/hide header search pill on search page
  const pill = document.getElementById('header-search-pill');
  if (pill) pill.style.display = p === 'search' ? 'none' : '';

  state.currentPage = p;
  if (PAGE_LOADERS[p]) PAGE_LOADERS[p]();
}

/* ── SEE-ALL ─────────────────────────────────────────────────────── */
const SEE_ALL_REGISTRY = {};

export function registerSeeAll(key, fetcher) {
  SEE_ALL_REGISTRY[key] = fetcher;
}

export function getSeeAllFetcher(key) {
  return SEE_ALL_REGISTRY[key] || null;
}

export function goSeeAll(key, title) {
  state.seeAll = {
    key,
    title,
    fetcher: SEE_ALL_REGISTRY[key] || null,
    page: 1,
    items: [],
    loading: false,
  };
  goPage('seeall');
}
