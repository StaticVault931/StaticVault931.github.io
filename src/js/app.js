import './adblock.js';
import { injectOverlays } from './templates.js';
import { state, persist, GENRES, AGE_LEVELS, addRecentlyViewed, saveContinue, getContinue, isLiked, isInWatchlist, isDisliked, isWatched, toggleLike, toggleWatchlist, toggleWatched, addDislike, recordImpression } from './state.js';
import { tmdb, aniQuery, imgUrl, normalizeAnime, fetchAnimeDetails, getContentRating, clearCachePattern } from './api.js';
import { goPage, registerLoader, goSeeAll, registerSeeAll, PAGE_LOADERS } from './router.js';
import { buildProviderBar, loadPlayer, nextProvider, cancelProviderTimer, getActiveProvider, setActiveProvider, PROVIDERS } from './player.js';
import { toast, makeCard, renderRow, skelCards, showHero, buildHeroDots, jumpHero, resetModal, renderModalInfo, renderModalActions, renderCast, renderRelated, scrollRow, buildGenreChips, emptyState, esc, hideSection, showSection, showConfirm } from './ui.js';
import { loadForYou, loadBecauseYouLiked, loadGenreRow } from './recommendations.js';
import { initSearch, loadSearchDefault, doSearch, searchTmdbAutocomplete } from './search.js';
import { renderLibrary, renderSeeAll, loadMoreSeeAll, clearSection, clearAllData } from './library.js';

/* ── THEMES ──────────────────────────────────────────────────────── */
const THEMES = ['dark', 'light', 'midnight', 'warm'];
const THEME_ICONS = { dark: 'dark_mode', light: 'light_mode', midnight: 'nights_stay', warm: 'wb_sunny' };

function initTheme() {
  const saved = localStorage.getItem('sv_theme') || 'dark';
  applyTheme(saved);
}
function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem('sv_theme', name);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.querySelector('.material-icons-round').textContent = THEME_ICONS[name] || 'palette';
}
function cycleTheme() {
  const cur = document.documentElement.dataset.theme || 'dark';
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  applyTheme(next);
  toast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, THEME_ICONS[next] || 'palette');
}

/* ── LEGAL ───────────────────────────────────────────────────────── */
const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    body: `
      <p style="color:var(--dim);font-size:.78rem;margin-bottom:1.2rem">Last updated: January 2026</p>
      <h3>1. Overview</h3>
      <p>StaticVault931 ("we", "us", "our") is committed to protecting your privacy. This policy explains what data is collected, how it is used, and your rights regarding that data. By using StaticVault931 you agree to this policy.</p>
      <h3>2. Data We Collect</h3>
      <p><strong>Locally stored data (never leaves your device):</strong></p>
      <p>• Watchlist, liked titles, disliked titles, and watch history<br>• Feed preferences (genres, content rating, liked/disliked titles)<br>• Continue-watching progress<br>• Recent searches<br>• Theme and display settings<br>• Provider preferences</p>
      <p>All of the above is stored exclusively in your browser's <code>localStorage</code> and <code>sessionStorage</code>. It is never transmitted to StaticVault931 or any third party by us.</p>
      <h3>3. Third-Party Services</h3>
      <p><strong>The Movie Database (TMDB):</strong> We query the TMDB API for movie, TV show, and metadata. TMDB may log API requests. See <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener">TMDB Privacy Policy</a>.</p>
      <p><strong>AniList:</strong> We query the AniList GraphQL API for anime metadata. See <a href="https://anilist.co/privacy" target="_blank" rel="noopener">AniList Privacy Policy</a>.</p>
      <p><strong>Video Embed Providers:</strong> VidSrc, Cineby, VidLink, 2Embed, SuperEmbed, VidSrc Pro, AutoEmbed, and Videasy operate independently. When you load a video, their servers receive your IP address and browser information as part of standard HTTP requests. StaticVault931 has no control over their data practices.</p>
      <h3>4. Cookies & Tracking</h3>
      <p>StaticVault931 itself sets no cookies and uses no tracking technologies. Embed providers may set their own cookies in the iframe context. Our ad-blocking layer attempts to restrict ad-network trackers from running on the page.</p>
      <h3>5. Analytics</h3>
      <p>We do not run any analytics platform (Google Analytics, Mixpanel, etc.) on StaticVault931.</p>
      <h3>6. Children's Privacy</h3>
      <p>StaticVault931 is not directed at children under 13. We do not knowingly collect data from children. If you believe a child has used the service inappropriately, please contact us.</p>
      <h3>7. Your Rights</h3>
      <p>Because all data is stored locally in your browser, you can delete it at any time via Library → Reset All Data, or by clearing your browser's storage for this site.</p>
      <h3>8. Contact</h3>
      <p>For privacy concerns: <a href="mailto:StaticQuasar931Games@gmail.com">StaticQuasar931Games@gmail.com</a> or join our <a href="https://discord.com/invite/DP2hM7RRhR" target="_blank" rel="noopener">Discord server</a>.</p>`
  },
  tos: {
    title: 'Terms of Service',
    body: `
      <p style="color:var(--dim);font-size:.78rem;margin-bottom:1.2rem">Last updated: January 2026</p>
      <h3>1. Acceptance</h3>
      <p>By accessing or using StaticVault931 ("the Service") you agree to be bound by these Terms. If you disagree with any part, you may not use the Service.</p>
      <h3>2. What StaticVault931 Is</h3>
      <p>StaticVault931 is a content <em>discovery</em> and <em>aggregation</em> platform. We do not host, upload, store, encode, or distribute any video files. All video content is sourced from independent third-party embed providers via publicly accessible embed URLs.</p>
      <h3>3. Permitted Use</h3>
      <p>You may use the Service for personal, non-commercial purposes. You must not:</p>
      <p>• Use the Service for any unlawful purpose<br>• Attempt to circumvent ad-blocking, CORS restrictions, or other technical measures<br>• Scrape or automate requests to the Service<br>• Resell access to the Service<br>• Use the Service to distribute malware or spam</p>
      <h3>4. Intellectual Property</h3>
      <p>The StaticVault931 codebase, UI design, and branding are the property of their respective creators. Content metadata is provided by TMDB and AniList under their respective licenses. Video content rights belong to their respective owners; StaticVault931 makes no claim over any media content.</p>
      <h3>5. Third-Party Content</h3>
      <p>StaticVault931 is not responsible for content displayed by third-party video providers. This includes quality, accuracy, availability, advertisements, and any malicious content that may originate from those providers. We make reasonable efforts to block popups and intrusive ads but cannot guarantee complete effectiveness.</p>
      <h3>6. Availability</h3>
      <p>The Service is provided on a best-effort basis. We do not guarantee uninterrupted availability. Third-party providers may go offline without notice.</p>
      <h3>7. Disclaimer of Warranties</h3>
      <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, and non-infringement.</p>
      <h3>8. Limitation of Liability</h3>
      <p>To the fullest extent permitted by law, StaticVault931 and its creators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.</p>
      <h3>9. Changes to Terms</h3>
      <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
      <h3>10. Contact</h3>
      <p><a href="mailto:StaticQuasar931Games@gmail.com">StaticQuasar931Games@gmail.com</a></p>`
  },
  dmca: {
    title: 'DMCA & Copyright',
    body: `
      <p style="color:var(--dim);font-size:.78rem;margin-bottom:1.2rem">Last updated: January 2026</p>
      <h3>1. Our Position</h3>
      <p>StaticVault931 fully respects intellectual property rights. We do not host, store, or distribute any media files. All video content is embedded from independent third-party providers via publicly accessible URLs.</p>
      <h3>2. Where Content Is Hosted</h3>
      <p>Video content accessible through StaticVault931 is physically hosted on third-party servers (VidSrc, Cineby, VidLink, 2Embed, etc.). We have no control over these servers and cannot directly remove content from them.</p>
      <h3>3. DMCA Takedown for Hosted Content</h3>
      <p>If you are a copyright holder and believe your content is being served by one of our embed providers, the appropriate action is to file a DMCA notice directly with that provider:</p>
      <p>• <strong>VidSrc</strong>: contact via vidsrc.to<br>• <strong>2Embed</strong>: contact via 2embed.cc<br>• <strong>Other providers</strong>: contact the respective domain operator</p>
      <h3>4. DMCA Notice for StaticVault931 Specifically</h3>
      <p>If you have a concern specifically about StaticVault931 (e.g., our use of TMDB metadata, search indexing, or promotional imagery), send a written notice to <a href="mailto:StaticQuasar931Games@gmail.com">StaticQuasar931Games@gmail.com</a> including:</p>
      <p>• Your full legal name and contact information<br>• Identification of the copyrighted work claimed to be infringed<br>• The specific URL or content on StaticVault931 in question<br>• A statement that you have a good faith belief that use of the material is not authorized<br>• A statement under penalty of perjury that the information in the notice is accurate and that you are the copyright owner or authorized to act on their behalf<br>• Your electronic or physical signature</p>
      <h3>5. Response Time</h3>
      <p>We will acknowledge valid DMCA notices within 5 business days and take appropriate action, which may include removing metadata, links, or functionality related to the claimed content.</p>
      <h3>6. Counter-Notice</h3>
      <p>If you believe content was removed in error, you may file a counter-notice with the same contact information above.</p>`
  },
  disclaimer: {
    title: 'General Disclaimer',
    body: `
      <p style="color:var(--dim);font-size:.78rem;margin-bottom:1.2rem">Last updated: January 2026</p>
      <h3>Content Availability</h3>
      <p>StaticVault931 is a discovery platform. Content availability depends entirely on third-party embed providers which operate independently. We cannot guarantee that any specific title will be available, playable, or of any particular quality.</p>
      <h3>No Endorsement</h3>
      <p>StaticVault931 does not endorse, certify, or warranty any content accessible through third-party providers. Content ratings and descriptions are sourced from TMDB and AniList and are provided for informational purposes only.</p>
      <h3>Advertisements</h3>
      <p>Third-party video providers may display advertisements including pre-roll ads, banner ads, and pop-ups. StaticVault931 includes an ad-blocking layer but cannot guarantee it will catch all ads. We receive no revenue from these advertisements.</p>
      <h3>Technical Limitations</h3>
      <p>Streaming quality, speed, and reliability depend on your internet connection, your browser, and the third-party provider's servers. StaticVault931 makes no guarantees about streaming performance.</p>
      <h3>Age-Appropriate Use</h3>
      <p>StaticVault931 includes a content rating filter as a convenience feature. This filter relies on metadata from TMDB and is not a parental control system. It does not guarantee that all content is appropriate for the selected rating. Parents and guardians are responsible for supervising minors' use of the platform.</p>
      <h3>External Links</h3>
      <p>StaticVault931 may contain links to external websites. We have no control over the content or privacy practices of those sites and accept no responsibility for them.</p>
      <h3>Accuracy of Information</h3>
      <p>Content descriptions, ratings, cast information, and other metadata are sourced from third-party databases (TMDB, AniList). We make no warranty as to the accuracy, completeness, or timeliness of this information.</p>
      <h3>Contact</h3>
      <p>Questions or concerns: <a href="mailto:StaticQuasar931Games@gmail.com">StaticQuasar931Games@gmail.com</a></p>`
  }
};

function showLegal(type) {
  const data = LEGAL_CONTENT[type];
  if (!data) return;
  const overlay = document.getElementById('legal-overlay');
  const content = document.getElementById('legal-content');
  if (!overlay || !content) return;
  content.innerHTML = `<h2>${data.title}</h2>${data.body}`;
  overlay.classList.add('open');
}
function closeLegal() {
  document.getElementById('legal-overlay')?.classList.remove('open');
}

/* ── SHORTCUTS LIST (must be before init IIFE to avoid TDZ) ─────── */
const SHORTCUTS = [
  { key: '/', desc: 'Open search', group: 'Navigation' },
  { key: 'H', desc: 'Go to Home', group: 'Navigation' },
  { key: 'L', desc: 'Go to Library', group: 'Navigation' },
  { key: 'S', desc: 'Go to Search', group: 'Navigation' },
  { key: 'T', desc: 'Cycle theme', group: 'Navigation' },
  { key: 'Esc', desc: 'Close modal / dialog', group: 'Modal' },
  { key: 'N', desc: 'Try next provider', group: 'Modal' },
  { key: 'I', desc: 'Toggle info panel', group: 'Modal' },
  { key: '← / A', desc: 'Previous hero slide', group: 'Hero' },
  { key: '→ / D', desc: 'Next hero slide', group: 'Hero' },
  { key: '?', desc: 'Show this help screen', group: 'Help' },
];

