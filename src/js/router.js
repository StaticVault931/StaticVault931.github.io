import { state, persist } from './state.js';

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

  // Update URL for each page
  if (p === 'home') {
    history.replaceState({ page: p }, '', location.pathname);
  } else {
    history.pushState({ page: p }, '', `${location.pathname}?page=${p}`);
  }

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
