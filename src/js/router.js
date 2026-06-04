import { state, persist } from './state.js';

/* ── PAGE TITLES & DESCRIPTIONS ─────────────────────────────────── */
const PAGE_META = {
  home:    { title: 'StaticVault931 — Free Movies, TV Shows & Anime',          desc: 'Discover trending movies, TV shows, and anime. Personalized recommendations, no account needed.' },
  movies:  { title: 'Movies — StaticVault931',                                  desc: 'Browse and watch popular, top-rated, and new release movies for free. No sign-up required.' },
  tv:      { title: 'TV Shows — StaticVault931',                                desc: 'Stream popular and top-rated TV shows for free. New episodes, trending series, and more.' },
  anime:   { title: 'Anime — StaticVault931',                                   desc: 'Watch trending and top-rated anime free online. Discover new series and classics.' },
  search:  { title: 'Search — StaticVault931',                                  desc: 'Search movies, TV shows, and anime. Find anything in our catalog instantly.' },
  library: { title: 'My Library — StaticVault931',                              desc: 'Your watchlist, liked titles, and viewing history all in one place.' },
  prefs:   { title: 'Customize Feed — StaticVault931',                          desc: 'Personalize your recommendations by setting preferred genres, content ratings, and titles.' },
  seeall:  { title: 'Browse — StaticVault931',                                  desc: 'Browse the full catalog of movies, TV shows, and anime.' },
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