/* ── INIT ────────────────────────────────────────────────────────── */
(async function init() {
  injectOverlays();   // inject modals/overlays before anything else
  initTheme();
  applyLoadingScreenState();
  initEventDelegation();
  initKeyboard();
  initHeader();
  initHoverTrailer();
  initModalPanelToggles();
  initShortcutsModal();
  initTestMode();
  buildRatingDescriptions();
  registerAllLoaders();
  registerAllSeeAll();
  initSearch();
  loadGenresUI();

  // Start home data loading
  loadHero().catch(() => {});
  loadHomeRows().catch(() => {});

  // URL param deep-link — supports ?watch=type&name=slug&id=X, ?id=X&type=Y, ?page=X
  const sp = new URLSearchParams(location.search);
  const watchId = sp.get('id');
  const watchType = sp.get('watch') || sp.get('type');
  const watchStart = sp.get('start') ? parseInt(sp.get('start')) : null;
  const pageParam = sp.get('page');
  const searchParam = sp.get('search');

  if (watchId && watchType) {
    document.getElementById('loading-screen')?.classList.add('out');
    setTimeout(async () => {
      await openMedia(+watchId, watchType);
      if (watchStart) handleWatchTogetherLink(watchStart);
    }, 400);
  } else if (pageParam) {
    setTimeout(() => goPage(pageParam), 100);
  } else if (searchParam) {
    setTimeout(() => {
      goPage('search');
      const inp = document.getElementById('search-input');
      if (inp) { inp.value = searchParam; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }, 100);
  }

  // Handle browser back/forward
  window.addEventListener('popstate', e => {
    if (e.state?.id && e.state?.type) {
      openMedia(e.state.id, e.state.type);
    } else if (e.state?.page) {
      goPage(e.state.page);
    } else {
      closeModal();
    }
  });
})();

/* ── LOADING SCREEN ──────────────────────────────────────────────── */
function applyLoadingScreenState() {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;

  // Skip loading screen entirely after first visit
  if (localStorage.getItem('sv_visited')) {
    ls.classList.add('instant-out');
    return;
  }
  localStorage.setItem('sv_visited', '1');

  document.body.classList.add('ls-open');
  const enterBtn = document.getElementById('ls-enter');
  if (enterBtn) enterBtn.addEventListener('click', dismissLoadingScreen);
  setTimeout(dismissLoadingScreen, 2500);
}

function dismissLoadingScreen() {
  const ls = document.getElementById('loading-screen');
  if (!ls || ls.classList.contains('out')) return;
  ls.classList.add('out');
  document.body.classList.remove('ls-open');
}

/* ── HEADER SCROLL ───────────────────────────────────────────────── */
function initHeader() {
  window.addEventListener('scroll', () => {
    document.getElementById('header')?.classList.toggle('solid', scrollY > 60);
  }, { passive: true });

  // Search pill opens search page
  document.getElementById('header-search-pill')?.addEventListener('click', () => {
    goPage('search');
    setTimeout(() => document.getElementById('search-input')?.focus(), 150);
  });
}

/* ── PAGE LOADERS ────────────────────────────────────────────────── */
function registerAllLoaders() {
  registerLoader('home', () => { /* already loaded at init */ });
  registerLoader('movies', loadMoviesPage);
  registerLoader('tv', loadTvPage);
  registerLoader('anime', loadAnimePage);
  registerLoader('search', () => {
    loadSearchDefault();
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
  });
  registerLoader('library', renderLibrary);
  registerLoader('prefs', loadPrefsPage);
  registerLoader('seeall', renderSeeAll);
}

function registerAllSeeAll() {
  registerSeeAll('trending', p => tmdb('/trending/all/week', { page: p }));
  registerSeeAll('movies-popular', p => tmdb('/movie/popular', { page: p }));
  registerSeeAll('movies-top', p => tmdb('/movie/top_rated', { page: p }));
  registerSeeAll('movies-new', p => tmdb('/movie/now_playing', { page: p }));
  registerSeeAll('movies-upcoming', p => tmdb('/movie/upcoming', { page: p }));
  registerSeeAll('tv-popular', p => tmdb('/tv/popular', { page: p }));
  registerSeeAll('tv-top', p => tmdb('/tv/top_rated', { page: p }));
  registerSeeAll('tv-airing', p => tmdb('/tv/airing_today', { page: p }));
  registerSeeAll('anime-trending', p => aniQuery(`query($p:Int){Page(page:$p,perPage:20){media(type:ANIME,sort:[TRENDING_DESC],isAdult:false){id title{romaji english}coverImage{large}averageScore popularity startDate{year}}}}`, { p }).then(d => ({ results: (d?.data?.Page?.media || []).map(normalizeAnime) })));

  // Genre see-alls are registered dynamically
  GENRES.forEach(g => {
    registerSeeAll('genre-' + g.id, p => tmdb('/discover/movie', { with_genres: g.id, sort_by: 'popularity.desc', page: p }));
  });
}

/* ── HERO ────────────────────────────────────────────────────────── */
async function loadHero() {
  try {
    const d = await tmdb('/trending/movie/week');
    state.heroItems = (d.results || []).filter(x => x.backdrop_path).slice(0, 7);
    buildHeroDots();
    showHero(0);
    clearInterval(state.heroTimer);
    state.heroTimer = setInterval(() => {
      showHero((state.heroIdx + 1) % state.heroItems.length);
    }, 10000);
  } catch {}
}

/* ── ROW LOAD GENERATION (prevents stale responses overwriting fresh content) */
let _homeGen = 0;

/* ── ROW DEDUP ───────────────────────────────────────────────────── */
const _homeSeenIds = new Set();

/* ── LAZY ROW HELPER (observer-based, for truly off-screen rows) ─── */
const _lazyObs = new Map();

function lazyRow(rowId, secId, fetchFn, type) {
  const row = document.getElementById(rowId);
  const sec = secId ? document.getElementById(secId) : null;
  if (!row) return;

  _lazyObs.get(rowId)?.disconnect();
  _lazyObs.delete(rowId);
  if (sec) sec.style.display = '';

  const obs = new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    _lazyObs.delete(rowId);
    _loadRow(rowId, secId, fetchFn, type);
  }, { rootMargin: '800px 0px' }); // large margin so most rows pre-load

  obs.observe(sec || row);
  _lazyObs.set(rowId, obs);
}

/* ── DIRECT ROW FETCH (always loads, no observer) ────────────────── */
function _loadRow(rowId, secId, fetchFn, type, gen) {
  const row = document.getElementById(rowId);
  const sec = secId ? document.getElementById(secId) : null;
  if (!row) return Promise.resolve();
  if (sec) sec.style.display = '';

  return fetchFn()
    .then(items => {
      // Stale — a newer loadHomeRows() call has started
      if (gen !== undefined && gen !== _homeGen) return;

      if (!items || !items.length) {
        if (sec) sec.style.display = 'none';
        return;
      }
      // Soft dedup — prefer unique items but fall back to originals if all are dupes
      const deduped = items.filter(m => m.id && !_homeSeenIds.has(m.id));
      const toRender = deduped.length ? deduped : items;
      toRender.slice(0, 14).forEach(m => _homeSeenIds.add(m.id));
      renderRow(rowId, toRender.slice(0, 14), type);
    })
    .catch(err => {
      if (gen !== undefined && gen !== _homeGen) return;
      console.warn(`Row ${rowId} failed:`, err?.message || err);
      if (row && row.innerHTML.includes('csk-poster')) {
        // Still showing skeleton — replace with subtle retry notice
        row.innerHTML = '<div class="row-load-err">Could not load · <button onclick="location.reload()">Retry</button></div>';
      }
    });
}

/* ── HOME ROWS ───────────────────────────────────────────────────── */
async function loadHomeRows() {
  // Increment generation — any in-flight loads from previous call become stale
  const gen = ++_homeGen;
  _homeSeenIds.clear();
  _lazyObs.forEach(obs => obs.disconnect());
  _lazyObs.clear();

  // Show skeletons for ALL rows immediately
  const allRowIds = [
    'row-trending', 'row-foryou', 'row-continue', 'row-recent',
    'row-new', 'row-toprated', 'row-tv-pop', 'row-airing',
    'row-action', 'row-comedy', 'row-horror', 'row-drama',
    'row-scifi', 'row-animated', 'row-home-anime',
  ];
  allRowIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = skelCards(6);
      const sec = el.closest('.section');
      if (sec) sec.style.display = '';
    }
  });

  // Instant local data
  renderContinueRow();
  renderRecentRow();

  // Genre preferences for personalized rows
  const prefG = state.prefGenres;
  const gOpts = (genreId, extra = {}) => ({
    with_genres: prefG.length ? `${genreId}|${prefG.slice(0, 2).join('|')}` : String(genreId),
    sort_by: 'popularity.desc',
    ...extra,
  });
  const rng = state._randomPage || 1;

  const animeQ = `query{Page(page:${rng},perPage:16){media(type:ANIME,sort:[TRENDING_DESC],isAdult:false){id title{romaji english}coverImage{large}averageScore popularity startDate{year}}}}`;

  // ── BATCH 1: visible above the fold — load immediately ─────────────
  await Promise.allSettled([
    tmdb('/trending/all/week')
      .then(d => {
        if (gen !== _homeGen) return; // stale
        const items = (d.results || []).slice(0, 14);
        items.forEach(m => _homeSeenIds.add(m.id));
        renderRow('row-trending', items, null, true);
      })
      .catch(() => {}),
    loadForYou(),
  ]);

  if (gen !== _homeGen) return; // cancelled by a newer load

  // ── BATCH 2: just below the fold — load right after ─────────────────
  Promise.allSettled([
    _loadRow('row-new',      'sec-new',      () => tmdb('/movie/now_playing', { page: rng }).then(d => d.results || []), 'movie',  gen),
    _loadRow('row-toprated', 'sec-toprated', () => tmdb('/movie/top_rated',   { page: rng }).then(d => d.results || []), 'movie',  gen),
    _loadRow('row-tv-pop',   'sec-tv-pop',   () => tmdb('/tv/popular',        { page: rng }).then(d => d.results || []), 'tv',     gen),
    _loadRow('row-airing',   'sec-airing',   () => tmdb('/tv/airing_today').then(d => d.results || []),                  'tv',     gen),
  ]);

  // ── BATCH 3: genre rows — slight delay so batch 2 gets bandwidth ────
  setTimeout(() => {
    if (gen !== _homeGen) return;
    Promise.allSettled([
      _loadRow('row-action',   'sec-action',   () => tmdb('/discover/movie', gOpts(28,  { page: rng })).then(d => d.results || []), 'movie', gen),
      _loadRow('row-comedy',   'sec-comedy',   () => tmdb('/discover/movie', gOpts(35,  { page: rng })).then(d => d.results || []), 'movie', gen),
      _loadRow('row-horror',   'sec-horror',   () => tmdb('/discover/movie', gOpts(27,  { page: rng })).then(d => d.results || []), 'movie', gen),
      _loadRow('row-drama',    'sec-drama',    () => tmdb('/discover/movie', gOpts(18,  { sort_by: 'vote_average.desc', 'vote_count.gte': 300, page: rng })).then(d => d.results || []), 'movie', gen),
      _loadRow('row-scifi',    'sec-scifi',    () => tmdb('/discover/movie', gOpts(878, { page: rng })).then(d => d.results || []), 'movie', gen),
      _loadRow('row-animated', 'sec-animated', () => tmdb('/discover/movie', gOpts(16,  { page: rng })).then(d => d.results || []), 'movie', gen),
    ]);
  }, 400);

  // ── BATCH 4: anime (AniList has separate rate limits) ────────────────
  setTimeout(() => {
    if (gen !== _homeGen) return;
    _loadRow('row-home-anime', 'sec-home-anime', () =>
      aniQuery(animeQ).then(d => (d?.data?.Page?.media || []).map(normalizeAnime)), 'anime', gen);
  }, 800);

  // ── Because You Liked rows (personalized) ───────────────────────────
  setTimeout(() => {
    if (gen !== _homeGen) return;
    loadBecauseYouLiked().catch(() => {});
  }, 600);
}

function renderContinueRow() {
  const sec = document.getElementById('sec-continue');
  const trendSec = document.getElementById('sec-trending');
  const row = document.getElementById('row-continue');
  if (!row) return;

  // Move continue watching after trending if it exists
  if (sec && trendSec && trendSec.nextElementSibling !== sec) {
    trendSec.after(sec);
  }

  // Use Object.entries so we can backfill the id from the key for old saves
  const items = Object.entries(state.continueWatching)
    .map(([key, val]) => ({ ...val, id: val.id ?? +key }))
    .filter(item => item.id && !isNaN(item.id))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 12);

  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  row.innerHTML = items.map(item => makeCard(item, item.type || 'movie', { showProgress: true })).join('');
}

function renderRecentRow() {
  const sec = document.getElementById('sec-recent');
  const row = document.getElementById('row-recent');
  if (!row) return;

  const items = state.recentlyViewed.slice(0, 14);
  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  row.innerHTML = items.map(m => makeCard(m, m.type || 'movie')).join('');
}

/* ── MOVIES PAGE ─────────────────────────────────────────────────── */
async function loadMoviesPage() {
  const rows = ['row-movies-pop', 'row-movies-top', 'row-movies-new', 'row-movies-up', 'row-movies-action', 'row-movies-thriller'];
  rows.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  await Promise.allSettled([
    tmdb('/movie/popular').then(d => renderRow('row-movies-pop', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-pop')),
    tmdb('/movie/top_rated').then(d => renderRow('row-movies-top', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-top')),
    tmdb('/movie/now_playing').then(d => renderRow('row-movies-new', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-new')),
    tmdb('/movie/upcoming').then(d => renderRow('row-movies-up', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-up')),
    tmdb('/discover/movie', { with_genres: 28, sort_by: 'popularity.desc' }).then(d => renderRow('row-movies-action', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-action')),
    tmdb('/discover/movie', { with_genres: 53, sort_by: 'vote_average.desc', 'vote_count.gte': 200 }).then(d => renderRow('row-movies-thriller', (d.results || []).slice(0, 14), 'movie')).catch(() => hideSection('sec-movies-thriller')),
  ]);
}

/* ── TV PAGE ─────────────────────────────────────────────────────── */
async function loadTvPage() {
  const rows = ['row-tv-popular', 'row-tv-top', 'row-tv-air', 'row-tv-crime', 'row-tv-scifi'];
  rows.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  await Promise.allSettled([
    tmdb('/tv/popular').then(d => renderRow('row-tv-popular', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-popular')),
    tmdb('/tv/top_rated').then(d => renderRow('row-tv-top', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-top')),
    tmdb('/tv/airing_today').then(d => renderRow('row-tv-air', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-air')),
    tmdb('/discover/tv', { with_genres: 80, sort_by: 'popularity.desc' }).then(d => renderRow('row-tv-crime', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-crime')),
    tmdb('/discover/tv', { with_genres: 10765, sort_by: 'popularity.desc' }).then(d => renderRow('row-tv-scifi', (d.results || []).slice(0, 14), 'tv')).catch(() => hideSection('sec-tv-scifi')),
  ]);
}

/* ── ANIME PAGE ──────────────────────────────────────────────────── */
async function loadAnimePage() {
  const rows = ['row-anime-trend', 'row-anime-top', 'row-anime-airing', 'row-anime-action'];
  rows.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  const Q = `query($sort:[MediaSort],$status:MediaStatus,$genre:String){Page(perPage:16){media(type:ANIME,sort:$sort,status:$status,isAdult:false,genre:$genre){id title{romaji english}coverImage{large}bannerImage averageScore popularity episodes status startDate{year}description(asHtml:false)}}}`;

  const [trend, top, airing, action] = await Promise.allSettled([
    aniQuery(Q, { sort: ['TRENDING_DESC'] }),
    aniQuery(Q, { sort: ['SCORE_DESC'] }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], status: 'RELEASING' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Action' }),
  ]);

  const fix = r => {
    if (r.status !== 'fulfilled') return [];
    return (r.value?.data?.Page?.media || []).map(normalizeAnime);
  };

  renderRow('row-anime-trend', fix(trend), 'anime');
  renderRow('row-anime-top', fix(top), 'anime');
  renderRow('row-anime-airing', fix(airing), 'anime');
  renderRow('row-anime-action', fix(action), 'anime');

  if (!fix(trend).length) hideSection('sec-anime-trend');
  if (!fix(top).length) hideSection('sec-anime-top');
  if (!fix(airing).length) hideSection('sec-anime-airing');
  if (!fix(action).length) hideSection('sec-anime-action');
}

/* ── GENRES UI ───────────────────────────────────────────────────── */
function loadGenresUI() {
  buildGenreChips('genre-scroll', GENRES, (id, name) => {
    if (state.activeGenreId === id) {
      state.activeGenreId = null;
      document.getElementById('genre-results-section')?.style && (document.getElementById('genre-results-section').style.display = 'none');
      document.querySelectorAll('#genre-scroll .genre-chip').forEach(c => c.classList.remove('on'));
      return;
    }
    state.activeGenreId = id;
    document.querySelectorAll('#genre-scroll .genre-chip').forEach(c => c.classList.toggle('on', +c.dataset.genreId === id));
    loadGenreRow(id, name);
  }, state.activeGenreId ? [state.activeGenreId] : []);
}

/* ── PREFS PAGE ──────────────────────────────────────────────────── */
function loadPrefsPage() {
  renderPrefLists();
  buildRatingDescriptions();
  buildGenreChips('pref-genres', GENRES, (id, _name, chipEl) => {
    const i = state.prefGenres.indexOf(id);
    if (i >= 0) state.prefGenres.splice(i, 1); else state.prefGenres.push(id);
    persist('prefGenres');
    chipEl.classList.toggle('on', state.prefGenres.includes(id));
  }, state.prefGenres);
  buildVidsrcDomainList();
  buildAgeRatingUI();
  initPrefAutocomplete();
}

function buildAgeRatingUI() {
  const container = document.getElementById('pref-age-row');
  if (!container) return;
  const ratings = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
  container.innerHTML = ratings.map(r => `
    <button class="age-btn${state.ageRating === r ? ' on' : ''}" data-age="${r}">${r}</button>
  `).join('');
  container.querySelectorAll('.age-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ageRating = btn.dataset.age;
      persist('ageRating');
      container.querySelectorAll('.age-btn').forEach(b => b.classList.toggle('on', b.dataset.age === state.ageRating));
      toast(`Content rating set to ${state.ageRating}`, 'child_care');
      buildRatingDescriptions();
    });
  });
}

function renderPrefLists() {
  const ll = document.getElementById('pref-likes-list');
  if (ll) {
    ll.innerHTML = state.prefLikes.map(x => `
      <div class="pref-tag pref-tag-like">
        ${x.poster ? `<img src="${esc(x.poster)}" alt="" class="pref-tag-poster">` : ''}
        <span>${esc(x.title || x.name || '')}</span>
        <button class="pref-tag-remove" data-pref-remove-like="${esc(x.id)}" aria-label="Remove">
          <span class="material-icons-round">close</span>
        </button>
      </div>`).join('') || '<p class="muted-note" style="font-size:.8rem">No liked titles yet.</p>';
  }

  const dl = document.getElementById('pref-dislikes-list');
  if (dl) {
    dl.innerHTML = state.prefDislikes.map(x => `
      <div class="pref-tag pref-tag-dis">
        ${x.poster ? `<img src="${esc(x.poster)}" alt="" class="pref-tag-poster">` : ''}
        <span>${esc(x.title || x.name || '')}</span>
        <button class="pref-tag-remove" data-pref-remove-dis="${esc(x.id)}" aria-label="Remove">
          <span class="material-icons-round">close</span>
        </button>
      </div>`).join('') || '<p class="muted-note" style="font-size:.8rem">No disliked titles yet.</p>';
  }
}

/* ── PREF AUTOCOMPLETE ───────────────────────────────────────────── */
function initPrefAutocomplete() {
  setupAC('pref-like-input', 'pref-like-ac', item => {
    state.prefLikes = state.prefLikes.filter(x => x.id !== item.id);
    state.prefLikes.push({
      id: item.id,
      type: item._type || 'movie',
      title: item.title || item.name || '',
      poster: imgUrl(item.poster_path, 'w92'),
      score: 5,
    });
    persist('prefLikes');
    renderPrefLists();
    toast(`Added "${item.title || item.name}" to liked`, 'favorite');
    loadBecauseYouLiked().catch(() => {});
  });

  setupAC('pref-dis-input', 'pref-dis-ac', item => {
    state.prefDislikes = state.prefDislikes.filter(x => x.id !== item.id);
    state.prefDislikes.push({
      id: item.id,
      type: item._type || 'movie',
      title: item.title || item.name || '',
      poster: imgUrl(item.poster_path, 'w92'),
    });
    persist('prefDislikes');
    renderPrefLists();
    toast(`Added "${item.title || item.name}" to disliked`, 'thumb_down');
  });
}

let _acTimer = null;
function setupAC(inputId, dropId, onSelect) {
  const inp = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if (!inp || !drop) return;

  inp.addEventListener('input', () => {
    clearTimeout(_acTimer);
    const q = inp.value.trim();
    if (q.length < 2) { drop.style.display = 'none'; return; }
    _acTimer = setTimeout(async () => {
      const results = await searchTmdbAutocomplete(q);
      if (!results.length) { drop.style.display = 'none'; return; }
      drop.innerHTML = results.map(r =>
        `<div class="ac-item" data-ac-id="${r.id}" data-ac-type="${r._type}">
           ${r.poster_path ? `<img src="${imgUrl(r.poster_path, 'w92')}" alt="" class="ac-poster">` : '<div class="ac-poster-ph"></div>'}
           <div class="ac-info">
             <div class="ac-title">${esc(r.title || r.name || '')}</div>
             <div class="ac-meta">${r._type === 'tv' ? 'TV Show' : 'Movie'} · ${String(r.release_date || r.first_air_date || '').slice(0, 4)}</div>
           </div>
         </div>`).join('');
      drop.style.display = 'block';

      drop.querySelectorAll('.ac-item').forEach(el => {
        el.addEventListener('click', () => {
          const item = results.find(r => r.id == el.dataset.acId);
          if (item) { onSelect(item); inp.value = ''; drop.style.display = 'none'; }
        });
      });
    }, 300);
  });

  document.addEventListener('click', e => {
    if (!inp.contains(e.target) && !drop.contains(e.target)) drop.style.display = 'none';
  });
}

/* ── OPEN MEDIA / MODAL ──────────────────────────────────────────── */
export async function openMedia(id, type, hint = {}) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  clearHoverTrailer(); // stop any active hover preview
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  resetModal();

  state.currentMedia = { id, type, ...hint };

  try {
    let details, credits;
    if (type === 'anime') {
      details = await fetchAnimeDetails(id);
      credits = { cast: [], _cast: details._cast || [] };
    } else {
      [details, credits] = await Promise.all([
        tmdb(`/${type}/${id}`, { append_to_response: 'external_ids,content_ratings,release_dates,videos' }),
        tmdb(`/${type}/${id}/credits`),
      ]);
    }

    const title = details.title || details.name || details.romaji || 'Unknown';
    const imdbId = details.external_ids?.imdb_id || null;
    // TV/anime: always use TMDB ID — embed providers need it for episode routing
    // Movies: prefer IMDB ID when available
    const useId = (type === 'tv' || type === 'anime') ? id : (imdbId || id);

    const year = String(details.release_date || details.first_air_date || '').slice(0, 4);
    state.currentMedia = { id, type, title, imdbId, useId, details };

    // Update URL + page meta for SEO + sharing
    const mediaUrl = buildMediaUrl(id, type, title, year);
    history.pushState({ id, type }, title, mediaUrl);
    const ogImg = details.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
      : null;
    updatePageSEO(title, type, details.overview, ogImg);

    // Age check
    const contentRating = getContentRating(details, type);
    const ageLevel = AGE_LEVELS[contentRating] ?? 1;
    const maxLevel = AGE_LEVELS[state.ageRating] ?? 2;

    if (contentRating && ageLevel > maxLevel) {
      showAgeWarning(contentRating, useId, type);
    } else {
      loadPlayer(useId, type, 1, 1);
    }

    buildProviderBar(useId, type, 1, 1);
    renderModalInfo(details, type);
    renderModalActions(state.currentMedia);
    renderCast(credits);

    if (type === 'tv') {
      buildTvEpisodes(id, useId, details);
      loadRelated(id, type, details);
    } else if (type === 'anime') {
      buildAnimeEpisodes(details);
      loadRelated(id, type, details);
    } else {
      loadRelated(id, type, details);
    }
    setTimeout(() => document.dispatchEvent(new CustomEvent('sv:modal-ready')), 200);

    // Track
    addRecentlyViewed({ id, type, title, poster_path: details.poster_path || null, coverImage_large: details.coverImage_large || null, backdrop_path: details.backdrop_path || null });

  } catch (e) {
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = 'Failed to load';
    const loading = document.getElementById('player-loading');
    if (loading) loading.innerHTML = `<p style="color:var(--muted)">Could not load content. Try again.</p>`;
    console.error(e);
  }
}

/* ── AGE WARNING ─────────────────────────────────────────────────── */
function showAgeWarning(rating, useId, type) {
  const warn = document.getElementById('age-warn');
  if (!warn) return;
  const msg = document.getElementById('age-warn-msg');
  if (msg) msg.textContent = `This content is rated "${rating}" which is above your selected rating of "${state.ageRating}".`;
  warn.style.display = 'flex';
}

/* ── TV EPISODES ─────────────────────────────────────────────────── */
async function buildTvEpisodes(tmdbId, useId, details) {
  const sidebar = document.getElementById('modal-ep-sidebar');
  if (!sidebar) return;

  const total = details.number_of_seasons || 1;
  sidebar.innerHTML = `
    <div class="ep-section">
      <div class="ep-header">
        <h3>Episodes</h3>
        <select id="season-sel" aria-label="Select season">
          ${Array.from({ length: total }, (_, i) => `<option value="${i + 1}">Season ${i + 1}</option>`).join('')}
        </select>
      </div>
      <div class="ep-grid" id="ep-grid">${skelCards(4)}</div>
      <div class="ep-footer">
        <button class="ep-jump-related" id="ep-jump-related" title="Jump to similar titles">
          <span class="material-icons-round">arrow_downward</span> More Like This
        </button>
      </div>
    </div>`;

  const sel = document.getElementById('season-sel');
  // Season change: load episodes but do NOT auto-play — user is browsing
  if (sel) sel.addEventListener('change', () => fetchEpisodes(tmdbId, useId, +sel.value, undefined, false));

  // Restore last watched season (auto-play on initial open)
  const cont = getContinue(tmdbId);
  const startSeason = cont?.season || 1;
  if (sel) sel.value = String(startSeason);
  await fetchEpisodes(tmdbId, useId, startSeason, cont?.episode, true);
}

async function fetchEpisodes(tmdbId, useId, season, highlightEp, autoLoad = true) {
  const grid = document.getElementById('ep-grid');
  if (!grid) return;
  grid.innerHTML = skelCards(4);

  try {
    const d = await tmdb(`/tv/${tmdbId}/season/${season}`);
    const eps = d.episodes || [];
    grid.innerHTML = eps.map((ep, i) => {
      const th = imgUrl(ep.still_path, 'w300');
      const isCurrent = highlightEp ? ep.episode_number === highlightEp : i === 0;
      return `<div class="ep-card${isCurrent ? ' on' : ''}"
          data-ep="${ep.episode_number}"
          data-season="${season}"
          data-ep-tmdb="${tmdbId}"
          data-ep-use="${useId}"
          role="button" tabindex="0">
          ${th ? `<img class="ep-thumb" src="${th}" loading="lazy" alt="Episode ${ep.episode_number}">` : `<div class="ep-th-ph"><span class="material-icons-round">play_circle</span></div>`}
          <div class="ep-info">
            <div class="ep-n">Ep ${ep.episode_number}${ep.vote_average ? ` · ★${ep.vote_average.toFixed(1)}` : ''}</div>
            <div class="ep-name" title="${esc(ep.name)}">${esc(ep.name || 'Episode ' + ep.episode_number)}</div>
            ${ep.runtime ? `<div class="ep-rt"><span class="material-icons-round">schedule</span>${ep.runtime}m</div>` : ''}
          </div>
        </div>`;
    }).join('');

    // Play first (or highlighted) episode only on initial open — not on season change
    const targetEp = highlightEp || 1;
    if (eps.length && autoLoad) loadPlayer(useId, 'tv', season, targetEp);
  } catch {
    grid.innerHTML = '<p class="muted-note">Could not load episodes.</p>';
  }
}

/* ── ANIME EPISODES ──────────────────────────────────────────────── */
function buildAnimeEpisodes(details) {
  const colRight = document.getElementById('modal-ep-sidebar');
  if (!colRight) return;

  const total = details.number_of_episodes || 1;
  const cont = getContinue(details.id);
  const lastEp = cont?.episode || 1;

  colRight.innerHTML = `
    <div class="ep-section">
      <div class="ep-header"><h3>Episodes</h3></div>
      <div class="ep-grid">
        ${Array.from({ length: Math.min(total, 100) }, (_, i) => {
          const ep = i + 1;
          return `<div class="ep-card${ep === lastEp ? ' on' : ''}"
            data-ep="${ep}"
            data-anime-id="${details.id}"
            role="button" tabindex="0">
            <div class="ep-th-ph"><span class="material-icons-round">play_circle</span></div>
            <div class="ep-info">
              <div class="ep-n">Episode ${ep}</div>
              <div class="ep-name">Episode ${ep}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  loadPlayer(details.id, 'anime', 1, lastEp);
}

/* ── RELATED (movies) ────────────────────────────────────────────── */
async function loadRelated(id, type, details) {
  const section = document.getElementById('modal-related-section');
  if (!section) return;
  section.innerHTML = `<div class="section-label">More Like This</div><div class="related-grid" id="related-grid">${skelCards(6)}</div>`;

  try {
    let items = [];
    if (type === 'anime') {
      items = (details._recommendations || []);
    } else {
      const d = await tmdb(`/${type}/${id}/recommendations`);
      items = (d.results || []).slice(0, 12);
    }
    renderRelated(items, type);
  } catch {
    const grid = document.getElementById('related-grid');
    if (grid) grid.innerHTML = '<p class="muted-note">No recommendations available.</p>';
  }
}

/* ── MODAL CLOSE ─────────────────────────────────────────────────── */
export function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
  document.getElementById('player-frame')?.removeAttribute('src');
  document.body.style.overflow = '';
  state.currentMedia = null;
  cancelProviderTimer();

  document.getElementById('trailer-fallback-btn')?.remove();
  resetPageSEO();
  // Stop any Watch Together countdown
  if (_wtTick) { clearInterval(_wtTick); _wtTick = null; }

  // Reset panel states for next open
  document.getElementById('modal-left-panel')?.classList.remove('panel-collapsed');
  document.getElementById('modal-right-panel')?.classList.remove('panel-collapsed');
  document.getElementById('left-panel-toggle')?.classList.remove('panel-toggle-active');
  document.getElementById('right-panel-toggle')?.classList.remove('panel-toggle-active');
}

/* ── PLAY NOW ────────────────────────────────────────────────────── */
function playNow() {
  if (!state.currentMedia) return;
  const { useId, id, type } = state.currentMedia;
  const uid = useId || id;

  if (type === 'tv') {
    const selEl = document.getElementById('season-sel');
    const s = selEl ? +selEl.value : 1;
    const activeEp = document.querySelector('.ep-card.on');
    const ep = activeEp ? +activeEp.dataset.ep : 1;
    loadPlayer(uid, type, s, ep);
  } else if (type === 'anime') {
    const activeEp = document.querySelector('.ep-card.on');
    const ep = activeEp ? +activeEp.dataset.ep : 1;
    loadPlayer(uid, type, 1, ep);
  } else {
    loadPlayer(uid, type, 1, 1);
  }
}

/* ── EVENT DELEGATION ────────────────────────────────────────────── */
function initEventDelegation() {
  // Card clicks
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-id][data-type]');
    if (!card) return;

    // Like button
    const likeBtn = e.target.closest('[data-action="like"]');
    if (likeBtn) {
      e.stopPropagation();
      const itemId = +likeBtn.dataset.id;
      const itemType = likeBtn.dataset.type;
      handleLike(itemId, itemType, likeBtn);
      return;
    }

    // Watchlist button
    const wlBtn = e.target.closest('[data-action="watchlist"]');
    if (wlBtn) {
      e.stopPropagation();
      const itemId = +wlBtn.dataset.id;
      const itemType = wlBtn.dataset.type;
      handleWatchlist(itemId, itemType, wlBtn);
      return;
    }

    // Watched button
    const watchedBtn = e.target.closest('[data-action="watched"]');
    if (watchedBtn) {
      e.stopPropagation();
      const itemId = +watchedBtn.dataset.id;
      const itemType = watchedBtn.dataset.type;
      handleWatched(itemId, itemType, watchedBtn, card);
      return;
    }

    // Don't trigger card click if it's a button inside
    if (e.target.closest('button')) return;

    const itemId = +card.dataset.id;
    const itemType = card.dataset.type;
    if (itemId && itemType) openMedia(itemId, itemType, {
      title: card.dataset.title,
      poster_path: card.dataset.poster,
      backdrop_path: card.dataset.backdrop,
    });
  });

  // Keyboard on cards
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-id][data-type]');
    if (!card || e.target.closest('button')) return;
    e.preventDefault();
    const itemId = +card.dataset.id;
    const itemType = card.dataset.type;
    if (itemId && itemType) openMedia(itemId, itemType);
  });

  // Nav: any [data-page] element not inside a card
  document.addEventListener('click', e => {
    // data-lib-jump takes precedence — handled separately below
    if (e.target.closest('[data-lib-jump]')) return;
    const pageEl = e.target.closest('[data-page]');
    if (!pageEl) return;
    if (pageEl.closest('[data-id]')) return; // skip card internals
    goPage(pageEl.dataset.page);
  });

  // Shortcuts button in footer
  document.getElementById('footer-shortcuts-btn')?.addEventListener('click', showShortcuts);

  // Open media from search autocomplete
  document.addEventListener('sv:open-media', e => {
    if (e.detail?.id && e.detail?.type) openMedia(e.detail.id, e.detail.type);
  });

  // Logo click → home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', () => goPage('home'));
    logo.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPage('home'); } });
  }

  // Hero area
  document.getElementById('hero')?.addEventListener('click', e => {
    if (!e.target.closest('button') && !e.target.closest('.hdot')) {
      const m = state.heroItems[state.heroIdx];
      if (m) openMedia(m.id, m.media_type === 'tv' ? 'tv' : 'movie', m);
    }
  });

  // Hero buttons
  document.getElementById('hero-play-btn')?.addEventListener('click', e => { e.stopPropagation(); const m = state.heroItems[state.heroIdx]; if (m) openMedia(m.id, m.media_type === 'tv' ? 'tv' : 'movie', m); });
  document.getElementById('hero-info-btn')?.addEventListener('click', e => { e.stopPropagation(); const m = state.heroItems[state.heroIdx]; if (m) openMedia(m.id, m.media_type === 'tv' ? 'tv' : 'movie', m); });

  // Hero dots
  document.getElementById('hero-dots')?.addEventListener('click', e => {
    const dot = e.target.closest('[data-hero-dot]');
    if (dot) jumpHero(+dot.dataset.heroDot);
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);

  // Hero right-click → next slide
  document.getElementById('hero')?.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (state.heroItems.length) jumpHero((state.heroIdx + 1) % state.heroItems.length);
  });

  // Modal close
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Modal actions — document-level so dislike and trailer work even after re-render
  document.addEventListener('click', e => {
    const btn = e.target.closest('#modal-actions [data-action]');
    if (!btn || !state.currentMedia) return;
    const action = btn.dataset.action;
    const { id, type, title, details } = state.currentMedia;
    const meta = { id, type, title, poster_path: details?.poster_path || null, coverImage_large: details?.coverImage_large || null };

    if (action === 'modal-play') playNow();
    else if (action === 'modal-trailer') {
      const key = btn.dataset.key;
      if (key) {
        cancelProviderTimer();
        const iframe = document.getElementById('player-frame');
        const loading = document.getElementById('player-loading');
        if (iframe) {
          if (loading) {
            loading.classList.remove('hidden');
            loading.innerHTML = `<div class="spin"></div><p>Loading trailer…</p>`;
          }
          iframe.removeAttribute('src');
          setTimeout(() => {
            iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&rel=0&modestbranding=1`;
            iframe.onload = () => { if (loading) loading.classList.add('hidden'); };
            // Fallback for Error 153 / embedding disabled — show helpful message after 5s
            setTimeout(() => {
              if (loading && !loading.classList.contains('hidden')) return;
              // Check if iframe shows YouTube error (can't detect directly, add "Watch on YouTube" overlay)
              showTrailerFallback(key);
            }, 6000);
          }, 50);
        }
      }
    }
    else if (action === 'modal-watchlist') { handleWatchlist(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-like') { handleLike(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-dislike') {
      addDislike(meta);
      toast("Got it — we'll show less like this", 'thumb_down');
      // Don't close the modal — user can keep watching
      renderModalActions(state.currentMedia); // refresh button states
    }
    else if (action === 'modal-share') shareMedia(e.shiftKey);
    else if (action === 'modal-watch-together') generateWatchTogetherLink();
  });

  // Legal overlay
  document.addEventListener('click', e => {
    const legalBtn = e.target.closest('[data-legal]');
    if (legalBtn) { showLegal(legalBtn.dataset.legal); return; }
    const lcloseBtn = e.target.closest('#legal-close');
    if (lcloseBtn) { closeLegal(); return; }
    const loverlay = document.getElementById('legal-overlay');
    if (loverlay && e.target === loverlay) closeLegal();
  });

  // Share menu
  document.getElementById('share-close')?.addEventListener('click', closeShareMenu);
  document.getElementById('share-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('share-overlay')) closeShareMenu();
  });

  // Library tabs
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-lib-tab]');
    if (!tab) return;
    document.querySelectorAll('.lib-tab').forEach(t => t.classList.toggle('on', t === tab));
    const tabName = tab.dataset.libTab;
    const libEl = document.getElementById('lib-tab-library');
    const prefsEl = document.getElementById('lib-tab-prefs');
    if (libEl) libEl.style.display = tabName === 'library' ? '' : 'none';
    if (prefsEl) prefsEl.style.display = tabName === 'prefs' ? '' : 'none';
    if (tabName === 'prefs') {
      const likedGrid = document.getElementById('lib-preftab-liked');
      if (likedGrid) {
        const items = [...state.liked, ...state.prefLikes].slice(0, 12);
        likedGrid.innerHTML = items.length
          ? items.map(m => makeCard(m, m.type || 'movie')).join('')
          : `<p class="muted-note">Like some titles to see them here.</p>`;
      }
    }
  });

  // Age warn buttons
  document.getElementById('warn-proceed-btn')?.addEventListener('click', () => {
    document.getElementById('age-warn').style.display = 'none';
    if (state.currentMedia) loadPlayer(state.currentMedia.useId || state.currentMedia.id, state.currentMedia.type, 1, 1);
  });
  document.getElementById('warn-back-btn')?.addEventListener('click', closeModal);

  // Provider bar
  document.addEventListener('click', e => {
    const pBtn = e.target.closest('[data-provider]');
    if (pBtn && pBtn.closest('#provider-bar')) {
      if (!state.currentMedia) return;
      setActiveProvider(pBtn.dataset.provider);
      const { useId, id, type } = state.currentMedia;
      const uid = useId || id;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      buildProviderBar(uid, type, s, ep);
      loadPlayer(uid, type, s, ep);
    }
    const nextBtn = e.target.closest('#prov-next-btn, #player-next-btn');
    if (nextBtn && state.currentMedia) {
      const { useId, id, type } = state.currentMedia;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      const next = nextProvider(useId || id, type, s, ep);
      toast(`Trying ${next.label}`, 'sync');
    }
  });

  // Episode cards
  document.addEventListener('click', e => {
    const epCard = e.target.closest('.ep-card');
    if (!epCard || !state.currentMedia) return;
    document.querySelectorAll('.ep-card').forEach(c => c.classList.remove('on'));
    epCard.classList.add('on');
    const ep = +epCard.dataset.ep;
    const season = +epCard.dataset.season || 1;
    const { useId, id, type } = state.currentMedia;
    const uid = useId || id;
    loadPlayer(uid, type, season, ep);

    // Save continue watching for TV/anime
    if (type === 'tv' || type === 'anime') {
      saveContinue(id, { season, episode: ep, type, title: state.currentMedia.title, poster_path: state.currentMedia.details?.poster_path || null });
    }
  });

  // Episode keyboard
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const epCard = e.target.closest('.ep-card');
    if (!epCard) return;
    e.preventDefault();
    epCard.click();
  });

  // Jump to "More Like This"
  document.addEventListener('click', e => {
    if (e.target.closest('#ep-jump-related')) {
      const related = document.getElementById('modal-related-section');
      if (related) related.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Show "More Like This" jump button ONLY when related section is off-screen
  const relObs = new IntersectionObserver(entries => {
    const btn = document.getElementById('ep-jump-related');
    if (!btn) return;
    btn.style.display = entries[0].isIntersecting ? 'none' : '';
  }, { threshold: 0.1 });

  // Re-observe whenever the modal opens
  document.getElementById('modal-overlay')?.addEventListener('click', () => {});
  const _observeRelated = () => {
    const rel = document.getElementById('modal-related-section');
    if (rel) relObs.observe(rel);
  };
  document.addEventListener('sv:modal-ready', _observeRelated);
  // Also observe on mutation when related section gets content
  new MutationObserver(() => _observeRelated())
    .observe(document.getElementById('modal-ep-sidebar') || document.body, { childList: true });

  // Row scroll arrows
  document.addEventListener('click', e => {
    const scrollBtn = e.target.closest('[data-scroll-row]');
    if (scrollBtn) {
      const rowId = scrollBtn.dataset.scrollRow;
      const dir = +scrollBtn.dataset.scrollDir;
      const row = document.getElementById(rowId);
      if (row) row.scrollBy({ left: dir * (row.clientWidth * 0.85), behavior: 'smooth' });
    }
  });

  // See all buttons
  document.addEventListener('click', e => {
    const seeAllBtn = e.target.closest('[data-see-all]');
    if (seeAllBtn) {
      const key = seeAllBtn.dataset.seeAll;
      const title = seeAllBtn.dataset.seeAllTitle || 'Browse';
      goSeeAll(key, title);
    }
    const moreBtn = e.target.closest('#seeall-more');
    if (moreBtn) loadMoreSeeAll();
  });

  // Genre clear
  document.getElementById('genre-clear-btn')?.addEventListener('click', () => {
    state.activeGenreId = null;
    document.getElementById('genre-results-section').style.display = 'none';
    document.querySelectorAll('#genre-scroll .genre-chip').forEach(c => c.classList.remove('on'));
  });

  // Prefs remove tags
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-pref-remove-like]');
    if (btn) {
      const id = btn.dataset.prefRemoveLike;
      state.prefLikes = state.prefLikes.filter(x => String(x.id) !== id);
      persist('prefLikes');
      renderPrefLists();
      return;
    }
    const btn2 = e.target.closest('[data-pref-remove-dis]');
    if (btn2) {
      const id = btn2.dataset.prefRemoveDis;
      state.prefDislikes = state.prefDislikes.filter(x => String(x.id) !== id);
      persist('prefDislikes');
      renderPrefLists();
    }
  });

  // Prefs apply — Shift+click to refresh without navigating home
  document.getElementById('pref-apply-btn')?.addEventListener('click', e => {
    refreshFeed(false, e.shiftKey);
  });

  // Feed randomize
  document.getElementById('pref-randomize-btn')?.addEventListener('click', e => {
    refreshFeed(true, e.shiftKey);
  });

  // VidSrc test all
  document.getElementById('vidsrc-test-all-btn')?.addEventListener('click', testAllVidsrcDomains);

  // Data management — use in-app confirm dialog
  document.getElementById('btn-clear-watchlist')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Watchlist', 'Remove all saved titles? This cannot be undone.')) clearSection('watchlist', 'Watchlist');
  });
  document.getElementById('btn-clear-liked')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Liked', 'Remove all liked titles? This cannot be undone.')) clearSection('liked', 'Liked');
  });
  document.getElementById('btn-clear-recent')?.addEventListener('click', async () => {
    if (await showConfirm('Clear History', 'Remove all recently viewed titles? This cannot be undone.')) clearSection('recentlyViewed', 'Recently Viewed');
  });
  document.getElementById('btn-clear-continue')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Continue Watching', 'Remove all progress? This cannot be undone.')) clearSection('continueWatching', 'Continue Watching');
  });
  document.getElementById('btn-clear-disliked')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Disliked', 'Clear your disliked list? This cannot be undone.')) clearSection('disliked', 'Disliked');
  });
  document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
    if (await showConfirm('Reset All Data', 'This clears your watchlist, liked, history, preferences, and settings. This cannot be undone.')) clearAllData();
  });

  // Provider auto-switch on timeout — try next provider after brief delay
  document.addEventListener('sv:provider-timeout', () => {
    if (!state.currentMedia) return;
    setTimeout(() => {
      // Only switch if player is still showing error (not loaded)
      const loading = document.getElementById('player-loading');
      if (!loading || loading.classList.contains('hidden')) return;
      const { useId, id, type } = state.currentMedia;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      const next = nextProvider(useId || id, type, s, ep);
      toast(`Auto-switching to ${next.label}…`, 'sync');
    }, 3500);
  });

  // Empty state actions
  document.addEventListener('click', e => {
    const act = e.target.closest('.empty-action');
    if (!act) return;
    if (act.dataset.action === 'go-home') goPage('home');
    else if (act.dataset.action === 'go-search') { goPage('search'); setTimeout(() => document.getElementById('search-input')?.focus(), 100); }
    else if (act.dataset.action === 'go-prefs') goPage('prefs');
  });

  // Library section jump
  document.querySelectorAll('[data-lib-jump]').forEach(el => {
    el.addEventListener('click', () => {
      goPage('library');
      const target = document.getElementById('lib-' + el.dataset.libJump);
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    });
  });

  // Plot expand
  document.addEventListener('click', e => {
    if (e.target.closest('#modal-plot')) {
      document.getElementById('modal-plot')?.classList.toggle('exp');
    }
  });

  // Header search pill
  document.getElementById('header-search-pill')?.addEventListener('click', () => {
    goPage('search');
    setTimeout(() => document.getElementById('search-input')?.focus(), 150);
  });
}

/* ── LIKE/WATCHLIST HELPERS ──────────────────────────────────────── */
function handleLike(id, type, btn, metaOverride) {
  const item = metaOverride || buildItemMeta(id, type);
  const added = toggleLike(item);
  if (added) toast('Liked!', 'favorite');
  else toast('Removed from liked', 'heart_broken');
  refreshCardBadges(id);
  if (btn) {
    btn.classList.toggle('liked', isLiked(id));
    btn.querySelector('.material-icons-round').textContent = isLiked(id) ? 'favorite' : 'favorite_border';
  }
}

function handleWatched(id, type, btn, card) {
  const item = buildItemMeta(id, type);
  const added = toggleWatched(item);
  if (added) toast('Marked as watched', 'visibility');
  else toast('Removed from watched', 'visibility_off');
  if (btn) {
    btn.classList.toggle('done', isWatched(id));
    btn.querySelector('.material-icons-round').textContent = isWatched(id) ? 'visibility' : 'visibility_off';
  }
  // Refresh badge on card
  const badgesEl = card?.querySelector('.card-badges');
  if (badgesEl) {
    // Re-render badges — simplest approach: rebuild card badges section
    const existing = badgesEl.querySelector('.badge-watched');
    if (isWatched(id) && !existing) {
      const span = document.createElement('span');
      span.className = 'card-badge badge-watched';
      span.textContent = 'Watched';
      badgesEl.appendChild(span);
    } else if (!isWatched(id) && existing) {
      existing.remove();
    }
  }
}

function handleWatchlist(id, type, btn, metaOverride) {
  const item = metaOverride || buildItemMeta(id, type);
  const added = toggleWatchlist(item);
  if (added) toast('Saved to Watchlist', 'bookmark_added');
  else toast('Removed from Watchlist', 'bookmark_remove');
  refreshCardBadges(id);
  if (btn) {
    btn.classList.toggle('saved', isInWatchlist(id));
    btn.querySelector('.material-icons-round').textContent = isInWatchlist(id) ? 'bookmark' : 'bookmark_add';
  }
}

function buildItemMeta(id, type) {
  // Try to get from current media or a visible card
  if (state.currentMedia && state.currentMedia.id == id) {
    const { title, details } = state.currentMedia;
    return { id, type, title, poster_path: details?.poster_path || null };
  }
  const card = document.querySelector(`[data-id="${id}"][data-type="${type}"]`);
  return { id, type, title: card?.dataset.title || '', poster_path: card?.dataset.poster || null };
}

function refreshCardBadges(id) {
  document.querySelectorAll(`.card[data-id="${id}"]`).forEach(card => {
    const likeBtn = card.querySelector('[data-action="like"]');
    const wlBtn = card.querySelector('[data-action="watchlist"]');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLiked(id));
      const ic = likeBtn.querySelector('.material-icons-round');
      if (ic) ic.textContent = isLiked(id) ? 'favorite' : 'favorite_border';
    }
    if (wlBtn) {
      wlBtn.classList.toggle('saved', isInWatchlist(id));
      const ic = wlBtn.querySelector('.material-icons-round');
      if (ic) ic.textContent = isInWatchlist(id) ? 'bookmark' : 'bookmark_add';
    }
  });
}

/* ── SEO: URL ROUTING + META ─────────────────────────────────────── */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function buildMediaUrl(id, type, title, year) {
  const slug = slugify(`${title || ''} ${year || ''}`);
  return `${location.origin}${location.pathname}?watch=${encodeURIComponent(type)}&name=${encodeURIComponent(slug)}&id=${id}`;
}

function updatePageSEO(title, type, overview, poster) {
  const fullTitle = title ? `${title} — StaticVault931` : 'StaticVault931 — Your Personal Cinema';
  const desc = overview
    ? overview.slice(0, 160)
    : `Watch ${title || 'content'} on StaticVault931`;
  const typeLabel = type === 'tv' ? 'TV Show' : type === 'anime' ? 'Anime' : 'Movie';

  document.title = fullTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', fullTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', type === 'movie' ? 'video.movie' : 'video.tv_show');
  if (poster) {
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', poster);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', poster);
  }

  // Update JSON-LD structured data dynamically
  const ldEl = document.getElementById('jsonld-media');
  if (ldEl && title) {
    ldEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': typeLabel === 'Movie' ? 'Movie' : 'TVSeries',
      'name': title,
      'description': desc,
      'url': location.href,
    });
  }
}

function resetPageSEO() {
  document.title = 'StaticVault931 — Your Personal Cinema';
  document.querySelector('meta[name="description"]')?.setAttribute('content', 'StaticVault931 — Discover and stream movies, TV shows, and anime.');
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', 'website');
  history.replaceState(null, '', location.pathname);
}

/* ── SHARE ───────────────────────────────────────────────────────── */
function shareMedia(forceClipboard = false) {
  if (!state.currentMedia) return;
  const { id, type, title, details } = state.currentMedia;
  const year = String(details?.release_date || details?.first_air_date || '').slice(0, 4);
  const url = buildMediaUrl(id, type, title, year);

  if (forceClipboard) {
    navigator.clipboard?.writeText(url).then(() => toast('Link copied!', 'link')).catch(() => toast('Copy failed', 'error'));
    return;
  }

  // Show share menu
  const overlay = document.getElementById('share-overlay');
  const titleEl = document.getElementById('share-title-preview');
  if (titleEl) titleEl.textContent = title || 'Content';

  const copyBtn = document.getElementById('share-copy');
  if (copyBtn) copyBtn.onclick = () => {
    navigator.clipboard?.writeText(url).then(() => { toast('Link copied!', 'link'); closeShareMenu(); }).catch(() => toast('Copy failed', 'error'));
  };

  const twitterBtn = document.getElementById('share-twitter');
  if (twitterBtn) twitterBtn.onclick = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Watching ' + (title || 'this') + ' on StaticVault931')}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'noopener');
    closeShareMenu();
  };

  const infoBtn = document.getElementById('share-info-page');
  if (infoBtn) infoBtn.onclick = () => {
    const infoUrl = url + '&mode=info';
    navigator.clipboard?.writeText(infoUrl).then(() => toast('Info page link copied!', 'info')).catch(() => {});
    closeShareMenu();
  };

  const nativeBtn = document.getElementById('share-native');
  if (nativeBtn) {
    nativeBtn.style.display = navigator.share ? '' : 'none';
    nativeBtn.onclick = () => { navigator.share({ title: title || 'StaticVault931', url }).catch(() => {}); closeShareMenu(); };
  }

  if (overlay) overlay.classList.add('open');
}

function closeShareMenu() {
  document.getElementById('share-overlay')?.classList.remove('open');
}

/* ── WATCH TOGETHER ──────────────────────────────────────────────── */
let _wtTick = null; // global so we can cancel on modal close

function generateWatchTogetherLink() {
  if (!state.currentMedia) return;
  const { id, type, title, details } = state.currentMedia;
  const year = String(details?.release_date || details?.first_air_date || '').slice(0, 4);
  const delayMs = 15000; // 15 seconds from now
  const startTs = Date.now() + delayMs;
  const room = Math.random().toString(36).slice(2, 8).toUpperCase();
  const slug = slugify(`${title || ''} ${year || ''}`);
  const url = `${location.origin}${location.pathname}?watch=${encodeURIComponent(type)}&name=${encodeURIComponent(slug)}&id=${id}&room=${room}&start=${startTs}`;

  // Copy link to clipboard
  navigator.clipboard?.writeText(url)
    .then(() => toast('Watch Together link copied! Starts in 15 seconds ⏱', 'group'))
    .catch(() => toast('Could not copy — link: ' + url, 'error'));

  // Stop any current playback and show countdown for the link generator too
  const iframe = document.getElementById('player-frame');
  if (iframe) iframe.removeAttribute('src');
  cancelProviderTimer();

  // Both parties use the same countdown function
  _startWatchTogetherCountdown(startTs, id, type);
}

function handleWatchTogetherLink(startTs) {
  if (!startTs || isNaN(startTs)) return;

  const now = Date.now();
  const delay = startTs - now;

  // Very old link (> 10 minutes) — just play from start
  if (delay < -600000) {
    if (state.currentMedia) {
      const { useId, id, type } = state.currentMedia;
      loadPlayer(useId || id, type, 1, 1);
      toast('Watch Together: Starting from beginning', 'group');
    }
    return;
  }

  // Stop the auto-play from openMedia so everyone starts together
  const iframe = document.getElementById('player-frame');
  if (iframe) iframe.removeAttribute('src');
  cancelProviderTimer();

  const { id, type } = state.currentMedia || {};
  if (!id || !type) return;

  // Preload: if there's enough time (>5s), warm up the provider
  // by loading the player iframe silently a few seconds before countdown ends
  if (delay > 5000) {
    setTimeout(() => {
      if (!state.currentMedia || _wtTick === null) return; // cancelled
      const { useId: uid, id: mid, type: mtype } = state.currentMedia;
      // Load silently into the frame (user will start seeing it load)
      const pf = document.getElementById('player-frame');
      const active = getActiveProvider();
      if (pf && active) {
        const src = active.url(uid || mid, mtype === 'anime' ? 'tv' : mtype, 1, 1);
        pf.src = src; // preload
      }
    }, delay - 3000); // 3 seconds before start
  }

  _startWatchTogetherCountdown(startTs, id, type);
}

function _startWatchTogetherCountdown(startTs, mediaId, mediaType) {
  // Clear any existing countdown
  if (_wtTick) { clearInterval(_wtTick); _wtTick = null; }

  const now = Date.now();
  const delay = startTs - now;

  // Already past start time (joined late) — reset to beginning and play now
  if (delay <= 0) {
    _wtPlayFromStart(mediaId, mediaType);
    toast('Watch Together: Starting now (synced)', 'group');
    return;
  }

  let remaining = Math.ceil(delay / 1000);

  const showCountdown = () => {
    const loading = document.getElementById('player-loading');
    if (!loading) return;
    loading.classList.remove('hidden');
    loading.innerHTML = `
      <div class="watch-together-cd">
        <span class="material-icons-round wt-icon">group</span>
        <div class="wt-title">Watch Together</div>
        <div class="wt-count" id="wt-count">${remaining}</div>
        <div class="wt-sub" id="wt-sub">Starting in ${remaining}s…</div>
        <div class="wt-actions">
          <button class="wt-skip-btn" id="wt-skip">
            <span class="material-icons-round">play_arrow</span> Play Now
          </button>
          <button class="wt-cancel-btn" id="wt-cancel">Cancel</button>
        </div>
      </div>`;

    const skipBtn = document.getElementById('wt-skip');
    const cancelBtn = document.getElementById('wt-cancel');

    if (skipBtn) skipBtn.addEventListener('click', () => {
      if (_wtTick) { clearInterval(_wtTick); _wtTick = null; }
      _wtPlayFromStart(mediaId, mediaType);
    }, { once: true });

    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      if (_wtTick) { clearInterval(_wtTick); _wtTick = null; }
      const loading2 = document.getElementById('player-loading');
      if (loading2) { loading2.classList.remove('hidden'); loading2.innerHTML = `<div class="spin"></div><p>Loading player…</p>`; }
      // Restart player normally
      if (state.currentMedia) {
        const { useId, id, type } = state.currentMedia;
        loadPlayer(useId || id, type, 1, 1);
      }
    }, { once: true });
  };

  showCountdown();

  _wtTick = setInterval(() => {
    remaining--;
    const countEl = document.getElementById('wt-count');
    const subEl = document.getElementById('wt-sub');

    if (!countEl) {
      // Modal closed or navigated away — stop
      clearInterval(_wtTick);
      _wtTick = null;
      return;
    }

    countEl.textContent = remaining;
    if (subEl) subEl.textContent = remaining > 0 ? `Starting in ${remaining}s…` : 'GO!';

    if (remaining <= 0) {
      clearInterval(_wtTick);
      _wtTick = null;
      _wtPlayFromStart(mediaId, mediaType);
      toast('🎬 Watch Together: GO!', 'group');
    }
  }, 1000);
}

function _wtPlayFromStart(mediaId, mediaType) {
  // Always play from season 1, episode 1 (beginning) for sync
  if (!state.currentMedia) return;
  const { useId, id, type } = state.currentMedia;
  const uid = useId || id;

  // Reset episode selection to ep 1
  const epCards = document.querySelectorAll('.ep-card');
  epCards.forEach((c, i) => c.classList.toggle('on', i === 0));
  const seasonSel = document.getElementById('season-sel');
  if (seasonSel) seasonSel.value = '1';

  loadPlayer(uid, type || mediaType, 1, 1);
}

/* ── FEED REFRESH ────────────────────────────────────────────────── */
function refreshFeed(randomize = false, stayOnPage = false) {
  // Clear ALL content caches from sessionStorage
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('svc_')) keysToRemove.push(k);
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));

  // Clear stale "Because You Liked" sections
  document.querySelectorAll('[id^="sec-because-"]').forEach(el => el.remove());

  // Disconnect lazy observers so rows reload
  _lazyObs.forEach(obs => obs.disconnect());
  _lazyObs.clear();
  _homeSeenIds.clear();

  if (randomize) {
    // Add random page offset to API calls via a temp state var
    state._randomPage = Math.floor(Math.random() * 5) + 2;
    toast('Feed randomized!', 'shuffle');
  } else {
    state._randomPage = null;
    toast('Feed updated!', 'check');
  }

  loadForYou().catch(() => {});
  loadBecauseYouLiked().catch(() => {});
  if (!stayOnPage) goPage('home');
  else toast(randomize ? 'Feed randomized! Scroll to see changes.' : 'Feed updated!', randomize ? 'shuffle' : 'check');
  // Reload lazy rows
  setTimeout(() => loadHomeRows().catch(() => {}), 200);
}

/* ── TRAILER FALLBACK ────────────────────────────────────────────── */
function showTrailerFallback(key) {
  // Add a small "Watch on YouTube" button over the player without interrupting playback
  const existing = document.getElementById('trailer-fallback-btn');
  if (existing) return;
  const playerWrap = document.querySelector('.player-wrap');
  if (!playerWrap) return;
  const btn = document.createElement('a');
  btn.id = 'trailer-fallback-btn';
  btn.href = `https://www.youtube.com/watch?v=${key}`;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.className = 'trailer-fallback-btn';
  btn.innerHTML = `<span class="material-icons-round">open_in_new</span> Can't play? Watch on YouTube`;
  playerWrap.appendChild(btn);
  // Remove when modal closes
}

/* ── SHORTCUTS MODAL ─────────────────────────────────────────────── */
function showShortcuts() {
  const ov = document.getElementById('shortcuts-overlay');
  if (ov) ov.classList.add('open');
}

function initShortcutsModal() {
  const ov = document.getElementById('shortcuts-overlay');
  if (!ov) return;
  const grid = document.getElementById('shortcuts-grid');
  if (grid) {
    const groups = [...new Set(SHORTCUTS.map(s => s.group))];
    grid.innerHTML = groups.map(g => `
      <div class="sc-group">
        <div class="sc-group-label">${g}</div>
        ${SHORTCUTS.filter(s => s.group === g).map(s =>
          `<div class="sc-item"><kbd class="sc-key">${esc(s.key)}</kbd><span class="sc-desc">${esc(s.desc)}</span></div>`
        ).join('')}
      </div>`).join('');
  }
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  document.getElementById('shortcuts-close')?.addEventListener('click', () => ov.classList.remove('open'));
}

/* ── TESTING MODE ────────────────────────────────────────────────── */
// Activation: click the FOOTER logo 5× within 3s, then type "931931"
let _testFooterClicks = 0;
let _testClickTimer = null;
let _testCodeArmed = false;
let _testCodeTyped = '';
const TEST_CODE = '931931';

function initTestMode() {
  // Step 1: Footer logo 5× within 3 seconds
  // (footer logo is injected by the existing HTML — it's in #footer .footer-logo)
  document.getElementById('footer')?.addEventListener('click', e => {
    if (!e.target.closest('.footer-logo, .footer-bottom')) return;
    _testFooterClicks++;
    clearTimeout(_testClickTimer);
    if (_testFooterClicks >= 5) {
      _testFooterClicks = 0;
      _testCodeArmed = true;
      _testCodeTyped = '';
      toast('Type the code…', 'lock');
      _testClickTimer = setTimeout(() => { _testCodeArmed = false; _testCodeTyped = ''; }, 15000);
    } else {
      _testClickTimer = setTimeout(() => { _testFooterClicks = 0; }, 2500);
    }
  });

  // Step 2: Type "931931" while code is armed
  document.addEventListener('keydown', e => {
    if (!_testCodeArmed || e.target.matches('input,textarea')) return;
    if (/^[0-9]$/.test(e.key)) {
      _testCodeTyped += e.key;
      if (_testCodeTyped.endsWith(TEST_CODE)) {
        clearTimeout(_testClickTimer);
        _testCodeArmed = false; _testCodeTyped = ''; _testFooterClicks = 0;
        const on = document.body.classList.toggle('test-mode');
        toast(on ? '🧪 Dev Mode ON' : '🧪 Dev Mode OFF', 'science');
        if (on) { populateTestPanel(); goPage('prefs'); }
      }
    } else if (e.key === 'Escape') {
      _testCodeArmed = false; _testCodeTyped = '';
    }
  });
}

/* ── TEST PANEL (shown in CYF page when test mode active) ────────── */
function _provStatusSVG(status) {
  if (status === 'ok')
    return `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#22c55e" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  if (status === 'fail')
    return `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#f87171" stroke-width="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  if (status === 'testing')
    return `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 2"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur=".8s" repeatCount="indefinite"/></circle></svg>`;
  // unknown
  return `<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--dim)" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="var(--dim)"/></svg>`;
}

function buildTestProviderRow(p) {
  const working = JSON.parse(localStorage.getItem('sv_provider_working') || '{}');
  const disabled = JSON.parse(localStorage.getItem('sv_provider_disabled') || '[]');
  const status = working[p.id] ? 'ok' : 'unknown';
  const isDisabled = disabled.includes(p.id);
  return `<div class="tp-row" id="tp-row-${p.id}">
    <span class="tp-icon" id="tpi-${p.id}">${_provStatusSVG(status)}</span>
    <span class="tp-name">${p.label}</span>
    ${p.note ? `<span class="tp-note">${p.note}</span>` : ''}
    <button class="tp-btn" onclick="window._testProv('${p.id}')">Test</button>
    <button class="tp-btn tp-toggle ${isDisabled ? 'tp-disabled' : 'tp-enabled'}" onclick="window._toggleProv('${p.id}')">
      ${isDisabled ? 'Off' : 'On'}
    </button>
  </div>`;
}

function populateTestPanel() {
  // Inject the test section into the CYF page (if not already there)
  let panel = document.getElementById('dev-test-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'dev-test-panel';
    panel.innerHTML = `
      <div class="dev-panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--red)"><path d="M9.4 3L7 8H3l7.5 13 2-7.5H17L9.4 3z"/></svg>
        <span>Developer Testing Mode</span>
        <button class="dev-close-btn" id="dev-close">Exit Dev Mode</button>
      </div>

      <div class="dev-section">
        <div class="dev-sec-title">Visual Layers</div>
        <div class="dev-btn-row">
          <button class="dev-btn" id="dev-btn-skeleton">Show Skeletons</button>
          <button class="dev-btn" id="dev-btn-no-img">Break Images</button>
          <button class="dev-btn" id="dev-btn-slow">Slow Mode</button>
          <button class="dev-btn" id="dev-btn-adblock">AdBlock: ON</button>
          <button class="dev-btn" id="dev-btn-clear">Clear Cache</button>
        </div>
        <div class="dev-btn-row" style="margin-top:.4rem">
          <span class="card-rating rating-great"><span class="material-icons-round">star</span>9.5</span>
          <span class="card-rating rating-good"><span class="material-icons-round">star</span>7.8</span>
          <span class="card-rating rating-ok"><span class="material-icons-round">star</span>5.4</span>
          <span class="card-rating rating-bad"><span class="material-icons-round">star</span>3.1</span>
          <span style="font-size:.7rem;color:var(--dim);align-self:center;margin-left:.3rem">Rating previews</span>
        </div>
      </div>

      <div class="dev-section">
        <div class="dev-sec-title">Themes
          <div class="dev-btn-row" style="display:inline-flex;margin-left:.5rem">
            <button class="dev-btn dev-btn-sm" onclick="document.documentElement.dataset.theme='dark'">Dark</button>
            <button class="dev-btn dev-btn-sm" onclick="document.documentElement.dataset.theme='light'">Light</button>
            <button class="dev-btn dev-btn-sm" onclick="document.documentElement.dataset.theme='midnight'">Midnight</button>
            <button class="dev-btn dev-btn-sm" onclick="document.documentElement.dataset.theme='warm'">Warm</button>
          </div>
        </div>
      </div>

      <div class="dev-section">
        <div class="dev-sec-title">Source Testing
          <button class="dev-btn dev-btn-sm" id="dev-test-all-btn" style="margin-left:.5rem">Test All</button>
        </div>
        <div class="dev-providers-grid" id="dev-providers-grid"></div>
      </div>`;

    const prefsPage = document.getElementById('page-prefs');
    if (prefsPage) prefsPage.appendChild(panel);

    // Wire up buttons (single init)
    document.getElementById('dev-close')?.addEventListener('click', () => {
      document.body.classList.remove('test-mode');
      panel.style.display = 'none';
    });

    const _toggle = (btnId, bodyClass, onLabel, offLabel) => {
      document.getElementById(btnId)?.addEventListener('click', function() {
        document.body.classList.toggle(bodyClass);
        this.textContent = document.body.classList.contains(bodyClass) ? offLabel : onLabel;
        this.classList.toggle('dev-btn-active', document.body.classList.contains(bodyClass));
      });
    };
    _toggle('dev-btn-skeleton', 'test-force-skeleton', 'Show Skeletons', 'Hide Skeletons');
    _toggle('dev-btn-no-img',   'test-no-images',     'Break Images', 'Fix Images');
    _toggle('dev-btn-slow',     'test-slow-mode',     'Slow Mode', 'Normal Speed');
    _toggle('dev-btn-adblock',  '_none_', 'AdBlock: ON', 'AdBlock: OFF');

    document.getElementById('dev-btn-adblock')?.addEventListener('click', function() {
      window._svAdBlockDisabled = document.body.classList.contains('_none_') ? false : !window._svAdBlockDisabled;
      this.textContent = window._svAdBlockDisabled ? 'AdBlock: OFF' : 'AdBlock: ON';
      this.classList.toggle('dev-btn-active', window._svAdBlockDisabled);
    });

    document.getElementById('dev-btn-clear')?.addEventListener('click', () => {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('svc_')) sessionStorage.removeItem(k);
      }
      toast('Cache cleared', 'delete_sweep');
    });

    document.getElementById('dev-test-all-btn')?.addEventListener('click', () => {
      PROVIDERS.forEach(p => window._testProv(p.id));
    });
  }

  panel.style.display = '';

  // Refresh provider list
  const grid = document.getElementById('dev-providers-grid');
  if (grid) grid.innerHTML = PROVIDERS.map(buildTestProviderRow).join('');
}

// Global provider test/toggle helpers
window._testProv = async function(id) {
  const prov = PROVIDERS.find(p => p.id === id);
  if (!prov) return;

  const iconEl = document.getElementById(`tpi-${id}`);
  if (iconEl) iconEl.innerHTML = _provStatusSVG('testing');

  try {
    const testUrl = prov.url(550, 'movie', 1, 1);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    await fetch(testUrl, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(timer);

    // no-cors fetch resolves even for blocked URLs; treat all non-abort as reachable
    const working = JSON.parse(localStorage.getItem('sv_provider_working') || '{}');
    working[id] = Date.now();
    localStorage.setItem('sv_provider_working', JSON.stringify(working));
    if (iconEl) iconEl.innerHTML = _provStatusSVG('ok');
    const row = document.getElementById(`tp-row-${id}`);
    if (row) row.querySelector('.tp-btn')?.classList.add('tp-ok');
  } catch (e) {
    if (e.name === 'AbortError') {
      if (iconEl) iconEl.innerHTML = _provStatusSVG('fail');
      toast(`${prov.label}: Timed out`, 'timer_off');
    } else {
      // Other errors treated as reachable (network/CORS masking)
      const working = JSON.parse(localStorage.getItem('sv_provider_working') || '{}');
      working[id] = Date.now();
      localStorage.setItem('sv_provider_working', JSON.stringify(working));
      if (iconEl) iconEl.innerHTML = _provStatusSVG('ok');
    }
  }
};

window._toggleProv = function(id) {
  const disabled = JSON.parse(localStorage.getItem('sv_provider_disabled') || '[]');
  const idx = disabled.indexOf(id);
  if (idx >= 0) disabled.splice(idx, 1);
  else disabled.push(id);
  localStorage.setItem('sv_provider_disabled', JSON.stringify(disabled));

  // Refresh just the toggle button
  const row = document.getElementById(`tp-row-${id}`);
  const btn = row?.querySelectorAll('.tp-btn')[1];
  const isOff = disabled.includes(id);
  if (btn) {
    btn.textContent = isOff ? 'Off' : 'On';
    btn.className = `tp-btn tp-toggle ${isOff ? 'tp-disabled' : 'tp-enabled'}`;
  }
  toast(`${id} ${isOff ? 'disabled' : 'enabled'}`, 'tune');
};

/* ── VIDSRC DOMAIN TESTER ────────────────────────────────────────── */
const VIDSRC_DOMAINS = [
  { id: 'vidsrc-to',      label: 'vidsrc.to',         url: 'https://vidsrc.to' },
  { id: 'vidsrc-me-ru',   label: 'vidsrcme.ru',        url: 'https://vidsrcme.ru' },
  { id: 'vidsrc-me-su',   label: 'vidsrcme.su',        url: 'https://vidsrcme.su' },
  { id: 'vidsrc-dash-ru', label: 'vidsrc-me.ru',       url: 'https://vidsrc-me.ru' },
  { id: 'vidsrc-dash-su', label: 'vidsrc-me.su',       url: 'https://vidsrc-me.su' },
  { id: 'vidsrc-emb-ru',  label: 'vidsrc-embed.ru',    url: 'https://vidsrc-embed.ru' },
  { id: 'vidsrc-emb-su',  label: 'vidsrc-embed.su',    url: 'https://vidsrc-embed.su' },
  { id: 'vsrc-su',        label: 'vsrc.su',            url: 'https://vsrc.su' },
];

function buildVidsrcDomainList() {
  const list = document.getElementById('vidsrc-domain-list');
  if (!list) return;
  const working = new Set(JSON.parse(localStorage.getItem('sv_vidsrc_working') || '[]'));
  list.innerHTML = VIDSRC_DOMAINS.map(d => `
    <div class="vidsrc-domain-item" data-domain-id="${d.id}">
      <span class="vd-status" id="vd-status-${d.id}">⬜</span>
      <span class="vd-label">${d.label}</span>
      <span class="vd-badge${working.has(d.id) ? ' working' : ''}" id="vd-badge-${d.id}">
        ${working.has(d.id) ? '✓ Works' : 'Unknown'}
      </span>
      <button class="vd-test-btn" data-test-domain="${d.id}">Test</button>
    </div>`).join('');

  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-test-domain]');
    if (btn) testVidsrcDomain(btn.dataset.testDomain);
  });
}

async function testVidsrcDomain(domainId) {
  const domain = VIDSRC_DOMAINS.find(d => d.id === domainId);
  if (!domain) return;
  const statusEl = document.getElementById(`vd-status-${domainId}`);
  const badgeEl = document.getElementById(`vd-badge-${domainId}`);
  if (statusEl) statusEl.textContent = '⏳';
  if (badgeEl) badgeEl.textContent = 'Testing…';

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch(`${domain.url}/embed/movie/550`, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (statusEl) statusEl.textContent = '✅';
    if (badgeEl) { badgeEl.textContent = '✓ Works'; badgeEl.classList.add('working'); }
    const working = new Set(JSON.parse(localStorage.getItem('sv_vidsrc_working') || '[]'));
    working.add(domainId);
    localStorage.setItem('sv_vidsrc_working', JSON.stringify([...working]));
    toast(`${domain.label} is working!`, 'check_circle');
  } catch (err) {
    if (err.name === 'AbortError') {
      if (statusEl) statusEl.textContent = '⏱';
      if (badgeEl) { badgeEl.textContent = 'Timeout'; badgeEl.classList.remove('working'); }
    } else {
      // no-cors requests don't throw for blocked URLs — treat as reachable
      if (statusEl) statusEl.textContent = '✅';
      if (badgeEl) { badgeEl.textContent = '✓ Reachable'; badgeEl.classList.add('working'); }
      const working = new Set(JSON.parse(localStorage.getItem('sv_vidsrc_working') || '[]'));
      working.add(domainId);
      localStorage.setItem('sv_vidsrc_working', JSON.stringify([...working]));
    }
  }
}

async function testAllVidsrcDomains() {
  for (const d of VIDSRC_DOMAINS) {
    await testVidsrcDomain(d.id);
    await new Promise(r => setTimeout(r, 500));
  }
}

/* ── RATING DESCRIPTIONS ─────────────────────────────────────────── */
function buildRatingDescriptions() {
  const el = document.getElementById('pref-rating-descs');
  if (!el) return;
  const descs = [
    { r: 'G',     label: 'General Audiences',  desc: 'All ages. No offensive content.' },
    { r: 'PG',    label: 'Parental Guidance',   desc: 'May not suit young children. Mild language or themes.' },
    { r: 'PG-13', label: 'Parents Strongly Cautioned', desc: 'May be inappropriate for children under 13. Some strong language, violence.' },
    { r: 'R',     label: 'Restricted',          desc: 'Under 17 requires parent/guardian. Strong language, violence, adult themes.' },
    { r: 'NC-17', label: 'Adults Only',         desc: 'No one under 17 admitted. Explicit adult content.' },
  ];
  el.innerHTML = descs.map(d => `
    <div class="rating-desc${state.ageRating === d.r ? ' active' : ''}">
      <span class="rd-badge">${d.r}</span>
      <div><div class="rd-label">${d.label}</div><div class="rd-text">${d.desc}</div></div>
    </div>`).join('');
}

/* (initTestMode defined above in testing mode section) */

/* ── PROVIDER NOTIFICATION ───────────────────────────────────────── */
function checkProviderNotification() {
  const active = getActiveProvider();
  const usual = state.lastProvider || 'vidsrc';
  if (active.id !== usual && state.currentMedia) {
    const usualProv = PROVIDERS.find(p => p.id === usual);
    const usualLabel = usualProv?.label || usual;
    toast(`Using ${active.label} instead of ${usualLabel}`, 'swap_horiz');
  }
}

/* ── NETFLIX-STYLE HOVER CARD ────────────────────────────────────── */
const _hoverTrailerCache = new Map();
let _hoverTimer = null;
let _hoverActive = false;
let _hoverCurrentCard = null;
let _hoverCurrentId = null;

function initHoverTrailer() {
  document.addEventListener('mouseover', e => {
    if (document.getElementById('modal-overlay')?.classList.contains('open')) return;
    if (window.matchMedia('(hover: none)').matches) return; // skip touch devices

    const card = e.target.closest('.card[data-id][data-type]');
    const ncCard = e.target.closest('#netflix-card');

    // Entered the netflix card itself — keep it open
    if (ncCard) return;

    // Left all cards
    if (!card) {
      // Only clear if not entering netflix card
      if (!e.relatedTarget?.closest?.('#netflix-card')) {
        clearHoverTrailer();
      }
      return;
    }

    // Same card — don't restart timer
    if (card === _hoverCurrentCard) return;

    clearHoverTrailer();
    _hoverCurrentCard = card;
    _hoverTimer = setTimeout(async () => {
      if (_hoverCurrentCard === card) {
        _hoverActive = true;
        await showNetflixCard(card);
      }
    }, 900); // 900ms delay
  });

  document.addEventListener('mouseleave', e => {
    if (e.target === document.documentElement) clearHoverTrailer();
  });

  // Leaving the netflix card itself
  document.getElementById('netflix-card')?.addEventListener('mouseleave', e => {
    if (!e.relatedTarget?.closest?.('.card')) clearHoverTrailer();
  });

  // Click ANYWHERE on the Netflix card opens the content
  const nc = document.getElementById('netflix-card');
  if (nc) {
    nc.addEventListener('click', e => {
      if (e.target.closest('#nc-wl') || e.target.closest('#nc-like')) return; // those handle themselves
      if (!_hoverCurrentCard) return;
      clearHoverTrailer();
      openMedia(+_hoverCurrentCard.dataset.id, _hoverCurrentCard.dataset.type, {
        title: _hoverCurrentCard.dataset.title,
        poster_path: _hoverCurrentCard.dataset.poster,
      });
    });
  }

  // Individual button overrides (also bubble up to the card click above)
  document.getElementById('nc-play')?.addEventListener('click', () => {
    // handled by the parent click — no separate action needed
  });
  document.getElementById('nc-more')?.addEventListener('click', () => {
    // handled by the parent click
  });
  document.getElementById('nc-wl')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!_hoverCurrentCard) return;
    const id = +_hoverCurrentCard.dataset.id;
    const type = _hoverCurrentCard.dataset.type;
    handleWatchlist(id, type, null, buildItemMeta(id, type));
    const icon = document.querySelector('#nc-wl .material-icons-round');
    if (icon) icon.textContent = isInWatchlist(id) ? 'check' : 'add';
  });
  document.getElementById('nc-like')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!_hoverCurrentCard) return;
    const id = +_hoverCurrentCard.dataset.id;
    const type = _hoverCurrentCard.dataset.type;
    handleLike(id, type, null, buildItemMeta(id, type));
    const icon = document.querySelector('#nc-like .material-icons-round');
    if (icon) icon.textContent = isLiked(id) ? 'thumb_up' : 'thumb_up_off_alt';
  });
}

function clearHoverTrailer() {
  clearTimeout(_hoverTimer);
  _hoverTimer = null;
  _hoverActive = false;
  _hoverCurrentCard = null;
  _hoverCurrentId = null;
  const nc = document.getElementById('netflix-card');
  if (nc) nc.classList.remove('visible');
  setTimeout(() => {
    if (!_hoverActive) {
      const frame = document.getElementById('nc-frame');
      if (frame) frame.removeAttribute('src');
    }
  }, 300);
}

async function showNetflixCard(card) {
  if (!_hoverActive) return;
  const id = +card.dataset.id;
  const type = card.dataset.type;
  if (!id || isNaN(id) || !type) return; // guard against broken cards
  _hoverCurrentId = id;

  const nc = document.getElementById('netflix-card');
  if (!nc) return;

  // Fill info from card data immediately
  const title = card.dataset.title || '';
  const year = card.dataset.year || '';
  const rating = card.dataset.rating || '';
  const poster = card.dataset.poster || '';
  const typeLabel = type === 'anime' ? 'Anime' : type === 'tv' ? 'TV Show' : 'Film';

  const titleEl = document.getElementById('nc-title');
  const typePill = document.getElementById('nc-type-pill');
  const metaEl = document.getElementById('nc-meta');
  const genresEl = document.getElementById('nc-genres');
  const backdrop = document.getElementById('nc-backdrop');
  const frame = document.getElementById('nc-frame');
  const likeIcon = document.querySelector('#nc-like .material-icons-round');
  const wlIcon = document.querySelector('#nc-wl .material-icons-round');

  if (titleEl) titleEl.textContent = title;
  if (typePill) typePill.textContent = typeLabel;
  if (metaEl) {
    const rVal = parseFloat(rating);
    const rColor = rVal >= 9 ? '#22c55e' : rVal >= 7 ? '#f5c518' : rVal >= 5 ? '#f97316' : rVal > 0 ? '#f87171' : '';
    metaEl.innerHTML = [
      year ? `<span class="nc-year">${year}</span>` : '',
      rating ? `<span class="nc-rating" style="color:${rColor}">★ ${rating}</span>` : '',
    ].filter(Boolean).join('');
  }
  if (backdrop) {
    const backdropPath = card.dataset.backdrop;
    if (backdropPath) {
      backdrop.src = `https://image.tmdb.org/t/p/w500${backdropPath}`;
      backdrop.style.display = '';
    } else if (poster) {
      backdrop.src = poster;
      backdrop.style.display = '';
    } else {
      backdrop.style.display = 'none';
    }
  }
  if (likeIcon) likeIcon.textContent = isLiked(id) ? 'thumb_up' : 'thumb_up_off_alt';
  if (wlIcon) wlIcon.textContent = isInWatchlist(id) ? 'check' : 'add';
  if (genresEl) genresEl.innerHTML = '<span class="nc-genre-chip nc-loading">Loading…</span>';
  if (metaEl) {
    const rVal = parseFloat(rating);
    const rColor = rVal >= 9 ? '#22c55e' : rVal >= 7 ? '#f5c518' : rVal >= 5 ? '#f97316' : rVal > 0 ? '#f87171' : '';
    metaEl.innerHTML = [
      year ? `<span class="nc-year">${year}</span>` : '',
      rating ? `<span class="nc-rating" style="color:${rColor}">★ ${rating}</span>` : '',
    ].filter(Boolean).join('');
  }

  // Position and show immediately with backdrop
  positionNetflixCard(card, nc);
  nc.classList.add('visible');

  // Fetch rich metadata in parallel
  const [trailerKey, details] = await Promise.all([
    fetchTrailerKey(id, type),
    _genreCache.has(id) ? Promise.resolve(_genreCache.get(id)) : fetchRichDetails(id, type),
  ]);

  if (!_hoverActive || _hoverCurrentCard !== card) return;

  // Update rich metadata
  if (details) {
    const genres = details.genres || [];
    const runtime = details.runtime || details.episode_run_time?.[0];
    const seasons = details.number_of_seasons;
    const certification = details._cert || '';

    // Genres
    if (genresEl && genres.length) {
      genresEl.innerHTML = genres.slice(0, 3).map(g =>
        `<span class="nc-genre-chip">${esc(g)}</span>`
      ).join('<span class="nc-dot">·</span>');
    } else if (genresEl) {
      genresEl.innerHTML = '';
    }

    // Enhanced meta: runtime / seasons / certification
    const extraMeta = [];
    if (runtime) {
      const h = Math.floor(runtime / 60);
      const m = runtime % 60;
      extraMeta.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    if (seasons > 1) extraMeta.push(`${seasons} Seasons`);
    else if (seasons === 1) extraMeta.push('1 Season');
    if (certification) extraMeta.push(`<span class="nc-cert">${esc(certification)}</span>`);

    if (metaEl && extraMeta.length) {
      metaEl.innerHTML += extraMeta.map(m => `<span class="nc-extra">${m}</span>`).join('');
    }
  } else if (genresEl) {
    genresEl.innerHTML = '';
  }

  // Load trailer — backdrop stays as fallback if trailer fails (Error 153 etc)
  if (frame && trailerKey && trailerKey !== '__none__') {
    // Try standard youtube.com embed (nocookie can trigger more 153 errors for some videos)
    frame.src = `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`;
    // Fade out backdrop when trailer loads
    frame.onload = () => { if (backdrop) backdrop.style.opacity = '0'; };
    // If trailer fails (Error 153 etc), keep backdrop visible
    frame.onerror = () => { if (backdrop) backdrop.style.opacity = '1'; };
    // Timeout fallback: if iframe didn't load after 4s, keep backdrop
    setTimeout(() => {
      if (backdrop && backdrop.style.opacity !== '0') backdrop.style.opacity = '1';
    }, 4000);
  }
}

function positionNetflixCard(card, nc) {
  const rect = card.getBoundingClientRect();
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const ncW = 420;
  const ncH = 400; // approximate full card height

  // Center horizontally on card, expanding outward from card center
  let left = rect.left + (rect.width / 2) - (ncW / 2);

  // If card is near left edge, push the card right instead of going off-screen
  if (left < 8) left = 8;
  // If card is near right edge, push left
  if (left + ncW > vpW - 8) left = vpW - ncW - 8;

  // Vertically: expand upward from near card top, covering the card
  let top = rect.top - 20;
  // Not enough room above? Show below the card
  if (top < 70) top = rect.bottom + 8;
  // Don't go off bottom
  if (top + ncH > vpH - 8) top = Math.max(70, vpH - ncH - 8);

  nc.style.left = `${left}px`;
  nc.style.top = `${top}px`;
}

async function fetchTrailerKey(id, type) {
  let key = _hoverTrailerCache.get(id);
  if (key) return key;
  try {
    const endpoint = type === 'anime' ? `tv/${id}` : `${type}/${id}`;
    const data = await tmdb(`/${endpoint}/videos`);
    const vids = data.results || [];
    const vid = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
                vids.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                vids.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
                vids.find(v => v.site === 'YouTube');
    key = vid?.key || '__none__';
  } catch {
    key = '__none__';
  }
  _hoverTrailerCache.set(id, key);
  return key;
}

const _genreCache = new Map();

async function fetchRichDetails(id, type) {
  if (_genreCache.has(id)) return _genreCache.get(id);
  try {
    const endpoint = type === 'anime' ? `tv/${id}` : `${type}/${id}`;
    const data = await tmdb(`/${endpoint}`, { append_to_response: 'release_dates,content_ratings' });
    const genres = (data.genres || []).map(g => g.name).filter(Boolean);

    // Get US certification
    let cert = '';
    if (type === 'movie') {
      const usRelease = (data.release_dates?.results || []).find(r => r.iso_3166_1 === 'US');
      cert = usRelease?.release_dates?.[0]?.certification || '';
    } else {
      const usRating = (data.content_ratings?.results || []).find(r => r.iso_3166_1 === 'US');
      cert = usRating?.rating || '';
    }

    const rich = {
      genres,
      runtime: data.runtime || data.episode_run_time?.[0] || null,
      number_of_seasons: data.number_of_seasons || null,
      _cert: cert,
    };
    _genreCache.set(id, rich);
    return rich;
  } catch {
    return null;
  }
}

async function fetchGenreNames(id, type) {
  const rich = await fetchRichDetails(id, type);
  return rich?.genres || [];
}

/* ── COLLAPSIBLE MODAL SIDEBARS ──────────────────────────────────── */
function initModalPanelToggles() {
  document.getElementById('left-panel-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('modal-left-panel');
    const btn = document.getElementById('left-panel-toggle');
    if (!panel) return;
    const collapsed = panel.classList.toggle('panel-collapsed');
    btn?.classList.toggle('panel-toggle-active', collapsed);
    if (btn) btn.title = collapsed ? 'Show info panel' : 'Hide info panel';
  });

  document.getElementById('right-panel-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('modal-right-panel');
    const btn = document.getElementById('right-panel-toggle');
    if (!panel) return;
    const collapsed = panel.classList.toggle('panel-collapsed');
    btn?.classList.toggle('panel-toggle-active', collapsed);
    if (btn) btn.title = collapsed ? 'Show episodes panel' : 'Hide episodes panel';
  });
}

/* ── KEYBOARD ────────────────────────────────────────────────────── */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select')) return;

    // Escape closes modal
    if (e.key === 'Escape') { closeModal(); return; }

    // / opens search
    if (e.key === '/') {
      e.preventDefault();
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 150);
      return;
    }

    // ? opens shortcuts
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }

    // WASD / Arrow keys — hero navigation and row scrolling
    const modalOpen = document.getElementById('modal-overlay')?.classList.contains('open');
    if (modalOpen) return;

    // Number keys 1-6 navigate pages
    const pageKeys = { '1': 'home', '2': 'movies', '3': 'tv', '4': 'anime', '5': 'library', '6': 'prefs' };
    if (pageKeys[e.key]) { goPage(pageKeys[e.key]); return; }

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      jumpHero((state.heroIdx - 1 + state.heroItems.length) % state.heroItems.length);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      jumpHero((state.heroIdx + 1) % state.heroItems.length);
    } else if (e.key === 't' || e.key === 'T') {
      cycleTheme();
    } else if (e.key === 'h' || e.key === 'H') {
      goPage('home');
    } else if (e.key === 'l' || e.key === 'L') {
      goPage('library');
    } else if (e.key === 's' || e.key === 'S') {
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    } else if (e.key === 'n' || e.key === 'N') {
      if (state.currentMedia) {
        const { useId, id, type } = state.currentMedia;
        const sel = document.getElementById('season-sel');
        const s = sel ? +sel.value : 1;
        const ep = document.querySelector('.ep-card.on');
        const next = nextProvider(useId || id, type, s, ep ? +ep.dataset.ep : 1);
        toast(`Switched to ${next.label}`, 'swap_horiz');
      }
    } else if (e.key === 'i' || e.key === 'I') {
      document.getElementById('left-panel-toggle')?.click();
    }
  });
}
