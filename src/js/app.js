import './adblock.js';
import { injectOverlays } from './templates.js';
import { injectPages } from './pages.js';
import { state, persist, GENRES, AGE_LEVELS, ALL_RATINGS, addRecentlyViewed, saveContinue, getContinue, isLiked, isInWatchlist, isDisliked, isWatched, toggleLike, toggleWatchlist, toggleWatched, addDislike, recordImpression, isValidItem, cleanState, isTagLiked, isTagDisliked, toggleTagLike, toggleTagDislike } from './state.js';
import { tmdb, aniQuery, imgUrl, normalizeAnime, fetchAnimeDetails, getContentRating, clearCachePattern,
  fetchOMDb, fetchFanart, getFanartLogo, fetchWatchmode, fetchWikipediaSummary, getWikidataId,
  fetchWikidata, fetchJikan, testAllAPIs, OMDB_KEY, FANART_KEY, WATCHMODE_KEY, STREAMING_SERVICES,
  getProviderLogoUrl, LOGO_DEV_TOKEN, PROVIDER_LOGO_DOMAINS, TASTEDIVE_KEY,
  fetchTvApiBoxOffice,
  wikidataSPARQL, getFilmAwards,
  fetchVidsrcLatestMovies, fetchVidsrcLatestShows, fetchVidsrcLatestEpisodes, getVidsrcEmbedUrl,
  fetchTasteDive, TVAPI_KEY2, fetchBestBackdrop } from './api.js';
import { goPage, registerLoader, goSeeAll, registerSeeAll, PAGE_LOADERS } from './router.js';
import { buildProviderBar, loadPlayer, nextProvider, cancelProviderTimer, getActiveProvider, setActiveProvider, PROVIDERS, cycleSandboxForce, getSandboxForce } from './player.js';
import { toast, makeCard, renderRow, skelCards, showHero, buildHeroDots, jumpHero, resetModal, renderModalInfo, renderModalActions, renderCast, renderRelated, scrollRow, buildGenreChips, emptyState, esc, hideSection, showSection, showConfirm, showChoice } from './ui.js';
import { loadForYou, loadBecauseYouLiked, loadGenreRow, loadGenreTrending, loadDeepCuts, loadHistoryMix, loadBecauseYouWatched } from './recommendations.js';
import { initSearch, loadSearchDefault, loadEverything, doSearch, searchTmdbAutocomplete, buildSearchFilters, rotateTip, setProviderFilter } from './search.js';
import { renderLibrary, renderSeeAll, loadMoreSeeAll, clearSection, clearAllData } from './library.js';
import { initProfiles, getProfiles, createProfile, switchProfile, getActiveProfileId, updateProfile, deleteProfile, MAX_PROFILES } from './profiles.js';

/* ── THEMES ──────────────────────────────────────────────────────── */
const THEMES = ['dark', 'midnight', 'ocean', 'warm', 'light'];
const THEME_ICONS = { dark: 'dark_mode', midnight: 'nights_stay', ocean: 'water', warm: 'wb_sunny', light: 'light_mode' };

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

// Theme dropdown — shows all themes by name instead of blind cycling
function toggleThemeMenu() {
  const existing = document.getElementById('theme-menu');
  if (existing) { existing.remove(); return; }
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const cur = document.documentElement.dataset.theme || 'dark';
  const menu = document.createElement('div');
  menu.id = 'theme-menu';
  menu.className = 'hdr-drop-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = THEMES.map(t => `
    <button class="hdr-drop-item${t === cur ? ' on' : ''}" data-theme-pick="${t}" role="menuitem">
      <span class="material-icons-round">${THEME_ICONS[t] || 'palette'}</span>
      ${t.charAt(0).toUpperCase() + t.slice(1)}
      ${t === cur ? '<span class="material-icons-round hdr-drop-check">check</span>' : ''}
    </button>`).join('');
  menu.addEventListener('click', e => {
    const pick = e.target.closest('[data-theme-pick]');
    if (pick) { applyTheme(pick.dataset.themePick); menu.remove(); }
  });
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.top = `${r.bottom + 8}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  // Close on outside click / Escape
  setTimeout(() => {
    const close = e => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'click' && menu.contains(e.target)) return;
      menu.remove();
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
  }, 0);
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
      <p><strong>OMDb API:</strong> Ratings (IMDb, Rotten Tomatoes, Metacritic) from OMDb. See <a href="https://www.omdbapi.com/" target="_blank" rel="noopener">omdbapi.com</a>.</p>
      <p><strong>Fanart.tv:</strong> Artwork and logos from fanart.tv. See <a href="https://fanart.tv/" target="_blank" rel="noopener">fanart.tv</a>.</p>
      <p><strong>Watchmode:</strong> Streaming availability data from watchmode. See <a href="https://api.watchmode.com/" target="_blank" rel="noopener">api.watchmode.com</a>.</p>
      <p><strong>Wikidata / Wikipedia:</strong> Biographical and encyclopedic data from Wikidata (wikidata.org) and Wikipedia (wikipedia.org), both published under open licenses.</p>
      <p><strong>Jikan (MyAnimeList):</strong> Anime metadata via the unofficial MyAnimeList API at jikan.moe.</p>
      <p><strong>TV-API.com:</strong> Trailers and awards data from tv-api.com (IMDB-API). See <a href="https://tv-api.com/" target="_blank" rel="noopener">tv-api.com</a>.</p>
      <p><strong>Dailymotion:</strong> Trailer fallback videos from Dailymotion. See <a href="https://www.dailymotion.com/legal" target="_blank" rel="noopener">Dailymotion Privacy</a>.</p>
      <p><strong>Logo.dev:</strong> Brand logos from logo.dev. See <a href="https://logo.dev/" target="_blank" rel="noopener">logo.dev</a>.</p>
      <p><strong>Video Embed Providers:</strong> VidSrc, Cineby, VidLink, 2Embed, SuperEmbed, VidSrc Pro, AutoEmbed, and Videasy operate independently. When you load a video, their servers receive your IP address and browser information as part of standard HTTP requests. StaticVault931 has no control over their data practices.</p>
      <p><strong>Vidsrc-embed.ru:</strong> We use vidsrc-embed.ru for content embed URLs and recently-added feeds. See their terms at <a href="https://vidsrc-embed.ru" target="_blank" rel="noopener">vidsrc-embed.ru</a>.</p>
      <p><strong>TasteDive:</strong> Recommendation data from tastedive.com. See <a href="https://tastedive.com/read/privacy" target="_blank" rel="noopener">TasteDive Privacy</a>.</p>
      <h3>4. Cookies & Tracking</h3>
      <p>Embed providers may set cookies in the iframe context. Our ad-blocking layer attempts to restrict ad-network trackers, but cannot guarantee complete coverage.</p>
      <h3>5. Analytics</h3>
      <p>StaticVault931 uses <strong>Google Analytics 4 (GA4)</strong> to understand aggregate usage patterns (pageviews, session counts, general regions). This helps us improve the site. Google Analytics sets cookies in your browser. You can opt out using <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics Opt-out Browser Add-on</a>. We do not use any other analytics platform (Mixpanel, Amplitude, etc.).</p>
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

/* ── SETTINGS (must be before init IIFE to avoid TDZ) ───────────── */
const SV_SETTINGS = [
  // Playback
  { id: 'showHoverTrailer',  label: 'Hover Trailers',         desc: 'Preview trailers when hovering cards for 1s',                default: true,  icon: 'play_circle',      group: 'Playback' },
  { id: 'autoNextProvider',  label: 'Auto-Switch Source',     desc: 'Try next source automatically if current one fails',          default: true,  icon: 'swap_horiz',       group: 'Playback' },
  { id: 'disableSandbox',    label: 'Disable Player Sandbox', desc: 'Some providers need sandbox disabled. May allow more ads.',   default: false, icon: 'security',         group: 'Playback' },
  // Display
  { id: 'showRatings',       label: 'Show Ratings',           desc: 'Display star ratings on content cards',                       default: true,  icon: 'star',             group: 'Display' },
  { id: 'useTitleLogos',     label: 'Title Treatment Images', desc: 'Show Netflix-style title logo images on cards instead of text (lazy-loads from TMDB)', default: true, icon: 'title', group: 'Display' },
  { id: 'compactMode',       label: 'Compact Grid Mode',      desc: 'Show content as a grid (no horizontal scroll)',               default: false, icon: 'grid_view',        group: 'Display' },
  { id: 'streamMode',        label: 'Stream Mode',            desc: 'All content in one mixed grid, no titles, no duplicates',     default: false, icon: 'stream',           group: 'Display' },
  { id: 'showProgressBar',   label: 'Progress Bars',          desc: 'Watch progress on Continue Watching cards',                   default: false, icon: 'linear_scale',     group: 'Display' },
  { id: 'darkPlayer',        label: 'Dark Player BG',         desc: 'Show dark background behind the player iframe',               default: true,  icon: 'dark_mode',        group: 'Display' },
  // Content
  { id: 'personalizeContent', label: 'Personalized Feed',     desc: 'Tailor rows to your genres, likes, and viewing habits',       default: true,  icon: 'auto_awesome',     group: 'Content' },
  { id: 'disableAgeFilter',  label: 'Unlock All Content',     desc: 'Show all ratings regardless of age filter',                   default: false, icon: 'no_adult_content', group: 'Content' },
  { id: 'repeatContent',     label: 'Repeat Tolerance',       desc: 'How often to re-show content you\'ve already seen',           default: 'medium', icon: 'repeat',        group: 'Content', type: 'select', options: ['minimum','medium','maximum'], optLabels: ['Show freely','Balanced (default)','Rarely repeat'] },
  { id: 'wideInfo',          label: 'Wide Info Page',         desc: 'Use full screen width for info page',                         default: true,  icon: 'open_in_full',     group: 'Content' },
  { id: 'defaultInfoMode',   label: 'Info Page by Default',   desc: 'Open full info screen instead of player',                     default: false, icon: 'info',             group: 'Content' },
  // Performance
  { id: 'motionLevel',       label: 'Animation Level',         desc: 'Control how much animation the site uses',                   default: 'default', icon: 'motion_photos_off', group: 'Performance', type: 'slider3', options: ['none','minimal','default'], optLabels: ['None','Minimal','Default'] },
  { id: 'hdFirst',           label: 'Prefer HD Sources',      desc: 'Prioritize sources with 4K/HD content (Cineby, VidLink)',     default: true,  icon: 'hd',               group: 'Performance' },
  { id: 'skipRecap',         label: 'Skip Intros',            desc: 'Remember to skip intro/recap (manual reminder)',               default: false, icon: 'skip_next',        group: 'Performance' },
  // Account
  { id: 'showAccountsOnStart', label: 'Show Profiles on Start', desc: 'Show profile selector every time you open the app',            default: false, icon: 'manage_accounts',  group: 'Account' },
  // Content filtering
  { id: 'hideAnime',  label: 'Hide Anime Everywhere',   desc: 'Remove anime from home feed and search (still available in Anime tab)', default: false, icon: 'block', group: 'Content' },
  { id: 'hideTabClips',   label: 'Hide Clips Tab',       desc: 'Remove the Clips tab from the navigation bar',                           default: false, icon: 'hide_source', group: 'Content' },
  { id: 'hideTabAnime',   label: 'Hide Anime Tab',        desc: 'Remove the Anime tab from the navigation bar',                           default: false, icon: 'hide_source', group: 'Content' },
  // Playback — hover trailers
  { id: 'automuteHoverTrailer', label: 'Automute Hover Trailers', desc: 'Mute hover card trailers by default (can unmute in the card)', default: false, icon: 'volume_off', group: 'Playback' },
  // Mobile-only (shown only on small screens)
  { id: 'mobileHideHeader', label: 'Auto-Hide Top Bar',  desc: 'Hide the top bar when scrolling down for extra screen space — swipe up to bring it back', default: true,  icon: 'swipe_up',   group: 'Mobile', mobileOnly: true },
  { id: 'mobileIconNav',    label: 'Compact Bottom Nav', desc: 'Icons only in the bottom navigation — smaller and cleaner',                                default: false, icon: 'apps',       group: 'Mobile', mobileOnly: true },
  // Apple-only: frosted glass surfaces (backdrop-filter is fast on Apple GPUs)
  { id: 'glassEffects',     label: 'Liquid Glass',       desc: 'Frosted-glass translucency on the top bar, menus, and overlays',                            default: true,  icon: 'blur_on',    group: 'Display', appleOnly: true },
  // Info page display
  { id: 'showOMDbRatings',   label: 'Show IMDb / RT / Metacritic', desc: 'Display external ratings from IMDb, Rotten Tomatoes, and Metacritic', default: true, icon: 'star_rate', group: 'Info Page' },
  { id: 'showWhereToWatch',  label: 'Show Where to Watch',         desc: 'Show streaming availability on the info page',                          default: true, icon: 'tv',        group: 'Info Page' },
  { id: 'showKeywordTags',   label: 'Show Keywords / Tags',        desc: 'Display content tags and keywords below the cast section',               default: true, icon: 'tag',       group: 'Info Page' },
  { id: 'showAwardsBanner',  label: 'Show Awards',                 desc: 'Show awards and nominations banner on the info page',                    default: true, icon: 'emoji_events', group: 'Info Page' },
];

const PROFILE_COLORS = ["#e50914","#6366f1","#22c55e","#f59e0b","#06b6d4","#ec4899","#8b5cf6","#f97316"];

// Apple platform detection (Mac, iPhone, iPad — including iPadOS reporting as Mac)
function _isApplePlatform() {
  const p = navigator.platform || '';
  const ua = navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/.test(p) || /Mac|iPhone|iPad|iPod/.test(ua);
}

/* ── STREAM MODE STATE (must be before init IIFE to avoid TDZ) ──── */
let _streamPage = 1;
let _streamIds = new Set();
let _streamLoading = false;
let _streamObs = null;

/* ── SHORTCUTS LIST (must be before init IIFE to avoid TDZ) ─────── */
const SHORTCUTS = [
  // Navigation — left side
  { key: 'H',          desc: 'Go to Home',                   group: 'Navigation' },
  { key: 'M',          desc: 'Go to Movies',                 group: 'Navigation' },
  { key: 'V',          desc: 'Go to TV Shows',               group: 'Navigation' },
  { key: 'C',          desc: 'Go to Customize Feed',         group: 'Navigation' },
  { key: 'L',          desc: 'Go to Library',                group: 'Navigation' },
  { key: 'T / 0',      desc: 'Cycle theme',                  group: 'Navigation' },
  { key: '1–6',        desc: 'Jump to page by number',       group: 'Navigation' },
  { key: '7',          desc: 'Open search',                  group: 'Navigation' },
  { key: 'W / ↑',      desc: 'Scroll up',                    group: 'Navigation' },
  { key: 'S / ↓',      desc: 'Scroll down',                  group: 'Navigation' },
  { key: '/ or F',     desc: 'Open search',                  group: 'Navigation' },
  { key: '← / A',      desc: 'Previous hero slide',          group: 'Navigation' },
  { key: '→ / D',      desc: 'Next hero slide',              group: 'Navigation' },
  // Content
  { key: 'R',          desc: 'Refresh current page content', group: 'Content' },
  { key: 'Esc',        desc: 'Close any modal or overlay',   group: 'Content' },
  // Tips
  { key: 'I',                 desc: 'Toggle Info / Player view',              group: 'Tips' },
  { key: 'N',                 desc: 'Try next video source',                  group: 'Tips' },
  { key: 'Click cast member', desc: 'View their full filmography',            group: 'Tips' },
  { key: 'Hover card 0.9s',   desc: 'Preview trailer + quick actions',        group: 'Tips' },
  { key: 'Shift+Apply Feed',  desc: 'Refresh without leaving the page',       group: 'Tips' },
  { key: 'Shift+Share',       desc: 'Copy link directly to clipboard',        group: 'Tips' },
  { key: '?',                 desc: 'Show this shortcuts screen',             group: 'Tips' },
  // Clips
  { key: '↓ / S',      desc: 'Next clip',                    group: 'Clips' },
  { key: '↑ / W',      desc: 'Previous clip',                group: 'Clips' },
  { key: 'Space',       desc: 'Next clip',                   group: 'Clips' },
  { key: 'P',           desc: 'Watch now (open player)',      group: 'Clips' },
  { key: 'I',           desc: 'Open info page',              group: 'Clips' },
  { key: 'M',           desc: 'Toggle mute',                 group: 'Clips' },
  { key: 'L',           desc: 'Like / Unlike',               group: 'Clips' },
  { key: 'B',           desc: 'Bookmark / Watchlist',        group: 'Clips' },
  { key: 'X',           desc: 'Not Interested (hide clip)',  group: 'Clips' },
];

/* ── CARD LOGO OBSERVER (declared here so init() IIFE can access before
     the observer helpers are defined at module scope below) ─────── */
let _cardLogoObserver = null;
let _cardLogoMutObs   = null;

/* ── INIT ────────────────────────────────────────────────────────── */
(async function init() {
  // Reset provider fail states every reload so previously-broken providers can be retried
  localStorage.removeItem('sv_provider_working');

  injectOverlays();   // inject modals/overlays before anything else
  cleanState();       // remove corrupt null/empty items from all lists
  initProfiles();     // ensure at least one profile exists
  initTheme();
  applyAllSettings(); // apply persisted settings (reducedMotion, compactMode, etc.)
  applyLoadingScreenState();
  initEventDelegation();
  initKeyboard();
  initHeader();
  initHoverTrailer();
  initA11y();
  initModalPanelToggles();
  initShortcutsModal();
  initTestMode();
  initProfilesUI();
  // Show profile selector on start if setting is enabled
  if (getSetting('showAccountsOnStart')) {
    setTimeout(() => openProfilesOverlay(), 700);
  }

  buildRatingDescriptions();
  registerAllLoaders();
  registerAllSeeAll();
  initSearch();
  loadGenresUI();
  initCardLogoObserver(); // lazy-load TMDB title treatment logos when setting is on

  // Inject pages first, then start data loading in the same RAF so row elements
  // exist when loadHomeRows() tries to put skeletons in them.
  const _startSp = new URLSearchParams(location.search);
  const _isDirectWatch = _startSp.get('id') && (_startSp.get('watch') || _startSp.get('type'));

  requestAnimationFrame(() => {
    injectPages(); // create all page/row elements

    if (!_isDirectWatch) {
      loadHero().catch(() => {});
      loadHomeRows().catch(() => {});

      // Safety retry — if rows are still empty after 4s, try again
      setTimeout(() => {
        const trendRow = document.getElementById('row-trending');
        if (!trendRow?.querySelector('.card')) {
          loadHomeRows().catch(() => {});
        }
      }, 4000);

      // Force refresh feed if NOTHING loads after 12 seconds (network failure, stale state)
      setTimeout(() => {
        const hasAnyCard = document.querySelector('#page-home .card');
        if (!hasAnyCard && state.currentPage === 'home') {
          console.warn('[SV] No content loaded after 12s — forcing feed refresh');
          loadHomeRows().catch(() => {});
        }
      }, 12000);
    }
  });

  // Idle cache warming — refresh cache silently when browser is idle
  // so next visit is always instant
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      const rowKeys = Object.keys(localStorage).filter(k => k.startsWith('sv_row_'));
      if (!rowKeys.length) return; // No cache to warm
      const entries = rowKeys.map(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }).filter(Boolean);
      if (!entries.length) return;
      const oldest = Math.min(...entries.map(e => e.ts || 0));
      // If cache is > 12 min old, silently refresh it
      if (Date.now() - oldest > 12 * 60 * 1000) {
        _loadHomeRowsFresh(false).catch(() => {});
      }
    }, { timeout: 8000 });
  }

  // URL param deep-link — supports ?watch=type&name=slug&id=X, ?id=X&type=Y, ?page=X
  const sp = new URLSearchParams(location.search);
  const watchId = sp.get('id');
  const watchType = sp.get('watch') || sp.get('type');
  const watchStart = sp.get('start') ? parseInt(sp.get('start')) : null;
  const pageParam = sp.get('page');
  const searchParam = sp.get('search');
  const modeParam = sp.get('mode');

  // Validate URL params — only redirect to 404 if CLEARLY broken, not just missing optional parts
  const _is404 = () => {
    // Has ?watch= but it's not a valid content type
    const rawWatch = sp.get('watch');
    if (rawWatch && !['movie','tv','anime'].includes(rawWatch)) return true;
    // Has ?id= but it's not a valid number (NaN, empty, text)
    if (watchId && (isNaN(+watchId) || +watchId <= 0)) return true;
    // Has ?page= but it's not a known page
    if (pageParam && !['home','movies','tv','anime','search','library','prefs','seeall','provider'].includes(pageParam)) return true;
    // Has no useful params but also has garbage (avoid 404ing clean URLs)
    return false;
  };

  if (_is404() && !location.pathname.includes('404')) {
    location.replace('/404.html' + location.search);
    return; // stop init
  }

  if (watchId && watchType) {
    document.getElementById('loading-screen')?.classList.add('out');
    setTimeout(async () => {
      // Attempt to load — if it fails (content not found), navigate to 404
      const numId = +watchId;
      if (isNaN(numId) || numId <= 0) { location.replace('/404.html'); return; }
      try {
        if (modeParam === 'info') {
          await openInfoPage(numId, watchType);
        } else {
          await openMedia(numId, watchType);
          if (watchStart) handleWatchTogetherLink(watchStart);
        }
      } catch (err) {
        // Content failed to load (invalid ID, network error, etc.)
        console.warn('[SV] Content not found:', err?.message);
        // Don't 404 on network errors — only 404 on "not found" responses
        if (err?.message?.includes('404')) {
          location.replace('/404.html');
        }
        // Otherwise just stay on home page
      }
    }, 400);
  } else if (pageParam === 'provider' && sp.get('id') && sp.get('name')) {
    const pid = +sp.get('id');
    const pname = decodeURIComponent(sp.get('name'));
    if (pid > 0) setTimeout(() => openProviderPage(pid, pname), 200);
  } else if (pageParam) {
    setTimeout(() => goPage(pageParam), 100);
  } else if (searchParam) {
    const _triggerSearch = (attempts = 0) => {
      goPage('search');
      const inp = document.getElementById('search-input');
      if (inp) {
        inp.value = decodeURIComponent(searchParam.replace(/\+/g, ' '));
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        // Update URL to reflect the search without query param (avoids infinite reload)
        history.replaceState({ page: 'search' }, '', location.pathname + '?page=search');
      } else if (attempts < 8) {
        setTimeout(() => _triggerSearch(attempts + 1), 200);
      }
    };
    setTimeout(() => _triggerSearch(), 300);
  } else if (sp.get('person')) {
    const personId = +sp.get('person');
    if (personId > 0) {
      document.getElementById('loading-screen')?.classList.add('out');
      setTimeout(() => openPersonPage(personId), 400);
    }
  }

  // Handle browser back/forward
  window.addEventListener('popstate', e => {
    if (e.state?.mode === 'info' && e.state?.id) {
      openInfoPage(e.state.id, e.state.type);
    } else if (e.state?.id && e.state?.type) {
      openMedia(e.state.id, e.state.type);
    } else if (e.state?.personId) {
      openPersonPage(e.state.personId);
    } else if (e.state?.page) {
      goPage(e.state.page);
    } else {
      closeModal();
      closeInfoPage();
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
  registerLoader('home', () => {
    renderContinueRow();
    renderRecentRow();
    // Advance hero image when navigating back to home
    if (state.heroItems?.length) {
      const next = (state.heroIdx + 1) % state.heroItems.length;
      showHero(next);
      clearInterval(state.heroTimer);
      state.heroTimer = setInterval(() => showHero((state.heroIdx + 1) % state.heroItems.length), 8000);
    }
    const trendRow = document.getElementById('row-trending');
    if (!trendRow || !trendRow.querySelector('.card')) {
      loadHomeRows().catch(() => {});
    }
  });
  registerLoader('movies', loadMoviesPage);
  registerLoader('tv', loadTvPage);
  registerLoader('anime', loadAnimePage);
  registerLoader('search', () => {
    loadSearchDefault();
    rotateTip(); // show a helpful tip in the placeholder
    buildSearchFilters(document.getElementById('sf-advanced-wrap'));
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    // Rotate tips every 4s while placeholder is empty
    clearInterval(window._tipInterval);
    window._tipInterval = setInterval(() => {
      const inp = document.getElementById('search-input');
      if (!inp?.value) rotateTip();
    }, 4000);
  });

  // Advanced filters toggle
  document.getElementById('sf-advanced-toggle')?.addEventListener('click', function() {
    const wrap = document.getElementById('sf-advanced-wrap');
    if (!wrap) return;
    const open = wrap.style.display !== 'none';
    wrap.style.display = open ? 'none' : '';
    this.classList.toggle('on', !open);
    if (!open) buildSearchFilters(wrap);
  });

  // Search shuffle/mix button — show random popular content
  document.getElementById('sf-shuffle-btn')?.addEventListener('click', async () => {
    const area = document.getElementById('search-results-area');
    if (!area) return;
    area.innerHTML = `<div class="search-spinner"><div class="spin"></div></div>`;
    try {
      const page = Math.floor(Math.random() * 8) + 1;
      const [movies, shows] = await Promise.allSettled([
        tmdb('/discover/movie', { sort_by: 'popularity.desc', page }),
        tmdb('/discover/tv', { sort_by: 'popularity.desc', page }),
      ]);
      const m = movies.status === 'fulfilled' ? (movies.value.results || []).map(x => ({ ...x, _type: 'movie' })) : [];
      const s = shows.status === 'fulfilled' ? (shows.value.results || []).map(x => ({ ...x, _type: 'tv' })) : [];
      const all = [...m, ...s].sort(() => Math.random() - 0.5).slice(0, 24);
      area.innerHTML = `
        <div class="search-section-title"><span class="material-icons-round">shuffle</span>Random Mix</div>
        <div class="search-grid">${all.map(m => makeCard(m, m._type)).join('')}</div>`;
    } catch {
      area.innerHTML = '<div class="search-empty"><p>Could not load.</p></div>';
    }
  });
  registerLoader('library', renderLibrary);
  registerLoader('prefs', loadPrefsPage);

  document.getElementById('sv-reset-settings-btn')?.addEventListener('click', async () => {
    if (await showConfirm('Reset Settings', 'Reset all Display & Player settings to defaults?')) {
      localStorage.removeItem('sv_settings');
      applyAllSettings();
      buildSettingsUI();
      toast('Settings reset to defaults', 'restart_alt');
    }
  });

  document.getElementById('sv-reset-impressions-btn')?.addEventListener('click', async () => {
    if (await showConfirm('Reset Content History', 'Clear all impression data? You may start seeing previously-hidden content again.')) {
      state.impressions = {};
      persist('impressions');
      _clearRowCache();
      toast('Content history cleared — feed refreshing…', 'refresh');
      setTimeout(() => loadHomeRows().catch(() => {}), 300);
    }
  });
  registerLoader('seeall', renderSeeAll);
  registerLoader('clips', initTrailersFeed);
}

function registerAllSeeAll() {
  const tagTv = d => ({ ...d, results: (d.results || []).map(m => ({ ...m, media_type: m.media_type || 'tv' })) });

  // Movie see-alls
  registerSeeAll('trending',        p => tmdb('/trending/all/week', { page: p }));
  registerSeeAll('movies-popular',  p => tmdb('/movie/popular',   { page: p }));
  registerSeeAll('movies-top',      p => tmdb('/movie/top_rated', { page: p }));
  registerSeeAll('movies-new',      p => tmdb('/movie/now_playing', { page: p }));
  registerSeeAll('movies-upcoming', p => tmdb('/movie/upcoming',  { page: p }));
  registerSeeAll('movies-2024',     p => tmdb('/discover/movie',  { primary_release_year: new Date().getFullYear() - 1, sort_by: 'popularity.desc', page: p }));
  registerSeeAll('movies-2010s',    p => tmdb('/discover/movie',  { 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31', sort_by: 'vote_average.desc', 'vote_count.gte': 300, page: p }));
  registerSeeAll('movies-foreign',  p => tmdb('/discover/movie',  { without_original_language: 'en', sort_by: 'vote_average.desc', 'vote_count.gte': 200, page: p }));

  // TV see-alls — tag each item with media_type:'tv' so they open as TV titles
  registerSeeAll('tv-popular',  p => tmdb('/tv/popular',     { page: p }).then(tagTv));
  registerSeeAll('tv-top',      p => tmdb('/tv/top_rated',   { page: p }).then(tagTv));
  registerSeeAll('tv-airing',   p => tmdb('/tv/airing_today', { page: p }).then(tagTv));
  registerSeeAll('tv-scifi',    p => tmdb('/discover/tv', { with_genres: '10765', sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-thriller', p => tmdb('/discover/tv', { with_genres: '53',    sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-kdrama',   p => tmdb('/discover/tv', { with_original_language: 'ko', sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-mystery',  p => tmdb('/discover/tv', { with_genres: '9648',  sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-reality',  p => tmdb('/discover/tv', { with_genres: '10764', sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-animated', p => tmdb('/discover/tv', { with_genres: '16',    sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-limited',  p => tmdb('/discover/tv', { with_type: '3',       sort_by: 'vote_average.desc', 'vote_count.gte': 50, page: p }).then(tagTv));
  registerSeeAll('tv-comedy',   p => tmdb('/discover/tv', { with_genres: '35',    sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-family',   p => tmdb('/discover/tv', { with_genres: '10751', sort_by: 'popularity.desc', page: p }).then(tagTv));
  // genre-35-tv is the Comedy TV see-all key used in pages.js
  registerSeeAll('genre-35-tv', p => tmdb('/discover/tv', { with_genres: '35',    sort_by: 'popularity.desc', page: p }).then(tagTv));
  registerSeeAll('tv-crime',    p => tmdb('/discover/tv', { with_genres: '80',    sort_by: 'popularity.desc', page: p }).then(tagTv));

  // Anime see-alls via AniList
  const AQ = (sort, extra = {}) => p => {
    const vars = { sort, p, ...extra };
    return aniQuery(
      `query($p:Int,$sort:[MediaSort],$status:MediaStatus,$genre:String,$format:MediaFormat){Page(page:$p,perPage:20){media(type:ANIME,sort:$sort,status:$status,isAdult:false,genre:$genre,format:$format){id title{romaji english}coverImage{large}averageScore popularity startDate{year}}}}`,
      vars
    ).then(d => ({ results: (d?.data?.Page?.media || []).map(normalizeAnime), total_pages: 10 }));
  };
  registerSeeAll('anime-trending', AQ(['TRENDING_DESC']));
  registerSeeAll('anime-top',      AQ(['SCORE_DESC']));
  registerSeeAll('anime-airing',   AQ(['POPULARITY_DESC'], { status: 'RELEASING' }));
  registerSeeAll('anime-action',   AQ(['POPULARITY_DESC'], { genre: 'Action' }));
  registerSeeAll('anime-romance',  AQ(['POPULARITY_DESC'], { genre: 'Romance' }));
  registerSeeAll('anime-isekai',   AQ(['POPULARITY_DESC'], { genre: 'Isekai' }));
  registerSeeAll('anime-sports',   AQ(['POPULARITY_DESC'], { genre: 'Sports' }));
  registerSeeAll('anime-comedy',   AQ(['POPULARITY_DESC'], { genre: 'Comedy' }));
  registerSeeAll('anime-horror',   AQ(['SCORE_DESC'],      { genre: 'Horror' }));
  registerSeeAll('anime-mecha',    AQ(['POPULARITY_DESC'], { genre: 'Mecha' }));
  registerSeeAll('anime-movies',   AQ(['POPULARITY_DESC'], { format: 'MOVIE' }));

  // Genre see-alls (movies)
  GENRES.forEach(g => {
    registerSeeAll('genre-' + g.id, p => tmdb('/discover/movie', { with_genres: g.id, sort_by: 'popularity.desc', page: p }));
  });

  // Top list see-alls
  registerSeeAll('top-rated-movies', p => tmdb('/movie/top_rated', { 'vote_count.gte': 1000, page: p }));
  registerSeeAll('top-rated-tv',     p => tmdb('/tv/top_rated',    { 'vote_count.gte': 500,  page: p }).then(tagTv));

  // Country / region trending see-alls
  registerSeeAll('trend-jp', p => tmdb('/discover/movie', { with_original_language: 'ja', region: 'JP', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-kr', p => tmdb('/discover/movie', { with_original_language: 'ko', region: 'KR', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-gb', p => tmdb('/discover/movie', { region: 'GB', sort_by: 'popularity.desc', 'vote_count.gte': 100, page: p }));
  registerSeeAll('trend-in', p => tmdb('/discover/movie', { with_original_language: 'hi', region: 'IN', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-fr', p => tmdb('/discover/movie', { with_original_language: 'fr', region: 'FR', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-de', p => tmdb('/discover/movie', { with_original_language: 'de', region: 'DE', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-br', p => tmdb('/discover/movie', { with_original_language: 'pt', region: 'BR', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-es', p => tmdb('/discover/movie', { with_original_language: 'es', region: 'ES', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-mx', p => tmdb('/discover/movie', { with_original_language: 'es', region: 'MX', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
  registerSeeAll('trend-it', p => tmdb('/discover/movie', { with_original_language: 'it', region: 'IT', sort_by: 'popularity.desc', 'vote_count.gte': 50, page: p }));
}

/* ── HERO ────────────────────────────────────────────────────────── */
function _getHeroStartIdx(total) {
  // Rotate the start index on each page load/session
  const key = 'sv_hero_v';
  const cur = parseInt(sessionStorage.getItem(key) || '-1');
  const next = (cur + 1) % Math.max(total, 1);
  sessionStorage.setItem(key, String(next));
  return next;
}

async function loadHero(attempt = 0) {
  try {
    const [movRes, tvRes] = await Promise.allSettled([
      tmdb('/trending/movie/week'),
      tmdb('/trending/tv/week'),
    ]);
    const all = movRes.status === 'fulfilled'
      ? (movRes.value.results || []).filter(x => x.backdrop_path)
      : [];
    const tvItems = tvRes.status === 'fulfilled'
      ? (tvRes.value.results || []).filter(x => x.backdrop_path).slice(0, 3)
      : [];

    const items = [...all.slice(0, 5), ...tvItems].slice(0, 8);

    if (!items.length) {
      // No items — retry once after 3s (network hiccup), then give up
      if (attempt < 2) { setTimeout(() => loadHero(attempt + 1), 3000); return; }
      _showHeroFallback();
      return;
    }

    state.heroItems = items;
    buildHeroDots();
    const startIdx = _getHeroStartIdx(state.heroItems.length);
    showHero(startIdx);
    clearInterval(state.heroTimer);
    state.heroTimer = setInterval(() => {
      showHero((state.heroIdx + 1) % state.heroItems.length);
    }, 8000);
  } catch (err) {
    console.warn('[SV] loadHero error:', err?.message);
    if (attempt < 2) { setTimeout(() => loadHero(attempt + 1), 3000 * (attempt + 1)); return; }
    _showHeroFallback();
  }
}

function _showHeroFallback() {
  // Show a nice "explore" placeholder so the page doesn't look broken
  const titleEl = document.getElementById('hero-title');
  const descEl  = document.getElementById('hero-desc');
  const bg      = document.getElementById('hero-bg');
  if (titleEl) titleEl.textContent = 'Discover Something New';
  if (descEl)  descEl.textContent  = 'Browse movies, shows, and anime below.';
  if (bg)      bg.style.background = 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)';
}

/* ── ROW DEDUP (tracks IDs rendered per home-page load) ─────────── */
const _homeSeenIds = new Set();
const _lazyObs = new Map(); // kept for compatibility

/* ── IMPRESSION TRACKING ─────────────────────────────────────────── */
// Tracks how many times each piece of content has been shown.
// Higher impressions = lower chance of being shown again.

function recordImpressions(items) {
  if (!items?.length) return;
  const now = Date.now();
  let changed = false;
  items.forEach(m => {
    if (!m?.id) return;
    const prev = state.impressions[m.id] || { count: 0, lastSeen: 0 };
    // Reset if unseen for 7+ days
    if (now - prev.lastSeen > 7 * 24 * 3600000) {
      state.impressions[m.id] = { count: 1, lastSeen: now };
    } else {
      state.impressions[m.id] = { count: prev.count + 1, lastSeen: now };
    }
    changed = true;
  });
  if (changed) persist('impressions');
}

function shouldShow(id) {
  const tolerance = getSetting('repeatContent') || 'medium';
  const imp = state.impressions[id];
  if (!imp?.count) return true; // never shown

  const hoursSince = (Date.now() - imp.lastSeen) / 3600000;

  // Reset rule: unseen for 7 days → always show again
  if (hoursSince > 168) {
    delete state.impressions[id];
    return true;
  }

  switch (tolerance) {
    case 'maximum':
      // After 2 impressions, hide for 4 days
      return imp.count < 2 || hoursSince > 96;
    case 'medium':
      // After 6 impressions, hide for 24 hours
      return imp.count < 6 || hoursSince > 24;
    case 'minimum':
      // Only hide very heavy repeats (20+ times within 4 hours)
      return imp.count < 20 || hoursSince > 4;
    default:
      return true;
  }
}

function filterByImpressions(items) {
  // Keep at least 6 items even if all are "seen" — prevents empty rows
  const filtered = items.filter(m => m?.id && shouldShow(m.id));
  return filtered.length >= 4 ? filtered : items.slice(0, Math.max(filtered.length + 4, 8));
}

/* ── SCHEDULE ROW LOAD (defer off-screen rows to scroll trigger) ─── */
function _scheduleRowLoad(rowId, secId, fetchFn, type) {
  const sec = secId ? document.getElementById(secId) : null;
  const row = document.getElementById(rowId);
  if (!row) return;

  const target = sec || row;

  // Use IntersectionObserver with 600px rootMargin — it handles "visible now" rows
  // immediately on observe, eliminating the need for a forced getBoundingClientRect read.
  const obs = new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    _lazyObs.delete(rowId);
    _loadRow(rowId, secId, fetchFn, type);
  }, { rootMargin: '600px 0px' });

  obs.observe(target);
  _lazyObs.set(rowId, obs);
}

/* ── ROW FETCH HELPER ────────────────────────────────────────────── */
function _loadRow(rowId, secId, fetchFn, type) {
  const row = document.getElementById(rowId);
  const sec = secId ? document.getElementById(secId) : null;
  if (!row) return Promise.resolve();
  if (sec) sec.style.display = '';

  return fetchFn()
    .then(items => {
      if (!items || !items.length) {
        console.warn(`[SV Row] "${rowId}" returned 0 items — hiding section`);
        if (sec) sec.style.display = 'none'; else { const r = document.getElementById(rowId); if(r) r.innerHTML = ''; }
        return;
      }
      // Apply impression filter (hide over-shown content based on setting)
      const impressionFiltered = filterByImpressions(items);

      // Dedup: skip items already shown in rows above
      // Cross-session dedup: only filter in maximum repeat tolerance mode
      const shownData = (getSetting('repeatContent') === 'maximum') ? _getShownIds() : {};
      const deduped = impressionFiltered.filter(m => m.id && !_homeSeenIds.has(m.id) && !shownData[m.id]);
      const toRender = deduped.length >= 4 ? deduped : impressionFiltered.filter(m => m.id);
      toRender.slice(0, 14).forEach(m => _homeSeenIds.add(m.id));
      const final = toRender.slice(0, 14);
      // Ensure row is at position 0 before rendering — prevents 3px scroll drift
      const rowEl = document.getElementById(rowId);
      if (rowEl) rowEl.scrollLeft = 0;
      renderRow(rowId, final, type);
      _saveRowCache(rowId, final);
      // Record impressions for shown content (not searches, only passive browsing)
      recordImpressions(final);
      // Mark items as shown for cross-session dedup
      final.forEach(m => _markShown(m.id));
      scheduledisambiguateTitles();
    })
    .catch(err => {
      console.error(`[SV Row] "${rowId}" failed:`, err?.message || err);
      // Never leave skeletons stuck: if the row has no real cards, hide the section
      const rowEl = document.getElementById(rowId);
      const hasCards = rowEl?.querySelector('.card');
      if (!hasCards) {
        if (sec) sec.style.display = 'none';
        else if (rowEl) rowEl.innerHTML = '';
      }
    });
}

/* ── HOME ROW CACHE (stale-while-revalidate) ─────────────────────── */
const _ROW_CACHE_KEY = 'sv_home_v3'; // kept for idle cache-warming compat
const _ROW_CACHE_TTL = 25 * 60 * 1000; // 25 minutes — long enough to feel instant on return

function _saveRowCache(rowId, items) {
  try {
    localStorage.setItem(`sv_row_${rowId}`, JSON.stringify({ items, ts: Date.now() }));
  } catch {}
}

function _getRowCache(rowId) {
  try {
    const raw = localStorage.getItem(`sv_row_${rowId}`);
    if (!raw) return null;
    const { items, ts } = JSON.parse(raw);
    if (Date.now() - ts > _ROW_CACHE_TTL) { localStorage.removeItem(`sv_row_${rowId}`); return null; }
    return items;
  } catch { return null; }
}

function _clearRowCache() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('sv_row_')).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(_ROW_CACHE_KEY); // also clear legacy key
  } catch {}
}

/* ── CROSS-SESSION SHOWN ID TRACKING ────────────────────────────── */
function _getShownIds() {
  try {
    const data = JSON.parse(localStorage.getItem('sv_shown_ids') || '{}');
    const cutoff = Date.now() - 24 * 3600000; // 24 hours
    Object.keys(data).forEach(k => { if (data[k] < cutoff) delete data[k]; });
    return data;
  } catch { return {}; }
}

function _markShown(id) {
  try {
    const data = _getShownIds();
    data[id] = Date.now();
    if (Object.keys(data).length > 500) {
      const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 300);
      localStorage.setItem('sv_shown_ids', JSON.stringify(Object.fromEntries(sorted)));
    } else {
      localStorage.setItem('sv_shown_ids', JSON.stringify(data));
    }
  } catch {}
}

/* ── HOME ROWS ───────────────────────────────────────────────────── */
let _homeLoading = false; // kept for refreshFeed compat only

async function loadHomeRows() {
  _homeSeenIds.clear();
  _lazyObs.forEach(o => o.disconnect());
  _lazyObs.clear();

  const allRowIds = [
    'row-trending', 'row-foryou', 'row-continue', 'row-recent',
    'row-new', 'row-toprated', 'row-tv-pop', 'row-airing',
    'row-action', 'row-comedy', 'row-horror', 'row-drama',
    'row-scifi', 'row-animated', 'row-home-anime',
    'row-top10', 'row-boredom', 'row-new-streaming', 'row-love-these', 'row-seasonal',
    'row-awards', 'row-tv-faves', 'row-retro-tv', 'row-binge-drama',
    'row-weekend', 'row-hidden-gems', 'row-feel-good', 'row-intense',
    'row-documentary', 'row-international', 'row-teen-drama', 'row-sci-fi-tv', 'row-comfort',
    'row-discover-new',
    'row-trend-jp', 'row-trend-kr', 'row-trend-gb', 'row-trend-in', 'row-trend-fr',
    'row-trend-de', 'row-trend-br', 'row-trend-es', 'row-trend-mx', 'row-trend-it',
    'row-imdb250', 'row-best-tv-ever',
  ];

  // ── INSTANT RENDER FROM CACHE ──────────────────────────────────────
  let hadCache = false;
  allRowIds.forEach(id => {
    const cached = _getRowCache(id);
    const el = document.getElementById(id);
    if (!el) return;
    if (cached && cached.length) {
      const sec = el.closest('.section');
      if (sec) sec.style.display = '';
      const type = id.includes('anime') ? 'anime' : id.includes('tv') ? 'tv' : null;
      // Dedup against already-rendered rows to prevent same title showing twice
      const deduped = cached.filter(m => m.id && !_homeSeenIds.has(m.id));
      const toRender = id === 'row-trending' ? cached : (deduped.length >= 4 ? deduped : cached);
      toRender.forEach(m => _homeSeenIds.add(m.id));
      renderRow(id, toRender, type, id === 'row-trending');
      hadCache = true;
    } else {
      el.innerHTML = skelCards(6);
      const sec = el.closest('.section');
      if (sec) sec.style.display = '';
    }
  });

  // Local data is always instant
  renderContinueRow();
  renderRecentRow();

  // If we had cached data, refresh in background (stale-while-revalidate)
  // If not, fetch immediately (blocking on Batch 1)
  if (hadCache) {
    // Soft background refresh — don't show skeletons again
    _loadHomeRowsFresh(false);
    return;
  }

  try {

    // Local data — instant
    renderContinueRow();
    renderRecentRow();

    await _loadHomeRowsFresh(true); // blocking first load

  } catch (err) {
    console.warn('[SV] loadHomeRows error:', err?.message);
  }
}

function _moveTrendingDown() {
  // Each view: move trending 2 positions lower in the page
  // After enough views, reset to position 2 (just after For You)
  const trendSec = document.getElementById('sec-trending');
  if (!trendSec) return;
  const home = document.getElementById('page-home');
  if (!home) return;
  const sections = Array.from(home.querySelectorAll('.section:not(#sec-trending)'));
  if (sections.length < 2) return;
  const views = parseInt(sessionStorage.getItem('sv_trend_views') || '0');
  // Position: starts at 1 (second section), moves down 2 per view, max at 8, then reset to 1
  const maxPos = Math.min(8, sections.length - 1);
  const targetPos = Math.min(1 + (views * 2), maxPos);
  const anchor = sections[targetPos] || sections[sections.length - 1];
  try { home.insertBefore(trendSec, anchor.nextSibling); } catch {}
}

async function _loadHomeRowsFresh(showSkeletons = false) {
  if (showSkeletons) _homeSeenIds.clear();
  const prefG = state.prefGenres;
  const gOpts = (genreId, extra = {}) => ({
    with_genres: prefG.length ? `${genreId}|${prefG.slice(0, 2).join('|')}` : String(genreId),
    sort_by: 'popularity.desc',
    ...extra,
  });
  const rng = state._randomPage || 1;
  const animeQ = `query{Page(page:${rng},perPage:16){media(type:ANIME,sort:[TRENDING_DESC],isAdult:false){id title{romaji english}coverImage{large}averageScore popularity startDate{year}}}}`;

  if (showSkeletons) _homeSeenIds.clear();

  // Trending + For You first
  await Promise.allSettled([
    tmdb('/trending/all/week').then(d => {
      const allTrending = d.results || [];
      // Keep authentic trending order — always show top 14 (position in page changes per view, not content)
      const items = allTrending.slice(0, 14);
      items.forEach(m => _homeSeenIds.add(m.id));
      renderRow('row-trending', items, null, true);
      _saveRowCache('row-trending', items);
      // Track view count and move trending row down 2 positions each view
      const trendViews = (parseInt(sessionStorage.getItem('sv_trend_views') || '0') + 1);
      sessionStorage.setItem('sv_trend_views', String(trendViews));
      _moveTrendingDown(); // repositions trending based on view count
    }),
    loadForYou(),
  ]);

  // ── ALL remaining rows: each loads independently via IntersectionObserver ──
  // Rows near the viewport fire immediately; others wait for scroll.
  // This way each row appears at its own natural time, not all at once.
  // ── ROW POOL: pick a balanced selection each session ──────────────
  // Full pool of standard rows — pick 4-6 each session for variety
  const STD_ROW_POOL = [
    // Now Playing OR Upcoming (alternates per session)
    (() => {
      const showUpcoming = rng % 2 !== 0;
      requestAnimationFrame(() => {
        const t = document.querySelector('#sec-new .sec-title');
        if (t) t.innerHTML = `<span class="material-icons-round sec-icon">${showUpcoming ? 'upcoming' : 'fiber_new'}</span>${showUpcoming ? 'Coming Soon' : 'Now Playing'}`;
      });
      return { id:'row-new', sec:'sec-new', type:'movie',
        fn: () => tmdb(showUpcoming ? '/movie/upcoming' : '/movie/now_playing', { page: showUpcoming ? 1 : rng }).then(d => d.results || []) };
    })(),
    { id:'row-toprated',  sec:'sec-toprated',  type:'movie', fn:() => tmdb('/movie/top_rated',  { page: rng }).then(d => d.results || []) },
    { id:'row-tv-pop',    sec:'sec-tv-pop',    type:'tv',    fn:() => tmdb('/tv/popular',        { page: rng }).then(d => d.results || []) },
    { id:'row-airing',    sec:'sec-airing',    type:'tv',    fn:() => tmdb('/tv/airing_today').then(d => d.results || []) },
    { id:'row-action',    sec:'sec-action',    type:'movie', fn:() => tmdb('/discover/movie', gOpts(28)).then(d => d.results || []) },
    { id:'row-comedy',    sec:'sec-comedy',    type:'movie', fn:() => tmdb('/discover/movie', gOpts(35)).then(d => d.results || []) },
    { id:'row-horror',    sec:'sec-horror',    type:'movie', fn:() => tmdb('/discover/movie', gOpts(27)).then(d => d.results || []) },
    { id:'row-drama',     sec:'sec-drama',     type:'movie', fn:() => tmdb('/discover/movie', gOpts(18, { sort_by:'vote_average.desc','vote_count.gte':200 })).then(d => d.results || []) },
    { id:'row-scifi',     sec:'sec-scifi',     type:'movie', fn:() => tmdb('/discover/movie', gOpts(878)).then(d => d.results || []) },
    { id:'row-animated',  sec:'sec-animated',  type:'movie', fn:() => tmdb('/discover/movie', gOpts(16)).then(d => d.results || []) },
    { id:'row-home-anime',sec:'sec-home-anime',type:'anime', fn:() => aniQuery(animeQ).then(d => (d?.data?.Page?.media || []).map(normalizeAnime)) },
    { id:'row-romance',   sec:'sec-romance',   type:'movie', fn:() => tmdb('/discover/movie', { with_genres:'10749', sort_by:'popularity.desc','vote_count.gte':100, page: rng }).then(d => d.results || []) },
    { id:'row-kdrama',    sec:'sec-kdrama',    type:'tv',    fn:() => tmdb('/discover/tv', { with_original_language:'ko', sort_by:'popularity.desc', page: rng }).then(d => d.results || []) },
    { id:'row-thriller-tv',sec:'sec-thriller-tv',type:'tv', fn:() => tmdb('/discover/tv', { with_genres:'9648', sort_by:'popularity.desc', page: rng }).then(d => d.results || []) },
    { id:'row-2020s',     sec:'sec-2020s',     type:'movie', fn:() => tmdb('/discover/movie', { primary_release_date_gte:'2020-01-01', sort_by:'vote_average.desc','vote_count.gte':300, page: rng }).then(d => d.results || []) },
    { id:'row-classics',  sec:'sec-classics',  type:'movie', fn:() => tmdb('/discover/movie', { primary_release_date_lte:'1995-12-31', sort_by:'vote_average.desc','vote_count.gte':500 }).then(d => d.results || []) },
    { id:'row-family',    sec:'sec-family',    type:'movie', fn:() => tmdb('/discover/movie', { with_genres:'10751', sort_by:'popularity.desc','vote_count.gte':100, page: rng }).then(d => d.results || []) },
    { id:'row-crime-tv',  sec:'sec-crime-tv',  type:'tv',    fn:() => tmdb('/discover/tv', { with_genres:'80', sort_by:'vote_average.desc','vote_count.gte':100, page: rng }).then(d => d.results || []) },
    { id:'row-comedy-tv', sec:'sec-comedy-tv', type:'tv',    fn:() => tmdb('/discover/tv', { with_genres:'35', sort_by:'popularity.desc', page: rng }).then(d => d.results || []) },
    { id:'row-anime-home2',sec:'sec-anime-home2',type:'anime',fn:() => aniQuery(`query($g:String){Page(perPage:14){media(type:ANIME,sort:[POPULARITY_DESC],isAdult:false,genre:$g){id title{romaji english}coverImage{large}bannerImage averageScore popularity episodes status startDate{year}description(asHtml:false)}}}`, { g: ['Romance','Sports','Isekai','Fantasy','Comedy'][rng % 5] }).then(d => (d?.data?.Page?.media || []).map(normalizeAnime)) },
    // Country / Region trending rows — one picked randomly per session
    { id:'row-trend-jp', sec:'sec-trend-jp', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'ja', region:'JP', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-kr', sec:'sec-trend-kr', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'ko', region:'KR', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-gb', sec:'sec-trend-gb', type:null, fn:() => tmdb('/discover/movie', { region:'GB', sort_by:'popularity.desc', 'vote_count.gte':100, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-in', sec:'sec-trend-in', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'hi', region:'IN', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-fr', sec:'sec-trend-fr', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'fr', region:'FR', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-de', sec:'sec-trend-de', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'de', region:'DE', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-br', sec:'sec-trend-br', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'pt', region:'BR', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-es', sec:'sec-trend-es', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'es', region:'ES', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-mx', sec:'sec-trend-mx', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'es', region:'MX', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    { id:'row-trend-it', sec:'sec-trend-it', type:null, fn:() => tmdb('/discover/movie', { with_original_language:'it', region:'IT', sort_by:'popularity.desc', 'vote_count.gte':50, page: rng }).then(d => d.results||[]) },
    // Top lists
    { id:'row-imdb250',    sec:'sec-imdb250',    type:'movie', fn:() => tmdb('/movie/top_rated', { 'vote_count.gte':1000, page:1 }).then(d => d.results||[]) },
    { id:'row-best-tv-ever',sec:'sec-best-tv-ever',type:'tv', fn:() => tmdb('/tv/top_rated',    { 'vote_count.gte':500,  page:1 }).then(d => d.results||[]) },
  ];

  // Hide all pool sections by default; show only the selected ones
  const COUNTRY_ROW_IDS = ['row-trend-jp','row-trend-kr','row-trend-gb','row-trend-in','row-trend-fr','row-trend-de','row-trend-br','row-trend-es','row-trend-mx','row-trend-it'];
  const STD_ALWAYS = ['row-new', 'row-home-anime', 'row-boxoffice', 'row-recently-added', 'row-new-episodes', 'row-sequels', 'row-new-to-you', 'row-imdb250', 'row-best-tv-ever']; // always show these
  const STD_OPTIONAL = STD_ROW_POOL.filter(r => !STD_ALWAYS.includes(r.id) && !COUNTRY_ROW_IDS.includes(r.id));
  const stdSessionKey = `sv_std_sel_${Math.floor(Date.now() / (24 * 3600000))}`;
  let stdSelected = [];
  try { stdSelected = JSON.parse(sessionStorage.getItem(stdSessionKey) || '[]'); } catch {}
  if (!stdSelected.length) {
    // Pick 4 from optional, ensuring a mix of movie/tv/anime
    const byType = { movie: [], tv: [], anime: [] };
    STD_OPTIONAL.forEach(r => (byType[r.type] || byType.movie).push(r.id));
    const picks = [
      byType.movie[Math.floor(Math.random() * byType.movie.length)],
      byType.movie[Math.floor(Math.random() * byType.movie.length)],
      byType.tv[Math.floor(Math.random() * byType.tv.length)],
      byType.anime[Math.floor(Math.random() * byType.anime.length)],
    ].filter((id, i, a) => id && a.indexOf(id) === i); // deduplicate
    // Also pick 2 random country rows per session
    const countryPicks = [...COUNTRY_ROW_IDS].sort(() => Math.random() - .5).slice(0, 2);
    stdSelected = [...picks, ...countryPicks];
    sessionStorage.setItem(stdSessionKey, JSON.stringify(stdSelected));
  }
  const stdActive = new Set([...STD_ALWAYS, ...stdSelected]);

  const hideAnime = getSetting('hideAnime');
  // Show/hide sections based on selection; always hide anime rows if hideAnime is on
  STD_ROW_POOL.forEach(r => {
    const sec = document.getElementById(r.sec);
    const shouldShow = stdActive.has(r.id) && !(hideAnime && r.type === 'anime');
    if (sec) sec.style.display = shouldShow ? '' : 'none';
  });

  const rowDefs = STD_ROW_POOL.filter(r => stdActive.has(r.id))

  // Each row observes itself — visible ones load first, others load as you scroll
  rowDefs.forEach(r => _scheduleRowLoad(r.id, r.sec, r.fn, r.type));

  // ── WAVE 3: Curated rows — randomly selected, deferred to scroll ───
  const pRng = state._randomPage || 1;
  const prefGenreStr = prefG.length ? prefG.slice(0, 2).join('|') : '';

  // Top 10 — daily trending (always shown)
  _scheduleRowLoad('row-top10', 'sec-top10', () =>
    tmdb('/trending/all/day', { page: 1 }).then(d => (d.results || []).slice(0, 10)), null);

  // Recently Added Movies (from vidsrc-embed.ru)
  _scheduleRowLoad('row-recently-added', 'sec-recently-added', async () => {
    const feed = await fetchVidsrcLatestMovies(1).catch(() => null);
    if (!feed?.length) return [];
    // Feed items have tmdb_id or imdb_id — resolve via TMDB
    const items = await Promise.all(
      (feed || []).slice(0, 12).map(item => {
        if (item.tmdb_id) return tmdb(`/movie/${item.tmdb_id}`).then(d => ({...d, media_type:'movie'})).catch(() => null);
        if (item.imdb_id) return tmdb(`/find/${item.imdb_id}`, { external_source: 'imdb_id' })
          .then(d => d.movie_results?.[0] ? {...d.movie_results[0], media_type:'movie'} : null).catch(() => null);
        return null;
      })
    );
    return items.filter(Boolean);
  }, 'movie');

  // Recently Added TV Episodes (from vidsrc-embed.ru)
  _scheduleRowLoad('row-new-episodes', 'sec-new-episodes', async () => {
    const feed = await fetchVidsrcLatestEpisodes(1).catch(() => null);
    if (!feed?.length) return [];
    const seen = new Set();
    const items = await Promise.all(
      (feed || []).filter(ep => {
        if (seen.has(ep.tmdb_id || ep.imdb_id)) return false;
        seen.add(ep.tmdb_id || ep.imdb_id);
        return true;
      }).slice(0, 12).map(item => {
        if (item.tmdb_id) return tmdb(`/tv/${item.tmdb_id}`).then(d => ({...d, media_type:'tv'})).catch(() => null);
        if (item.imdb_id) return tmdb(`/find/${item.imdb_id}`, { external_source: 'imdb_id' })
          .then(d => d.tv_results?.[0] ? {...d.tv_results[0], media_type:'tv'} : null).catch(() => null);
        return null;
      })
    );
    return items.filter(Boolean);
  }, 'tv');

  // Sequels row: first 2 films from popular franchises
  _scheduleRowLoad('row-sequels', 'sec-sequels', async () => {
    // Popular franchise TMDB collection IDs
    const franchises = [10 /* Star Wars */, 131295 /* MCU */, 86311 /* Avengers */,
      9485 /* Fast & Furious */, 87359 /* Mission Impossible */, 84 /* Indiana Jones */,
      1241 /* Harry Potter */, 10194 /* Toy Story */, 404609 /* John Wick */,
      263 /* Dark Knight */, 328 /* Jurassic Park */, 1709 /* Terminator */,
      33512 /* Transformers */, 422834 /* Deadpool */, 131296 /* Thor */
    ];
    // Pick 6 random franchises per session
    const seed = state._randomPage || 1;
    const picked = [...franchises].sort((a, b) => Math.sin(seed * 2.1 + a) - Math.sin(seed * 2.1 + b)).slice(0, 7);
    const results = await Promise.allSettled(
      picked.map(colId => tmdb(`/collection/${colId}`).then(d => {
        const parts = (d.parts||[]).sort((a,b)=>(a.release_date||'')>(b.release_date||'')?1:-1);
        return parts.slice(0, 2).map(m=>({...m,media_type:'movie'}));
      }).catch(()=>[]))
    );
    const flat = results.flatMap(r => r.status==='fulfilled' ? r.value : []);
    // Interleave: film1_franchise1, film1_franchise2, film2_franchise1, film2_franchise2, ...
    return flat;
  }, 'movie');

  // Content New to You — things user hasn't seen/liked/watchlisted
  _scheduleRowLoad('row-new-to-you', 'sec-new-to-you', async () => {
    const seenIds = new Set([
      ...(state.watched||[]).map(x=>x.id),
      ...(state.liked||[]).map(x=>x.id),
      ...(state.watchlist||[]).map(x=>x.id),
      ...(state.disliked||[]).map(x=>x.id),
    ]);
    // Fetch a random page of popular content and filter to unseen items
    const rp = (state._randomPage || 1) + Math.floor(Math.random() * 3);
    const [movies, tv] = await Promise.allSettled([
      tmdb('/movie/popular', { page: rp + 2 }).then(d => d.results || []),
      tmdb('/tv/popular',    { page: rp + 1 }).then(d => d.results || []),
    ]);
    const m = movies.status==='fulfilled' ? movies.value.filter(x=>x.id&&!seenIds.has(x.id)).map(x=>({...x,media_type:'movie'})) : [];
    const t = tv.status==='fulfilled'    ? tv.value.filter(x=>x.id&&!seenIds.has(x.id)).map(x=>({...x,media_type:'tv'}))    : [];
    const combined = [];
    for (let i=0; i<Math.max(m.length,t.length); i++) { if(m[i]) combined.push(m[i]); if(t[i]) combined.push(t[i]); }
    return combined.slice(0, 16);
  }, null);

  // Box Office This Weekend — from tv-api.com + resolved via TMDB for full card data
  _scheduleRowLoad('row-boxoffice', 'sec-boxoffice', async () => {
    const boxData = await fetchTvApiBoxOffice().catch(() => null);
    if (!boxData?.items?.length) return [];
    // Resolve TMDB IDs from IMDB IDs
    const results = await Promise.all(
      boxData.items.slice(0, 10).map(item => {
        if (!item.id) return null;
        return tmdb('/find/' + item.id, { external_source: 'imdb_id' })
          .then(d => {
            const match = d.movie_results?.[0];
            return match ? { ...match, media_type: 'movie' } : null;
          }).catch(() => null);
      })
    );
    return results.filter(Boolean);
  }, 'movie');

  // ── Originals & Exclusives rows (rotates daily across 3 providers) ──
  // Uses only with_networks — combining with_watch_providers AND with_networks
  // creates an AND filter that returns nearly nothing. Network IDs are the
  // accurate way to find content produced/owned by a streaming service.
  const providerDay = Math.floor(Date.now() / (24*3600000)) % 3;
  if (providerDay === 0) {
    // Netflix Originals (network 213 = Netflix)
    _scheduleRowLoad('row-on-netflix', 'sec-on-netflix', async () => {
      const [m, t] = await Promise.allSettled([
        tmdb('/discover/movie', { with_networks:213, sort_by:'popularity.desc', 'vote_count.gte':20, page: rng }),
        tmdb('/discover/tv',    { with_networks:213, sort_by:'popularity.desc', 'vote_count.gte':20, page: rng }),
      ]);
      const movies = m.status==='fulfilled'?(m.value.results||[]).map(x=>({...x,media_type:'movie'})):[];
      const shows  = t.status==='fulfilled'?(t.value.results||[]).map(x=>({...x,media_type:'tv'})):[];
      const out=[]; for(let i=0;i<Math.max(movies.length,shows.length);i++){if(movies[i])out.push(movies[i]);if(shows[i])out.push(shows[i]);}
      return out;
    }, null);
  } else if (providerDay === 1) {
    // Disney+ Originals (network 2739 = Disney+)
    _scheduleRowLoad('row-on-disney', 'sec-on-disney', async () => {
      const [m, t] = await Promise.allSettled([
        tmdb('/discover/movie', { with_networks:2739, sort_by:'popularity.desc', 'vote_count.gte':10, page: rng }),
        tmdb('/discover/tv',    { with_networks:2739, sort_by:'popularity.desc', 'vote_count.gte':10, page: rng }),
      ]);
      const movies = m.status==='fulfilled'?(m.value.results||[]).map(x=>({...x,media_type:'movie'})):[];
      const shows  = t.status==='fulfilled'?(t.value.results||[]).map(x=>({...x,media_type:'tv'})):[];
      const out=[]; for(let i=0;i<Math.max(movies.length,shows.length);i++){if(movies[i])out.push(movies[i]);if(shows[i])out.push(shows[i]);}
      return out;
    }, null);
  } else {
    // Max (HBO) Originals (network 49 = HBO) — Hulu has no network ID so use HBO which has tons of content
    _scheduleRowLoad('row-on-hulu', 'sec-on-hulu', async () => {
      const [m, t] = await Promise.allSettled([
        tmdb('/discover/movie', { with_networks:49, sort_by:'popularity.desc', 'vote_count.gte':30, page: rng }),
        tmdb('/discover/tv',    { with_networks:49, sort_by:'popularity.desc', 'vote_count.gte':30, page: rng }),
      ]);
      const movies = m.status==='fulfilled'?(m.value.results||[]).map(x=>({...x,media_type:'movie'})):[];
      const shows  = t.status==='fulfilled'?(t.value.results||[]).map(x=>({...x,media_type:'tv'})):[];
      const out=[]; for(let i=0;i<Math.max(movies.length,shows.length);i++){if(movies[i])out.push(movies[i]);if(shows[i])out.push(shows[i]);}
      return out;
    }, null);
  }

  // Load curated rows (random selection, alt names, personalization-aware)
  loadCuratedRows(prefG, prefGenreStr, pRng);

  // Seasonal row
  loadSeasonalRow();

  // Because You Liked — personalized
  setTimeout(() => loadBecauseYouLiked().catch(() => {}), 800);

  // Additional personalized rows — staggered to avoid hammering the API
  setTimeout(() => loadGenreTrending().catch(() => {}), 1200);
  setTimeout(() => loadDeepCuts().catch(() => {}), 1600);
  setTimeout(() => loadHistoryMix().catch(() => {}), 2000);
  setTimeout(() => loadBecauseYouWatched().catch(() => {}), 2400);
}

/* ── ROW CATALOG with ALT NAMES ─────────────────────────────────── */
// Each row has multiple label variants — picked randomly per session
const ROW_CATALOG = [
  // id, sectionId, type, altNames[], fetchFn (built in loadCuratedRows)
  { id: 'row-boredom',       sec: 'sec-boredom',       type: 'movie', persona: true,
    labels: ['Boredom Busters','Nothing to Watch? Try These','Just Watch Something Good','Pick Me Up','Entertainment Mode: ON','Quick Picks Just for You'] },
  { id: 'row-new-streaming', sec: 'sec-new-streaming',  type: null,   persona: false,
    labels: ['New on Streaming','Just Dropped','Fresh Arrivals','Hot Off the Press','Just Added','New This Week'] },
  { id: 'row-love-these',    sec: 'sec-love-these',     type: null,   persona: true,
    labels: ["We Think You'll Love These","Made for You","Your Next Obsession","Curated Just for You","Handpicked for Your Taste","You Might Be Into These"] },
  { id: 'row-awards',        sec: 'sec-awards',         type: 'movie', persona: false,
    labels: ['Award-Winning','Critics\' Picks','The Good Stuff','Critically Acclaimed','Best of the Best','Oscar Worthy'] },
  { id: 'row-tv-faves',      sec: 'sec-tv-faves',       type: 'tv',   persona: false,
    labels: ['Familiar TV Favorites','The Classics','Shows Everyone\'s Seen','You Know These','Timeless TV','All-Time Greats'] },
  { id: 'row-retro-tv',      sec: 'sec-retro-tv',       type: 'tv',   persona: false,
    labels: ['Retro TV','Back in the Day','Old School Classics','Throwback TV','Before Your Time','Nostalgia Trip'] },
  { id: 'row-binge-drama',   sec: 'sec-binge-drama',    type: 'tv',   persona: true,
    labels: ['Bingeworthy TV','Can\'t Stop Won\'t Stop','One More Episode','Warning: Addictive','Start Your Next Binge','5-Star Series'] },
  { id: 'row-weekend',       sec: 'sec-weekend',        type: 'movie', persona: true,
    labels: ['Perfect for the Weekend','Weekend Watch List','Movie Night Picks','Grab the Popcorn','Friday Night Vibes','Lazy Sunday Picks'] },
  { id: 'row-hidden-gems',   sec: 'sec-hidden-gems',    type: null,   persona: false,
    labels: ['Hidden Gems','Undiscovered Classics','Underrated Picks','Slept On','Cult Favorites','You Missed These'] },
  { id: 'row-feel-good',     sec: 'sec-feel-good',      type: 'movie', persona: true,
    labels: ['Feel-Good Picks','Good Vibes Only','Mood Lifters','Watch & Smile','Guaranteed to Cheer You Up','Happy Watching'] },
  { id: 'row-intense',       sec: 'sec-intense',        type: null,   persona: true,
    labels: ['Intense & Gripping','Edge of Your Seat','Buckle Up','Can\'t Look Away','Adrenaline Rush','Not for the Faint of Heart'] },
  { id: 'row-documentary',   sec: 'sec-documentary',    type: 'movie', persona: false,
    labels: ['True Stories','Real Life Is Stranger','Documentaries Worth Watching','Mind-Opening Docs','The Truth Behind It','Fact Not Fiction'] },
  { id: 'row-international', sec: 'sec-international',  type: null,   persona: false,
    labels: ['Around the World','Global Cinema','Not From Hollywood','International Hits','Foreign Language Gems','World\'s Best Cinema'] },
  { id: 'row-teen-drama',    sec: 'sec-teen-drama',     type: 'tv',   persona: true,
    labels: ['Teen Drama','Coming of Age','High School Never Ends','Teenage Fever','For the Drama Lovers','Campus & Chaos'] },
  { id: 'row-sci-fi-tv',     sec: 'sec-sci-fi-tv',      type: 'tv',   persona: true,
    labels: ['Sci-Fi That Hits Different','Beyond Reality','Future Is Here','Space & Beyond','The Future of TV','Alternate Universes'] },
  { id: 'row-comfort',       sec: 'sec-comfort',        type: 'tv',   persona: true,
    labels: ['Comfort TV','Old Reliables','Rewatch Worthy','Familiar Faces','Come Back to These','Your TV Safety Blanket'] },
  { id: 'row-discover-new', sec: 'sec-discover-new',   type: null,   persona: false,
    labels: ['Discover Something New', 'Never Seen Before?', 'Expand Your Horizons', 'Beyond Your Comfort Zone', 'Something Different', 'Try Something New Tonight', 'We Bet You Missed This', 'Off the Beaten Path'] },
  // Additional curated rows
  { id: 'row-miniseries',   sec: 'sec-miniseries',    type: 'tv',   persona: false,
    labels: ['Mini-Series Worth Your Weekend', 'Binge in One Weekend', 'Short & Sweet Series', 'Self-Contained Stories', 'Commit-Free TV', 'Start & Finish This Weekend'] },
  { id: 'row-based-on',     sec: 'sec-based-on',      type: 'movie', persona: false,
    labels: ['Based on True Events', 'True Crime & Real Stories', 'Ripped from the Headlines', 'You Heard About This IRL', 'Fact Meets Fiction', 'The Real Story'] },
  { id: 'row-dark-comedy',  sec: 'sec-dark-comedy',   type: null,   persona: true,
    labels: ['Dark Comedy', 'Twisted Funny', 'Wrong in All the Right Ways', 'Laugh Until It Hurts', 'Uncomfortable Funny', 'Darkly Hilarious'] },
  { id: 'row-superhero',    sec: 'sec-superhero',     type: null,   persona: false,
    labels: ['Superhero Universe', 'Marvel & DC', 'Capes & Powers', 'Save the World Tonight', 'Action Heroes', 'Heroes & Villains'] },
  { id: 'row-mystery-film', sec: 'sec-mystery-film',  type: 'movie', persona: true,
    labels: ['Whodunit?', 'Mystery & Suspense', 'Keep Guessing', 'The Plot Thickens', 'Who Did It?', 'Unsolved Until the End'] },
  { id: 'row-prestige-tv',  sec: 'sec-prestige-tv',   type: 'tv',   persona: true,
    labels: ['Prestige TV', 'Emmy-Winning Drama', 'Peak Television', 'Critical Darlings', 'Award-Season Favorites', 'The Good TV'] },
  { id: 'row-90s-nostalgia',sec: 'sec-90s-nostalgia', type: null,   persona: false,
    labels: ['90s Nostalgia', 'Take Me Back', 'Throwback to the 90s', 'Before Streaming', 'That 90s Feeling', 'VHS Era Classics'] },
  { id: 'row-anime-mix',    sec: 'sec-anime-mix',     type: 'anime', persona: true,
    labels: ["Anime You'll Actually Finish", 'Anime Starter Pack', 'Gateway Anime', 'For Everyone', 'Start Here with Anime', 'Accessible Anime'] },
];

// Labels are picked randomly per session (stored so they don't change mid-session)
function getRowLabel(rowId, defaultLabels) {
  const key = `sv_rl_${rowId}`;
  let stored = sessionStorage.getItem(key);
  if (!stored) {
    stored = defaultLabels[Math.floor(Math.random() * defaultLabels.length)];
    sessionStorage.setItem(key, stored);
  }
  return stored;
}

/* ── LOAD CURATED ROWS ───────────────────────────────────────────── */
function loadCuratedRows(prefG2, prefGenreStr2, pRng2) {
  const personalize = getSetting('personalizeContent') !== false; // default on

  // Pick a random subset of rows to show (not all at once)
  // Always show: top10, boredom, new-streaming, love-these
  const alwaysShow = ['row-boredom', 'row-new-streaming', 'row-love-these', 'row-awards'];
  // Pick 4-6 more from the catalog randomly
  const optional = ROW_CATALOG.filter(r => !alwaysShow.includes(r.id));
  const shuffled = optional.sort(() => Math.random() - 0.5);
  // Use a seed based on date so the selection changes daily but is consistent within a day
  const daySeed = Math.floor(Date.now() / (24 * 3600000));
  const sessionKey = `sv_row_sel_${daySeed}`;
  let selected = [];
  try {
    selected = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
  } catch {}
  if (!selected.length) {
    selected = shuffled.slice(0, 5 + Math.floor(Math.random() * 3)).map(r => r.id);
    sessionStorage.setItem(sessionKey, JSON.stringify(selected));
  }

  // Prevent similar-themed rows from appearing side by side
  // (e.g. "The Classics" tv-faves and "Old School Classics" retro-tv are too similar)
  const CONFLICTS = [
    ['row-tv-faves',    'row-retro-tv'],    // both "classics" TV
    ['row-tv-faves',    'row-90s-nostalgia'],// classics TV vs 90s nostalgia
    ['row-retro-tv',    'row-90s-nostalgia'],// both old TV
    ['row-feel-good',   'row-dark-comedy'], // opposite vibes
    ['row-intense',     'row-mystery-film'],// both suspenseful
    ['row-documentary', 'row-based-on'],    // both "real events"
    ['row-binge-drama', 'row-prestige-tv'], // both drama TV
    ['row-sci-fi-tv',   'row-superhero'],   // both genre TV
  ];
  CONFLICTS.forEach(([a, b]) => {
    if (selected.includes(a) && selected.includes(b)) {
      // Keep whichever appears first in the shuffled order, drop the other
      selected.splice(selected.indexOf(b), 1);
    }
  });
  const activeIds = new Set([...alwaysShow, ...selected]);

  const _hideAnime = getSetting('hideAnime');
  // Hide sections not in active set; also hide anime catalog rows if hideAnime is on
  ROW_CATALOG.forEach(r => {
    const sec = document.getElementById(r.sec);
    const show = activeIds.has(r.id) && !(_hideAnime && r.type === 'anime');
    if (sec) sec.style.display = show ? '' : 'none';
  });

  // Update labels with alt names
  ROW_CATALOG.forEach(r => {
    const secEl = document.getElementById(r.sec);
    if (!secEl || !activeIds.has(r.id)) return;
    const labelEl = secEl.querySelector('.sec-title');
    if (labelEl && r.labels) {
      const label = getRowLabel(r.id, r.labels);
      // Preserve the icon
      const icon = labelEl.querySelector('.material-icons-round, .sec-icon');
      const iconHTML = icon ? icon.outerHTML : '';
      labelEl.innerHTML = `${iconHTML}${label}${personalize && r.persona ? ' <span class="row-personalized-badge">✦ For You</span>' : ''}`;
    }
  });

  // Build fetch functions
  const pOpts = (genre, extra = {}) => ({
    sort_by: 'popularity.desc',
    with_genres: personalize && prefGenreStr2 ? `${genre}|${prefGenreStr2}` : String(genre),
    page: pRng2,
    ...extra,
  });

  const fetchMap = {
    'row-boredom':       () => tmdb('/discover/movie', { with_genres: personalize && prefGenreStr2 ? `28|35|${prefGenreStr2}` : '28|35|12', sort_by: 'popularity.desc', 'vote_count.gte': 200, 'primary_release_date.gte': '2015-01-01', page: pRng2 }).then(d => d.results || []),
    'row-new-streaming': async () => {
      const [mv, tv] = await Promise.allSettled([tmdb('/movie/now_playing', { page: pRng2 }), tmdb('/tv/on_the_air', { page: pRng2 })]);
      const m = mv.status === 'fulfilled' ? (mv.value.results || []).map(x => ({ ...x, media_type: 'movie' })) : [];
      const t = tv.status === 'fulfilled' ? (tv.value.results || []).map(x => ({ ...x, media_type: 'tv' })) : [];
      const out = []; const max = Math.max(m.length, t.length);
      for (let i = 0; i < max; i++) { if (m[i]) out.push(m[i]); if (t[i]) out.push(t[i]); }
      return out;
    },
    'row-love-these':    async () => {
      if (!personalize) return tmdb('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 500, page: pRng2 }).then(d => d.results || []);
      const picks = [...state.liked, ...state.prefLikes].filter(x => x.id && x.type !== 'anime').slice(0, 3);
      if (!picks.length) return tmdb('/movie/top_rated', { page: pRng2 }).then(d => d.results || []);
      const recs = await Promise.allSettled(picks.map(p => tmdb(`/${p.type || 'movie'}/${p.id}/recommendations`).then(d => d.results || [])));
      const all = recs.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      const seen = new Set(); return all.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }).slice(0, 14);
    },
    'row-awards':        () => tmdb('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 1500, 'vote_average.gte': 7.8, page: pRng2 }).then(d => d.results || []),
    'row-tv-faves':      () => tmdb('/tv/top_rated', { page: pRng2 }).then(d => d.results || []),
    'row-retro-tv':      () => tmdb('/discover/tv', { 'first_air_date.gte': '1970-01-01', 'first_air_date.lte': '2005-12-31', sort_by: 'vote_average.desc', 'vote_count.gte': 300, page: pRng2 }).then(d => d.results || []),
    'row-binge-drama':   () => tmdb('/discover/tv', pOpts(18, { 'vote_count.gte': 100 })).then(d => d.results || []),
    'row-weekend':       () => tmdb('/discover/movie', { sort_by: 'popularity.desc', 'vote_count.gte': 300, page: pRng2, ...(personalize && prefGenreStr2 ? { with_genres: prefGenreStr2 } : {}) }).then(d => d.results || []),
    'row-hidden-gems':   () => tmdb('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 200, 'vote_count.lte': 2000, 'vote_average.gte': 7.5, page: pRng2 }).then(d => d.results || []),
    'row-feel-good':     () => tmdb('/discover/movie', pOpts(35, { 'vote_count.gte': 200 })).then(d => d.results || []),
    'row-intense':       () => tmdb('/discover/movie', { with_genres: '53|28', sort_by: 'vote_average.desc', 'vote_count.gte': 500, page: pRng2 }).then(d => d.results || []),
    'row-documentary':   () => tmdb('/discover/movie', { with_genres: 99, sort_by: 'vote_average.desc', 'vote_count.gte': 100, page: pRng2 }).then(d => d.results || []),
    'row-international': () => tmdb('/discover/movie', { without_original_language: 'en', sort_by: 'popularity.desc', 'vote_count.gte': 200, page: pRng2 }).then(d => d.results || []),
    'row-teen-drama':    () => tmdb('/discover/tv', { with_genres: '18|10762', sort_by: 'popularity.desc', page: pRng2 }).then(d => d.results || []),
    'row-sci-fi-tv':     () => tmdb('/discover/tv', pOpts(10765, { 'vote_count.gte': 100 })).then(d => d.results || []),
    'row-comfort':       () => tmdb('/discover/tv', { sort_by: 'vote_average.desc', 'vote_count.gte': 500, 'first_air_date.lte': `${new Date().getFullYear() - 3}-12-31`, page: pRng2, ...(personalize && prefGenreStr2 ? { with_genres: prefGenreStr2 } : {}) }).then(d => d.results || []),
    'row-discover-new':  () => tmdb('/discover/movie', {
      sort_by: 'popularity.desc',
      ...(prefGenreStr2 ? { without_genres: prefGenreStr2 } : {}),
      'vote_count.gte': 100,
      page: Math.floor(Math.random() * 5) + 1,
    }).then(d => d.results || []),
    'row-miniseries':    () => tmdb('/discover/tv', { with_type:'3', sort_by:'vote_average.desc','vote_count.gte':80, page: pRng2 }).then(d => d.results || []),
    'row-based-on':      () => tmdb('/discover/movie', { with_keywords:'10683,41645', sort_by:'popularity.desc','vote_count.gte':200, page: pRng2 }).then(d => d.results || []),
    'row-dark-comedy':   () => tmdb('/discover/movie', { with_genres:'35|18|53', sort_by:'vote_average.desc','vote_count.gte':200, page: pRng2 }).then(d => d.results || []),
    'row-superhero':     async () => {
      const [mv, tv] = await Promise.allSettled([
        tmdb('/discover/movie', { with_genres:'28', with_keywords:'9715|180547', sort_by:'popularity.desc', page: pRng2 }),
        tmdb('/discover/tv',    { with_keywords:'9715|180547', sort_by:'popularity.desc', page: pRng2 }),
      ]);
      const m = mv.status==='fulfilled'?(mv.value.results||[]).map(x=>({...x,media_type:'movie'})):[];
      const t = tv.status==='fulfilled'?(tv.value.results||[]).map(x=>({...x,media_type:'tv'})):[];
      const out=[]; for(let i=0;i<Math.max(m.length,t.length);i++){if(m[i])out.push(m[i]);if(t[i])out.push(t[i]);}
      return out;
    },
    'row-mystery-film':  () => tmdb('/discover/movie', pOpts(9648, {'vote_count.gte':100})).then(d => d.results || []),
    'row-prestige-tv':   () => tmdb('/discover/tv', { sort_by:'vote_average.desc','vote_count.gte':800, page: pRng2, ...(personalize&&prefGenreStr2?{with_genres:prefGenreStr2}:{}) }).then(d => d.results || []),
    'row-90s-nostalgia': async () => {
      const [mv, tv] = await Promise.allSettled([
        tmdb('/discover/movie', { 'primary_release_date.gte':'1990-01-01','primary_release_date.lte':'1999-12-31', sort_by:'popularity.desc','vote_count.gte':300 }),
        tmdb('/discover/tv',    { 'first_air_date.gte':'1990-01-01','first_air_date.lte':'1999-12-31', sort_by:'popularity.desc','vote_count.gte':200 }),
      ]);
      const m = mv.status==='fulfilled'?(mv.value.results||[]).map(x=>({...x,media_type:'movie'})):[];
      const t = tv.status==='fulfilled'?(tv.value.results||[]).map(x=>({...x,media_type:'tv'})):[];
      const out=[]; for(let i=0;i<Math.max(m.length,t.length);i++){if(m[i])out.push(m[i]);if(t[i])out.push(t[i]);}
      return out;
    },
    'row-anime-mix':     () => aniQuery(`query{Page(perPage:14){media(type:ANIME,sort:[POPULARITY_DESC],isAdult:false){id title{romaji english}coverImage{large}bannerImage averageScore popularity episodes status startDate{year}description(asHtml:false)}}}`).then(d => (d?.data?.Page?.media||[]).map(normalizeAnime)),
  };

  // Load each active row
  activeIds.forEach(rowId => {
    const fn = fetchMap[rowId];
    const meta = ROW_CATALOG.find(r => r.id === rowId);
    if (fn && meta) {
      _scheduleRowLoad(rowId, meta.sec, fn, meta.type || null);
    }
  });
}

/* ── SEASONAL ROW ────────────────────────────────────────────────── */
const SEASONAL_THEMES = {
  1:  { label: 'New Year, New Shows', icon: 'celebration', genres: '18|35', type: 'tv' },
  2:  { label: 'Valentine\'s Day Picks ❤️', icon: 'favorite', genres: '10749|35', type: 'movie' },
  3:  { label: 'Spring Blockbusters', icon: 'local_florist', genres: '28|12', type: 'movie' },
  4:  { label: 'Spring Picks', icon: 'sunny', genres: '35|12', type: 'movie' },
  5:  { label: 'Mind-Bending Thrillers', icon: 'psychology', genres: '53|9648', type: 'movie' },
  6:  { label: 'Pride Month 🌈', icon: 'diversity_3', type: null,
       keywords: '158718', // LGBTQ on TMDB
       genres: '35|18|10749',
       special: 'lgbtq' },
  7:  { label: 'Summer Action', icon: 'beach_access', genres: '28|12|35', type: 'movie' },
  8:  { label: 'Late Summer Thrillers', icon: 'thunderstorm', genres: '53|27', type: 'movie' },
  9:  { label: 'Back to School Drama', icon: 'school', genres: '18|10762', type: 'tv' },
  10: { label: 'Spooky Season 🎃', icon: 'dark_mode', genres: '27|9648|53', type: 'movie' },
  11: { label: 'Cozy Comfort Picks', icon: 'local_cafe', genres: '35|10751|18', type: 'movie' },
  12: { label: 'Holiday Classics 🎄', icon: 'celebration', genres: '35|10751', type: 'movie', keywords: '207317' },
};

async function loadSeasonalRow() {
  const month = new Date().getMonth() + 1;
  const theme = SEASONAL_THEMES[month];
  if (!theme) return;

  const secEl = document.getElementById('sec-seasonal');
  const labelEl = document.getElementById('sec-seasonal-label');
  const iconEl = document.getElementById('sec-seasonal-icon');

  if (labelEl) labelEl.textContent = theme.label;
  if (iconEl) iconEl.textContent = theme.icon;
  if (secEl) secEl.style.display = '';

  if (theme.special === 'lgbtq') {
    const lgbtqFetch = async () => {
      // Rotate pages each view so content is mostly different each time
      const rPage = Math.floor(Math.random() * 5) + 1;

      // Pride Month: search by exact title — most reliable approach
      // Using TMDB search guarantees we get the right movie, not a wrong-ID result
      // Comprehensive LGBTQ+ film/TV list — expanded with more variety
      const prideMovieTitles = [
        'Brokeback Mountain', 'Moonlight', 'Call Me by Your Name', 'Carol',
        'Love, Simon', 'Portrait of a Lady on Fire', 'The Danish Girl', 'Milk',
        'The Birdcage', 'Blue Is the Warmest Colour', 'The Kids Are All Right',
        'Beautiful Thing', "God's Own Country", 'Weekend', 'Holding the Man',
        'Pride', 'Pariah', 'The Normal Heart', 'Philadelphia',
        'Rocketman', 'Bohemian Rhapsody', 'The Way He Looks', 'Handsome Devil',
        'Freeheld', 'A Single Man', 'Keep the Lights On',
      ];
      const prideTvTitles = [
        'Heartstopper', 'Pose', 'Sex Education', "Schitt's Creek",
        'Orange Is the New Black', "It's a Sin", 'Queer as Folk', "RuPaul's Drag Race",
        'Euphoria', 'Looking', 'The L Word', 'Brothers and Sisters',
        'Will and Grace', 'Modern Family', 'Glee', 'Sense8',
        'Cucumber', 'Banana', 'Years and Years',
      ];

      const searchMovie = (title) => tmdb('/search/movie', { query: title }).then(d => {
        const r = d.results?.[0];
        return r ? {...r, media_type:'movie'} : null;
      }).catch(() => null);
      const searchTv = (title) => tmdb('/search/tv', { query: title }).then(d => {
        const r = d.results?.[0];
        return r ? {...r, media_type:'tv'} : null;
      }).catch(() => null);

      // Rotate which titles show based on rPage seed (different each view)
      const mStart = (rPage - 1) * 4 % prideMovieTitles.length;
      const tStart = (rPage - 1) * 3 % prideTvTitles.length;
      const mTitles = [...prideMovieTitles.slice(mStart), ...prideMovieTitles.slice(0, mStart)].slice(0, 8);
      const tTitles = [...prideTvTitles.slice(tStart), ...prideTvTitles.slice(0, tStart)].slice(0, 6);

      // Search hardcoded titles + keyword discovery in parallel
      const [movieResults, tvResults, kwMovies, kwTv] = await Promise.all([
        Promise.all(mTitles.map(searchMovie)),
        Promise.all(tTitles.map(searchTv)),
        // TMDB keyword search: "coming out" (158718), "male homosexuality" (3799), "sexual identity" (209726)
        tmdb('/discover/movie', { with_keywords:'158718,3799,209726,155310', sort_by:'vote_average.desc', 'vote_count.gte':100, page: rPage }).then(d=>(d.results||[]).map(x=>({...x,media_type:'movie'}))).catch(()=>[]),
        tmdb('/discover/tv',    { with_keywords:'158718,3799,209726', sort_by:'vote_average.desc', 'vote_count.gte':50, page: rPage }).then(d=>(d.results||[]).map(x=>({...x,media_type:'tv'}))).catch(()=>[]),
      ]);

      const movies_ok = movieResults.filter(Boolean);
      const tv_ok     = tvResults.filter(Boolean);

      // Interleave + deduplicate by id
      const seenIds = new Set();
      const combined = [];
      for (let i = 0; i < Math.max(movies_ok.length, tv_ok.length); i++) {
        const m = movies_ok[i], t = tv_ok[i];
        if (m && !seenIds.has(m.id)) { seenIds.add(m.id); combined.push(m); }
        if (t && !seenIds.has(t.id)) { seenIds.add(t.id); combined.push(t); }
      }
      // Supplement with keyword-discovered content if we have room
      [...kwMovies, ...kwTv].forEach(x => {
        if (x?.id && !seenIds.has(x.id)) { seenIds.add(x.id); combined.push(x); }
      });
      return combined.slice(0, 20);
    };
    _scheduleRowLoad('row-seasonal', null, lgbtqFetch, null);
    return;
  }

  const params = {
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
    page: state._randomPage || 1,
  };
  if (theme.genres) params.with_genres = theme.genres;
  if (theme.keywords) params.with_keywords = theme.keywords;

  const endpoint = theme.type === 'tv' ? '/discover/tv' : '/discover/movie';
  _scheduleRowLoad('row-seasonal', null, () =>
    tmdb(endpoint, params).then(d => d.results || []), theme.type || 'movie');
}

/* ── TITLE YEAR DISAMBIGUATION ───────────────────────────────────── */
let _disambTimer = null;
function scheduledisambiguateTitles() {
  clearTimeout(_disambTimer);
  _disambTimer = setTimeout(disambiguateTitles, 300);
}

function disambiguateTitles() {
  const cards = document.querySelectorAll('#page-home .card[data-title][data-year]');
  const titleMap = new Map(); // lowercase title → array of { card, year }

  cards.forEach(card => {
    const raw = card.dataset.title?.trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key).push({ card, year: card.dataset.year });
  });

  for (const [, items] of titleMap) {
    if (items.length < 2) continue; // no conflict
    items.forEach(({ card, year }) => {
      if (!year) return;
      const titleEl = card.querySelector('.card-title');
      if (!titleEl) return;
      const current = titleEl.textContent;
      if (!current.endsWith(')')) { // not already disambiguated
        titleEl.textContent = `${current} (${year})`;
      }
    });
  }
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

  // Use Object.entries to backfill `id` from the storage key for legacy entries
  const items = Object.entries(state.continueWatching)
    .map(([key, val]) => {
      const numKey = +key;
      return {
        ...val,
        id:          val.id ?? (isNaN(numKey) ? null : numKey),
        media_type:  val.type || 'movie',  // for makeCard type detection
        backdrop_path: val.backdrop_path || null,
        poster_path:   val.poster_path || null,
      };
    })
    .filter(item => item.id && !isNaN(item.id) && Number.isFinite(+item.id))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 12);

  if (!items.length) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  row.innerHTML = items.map(item => {
    // Ensure item has all necessary fields for card click to work
    const safeItem = {
      ...item,
      id: +item.id,
      title: item.title || item.name || 'Unknown',
      type: item.type || 'movie',
    };
    return makeCard(safeItem, safeItem.type, { showProgress: false });
  }).join('');
  // Direct click handler on continue watching row as backup
  row.querySelectorAll('.card').forEach(card => {
    if (!card.dataset.id || isNaN(+card.dataset.id)) return;
    card.style.cursor = 'pointer';
  });
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

/* ── PERSONALIZED "FOR YOU" ROW for sub-pages ────────────────────── */
async function loadPageForYou(rowId, contentType) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = skelCards(8);

  try {
    const prefG = state.prefGenres.length ? state.prefGenres.slice(0, 3).join('|') : null;
    const dislikedIds = new Set(state.disliked.map(x => x.id));
    const watchedIds = new Set(state.watched.map(x => x.id));
    const likedIds = new Set([...state.liked, ...state.prefLikes].map(x => x.id));

    const endpoint = contentType === 'tv'
      ? tmdb('/discover/tv', { sort_by: 'popularity.desc', ...(prefG ? { with_genres: prefG } : {}) })
      : tmdb('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 200, ...(prefG ? { with_genres: prefG } : {}) });

    const d = await endpoint;
    const items = (d.results || [])
      .filter(m => !dislikedIds.has(m.id) && !watchedIds.has(m.id))
      .map(m => ({ ...m, media_type: contentType }))
      .slice(0, 16);

    if (!items.length) { row.innerHTML = ''; return; }
    renderRow(rowId, items, contentType);
  } catch {
    row.innerHTML = '';
  }
}

/* ── MOVIES PAGE ─────────────────────────────────────────────────── */
async function loadMoviesPage() {
  const rp = state._randomPage || 1;
  const allRowIds = [
    'row-movies-foryou','row-movies-pop','row-movies-top','row-movies-new','row-movies-up',
    'row-movies-action','row-movies-thriller','row-movies-romance','row-movies-comedy',
    'row-movies-horror','row-movies-scifi','row-movies-animated','row-movies-crime',
    'row-movies-docs','row-movies-2024','row-movies-2010s','row-movies-foreign',
  ];
  allRowIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });
  loadPageForYou('row-movies-foryou', 'movie');

  await Promise.allSettled([
    tmdb('/movie/popular',   { page: rp }).then(d => renderRow('row-movies-pop',      (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-pop')),
    tmdb('/movie/top_rated', { page: rp }).then(d => renderRow('row-movies-top',      (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-top')),
    tmdb('/movie/now_playing').then(d =>   renderRow('row-movies-new',     (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-new')),
    tmdb('/movie/upcoming').then(d =>      renderRow('row-movies-up',      (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-up')),
    tmdb('/discover/movie', { with_genres:'28',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-movies-action',   (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-action')),
    tmdb('/discover/movie', { with_genres:'53',    sort_by:'vote_average.desc', 'vote_count.gte':200, page: rp }).then(d=>renderRow('row-movies-thriller', (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-thriller')),
    tmdb('/discover/movie', { with_genres:'10749', sort_by:'popularity.desc',   'vote_count.gte':100, page: rp }).then(d=>renderRow('row-movies-romance',  (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-romance')),
    tmdb('/discover/movie', { with_genres:'35',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-movies-comedy',   (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-comedy')),
    tmdb('/discover/movie', { with_genres:'27',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-movies-horror',   (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-horror')),
    tmdb('/discover/movie', { with_genres:'878',   sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-movies-scifi',    (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-scifi')),
    tmdb('/discover/movie', { with_genres:'16',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-movies-animated', (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-animated')),
    tmdb('/discover/movie', { with_genres:'80',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-movies-crime',    (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-crime')),
    tmdb('/discover/movie', { with_genres:'99',    sort_by:'vote_average.desc', 'vote_count.gte':100, page: rp }).then(d=>renderRow('row-movies-docs',     (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-docs')),
    tmdb('/discover/movie', { primary_release_year: new Date().getFullYear() - 1, sort_by:'popularity.desc' }).then(d=>renderRow('row-movies-2024',   (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-2024')),
    tmdb('/discover/movie', { primary_release_date_gte:'2010-01-01', primary_release_date_lte:'2019-12-31', sort_by:'vote_average.desc','vote_count.gte':300 }).then(d=>renderRow('row-movies-2010s',(d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-2010s')),
    tmdb('/discover/movie', { without_original_language:'en', sort_by:'vote_average.desc','vote_count.gte':200, page: rp }).then(d=>renderRow('row-movies-foreign', (d.results||[]).slice(0,14),'movie')).catch(()=>hideSection('sec-movies-foreign')),
  ]);
}

/* ── TV PAGE ─────────────────────────────────────────────────────── */
async function loadTvPage() {
  const rp = state._randomPage || 1;
  const allRowIds = [
    'row-tv-foryou','row-tv-popular','row-tv-top','row-tv-air','row-tv-crime','row-tv-scifi',
    'row-tv-kdrama','row-tv-reality','row-tv-animated','row-tv-limited','row-tv-comedy',
    'row-tv-mystery','row-tv-family','row-tv-thriller',
  ];
  allRowIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });
  loadPageForYou('row-tv-foryou', 'tv');

  await Promise.allSettled([
    tmdb('/tv/popular',     { page: rp }).then(d=>renderRow('row-tv-popular',  (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-popular')),
    tmdb('/tv/top_rated',   { page: rp }).then(d=>renderRow('row-tv-top',      (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-top')),
    tmdb('/tv/airing_today').then(d=>           renderRow('row-tv-air',        (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-air')),
    tmdb('/discover/tv', { with_genres:'80',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-crime',    (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-crime')),
    tmdb('/discover/tv', { with_genres:'10765', sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-scifi',    (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-scifi')),
    tmdb('/discover/tv', { with_original_language:'ko', sort_by:'popularity.desc', page: rp }).then(d=>renderRow('row-tv-kdrama',   (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-kdrama')),
    tmdb('/discover/tv', { with_genres:'10764', sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-reality',  (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-reality')),
    tmdb('/discover/tv', { with_genres:'16',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-animated', (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-animated')),
    tmdb('/discover/tv', { with_type:'3',       sort_by:'vote_average.desc', 'vote_count.gte':50, page: rp }).then(d=>renderRow('row-tv-limited',  (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-limited')),
    tmdb('/discover/tv', { with_genres:'35',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-comedy',   (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-comedy')),
    tmdb('/discover/tv', { with_genres:'9648',  sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-mystery',  (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-mystery')),
    tmdb('/discover/tv', { with_genres:'10751', sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-family',   (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-family')),
    tmdb('/discover/tv', { with_genres:'53',    sort_by:'popularity.desc',   page: rp }).then(d=>renderRow('row-tv-thriller', (d.results||[]).slice(0,14),'tv')).catch(()=>hideSection('sec-tv-thriller')),
  ]);
}

/* ── ANIME PAGE ──────────────────────────────────────────────────── */
async function loadAnimePage() {
  const allRowIds = [
    'row-anime-trend','row-anime-top','row-anime-airing','row-anime-action',
    'row-anime-romance','row-anime-isekai','row-anime-sports','row-anime-mecha',
    'row-anime-horror','row-anime-comedy','row-anime-movie',
  ];
  allRowIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = skelCards(8); });

  const Q = `query($sort:[MediaSort],$status:MediaStatus,$genre:String,$format:MediaFormat){Page(perPage:16){media(type:ANIME,sort:$sort,status:$status,isAdult:false,genre:$genre,format:$format){id title{romaji english}coverImage{large}bannerImage averageScore popularity episodes status startDate{year}description(asHtml:false)}}}`;

  const results = await Promise.allSettled([
    aniQuery(Q, { sort: ['TRENDING_DESC'] }),
    aniQuery(Q, { sort: ['SCORE_DESC'] }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], status: 'RELEASING' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Action' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Romance' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Isekai' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Sports' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Mecha' }),
    aniQuery(Q, { sort: ['SCORE_DESC'],      genre: 'Horror' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], genre: 'Comedy' }),
    aniQuery(Q, { sort: ['POPULARITY_DESC'], format: 'MOVIE' }),
  ]);

  const fix = r => r.status === 'fulfilled' ? (r.value?.data?.Page?.media || []).map(normalizeAnime) : [];
  const pairs = [
    ['row-anime-trend','sec-anime-trend'],['row-anime-top','sec-anime-top'],
    ['row-anime-airing','sec-anime-airing'],['row-anime-action','sec-anime-action'],
    ['row-anime-romance','sec-anime-romance'],['row-anime-isekai','sec-anime-isekai'],
    ['row-anime-sports','sec-anime-sports'],['row-anime-mecha','sec-anime-mecha'],
    ['row-anime-horror','sec-anime-horror'],['row-anime-comedy','sec-anime-comedy'],
    ['row-anime-movie','sec-anime-movie'],
  ];
  results.forEach((r, i) => {
    const items = fix(r);
    if (items.length && pairs[i]) renderRow(pairs[i][0], items, 'anime');
    else if (pairs[i]) hideSection(pairs[i][1]);
  });
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
function syncLikedToPrefLikes() {
  // Keep liked and prefLikes in sync — liked items should appear in Titles I Love
  let changed = false;
  state.liked.filter(item => isValidItem(item) && (item.title || item.name)).forEach(item => {
    if (!state.prefLikes.some(x => x.id == item.id)) {
      state.prefLikes.push({
        id: +item.id, type: item.type || 'movie',
        title: (item.title || item.name || '').trim(),
        poster: item.poster_path ? imgUrl(item.poster_path, 'w92') : '',
        score: 4,
      });
      changed = true;
    }
  });
  if (changed) persist('prefLikes');
}

function updateCyfStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('cyf-stat-wl-n',      state.watchlist?.length ?? 0);
  set('cyf-stat-liked-n',   state.liked?.length ?? 0);
  set('cyf-stat-watched-n', state.watched?.length ?? 0);
  set('cyf-stat-cont-n',    Object.keys(state.continueWatching || {}).length);
  set('cyf-stat-genres-n',  state.prefGenres?.length ?? 0);
}

function loadPrefsPage() {
  syncLikedToPrefLikes();
  updateCyfStats();
  renderPrefLists();
  renderTagPrefsSection();
  buildRatingDescriptions();
  buildGenreChips('pref-genres', GENRES, (id, _name, chipEl) => {
    const liked    = state.prefGenres.includes(id);
    const disliked = state.prefGenreDislikes.includes(id);
    const ICONS    = Object.fromEntries(GENRES.map(g => [g.id, g.icon]));

    if (!liked && !disliked) {
      // None → Liked
      state.prefGenres.push(id);
      persist('prefGenres');
      chipEl.classList.add('on');
      chipEl.querySelector('.material-icons-round').textContent = ICONS[id] || 'thumb_up';
      chipEl.title = 'Click to dislike';
    } else if (liked) {
      // Liked → Disliked
      state.prefGenres = state.prefGenres.filter(x => x !== id);
      persist('prefGenres');
      state.prefGenreDislikes.push(id);
      persist('prefGenreDislikes');
      chipEl.classList.remove('on');
      chipEl.classList.add('off');
      chipEl.querySelector('.material-icons-round').textContent = 'thumb_down';
      chipEl.title = 'Click to reset';
    } else {
      // Disliked → None
      state.prefGenreDislikes = state.prefGenreDislikes.filter(x => x !== id);
      persist('prefGenreDislikes');
      chipEl.classList.remove('off');
      chipEl.querySelector('.material-icons-round').textContent = ICONS[id] || 'star';
      chipEl.title = 'Click to like';
    }
  }, state.prefGenres, state.prefGenreDislikes);
  buildVidsrcDomainList();
  buildAgeRatingUI();
  initPrefAutocomplete();
  if (!document.getElementById('sv-settings-grid')?.children.length) {
    buildSettingsUI(); // only build if not already built
  }
  buildProviderTestUI();
}

function buildProviderTestUI() {
  const grid = document.getElementById('provider-test-grid');
  if (!grid) return;
  if (grid._built) return; // only build once
  grid._built = true;

  grid.innerHTML = PROVIDERS.map(p => {
    const working = JSON.parse(localStorage.getItem('sv_provider_working') || '{}');
    const disabled = JSON.parse(localStorage.getItem('sv_provider_disabled') || '[]');
    const status = working[p.id] ? 'ok' : disabled.includes(p.id) ? 'off' : 'unknown';
    const svgIcon = status === 'ok'
      ? `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="7" stroke="#22c55e" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round"/></svg>`
      : status === 'off'
      ? `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="7" stroke="#f97316" stroke-width="1.5"/><path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="#f97316" stroke-width="1.5" stroke-linecap="round"/></svg>`
      : `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="7" stroke="var(--dim)" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="var(--dim)"/></svg>`;
    return `<div class="ptest-row" data-pid="${p.id}">
      <span class="ptest-icon" id="ptest-icon-${p.id}">${svgIcon}</span>
      <span class="ptest-name">${p.label}</span>
      ${p.note ? `<span class="ptest-note">${p.note}</span>` : ''}
      <span class="ptest-status" id="ptest-status-${p.id}">${status === 'ok' ? 'OK' : status === 'off' ? 'Disabled' : 'Untested'}</span>
      <button class="data-btn" style="font-size:.65rem;padding:.18rem .5rem" onclick="window._testProv('${p.id}')">Test</button>
      <button class="data-btn ${disabled.includes(p.id) ? 'test-btn-warn' : ''}" style="font-size:.65rem;padding:.18rem .5rem" onclick="window._toggleProv('${p.id}')">
        ${disabled.includes(p.id) ? 'Off' : 'On'}
      </button>
    </div>`;
  }).join('');

  // TMDB test
  document.getElementById('test-tmdb-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('test-tmdb-btn');
    if (btn) btn.textContent = 'Testing…';
    try {
      await tmdb('/trending/movie/week');
      if (btn) { btn.textContent = '✓ TMDB OK'; btn.style.color = '#22c55e'; }
    } catch {
      if (btn) { btn.textContent = '✗ TMDB Failed'; btn.style.color = '#f87171'; }
    }
  });

  document.getElementById('test-anilist-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('test-anilist-btn');
    if (btn) btn.textContent = 'Testing…';
    try {
      await aniQuery(`query{Page(perPage:1){media(type:ANIME){id}}}`);
      if (btn) { btn.textContent = '✓ AniList OK'; btn.style.color = '#22c55e'; }
    } catch {
      if (btn) { btn.textContent = '✗ AniList Failed'; btn.style.color = '#f87171'; }
    }
  });

  // Test APIs button
  // Combined: test providers AND APIs in one click
  // Single "Test Everything" button — tests both providers and APIs
  const _runAllTests = async () => {
    const btn = document.getElementById('test-all-apis-btn');
    const output = document.getElementById('api-test-results');
    if (!btn || !output) return;
    if (btn.disabled) return; // prevent double-click
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round" style="animation:spin 1s linear infinite;font-size:.9rem">refresh</span> Testing…';
    output.style.display = 'block';
    output.innerHTML = '<div style="color:var(--muted);font-size:.78rem;padding:.5rem">Running all checks — providers and APIs…</div>';

    try {
      // Test video providers first (fast)
      if (typeof window._testProv === 'function') {
        PROVIDERS.forEach(p => window._testProv(p.id));
      }

      // Then test all external APIs
      const apiResults = await testAllAPIs();
      const okCount   = apiResults.filter(r => r.status === 'ok').length;
      const errCount  = apiResults.filter(r => r.status === 'error').length;
      const missCount = apiResults.filter(r => r.status === 'missing').length;

      output.innerHTML = `
        <div style="display:flex;gap:.65rem;align-items:center;padding:.4rem 0 .65rem;border-bottom:1px solid var(--border);margin-bottom:.4rem;flex-wrap:wrap">
          <span style="font-size:.75rem;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-right:.3rem">External APIs</span>
          <span style="color:#22c55e;font-weight:800;font-size:.78rem">✅ ${okCount} working</span>
          ${errCount  ? `<span style="color:#f87171;font-weight:800;font-size:.78rem">❌ ${errCount} failed</span>`  : ''}
          ${missCount ? `<span style="color:#f59e0b;font-weight:800;font-size:.78rem">⚠️ ${missCount} no key</span>` : ''}
        </div>
        ${apiResults.map(r => {
          const icon  = r.status === 'ok' ? '✅' : r.status === 'missing' ? '⚠️' : '❌';
          const color = r.status === 'ok' ? '#22c55e' : r.status === 'missing' ? '#f59e0b' : '#f87171';
          return `<div style="display:flex;align-items:center;gap:.45rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.74rem;">
            <span style="width:16px;flex-shrink:0">${icon}</span>
            <span style="font-weight:800;min-width:115px;color:var(--text)">${r.name}</span>
            <span style="color:${color};flex:1">${r.note}</span>
          </div>`;
        }).join('')}`;
    } catch (e) {
      output.innerHTML = `<div style="color:#f87171;padding:.5rem">Test failed: ${e.message}</div>`;
    }
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">play_circle</span>Test Everything';
  };

  document.getElementById('test-all-apis-btn')?.addEventListener('click', () => {
    // Auto-expand when testing
    const body = document.getElementById('provider-test-body');
    const toggleBtn = document.getElementById('ptest-toggle-btn');
    if (body && body.classList.contains('collapsed')) {
      body.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.innerHTML = '<span class="material-icons-round" style="font-size:.85rem">expand_less</span>Hide';
    }
    _runAllTests();
  });
  document.getElementById('test-all-providers-cyf-btn')?.addEventListener('click', _runAllTests);

  // Show/hide toggle
  document.getElementById('ptest-toggle-btn')?.addEventListener('click', () => {
    const body = document.getElementById('provider-test-body');
    const btn = document.getElementById('ptest-toggle-btn');
    if (!body || !btn) return;
    const collapsed = body.classList.toggle('collapsed');
    btn.innerHTML = collapsed
      ? '<span class="material-icons-round" style="font-size:.85rem">expand_more</span>Show'
      : '<span class="material-icons-round" style="font-size:.85rem">expand_less</span>Hide';
  });
}

function buildAgeRatingUI() {
  const container = document.getElementById('pref-age-row');
  if (!container) return;
  const curLevel = AGE_LEVELS[state.ageRating] ?? 4;

  container.innerHTML = ALL_RATINGS.map(({ r, level, desc }) => {
    const active = AGE_LEVELS[state.ageRating] === level;
    const allowed = level <= curLevel;
    return `<button class="age-btn${active ? ' on' : ''}${allowed ? ' age-allowed' : ''}"
      data-age="${r}" data-level="${level}" title="${desc}">
      <span class="age-btn-code">${r}</span>
      <span class="age-btn-hint">${desc}</span>
    </button>`;
  }).join('');

  container.querySelectorAll('.age-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ageRating = btn.dataset.age;
      persist('ageRating');
      buildAgeRatingUI(); // re-render
      buildRatingDescriptions();
      _applyAgeBasedPreferences(btn.dataset.age); // auto-adjust content silently
      window._prefsDirty = true;
    });
  });
}

// Silently adjust genre preferences when age rating changes
function _applyAgeBasedPreferences(rating) {
  const level = AGE_LEVELS[rating] ?? 4;
  // Clear previous auto-preferences
  state._autoAgeGenres = state._autoAgeGenres || {};
  // Genres to encourage for young ratings
  const friendlyGenres = [10751,16,35,10402]; // Family, Animation, Comedy, Music
  // Genres to discourage for young ratings
  const matureGenres   = [28,27,80,53,9648,36]; // Action, Horror, Crime, Thriller, Mystery, History-violence

  if (level <= 2) { // TV-Y / TV-Y7 / G
    // Remove mature genres from prefGenres if present (silently)
    state.prefGenres = (state.prefGenres || []).filter(g => !matureGenres.includes(g));
    persist('prefGenres');
    // Mark auto-friendly genres so they're boosted in recommendations
    state._autoAgeGenres = { boost: friendlyGenres, suppress: matureGenres };
  } else {
    // Reset — remove age-based genre restrictions
    state._autoAgeGenres = {};
  }
}

/* ── CYF SETTINGS (SV_SETTINGS defined above init IIFE to avoid TDZ) */

function getSetting(id) {
  const defaults = Object.fromEntries(SV_SETTINGS.map(s => [s.id, s.default]));
  const saved = JSON.parse(localStorage.getItem('sv_settings') || '{}');
  return id in saved ? saved[id] : defaults[id];
}

function setSetting(id, val) {
  const saved = JSON.parse(localStorage.getItem('sv_settings') || '{}');
  saved[id] = val;
  localStorage.setItem('sv_settings', JSON.stringify(saved));
  applySetting(id, val);
}

function applySetting(id, val) {
  if (id === 'repeatContent') state._repeatTolerance = val;
  if (id === 'personalizeContent') {
    // Clear row label cache so they refresh with/without personalization markers
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('sv_rl_')) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  }
  if (id === 'motionLevel') {
    document.body.classList.toggle('sv-reduced-motion', val === 'minimal');
    document.body.classList.toggle('sv-no-motion', val === 'none');
  }
  if (id === 'mobileIconNav') document.body.classList.toggle('sv-icon-nav', !!val);
  if (id === 'glassEffects') document.body.classList.toggle('sv-glass', !!val && _isApplePlatform());
  if (id === 'mobileHideHeader') {
    document.body.classList.toggle('sv-autohide-header', !!val);
    if (val && !window._svHideHdrBound) {
      window._svHideHdrBound = true;
      let lastY = window.scrollY;
      window.addEventListener('scroll', () => {
        if (!document.body.classList.contains('sv-autohide-header')) return;
        if (!window.matchMedia('(max-width: 720px)').matches) return;
        const hdr = document.getElementById('header');
        if (!hdr) return;
        const y = window.scrollY;
        if (y > lastY + 8 && y > 120) hdr.classList.add('hdr-hidden');
        else if (y < lastY - 8 || y < 60) hdr.classList.remove('hdr-hidden');
        lastY = y;
      }, { passive: true });
    }
  }
  // Legacy compat: reducedMotion was a boolean previously — migrate if still stored
  if (id === 'reducedMotion') { setSetting('motionLevel', val ? 'minimal' : 'default'); }
  if (id === 'compactMode') document.body.classList.toggle('sv-compact-mode', val);
  if (id === 'streamMode') {
    document.body.classList.toggle('sv-stream-mode', val);
    if (val) {
      _streamIds.clear(); _streamPage = 1;
      initStreamMode();
    } else {
      _streamObs?.disconnect();
      _streamPage = 1;
      _streamIds.clear();
    }
  }
  if (id === 'showRatings') document.body.classList.toggle('sv-hide-ratings', !val);
  if (id === 'useTitleLogos') {
    // Re-init the logo observer when the setting is toggled
    // Use setTimeout so initCardLogoObserver is guaranteed to be defined
    setTimeout(() => initCardLogoObserver(), 0);
  }
  if (id === 'disableAgeFilter') { if (val) { state.ageRating = 'NC-17'; persist('ageRating'); } }
  if (id === 'disableSandbox') {
    const frame = document.getElementById('player-frame');
    if (frame) {
      if (val) frame.removeAttribute('sandbox');
      else frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation');
    }
  }
  if (id === 'hideTabClips') {
    const tab = document.querySelector('.nav-tab[data-page="clips"]');
    if (tab) tab.style.display = val ? 'none' : '';
    const bnBtn = document.querySelector('#bottom-nav .bottom-nav-btn[data-page="clips"]');
    if (bnBtn) bnBtn.style.display = val ? 'none' : '';
  }
  if (id === 'hideTabAnime') {
    const tab = document.querySelector('.nav-tab[data-page="anime"]');
    if (tab) tab.style.display = val ? 'none' : '';
  }
}

/* ── STREAM MODE (infinite scroll feed) — declarations moved above ── */
// (variables declared at top of file to avoid TDZ in applyAllSettings)

function initStreamMode() {
  _streamPage = 1;
  _streamIds.clear();
  _streamLoading = false;

  // Create or find the stream section
  let sec = document.getElementById('sec-stream-mode');
  if (!sec) {
    sec = document.createElement('div');
    sec.id = 'sec-stream-mode';
    sec.className = 'sv-stream-section';
    // Insert at top of home page (after hero)
    const hero = document.getElementById('hero');
    if (hero?.parentNode) hero.parentNode.insertBefore(sec, hero.nextSibling);
    else document.getElementById('page-home')?.prepend(sec);
  }
  sec.innerHTML = `<div class="stream-grid" id="stream-grid"></div>
    <div class="stream-sentinel" id="stream-sentinel" style="height:40px"></div>`;

  // Initial load
  loadStreamPage();

  // Observe sentinel for infinite scroll
  _streamObs?.disconnect();
  _streamObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !_streamLoading) loadStreamPage();
  }, { rootMargin: '600px' });

  const sentinel = document.getElementById('stream-sentinel');
  if (sentinel) _streamObs.observe(sentinel);
}

async function loadStreamPage() {
  if (_streamLoading) return;
  _streamLoading = true;

  const grid = document.getElementById('stream-grid');
  if (!grid) { _streamLoading = false; return; }

  // Show loading indicator on first page
  if (_streamPage === 1) grid.innerHTML = skelCards(12);

  try {
    const prefG = state.prefGenres;
    const pg = _streamPage;

    // Fetch movies and TV in parallel, mix them
    const [movies, shows, topMovies] = await Promise.allSettled([
      tmdb('/discover/movie', {
        sort_by: 'popularity.desc',
        page: pg,
        ...(prefG.length ? { with_genres: prefG.slice(0, 2).join('|') } : {}),
      }),
      tmdb('/discover/tv', {
        sort_by: 'popularity.desc',
        page: pg,
        ...(prefG.length ? { with_genres: prefG.slice(0, 2).join('|') } : {}),
      }),
      pg <= 3 ? tmdb('/movie/top_rated', { page: pg }) : Promise.resolve({ results: [] }),
    ]);

    const m = movies.status === 'fulfilled' ? (movies.value.results || []) : [];
    const s = shows.status === 'fulfilled' ? (shows.value.results || []) : [];
    const t = topMovies.status === 'fulfilled' ? (topMovies.value.results || []) : [];

    // Interleave: movie, show, movie, show, top-rated
    const items = [];
    const maxLen = Math.max(m.length, s.length);
    for (let i = 0; i < maxLen; i++) {
      if (m[i] && !_streamIds.has(m[i].id)) { items.push({ ...m[i], media_type: 'movie' }); _streamIds.add(m[i].id); }
      if (s[i] && !_streamIds.has(s[i].id)) { items.push({ ...s[i], media_type: 'tv' }); _streamIds.add(s[i].id); }
      if (t[i] && !_streamIds.has(t[i].id)) { items.push({ ...t[i], media_type: 'movie' }); _streamIds.add(t[i].id); }
    }

    if (_streamPage === 1) grid.innerHTML = '';
    const html = items.map(m => makeCard(m, m.media_type === 'tv' ? 'tv' : 'movie')).join('');
    grid.insertAdjacentHTML('beforeend', html);
    _streamPage++;

  } catch (err) {
    console.warn('[SV] Stream load error:', err?.message);
    if (_streamPage === 1) grid.innerHTML = '<p class="muted-note" style="padding:1rem">Could not load stream.</p>';
  }
  _streamLoading = false;
}

function applyAllSettings() {
  SV_SETTINGS.forEach(s => applySetting(s.id, getSetting(s.id)));
}

function buildSettingsUI() {
  const grid = document.getElementById('sv-settings-grid');
  if (!grid) return;

  // Group settings by their group field (mobile-only settings hidden on
  // desktop; Apple-only settings hidden on non-Apple devices)
  const isMobileViewport = window.matchMedia('(max-width: 720px)').matches;
  const groups = {};
  SV_SETTINGS.forEach(s => {
    if (s.mobileOnly && !isMobileViewport) return;
    if (s.appleOnly && !_isApplePlatform()) return;
    const g = s.group || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });

  const renderSetting = s => {
    const val = getSetting(s.id);

    // 3-position slider (e.g. animation level)
    if (s.type === 'slider3' && s.options?.length === 3) {
      const idx = s.options.indexOf(val);
      const cur = idx < 0 ? 2 : idx; // default to last (right-most)
      return `<div class="sv-setting-row sv-setting-slider3" title="${esc(s.desc)}" data-setting="${esc(s.id)}">
        <span class="material-icons-round sv-setting-icon">${s.icon}</span>
        <div class="sv-setting-info">
          <span class="sv-setting-label">${esc(s.label)}</span>
          <span class="sv-setting-desc sv-slider3-desc">${esc(s.optLabels?.[cur] || s.options[cur])}: ${esc(s.desc)}</span>
        </div>
        <div class="sv-slider3-wrap">
          <div class="sv-slider3-labels" aria-hidden="true">
            ${s.optLabels ? s.optLabels.map(l => `<span>${esc(l)}</span>`).join('') : s.options.map(o => `<span>${esc(o)}</span>`).join('')}
          </div>
          <input type="range" class="sv-slider3-input" min="0" max="2" step="1" value="${cur}"
            data-setting="${esc(s.id)}" data-options="${esc(JSON.stringify(s.options))}"
            aria-label="${esc(s.label)}" aria-valuetext="${esc(s.optLabels?.[cur] || s.options[cur])}">
          <div class="sv-slider3-track" aria-hidden="true">
            ${[0,1,2].map(i => `<div class="sv-slider3-notch${i === cur ? ' active' : ''}"></div>`).join('')}
          </div>
        </div>
      </div>`;
    }

    // Select-type setting
    if (s.type === 'select' && s.options) {
      const opts = s.options.map((o, i) =>
        `<option value="${esc(o)}"${val === o ? ' selected' : ''}>${esc(s.optLabels?.[i] || o)}</option>`
      ).join('');
      return `<label class="sv-setting-row sv-setting-select" title="${esc(s.desc)}">
        <span class="material-icons-round sv-setting-icon">${s.icon}</span>
        <div class="sv-setting-info">
          <span class="sv-setting-label">${esc(s.label)}</span>
          <span class="sv-setting-desc">${esc(s.desc)}</span>
        </div>
        <select class="sv-setting-sel" data-setting="${esc(s.id)}">${opts}</select>
      </label>`;
    }

    // Boolean toggle
    const on = !!val;
    return `<label class="sv-setting-row" title="${esc(s.desc)}">
      <span class="material-icons-round sv-setting-icon">${s.icon}</span>
      <div class="sv-setting-info">
        <span class="sv-setting-label">${esc(s.label)}</span>
        <span class="sv-setting-desc">${esc(s.desc)}</span>
      </div>
      <button class="sv-toggle${on ? ' on' : ''}" data-setting="${esc(s.id)}" role="switch" aria-checked="${on}" aria-label="${esc(s.label)}">
        <span class="sv-toggle-knob"></span>
      </button>
    </label>`;
  };

  let html = '';
  for (const [groupName, settings] of Object.entries(groups)) {
    html += `<div class="settings-group-header">${groupName}</div>`;
    html += settings.map(renderSetting).join('');
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.sv-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.setting;
      const newVal = !getSetting(id);
      setSetting(id, newVal);
      btn.classList.toggle('on', newVal);
      btn.setAttribute('aria-checked', String(newVal));
    });
  });

  grid.querySelectorAll('.sv-setting-sel').forEach(sel => {
    sel.addEventListener('change', () => {
      setSetting(sel.dataset.setting, sel.value);
    });
  });

  grid.querySelectorAll('.sv-slider3-input').forEach(input => {
    const update = () => {
      const opts = JSON.parse(input.dataset.options || '[]');
      const idx = +input.value;
      const val = opts[idx] ?? opts[opts.length - 1];
      const id = input.dataset.setting;
      setSetting(id, val);
      // Update label text and aria
      const s = SV_SETTINGS.find(x => x.id === id);
      const labelText = s?.optLabels?.[idx] || val;
      input.setAttribute('aria-valuetext', labelText);
      const descEl = input.closest('.sv-setting-slider3')?.querySelector('.sv-slider3-desc');
      if (descEl) descEl.textContent = `${labelText}: ${s?.desc || ''}`;
      // Update notch states
      input.closest('.sv-slider3-wrap')?.querySelectorAll('.sv-slider3-notch').forEach((n, i) => {
        n.classList.toggle('active', i === idx);
      });
    };
    input.addEventListener('input', update);
  });
}

const _prefListSkeleton = `
  <div class="pref-tag pref-tag-sk sk" style="width:120px;height:32px"></div>
  <div class="pref-tag pref-tag-sk sk" style="width:90px;height:32px"></div>
  <div class="pref-tag pref-tag-sk sk" style="width:140px;height:32px"></div>`;

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
      </div>`).join('') || `<div class="pref-list-empty">${_prefListSkeleton}<p class="muted-note" style="font-size:.78rem;margin-top:.6rem">Search for titles above to add them here</p></div>`;
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
      </div>`).join('') || `<div class="pref-list-empty">${_prefListSkeleton}<p class="muted-note" style="font-size:.78rem;margin-top:.6rem">Search for titles above to add them here</p></div>`;
  }
}

/* ── TAG PREFS SECTION ───────────────────────────────────────────── */
function renderTagPrefsSection() {
  const sec = document.getElementById('pref-tags-section');
  if (!sec) return;

  const likes    = state.prefTagLikes;
  const dislikes = state.prefTagDislikes;

  const likeChips = likes.map(t =>
    `<span class="pref-keyword-chip liked" data-tag-id="${t.id}" data-tag-type="like">
      <span class="material-icons-round" style="font-size:.7rem;color:#4ade80">favorite</span>
      ${esc(t.name)}
      <button class="pref-kw-browse" data-browse-tag-id="${t.id}" data-browse-tag-name="${esc(t.name)}" title="Browse content with this tag" aria-label="Browse ${esc(t.name)}">
        <span class="material-icons-round">movie_filter</span>
      </button>
      <button class="pref-kw-remove" data-remove-tag-like="${t.id}" aria-label="Remove">
        <span class="material-icons-round">close</span>
      </button>
    </span>`
  ).join('');

  const dislikeChips = dislikes.map(t =>
    `<span class="pref-keyword-chip disliked" data-tag-id="${t.id}" data-tag-type="dislike">
      <span class="material-icons-round" style="font-size:.7rem;color:#f87171">thumb_down</span>
      ${esc(t.name)}
      <button class="pref-kw-browse" data-browse-tag-id="${t.id}" data-browse-tag-name="${esc(t.name)}" title="Browse content with this tag" aria-label="Browse ${esc(t.name)}">
        <span class="material-icons-round">movie_filter</span>
      </button>
      <button class="pref-kw-remove" data-remove-tag-dislike="${t.id}" aria-label="Remove">
        <span class="material-icons-round">close</span>
      </button>
    </span>`
  ).join('');

  sec.innerHTML = `
    <!-- Tag search -->
    <div class="pref-tag-search-wrap" style="margin-bottom:.75rem">
      <div class="pref-tag-search-row">
        <span class="material-icons-round" style="color:var(--dim);font-size:1rem">search</span>
        <input class="pref-tag-search-input" id="pref-tag-search-input" type="text"
          placeholder="Search for a keyword tag to add…" autocomplete="off" spellcheck="false">
      </div>
      <div id="pref-tag-search-results" class="pref-tag-search-results"></div>
    </div>
    ${likes.length ? `
      <div class="pref-tag-subhead">
        <span class="material-icons-round" style="color:#4ade80;font-size:.9rem">favorite</span>
        Liked Tags
      </div>
      <div class="pref-keyword-row">${likeChips}</div>
    ` : ''}
    ${dislikes.length ? `
      <div class="pref-tag-subhead" style="margin-top:${likes.length ? '.8rem' : '0'}">
        <span class="material-icons-round" style="color:#f87171;font-size:.9rem">thumb_down</span>
        Disliked Tags
      </div>
      <div class="pref-keyword-row">${dislikeChips}</div>
    ` : ''}
    ${!likes.length && !dislikes.length ? `
      <p class="muted-note" style="font-size:.78rem;color:var(--dim);margin-top:.35rem">No tag preferences yet — search above or open a title and click a keyword tag.</p>
    ` : ''}
  `;

  // Wire tag search
  const searchInput = sec.querySelector('#pref-tag-search-input');
  const searchResults = sec.querySelector('#pref-tag-search-results');
  if (searchInput && searchResults) {
    let _tagSearchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(_tagSearchTimer);
      const q = searchInput.value.trim();
      if (!q) { searchResults.innerHTML = ''; return; }
      searchResults.innerHTML = `<span style="font-size:.72rem;color:var(--dim)">Searching…</span>`;
      _tagSearchTimer = setTimeout(async () => {
        try {
          const data = await tmdb('/search/keyword', { query: q });
          const kws = (data.results || []).slice(0, 12);
          if (!kws.length) { searchResults.innerHTML = `<span style="font-size:.72rem;color:var(--dim)">No results for "${esc(q)}"</span>`; return; }
          searchResults.innerHTML = kws.map(kw => {
            const isLiked    = state.prefTagLikes.some(t => t.id === kw.id);
            const isDisliked = state.prefTagDislikes.some(t => t.id === kw.id);
            return `<span class="pref-kw-result" data-kw-id="${kw.id}" data-kw-name="${esc(kw.name)}">
              ${esc(kw.name)}
              <button class="pref-kw-result-btn like${isLiked ? ' active' : ''}" data-kw-like="${kw.id}" title="Like tag">
                <span class="material-icons-round">favorite${isLiked ? '' : '_border'}</span>
              </button>
              <button class="pref-kw-result-btn dislike${isDisliked ? ' active' : ''}" data-kw-dislike="${kw.id}" title="Dislike tag">
                <span class="material-icons-round">thumb_down${isDisliked ? '' : '_off_alt'}</span>
              </button>
            </span>`;
          }).join('');
          // Wire result buttons
          searchResults.querySelectorAll('[data-kw-like]').forEach(btn => {
            btn.addEventListener('click', e => {
              e.stopPropagation();
              const id = +btn.dataset.kwLike;
              const name = btn.closest('[data-kw-name]')?.dataset.kwName || '';
              if (state.prefTagLikes.some(t => t.id === id)) {
                state.prefTagLikes = state.prefTagLikes.filter(t => t.id !== id);
                persist('prefTagLikes');
              } else {
                state.prefTagDislikes = state.prefTagDislikes.filter(t => t.id !== id);
                persist('prefTagDislikes');
                state.prefTagLikes.push({ id, name });
                if (state.prefTagLikes.length > 40) state.prefTagLikes = state.prefTagLikes.slice(-40);
                persist('prefTagLikes');
                toast(`Liked tag: ${name}`, 'favorite');
              }
              renderTagPrefsSection();
            });
          });
          searchResults.querySelectorAll('[data-kw-dislike]').forEach(btn => {
            btn.addEventListener('click', e => {
              e.stopPropagation();
              const id = +btn.dataset.kwDislike;
              const name = btn.closest('[data-kw-name]')?.dataset.kwName || '';
              if (state.prefTagDislikes.some(t => t.id === id)) {
                state.prefTagDislikes = state.prefTagDislikes.filter(t => t.id !== id);
                persist('prefTagDislikes');
              } else {
                state.prefTagLikes = state.prefTagLikes.filter(t => t.id !== id);
                persist('prefTagLikes');
                state.prefTagDislikes.push({ id, name });
                if (state.prefTagDislikes.length > 40) state.prefTagDislikes = state.prefTagDislikes.slice(-40);
                persist('prefTagDislikes');
                toast(`Disliked tag: ${name}`, 'thumb_down');
              }
              renderTagPrefsSection();
            });
          });
        } catch {
          searchResults.innerHTML = `<span style="font-size:.72rem;color:var(--dim)">Search failed</span>`;
        }
      }, 320);
    });
  }

  // Wire "browse content" buttons — opens search page with :tag topic search
  sec.querySelectorAll('[data-browse-tag-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagName = btn.dataset.browseTagName;
      if (!tagName) return;
      closeInfoPage?.();
      goPage('search');
      setTimeout(() => {
        const inp = document.getElementById('search-input');
        if (inp) {
          inp.value = ':' + tagName;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 150);
    });
  });

  // Wire remove buttons
  sec.querySelectorAll('[data-remove-tag-like]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagId = +btn.dataset.removeTagLike;
      state.prefTagLikes = state.prefTagLikes.filter(t => t.id !== tagId);
      persist('prefTagLikes');
      renderTagPrefsSection();
    });
  });
  sec.querySelectorAll('[data-remove-tag-dislike]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagId = +btn.dataset.removeTagDislike;
      state.prefTagDislikes = state.prefTagDislikes.filter(t => t.id !== tagId);
      persist('prefTagDislikes');
      renderTagPrefsSection();
    });
  });
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
  // Redirect to info page if that's the user's default preference
  // On mobile (≤720px), info page is the default to prevent accidental playback
  const isMobile = window.innerWidth <= 720;
  if ((getSetting('defaultInfoMode') || isMobile) && !hint._forcePlayer) {
    return openInfoPage(id, type, hint);
  }

  // Close other overlays first
  document.getElementById('person-overlay')?.classList.remove('open');
  document.getElementById('info-overlay')?.classList.remove('open');
  document.getElementById('company-overlay')?.classList.remove('open');
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  clearHoverTrailer();
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
  const ratingBadge = document.getElementById('age-warn-rating');
  const msg = document.getElementById('age-warn-msg');
  const allowTypeBtn = document.getElementById('warn-allow-type-btn');
  if (ratingBadge) ratingBadge.textContent = rating;
  if (msg) msg.textContent = `This content is rated "${rating}" — above your setting of "${state.ageRating}".`;
  if (allowTypeBtn) allowTypeBtn.textContent = `Update rating to ${rating}`;
  // Store for allow handlers
  if (state.currentMedia) state.currentMedia._contentRating = rating;
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
      <button class="ep-jump-related" id="ep-jump-related" style="display:none" title="Jump to similar titles">
        <span class="material-icons-round">arrow_downward</span> More Like This
      </button>
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

    // Prevent <a> card from navigating — we handle it via JS
    e.preventDefault();

    const itemId = +card.dataset.id;
    const itemType = card.dataset.type;
    if (itemId && itemType) {
      // If clicked from inside person overlay, close it first so media opens on top
      const personOv = document.getElementById('person-overlay');
      if (personOv?.classList.contains('open') && e.target.closest('#person-overlay')) {
        personOv.classList.remove('open');
        document.body.style.overflow = '';
      }
      openMedia(itemId, itemType, {
        title: card.dataset.title,
        poster_path: card.dataset.poster,
        backdrop_path: card.dataset.backdrop,
      });
    }
  });

  // Keyboard on cards — Space only (<a> cards fire click on Enter natively)
  document.addEventListener('keydown', e => {
    if (e.key !== ' ') return;
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
    const targetPage = pageEl.dataset.page;
    // Pause all clips when leaving the clips page
    if (state.currentPage === 'clips' && targetPage !== 'clips') _pauseAllClips();
    goPage(targetPage);
  });

  // Sub-nav scrolling (Movies / TV / Anime page category tabs)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.page-subnav-btn[data-subnav-target]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.subnavTarget);
    if (!target) return;
    // Update active state
    btn.closest('.page-subnav')?.querySelectorAll('.page-subnav-btn').forEach(b => {
      b.classList.toggle('on', b === btn);
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    // Scroll the section into view below the sticky header + subnav
    const subnav = btn.closest('.page-subnav');
    const headerH = document.getElementById('header')?.offsetHeight || 64;
    const subnavH = subnav?.offsetHeight || 46;
    const offset = target.getBoundingClientRect().top + window.scrollY - headerH - subnavH - 8;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  });

  // Update sub-nav active state on scroll via IntersectionObserver
  document.querySelectorAll('.page-subnav').forEach(nav => {
    const targets = [...nav.querySelectorAll('.page-subnav-btn[data-subnav-target]')]
      .map(b => document.getElementById(b.dataset.subnavTarget))
      .filter(Boolean);

    const sectionObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          nav.querySelectorAll('.page-subnav-btn').forEach(b => {
            const active = b.dataset.subnavTarget === id;
            b.classList.toggle('on', active);
            if (active) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          });
        }
      });
    }, { rootMargin: '-64px 0px -60% 0px', threshold: 0 });

    targets.forEach(t => sectionObs.observe(t));
  });

  // Shortcuts button in footer
  document.getElementById('footer-shortcuts-btn')?.addEventListener('click', showShortcuts);

  // Open media from search autocomplete
  document.addEventListener('sv:open-media', e => {
    if (e.detail?.id && e.detail?.type) openMedia(e.detail.id, e.detail.type);
  });

  // Re-trigger search with updated filters
  document.addEventListener('sv:do-search', e => {
    if (e.detail) doSearch(e.detail);
  });

  // Click handler for actor name links in search results
  document.getElementById('search-results-area')?.addEventListener('click', e => {
    const link = e.target.closest('.search-actor-link');
    if (link?.dataset.personId) {
      openPersonPage(+link.dataset.personId);
    }
  });

  // Play Now triggered from trailer fallback overlay
  document.addEventListener('sv:play-now', () => {
    if (state.currentMedia) {
      const { useId, id, type } = state.currentMedia;
      loadPlayer(useId || id, type, 1, 1);
    }
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
  document.getElementById('theme-toggle')?.addEventListener('click', e => { e.stopPropagation(); toggleThemeMenu(); });

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
      if (key) openTrailerOverlay(key, title, state.currentMedia?.details);
    }
    else if (action === 'modal-watchlist') { handleWatchlist(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-like') { handleLike(id, type, null, meta); renderModalActions(state.currentMedia); }
    else if (action === 'modal-dislike') {
      addDislike(meta);
      // Auto-add to "Titles I Dislike" in CYF
      if (!state.prefDislikes.some(x => x.id == id)) {
        state.prefDislikes.push({
          id: meta.id, type: meta.type || type, title: meta.title || '',
          poster: meta.poster_path ? imgUrl(meta.poster_path, 'w92') : '',
        });
        persist('prefDislikes');
      }
      // Don't close the modal
      renderModalActions(state.currentMedia);
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
    ['library', 'providers', 'prefs'].forEach(n => {
      const el = document.getElementById(`lib-tab-${n}`);
      if (el) el.style.display = tabName === n ? '' : 'none';
    });
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

  // Library provider buttons → open provider page (not search)
  document.getElementById('page-library')?.addEventListener('click', e => {
    const card = e.target.closest('.lib-prov-card, .lib-qp-btn');
    if (!card) return;
    const id = +card.dataset.provId;
    const name = card.dataset.provName || '';
    if (id) openProviderPage(id, name);
  });

  // Age warn buttons
  document.getElementById('warn-proceed-btn')?.addEventListener('click', () => {
    document.getElementById('age-warn').style.display = 'none';
    if (state.currentMedia) loadPlayer(state.currentMedia.useId || state.currentMedia.id, state.currentMedia.type, 1, 1);
  });
  document.getElementById('warn-allow-type-btn')?.addEventListener('click', () => {
    // Raise content rating to match this specific content
    const aw = document.getElementById('age-warn');
    if (!aw) return;
    aw.style.display = 'none';
    // Set rating to NC-17 so this type shows up
    const newRating = state.currentMedia?._contentRating || 'R';
    state.ageRating = newRating;
    persist('ageRating');
    toast(`Content rating updated to ${newRating}`, 'child_care');
    if (state.currentMedia) loadPlayer(state.currentMedia.useId || state.currentMedia.id, state.currentMedia.type, 1, 1);
  });
  document.getElementById('warn-allow-all-btn')?.addEventListener('click', () => {
    state.ageRating = 'NC-17';
    persist('ageRating');
    document.getElementById('age-warn').style.display = 'none';
    toast('All content ratings unlocked', 'lock_open');
    if (state.currentMedia) loadPlayer(state.currentMedia.useId || state.currentMedia.id, state.currentMedia.type, 1, 1);
  });
  document.getElementById('warn-back-btn')?.addEventListener('click', closeModal);

  // Close "More Sources" panel when clicking outside provider bar or panel
  document.addEventListener('click', e => {
    if (!e.target.closest('#provider-bar') && !e.target.closest('#prov-more-panel') && !e.target.closest('#prov-more-toggle')) {
      const panel = document.getElementById('prov-more-panel');
      if (panel && panel.style.display !== 'none') {
        panel.style.display = 'none';
        document.getElementById('prov-more-toggle')?.classList.remove('on');
      }
    }
  }, true);

  // Provider bar
  document.addEventListener('click', e => {
    const pBtn = e.target.closest('[data-provider]');
    if (pBtn && (pBtn.closest('#provider-bar') || pBtn.closest('#prov-more-panel'))) {
      if (!state.currentMedia) return;
      setActiveProvider(pBtn.dataset.provider);
      const { useId, id, type } = state.currentMedia;
      const uid = useId || id;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const activeEp = document.querySelector('.ep-card.on');
      const ep = activeEp ? +activeEp.dataset.ep : 1;
      // Close the "more" panel after selecting
      const morePanel = document.getElementById('prov-more-panel');
      if (morePanel) morePanel.style.display = 'none';
      document.getElementById('prov-more-toggle')?.classList.remove('on');
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
    // Sandbox force-override toggle
    const sbBtn = e.target.closest('#prov-sandbox-btn');
    if (sbBtn) {
      const newState = cycleSandboxForce();
      const label = newState === false ? 'Sandbox: Off' : newState === true ? 'Sandbox: On' : 'Sandbox: Auto';
      if (newState === false) {
        toast('Sandbox Off — pop-ups may appear. Close unexpected windows.', 'warning');
      } else {
        toast(label, 'security');
      }
      if (state.currentMedia) {
        const { useId, id, type } = state.currentMedia;
        const sel = document.getElementById('season-sel');
        const s = sel ? +sel.value : 1;
        const activeEp = document.querySelector('.ep-card.on');
        const ep = activeEp ? +activeEp.dataset.ep : 1;
        buildProviderBar(useId || id, type, s, ep);
        loadPlayer(useId || id, type, s, ep);
      }
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

  // Auto-apply when leaving CYF page (set window._prefsDirty on pref changes)
  window._autoApplyFeed = () => { window._prefsDirty = false; refreshFeed(false, true); };

  // Feed randomize (stays in CYF, randomizes content)
  document.getElementById('pref-randomize-btn')?.addEventListener('click', e => {
    window._prefsDirty = false;
    refreshFeed(true, e.shiftKey);
  });

  // VidSrc test all
  document.getElementById('vidsrc-test-all-btn')?.addEventListener('click', testAllVidsrcDomains);

  // ── DATA MANAGEMENT ────────────────────────────────────────────────
  const confirmClear = async (label, key, display) => {
    if (await showConfirm(`Clear ${display}`, `Remove all ${display.toLowerCase()}? This cannot be undone.`)) {
      clearSection(key, display);
    }
  };

  // Use querySelectorAll to wire ALL matching buttons (some IDs are duplicated between
  // the per-section quick-clear buttons and the Data & Privacy section)
  const bindAll = (id, fn) => document.querySelectorAll(`[id="${id}"]`).forEach(el => el.addEventListener('click', fn));
  bindAll('btn-clear-watchlist', () => confirmClear('watchlist', 'watchlist', 'Watchlist'));
  bindAll('btn-clear-liked',     () => confirmClear('liked', 'liked', 'Liked Titles'));
  bindAll('btn-clear-disliked',  () => confirmClear('disliked', 'disliked', 'Disliked Titles'));
  bindAll('btn-clear-recent',    () => confirmClear('recent', 'recentlyViewed', 'Recently Viewed'));
  bindAll('btn-clear-continue',  () => confirmClear('continue', 'continueWatching', 'Continue Watching'));

  document.getElementById('btn-clear-watched')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Watched', 'Remove all watched marks? Content may reappear in recommendations.')) {
      state.watched = []; persist('watched');
      renderLibrary(); toast('Watched list cleared', 'visibility');
    }
  });
  document.getElementById('btn-clear-impressions')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Content History', 'Clear impression data? You may see previously-hidden content again.')) {
      state.impressions = {}; persist('impressions');
      _clearRowCache(); toast('Content history cleared', 'refresh');
    }
  });
  document.getElementById('btn-clear-prefLikes')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Titles I Love', 'Remove all manually added titles from your "Titles I Love" list in Customize Feed?')) {
      state.prefLikes = []; persist('prefLikes');
      renderPrefLists(); toast('Titles I Love cleared', 'favorite_border');
    }
  });
  document.getElementById('btn-clear-prefDislikes')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Titles I Dislike', 'Remove all manually added titles from your "Titles I Dislike" list?')) {
      state.prefDislikes = []; persist('prefDislikes');
      renderPrefLists(); toast('Titles I Dislike cleared', 'thumb_down_off_alt');
    }
  });
  document.getElementById('btn-clear-tag-prefs')?.addEventListener('click', async () => {
    if (await showConfirm('Clear Tag Preferences', 'Remove all liked and disliked tag preferences?')) {
      state.prefTagLikes = []; persist('prefTagLikes');
      state.prefTagDislikes = []; persist('prefTagDislikes');
      renderTagPrefsSection(); toast('Tag preferences cleared', 'tag');
    }
  });
  document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
    if (await showConfirm('Reset ALL Data', 'This permanently clears EVERYTHING: watchlist, liked, history, preferences, settings. Cannot be undone.')) clearAllData();
  });

  // ── REPAIR LIBRARY ─────────────────────────────────────────────────
  document.getElementById('btn-repair-data')?.addEventListener('click', async () => {
    if (!(await showConfirm('Repair Library', 'Re-fetch missing metadata for your saved titles? This may take a moment.'))) return;

    toast('Repairing library…', 'build');
    let fixed = 0;

    // Step 1: Remove corrupt entries (null ID, empty title, etc.)
    let removed = 0;
    const removeCorrupt = (key) => {
      const before = state[key]?.length || 0;
      state[key] = (state[key] || []).filter(item => {
        const valid = item && +item.id > 0;
        if (!valid) removed++;
        return valid;
      });
      if (state[key].length !== before) persist(key);
    };
    ['liked', 'watchlist', 'disliked', 'watched', 'prefLikes', 'prefDislikes'].forEach(removeCorrupt);

    // Step 2: Re-fetch missing metadata for items with incomplete data
    const repairList = async (list, key) => {
      for (const item of list) {
        if (!item.id || !item.type || item.type === 'anime') continue;
        const needsRepair = !item.title && !item.name;
        const hasPartialData = item.type && item.id;
        if (!needsRepair && !hasPartialData) continue;
        if (item.title && item.poster_path) continue; // already complete
        try {
          const d = await tmdb(`/${item.type}/${item.id}`);
          if (d.title || d.name) { item.title = d.title || d.name; fixed++; }
          if (d.poster_path) item.poster_path = d.poster_path;
          if (d.backdrop_path) item.backdrop_path = d.backdrop_path;
          if (d.vote_average) item.vote_average = d.vote_average;
        } catch {}
      }
      persist(key);
    };

    await repairList(state.prefLikes, 'prefLikes');
    await repairList(state.prefDislikes, 'prefDislikes');
    await repairList(state.watchlist, 'watchlist');
    await repairList(state.liked, 'liked');

    renderLibrary();
    renderPrefLists();
    toast(`Repair complete — removed ${removed} corrupt, fixed ${fixed} item${fixed !== 1 ? 's' : ''}`, 'check_circle');
  });

  // Export data
  document.getElementById('btn-export-data')?.addEventListener('click', () => {
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      watchlist:        state.watchlist,
      liked:            state.liked,
      disliked:         state.disliked,
      watched:          state.watched,
      recentlyViewed:   state.recentlyViewed.slice(0, 100),
      continueWatching: state.continueWatching,
      prefLikes:        state.prefLikes,
      prefDislikes:     state.prefDislikes,
      prefGenres:           state.prefGenres,
      prefGenreDislikes:    state.prefGenreDislikes,
      prefTagLikes:         state.prefTagLikes,
      prefTagDislikes:  state.prefTagDislikes,
      ageRating:        state.ageRating,
      recentSearches:   state.recentSearches,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staticvault-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Data exported!', 'download');
  });

  // Import data
  document.getElementById('btn-import-data')?.addEventListener('change', async function() {
    const file = this.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.version !== 2 && !data.watchlist) {
          toast('Invalid backup file', 'error');
          return;
        }

        const choice = await showChoice(
          'Import Data',
          'How would you like to import this backup?',
          [
            { label: 'Create New Profile', value: 'new', style: 'primary' },
            { label: 'Merge into Current Profile', value: 'merge' },
            { label: 'Cancel', value: 'cancel' },
          ]
        );
        if (!choice || choice === 'cancel') return;

        // Merge arrays (avoid duplicates by id)
        const merge = (existing, imported) => {
          const ids = new Set(existing.map(x => x.id));
          return [...existing, ...(imported || []).filter(x => !ids.has(x.id))];
        };

        const applyData = () => {
          if (data.watchlist)        { state.watchlist = merge(state.watchlist, data.watchlist); persist('watchlist'); }
          if (data.liked)            { state.liked = merge(state.liked, data.liked); persist('liked'); }
          if (data.disliked)         { state.disliked = merge(state.disliked, data.disliked); persist('disliked'); }
          if (data.watched)          { state.watched = merge(state.watched, data.watched); persist('watched'); }
          if (data.prefLikes)        { state.prefLikes = merge(state.prefLikes, data.prefLikes); persist('prefLikes'); }
          if (data.prefDislikes)     { state.prefDislikes = merge(state.prefDislikes, data.prefDislikes); persist('prefDislikes'); }
          if (data.prefGenres)           { state.prefGenres = [...new Set([...state.prefGenres, ...(data.prefGenres || [])])]; persist('prefGenres'); }
          if (data.prefGenreDislikes)    { state.prefGenreDislikes = [...new Set([...state.prefGenreDislikes, ...(data.prefGenreDislikes || [])])]; persist('prefGenreDislikes'); }
          if (data.prefTagLikes)         { state.prefTagLikes = merge(state.prefTagLikes, data.prefTagLikes); persist('prefTagLikes'); }
          if (data.prefTagDislikes)  { state.prefTagDislikes = merge(state.prefTagDislikes, data.prefTagDislikes); persist('prefTagDislikes'); }
          if (data.continueWatching) { Object.assign(state.continueWatching, data.continueWatching); persist('continueWatching'); }
          if (data.ageRating)        { state.ageRating = data.ageRating; persist('ageRating'); }
        };

        if (choice === 'new') {
          const profiles = getProfiles();
          if (profiles.length >= MAX_PROFILES) {
            toast(`Max ${MAX_PROFILES} profiles reached`, 'error'); return;
          }
          // Generate a unique name based on export date
          const dateStr = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Imported';
          const baseName = `Import ${dateStr}`;
          let newName = baseName;
          let counter = 2;
          while (profiles.some(p => p.name === newName)) { newName = `${baseName} (${counter++})`; }
          const newProf = createProfile(newName);
          if (!newProf) { toast('Could not create profile', 'error'); return; }
          switchProfile(newProf.id);
          updateProfileHeaderBtn();
          applyAllSettings();
          applyData();
          renderLibrary();
          renderProfilesGrid();
          // Reload home for new profile
          _clearRowCache();
          _homeLoading = false;
          loadHero().catch(() => {});
          loadHomeRows().catch(() => {});
          toast(`Created profile "${newName}" with imported data!`, 'person');
        } else {
          applyData();
          renderLibrary();
          toast('Data merged into current profile!', 'check_circle');
        }
      } catch (err) {
        toast(`Import failed: ${err.message || 'Invalid file'}`, 'error');
      }
    };
    reader.readAsText(file);
    this.value = ''; // reset so same file can be re-selected
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

  // For You expand/fullscreen button
  document.getElementById('foryou-expand-btn')?.addEventListener('click', () => {
    const sec = document.getElementById('sec-foryou');
    const btn = document.getElementById('foryou-expand-btn');
    const icon = btn?.querySelector('.material-icons-round');
    if (!sec) return;
    const expanded = sec.classList.toggle('expanded');
    if (icon) icon.textContent = expanded ? 'fullscreen_exit' : 'fullscreen';
  });

  // Cast member click opens person filmography page
  document.addEventListener('click', e => {
    const castCard = e.target.closest('.cast-card');
    if (!castCard) return;
    const personId = castCard.dataset.personId;
    if (personId) openPersonPage(+personId);
  });

  // Impression tracking via IntersectionObserver — count when cards are 50%+ visible
  const impressionObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const id = card.dataset.id;
      if (id && !isNaN(+id)) {
        recordImpression(+id);
      }
      impressionObs.unobserve(card); // only count once per session
    });
  }, { threshold: 0.5 });

  // Observe new cards as they're added to the DOM
  const cardObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('.card[data-id]')) impressionObs.observe(node);
        node.querySelectorAll?.('.card[data-id]').forEach(c => impressionObs.observe(c));
      });
    });
  });
  cardObserver.observe(document.getElementById('page-home') || document.body, { childList: true, subtree: true });
}

/* ── LIKE/WATCHLIST HELPERS ──────────────────────────────────────── */
function handleLike(id, type, btn, metaOverride) {
  const item = metaOverride || buildItemMeta(id, type);
  const added = toggleLike(item);
  if (added) {
    // Auto-add to "Titles I Love" in CYF — ONLY with valid, complete data
    const numId = +item.id;
    const hasTitle = !!(item.title || item.name);
    if (isValidItem(item) && hasTitle && !state.prefLikes.some(x => x.id == id)) {
      state.prefLikes.push({
        id: numId,
        type: item.type || type,
        title: (item.title || item.name || '').trim(),
        poster: item.poster_path ? imgUrl(item.poster_path, 'w92') : '',
        score: 4,
      });
      persist('prefLikes');
    }
  }
  // Note: removing a like does NOT auto-remove from prefLikes — must be done manually
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

/* ── INFO PAGE SEO ───────────────────────────────────────────────── */
function updateInfoPageSEO(title, type, details, infoUrl, bgImg) {
  const typeLabel = type === 'movie' ? 'Movie' : type === 'anime' ? 'Anime' : 'TV Show';
  const year = String(details.release_date || details.first_air_date || '').slice(0, 4);
  const rating = details.vote_average?.toFixed(1);
  const genres = (details.genres || []).map(g => g.name).join(', ');
  const cast = (details.credits?.cast || []).slice(0, 5).map(p => p.name).join(', ');

  const fullTitle = `${title} (${year}) — ${typeLabel} — Watch Free on StaticVault931`;
  const desc = [
    details.overview?.slice(0, 120),
    rating ? `Rated ${rating}/10` : '',
    genres,
    cast ? `Starring ${cast}` : '',
  ].filter(Boolean).join('. ').slice(0, 230);

  document.title = fullTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', fullTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', type === 'movie' ? 'video.movie' : 'video.tv_show');
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', location.origin + infoUrl);
  // Canonical always points to info page (most content)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', location.origin + infoUrl);
  if (bgImg) {
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', bgImg);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', bgImg);
  }

  // Rich JSON-LD for Google indexing
  const ldEl = document.getElementById('jsonld-media');
  if (ldEl) {
    ldEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': type === 'movie' ? 'Movie' : 'TVSeries',
      'name': title,
      'description': details.overview || '',
      'url': location.origin + infoUrl,
      'image': bgImg || '',
      ...(rating ? { 'aggregateRating': { '@type': 'AggregateRating', 'ratingValue': rating, 'ratingCount': details.vote_count || 1, 'bestRating': '10', 'worstRating': '1' } } : {}),
      ...(year ? { 'datePublished': `${year}-01-01` } : {}),
      ...(genres ? { 'genre': genres.split(', ') } : {}),
      ...(cast ? { 'actor': cast.split(', ').map(n => ({ '@type': 'Person', 'name': n })) } : {}),
      'potentialAction': {
        '@type': 'WatchAction',
        'target': location.origin + infoUrl.replace('&mode=info', '')
      },
    });
  }
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
  // Descriptive URL: ?watch=movie&name=inception-2010&id=550
  const titlePart = slugify(title || '');
  const slug = year ? `${titlePart}-${year}` : titlePart;
  return `${location.origin}${location.pathname}?watch=${encodeURIComponent(type)}&name=${encodeURIComponent(slug)}&id=${id}`;
}

function updatePageSEO(title, type, overview, poster) {
  const typeLabel = type === 'tv' ? 'TV Show' : type === 'anime' ? 'Anime' : 'Movie';
  const fullTitle = title
    ? `Watch ${title} Free Unblocked — ${typeLabel} — StaticVault931`
    : 'StaticVault931 — Free Unblocked Movies, TV Shows & Anime';
  const desc = overview
    ? overview.slice(0, 155) + (overview.length > 155 ? '…' : '')
    : `Watch ${title || 'content'} free and unblocked on StaticVault931. No account required.`;

  document.title = fullTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', fullTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', desc);
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', type === 'movie' ? 'video.movie' : 'video.tv_show');
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', location.href);
  // Watch pages canonical → info page (more content, better for SEO)
  const infoCanonical = location.href.includes('mode=info')
    ? location.href
    : location.href + (location.href.includes('?') ? '&mode=info' : '?mode=info');
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', infoCanonical);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', fullTitle);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', desc);
  if (poster) {
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', poster);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', poster);
  }

  // Structured data (JSON-LD)
  const ldEl = document.getElementById('jsonld-media');
  if (ldEl && title) {
    ldEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': type === 'movie' ? 'Movie' : 'TVSeries',
      'name': title,
      'description': desc,
      'url': location.href,
      ...(poster ? { 'image': poster } : {}),
    });
  }
}

function resetPageSEO() {
  document.title = 'StaticVault931 — Free Movies, TV Shows & Anime';
  document.querySelector('meta[name="description"]')?.setAttribute('content', 'Watch movies, TV shows, and anime free online. Personalized recommendations, no account needed.');
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', 'StaticVault931 — Free Movies, TV Shows & Anime');
  document.querySelector('meta[property="og:type"]')?.setAttribute('content', 'website');
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', 'https://staticvault931.github.io/');
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://staticvault931.github.io/');
  const ldEl = document.getElementById('jsonld-media');
  if (ldEl) ldEl.textContent = '';
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
      const countEl2 = document.getElementById('wt-count');
      if (countEl2) countEl2.closest('.watch-together-cd')?.remove();
      const loading = document.getElementById('player-loading');
      if (loading) loading.classList.add('hidden');
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

/* ── ANIMATED FEED REFRESH ───────────────────────────────────────── */
function animatedRefreshFeed() {
  const rows = Array.from(document.querySelectorAll('#page-home .card-row'));
  let delay = 0;

  // Stagger-out existing cards row by row
  rows.forEach(row => {
    const cards = Array.from(row.querySelectorAll('.card'));
    cards.forEach((card, j) => {
      setTimeout(() => {
        card.style.transition = 'opacity .25s, transform .25s';
        card.style.opacity = '0';
        card.style.transform = 'scale(.92) translateY(8px)';
      }, delay + j * 20);
    });
    delay += cards.length * 20 + 80;
  });

  // After cards fade out, clear cache and refresh (showing skeletons)
  const totalDelay = Math.min(delay, 800);
  setTimeout(() => {
    _clearRowCache();
    _homeLoading = false;
    _homeSeenIds.clear();
    // Always use a different page so content is genuinely new
    state._randomPage = Math.floor(Math.random() * 6) + 2;
    loadHero().catch(() => {});
    loadHomeRows().catch(() => {});
  }, totalDelay);

  toast('Refreshing with new content…', 'refresh');
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

  // Clear observers and allow loadHomeRows to run again
  _lazyObs.forEach(obs => obs.disconnect());
  _lazyObs.clear();
  _homeSeenIds.clear();
  _homeLoading = false;
  _clearRowCache(); // force fresh fetch on next load
  sessionStorage.removeItem('sv_trend_views'); // reset trending position to near-top

  // ALWAYS use a random page so refresh shows genuinely different content
  // Each refresh picks a new page (2-7) ensuring variety
  state._randomPage = Math.floor(Math.random() * 6) + 2;

  if (randomize) {
    toast('Feed randomized!', 'shuffle');
  } else {
    toast('Feed updated with fresh content!', 'check');
  }

  if (!stayOnPage) {
    goPage('home');
  } else {
    toast(randomize ? 'Feed randomized — scroll to see changes' : 'Feed updated!', randomize ? 'shuffle' : 'check');
  }
  // Reload all home rows
  loadHomeRows().catch(() => {});
}

/* ── INFO PAGE ───────────────────────────────────────────────────── */
function _showInfoTrailerFallback(trailerKey, posterImg, fallbackEl, frameEl) {
  if (frameEl) { frameEl.style.display = 'none'; frameEl.removeAttribute('src'); }
  if (!fallbackEl) return;
  fallbackEl.style.display = '';
  const bgStyle = posterImg ? `style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.3);"` : '';
  fallbackEl.innerHTML = `
    ${posterImg ? `<img src="${posterImg}" alt="" ${bgStyle}>` : ''}
    <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:.75rem;padding:1.5rem;">
      <span class="material-icons-round" style="font-size:2.2rem;color:rgba(255,255,255,.5)">videocam_off</span>
      <p style="font-size:.85rem;color:rgba(255,255,255,.75)">Trailer embedding not available</p>
      ${trailerKey ? `<a href="https://www.youtube.com/watch?v=${trailerKey}" target="_blank" rel="noopener"
        style="display:flex;align-items:center;gap:.35rem;background:rgba(229,9,20,.85);color:#fff;padding:.45rem 1rem;border-radius:4px;font-size:.78rem;font-weight:800;text-decoration:none;transition:opacity .2s">
        <span class="material-icons-round" style="font-size:.9rem">open_in_new</span> Watch on YouTube
      </a>` : ''}
    </div>`;
}

export async function openInfoPage(id, type, hint = {}) {
  clearHoverTrailer(); // stop hover trailer before opening info page
  // Close other overlays first — only one overlay open at a time
  document.getElementById('person-overlay')?.classList.remove('open');
  document.getElementById('company-overlay')?.classList.remove('open');
  const overlay = document.getElementById('info-overlay');
  if (!overlay) return;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Wire close/play/share buttons on first open
  if (!overlay._wired) {
    overlay._wired = true;
    document.getElementById('info-close')?.addEventListener('click', closeInfoPage);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeInfoPage(); });
    document.getElementById('info-play-btn')?.addEventListener('click', () => {
      if (!state.currentInfoMedia) return;
      const { id, type } = state.currentInfoMedia;
      closeInfoPage();
      setTimeout(() => openMedia(id, type, { _forcePlayer: true }), 80);
    });
    document.getElementById('info-share-btn')?.addEventListener('click', () => {
      if (state.currentInfoMedia) shareMedia();
    });
    document.getElementById('info-default-cb')?.addEventListener('change', function() {
      setSetting('defaultInfoMode', this.checked);
      toast(this.checked ? 'Info page is now default' : 'Player mode restored', 'settings');
    });
    document.getElementById('info-season-sel')?.addEventListener('change', function() {
      if (state.currentInfoMedia) loadInfoEpisodes(state.currentInfoMedia.id, +this.value);
    });

    // ── DELEGATED: studio / person / network links (handles dynamically-added rows) ──
    overlay.addEventListener('click', async e => {
      // Studio / network → company page
      const studioLink = e.target.closest('.info-studio-link');
      if (studioLink) {
        const cid = studioLink.dataset.companyId;
        if (!cid) return;
        closeInfoPage();
        setTimeout(() => openCompanyPage(+cid, studioLink.textContent.trim()), 80);
        return;
      }
      // Person name → person page
      const personLink = e.target.closest('.info-person-link');
      if (personLink) {
        const name = personLink.dataset.search;
        if (!name) return;
        try {
          const d = await tmdb('/search/person', { query: name, language: 'en-US' });
          const person = (d.results || []).find(p => p.known_for_department) || d.results?.[0];
          if (person?.id) { closeInfoPage(); setTimeout(() => openPersonPage(person.id), 80); return; }
        } catch {}
        closeInfoPage();
        goPage('search');
        setTimeout(() => {
          const inp = document.getElementById('search-input');
          if (inp) { inp.value = name; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        }, 150);
      }
    });
  }

  // Set default checkbox state
  const cb = document.getElementById('info-default-cb');
  if (cb) cb.checked = getSetting('defaultInfoMode');

  try {
    let details, credits;
    if (type === 'anime') {
      details = await fetchAnimeDetails(id);
      credits = { cast: details._cast || [] };
    } else {
      [details, credits] = await Promise.all([
        tmdb(`/${type}/${id}`, { append_to_response: 'external_ids,videos,keywords,release_dates,content_ratings,next_episode_to_air' }),
        tmdb(`/${type}/${id}/credits`),
      ]);
    }

    const title = details.title || details.name || '';
    const year = String(details.release_date || details.first_air_date || '').slice(0, 4);
    state.currentInfoMedia = { id, type, title, details };

    // Toolbar title
    const tbTitle = document.getElementById('info-toolbar-title');
    if (tbTitle) tbTitle.textContent = title;

    // Hero backdrop
    const heroImg = document.getElementById('info-hero-img');
    if (heroImg && details.backdrop_path) {
      heroImg.src = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
      heroImg.alt = title;
    }

    // Poster
    const poster = document.getElementById('info-poster');
    if (poster) {
      poster.src = details.poster_path ? `https://image.tmdb.org/t/p/w342${details.poster_path}` : '';
      poster.alt = title;
      poster.style.display = details.poster_path ? '' : 'none';
    }

    // Tags + Title
    const ratingVal = details.vote_average || 0;
    const rColor = ratingVal >= 9 ? '#22c55e' : ratingVal >= 7 ? '#f5c518' : ratingVal >= 5 ? '#f97316' : '#f87171';
    const tagsEl = document.getElementById('info-tags');
    if (tagsEl) {
      tagsEl.innerHTML = [
        `<span class="m-tag ${type === 'movie' ? 's' : type === 'anime' ? 'a' : 'v'}">${type === 'movie' ? 'Movie' : type === 'anime' ? 'Anime' : 'TV Show'}</span>`,
        year ? `<span class="m-tag">${year}</span>` : '',
        ratingVal ? `<span class="m-tag" style="color:${rColor}">★ ${ratingVal.toFixed(1)}</span>` : '',
      ].filter(Boolean).join('');
    }
    const titleEl = document.getElementById('info-title');
    if (titleEl) titleEl.textContent = title;

    // Meta row: runtime, seasons, status
    const metaEl = document.getElementById('info-meta');
    if (metaEl) {
      const parts = [];
      // Runtime / episodes per episode
      const epRuntime = details.episode_run_time?.[0];
      if (details.runtime) {
        const h = Math.floor(details.runtime / 60), m = details.runtime % 60;
        parts.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
      } else if (epRuntime) {
        parts.push(`~${epRuntime}m / ep`);
      }
      // TV-specific
      if (details.number_of_seasons) parts.push(`${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}`);
      if (details.number_of_episodes) parts.push(`${details.number_of_episodes} Episodes`);
      if (details.first_air_date && type === 'tv') parts.push(details.first_air_date.slice(0, 4));
      if (details.status) parts.push(details.status);
      // Release year for movies
      if (type === 'movie' && details.release_date) parts.push(details.release_date.slice(0, 4));
      const genres = (details.genres || []).slice(0, 4).map(g => `<span class="info-genre">${esc(g.name)}</span>`).join('');
      metaEl.innerHTML = parts.map(p => `<span class="info-meta-item">${esc(p)}</span>`).join('') + (genres ? `<div class="info-genres">${genres}</div>` : '');
    }

    // Overview — scrollable, no collapse
    const ovEl = document.getElementById('info-overview');
    if (ovEl) ovEl.textContent = details.overview || '';

    // ── Enrich with external APIs (non-blocking — run in background) ──
    _enrichInfoPage(id, type, details, credits).catch(() => {});

    // Side: full ratings + extra details
    const ratingsEl = document.getElementById('info-ratings');
    if (ratingsEl) {
      // Get certification
      let cert = '';
      if (type === 'movie') cert = (details.release_dates?.results || []).find(r => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification || '';
      else cert = (details.content_ratings?.results || []).find(r => r.iso_3166_1 === 'US')?.rating || '';

      const budget = details.budget > 0 ? `$${(details.budget / 1e6).toFixed(0)}M` : null;
      const revenue = details.revenue > 0 ? `$${(details.revenue / 1e6).toFixed(0)}M` : null;
      const networks = (details.networks || []).slice(0, 2).map(n => n.name).join(', ');
      const prodCos = (details.production_companies || []).slice(0, 2).map(c => c.name).join(', ');
      const creators  = (details.created_by || []).map(c => c.name).join(', ');
      const keywords  = (details.keywords?.keywords || details.keywords?.results || []).slice(0, 8).map(k => k.name);
      const directors = type !== 'anime' ? (credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name) : [];
      const writers   = type !== 'anime' ? (credits?.crew || []).filter(c => ['Screenplay','Story','Writer'].includes(c.job)).slice(0,3).map(c => c.name) : [];
      const producers = type !== 'anime' ? (credits?.crew || []).filter(c => ['Executive Producer','Producer'].includes(c.job)).slice(0,2).map(c => c.name) : [];

      // Build info side panel — ordered: rating/cert → lang → status → people → financial
      const langMap = {'en':'English','es':'Spanish','fr':'French','de':'German','ja':'Japanese','ko':'Korean','zh':'Chinese','pt':'Portuguese','it':'Italian','ru':'Russian','hi':'Hindi','ar':'Arabic'};
      const langDisplay = details.original_language ? (langMap[details.original_language] || details.original_language.toUpperCase()) : null;
      ratingsEl.innerHTML = `
        <div class="info-ratings-inner">
          <!-- Highlighted score + cert + language at the very top -->
          <div class="info-score-row">
            ${ratingVal ? `<div class="info-score-main">
              <div class="info-score-num ${ratingVal >= 8 ? 'score-great' : ratingVal >= 7 ? 'score-good' : ratingVal >= 5 ? 'score-ok' : 'score-bad'}">${ratingVal.toFixed(1)}</div>
              <div class="info-score-meta">
                <span class="info-score-label">TMDB</span>
                ${details.vote_count >= 10 ? `<span class="info-score-votes">${details.vote_count >= 1000 ? (details.vote_count/1000).toFixed(1)+'K' : details.vote_count} votes</span>` : ''}
              </div>
            </div>` : ''}
            <div class="info-score-chips">
              ${cert ? `<span class="info-cert-chip">${esc(cert)}</span>` : ''}
              ${langDisplay ? `<span class="info-lang-chip">${esc(langDisplay)}</span>` : ''}
              ${details.status ? `<span class="info-status-chip ${details.status === 'Released' || details.status === 'Ended' ? 'status-done' : 'status-active'}">${esc(details.status)}</span>` : ''}
            </div>
          </div>
          <!-- Season/Episode count chips -->
          ${(details.number_of_seasons || details.number_of_episodes) ? `<div class="info-count-chips">
            ${details.number_of_seasons > 1 ? `<span class="info-count-chip">${details.number_of_seasons} Seasons</span>` : ''}
            ${details.number_of_episodes ? `<span class="info-count-chip">${details.number_of_episodes} Episodes</span>` : ''}
            ${details.runtime ? `<span class="info-count-chip">${Math.floor(details.runtime/60) > 0 ? Math.floor(details.runtime/60)+'h ' : ''}${details.runtime%60}m</span>` : ''}
          </div>` : (details.runtime ? `<div class="info-count-chips"><span class="info-count-chip">${Math.floor(details.runtime/60) > 0 ? Math.floor(details.runtime/60)+'h ' : ''}${details.runtime%60}m</span></div>` : '')}
          <!-- Key creative details -->
          <div class="info-extra-details">
            ${directors.length ? `<div class="info-detail-row"><span class="info-detail-key">Director</span><span class="info-detail-val info-clickable-people">${directors.slice(0,2).map(n=>`<span class="info-person-link" data-search="${esc(n)}">${esc(n)}</span>`).join(', ')}</span></div>` : ''}
            ${creators ? `<div class="info-detail-row"><span class="info-detail-key">Creator</span><span class="info-detail-val info-clickable-people">${creators.split(', ').map(n=>`<span class="info-person-link" data-search="${esc(n)}">${esc(n)}</span>`).join(', ')}</span></div>` : ''}
            ${writers.length ? `<div class="info-detail-row"><span class="info-detail-key">Writer</span><span class="info-detail-val info-clickable-people">${writers.map(n=>`<span class="info-person-link" data-search="${esc(n)}">${esc(n)}</span>`).join(', ')}</span></div>` : ''}
            ${producers.length ? `<div class="info-detail-row"><span class="info-detail-key">Producer</span><span class="info-detail-val info-clickable-people">${producers.map(n=>`<span class="info-person-link" data-search="${esc(n)}">${esc(n)}</span>`).join(', ')}</span></div>` : ''}
            ${networks ? `<div class="info-detail-row"><span class="info-detail-key">Network</span><span class="info-detail-val">${(details.networks||[]).slice(0,2).map(n=>`<span class="info-studio-link" data-company-id="${n.id}" data-company-type="network">${esc(n.name)}</span>`).join(', ')}</span></div>` : ''}
            ${prodCos ? `<div class="info-detail-row"><span class="info-detail-key">Studio</span><span class="info-detail-val">${(details.production_companies||[]).slice(0,2).map(c=>`<span class="info-studio-link" data-company-id="${c.id}" data-company-type="company">${esc(c.name)}</span>`).join(', ')}</span></div>` : ''}
            ${budget ? `<div class="info-detail-row"><span class="info-detail-key">Budget</span><span class="info-detail-val">${budget}</span></div>` : ''}
            ${revenue ? `<div class="info-detail-row"><span class="info-detail-key">Revenue</span><span class="info-detail-val">${revenue}</span></div>` : ''}
            ${details.last_air_date ? `<div class="info-detail-row"><span class="info-detail-key">Last Air Date</span><span class="info-detail-val">${esc(details.last_air_date)}</span></div>` : ''}
            ${details.next_episode_to_air?.air_date ? `<div class="info-detail-row"><span class="info-detail-key">Next Episode</span><span class="info-detail-val" style="color:#22c55e">${esc(details.next_episode_to_air.air_date)}</span></div>` : ''}
            ${details.in_production === true ? `<div class="info-detail-row"><span class="info-detail-key">In Production</span><span class="info-detail-val" style="color:#22c55e">🟢 Yes</span></div>` : ''}
            ${details.type && type === 'tv' ? `<div class="info-detail-row"><span class="info-detail-key">Show Type</span><span class="info-detail-val">${esc(details.type)}</span></div>` : ''}
            ${details.release_date && type === 'movie' ? `<div class="info-detail-row"><span class="info-detail-key">Release Date</span><span class="info-detail-val">${esc(details.release_date)}</span></div>` : ''}
            ${details.original_title && details.original_title !== details.title ? `<div class="info-detail-row"><span class="info-detail-key">Original Title</span><span class="info-detail-val">${esc(details.original_title)}</span></div>` : ''}
            ${details.tagline ? `<div class="info-detail-row" style="border-top:1px solid var(--border);padding-top:.35rem;margin-top:.2rem"><span class="info-detail-val" style="color:var(--muted);font-style:italic;font-size:.74rem;text-align:left">"${esc(details.tagline)}"</span></div>` : ''}
          </div>
        </div>`;
    }

    // Side: actions
    const actionsEl = document.getElementById('info-actions');
    if (actionsEl) {
      const likedNow = isLiked(id), wlNow = isInWatchlist(id), watchedNow = isWatched(id);
      actionsEl.innerHTML = `
        <button class="ma primary" id="info-action-watch" style="width:100%;justify-content:center;font-size:.95rem;padding:.75rem 1.4rem;font-weight:900;letter-spacing:.04em">
          <span class="material-icons-round" style="font-size:1.3rem">play_circle_filled</span>Watch Now
        </button>
        <div class="info-actions-row" style="margin-top:.4rem">
          <button class="ma${wlNow ? ' saved' : ''}" id="info-wl-btn" style="flex:1;justify-content:center">
            <span class="material-icons-round">${wlNow ? 'bookmark' : 'bookmark_add'}</span>${wlNow ? 'Saved' : 'Save'}
          </button>
          <button class="ma${likedNow ? ' liked' : ''}" id="info-like-btn" style="flex:1;justify-content:center">
            <span class="material-icons-round">${likedNow ? 'favorite' : 'favorite_border'}</span>${likedNow ? 'Liked' : 'Like'}
          </button>
          <button class="ma${watchedNow ? ' watched' : ''}" id="info-watched-btn" title="${watchedNow ? 'Mark as unwatched' : 'Mark as watched'}" style="flex:1;justify-content:center">
            <span class="material-icons-round">${watchedNow ? 'visibility' : 'visibility_off'}</span>
          </button>
        </div>`;
      // Watch Now: close info page, open player modal
      document.getElementById('info-action-watch')?.addEventListener('click', () => {
        const capturedId = id, capturedType = type, capturedHint = { title, poster_path: details.poster_path };
        closeInfoPage();
        setTimeout(() => openMedia(capturedId, capturedType, { ...capturedHint, _forcePlayer: true }), 80);
      });
      document.getElementById('info-wl-btn')?.addEventListener('click', () => {
        handleWatchlist(id, type, null, { id, type, title, poster_path: details.poster_path });
        const btn = document.getElementById('info-wl-btn');
        if (btn) { btn.className = `ma${isInWatchlist(id) ? ' saved' : ''}`; btn.innerHTML = `<span class="material-icons-round">${isInWatchlist(id) ? 'bookmark' : 'bookmark_add'}</span>${isInWatchlist(id) ? 'Saved' : 'Save'}`; }
      });
      document.getElementById('info-like-btn')?.addEventListener('click', () => {
        handleLike(id, type, null, { id, type, title, poster_path: details.poster_path });
        const btn = document.getElementById('info-like-btn');
        if (btn) { btn.className = `ma${isLiked(id) ? ' liked' : ''}`; btn.innerHTML = `<span class="material-icons-round">${isLiked(id) ? 'favorite' : 'favorite_border'}</span>${isLiked(id) ? 'Liked' : 'Like'}`; }
      });
      document.getElementById('info-watched-btn')?.addEventListener('click', () => {
        toggleWatched({ id, type, title, poster_path: details.poster_path });
        const nowWatched = isWatched(id);
        const btn = document.getElementById('info-watched-btn');
        if (btn) {
          btn.className = `ma${nowWatched ? ' watched' : ''}`;
          btn.title = nowWatched ? 'Mark as unwatched' : 'Mark as watched';
          btn.innerHTML = `<span class="material-icons-round">${nowWatched ? 'visibility' : 'visibility_off'}</span>`;
        }
        toast(nowWatched ? 'Marked as watched' : 'Removed from watched', nowWatched ? 'visibility' : 'visibility_off');
      });
    }
    window._openMediaFromInfo = () => openMedia(id, type, { title, poster_path: details.poster_path });

    // Trailer
    const trailerFrame = document.getElementById('info-trailer-frame');
    const trailerFallback = document.getElementById('info-trailer-fallback');
    const videos = details.videos?.results || [];
    const trailerKey = (
      videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
      videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
      videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
    )?.key;

    // Info page trailer: YouTube → backdrop fallback
    const trailerWrap = document.getElementById('info-trailer-wrap');
    const posterImg = details.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
      : details.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : null;

    if (trailerKey && trailerWrap) {
      trailerWrap.style.cursor = 'default';
      if (trailerFallback) trailerFallback.style.display = 'none';
      const _trailerToken = id;

      if (trailerFrame) {
        trailerFrame.style.display = '';

        const playYouTubeInfo = (vidKey, isFallback = false) => {
          if (state.currentInfoMedia?.id !== _trailerToken) return;
          trailerFrame.src = `https://www.youtube.com/embed/${vidKey}?rel=0&modestbranding=1&fs=1&iv_load_policy=3&enablejsapi=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;

          let _trailerStarted = false;
          const infoMsgHandler = (e) => {
            if (e.origin !== 'https://www.youtube.com') return;
            try {
              const d = JSON.parse(e.data);
              // Mark as started when buffering or playing
              if (d.info?.playerState === 3 || d.info?.playerState === 1) {
                _trailerStarted = true;
              }
              if (d.event === 'onError') {
                window.removeEventListener('message', infoMsgHandler);
                clearTimeout(infoTrailerTimer);
                if (state.currentInfoMedia?.id === _trailerToken)
                  _showInfoTrailerFallback(trailerKey, posterImg, trailerFallback, trailerFrame);
              }
            } catch {}
          };
          window.addEventListener('message', infoMsgHandler);
          // Timeout only fires fallback if video never started buffering/playing
          const infoTrailerTimer = setTimeout(() => {
            window.removeEventListener('message', infoMsgHandler);
            if (!_trailerStarted && state.currentInfoMedia?.id === _trailerToken && trailerFrame?.src) {
              _showInfoTrailerFallback(trailerKey, posterImg, trailerFallback, trailerFrame);
            }
          }, 9000);
        };

        if (trailerKey && trailerKey !== '__none__') {
          playYouTubeInfo(trailerKey, false);
        } else {
          _showInfoTrailerFallback(trailerKey, posterImg, trailerFallback, trailerFrame);
        }
      } // end if (trailerFrame)
    } else {
      if (trailerFrame) { trailerFrame.removeAttribute('src'); trailerFrame.style.display = 'none'; }
      if (trailerFallback) {
        trailerFallback.style.display = '';
        // Show nice "No trailer" state with backdrop
        if (posterImg) {
          trailerFallback.innerHTML = `
            <img src="${posterImg}" alt="${esc(title)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.4);">
            <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:.5rem;color:#fff;">
              <span class="material-icons-round" style="font-size:2rem;opacity:.6">movie</span>
              <p style="font-size:.84rem;opacity:.7">No trailer available</p>
              <p style="font-size:.75rem;opacity:.5">${esc(title)} — ${String(details.release_date || details.first_air_date || '').slice(0,4)}</p>
            </div>`;
        }
      }
    }

    // Cast
    const cast = (credits?.cast || []).slice(0, 24);
    const castRow = document.getElementById('info-cast-row');
    if (castRow) {
      castRow.innerHTML = cast.map(p => {
        const ph = imgUrl(p.profile_path, 'w185');
        return `<div class="cast-card" data-person-id="${p.id || ''}" style="cursor:pointer" title="See ${esc(p.name)}'s filmography">
          ${ph ? `<img class="cast-img" src="${ph}" alt="${esc(p.name || '')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex');">
          <div class="cast-ph" style="display:none"><span class="material-icons-round">person</span></div>` : `<div class="cast-ph"><span class="material-icons-round">person</span></div>`}
          <div class="cast-name" title="${esc(p.name || '')}">${esc(p.name || '')}</div>
          <div class="cast-char" title="${esc(p.character || '')}">${esc(p.character || '')}</div>
        </div>`;
      }).join('');
    }

    // Start expanded; click to collapse to 4 lines
    if (ovEl) {
      ovEl.classList.add('info-overview-collapsible', 'expanded');
      ovEl.title = 'Click to minimize';
      if (!ovEl._clickWired) {
        ovEl._clickWired = true;
        ovEl.addEventListener('click', function() {
          this.classList.toggle('expanded');
          this.title = this.classList.contains('expanded') ? 'Click to minimize' : 'Click to expand';
        });
      }
    }

    // TV episodes
    const epsSection = document.getElementById('info-eps-section');
    if (type === 'tv' && details.number_of_seasons) {
      if (epsSection) epsSection.style.display = '';
      const sel = document.getElementById('info-season-sel');
      if (sel) {
        sel.innerHTML = Array.from({ length: details.number_of_seasons }, (_, i) =>
          `<option value="${i + 1}">Season ${i + 1}</option>`).join('');
      }
      await loadInfoEpisodes(id, 1);
    } else {
      if (epsSection) epsSection.style.display = 'none';
    }

    // Related
    const relGrid = document.getElementById('info-related-grid');
    if (relGrid) {
      try {
        const relData = await tmdb(`/${type}/${id}/recommendations`);
        const relItems = (relData.results || []).slice(0, 8);
        relGrid.innerHTML = relItems.map(m => makeCard(m, type, { compact: true })).join('');
      } catch { relGrid.innerHTML = ''; }
    }

    // "More with this Cast" — find works where multiple cast members appear together
    const castSection = document.getElementById('info-cast-also-section');
    const castAlsoGrid = document.getElementById('info-cast-also-grid');
    if (castSection && castAlsoGrid && cast.length >= 2) {
      const topCast = cast.slice(0, 4); // top 4 billed cast
      const mediaType = type === 'anime' ? 'tv' : type;
      try {
        // Fetch filmographies for top cast in parallel
        const creditResults = await Promise.allSettled(
          topCast.map(p => tmdb(`/person/${p.id}/combined_credits`))
        );
        // Build frequency map: mediaId → { item, count, actors }
        const freq = new Map();
        creditResults.forEach((r, actorIdx) => {
          if (r.status !== 'fulfilled') return;
          const actor = topCast[actorIdx];
          const credits = [...(r.value.cast || [])].filter(c =>
            c.id !== id && // exclude current item
            (c.media_type === 'movie' || c.media_type === 'tv') &&
            (c.vote_average || 0) >= 6.5 &&
            (c.vote_count || 0) >= 100
          );
          credits.slice(0, 20).forEach(c => {
            const key = `${c.media_type}-${c.id}`;
            if (!freq.has(key)) freq.set(key, { item: c, count: 0, actors: [] });
            const entry = freq.get(key);
            entry.count++;
            entry.actors.push(actor.name);
          });
        });
        // Sort by: actors in common (desc), then popularity (desc)
        const ranked = [...freq.values()]
          .filter(e => e.count >= 2) // only show if 2+ cast members appear together
          .sort((a, b) => b.count - a.count || (b.item.popularity || 0) - (a.item.popularity || 0))
          .slice(0, 8);

        if (ranked.length >= 2) {
          castSection.style.display = '';
          castAlsoGrid.innerHTML = ranked.map(e => {
            const m = e.item;
            const mType = m.media_type === 'tv' ? 'tv' : 'movie';
            return makeCard(m, mType, { compact: true });
          }).join('');
        } else {
          castSection.style.display = 'none';
        }
      } catch { castSection.style.display = 'none'; }
    }

    // Reviews — now at the bottom of the page in their own full-width section
    try {
      const reviewData = await tmdb(`/${type === 'anime' ? 'tv' : type}/${id}/reviews`);
      const reviews = (reviewData.results || []).slice(0, 4);
      const reviewsOuter = document.getElementById('info-reviews-outer');
      const reviewsList  = document.getElementById('info-reviews-list');
      if (reviews.length && reviewsOuter && reviewsList) {
        reviewsList.innerHTML = reviews.map(r => `
          <div class="info-review-card" style="flex:1;min-width:280px;max-width:480px">
            <div class="info-review-author">${esc(r.author || 'Anonymous')}
              ${r.author_details?.rating ? `<span class="info-review-rating">★ ${r.author_details.rating}/10</span>` : ''}
            </div>
            <div class="info-review-body">${esc((r.content || '').slice(0, 320))}${(r.content||'').length > 320 ? '…' : ''}</div>
          </div>`).join('');
        reviewsOuter.style.display = '';
      } else if (reviewsOuter) {
        reviewsOuter.style.display = 'none';
      }
    } catch {}

    // ── Fanart.tv logo (replace text title with transparent logo if available)
    if (type !== 'anime') {
      fetchFanart(id, type === 'movie' ? 'movies' : 'tv').then(fanart => {
        const logoUrl = getFanartLogo(fanart);
        if (logoUrl) {
          const titleEl = document.getElementById('info-title');
          if (titleEl) {
            titleEl.innerHTML = `<img class="info-fanart-logo" src="${logoUrl}" alt="${esc(title)}" onerror="this.style.display='none'">`;
          }
        }
      }).catch(() => {});
    }

    // Note: .info-studio-link and .info-person-link clicks are handled via
    // delegated listener registered in overlay._wired block above.

    // Update URL — info page IS the canonical; watch pages point here
    const yr = String(details.release_date || details.first_air_date || '').slice(0, 4);
    const slug = slugify(`${title} ${yr}`);
    const infoUrl = `${location.pathname}?watch=${encodeURIComponent(type)}&name=${encodeURIComponent(slug)}&id=${id}&mode=info`;
    history.pushState({ id, type, mode: 'info' }, title, infoUrl);

    // Info page IS the canonical — full content, unique per item
    const ogImg = details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null;
    updateInfoPageSEO(title, type, details, infoUrl, ogImg);

  } catch (e) {
    console.error('[SV] Info page error:', e);
  }
}

async function loadInfoEpisodes(showId, season) {
  const grid = document.getElementById('info-ep-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="spin" style="margin:1rem auto"></div>';
  try {
    const d = await tmdb(`/tv/${showId}/season/${season}`);
    const eps = d.episodes || [];
    grid.innerHTML = eps.map(ep => {
      const th = imgUrl(ep.still_path, 'w300');
      return `<div class="info-ep-card" title="Ep ${ep.episode_number}: ${esc(ep.name || '')}">
        ${th ? `<img class="info-ep-thumb" src="${th}" alt="Ep ${ep.episode_number}" loading="lazy">` : `<div class="info-ep-thumb-ph"><span class="material-icons-round">play_circle</span></div>`}
        <div class="info-ep-info">
          <div class="info-ep-num">Ep ${ep.episode_number}${ep.runtime ? ` · ${ep.runtime}m` : ''}</div>
          <div class="info-ep-name">${esc(ep.name || '')}</div>
        </div>
      </div>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p class="muted-note">Could not load episodes.</p>';
  }
}

/* ── PERSON FILMOGRAPHY PAGE ─────────────────────────────────────── */

/* ── TMDB WATCH PROVIDER CACHE ───────────────────────────────────── */
let _tmdbWatchProviders = null;

async function getTmdbWatchProviders() {
  if (_tmdbWatchProviders) return _tmdbWatchProviders;
  try {
    const data = await tmdb('/watch/providers/movie', { watch_region: 'US' });
    // Sort by display priority (lower number = more prominent) and limit to top 60
    const sorted = (data.results || [])
      .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
      .slice(0, 60);
    _tmdbWatchProviders = sorted;
  } catch {
    _tmdbWatchProviders = [];
  }
  return _tmdbWatchProviders;
}

/* ── PROVIDER PAGE (content on a streaming service) ─────────────── */
export async function openProviderPage(providerId, providerName) {
  clearHoverTrailer();

  // TMDB network IDs for "Originals & Exclusives" rows
  const PROVIDER_NETWORK_IDS = {
    8:    213,   // Netflix
    337:  2739,  // Disney+
    15:   453,   // Hulu
    384:  49,    // Max (HBO)
    1899: 49,    // Max (alt ID)
    9:    1024,  // Prime Video
    350:  2552,  // Apple TV+
    2:    2552,  // Apple TV (alt)
    531:  4330,  // Paramount+
    386:  3353,  // Peacock
    283:  1655,  // Crunchyroll
    37:   2,     // Showtime
    43:   67,    // Starz
    123:  318,   // Shudder
    39:   174,   // AMC
    11:   174,   // AMC (alt)
  };
  const networkId = PROVIDER_NETWORK_IDS[providerId];
  // Ensure TMDB provider list is loaded before computing logo
  const allProviders = await getTmdbWatchProviders();
  const tmdbMatch = allProviders.find(p => p.provider_id === providerId);
  const logoUrl = tmdbMatch?.logo_path
    ? `https://image.tmdb.org/t/p/w92${tmdbMatch.logo_path}`
    : getProviderLogoUrl(providerName, 48);
  const base       = { with_watch_providers: providerId, watch_region: 'US' };
  const provPageId = 'page-provider';

  // ── Create provider page if needed ──
  if (!document.getElementById(provPageId)) {
    const pg = document.createElement('main');
    pg.className = 'page';
    pg.id = provPageId;
    pg.innerHTML = `
      <div class="provider-page-header" id="provider-page-header">
        <div class="provider-page-header-inner">
          <button class="provider-back-btn" id="provider-back-btn" aria-label="Go back">
            <span class="material-icons-round">arrow_back</span>
          </button>
          <img id="provider-page-logo" class="provider-page-logo" src="" alt="" style="display:none">
          <span id="provider-page-title" class="provider-page-title"></span>
        </div>
        <!-- Provider switcher: populated dynamically from TMDB -->
        <div class="provider-switcher" id="provider-switcher">
          <span style="font-size:.72rem;color:var(--muted);padding:0 .5rem">Loading…</span>
        </div>
      </div>
      <div id="provider-page-body" style="padding-top:1rem"></div>`;
    document.getElementById('footer').before(pg);

    pg.querySelector('#provider-back-btn')?.addEventListener('click', () => {
      goPage(state._prevPage || 'home');
    });

    // Wire provider switcher buttons (delegated — works for dynamically-added buttons)
    pg.querySelector('#provider-switcher')?.addEventListener('click', e => {
      const btn = e.target.closest('.provider-switch-btn');
      if (!btn) return;
      const pid = +btn.dataset.providerId;
      const pname = btn.dataset.providerName;
      openProviderPage(pid, pname);
    });

    registerLoader('provider', () => {});

    // Populate switcher from TMDB asynchronously
    getTmdbWatchProviders().then(providers => {
      const switcher = document.getElementById('provider-switcher');
      if (!switcher) return;
      switcher.innerHTML = providers.map(p => {
        const logoSrc = p.logo_path
          ? `https://image.tmdb.org/t/p/w92${p.logo_path}`
          : '';
        return `<button class="provider-switch-btn" data-provider-id="${p.provider_id}" data-provider-name="${esc(p.provider_name)}" title="${esc(p.provider_name)}">
          ${logoSrc ? `<img src="${logoSrc}" width="22" height="22" style="border-radius:5px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'" alt="${esc(p.provider_name)}">` : ''}
          <span>${esc(p.provider_name)}</span>
        </button>`;
      }).join('');
    });
  } else {
    // Page already exists — refresh switcher in case TMDB data was just loaded
    const switcher = document.getElementById('provider-switcher');
    if (switcher && !switcher.querySelector('.provider-switch-btn')) {
      getTmdbWatchProviders().then(providers => {
        switcher.innerHTML = providers.map(p => {
          const logoSrc = p.logo_path
            ? `https://image.tmdb.org/t/p/w92${p.logo_path}`
            : '';
          return `<button class="provider-switch-btn" data-provider-id="${p.provider_id}" data-provider-name="${esc(p.provider_name)}" title="${esc(p.provider_name)}">
            ${logoSrc ? `<img src="${logoSrc}" width="22" height="22" style="border-radius:5px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'" alt="${esc(p.provider_name)}">` : ''}
            <span>${esc(p.provider_name)}</span>
          </button>`;
        }).join('');
      });
    }
  }

  // ── Wire dynamic nav tab ──
  let provTab = document.querySelector('.nav-tab[data-page="provider"]');
  if (!provTab) {
    provTab = document.createElement('div');
    provTab.className = 'nav-tab provider-tab';
    provTab.setAttribute('role','button');
    provTab.setAttribute('tabindex','0');
    provTab.dataset.page = 'provider';
    document.getElementById('nav-tabs')?.appendChild(provTab);
    // Close button removes the provider tab and returns to previous page
    provTab.addEventListener('click', e => {
      if (!e.target.closest('.provider-tab-close')) return;
      e.stopPropagation();
      provTab.remove();
      goPage(state._prevPage || 'home');
    });
  }
  // Set tab label with logo and close button
  const tabLogoHtml = logoUrl
    ? `<img src="${logoUrl}" class="provider-tab-logo" onerror="this.style.display='none'" alt="${esc(providerName)}">`
    : '';
  provTab.innerHTML = `${tabLogoHtml}<span class="provider-tab-name">${esc(providerName)}</span><span class="provider-tab-close" title="Close" aria-label="Close provider tab">×</span>`;

  // ── Update page header ──
  const hdrLogo  = document.getElementById('provider-page-logo');
  const hdrTitle = document.getElementById('provider-page-title');
  if (hdrLogo && logoUrl) { hdrLogo.src = logoUrl; hdrLogo.style.display = ''; }
  else if (hdrLogo && !logoUrl) { hdrLogo.style.display = 'none'; }
  if (hdrTitle) hdrTitle.textContent = providerName;

  // ── Mark active provider in switcher ──
  document.querySelectorAll('#provider-switcher .provider-switch-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.providerId === providerId);
  });

  // ── Navigate to provider page ──
  // Close any open overlays before navigating
  document.getElementById('info-overlay')?.classList.remove('open');
  document.getElementById('person-overlay')?.classList.remove('open');
  document.getElementById('company-overlay')?.classList.remove('open');
  document.getElementById('modal-overlay')?.classList.remove('open');
  document.body.style.overflow = '';

  state._prevPage = state.currentPage;
  goPage('provider');

  // Fix URL to include provider id and name
  const provUrl = `${location.pathname}?page=provider&id=${providerId}&name=${encodeURIComponent(providerName)}`;
  history.replaceState({ page:'provider', providerId, providerName }, providerName, provUrl);

  // ── Build rows ──
  const body = document.getElementById('provider-page-body');
  if (body) body.innerHTML = '<div style="padding:2rem 3.5rem;color:var(--muted)">Loading…</div>';

  const makeHomeRow = (icon, iconColor, title, rowId, items, type) => {
    if (!items || !items.length) return '';
    const skel = items.slice(0,20).map(m => makeCard(m, m.media_type || type)).join('');
    return `<div class="section">
      <div class="sec-header">
        <div class="sec-title">
          <span class="material-icons-round sec-icon" style="color:${iconColor}">${icon}</span>${esc(title)}
        </div>
      </div>
      <div class="row-wrap">
        <div class="row-arrow row-arrow-l hidden">
          <button data-scroll-row="${rowId}" data-scroll-dir="-1"><span class="material-icons-round">chevron_left</span></button>
        </div>
        <div class="card-row" id="${rowId}">${skel}</div>
        <div class="row-arrow row-arrow-r">
          <button data-scroll-row="${rowId}" data-scroll-dir="1"><span class="material-icons-round">chevron_right</span></button>
        </div>
      </div>
    </div>`;
  };

  // Highlight active provider in switcher
  document.querySelectorAll('.provider-switch-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.providerId === providerId);
  });

  // Build "For You on Provider" using user's preferred genres
  const prefGenresStr = state.prefGenres?.length ? state.prefGenres.slice(0,2).join('|') : null;
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const newReleaseCutoff = `${lastYear}-01-01`;

  // Genre IDs for category rows
  const G = { ACTION_M: 28, DRAMA: 18, COMEDY: 35, SCIFI_M: 878, HORROR: 27,
               ACTION_TV: 10759, SCIFI_TV: 10765 };

  // Fetch all provider content in parallel (14 queries)
  Promise.allSettled([
    /* 0 */ tmdb('/discover/movie', { ...base, sort_by:'popularity.desc',   page:1 }),
    /* 1 */ tmdb('/discover/tv',    { ...base, sort_by:'popularity.desc',   page:1 }),
    /* 2 */ tmdb('/discover/movie', { ...base, sort_by:'vote_average.desc', 'vote_count.gte':100, page:1 }),
    /* 3 */ tmdb('/discover/tv',    { ...base, sort_by:'vote_average.desc', 'vote_count.gte':50,  page:1 }),
    /* 4 */ tmdb('/discover/movie', { ...base, sort_by:'popularity.desc',   page:2 }),
    /* 5 */ tmdb('/discover/tv',    { ...base, sort_by:'popularity.desc',   page:2 }),
    /* 6 */ networkId ? tmdb('/discover/movie', { ...base, with_networks:networkId, sort_by:'popularity.desc', page:1 }) : Promise.resolve({results:[]}),
    /* 7 */ networkId ? tmdb('/discover/tv',    { ...base, with_networks:networkId, sort_by:'popularity.desc', page:1 }) : Promise.resolve({results:[]}),
    /* 8 */ prefGenresStr ? tmdb('/discover/movie', { ...base, with_genres:prefGenresStr, sort_by:'popularity.desc', page:1 }) : Promise.resolve({results:[]}),
    /* 9 */ prefGenresStr ? tmdb('/discover/tv',    { ...base, with_genres:prefGenresStr, sort_by:'popularity.desc', page:1 }) : Promise.resolve({results:[]}),
    /* 10 */ tmdb('/discover/movie', { ...base, sort_by:'primary_release_date.desc', 'primary_release_date.gte': newReleaseCutoff, page:1 }),
    /* 11 */ tmdb('/discover/tv',    { ...base, sort_by:'first_air_date.desc', 'first_air_date.gte': newReleaseCutoff, page:1 }),
    /* 12 */ tmdb('/discover/movie', { ...base, with_genres:`${G.ACTION_M}|${G.SCIFI_M}`, sort_by:'popularity.desc', page:1 }),
    /* 13 */ tmdb('/discover/tv',    { ...base, with_genres:`${G.ACTION_TV}`, sort_by:'popularity.desc', page:1 }),
    /* 14 */ tmdb('/discover/movie', { ...base, with_genres:`${G.DRAMA}`, sort_by:'popularity.desc', page:1 }),
    /* 15 */ tmdb('/discover/tv',    { ...base, with_genres:`${G.DRAMA}`, sort_by:'popularity.desc', page:1 }),
    /* 16 */ tmdb('/discover/movie', { ...base, with_genres:`${G.COMEDY}`, sort_by:'popularity.desc', page:1 }),
    /* 17 */ tmdb('/discover/tv',    { ...base, with_genres:`${G.COMEDY}`, sort_by:'popularity.desc', page:1 }),
  ]).then(results => {
    if (state.currentPage !== 'provider') return; // don't update if navigated away

    const get = (i, mt) => results[i].status==='fulfilled'
      ? (results[i].value.results||[]).map(x=>({...x,media_type:mt})) : [];

    const popMovies    = get(0,'movie');
    const popTv        = get(1,'tv');
    const topMovies    = get(2,'movie');
    const topTv        = get(3,'tv');
    const moreMovies   = get(4,'movie');
    const moreTv       = get(5,'tv');
    const origMovies   = get(6,'movie');
    const origTv       = get(7,'tv');
    const prefMovies   = get(8,'movie');
    const prefTv       = get(9,'tv');
    const newMovies    = get(10,'movie');
    const newTv        = get(11,'tv');
    const actionMovies = get(12,'movie');
    const actionTv     = get(13,'tv');
    const dramaMovies  = get(14,'movie');
    const dramaTv      = get(15,'tv');
    const comedyMovies = get(16,'movie');
    const comedyTv     = get(17,'tv');

    const originals = [...origMovies, ...origTv].sort((a,b)=>(b.popularity||0)-(a.popularity||0));
    const forYou    = [...prefMovies, ...prefTv].sort((a,b)=>(b.popularity||0)-(a.popularity||0));

    // Interleave helpers
    const mix = (a, b) => { const out=[]; for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i])out.push(a[i]);if(b[i])out.push(b[i]);} return out; };

    // Deduplicate in render order: each row gets items not yet shown above it
    const _seen = new Set();
    const dedup = (arr) => arr.filter(x => { if (_seen.has(x.id)) return false; _seen.add(x.id); return true; });

    const forYouDedup   = dedup(forYou);
    const origDedup     = dedup(originals);
    const popularMixed  = dedup(mix(popMovies, popTv));
    const newMixed      = dedup(mix(newMovies, newTv));
    const topMixed      = dedup(mix(topMovies, topTv));
    const actionMixed   = dedup(mix(actionMovies, actionTv));
    const dramaMixed    = dedup(mix(dramaMovies, dramaTv));
    const comedyMixed   = dedup(mix(comedyMovies, comedyTv));
    const moreMixed     = dedup(mix(moreMovies, moreTv));

    const rows = [
      forYouDedup.length    ? makeHomeRow('auto_awesome',                '#a78bfa', `For You on ${providerName}`,              'pv-foryou',     forYouDedup,   null) : '',
      origDedup.length      ? makeHomeRow('star',                        '#f5c518', `${providerName} Originals`,               'pv-originals',  origDedup,     null) : '',
      popularMixed.length   ? makeHomeRow('local_fire_department',       '#f97316', `Popular on ${providerName}`,              'pv-trending',   popularMixed,  '')   : '',
      newMixed.length       ? makeHomeRow('fiber_new',                   '#22c55e', `New on ${providerName}`,                  'pv-new',        newMixed,      '')   : '',
      topMixed.length       ? makeHomeRow('workspace_premium',           '#f5c518', 'Top Rated',                               'pv-top',        topMixed,      '')   : '',
      actionMixed.length    ? makeHomeRow('bolt',                        '#f97316', 'Action & Sci-Fi',                         'pv-action',     actionMixed,   '')   : '',
      dramaMixed.length     ? makeHomeRow('theater_comedy',              '#a78bfa', 'Drama',                                   'pv-drama',      dramaMixed,    '')   : '',
      comedyMixed.length    ? makeHomeRow('sentiment_very_satisfied',    '#22c55e', 'Comedy',                                  'pv-comedy',     comedyMixed,   '')   : '',
      moreMixed.length      ? makeHomeRow('explore',                     '',        'More to Explore',                         'pv-more',       moreMixed,     '')   : '',
    ].filter(Boolean);

    if (body) {
      body.innerHTML = rows.join('') || '<p style="padding:3rem;color:var(--muted);text-align:center">No content available from this provider in your region.</p>';

      // Wire scroll arrows
      body.querySelectorAll('[data-scroll-row]').forEach(btn => {
        btn.addEventListener('click', () => {
          const rowEl = document.getElementById(btn.dataset.scrollRow);
          if (rowEl) rowEl.scrollBy({ left: +btn.dataset.scrollDir * rowEl.clientWidth * 0.75, behavior: 'smooth' });
        });
      });

      // Wire card clicks (cards are <a> elements — prevent default navigation)
      body.querySelectorAll('.card[data-id][data-type]').forEach(cardEl => {
        cardEl.addEventListener('click', e => {
          if (e.target.closest('button')) return;
          e.preventDefault();
          openMedia(+cardEl.dataset.id, cardEl.dataset.type, {
            title: cardEl.dataset.title,
            poster_path: cardEl.dataset.poster,
          });
        });
      });
    }
  }).catch(e => {
    if (body) body.innerHTML = '<p style="padding:2rem;color:var(--muted)">Failed to load provider content.</p>';
    console.warn('[SV] Provider page error:', e?.message);
  });
}

/* ── PROVIDER SVG LOGOS ──────────────────────────────────────────── */
function _getProviderSVG(name) {
  // Prefer TMDB logo (already cached from provider list) over logo.dev
  const tmdbProv = (_tmdbWatchProviders || []).find(p =>
    p.provider_name === name ||
    p.provider_name.replace(/\s+/g,'').toLowerCase() === (name||'').replace(/\s+/g,'').toLowerCase()
  );
  const logoUrl = tmdbProv?.logo_path
    ? `https://image.tmdb.org/t/p/w92${tmdbProv.logo_path}`
    : getProviderLogoUrl(name, 32);
  const fallback = `<span style="display:none;width:28px;height:28px;border-radius:5px;background:rgba(255,255,255,.1);align-items:center;justify-content:center;font-size:.6rem;font-weight:900">${(name||'?').slice(0,2).toUpperCase()}</span>`;
  if (logoUrl) {
    return `<img src="${logoUrl}" width="28" height="28" style="border-radius:5px;object-fit:cover;background:rgba(255,255,255,.05)" alt="${name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">` + fallback;
  }
  // Generic badge for unknown providers
  return `<span style="display:inline-flex;width:28px;height:28px;border-radius:5px;background:rgba(255,255,255,.1);align-items:center;justify-content:center;font-size:.6rem;font-weight:900">${(name||'?').slice(0,2).toUpperCase()}</span>`;
}

/* ── COMPANY PAGE ────────────────────────────────────────────────── */
export async function openCompanyPage(companyId, companyName) {
  _openCompanyOverlay({
    name: companyName,
    subtitle: 'Production Company',
    fetchFn: async () => {
      const [company, moviePage, tvPage] = await Promise.allSettled([
        tmdb(`/company/${companyId}`),
        tmdb('/discover/movie', { with_companies: companyId, sort_by: 'popularity.desc', page: 1 }),
        tmdb('/discover/tv',    { with_companies: companyId, sort_by: 'popularity.desc', page: 1 }),
      ]);
      const co = company.status === 'fulfilled' ? company.value : {};
      // Try TMDB logo first, then Fanart for company logo
      let logoUrl = co.logo_path ? imgUrl(co.logo_path, 'w300') : null;
      const desc = co.description ||
        (co.headquarters ? `Based in ${co.headquarters}` : '') +
        (co.origin_country ? ` · ${co.origin_country}` : '');
      const parent = co.parent_company?.name ? `Part of ${co.parent_company.name}` : '';
      // Wikipedia desc supplement
      if (co.name) fetchWikipediaSummary(co.name).then(wiki => {
        if (wiki?.extract) {
          const d = document.getElementById('company-desc');
          if (d) d.textContent = wiki.extract.slice(0, 500) + '…';
        }
      }).catch(() => {});
      return {
        name: co.name || companyName, logoUrl, desc, parent,
        movies: (moviePage.status==='fulfilled' ? moviePage.value.results||[] : []).map(x=>({...x,media_type:'movie'})),
        tv:     (tvPage.status==='fulfilled'    ? tvPage.value.results||[]    : []).map(x=>({...x,media_type:'tv'})),
      };
    },
  });
}

/* ── COLLECTION / FRANCHISE PAGE ──────────────────────────────────── */
export async function openCollectionPage(collectionId, collectionName) {
  _openCompanyOverlay({
    name: collectionName,
    subtitle: 'Film Collection',
    defaultCompact: true, // collections look better as a grid
    fetchFn: async () => {
      const col = await tmdb(`/collection/${collectionId}`);
      const movies = (col.parts || [])
        .sort((a,b) => (a.release_date||'') > (b.release_date||'') ? 1 : -1)
        .map(m => ({...m, media_type:'movie'}));

      // Build a readable subtitle: "X Films · Year–Year"
      const years = movies.map(m => +(m.release_date||'').slice(0,4)).filter(Boolean);
      const yearRange = years.length > 1
        ? `${Math.min(...years)}–${Math.max(...years)}`
        : years[0] || '';
      const subtitle = [
        `${movies.length} Film${movies.length !== 1 ? 's' : ''}`,
        yearRange,
      ].filter(Boolean).join(' · ');

      return {
        name: col.name || collectionName,
        desc: col.overview || '',
        parent: subtitle,
        backdropUrl: col.backdrop_path ? imgUrl(col.backdrop_path, 'w1280') : null,
        movies,
        tv: [],
      };
    },
  });
}

/* ── UNIFIED COMPANY / PROVIDER / COLLECTION OVERLAY ─────────────── */
async function _openCompanyOverlay({ name, subtitle, logoUrl, fetchFn, defaultCompact = false }) {
  // Stop hover trailer immediately — don't let it play behind the overlay
  clearHoverTrailer();
  const ov = document.getElementById('company-overlay');
  if (!ov) return;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Wire once
  if (!ov._wired) {
    ov._wired = true;
    ov.querySelector('#company-close')?.addEventListener('click', () => {
      ov.classList.remove('open'); document.body.style.overflow = '';
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ov.classList.contains('open')) { ov.classList.remove('open'); document.body.style.overflow = ''; }
    });
    // Card clicks → close overlay first
    ov.addEventListener('click', e => {
      const card = e.target.closest('.card[data-id][data-type]');
      if (!card || e.target.closest('button')) return;
      e.preventDefault(); // card is now an <a>
      ov.classList.remove('open'); document.body.style.overflow = '';
      setTimeout(() => openMedia(+card.dataset.id, card.dataset.type), 60);
    });
    // View toggle: Row / Compact
    ov.querySelector('#cv-btn-row')?.addEventListener('click', () => {
      ov.querySelector('#company-row-view').style.display = '';
      ov.querySelector('#company-compact-view').style.display = 'none';
      ov.querySelector('#cv-btn-row')?.classList.add('on');
      ov.querySelector('#cv-btn-compact')?.classList.remove('on');
    });
    ov.querySelector('#cv-btn-compact')?.addEventListener('click', () => {
      ov.querySelector('#company-row-view').style.display = 'none';
      ov.querySelector('#company-compact-view').style.display = '';
      ov.querySelector('#cv-btn-compact')?.classList.add('on');
      ov.querySelector('#cv-btn-row')?.classList.remove('on');
    });
    // Scroll arrows for company rows
    ov.addEventListener('click', e => {
      const btn = e.target.closest('[data-scroll-row]');
      if (!btn) return;
      const dir = +btn.dataset.scrollDir;
      const row = document.getElementById(btn.dataset.scrollRow);
      if (row) row.scrollBy({ left: dir * row.clientWidth * 0.7, behavior: 'smooth' });
    });
  }

  // Default view: compact for collections, row for everything else
  const rowView     = ov.querySelector('#company-row-view');
  const compactView = ov.querySelector('#company-compact-view');
  if (defaultCompact) {
    if (rowView)     rowView.style.display = 'none';
    if (compactView) compactView.style.display = '';
    ov.querySelector('#cv-btn-row')?.classList.remove('on');
    ov.querySelector('#cv-btn-compact')?.classList.add('on');
  } else {
    if (rowView)     rowView.style.display = '';
    if (compactView) compactView.style.display = 'none';
    ov.querySelector('#cv-btn-row')?.classList.add('on');
    ov.querySelector('#cv-btn-compact')?.classList.remove('on');
  }

  // Set loading state
  const moviesRow = document.getElementById('company-movies-row');
  const tvRow     = document.getElementById('company-tv-row');
  const grid      = document.getElementById('company-grid');
  const moviesSec = document.getElementById('company-movies-sec');
  const tvSec     = document.getElementById('company-tv-sec');
  const heroEl    = document.getElementById('company-hero');
  const heroImg   = document.getElementById('company-hero-img');
  const logoBig   = document.getElementById('company-logo-big');
  const logoSm    = document.getElementById('company-logo'); // toolbar logo (id="company-logo")
  const descEl    = document.getElementById('company-desc');
  const parentEl  = document.getElementById('company-parent');

  ov.querySelectorAll('.company-name, .company-name-big').forEach(el => el.textContent = name || 'Loading…');
  if (parentEl) parentEl.textContent = subtitle || '';
  if (descEl)   descEl.textContent = '';
  if (heroImg)  { heroImg.src = ''; heroImg.style.display = 'none'; }
  if (logoBig)  { logoBig.src = ''; logoBig.style.display = 'none'; }
  if (logoSm)   { logoSm.src = ''; logoSm.style.display = 'none'; }
  if (moviesRow) moviesRow.innerHTML = skelCards(6);
  if (tvRow)     tvRow.innerHTML     = '';
  if (grid)      grid.innerHTML      = skelCards(12);
  if (moviesSec) moviesSec.style.display = '';
  if (tvSec)     tvSec.style.display = 'none';

  // Initial logo from caller
  if (logoUrl && logoBig) { logoBig.src = logoUrl; logoBig.style.display = ''; }
  if (logoUrl && logoSm)  { logoSm.src = logoUrl;  logoSm.style.display = ''; }

  try {
    const data = await fetchFn();

    // Update name, desc, logo, backdrop
    if (data.name)  ov.querySelectorAll('.company-name, .company-name-big').forEach(el => el.textContent = data.name);
    if (data.desc && descEl) descEl.textContent = data.desc;
    if (data.parent && parentEl) parentEl.textContent = data.parent;
    if (data.logoUrl) {
      if (logoBig) { logoBig.src = data.logoUrl; logoBig.style.display = ''; }
      if (logoSm)  { logoSm.src  = data.logoUrl; logoSm.style.display  = ''; }
    }
    if (data.backdropUrl && heroImg) {
      heroImg.src = data.backdropUrl; heroImg.style.display = '';
    }

    const movies     = data.movies     || [];
    const tv         = data.tv         || [];
    const topMovies  = data.topMovies  || [];
    const topTv      = data.topTv      || [];
    const moreMovies = data.moreMovies || [];
    const moreTv     = data.moreTv     || [];
    const originals  = data.originals  || [];
    const topRated   = data.topRated   || data.topMovies || [];
    const all        = [...movies, ...tv];

    // ── ROW VIEW: Full home-page style rows ───────────────────────
    const rowView = ov.querySelector('#company-row-view');
    if (rowView) {
      rowView.innerHTML = '';

      const makeRow = (rowId, icon, secTitle, items, type) => {
        if (!items.length) return '';
        const cards = items.slice(0,20).map(m => makeCard(m, m.media_type || type)).join('');
        return `<div class="section">
          <div class="sec-header">
            <div class="sec-title">
              <span class="material-icons-round sec-icon">${icon}</span>${esc(secTitle)}
            </div>
          </div>
          <div class="row-wrap">
            <div class="row-arrow row-arrow-l hidden"><button data-scroll-row="${rowId}" data-scroll-dir="-1"><span class="material-icons-round">chevron_left</span></button></div>
            <div class="card-row" id="${rowId}">${cards}</div>
            <div class="row-arrow row-arrow-r"><button data-scroll-row="${rowId}" data-scroll-dir="1"><span class="material-icons-round">chevron_right</span></button></div>
          </div>
        </div>`;
      };

      // Interleave movies+TV for the popular mixed row
      const popularMixed = [];
      for (let i=0; i<Math.max(movies.length,tv.length); i++) { if(movies[i]) popularMixed.push(movies[i]); if(tv[i]) popularMixed.push(tv[i]); }
      const topMixed = [];
      for (let i=0; i<Math.max(topMovies.length,topTv.length); i++) { if(topMovies[i]) topMixed.push(topMovies[i]); if(topTv[i]) topMixed.push(topTv[i]); }
      const moreMixed = [];
      for (let i=0; i<Math.max(moreMovies.length,moreTv.length); i++) { if(moreMovies[i]) moreMixed.push(moreMovies[i]); if(moreTv[i]) moreMixed.push(moreTv[i]); }

      const rows = [
        originals.length    ? makeRow('cp-originals',  'star',              `Only on ${name}`,  originals,    null)   : '',
        popularMixed.length ? makeRow('cp-popular',    'local_fire_department', `Popular on ${name}`, popularMixed, null) : '',
        movies.length       ? makeRow('cp-movies',     'movie',             'Popular Movies',    movies,       'movie'): '',
        tv.length           ? makeRow('cp-tv',         'tv',                'Popular Shows',     tv,           'tv')   : '',
        topMixed.length     ? makeRow('cp-toprated',   'workspace_premium', 'Top Rated',         topMixed,     null)   : '',
        topMovies.length    ? makeRow('cp-topmovies',  'movie',             'Top Rated Movies',  topMovies,    'movie'): '',
        topTv.length        ? makeRow('cp-toptv',      'tv',                'Top Rated Shows',   topTv,        'tv')   : '',
        moreMixed.length    ? makeRow('cp-more',       'explore',           'More to Explore',   moreMixed,    null)   : '',
      ].filter(Boolean);

      rowView.innerHTML = rows.join('') || '<p style="padding:3rem;color:var(--muted);text-align:center;font-size:1rem">No content available for this provider in your region.</p>';

      // Wire scroll arrows inside provider overlay
      rowView.querySelectorAll('[data-scroll-row]').forEach(btn => {
        btn.addEventListener('click', () => {
          const rowEl = document.getElementById(btn.dataset.scrollRow);
          if (rowEl) rowEl.scrollBy({ left: +btn.dataset.scrollDir * rowEl.clientWidth * 0.75, behavior: 'smooth' });
        });
      });

      // Wire card clicks
      rowView.querySelectorAll('.card[data-id][data-type]').forEach(cardEl => {
        if (!cardEl._provWired) {
          cardEl._provWired = true;
          cardEl.addEventListener('click', e => {
            if (e.target.closest('button')) return;
            ov.classList.remove('open');
            document.body.style.overflow = '';
            setTimeout(() => openMedia(+cardEl.dataset.id, cardEl.dataset.type), 60);
          });
        }
      });
    }

    // ── COMPACT VIEW: dense grid ──────────────────────────────────
    if (grid) {
      grid.innerHTML = all.length
        ? all.slice(0,48).map(m => makeCard(m, m.media_type||'movie')).join('')
        : '<p style="padding:1rem;color:var(--muted)">No content found</p>';
    }
  } catch (e) {
    console.warn('[SV] Company overlay error:', e?.message);
    if (moviesRow) moviesRow.innerHTML = '<p style="padding:1rem;color:var(--muted)">Could not load content.</p>';
  }
}

/* ── EXTERNAL API ENRICHMENT FOR INFO PAGE ───────────────────────── */
async function _enrichInfoPage(id, type, details, credits) {
  // ── Check display settings ──
  const showRatings  = getSetting('showOMDbRatings')  !== false;
  const showWtw      = getSetting('showWhereToWatch') !== false;
  const showKeywords = getSetting('showKeywordTags')  !== false;
  const showAwards   = getSetting('showAwardsBanner') !== false;

  // ── Reset all enrichment sections first (clean slate between opens) ──
  const resetIds = ['info-multi-ratings','info-wtw-section','info-collection-section',
                    'info-keywords-section','info-ani-tags'];
  resetIds.forEach(rid => {
    const el = document.getElementById(rid);
    if (el) { el.style.display = 'none'; el.innerHTML = rid === 'info-multi-ratings' ? '' : el.innerHTML; }
  });
  const collLink = document.getElementById('info-collection-link');
  if (collLink) collLink.style.display = 'none';

  // ── ANIME: show AniList tags ──────────────────────────────────────
  if (type === 'anime') {
    const tagData = details._aniTags || [];
    if (tagData.length) {
      const tagsEl = document.getElementById('info-ani-tags');
      const kwSec = document.getElementById('info-keywords-section');
      if (tagsEl) {
        tagsEl.innerHTML = tagData.map(t =>
          `<span class="info-ani-tag" title="${esc(t.category)}">${esc(t.name)}</span>`
        ).join('');
      }
      if (kwSec) kwSec.style.display = '';
    }
    return;
  }

  // ── TV show aggregate_credits: adds directors/writers/crew ──────────
  // For TV shows, individual episode directors aren't in /credits — use aggregate_credits
  if (type === 'tv' && credits) {
    const _aggToken = id; // guard against stale responses if user opens another item
    tmdb(`/tv/${id}/aggregate_credits`).then(agg => {
      if (!agg) return;
      // Race-condition guard: ignore if user has navigated to a different item
      if (state.currentInfoMedia?.id !== _aggToken) return;
      const extraEl = document.querySelector('#info-overlay .info-extra-details');
      if (!extraEl) return;

      // Top directors across episodes
      const dirMap = {};
      (agg.crew || []).filter(c => c.jobs?.some(j => j.job === 'Director')).forEach(c => {
        dirMap[c.name] = (dirMap[c.name] || 0) + (c.jobs?.find(j => j.job === 'Director')?.episode_count || 1);
      });
      const topDirs = Object.entries(dirMap).sort((a,b) => b[1]-a[1]).slice(0,2).map(([n]) => n);

      // Top writers
      const wrMap = {};
      (agg.crew || []).filter(c => c.jobs?.some(j => ['Writer','Teleplay','Story'].includes(j.job))).forEach(c => {
        wrMap[c.name] = (wrMap[c.name] || 0) + (c.jobs?.[0]?.episode_count || 1);
      });
      const topWrs = Object.entries(wrMap).sort((a,b) => b[1]-a[1]).slice(0,2).map(([n]) => n);

      const addDetail = (key, names) => {
        if (!names.length) return;
        // Skip if already shown from credits
        const existing = [...extraEl.querySelectorAll('.info-detail-key')].some(el => el.textContent === key);
        if (existing) return;
        const row = document.createElement('div');
        row.className = 'info-detail-row';
        row.innerHTML = `<span class="info-detail-key">${esc(key)}</span><span class="info-detail-val info-clickable-people">${names.map(n=>`<span class="info-person-link" data-search="${esc(n)}">${esc(n)}</span>`).join(', ')}</span>`;
        // Insert at top of extra-details
        extraEl.insertBefore(row, extraEl.firstChild);
      };

      if (topWrs.length) addDetail('Writer', topWrs);
      if (topDirs.length) addDetail('Director', topDirs);
    }).catch(() => {});
  }

  // ── Resolve IMDB ID (needed for OMDb + Watchmode) ─────────────────
  let imdbId = details.imdb_id;
  if (!imdbId) {
    const extIds = await tmdb(`/${type}/${id}/external_ids`).catch(() => ({}));
    imdbId = extIds?.imdb_id || null;
  }

  // ── OMDb: IMDb, Rotten Tomatoes, Metacritic, Awards, Box Office ───
  if (imdbId) {
    if (showRatings) fetchOMDb(imdbId).then(omdb => {
      if (!omdb || omdb.Response === 'False') return;
      // In dev/test mode, show which API sourced each piece of data
      const isDevMode = document.body.classList.contains('test-mode');

      // Rating pills row (IMDb / RT / Metacritic)
      const ratingsEl = document.getElementById('info-multi-ratings');
      if (ratingsEl) {
        const imdbR = (omdb.imdbRating && omdb.imdbRating !== 'N/A') ? omdb.imdbRating : null;
        const rtVal  = omdb.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value;
        const mcVal  = omdb.Ratings?.find(r => r.Source === 'Metacritic')?.Value;
        const rt  = (rtVal  && rtVal  !== 'N/A') ? rtVal  : null;
        const mc  = (mcVal  && mcVal  !== 'N/A') ? mcVal.replace('/100','') : null;
        const rtPct = rt ? parseInt(rt, 10) : -1;
        const mcNum = mc ? parseInt(mc, 10) : -1;
        const mcColor = mcNum >= 61 ? '#6c3' : mcNum >= 40 ? '#fc3' : '#f00';

        // IMDb: official yellow badge
        // RT: tomato emoji fresh/rotten
        // Metacritic: color-coded square (green/yellow/red)
        const pills = [
          imdbR ? `<div class="rating-pill imdb" title="IMDb: ${imdbR}/10">
            <span style="background:#F5C518;color:#000;font-family:Arial Black,sans-serif;font-weight:900;font-size:.7em;padding:.1rem .3rem;border-radius:3px;flex-shrink:0">IMDb</span>
            <strong>${imdbR}</strong><span style="font-size:.68em;color:var(--muted)">/10</span>
          </div>` : '',

          rt !== null ? `<div class="rating-pill ${rtPct >= 60 ? 'rt-fresh' : 'rt-rotten'}" title="Rotten Tomatoes: ${rt}">
            <span style="font-size:1rem;line-height:1;flex-shrink:0">${rtPct >= 60 ? '🍅' : '🤢'}</span>
            <strong>${rt}</strong>
            ${rtPct >= 75 ? '<span style="font-size:.6em;color:#f97316;font-weight:700">Certified</span>' : ''}
          </div>` : '',

          mc !== null ? `<div class="rating-pill metacritic" title="Metacritic: ${mc}/100" style="border-color:${mcColor}44;background:${mcColor}11">
            <span style="background:${mcColor};color:#000;font-weight:900;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;font-size:.72em;flex-shrink:0">${mc}</span>
            <span style="color:var(--muted);font-size:.68em">/ 100</span>
          </div>` : '',
        ].filter(Boolean).join('');

        if (pills) {
          // In dev mode: show source label
          const sourceLabel = isDevMode
            ? `<span style="font-size:.6rem;background:rgba(245,197,24,.15);color:#f5c518;padding:.06rem .35rem;border-radius:3px;font-weight:700;align-self:center;margin-left:.3rem">via OMDb</span>`
            : '';
          ratingsEl.innerHTML = pills + sourceLabel;
          ratingsEl.style.display = '';
        }
      }

      // Awards banner (only if nominated/won something meaningful)
      const awards = (omdb.Awards && omdb.Awards !== 'N/A') ? omdb.Awards : null;
      if (awards) {
        const awardsEl = document.getElementById('info-awards-banner');
        if (awardsEl) {
          awardsEl.textContent = awards;
          awardsEl.style.display = '';
        }
      }

      if (!showAwards) {
        const ab = document.getElementById('info-awards-banner');
        if (ab) ab.style.display = 'none';
      }
      // Box office + extra details in side panel
      const extraEl = document.querySelector('#info-overlay .info-extra-details');
      if (extraEl) {
        const addDetail = (key, val) => {
          if (!val || val === 'N/A') return;
          const existing = [...extraEl.querySelectorAll('.info-detail-key')].some(el => el.textContent === key);
          if (existing) return;
          const row = document.createElement('div');
          row.className = 'info-detail-row omdb-detail';
          row.innerHTML = `<span class="info-detail-key">${esc(key)}</span><span class="info-detail-val">${esc(val)}</span>`;
          extraEl.appendChild(row);
        };
        addDetail('Box Office', omdb.BoxOffice);
        addDetail('Rated', omdb.Rated);
        // Add IMDB link
        if (imdbId) {
          const existing = extraEl.querySelector('.imdb-link-row');
          if (!existing) {
            const row = document.createElement('div');
            row.className = 'info-detail-row imdb-link-row';
            row.innerHTML = `<span class="info-detail-key">IMDb</span><a class="info-detail-val" href="https://www.imdb.com/title/${imdbId}/" target="_blank" rel="noopener" style="color:#f5c518;text-decoration:none">View on IMDb ↗</a>`;
            extraEl.appendChild(row);
          }
        }
      }
    }).catch(() => {});

    // ── Watchmode: Where to Watch ──────────────────────────────────
    if (showWtw) fetchWatchmode(imdbId).then(sources => {
      if (!sources?.length) return;
      const wtwEl  = document.getElementById('info-where-to-watch');
      const wtwSec = document.getElementById('info-wtw-section');
      if (!wtwEl || !wtwSec) return;

      // Sort: free first, then subscription, then rent/buy
      const typeOrder = { free: 0, sub: 1, rent: 2, buy: 3 };
      const sorted = [...sources].sort((a,b) => (typeOrder[a.type]??9) - (typeOrder[b.type]??9));

      // Deduplicate by service name, max 8
      const seen = new Set();
      const unique = sorted.filter(s => { if (!s.name || seen.has(s.name)) return false; seen.add(s.name); return true; }).slice(0,8);

      const typeColors = { free: '#22c55e', sub: '#b3b3b3', rent: '#f59e0b', buy: '#f97316' };
      const typeLabels = { free: 'Free', sub: 'Subscription', rent: 'Rent', buy: 'Buy' };

      // Map Watchmode service names to TMDB watch provider IDs for internal provider pages
      const WM_TO_TMDB = {
        'Netflix':8,'Amazon Prime Video':9,'Hulu':15,'Disney Plus':337,'Max':384,'HBO Max':384,
        'Apple TV Plus':350,'Peacock':386,'Peacock Premium':386,'Paramount Plus':531,'Crunchyroll':283,
        'Tubi TV':73,'Pluto TV':300,'Kanopy':191,'Shudder':99,'Mubi':11,'FuboTV':257,
        'AMC Plus':526,'Starz':43,'Showtime':37,'BritBox':151,'Acorn TV':196,'Plex':538,
      };
      wtwEl.innerHTML = unique.map(s => {
        const color = typeColors[s.type] || '#888';
        const label = typeLabels[s.type] || s.type;
        const svgLogo = _getProviderSVG(s.name);
        const tmdbProviderId = WM_TO_TMDB[s.name];
        const externalUrl = (s.web_url && s.web_url !== 'N/A') ? s.web_url : null;
        return `<div class="wtw-badge wtw-${s.type||'sub'}" data-provider-id="${tmdbProviderId||''}" data-provider-name="${esc(s.name)}" data-external="${esc(externalUrl||'')}" style="cursor:pointer">
          <span class="wtw-logo">${svgLogo}</span>
          <span class="wtw-name">${esc(s.name)}</span>
          <span class="wtw-type" style="color:${color}">${label}</span>
          ${externalUrl ? `<a class="wtw-ext-link" href="${externalUrl}" target="_blank" rel="noopener" title="Open ${s.name}" onclick="event.stopPropagation()"><span class="material-icons-round" style="font-size:.75rem">open_in_new</span></a>` : ''}
        </div>`;
      }).join('');

      // Click = open StaticVault provider page
      wtwEl.querySelectorAll('.wtw-badge[data-provider-id]').forEach(badge => {
        badge.addEventListener('click', e => {
          if (e.target.closest('.wtw-ext-link')) return;
          const pid = badge.dataset.providerId;
          const name = badge.dataset.providerName;
          if (pid) openProviderPage(+pid, name);
        });
      });

      if (unique.length) wtwSec.style.display = '';
    }).catch(() => {});
  }

  // ── TMDB Keywords as clickable tags ───────────────────────────────
  const kws = (details.keywords?.keywords || details.keywords?.results || []).slice(0, 16);
  const kwEl  = document.getElementById('info-keywords-tags');
  const kwSec = document.getElementById('info-keywords-section');
  if (showKeywords && kwEl && kws.length) {
    const _renderKwTags = () => {
      kwEl.innerHTML = kws.map(k => {
        const liked    = isTagLiked(k.id);
        const disliked = isTagDisliked(k.id);
        const cls = liked ? ' kw-liked' : disliked ? ' kw-disliked' : '';
        return `<span class="info-keyword-tag${cls}" data-kw-id="${k.id}" data-kw-name="${esc(k.name)}">${esc(k.name)}</span>`;
      }).join('');
      kwEl.querySelectorAll('.info-keyword-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
          e.stopPropagation();
          _showTagMenu(tag, { id: +tag.dataset.kwId, name: tag.dataset.kwName });
        });
      });
    };
    _renderKwTags();
    if (kwSec) kwSec.style.display = '';
  }

  function _showTagMenu(anchorEl, tag) {
    // Remove any existing tag menu
    document.getElementById('tag-action-menu')?.remove();
    const liked    = isTagLiked(tag.id);
    const disliked = isTagDisliked(tag.id);
    const menu = document.createElement('div');
    menu.id = 'tag-action-menu';
    menu.className = 'tag-action-menu';
    menu.innerHTML = `
      <div class="tag-menu-title">${esc(tag.name)}</div>
      <button class="tag-menu-btn${liked ? ' active' : ''}" data-action="like">
        <span class="material-icons-round">${liked ? 'favorite' : 'favorite_border'}</span>
        ${liked ? 'Liked — click to remove' : 'Like this tag'}
      </button>
      <button class="tag-menu-btn${disliked ? ' active warn' : ''}" data-action="dislike">
        <span class="material-icons-round">${disliked ? 'thumb_down' : 'thumb_down_off_alt'}</span>
        ${disliked ? 'Disliked — click to remove' : 'Show less like this'}
      </button>
      <button class="tag-menu-btn secondary" data-action="search">
        <span class="material-icons-round">search</span>
        Search this tag
      </button>
    `;

    // Position near anchor
    document.body.appendChild(menu);
    const rect = anchorEl.getBoundingClientRect();
    const mw = 220;
    let left = rect.left;
    if (left + mw > window.innerWidth - 12) left = window.innerWidth - mw - 12;
    if (left < 8) left = 8;
    let top = rect.bottom + 6; // fixed positioning: viewport-relative, no scrollY
    // Clamp to viewport
    menu.style.left = left + 'px';
    menu.style.top  = top + 'px';
    menu.style.width = mw + 'px';

    // Focus for keyboard dismiss
    menu.setAttribute('tabindex', '-1');
    setTimeout(() => menu.focus(), 10);

    const _close = () => menu.remove();

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'like') {
        toggleTagLike(tag);
      } else if (action === 'dislike') {
        toggleTagDislike(tag);
      } else if (action === 'search') {
        _close();
        closeInfoPage();
        goPage('search');
        setTimeout(() => {
          const inp = document.getElementById('search-input');
          if (inp) { inp.value = ':' + tag.name; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        }, 150);
        return;
      }
      // Re-render the tag chip state
      const chip = kwEl?.querySelector(`[data-kw-id="${tag.id}"]`);
      if (chip) {
        chip.classList.remove('kw-liked', 'kw-disliked');
        if (isTagLiked(tag.id)) chip.classList.add('kw-liked');
        else if (isTagDisliked(tag.id)) chip.classList.add('kw-disliked');
      }
      _close();
      // Refresh prefs page if open
      if (state.currentPage === 'prefs') renderTagPrefsSection();
    });

    menu.addEventListener('blur', (e) => {
      if (!menu.contains(e.relatedTarget)) setTimeout(_close, 120);
    });

    // Click outside dismisses
    const _outsideClick = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorEl) {
        _close();
        document.removeEventListener('mousedown', _outsideClick, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', _outsideClick, true), 80);
  }

  // ── TMDB Collection / Franchise — show actual movies in row ────────
  if (details.belongs_to_collection && getSetting('showKeywordTags') !== false) {
    const col = details.belongs_to_collection;
    const collSec = document.getElementById('info-collection-section');
    const collEl  = document.getElementById('info-collection-link');
    if (collSec) {
      collSec.style.display = '';
      // Show collection name as clickable link
      if (collEl) {
        collEl.textContent = `${col.name} →`;
        collEl.dataset.collectionId = col.id;
        collEl.style.display = '';
        collEl.onclick = null;
        collEl.addEventListener('click', () => openCollectionPage(col.id, col.name), { once: true });
      }
      // Fetch the full collection and show movies in a compact horizontal row
      tmdb(`/collection/${col.id}`).then(colData => {
        const parts = (colData.parts || [])
          .sort((a,b) => (a.release_date||'') > (b.release_date||'') ? 1 : -1);
        if (!parts.length) return;
        const collGrid = collSec.querySelector('#info-collection-grid');
        if (collGrid) {
          collGrid.innerHTML = `<div class="info-collection-scroll">${
            parts.map(m => {
              const poster = m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : '';
              const yr = String(m.release_date||'').slice(0,4);
              return `<div class="info-col-film" data-id="${m.id}" data-type="movie" style="cursor:pointer" title="${esc(m.title||'')}">
                <div class="info-col-poster" style="background:var(--s3)">
                  ${poster ? `<img src="${poster}" alt="${esc(m.title||'')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:5px">` : '<span class="material-icons-round" style="font-size:1.5rem;color:var(--dim)">movie</span>'}
                </div>
                <div class="info-col-film-title">${esc((m.title||'').slice(0,20))}</div>
                <div class="info-col-film-year" style="font-size:.62rem;color:var(--dim)">${yr}</div>
              </div>`;
            }).join('')
          }</div>`;
          // Wire clicks
          collGrid.querySelectorAll('.info-col-film[data-id]').forEach(el => {
            el.addEventListener('click', () => {
              closeInfoPage();
              setTimeout(() => openInfoPage(+el.dataset.id, 'movie'), 80);
            });
          });
        }
      }).catch(() => {});
    }
  }
}

export async function openPersonPage(personId) {
  // Close any other overlays first — only one thing open at a time
  document.getElementById('info-overlay')?.classList.remove('open');
  document.getElementById('company-overlay')?.classList.remove('open');
  const ov = document.getElementById('person-overlay');
  if (!ov) return;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';

  if (!ov._wired) {
    ov._wired = true;
    document.getElementById('person-close')?.addEventListener('click', closePersonPage);
    ov.addEventListener('click', e => { if (e.target === ov) closePersonPage(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ov.classList.contains('open')) closePersonPage();
    });
    // Tab switching
    ov.addEventListener('click', e => {
      const tab = e.target.closest('.person-tab');
      if (!tab) return;
      ov.querySelectorAll('.person-tab').forEach(t => t.classList.toggle('on', t === tab));
      loadPersonCredits(ov._personId, tab.dataset.tab);
    });
    // Card clicks within person overlay — close person page first so modal opens on top
    ov.addEventListener('click', e => {
      const card = e.target.closest('.card[data-id][data-type]');
      if (!card || e.target.closest('button')) return;
      const itemId = +card.dataset.id;
      const itemType = card.dataset.type;
      if (!itemId || !itemType) return;
      closePersonPage();
      // Small delay so person overlay fully closes before modal opens
      setTimeout(() => openMedia(itemId, itemType, {
        title: card.dataset.title,
        poster_path: card.dataset.poster,
      }), 60);
    });
    // Bio expand on click
    document.getElementById('person-bio')?.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  }

  ov._personId = personId;
  history.pushState({ personId }, '', `${location.pathname}?person=${personId}`);

  const nameEl  = document.getElementById('person-name');
  const metaEl  = document.getElementById('person-meta');
  const bioEl   = document.getElementById('person-bio');
  const photoEl = document.getElementById('person-photo');
  const grid    = document.getElementById('person-grid');

  if (nameEl)  nameEl.textContent = 'Loading…';
  if (bioEl)   bioEl.textContent = '';
  if (grid)    grid.innerHTML = '<div class="spin" style="margin:2rem auto;display:block"></div>';

  // Default to "All" tab
  ov.querySelectorAll('.person-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === 'all'));

  try {
    const person = await tmdb(`/person/${personId}`, { append_to_response: 'combined_credits' });

    if (nameEl)  nameEl.textContent = person.name || '';
    if (photoEl) {
      photoEl.src = person.profile_path ? imgUrl(person.profile_path, 'w500') : '';
      photoEl.alt = person.name || '';
      photoEl.style.display = person.profile_path ? '' : 'none';
    }
    if (bioEl) {
      bioEl.textContent = person.biography || 'No biography available.';
      bioEl.classList.remove('expanded');
    }
    if (metaEl) {
      const items = [
        person.known_for_department,
        person.birthday ? `Born ${person.birthday.slice(0,4)}` : null,
        person.place_of_birth,
      ].filter(Boolean);
      metaEl.innerHTML = items.map(s => `<span class="person-meta-item">${esc(s)}</span>`).join('');
    }

    // SEO
    const personPhoto = person.profile_path
      ? `https://image.tmdb.org/t/p/w780${person.profile_path}`
      : 'https://staticvault931.github.io/assets/icons/favicon.png';
    document.title = `${person.name} — Films & TV — StaticVault931`;
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${person.name} — StaticVault931`);
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', personPhoto);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', `${location.origin}/?person=${personId}`);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${location.origin}/?person=${personId}`);

    ov._credits = person.combined_credits || {};
    loadPersonCredits(personId, 'all'); // default: show all credits
  } catch (e) {
    if (nameEl) nameEl.textContent = 'Could not load person';
    console.warn('[SV] Person page error:', e?.message);
  }
}

function loadPersonCredits(personId, type) {
  const ov = document.getElementById('person-overlay');
  const grid = document.getElementById('person-grid');
  if (!grid || !ov._credits) return;
  let items;
  if (type === 'all') {
    items = [...(ov._credits.cast || []), ...(ov._credits.crew || [])];
  } else {
    items = (ov._credits.cast || []).filter(m => m.media_type === type);
  }
  // Sort by vote_count * vote_average — most culturally significant works first
  items.sort((a, b) => ((b.vote_count || 0) * (b.vote_average || 0)) - ((a.vote_count || 0) * (a.vote_average || 0)));
  const seen = new Set();
  items = items.filter(m => { if (!m.id || seen.has(m.id)) return false; seen.add(m.id); return true; });
  const html = items.map(m => makeCard(m, m.media_type || type)).join('');
  grid.innerHTML = html || `<p style="color:var(--muted);padding:1rem;text-align:center;">No credits found.</p>`;
}

function closePersonPage() {
  document.getElementById('person-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
  // Restore URL when closing person page
  if (location.search.includes('person=')) history.back();
}

export function closeInfoPage() {
  // Stop trailer iframe — use about:blank for reliable audio/video kill in all browsers
  const tf = document.getElementById('info-trailer-frame');
  if (tf) { tf.removeAttribute('src'); tf.src = 'about:blank'; }
  const overlay = document.getElementById('info-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  state.currentInfoMedia = null;
  resetPageSEO();
}

/* ── TRAILER OVERLAY (multi-key fallback) ───────────────────────── */
function openTrailerOverlay(key, title, details) {
  const ov = document.getElementById('trailer-overlay');
  if (!ov) return;

  if (!ov._wired) {
    ov._wired = true;
    document.getElementById('trailer-ov-close')?.addEventListener('click', closeTrailerOverlay);
    ov.addEventListener('click', e => { if (e.target === ov) closeTrailerOverlay(); });
  }

  // Build list of ALL available keys — YouTube first, Vimeo as fallback
  const videos = details?.videos?.results || [];
  const allKeys = [
    ...videos.filter(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official).map(v => v.key),
    ...videos.filter(v => v.site === 'YouTube' && v.type === 'Trailer' && !v.official).map(v => v.key),
    ...videos.filter(v => v.site === 'YouTube' && v.type === 'Teaser').map(v => v.key),
    ...videos.filter(v => v.site === 'YouTube' && (v.type === 'Clip' || v.type === 'Featurette')).map(v => v.key),
    ...videos.filter(v => v.site === 'YouTube').map(v => v.key),
    key,
  ].filter((k, i, a) => k && a.indexOf(k) === i); // unique, defined

  // Vimeo as last resort
  const vimeoKeys = videos.filter(v => v.site === 'Vimeo').map(v => v.key).filter(Boolean);

  // Poster for fallback
  const posterImg = details?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
    : details?.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : null;

  const bgImg = document.getElementById('trailer-ov-bg');
  const ytLink = document.getElementById('trailer-ov-yt-link');
  const titleEl = document.getElementById('trailer-ov-title');

  if (bgImg && posterImg) bgImg.src = posterImg;
  if (titleEl) titleEl.textContent = `${title || 'Trailer'}`;
  ov.classList.add('open');

  // Try keys in sequence (YouTube first, then Vimeo as last resort)
  _tryTrailerKey(allKeys, 0, ytLink, posterImg, vimeoKeys);
}

function _tryTrailerKey(keys, idx, ytLink, posterImg, vimeoKeys) {
  const frame = document.getElementById('trailer-ov-frame');
  const fallback = document.getElementById('trailer-ov-fallback');

  // If no frame, bail
  if (!frame) return;

  // All YouTube keys exhausted — try Vimeo
  if (idx >= keys.length) {
    if (vimeoKeys && vimeoKeys.length) {
      const vk = vimeoKeys[0];
      frame.style.display = '';
      if (fallback) fallback.style.display = 'none';
      frame.src = `https://player.vimeo.com/video/${vk}?autoplay=1&muted=1&loop=0&title=0&byline=0&portrait=0`;
      // Vimeo can't be easily detected via postMessage, just trust it loaded
      frame.onload = null;
      return;
    }
    // All sources exhausted — show fallback with poster image
    frame.style.display = 'none';
    if (fallback) fallback.style.display = '';
    if (ytLink && keys[0]) ytLink.href = `https://www.youtube.com/watch?v=${keys[0]}`;
    return;
  }

  const key = keys[idx];
  if (ytLink) ytLink.href = `https://www.youtube.com/watch?v=${key}`;
  if (fallback) fallback.style.display = 'none';
  frame.style.display = '';
  frame.onload = null;

  // Try youtube-nocookie first (some Error 153 videos work there), then regular YouTube
  const isEven = idx % 2 === 0;
  const ytBase = 'https://www.youtube.com';
  frame.src = `${ytBase}/embed/${key}?autoplay=1&rel=0&modestbranding=1&fs=1&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=https%3A%2F%2Fstaticvault931.github.io`;

  let resolved = false;

  const msgHandler = (e) => {
    if (e.origin !== 'https://www.youtube.com') return;
    try {
      const d = JSON.parse(e.data);

      // onError event (Error 153 = not embeddable)
      if (d.event === 'onError' || (d.func === 'onError')) {
        resolved = true;
        window.removeEventListener('message', msgHandler);
        clearTimeout(retryTimer);
        _tryTrailerKey(keys, idx + 1, ytLink, posterImg, vimeoKeys);
        return;
      }

      // playerState via infoDelivery
      const ps = d.info?.playerState;
      if (ps === 1 || ps === 3) {
        // Playing or buffering — success!
        resolved = true;
        window.removeEventListener('message', msgHandler);
        clearTimeout(retryTimer);
      } else if (typeof ps === 'number' && ps < 0 && d.info?.error) {
        resolved = true;
        window.removeEventListener('message', msgHandler);
        clearTimeout(retryTimer);
        _tryTrailerKey(keys, idx + 1, ytLink, posterImg, vimeoKeys);
      }
    } catch {}
  };
  window.addEventListener('message', msgHandler);

  // 6 second timeout per key
  const retryTimer = setTimeout(() => {
    if (resolved) return;
    window.removeEventListener('message', msgHandler);
    _tryTrailerKey(keys, idx + 1, ytLink, posterImg, vimeoKeys);
  }, 6000);
}

function closeTrailerOverlay() {
  const ov = document.getElementById('trailer-overlay');
  if (!ov) return;
  ov.classList.remove('open');
  const frame = document.getElementById('trailer-ov-frame');
  if (frame) frame.removeAttribute('src');
  clearTimeout(+ov.dataset.fallbackTimer);
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

  function renderShortcutsGrid() {
    const grid = document.getElementById('shortcuts-grid');
    if (!grid) return;
    const disabled = state.disabledShortcuts || {};
    const groups = [...new Set(SHORTCUTS.map(s => s.group))];
    const half = Math.ceil(groups.length / 2);
    const leftGroups  = groups.slice(0, half);
    const rightGroups = groups.slice(half);

    const renderGroup = (g) => `
      <div class="sc-group">
        <div class="sc-group-label">${g}</div>
        ${SHORTCUTS.filter(s => s.group === g).map(s => {
          const keyId = s.key.toLowerCase().replace(/[^a-z0-9/]/g, '_');
          const isOff = !!disabled[keyId];
          return `<div class="sc-item shortcut-row${isOff ? ' disabled' : ''}" data-shortcut-id="${keyId}" title="${isOff ? 'Click to re-enable' : 'Click to disable this shortcut'}">
            <kbd class="sc-key shortcut-key">${esc(s.key)}</kbd>
            <span class="sc-desc">${esc(s.desc)}${isOff ? '<span class="shortcut-disabled-badge">off</span>' : ''}</span>
          </div>`;
        }).join('')}
      </div>`;

    grid.innerHTML = `
      <div class="sc-col">${leftGroups.map(renderGroup).join('')}</div>
      <div class="sc-col">${rightGroups.map(renderGroup).join('')}</div>
      <div style="grid-column:1/-1;margin-top:.7rem;padding:.55rem .8rem;background:rgba(255,255,255,.04);border-radius:8px;font-size:.7rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span class="material-icons-round" style="font-size:.9rem;flex-shrink:0;color:var(--red)">touch_app</span>
        <span>Click any shortcut to <strong style="color:var(--text)">disable</strong> it. It shows grayed out. Click again to re-enable.</span>
        ${Object.keys(disabled).length > 0 ? `<button id="reset-shortcuts-btn" style="margin-left:auto;background:rgba(229,9,20,.15);border:1px solid rgba(229,9,20,.3);color:var(--red);font-size:.68rem;font-weight:800;padding:.2rem .55rem;border-radius:4px;cursor:pointer">Reset all</button>` : ''}
      </div>`;

    // Click to toggle shortcut on/off
    grid.querySelectorAll('.shortcut-row').forEach(row => {
      row.addEventListener('click', () => {
        const kid = row.dataset.shortcutId;
        if (!kid) return;
        if (!state.disabledShortcuts) state.disabledShortcuts = {};
        state.disabledShortcuts[kid] = !state.disabledShortcuts[kid];
        if (!state.disabledShortcuts[kid]) delete state.disabledShortcuts[kid];
        persist('disabledShortcuts');
        renderShortcutsGrid();
      });
    });
    // Reset all shortcuts button
    document.getElementById('reset-shortcuts-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      state.disabledShortcuts = {};
      persist('disabledShortcuts');
      renderShortcutsGrid();
    });
  }

  renderShortcutsGrid();
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  document.getElementById('shortcuts-close')?.addEventListener('click', () => ov.classList.remove('open'));
  // Re-render when shortcuts overlay opens (in case state changed)
  ov.addEventListener('transitionend', () => { if (ov.classList.contains('open')) renderShortcutsGrid(); });
}

/* ── TESTING MODE ────────────────────────────────────────────────── */
// Step 1: Footer logo (bottom bar text) × 5 within 3s
/* ── PROFILES ──────────────────────────────────────────────────────── */
// PROFILE_COLORS declared at top of file (before init IIFE)
let _editingProfileId = null;

function initProfilesUI() {
  document.getElementById('profile-header-btn')?.addEventListener('click', openProfilesOverlay);
  document.getElementById('profiles-close')?.addEventListener('click', closeProfilesOverlay);
  document.getElementById('profiles-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('profiles-overlay')) closeProfilesOverlay();
  });
  document.getElementById('profile-editor-close')?.addEventListener('click', closeProfileEditor);
  document.getElementById('profile-editor-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('profile-editor-overlay')) closeProfileEditor();
  });
  document.getElementById('profiles-add-btn')?.addEventListener('click', () => openProfileEditor(null));
  document.getElementById('profile-save-btn')?.addEventListener('click', saveProfileFromEditor);
  document.getElementById('profile-delete-btn')?.addEventListener('click', deleteProfileFromEditor);
  // Color picker
  const colorRow = document.getElementById('profile-color-row');
  if (colorRow) {
    const allColors = ['transparent', ...PROFILE_COLORS];
    colorRow.innerHTML = allColors.map(c => {
      const style = c === 'transparent'
        ? 'background: conic-gradient(#999 25%, #ddd 25%, #ddd 50%, #999 50%, #999 75%, #ddd 75%) center / 10px 10px; border: 2px dashed var(--border3);'
        : `background:${c}`;
      return `<button class="profile-color-swatch" data-color="${c}" style="${style}" aria-label="${c === 'transparent' ? 'Transparent' : c}" title="${c === 'transparent' ? 'Transparent' : ''}"></button>`;
    }).join('');
    colorRow.addEventListener('click', e => {
      const sw = e.target.closest('[data-color]');
      if (!sw) return;
      colorRow.querySelectorAll('.profile-color-swatch').forEach(s => s.classList.toggle('on', s === sw));
      const prev = document.getElementById('profile-avatar-preview');
      const chosenColor = sw.dataset.color;
      if (prev) prev.style.background = chosenColor && chosenColor !== 'transparent' ? chosenColor : 'transparent';
    });
  }
  document.getElementById('profile-change-avatar-btn')?.addEventListener('click', openPersonSearchForAvatar);
  updateProfileHeaderBtn();
}

function updateProfileHeaderBtn() {
  const profiles = getProfiles();
  const active = profiles.find(p => p.id === getActiveProfileId()) || profiles[0];
  const mini = document.getElementById('profile-avatar-mini');
  if (!mini || !active) return;
  mini.innerHTML = active.avatar
    ? `<img src="${esc(active.avatar)}" alt="${esc(active.name)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`
    : `<span class="material-icons-round" style="font-size:.9rem">person</span>`;
  const btn = document.getElementById('profile-header-btn');
  if (btn && active.color) btn.style.outline = `2px solid ${active.color}`;
}

function openProfilesOverlay() {
  const ov = document.getElementById('profiles-overlay');
  if (!ov) return;
  ov.classList.add('open');
  renderProfilesGrid();
}

function closeProfilesOverlay() {
  document.getElementById('profiles-overlay')?.classList.remove('open');
}

function renderProfilesGrid() {
  const grid = document.getElementById('profiles-grid');
  if (!grid) return;
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  grid.innerHTML = profiles.map(p => `
    <div class="profile-card${p.id === activeId ? ' active' : ''}" data-pid="${p.id}" tabindex="0" role="button">
      <div class="profile-avatar-circle" style="background:${p.color && p.color !== 'transparent' ? p.color : 'transparent'}">
        ${p.avatar ? `<img src="${esc(p.avatar)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<span class="material-icons-round">person</span>`}
      </div>
      <div class="profile-card-name">${esc(p.name)}</div>
      ${p.id === activeId ? `<div class="profile-card-active-badge">Active</div>` : ''}
      <button class="profile-card-edit-btn" data-pid="${p.id}" title="Edit">
        <span class="material-icons-round">edit</span>
      </button>
    </div>`).join('');

  grid.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.profile-card-edit-btn')) return;
      const pid = card.dataset.pid;
      if (pid === getActiveProfileId()) { closeProfilesOverlay(); return; }
      switchProfile(pid);
      updateProfileHeaderBtn();
      applyAllSettings(); // re-apply the new profile's display/player settings
      if (!e.shiftKey) closeProfilesOverlay();
      // Full refresh: clear caches, reload all content for new profile
      _clearRowCache();
      _homeLoading = false;
      sessionStorage.removeItem('sv_trend_views'); // reset trending position
      // Clear daily row selection so new profile gets its own selection
      const daySeed = Math.floor(Date.now() / (24 * 3600000));
      sessionStorage.removeItem(`sv_row_sel_${daySeed}`);
      sessionStorage.removeItem(`sv_std_sel_${daySeed}`);
      // Reload everything
      loadHero().catch(() => {});
      loadHomeRows().catch(() => {});
      renderLibrary();
      buildAgeRatingUI();
      buildSettingsUI();
      // Rebuild prefs UI if on that page
      if (state.currentPage === 'prefs') {
        buildGenreChips('genre-scroll', GENRES, () => {}, state.prefGenres);
      }
      toast(e.shiftKey ? 'Profile switched!' : 'Switched!', 'person');
    });
    card.querySelectorAll('.profile-card-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        closeProfilesOverlay();
        openProfileEditor(btn.dataset.pid);
      });
    });
  });
}

function openProfileEditor(profileId) {
  const ov = document.getElementById('profile-editor-overlay');
  if (!ov) return;
  _editingProfileId = profileId;
  const profile = profileId ? getProfiles().find(p => p.id === profileId) : null;
  const title = document.getElementById('profile-editor-title');
  const nameInput = document.getElementById('profile-name-input');
  const preview = document.getElementById('profile-avatar-preview');
  const deleteBtn = document.getElementById('profile-delete-btn');
  const colorRow = document.getElementById('profile-color-row');
  if (title) title.textContent = profile ? 'Edit Profile' : 'New Profile';
  if (nameInput) { nameInput.value = profile?.name || ''; setTimeout(() => nameInput.focus(), 100); }
  if (deleteBtn) deleteBtn.style.display = profile && getProfiles().length > 1 ? '' : 'none';
  const color = profile?.color || '#e50914';
  const currentAvatar = profile?.avatar || '';
  if (preview) {
    preview.style.background = color && color !== 'transparent' ? color : 'transparent';
    preview.innerHTML = currentAvatar
      ? `<img src="${esc(currentAvatar)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<span class="material-icons-round">person</span>`;
  }
  // Highlight active quick avatar
  ov.querySelectorAll('.pe-quick-avatar').forEach(el => {
    el.classList.toggle('on', el.dataset.avatar === currentAvatar);
  });
  colorRow?.querySelectorAll('.profile-color-swatch').forEach(s => s.classList.toggle('on', s.dataset.color === color));

  // Wire quick avatar clicks (once per open — check wired flag)
  if (!ov._quickAvatarWired) {
    ov._quickAvatarWired = true;
    ov.addEventListener('click', e => {
      const qa = e.target.closest('.pe-quick-avatar');
      if (!qa) return;
      const avatarUrl = qa.dataset.avatar || '';
      const colorRow2 = document.getElementById('profile-color-row');
      const activeColor = colorRow2?.querySelector('.profile-color-swatch.on')?.dataset.color || '#e50914';
      const previewEl = document.getElementById('profile-avatar-preview');
      if (previewEl) {
        previewEl.style.background = avatarUrl ? 'transparent' : (activeColor !== 'transparent' ? activeColor : '#e50914');
        previewEl.innerHTML = avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
          : `<span class="material-icons-round">person</span>`;
      }
      ov.querySelectorAll('.pe-quick-avatar').forEach(el => el.classList.toggle('on', el === qa));
    });
  }

  ov.classList.add('open');
}

function closeProfileEditor() {
  document.getElementById('profile-editor-overlay')?.classList.remove('open');
  _editingProfileId = null;
}

function saveProfileFromEditor() {
  const name = (document.getElementById('profile-name-input')?.value || '').trim() || 'Profile';
  const colorRow = document.getElementById('profile-color-row');
  const color = colorRow?.querySelector('.profile-color-swatch.on')?.dataset.color || '#e50914';
  // Get avatar from: active quick-avatar chip, or preview img src
  const activeQA = document.getElementById('profile-editor-overlay')?.querySelector('.pe-quick-avatar.on');
  const avatarImg = document.getElementById('profile-avatar-preview')?.querySelector('img');
  const avatar = activeQA != null ? (activeQA.dataset.avatar || null) : (avatarImg?.src || null);
  if (_editingProfileId) {
    updateProfile(_editingProfileId, { name, color, avatar });
    toast('Profile updated!', 'check_circle');
  } else {
    const p = createProfile(name, avatar, color);
    if (!p) { toast('Maximum 10 profiles reached', 'warning'); return; }
    toast('Profile created!', 'check_circle');
  }
  closeProfileEditor();
  updateProfileHeaderBtn();
}

function deleteProfileFromEditor() {
  if (!_editingProfileId) return;
  if (getProfiles().length <= 1) { toast('Cannot delete last profile', 'warning'); return; }
  const activeId = getActiveProfileId();
  deleteProfile(_editingProfileId);
  if (activeId === _editingProfileId) {
    const rem = getProfiles();
    if (rem.length) switchProfile(rem[0].id);
  }
  closeProfileEditor();
  updateProfileHeaderBtn();
  toast('Profile deleted', 'delete');
}

function openPersonSearchForAvatar() {
  // Show built-in avatar picker with special options + search
  const picker = document.createElement('div');
  picker.id = 'avatar-picker-modal';
  picker.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:1.5rem;';
  picker.innerHTML = `
    <div style="background:var(--s1);border-radius:14px;width:100%;max-width:560px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.95);">
      <div style="display:flex;align-items:center;gap:.75rem;padding:1.1rem 1.3rem;border-bottom:1px solid var(--border);">
        <h3 style="flex:1;font-size:1rem;font-weight:900;">Choose Avatar</h3>
        <button id="avatar-picker-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.4rem;line-height:1;">×</button>
      </div>
      <div style="padding:1rem 1.3rem;display:flex;flex-direction:column;gap:.75rem;">
        <div style="font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:.2rem">Featured</div>
        <div style="display:flex;gap:.65rem;flex-wrap:wrap;">${(() => {
          const featuredAvatars = [
            { url: 'assets/icons/favicon.png', name: 'SV931', special: 'sv931' },
            { url: 'https://cdn.jsdelivr.net/gh/StaticQuasar931/Images@main/squarestaticquasar931logo.jpg', name: 'StaticQuasar', special: 'sq931' },
            // Person avatars: searched by exact name via TMDB — always correct face
            { name: 'Robert Downey Jr.',  searchName: 'Robert Downey Jr.' },
            { name: 'Millie Bobby Brown', searchName: 'Millie Bobby Brown' },
            { name: 'Tom Cruise',         searchName: 'Tom Cruise' },
            { name: 'Leonardo DiCaprio',  searchName: 'Leonardo DiCaprio' },
            { name: 'Zendaya',            searchName: 'Zendaya' },
            { name: 'Ryan Reynolds',      searchName: 'Ryan Reynolds' },
            { name: 'Scarlett Johansson', searchName: 'Scarlett Johansson' },
            { name: 'Dwayne Johnson',     searchName: 'Dwayne Johnson' },
          ];
          return featuredAvatars.map(a => {
            const imgSrc = a.url || 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 viewBox%3D%220 0 40 40%22%3E%3Crect width%3D%2240%22 height%3D%2240%22 rx%3D%2220%22 fill%3D%22%23333%22/%3E%3C/svg%3E';
            return `<div class="avatar-option" data-url="${a.url || ''}"${a.special ? ` data-special="${a.special}"` : ''}${a.searchName ? ` data-person-name="${a.searchName}"` : ''} style="cursor:pointer;text-align:center;">
              <img src="${imgSrc}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--border2);background:var(--s2);" alt="${a.name}">
              <div style="font-size:.6rem;color:var(--muted);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:64px">${a.name}</div>
            </div>`;
          }).join('');
        })()}</div>
        <div style="font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-top:.4rem;margin-bottom:.35rem">Search for an Image</div>
        <div style="display:flex;gap:.4rem;margin-bottom:.4rem;">
          <button id="avatar-tab-people" class="avatar-search-tab on" style="flex:1;padding:.35rem .6rem;border-radius:6px;border:1.5px solid var(--red);background:var(--red);color:#fff;font-size:.72rem;font-weight:900;cursor:pointer;">People</button>
          <button id="avatar-tab-content" class="avatar-search-tab" style="flex:1;padding:.35rem .6rem;border-radius:6px;border:1.5px solid var(--border2);background:var(--s3);color:var(--muted);font-size:.72rem;font-weight:900;cursor:pointer;">Movies &amp; Shows</button>
        </div>
        <div style="position:relative;">
          <input id="avatar-search-input" placeholder="Search actor, director, movie, show…" style="width:100%;background:var(--s2);border:1.5px solid var(--border2);border-radius:8px;padding:.65rem 1rem;color:var(--text);font-size:.88rem;outline:none;">
        </div>
        <div id="avatar-search-results" style="display:flex;flex-wrap:wrap;gap:.6rem;min-height:80px;align-content:flex-start;"></div>
      </div>
    </div>`;
  document.body.appendChild(picker);

  // Load person avatars by searching TMDB with the exact display name — always the correct face
  picker.querySelectorAll('.avatar-option[data-person-name]').forEach(opt => {
    const name = opt.dataset.personName;
    if (!name) return;
    const img = opt.querySelector('img');
    tmdb('/search/person', { query: name, language: 'en-US' }).then(d => {
      const person = (d.results || []).find(p => p.profile_path) || d.results?.[0];
      if (person?.profile_path) {
        const u = `https://image.tmdb.org/t/p/w185${person.profile_path}`;
        if (img) {
          img.style.opacity = '0';
          img.src = u;
          img.onload = () => { img.style.transition = 'opacity .2s'; img.style.opacity = '1'; };
        }
        opt.dataset.url = u;
      }
    }).catch(() => {});
  });

  // Close
  picker.querySelector('#avatar-picker-close')?.addEventListener('click', () => picker.remove());
  picker.addEventListener('click', e => { if (e.target === picker) picker.remove(); });

  // Apply selection
  picker.addEventListener('click', e => {
    const opt = e.target.closest('.avatar-option');
    if (!opt) return;
    const url = opt.dataset.url;
    const prev = document.getElementById('profile-avatar-preview');
    if (prev) prev.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    picker.remove();
    // Easter egg for special avatars
    if (opt.dataset.special === 'sv931') toast('You chose the StaticVault931 logo!', 'movie');
    if (opt.dataset.special === 'sq931') toast('StaticQuasar931 — the creator! Nice choice!', 'auto_awesome');
  });

  // Search
  const searchInput  = picker.querySelector('#avatar-search-input');
  const resultsEl   = picker.querySelector('#avatar-search-results');
  const tabPeople   = picker.querySelector('#avatar-tab-people');
  const tabContent  = picker.querySelector('#avatar-tab-content');
  let searchMode = 'people'; // 'people' | 'content'
  let searchTimer;

  function setSearchTab(mode) {
    searchMode = mode;
    tabPeople?.classList.toggle('on', mode === 'people');
    tabContent?.classList.toggle('on', mode === 'content');
    const peopleSty = mode === 'people';
    if (tabPeople) { tabPeople.style.background = peopleSty ? 'var(--red)' : 'var(--s3)'; tabPeople.style.borderColor = peopleSty ? 'var(--red)' : 'var(--border2)'; tabPeople.style.color = peopleSty ? '#fff' : 'var(--muted)'; }
    if (tabContent) { tabContent.style.background = !peopleSty ? 'var(--red)' : 'var(--s3)'; tabContent.style.borderColor = !peopleSty ? 'var(--red)' : 'var(--border2)'; tabContent.style.color = !peopleSty ? '#fff' : 'var(--muted)'; }
    searchInput?.setAttribute('placeholder', mode === 'people' ? 'Type any actor or director name…' : 'Type a movie or TV show title…');
    if (searchInput?.value.trim()) searchInput.dispatchEvent(new Event('input'));
    else _showFillerAvatars();
  }
  tabPeople?.addEventListener('click',  () => setSearchTab('people'));
  tabContent?.addEventListener('click', () => setSearchTab('content'));

  // Show popular people as filler when no search is typed
  const _showFillerAvatars = async () => {
    if (searchMode === 'people') {
      resultsEl.innerHTML = '<div style="color:var(--dim);font-size:.72rem;padding:.4rem 0">Popular people</div>';
      const d = await tmdb('/person/popular', { page: 1 }).catch(() => ({ results: [] }));
      const people = (d.results || []).filter(p => p.profile_path).slice(0, 10);
      resultsEl.innerHTML = (people.length ? '' : '') + people.map(p =>
        `<div class="avatar-option" data-url="https://image.tmdb.org/t/p/w185${p.profile_path}" style="cursor:pointer;text-align:center;width:68px;">
          <img src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${esc(p.name)}" style="width:58px;height:58px;border-radius:50%;object-fit:cover;border:2px solid var(--border2);display:block;margin:0 auto;">
          <div style="font-size:.58rem;color:var(--muted);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:68px">${esc(p.name)}</div>
        </div>`).join('');
    } else {
      resultsEl.innerHTML = '<div style="color:var(--dim);font-size:.72rem;padding:.4rem 0">Trending now</div>';
      const d = await tmdb('/trending/all/week', { page: 1 }).catch(() => ({ results: [] }));
      const items = (d.results || []).filter(x => x.poster_path).slice(0, 10);
      resultsEl.innerHTML = items.map(m =>
        `<div class="avatar-option" data-url="https://image.tmdb.org/t/p/w185${m.poster_path}" style="cursor:pointer;text-align:center;width:68px;">
          <img src="https://image.tmdb.org/t/p/w185${m.poster_path}" alt="${esc(m.title||m.name)}" style="width:58px;height:58px;border-radius:8px;object-fit:cover;border:2px solid var(--border2);display:block;margin:0 auto;">
          <div style="font-size:.58rem;color:var(--muted);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:68px">${esc(m.title||m.name)}</div>
        </div>`).join('');
    }
  };
  setTimeout(_showFillerAvatars, 100); // show on open

  searchInput?.addEventListener('input', function() {
    clearTimeout(searchTimer);
    const q = this.value.trim();
    if (!q) { _showFillerAvatars(); return; }
    resultsEl.innerHTML = '<div style="color:var(--dim);font-size:.8rem;padding:.5rem">Searching…</div>';
    searchTimer = setTimeout(async () => {
      try {
        let items = [];
        if (searchMode === 'content') {
          // Search movies + TV shows — use poster as avatar image
          const [movies, tv] = await Promise.allSettled([
            tmdb('/search/movie', { query: q, language: 'en-US' }),
            tmdb('/search/tv',    { query: q, language: 'en-US' }),
          ]);
          const m = movies.status==='fulfilled' ? (movies.value.results||[]).filter(x=>x.poster_path).slice(0,6).map(x=>({ url:`https://image.tmdb.org/t/p/w185${x.poster_path}`, name: x.title||x.name })) : [];
          const t = tv.status==='fulfilled'    ? (tv.value.results||[]).filter(x=>x.poster_path).slice(0,6).map(x=>({ url:`https://image.tmdb.org/t/p/w185${x.poster_path}`, name: x.name||x.title })) : [];
          for (let i = 0; i < Math.max(m.length, t.length); i++) { if (m[i]) items.push(m[i]); if (t[i]) items.push(t[i]); }
        } else {
          // Search people
          const d = await tmdb('/search/person', { query: q, language: 'en-US' });
          items = (d.results||[]).filter(p=>p.profile_path).slice(0,12).map(p=>({
            url: `https://image.tmdb.org/t/p/w185${p.profile_path}`,
            name: p.name,
          }));
        }
        if (!items.length) { resultsEl.innerHTML = '<div style="color:var(--dim);font-size:.8rem;padding:.5rem">No results found</div>'; return; }
        resultsEl.innerHTML = items.map(item => `
          <div class="avatar-option" data-url="${esc(item.url)}" style="cursor:pointer;text-align:center;width:68px;">
            <img src="${esc(item.url)}" alt="${esc(item.name)}"
              style="width:58px;height:58px;border-radius:${searchMode==='content'?'8px':'50%'};object-fit:cover;border:2px solid var(--border2);display:block;margin:0 auto;">
            <div style="font-size:.58rem;color:var(--muted);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:68px">${esc(item.name)}</div>
          </div>`).join('');
      } catch { resultsEl.innerHTML = '<div style="color:var(--dim);font-size:.8rem;padding:.5rem">Search failed</div>'; }
    }, 380);
  });
}

/* ── TESTING MODE ──────────────────────────────────────────────────── */
// Activation: type "iopiop" anywhere on the page (no special page required)
let _testCodeBuffer = '';
let _testCodeTimer = null;
const TEST_CODE = 'iopiop';

function initTestMode() {
  // Step 1: Click footer logo/bottom 5 times within 2.5 seconds to arm
  let _footerClicks = 0;
  let _footerTimer = null;
  let _armed = false;

  document.getElementById('footer')?.addEventListener('click', e => {
    if (!e.target.closest('.footer-logo, .footer-bottom')) return;
    _footerClicks++;
    clearTimeout(_footerTimer);
    if (_footerClicks >= 5) {
      _footerClicks = 0;
      _armed = true;
      _testCodeBuffer = '';
      clearTimeout(_testCodeTimer);
      // Must type the code within 15 seconds
      _testCodeTimer = setTimeout(() => { _armed = false; _testCodeBuffer = ''; }, 15000);
    } else {
      _footerTimer = setTimeout(() => { _footerClicks = 0; }, 2500);
    }
  });

  // Step 2: Type "iopiop" after arming
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select')) return;
    if (e.key.length !== 1 || !/[a-zA-Z0-9]/.test(e.key)) return;
    _testCodeBuffer += e.key.toLowerCase();
    clearTimeout(_testCodeTimer);
    if (_testCodeBuffer.length > TEST_CODE.length * 2) {
      _testCodeBuffer = _testCodeBuffer.slice(-TEST_CODE.length * 2);
    }
    if (_testCodeBuffer.endsWith(TEST_CODE)) {
      if (!_armed) { _testCodeBuffer = ''; return; } // must be armed first
      _armed = false;
      _testCodeBuffer = '';
      const on = document.body.classList.toggle('test-mode');
      if (on) { populateTestPanel(); goPage('prefs'); }
      else {
        const panel = document.getElementById('dev-test-panel');
        if (panel) panel.style.display = 'none';
      }
    }
    _testCodeTimer = setTimeout(() => { _testCodeBuffer = ''; }, 3000);
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
  // Create panel once; CSS shows it when test-mode is active on prefs/library
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
          <button class="dev-btn" id="dev-btn-skeleton">Force Skeletons</button>
          <button class="dev-btn" id="dev-btn-no-img">Break Images</button>
          <button class="dev-btn" id="dev-btn-slow">Slow Mode</button>
          <button class="dev-btn" id="dev-btn-adblock">AdBlock: ON</button>
          <button class="dev-btn" id="dev-btn-clear">Clear Cache</button>
          <button class="dev-btn" id="dev-btn-sandbox">Sandbox: ON</button>
          <button class="dev-btn" id="dev-btn-no-hover">Hover Trailer: ON</button>
        </div>
        <div class="dev-btn-row" style="margin-top:.4rem">
          <span class="card-rating rating-great"><span class="material-icons-round">star</span>9.5</span>
          <span class="card-rating rating-good"><span class="material-icons-round">star</span>7.8</span>
          <span class="card-rating rating-ok"><span class="material-icons-round">star</span>5.4</span>
          <span class="card-rating rating-bad"><span class="material-icons-round">star</span>3.1</span>
          <span style="font-size:.7rem;color:var(--dim);align-self:center;margin-left:.3rem">Rating previews</span>
        </div>
      </div>

      <div class="dev-section" id="dev-themes-section">
        <div class="dev-sec-title">Themes
          <div class="dev-btn-row" style="display:inline-flex;margin-left:.5rem">
            <button class="dev-btn dev-btn-sm" data-set-theme="dark">Dark</button>
            <button class="dev-btn dev-btn-sm" data-set-theme="light">Light</button>
            <button class="dev-btn dev-btn-sm" data-set-theme="midnight">Midnight</button>
            <button class="dev-btn dev-btn-sm" data-set-theme="warm">Warm</button>
          </div>
        </div>
      </div>

      <div class="dev-section">
        <div class="dev-sec-title">Source Testing
          <button class="dev-btn dev-btn-sm" id="dev-test-all-btn" style="margin-left:.5rem">Test All</button>
        </div>
        <div class="dev-providers-grid" id="dev-providers-grid"></div>
      </div>`;

    // Append to prefs page; library gets a reference copy
    const prefsPage = document.getElementById('page-prefs');
    if (prefsPage) prefsPage.appendChild(panel);
    // Also append a clone to library page
    const libPage = document.getElementById('page-library');
    if (libPage) {
      const clone = panel.cloneNode(false);
      clone.id = 'dev-test-panel-lib';
      clone.className = 'dev-test-panel';
      clone.style.cssText = 'display:none;margin-top:2.5rem;border:1.5px dashed rgba(229,9,20,.35);border-radius:10px;overflow:hidden;background:rgba(229,9,20,.04);';
      clone.innerHTML = `<div class="dev-panel-header" style="padding:.45rem 1rem;font-size:.72rem">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--red)"><path d="M9.4 3L7 8H3l7.5 13 2-7.5H17L9.4 3z"/></svg>
        <span>Dev Mode Active — Go to <button style="background:none;border:none;color:var(--red);font-weight:800;cursor:pointer;font-size:.72rem;text-decoration:underline" onclick="goPage&&goPage('prefs')">Customize Feed</button> to open the testing panel</span>
      </div>`;
      libPage.appendChild(clone);
      // Show the lib clone when test mode is on
      new MutationObserver(() => {
        clone.style.display = document.body.classList.contains('test-mode') ? 'block' : 'none';
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // Wire up buttons (single init)
    document.getElementById('dev-close')?.addEventListener('click', () => {
      document.body.classList.remove('test-mode');
      panel.style.display = 'none';
    });

    // Theme buttons via event delegation (no inline onclick)
    panel.addEventListener('click', e => {
      const t = e.target.closest('[data-set-theme]');
      if (t) document.documentElement.dataset.theme = t.dataset.setTheme;
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

    // Sandbox toggle — removes sandbox from player iframe (may allow more player features)
    document.getElementById('dev-btn-sandbox')?.addEventListener('click', function() {
      const sandboxOn = this.textContent.includes('ON');
      const iframe = document.getElementById('player-frame');
      const ncFrame = document.getElementById('nc-frame');
      if (sandboxOn) {
        iframe?.removeAttribute('sandbox');
        ncFrame?.removeAttribute('sandbox');
        this.textContent = 'Sandbox: OFF';
        this.classList.add('dev-btn-active');
        toast('Sandbox removed from player (reload to revert)', 'warning');
      } else {
        iframe?.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation');
        ncFrame?.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups');
        this.textContent = 'Sandbox: ON';
        this.classList.remove('dev-btn-active');
        toast('Sandbox restored', 'security');
      }
    });

    // Hover trailer toggle
    document.getElementById('dev-btn-no-hover')?.addEventListener('click', function() {
      const setting = getSetting('showHoverTrailer');
      setSetting('showHoverTrailer', !setting);
      this.textContent = `Hover Trailer: ${!setting ? 'ON' : 'OFF'}`;
      this.classList.toggle('dev-btn-active', !setting);
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
  const ptestIconEl = document.getElementById(`ptest-icon-${id}`);
  const ptestStatusEl = document.getElementById(`ptest-status-${id}`);
  if (iconEl) iconEl.innerHTML = _provStatusSVG('testing');
  if (ptestIconEl) ptestIconEl.innerHTML = _provStatusSVG('testing');
  if (ptestStatusEl) ptestStatusEl.textContent = 'Testing…';

  // Use the base domain for testing (much faster than embed URL)
  // In no-cors mode, any response (even CORS block) = server is reachable
  const testUrl = prov.domain || prov.url(550, 'movie', 1, 1);
  const ctrl = new AbortController();
  // 10-second timeout (some providers behind CDNs are slow to respond)
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    await fetch(testUrl, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
    clearTimeout(timer);

    // no-cors fetch resolves for reachable URLs (response is opaque but that's fine)
    const working = JSON.parse(localStorage.getItem('sv_provider_working') || '{}');
    working[id] = Date.now();
    localStorage.setItem('sv_provider_working', JSON.stringify(working));
    if (iconEl) iconEl.innerHTML = _provStatusSVG('ok');
    if (ptestIconEl) ptestIconEl.innerHTML = _provStatusSVG('ok');
    if (ptestStatusEl) ptestStatusEl.textContent = 'OK';
    const row = document.getElementById(`tp-row-${id}`);
    if (row) row.querySelector('.tp-btn')?.classList.add('tp-ok');
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      if (iconEl) iconEl.innerHTML = _provStatusSVG('fail');
      if (ptestIconEl) ptestIconEl.innerHTML = _provStatusSVG('fail');
      if (ptestStatusEl) ptestStatusEl.textContent = 'Timed out';
      // Don't toast — too noisy when running all tests at once
    } else {
      // Network/CORS error treated as reachable (browser masked the real response)
      const working = JSON.parse(localStorage.getItem('sv_provider_working') || '{}');
      working[id] = Date.now();
      localStorage.setItem('sv_provider_working', JSON.stringify(working));
      if (iconEl) iconEl.innerHTML = _provStatusSVG('ok');
      if (ptestIconEl) ptestIconEl.innerHTML = _provStatusSVG('ok');
      if (ptestStatusEl) ptestStatusEl.textContent = 'OK';
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
    { r: 'TV-Y',   label: 'All Children',         desc: 'Designed for all children. Nothing offensive.' },
    { r: 'TV-Y7',  label: 'Ages 7 and Up',        desc: 'Suitable for ages 7+. May include mild fantasy violence.' },
    { r: 'G',      label: 'General Audiences',    desc: 'All ages. No offensive content. (Same as TV-G)' },
    { r: 'PG',     label: 'Parental Guidance',    desc: 'May not suit young children. Mild language or themes. (Same as TV-PG)' },
    { r: 'PG-13',  label: 'Ages 13+',             desc: 'May be inappropriate for children under 13. Some strong language, violence. (Same as TV-14)' },
    { r: 'R',      label: 'Restricted',            desc: 'Under 17 requires parent/guardian. Strong language, violence, adult themes. (Same as TV-MA)' },
    { r: 'NC-17',  label: 'Adults Only',           desc: 'No one under 17. Explicit adult content.' },
  ];
  // Make each desc clickable to change rating
  el.innerHTML = descs.map(d => `
    <div class="rating-desc${state.ageRating === d.r ? ' active' : ''}" data-age="${d.r}" style="cursor:pointer" title="Set to ${d.r}">
      <span class="rd-badge">${d.r}</span>
      <div><div class="rd-label">${d.label}</div><div class="rd-text">${d.desc}</div></div>
    </div>`).join('');
  el.querySelectorAll('.rating-desc[data-age]').forEach(card => {
    card.addEventListener('click', () => {
      state.ageRating = card.dataset.age;
      persist('ageRating');
      buildAgeRatingUI();
      buildRatingDescriptions();
      _applyAgeBasedPreferences(card.dataset.age);
      window._prefsDirty = true;
    });
  });
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

/* ── TMDB TITLE TREATMENT LOGOS (lazy card logo loader) ─────────── */
// _cardLogoObserver and _cardLogoMutObs declared above init() to avoid TDZ crash
const _logoCache = new Map(); // id → logoUrl | null

async function _loadCardLogo(card) {
  const id   = card.dataset.id;
  const type = card.dataset.type;
  if (!id || !type) return;

  // Use cached result if available
  if (_logoCache.has(id)) {
    const url = _logoCache.get(id);
    if (url) _applyCardLogo(card, url);
    return;
  }

  try {
    const ep = type === 'anime' ? 'tv' : type;
    // Direct fetch — avoid tmdb() adding language=en-US which overrides include_image_language in Firefox
    const u = new URL(`${TMDB_BASE}/${ep}/${id}/images`);
    u.searchParams.set('include_image_language', 'en,null');
    const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${TMDB_RAT}` } });
    if (!r.ok) throw new Error('logo fetch failed');
    const data = await r.json();
    const allLogos = (data.logos || []).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    const best = allLogos.find(l => l.iso_639_1 === 'en' && l.file_path) || allLogos.find(l => l.file_path);
    const url = best ? `https://image.tmdb.org/t/p/w300${best.file_path}` : null;
    _logoCache.set(id, url);
    if (url) _applyCardLogo(card, url);
  } catch (err) {
    console.warn(`[SV Logo] card ${id} (${type}):`, err?.message || 'no logo');
    _logoCache.set(id, null);
  }
}

function _applyCardLogo(card, url) {
  const imgEl = card.querySelector('.card-logo-img');
  if (!imgEl) return;
  const _onLoaded = () => {
    imgEl.classList.add('loaded');
    const titleName = card.querySelector('.card-img-title-name');
    const titleYear = card.querySelector('.card-img-title-year');
    const titleBox  = card.querySelector('.card-img-title');
    if (titleName) titleName.style.display = 'none';
    if (titleYear) titleYear.style.display = 'none';
    if (titleBox)  titleBox.style.background = 'transparent';
  };
  imgEl.loading = 'eager'; // lazy + display:none never fires in Firefox
  imgEl.style.display = 'block';
  imgEl.alt = card.dataset.title || '';
  imgEl.addEventListener('load', _onLoaded, { once: true });
  imgEl.addEventListener('error', () => { imgEl.style.display = 'none'; }, { once: true });
  imgEl.src = url;
  if (imgEl.complete && imgEl.naturalWidth > 0) _onLoaded();
}

function _observeCards(target) {
  if (!_cardLogoObserver) return;
  if (target.matches?.('.card[data-id]:not([data-logo-obs])')) {
    target.dataset.logoObs = '1';
    _cardLogoObserver.observe(target);
  }
  target.querySelectorAll?.('.card[data-id]:not([data-logo-obs])').forEach(c => {
    c.dataset.logoObs = '1';
    _cardLogoObserver.observe(c);
  });
}

function initCardLogoObserver() {
  // Tear down previous observers
  _cardLogoObserver?.disconnect();
  _cardLogoMutObs?.disconnect();

  if (!getSetting('useTitleLogos')) return;

  _cardLogoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      _cardLogoObserver.unobserve(entry.target);
      _loadCardLogo(entry.target);
    });
  }, { rootMargin: '200px' });

  // Observe cards already in DOM
  _observeCards(document);

  // Watch for new cards added dynamically
  _cardLogoMutObs = new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) _observeCards(n); }));
  });
  _cardLogoMutObs.observe(document.body, { childList: true, subtree: true });
}

/* ── ACCESSIBILITY ───────────────────────────────────────────────── */
function initA11y() {
  // ── Focus trap helper ──────────────────────────────────────────
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';

  function trapFocus(el, e) {
    const focusable = [...el.querySelectorAll(FOCUSABLE)].filter(f => f.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ── Watch overlays for open/close to manage focus ────────────────
  const overlayIds = ['modal-overlay', 'info-overlay', 'person-overlay', 'company-overlay', 'shortcuts-overlay'];
  let _prevFocus = null;
  let _activeTrapEl = null;

  const _tabHandler = e => { if (e.key === 'Tab' && _activeTrapEl) trapFocus(_activeTrapEl, e); };
  document.addEventListener('keydown', _tabHandler);

  function onOverlayOpen(el) {
    _prevFocus = document.activeElement;
    _activeTrapEl = el;
    // Move focus to first focusable child or the container itself
    requestAnimationFrame(() => {
      const first = el.querySelector(FOCUSABLE + ', [autofocus]');
      if (first) first.focus();
      else el.focus?.();
    });
  }

  function onOverlayClose() {
    _activeTrapEl = null;
    if (_prevFocus && document.body.contains(_prevFocus)) {
      requestAnimationFrame(() => _prevFocus?.focus());
    }
    _prevFocus = null;
  }

  const overlayObs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type !== 'attributes' || m.attributeName !== 'class') return;
      const el = m.target;
      const isOpen = el.classList.contains('open');
      if (isOpen) onOverlayOpen(el);
      else if (_activeTrapEl === el) onOverlayClose();
    });
  });

  overlayIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) overlayObs.observe(el, { attributes: true });
  });

  // ── Page navigation announcer ─────────────────────────────────────
  const announcer = document.getElementById('sr-page-announce');
  const pageTitles = {
    home: 'Home', movies: 'Movies', tv: 'TV Shows', anime: 'Anime',
    trailers: 'Trailers', search: 'Search', library: 'Library',
    prefs: 'Customize Feed', seeall: 'Browse All',
  };
  document.addEventListener('click', e => {
    const pageEl = e.target.closest('[data-page]');
    if (!pageEl || pageEl.closest('[data-id]')) return;
    const p = pageEl.dataset.page;
    if (announcer && pageTitles[p]) {
      announcer.textContent = '';
      requestAnimationFrame(() => { announcer.textContent = `Navigated to ${pageTitles[p]}`; });
    }
    // Move focus to the new page's main content
    setTimeout(() => {
      const pg = document.getElementById('page-' + p);
      if (pg) { pg.setAttribute('tabindex', '-1'); pg.focus({ preventScroll: true }); }
    }, 50);
  }, { capture: false });

  // ── Nav tabs: aria-selected ────────────────────────────────────────
  // Update aria-selected on nav tabs whenever goPage is called
  const navObs = new MutationObserver(() => {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.setAttribute('aria-selected', tab.classList.contains('on') ? 'true' : 'false');
    });
  });
  const navTabs = document.getElementById('nav-tabs');
  if (navTabs) navObs.observe(navTabs, { subtree: true, attributes: true, attributeFilter: ['class'] });

  // Set initial aria-selected
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', tab.classList.contains('on') ? 'true' : 'false');
  });
  navTabs?.setAttribute('role', 'tablist');

  // ── Button aria-expanded for toggleable panels ────────────────────
  const expandableMap = {
    'prov-more-toggle': 'prov-more-panel',
    'left-panel-toggle': 'modal-left-panel',
    'right-panel-toggle': 'modal-right-panel',
  };
  Object.entries(expandableMap).forEach(([btnId, panelId]) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', panelId);
    btn.addEventListener('click', () => {
      const panel = document.getElementById(panelId);
      const expanded = panel?.style.display !== 'none' && panel?.classList.contains('open') || panel?.style.display === '';
      btn.setAttribute('aria-expanded', String(!expanded));
    });
  });

  // ── Video iframes: descriptive title attribute ────────────────────
  // The player iframe title is set dynamically when the source is loaded
  document.addEventListener('sv:player-loaded', e => {
    const iframe = document.querySelector('#modal-player iframe, #modal iframe');
    if (iframe && e.detail?.title) iframe.setAttribute('title', `${e.detail.title} — video player`);
  });

  // ── Keyboard: Escape closes top-most overlay ──────────────────────
  // (ESC handling already done in initKeyboard — ensure it fires for all overlays)
  // This is already handled in the existing keyboard handler.

  // ── prefers-reduced-motion sync ───────────────────────────────────
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotionPref = () => {
    if (mq.matches && getSetting('motionLevel') === 'default') {
      // Respect OS preference if user hasn't explicitly chosen default
      document.body.classList.add('sv-reduced-motion');
    }
  };
  syncMotionPref();
  mq.addEventListener('change', syncMotionPref);
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
    if (window.matchMedia('(hover: none)').matches) return;
    if (!getSetting('showHoverTrailer')) return;

    const card = e.target.closest('.card[data-id][data-type]');
    const ncCard = e.target.closest('#netflix-card');

    // Entered the netflix card itself — keep it open
    if (ncCard) return;

    // Don't trigger if hovering over a button inside the card (cards are <a> so skip that check)
    if (e.target.closest('button, .card-like-btn, .card-wl-btn, .card-watched-btn')) return;

    // Left all cards
    if (!card) {
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
    }, 1200); // 1200ms delay — long enough to not trigger on normal browsing
  });

  document.addEventListener('mouseleave', e => {
    if (e.target === document.documentElement) clearHoverTrailer();
  });

  // Scroll closes the hover card immediately — guard against duplicate listeners
  if (!window._svScrollHoverBound) {
    window._svScrollHoverBound = true;
    window.addEventListener('scroll', clearHoverTrailer, { passive: true });
  }

  // Leaving the netflix card itself
  document.getElementById('netflix-card')?.addEventListener('mouseleave', e => {
    if (!e.relatedTarget?.closest?.('.card')) clearHoverTrailer();
  });

  // Click ANYWHERE on the Netflix card opens the content
  const nc = document.getElementById('netflix-card');
  if (nc) {
    nc.addEventListener('click', e => {
      if (e.target.closest('#nc-wl') || e.target.closest('#nc-like')) return;
      const card = _hoverCurrentCard; // ← SAVE before clearHoverTrailer() nulls it
      if (!card) return;
      clearHoverTrailer();
      openMedia(+card.dataset.id, card.dataset.type, {
        title: card.dataset.title,
        poster_path: card.dataset.poster,
      });
    });
  }

  // Individual button overrides (also bubble up to the card click above)
  document.getElementById('nc-play')?.addEventListener('click', () => {
    // handled by the parent click — no separate action needed
  });
  document.getElementById('nc-more')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!_hoverCurrentCard) return;
    const id = +_hoverCurrentCard.dataset.id;
    const type = _hoverCurrentCard.dataset.type;
    if (!id || !type) return;
    clearHoverTrailer();
    openInfoPage(id, type, {
      title: _hoverCurrentCard.dataset.title,
      poster_path: _hoverCurrentCard.dataset.poster,
      backdrop_path: _hoverCurrentCard.dataset.backdrop,
    });
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
  if (nc) {
    nc.classList.remove('visible');
    // Run any DM cleanup timers
    if (nc._dmCleanup) { nc._dmCleanup(); nc._dmCleanup = null; }
  }
  // Force-stop iframe immediately — removeAttribute alone doesn't stop audio in all browsers
  const frame = document.getElementById('nc-frame');
  if (frame) { frame.removeAttribute('src'); frame.src = 'about:blank'; }
  // Reset backdrop
  const bd = document.getElementById('nc-backdrop');
  if (bd) { bd.style.opacity = '1'; bd.style.transition = ''; }
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
  const poster = (card.dataset.poster || '').trim() || null;
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
  // Always show title row initially; hidden only if English backdrop resolves
  const ncTitleRowEl = document.querySelector('.nc-title-row');
  if (ncTitleRowEl) ncTitleRowEl.style.display = '';
  if (metaEl) {
    const rVal = parseFloat(rating);
    const rColor = rVal >= 9 ? '#22c55e' : rVal >= 7 ? '#f5c518' : rVal >= 5 ? '#f97316' : rVal > 0 ? '#f87171' : '';
    metaEl.innerHTML = [
      year ? `<span class="nc-year">${year}</span>` : '',
      rating ? `<span class="nc-rating" style="color:${rColor}">★ ${rating}</span>` : '',
    ].filter(Boolean).join('');
  }
  if (backdrop) {
    const backdropPath = (card.dataset.backdrop || '').trim() || null;
    // ALWAYS show backdrop — never hide it (prevents black screen)
    backdrop.style.display = '';
    backdrop.style.opacity = '1';
    if (backdropPath) {
      backdrop.src = `https://image.tmdb.org/t/p/w500${backdropPath}`;
    } else if (poster) {
      backdrop.src = poster;
    } else {
      // No image — use a gradient placeholder so it's never pure black
      backdrop.src = '';
      backdrop.style.background = `linear-gradient(135deg, var(--s3) 0%, var(--s2) 100%)`;
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

  // ── STEP 1: Fetch trailer key, rich details, and best backdrop in parallel ──
  const detailsPromise = _genreCache.has(id)
    ? Promise.resolve(_genreCache.get(id))
    : fetchRichDetails(id, type);

  // Upgrade backdrop in background — prefer English TMDB backdrop (has title text baked in)
  fetchBestBackdrop(id, type).then(best => {
    if (!_hoverActive || _hoverCurrentCard !== card) return;
    if (best?.file_path && backdrop) {
      backdrop.src = `https://image.tmdb.org/t/p/w780${best.file_path}`;
    }
    // English backdrops already have the title text in the image — hide the text title
    const ncTitleRow = document.querySelector('.nc-title-row');
    if (ncTitleRow) ncTitleRow.style.display = best?.hasText ? 'none' : '';
  }).catch(() => {});

  // ── STEP 2: Fetch trailer ──────────────────────────────────────────
  if (!frame) return;
  if (backdrop) { backdrop.style.display = ''; backdrop.style.opacity = '1'; }

  const _hoverTitle = card.dataset.title || '';
  const _hoverYear  = card.dataset.year  || '';
  const trailerKey = await fetchTrailerKey(id, type, _hoverTitle, _hoverYear);

  if (!_hoverActive || _hoverCurrentCard !== card) { frame.removeAttribute('src'); return; }

  if (trailerKey && trailerKey !== '__none__') {
    frame.style.display = '';
    if (backdrop) { backdrop.style.opacity = '1'; backdrop.style.transition = 'opacity .5s'; }

    const playYouTube = (vidKey) => {
      if (!_hoverActive || _hoverCurrentCard !== card) return;
      // Always mute for reliable browser autoplay; setting controls whether to unmute after load
      const startMuted = 1;
      frame.src = `https://www.youtube.com/embed/${vidKey}?autoplay=1&mute=${startMuted}&controls=0&rel=0&modestbranding=1&fs=0&iv_load_policy=3&disablekb=1&enablejsapi=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;
      
      // Failsafe: reveal the iframe after 3 seconds even if JS API fails
      const failsafeTimer = setTimeout(() => {
        if (_hoverCurrentCard === card && _hoverActive && backdrop) {
          backdrop.style.opacity = '0';
        }
      }, 3000);

      const ytHandler = (e) => {
        if (e.origin !== 'https://www.youtube.com') return;
        try {
          const d = JSON.parse(e.data);
          if (d.event === 'infoDelivery' && d.info?.playerState === 1) {
            clearTimeout(failsafeTimer);
            if (backdrop && _hoverCurrentCard === card) backdrop.style.opacity = '0';
            // Honor the automute setting — playback started muted for autoplay
            // reliability; unmute now unless the user opted for muted previews
            if (!getSetting('automuteHoverTrailer') && _hoverCurrentCard === card) {
              _ytCmd(frame, 'unMute');
            }
            window.removeEventListener('message', ytHandler);
          } else if (d.event === 'onError') {
            // Trailer error — fall back to showing the backdrop image
            window.removeEventListener('message', ytHandler);
            if (backdrop && _hoverCurrentCard === card) backdrop.style.opacity = '1';
          }
        } catch {}
      };
      window.addEventListener('message', ytHandler);
      setTimeout(() => window.removeEventListener('message', ytHandler), 8000);
    };

    playYouTube(trailerKey);

  } else {
    frame.removeAttribute('src');
    if (backdrop) { backdrop.style.opacity = '1'; backdrop.style.objectFit = 'cover'; }
  }

  // ── STEP 3: Rich metadata — loads independently, updates UI when ready ──
  detailsPromise.then(details => {
    if (!_hoverActive || _hoverCurrentCard !== card) return;
    if (!details) { if (genresEl) genresEl.innerHTML = ''; return; }
    const genres = details.genres || [];
    const runtime = details.runtime || details.episode_run_time?.[0];
    const seasons = details.number_of_seasons;
    const certification = details._cert || '';
    if (genresEl) {
      genresEl.innerHTML = genres.length
        ? genres.slice(0,3).map(g=>`<span class="nc-genre-chip">${esc(g)}</span>`).join('<span class="nc-dot">·</span>')
        : '';
    }
    const extraMeta = [];
    if (runtime) { const h=Math.floor(runtime/60),m=runtime%60; extraMeta.push(h>0?`${h}h ${m}m`:`${m}m`); }
    if (seasons > 1) extraMeta.push(`${seasons} Seasons`);
    else if (seasons === 1) extraMeta.push('1 Season');
    if (certification) extraMeta.push(`<span class="nc-cert">${esc(certification)}</span>`);
    if (metaEl && extraMeta.length) metaEl.innerHTML += extraMeta.map(m=>`<span class="nc-extra">${m}</span>`).join('');
  }).catch(() => {});
}

function positionNetflixCard(card, nc) {
  const rect = card.getBoundingClientRect();
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  // Card width: proportionally larger than the source card (~1.3×) so the
  // hover preview clearly "grows" out of the card on every screen size
  const onSearch = state.currentPage === 'search';
  const ncW = Math.min(onSearch ? 720 : 680, Math.max(Math.round(rect.width * 1.3), onSearch ? 460 : 400));
  nc.style.width = `${ncW}px`;
  nc.style.maxHeight = '';     // clear any previous max-height
  nc.style.overflowY = '';

  // Use scrollHeight for accurate height even when inner content is taller than rendered
  const rawH = Math.max(nc.scrollHeight || 0, nc.offsetHeight || 0) || 480;
  // Cap the card at 85% of viewport height so it always fits
  const maxH = Math.floor(vpH * 0.85);
  const ncH = Math.min(rawH, maxH);
  if (rawH > maxH) {
    // Content taller than cap → allow inner scroll so buttons stay accessible
    nc.style.maxHeight = `${maxH}px`;
    nc.style.overflowY = 'auto';
  }

  // ── Horizontal positioning ──────────────────────────────────────
  let left = rect.left + (rect.width / 2) - (ncW / 2);
  const marginH = 12;

  if (left < marginH && left + ncW > vpW - marginH) {
    left = (vpW - ncW) / 2; // narrow viewport — centre
  } else if (left < marginH) {
    left = Math.max(marginH, rect.left);          // near left edge
  } else if (left + ncW > vpW - marginH) {
    left = Math.min(vpW - ncW - marginH, rect.right - ncW); // near right edge
  }
  left = Math.max(marginH, Math.min(left, vpW - ncW - marginH));

  // ── Vertical positioning ────────────────────────────────────────
  // Center the hover card over the original card's vertical midpoint
  let top = rect.top + rect.height / 2 - ncH / 2;

  // Hard clamp — keep within viewport (below header, above edge)
  top = Math.max(70, Math.min(top, vpH - ncH - 8));

  nc.style.left = `${left}px`;
  nc.style.top  = `${top}px`;
}

/* ── CLIPS FEED (YouTube Shorts / TikTok style) ─────────────────── */
let _trailersMuted = false; // audio on by default — the click that opened the Clips tab counts as user activation, and allow="autoplay" delegates it to the iframe
let _trailersObserver = null;
let _trailersPage = 1;
let _trailersLoading = false;
let _trailersLoaded = false;
let _trailersItems = [];

// Dwell-time genre scoring (genreId → score delta, stored in sessionStorage)
const _clipsDwellPrefs = (() => {
  try { return new Map(JSON.parse(sessionStorage.getItem('sv_clips_dwell') || '[]')); } catch { return new Map(); }
})();
function _saveClipsDwellPrefs() {
  try { sessionStorage.setItem('sv_clips_dwell', JSON.stringify([..._clipsDwellPrefs])); } catch {}
}

// Score a clip item based on user preferences (higher = more relevant)
function _scoreClipItem(item) {
  const prefGenres = new Set(state.prefGenres || []);
  const dislikedIds = new Set((state.disliked || []).map(x => x.id));
  const genreIds = item.genre_ids || [];
  let score = 0;
  genreIds.forEach(g => {
    if (prefGenres.has(String(g))) score += 2.5;
    score += (_clipsDwellPrefs.get(g) || 0) * 1.5; // amplify dwell signal
  });
  // Strong boost: watchlisted (user wants to watch but hasn't yet — perfect clip)
  if ((state.watchlist || []).some(w => w.id === item.id)) score += 4;
  // Mild boost: continue watching (already invested)
  if (state.continueWatching?.[item.id]) score += 2;
  // Liked items should still show (maybe they want to re-discover)
  if ((state.liked || []).some(l => l.id === item.id)) score += 1;
  // Penalty: disliked items
  if (dislikedIds.has(item.id)) score -= 8;
  // Penalty: recently viewed (already know about it)
  if (state.recentlyViewed?.some(r => r.id === item.id)) score -= 2;
  // Quality signal: boost high-rated content slightly
  const quality = (item.vote_average || 0) - 5; // positive for >5, negative for <5
  score += quality * 0.3;
  return score;
}

// Show tutorial as first in-feed slide (max 2 times total)
function _maybeShowClipsTutorial(feed) {
  feed.querySelector('.clips-tutorial-slide')?.remove();

  const count = +(localStorage.getItem('sv_clips_tut_v2') || 0);
  if (count >= 2) return;
  localStorage.setItem('sv_clips_tut_v2', String(count + 1));

  const slide = document.createElement('div');
  slide.className = 'trailer-slide clips-tutorial-slide';
  slide.innerHTML = `
    <div class="clips-tut-bg"></div>
    <div class="clips-tut-content">
      <div class="clips-tut-icon"><span class="material-icons-round">play_circle</span></div>
      <h3 class="clips-tut-title">Discover with Clips</h3>
      <p class="clips-tut-desc">Your personal discovery feed — scroll trailers for movies &amp; TV shows tailored to your taste. Find your next binge.</p>
      <div class="clips-tut-shortcuts">
        <div class="clips-tut-sc-row"><kbd>↓ / S</kbd><span>Next clip</span></div>
        <div class="clips-tut-sc-row"><kbd>↑ / W</kbd><span>Previous clip</span></div>
        <div class="clips-tut-sc-row"><kbd>Space</kbd><span>Next clip</span></div>
        <div class="clips-tut-sc-row"><kbd>P</kbd><span>Watch now</span></div>
        <div class="clips-tut-sc-row"><kbd>I</kbd><span>More info</span></div>
        <div class="clips-tut-sc-row"><kbd>M</kbd><span>Mute / Unmute</span></div>
        <div class="clips-tut-sc-row"><kbd>L</kbd><span>Like</span></div>
        <div class="clips-tut-sc-row"><kbd>B</kbd><span>Bookmark</span></div>
        <div class="clips-tut-sc-row"><kbd>X</kbd><span>Not Interested</span></div>
      </div>
      <div class="clips-tut-scroll-hint">
        <span class="material-icons-round">expand_more</span>
        Scroll down to start
      </div>
    </div>`;

  feed.insertBefore(slide, feed.firstChild);
  feed.scrollTo({ top: 0, behavior: 'instant' });
}

/* ── CLIPS NAVIGATION — index-driven, deterministic ──────────────────
   The feed is overflow:hidden; ALL movement goes through _clipsGoTo(idx).
   Wheel, touch swipe, keyboard, and the on-screen arrows all funnel here.
   The active slide plays; its neighbors stay loaded-but-paused (preload);
   everything farther away is unloaded to save memory. */
let _clipsIdx = 0;

function _clipsSlides() {
  const feed = document.getElementById('clips-feed');
  return feed ? [...feed.querySelectorAll('.trailer-slide')] : [];
}

// Get the currently active clip slide (never the tutorial slide)
function _getActiveClipSlide() {
  const slides = _clipsSlides();
  if (!slides.length) return null;
  const slide = slides[Math.min(_clipsIdx, slides.length - 1)] || slides[0];
  if (slide.classList.contains('clips-tutorial-slide')) {
    return slides.find(s => !s.classList.contains('clips-tutorial-slide')) || null;
  }
  return slide;
}

function _clipsUpdateArrows(idx, count) {
  const nav = document.getElementById('clips-nav');
  if (!nav) return;
  nav.querySelector('.clips-nav-up')?.toggleAttribute('disabled', idx <= 0);
  nav.querySelector('.clips-nav-down')?.toggleAttribute('disabled', idx >= count - 1);
}

function _clipsGoTo(idx, { instant = false } = {}) {
  const feed = document.getElementById('clips-feed');
  if (!feed) return;
  const slides = _clipsSlides();
  if (!slides.length) return;
  idx = Math.max(0, Math.min(slides.length - 1, idx));
  _clipsIdx = idx;
  const target = slides[idx];

  feed.scrollTo({ top: target.offsetTop, behavior: instant ? 'instant' : 'smooth' });
  _clipsUpdateArrows(idx, slides.length);

  // Play the active slide; keep neighbors on standby; unload the rest
  slides.forEach((s, i) => {
    if (i === idx) return;
    if (Math.abs(i - idx) <= 1) _standbyClipSlide(s);
    else _unloadClipSlide(s);
  });
  if (!target.classList.contains('clips-tutorial-slide')) _playTrailerSlide(target);

  // Preload the next slide (muted + paused) so it starts instantly
  const next = slides[idx + 1];
  if (next && !next.classList.contains('clips-tutorial-slide')) _preloadTrailerSlide(next);

  // Infinite feed: top up when 2 slides from the end
  if (idx >= slides.length - 2 && !_trailersLoading) {
    _loadMoreTrailers().then(() => {
      _observeNewClipSlides(feed);
      _clipsUpdateArrows(_clipsIdx, _clipsSlides().length);
    });
  }
}

function _clipsNavSlide(dir) { _clipsGoTo(_clipsIdx + dir); }

// Inject the on-screen up/down arrows (idempotent — runs on every clips visit)
function _injectClipsNav() {
  const clipsPage = document.getElementById('page-clips');
  if (!clipsPage || document.getElementById('clips-nav')) return;
  const nav = document.createElement('div');
  nav.id = 'clips-nav';
  nav.innerHTML = `
    <button class="clips-nav-btn clips-nav-up" title="Previous (↑ / W)" aria-label="Previous clip" disabled>
      <span class="material-icons-round">keyboard_arrow_up</span>
    </button>
    <button class="clips-nav-btn clips-nav-down" title="Next (↓ / S)" aria-label="Next clip">
      <span class="material-icons-round">keyboard_arrow_down</span>
    </button>`;
  nav.querySelector('.clips-nav-up').addEventListener('click', () => _clipsNavSlide(-1));
  nav.querySelector('.clips-nav-down').addEventListener('click', () => _clipsNavSlide(1));
  clipsPage.appendChild(nav);
}

// Observe newly appended slides for dwell tracking
function _observeNewClipSlides(feed) {
  feed.querySelectorAll('.trailer-slide:not([data-observed])').forEach(sl => {
    sl.dataset.observed = '1';
    _trailersObserver?.observe(sl);
  });
}

// Pause all clips (called on page switch or tab hide)
function _pauseAllClips() {
  document.querySelectorAll('.trailer-slide-iframe').forEach(f => {
    if (f.src && f.src !== 'about:blank') {
      f.style.opacity = '0';
      f.removeAttribute('src');
    }
  });
  document.querySelectorAll('.trailer-slide-poster').forEach(p => { p.style.opacity = '1'; });
}

// Page visibility — pause clips when tab is hidden, resume when it returns
document.addEventListener('visibilitychange', () => {
  if (state.currentPage !== 'clips') return;
  if (document.hidden) _pauseAllClips();
  else _clipsGoTo(_clipsIdx, { instant: true });
});

async function initTrailersFeed() {
  const feed = document.getElementById('clips-feed');
  const spinner = document.getElementById('clips-spinner');
  if (!feed) return;

  // On return visit — re-trigger playback of visible slide without reloading
  if (_trailersLoaded && feed.querySelector('.trailer-slide')) {
    _injectClipsNav();
    requestAnimationFrame(() => _clipsGoTo(_clipsIdx, { instant: true }));
    _maybeShowClipsTutorial(feed);
    return;
  }

  _trailersLoaded = true;
  _trailersPage = 1;
  _trailersItems = [];
  _clipsIdx = 0;

  if (_trailersObserver) { _trailersObserver.disconnect(); _trailersObserver = null; }
  feed.querySelectorAll('.trailer-slide').forEach(el => el.remove());

  if (spinner) spinner.style.display = '';
  try {
    await _loadMoreTrailers();
  } finally {
    if (spinner) spinner.style.display = 'none';
  }

  // Empty state — never leave a black screen with no explanation
  if (!feed.querySelector('.trailer-slide')) {
    console.error('[SV Clips] Feed loaded 0 slides');
    feed.innerHTML = `
      <div class="trailers-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8rem;color:var(--muted)">
        <span class="material-icons-round" style="font-size:3rem">movie_filter</span>
        <p>Couldn't load clips right now.</p>
        <button class="trailer-cta trailer-cta-watch" id="clips-retry-btn"><span class="material-icons-round">refresh</span> Retry</button>
      </div>`;
    document.getElementById('clips-retry-btn')?.addEventListener('click', () => {
      _trailersLoaded = false;
      initTrailersFeed();
    });
    return;
  }

  // Dwell time tracking (recommendation signal only — play/pause is handled
  // deterministically by _clipsGoTo, not by this observer)
  const _dwellStart = new Map();

  _trailersObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const slide = entry.target;
      if (slide.classList.contains('clips-tutorial-slide')) return;
      const id = +slide.dataset.id;
      const genreIds = (slide.dataset.genres || '').split(',').filter(Boolean).map(Number);

      if (entry.isIntersecting) {
        _dwellStart.set(id, Date.now());
      } else {
        const start = _dwellStart.get(id);
        if (start) {
          const dwell = (Date.now() - start) / 1000;
          _dwellStart.delete(id);
          // Learn: >8s = positive signal, <1.5s = negative signal
          const delta = dwell > 8 ? 1 : dwell < 1.5 ? -1 : 0;
          if (delta !== 0) {
            genreIds.forEach(g => {
              _clipsDwellPrefs.set(g, Math.max(-5, Math.min(5, (_clipsDwellPrefs.get(g) || 0) + delta)));
            });
            _saveClipsDwellPrefs();
          }
        }
      }
    });
  }, { threshold: 0.55 });

  _observeNewClipSlides(feed);

  // Show tutorial first (may prepend a tutorial slide)
  _maybeShowClipsTutorial(feed);

  _injectClipsNav();

  // Activate the starting slide (tutorial if present, else first clip)
  _clipsGoTo(0, { instant: true });

  // ── Input wiring: everything funnels into _clipsGoTo ─────────────
  if (!feed.dataset.navWired) {
    feed.dataset.navWired = '1';

    // Mouse wheel / trackpad — debounced so one gesture = one slide
    let _wheelDebounce = 0;
    feed.addEventListener('wheel', e => {
      e.preventDefault();
      const now = Date.now();
      if (now - _wheelDebounce < 450) return;
      if (Math.abs(e.deltaY) < 5) return;
      _wheelDebounce = now;
      _clipsNavSlide(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // Touch swipe — vertical swipe of 40px+ navigates
    let _touchStartY = 0, _touchStartX = 0;
    feed.addEventListener('touchstart', e => {
      _touchStartY = e.touches[0].clientY;
      _touchStartX = e.touches[0].clientX;
    }, { passive: true });
    feed.addEventListener('touchend', e => {
      const dy = _touchStartY - e.changedTouches[0].clientY;
      const dx = _touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) _clipsNavSlide(dy > 0 ? 1 : -1);
    }, { passive: true });
    // Prevent rubber-band scrolling of the page behind the feed
    feed.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    // Keep the active slide aligned on resize / rotation
    window.addEventListener('resize', () => {
      if (state.currentPage === 'clips') _clipsGoTo(_clipsIdx, { instant: true });
    });
  }
}

async function _loadMoreTrailers() {
  if (_trailersLoading) return;
  _trailersLoading = true;
  const feed = document.getElementById('clips-feed');
  const spinner = document.getElementById('clips-spinner');
  if (spinner) spinner.style.display = '';
  try {
    // On page 1: always use trending for fresh content
    // On later pages: mix trending with genre-targeted picks from dwell prefs
    let movies = [], shows = [];
    if (_trailersPage <= 2) {
      const [r1, r2] = await Promise.allSettled([
        tmdb('/trending/movie/week', { page: _trailersPage }),
        tmdb('/trending/tv/week',    { page: _trailersPage }),
      ]);
      movies = (r1.status === 'fulfilled' ? r1.value.results || [] : []).map(m => ({ ...m, _type: 'movie' }));
      shows  = (r2.status === 'fulfilled' ? r2.value.results || [] : []).map(m => ({ ...m, _type: 'tv' }));
    } else {
      // After page 2: blend trending + genre-targeted based on dwell prefs + user preferences
      const topDwellGenres = [..._clipsDwellPrefs.entries()]
        .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
      const prefGenres = (state.prefGenres || []).slice(0, 2).map(Number);
      const genreIds = [...new Set([...topDwellGenres, ...prefGenres])].slice(0, 2);

      const baseRequests = [
        tmdb('/trending/movie/week', { page: _trailersPage }),
        tmdb('/trending/tv/week',    { page: _trailersPage }),
      ];
      const genreRequests = genreIds.length ? [
        tmdb('/discover/movie', { with_genres: genreIds[0], sort_by: 'vote_average.desc', 'vote_count.gte': 200, page: Math.ceil(Math.random() * 3) }),
        genreIds[1] ? tmdb('/discover/tv', { with_genres: genreIds[1], sort_by: 'popularity.desc', page: Math.ceil(Math.random() * 3) }) : Promise.resolve(null),
      ] : [];

      const allResults = await Promise.allSettled([...baseRequests, ...genreRequests]);
      movies = (allResults[0].status === 'fulfilled' ? allResults[0].value?.results || [] : []).map(m => ({ ...m, _type: 'movie' }));
      shows  = (allResults[1].status === 'fulfilled' ? allResults[1].value?.results || [] : []).map(m => ({ ...m, _type: 'tv' }));
      if (allResults[2]?.status === 'fulfilled' && allResults[2].value?.results) {
        movies.push(...allResults[2].value.results.map(m => ({ ...m, _type: 'movie' })));
      }
      if (allResults[3]?.status === 'fulfilled' && allResults[3].value?.results) {
        shows.push(...allResults[3].value.results.map(m => ({ ...m, _type: 'tv' })));
      }
    }

    // Merge, deduplicate, filter excluded, then sort by personalization score
    const existIds = new Set(_trailersItems.map(i => `${i._type}-${i.id}`));
    const watchlistIds = new Set((state.watchlist || []).map(w => w.id));
    const recentIds = new Set((state.recentlyViewed || []).map(r => r.id));

    const dislikedIds = new Set((state.disliked || []).map(x => x.id));
    const combined = [...movies, ...shows].filter(i => {
      if (existIds.has(`${i._type}-${i.id}`)) return false;
      // Never show disliked content in clips
      if (dislikedIds.has(i.id)) return false;
      // Suppress recently-viewed on low repeat tolerance (but watchlisted items always show)
      if (recentIds.has(i.id) && !watchlistIds.has(i.id) && (state._repeatTolerance === 'minimum' || !state._repeatTolerance)) return false;
      return true;
    });

    // Sort by personalization score (higher first)
    combined.sort((a, b) => _scoreClipItem(b) - _scoreClipItem(a));

    _trailersItems.push(...combined);
    _trailersPage++;

    if (feed) {
      combined.forEach(item => {
        const slide = _buildTrailerSlide(item);
        feed.appendChild(slide);
      });
    }
  } finally {
    _trailersLoading = false;
    if (spinner) spinner.style.display = 'none';
  }
}

function _buildTrailerSlide(item) {
  const id = item.id;
  const type = item._type || 'movie';
  const title = item.title || item.name || '';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
  const backdropPath = item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '';
  const typeLabel = type === 'tv' ? 'TV Show' : 'Movie';
  const genreIds = (item.genre_ids || []).join(',');

  const slide = document.createElement('div');
  slide.className = 'trailer-slide';
  slide.dataset.id = id;
  slide.dataset.type = type;
  slide.dataset.title = title;
  slide.dataset.year = year;
  slide.dataset.genres = genreIds;

  slide.innerHTML = `
    ${backdropPath ? `<img class="trailer-slide-poster" src="${backdropPath}" alt="${esc(title)}" loading="lazy" onerror="this.onerror=null;this.style.display='none'">` : ''}
    <iframe class="trailer-slide-iframe" allow="autoplay; fullscreen; encrypted-media" allowfullscreen title="${esc(title)} clip" style="opacity:0;transition:opacity .4s"></iframe>
    <span class="material-icons-round trailer-slide-pause-ind"></span>
    <div class="trailer-slide-gradient"></div>
    <div class="trailer-slide-content">
      <div class="trailer-slide-left">
        <div class="trailer-type-pill ${type}">${typeLabel}</div>
        <img class="trailer-slide-logo" alt="${esc(title)} logo" style="display:none">
        <h2 class="trailer-slide-title">${esc(title)}</h2>
        <div class="trailer-slide-meta">${[year, rating ? '★ ' + rating : ''].filter(Boolean).join(' · ')}</div>
        <div class="trailer-slide-btn-row">
          <button class="trailer-cta trailer-cta-watch" data-action="watch">
            <span class="material-icons-round">play_arrow</span> Watch
          </button>
          <button class="trailer-cta trailer-cta-info" data-action="info">
            <span class="material-icons-round">info_outline</span> More Info
          </button>
        </div>
      </div>
      <div class="trailer-slide-right">
        <button class="trailer-icon-btn" data-action="mute" title="Toggle mute (M)" aria-label="Toggle mute">
          <span class="material-icons-round">${_trailersMuted ? 'volume_off' : 'volume_up'}</span>
        </button>
        <button class="trailer-icon-btn${isLiked(id) ? ' on' : ''}" data-action="like" title="Like (L)" aria-label="Like">
          <span class="material-icons-round">${isLiked(id) ? 'thumb_up' : 'thumb_up_off_alt'}</span>
        </button>
        <button class="trailer-icon-btn${isInWatchlist(id) ? ' on' : ''}" data-action="wl" title="Watchlist (B)" aria-label="Add to watchlist">
          <span class="material-icons-round">${isInWatchlist(id) ? 'bookmark' : 'bookmark_border'}</span>
        </button>
        <button class="trailer-icon-btn trailer-icon-dislike" data-action="dislike" title="Not Interested (X)" aria-label="Not interested">
          <span class="material-icons-round">thumb_down_off_alt</span>
        </button>
      </div>
    </div>`;

  slide.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      // Tap on video area — toggle pause/play via YouTube postMessage
      e.stopPropagation();
      const iframe = slide.querySelector('.trailer-slide-iframe');
      if (iframe?.src?.includes('youtube.com/embed')) {
        const nowPaused = slide.dataset.clipsPaused !== '1';
        const cmd = nowPaused ? 'pauseVideo' : 'playVideo';
        iframe.contentWindow?.postMessage(`{"event":"command","func":"${cmd}","args":""}`, '*');
        slide.dataset.clipsPaused = nowPaused ? '1' : '0';
        const ind = slide.querySelector('.trailer-slide-pause-ind');
        if (ind) {
          ind.textContent = nowPaused ? 'pause' : 'play_arrow';
          ind.classList.add('show');
          clearTimeout(ind._hideT);
          ind._hideT = setTimeout(() => ind.classList.remove('show'), 700);
        }
      }
      return;
    }
    const action = btn.dataset.action;
    if (action === 'watch') {
      _standbyClipSlide(slide); // pause trailer so audio doesn't bleed under the player
      slide.dataset.clipsPaused = '1';
      openMedia(id, type, { title, year, rating, poster: '', backdrop: item.backdrop_path || '' });
    } else if (action === 'info') {
      _standbyClipSlide(slide);
      slide.dataset.clipsPaused = '1';
      openInfoPage(id, type, { title, year, rating, poster: '', backdrop: item.backdrop_path || '' });
    } else if (action === 'mute') {
      _trailersMuted = !_trailersMuted;
      document.querySelectorAll('.trailer-slide [data-action="mute"] .material-icons-round').forEach(ic => {
        ic.textContent = _trailersMuted ? 'volume_off' : 'volume_up';
      });
      // postMessage mute/unMute — no src rewrite, so the video never reloads.
      // Only the ACTIVE slide gets unmuted; others stay muted (no audio bleed).
      const activeSlide = _getActiveClipSlide();
      document.querySelectorAll('.trailer-slide-iframe').forEach(f => {
        if (!f.src?.includes('youtube.com/embed')) return;
        const unmute = !_trailersMuted && f.closest('.trailer-slide') === activeSlide;
        _ytCmd(f, unmute ? 'unMute' : 'mute');
      });
    } else if (action === 'like') {
      const likeItem = { id, type, title, year, rating, poster: '', backdrop: item.backdrop_path || '' };
      toggleLike(likeItem);
      const icon = btn.querySelector('.material-icons-round');
      if (icon) icon.textContent = isLiked(id) ? 'thumb_up' : 'thumb_up_off_alt';
      btn.classList.toggle('on', isLiked(id));
    } else if (action === 'wl') {
      const wlItem = { id, type, title, year, rating, poster: '', backdrop: item.backdrop_path || '' };
      toggleWatchlist(wlItem);
      const icon = btn.querySelector('.material-icons-round');
      if (icon) icon.textContent = isInWatchlist(id) ? 'bookmark' : 'bookmark_border';
      btn.classList.toggle('on', isInWatchlist(id));
    } else if (action === 'dislike') {
      // Down-weight genres and remove slide
      const genreIds = (slide.dataset.genres || '').split(',').filter(Boolean).map(Number);
      genreIds.forEach(g => {
        _clipsDwellPrefs.set(g, Math.max(-5, (_clipsDwellPrefs.get(g) || 0) - 2));
      });
      _saveClipsDwellPrefs();
      _unloadClipSlide(slide);
      slide.style.transition = 'opacity .28s, transform .28s';
      slide.style.opacity = '0';
      slide.style.transform = 'translateX(-50px)';
      setTimeout(() => {
        slide.remove();
        // Slide indexes shifted — re-align and activate the slide now at this position
        _clipsGoTo(_clipsIdx, { instant: true });
      }, 320);
      toast('Showing less like this', 'thumb_down');
    }
  });

  return slide;
}

// Fetch English title logo for a clip slide (direct fetch, no language filter override)
const _clipsLogoCache = new Map();
async function _fetchClipsLogo(id, type) {
  const k = `${type}-${id}`;
  if (_clipsLogoCache.has(k)) return _clipsLogoCache.get(k);
  try {
    const endpoint = type === 'tv' ? `tv/${id}` : `movie/${id}`;
    // Direct fetch — avoid tmdb() which adds language=en-US that can override include_image_language
    const u = new URL(`${TMDB_BASE}/${endpoint}/images`);
    u.searchParams.set('include_image_language', 'en,null');
    const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${TMDB_RAT}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const logos = (data.logos || []).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    const logo = logos.find(l => l.iso_639_1 === 'en' && l.file_path) ||
                 logos.find(l => !l.iso_639_1 && l.file_path);
    const url = logo ? `https://image.tmdb.org/t/p/w300${logo.file_path}` : null;
    _clipsLogoCache.set(k, url);
    return url;
  } catch (err) {
    if (err?.message && !err.message.includes('no logo')) console.warn(`[SV ClipsLogo] ${k}:`, err.message);
    _clipsLogoCache.set(k, null);
    return null;
  }
}

async function _playTrailerSlide(slide) {
  const id = +slide.dataset.id;
  const type = slide.dataset.type;
  const title = slide.dataset.title || '';
  const year = slide.dataset.year || '';
  const iframe = slide.querySelector('.trailer-slide-iframe');
  if (!iframe) return;
  // Reset paused state when slide becomes active
  slide.dataset.clipsPaused = '0';

  // Fetch English logo in parallel (non-blocking)
  const logoEl = slide.querySelector('.trailer-slide-logo');
  if (logoEl && !logoEl.dataset.tried) {
    logoEl.dataset.tried = '1';
    _fetchClipsLogo(id, type).then(url => {
      if (url && logoEl.isConnected) {
        const _hideTitleEl = () => {
          const titleEl = slide.querySelector('.trailer-slide-title');
          if (titleEl) titleEl.style.display = 'none';
        };
        logoEl.addEventListener('load', _hideTitleEl, { once: true });
        logoEl.addEventListener('error', () => { logoEl.style.display = 'none'; }, { once: true });
        logoEl.src = url;
        logoEl.style.display = '';
        if (logoEl.complete && logoEl.naturalWidth > 0) _hideTitleEl();
      }
    });
  }

  // Already loaded (e.g. preloaded muted+paused) — resume instantly, no reload
  if (iframe.src && iframe.src.includes('youtube.com/embed')) {
    const sendPlay = () => {
      _ytCmd(iframe, 'playVideo');
      _ytCmd(iframe, _trailersMuted ? 'mute' : 'unMute');
    };
    sendPlay();
    // Re-send once — postMessage is dropped if the player wasn't ready yet
    setTimeout(() => {
      if (slide.isConnected && _clipsSlides()[_clipsIdx] === slide && slide.dataset.clipsPaused !== '1') sendPlay();
    }, 450);
    _showClipIframe(slide, iframe);
    return;
  }

  const key = await fetchTrailerKey(id, type, title, year);
  if (!key || key === '__none__') {
    console.warn(`[SV Clips] No trailer for "${title}" (${type}/${id})`);
    // Remove the dead slide if it's below the current one (safe — no index shift)
    const slides = _clipsSlides();
    if (slides.indexOf(slide) > _clipsIdx) slide.remove();
    return;
  }
  if (!slide.isConnected) return;

  iframe.src = _clipsEmbedUrl(key, 1, _trailersMuted ? 1 : 0);
  iframe.addEventListener('load', () => _showClipIframe(slide, iframe), { once: true });
}

function _ytCmd(iframe, func) {
  iframe.contentWindow?.postMessage(`{"event":"command","func":"${func}","args":""}`, '*');
}

function _clipsEmbedUrl(key, autoplay, mute) {
  return `https://www.youtube.com/embed/${key}?autoplay=${autoplay}&mute=${mute}&controls=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&loop=1&playlist=${key}&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
}

function _showClipIframe(slide, iframe) {
  iframe.style.opacity = '1';
  const poster = slide.querySelector('.trailer-slide-poster');
  if (poster) poster.style.opacity = '0';
}

// Load the slide's trailer muted + paused so it starts instantly when active
function _preloadTrailerSlide(slide) {
  const iframe = slide.querySelector('.trailer-slide-iframe');
  if (!iframe || (iframe.src && iframe.src.includes('youtube.com/embed'))) return;
  const id = +slide.dataset.id;
  const type = slide.dataset.type;
  fetchTrailerKey(id, type, slide.dataset.title || '', slide.dataset.year || '').then(key => {
    if (!key || key === '__none__' || !slide.isConnected) return;
    // Guard: slide may have become active while the key was being fetched
    if (iframe.src && iframe.src.includes('youtube.com/embed')) return;
    if (_clipsSlides()[_clipsIdx] === slide) { _playTrailerSlide(slide); return; }
    iframe.src = _clipsEmbedUrl(key, 0, 1);
    // Keep the poster visible — the iframe fades in only when the slide activates
  });
}

// Neighbor slide: keep loaded but paused + muted (instant resume, no audio bleed)
function _standbyClipSlide(slide) {
  const iframe = slide.querySelector('.trailer-slide-iframe');
  if (iframe?.src?.includes('youtube.com/embed')) {
    _ytCmd(iframe, 'pauseVideo');
    _ytCmd(iframe, 'mute');
    iframe.style.opacity = '0';
    const poster = slide.querySelector('.trailer-slide-poster');
    if (poster) poster.style.opacity = '1';
  }
}

// Far-away slide: fully unload the iframe to free memory
function _unloadClipSlide(slide) {
  const iframe = slide.querySelector('.trailer-slide-iframe');
  if (iframe && iframe.src) {
    iframe.style.opacity = '0';
    iframe.removeAttribute('src');
    const poster = slide.querySelector('.trailer-slide-poster');
    if (poster) poster.style.opacity = '1';
  }
}

// Back-compat alias (used by dislike handler / dwell observer)
function _pauseTrailerSlide(slide) { _unloadClipSlide(slide); }

async function fetchTrailerKey(id, type, title = '', year = '') {
  let key = _hoverTrailerCache.get(id);
  if (key !== undefined) return key;
  try {
    const endpoint = type === 'anime' ? `tv/${id}` : `${type}/${id}`;
    const data = await tmdb(`/${endpoint}/videos`);
    const vids = data.results || [];
    // Use YouTube built-in trailers
    const yt = vids.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
               vids.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
               vids.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
               vids.find(v => v.site === 'YouTube');
    if (yt) {
      key = yt.key;
    } else {
      key = '__none__';
    }
  } catch {
    key = '__none__';
  }
  _hoverTrailerCache.set(id, key);
  if (_hoverTrailerCache.size > 200) {
    const firstKeys = [..._hoverTrailerCache.keys()].slice(0, 100);
    firstKeys.forEach(k => _hoverTrailerCache.delete(k));
  }
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
    if (_genreCache.size > 200) {
      const keys = [..._genreCache.keys()].slice(0, 100);
      keys.forEach(k => _genreCache.delete(k));
    }
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
  // Track last hovered row for arrow key navigation
  let _lastHoveredRow = null;
  document.addEventListener('mouseover', e => {
    const row = e.target.closest('.card-row');
    if (row) _lastHoveredRow = row;
  }, { passive: true });

  // Intercept Ctrl+F / Cmd+F to open app search instead of browser find
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault(); // stop browser find
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 100);
      return;
    }
  });

  // Get disabled shortcuts from profile settings
  function _isShortcutEnabled(key) {
    const disabled = state.disabledShortcuts || {};
    return !disabled[key.toLowerCase()];
  }

  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select')) return;

    // Escape closes the topmost open overlay — always enabled
    if (e.key === 'Escape') {
      if (document.getElementById('info-overlay')?.classList.contains('open')) { closeInfoPage(); return; }
      if (document.getElementById('person-overlay')?.classList.contains('open')) { closePersonPage(); return; }
      if (document.getElementById('company-overlay')?.classList.contains('open')) {
        document.getElementById('company-close')?.click(); return;
      }
      if (document.getElementById('shortcuts-overlay')?.classList.contains('open')) {
        document.getElementById('shortcuts-close')?.click(); return;
      }
      closeModal();
      return;
    }

    // / opens search
    if (e.key === '/' && _isShortcutEnabled('/')) {
      e.preventDefault();
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 150);
      return;
    }

    // ? opens shortcuts
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }

    // I toggles info/player — works even when modal is open
    if (e.key === 'i' || e.key === 'I') {
      if (document.getElementById('info-overlay')?.classList.contains('open')) {
        const media = state.currentInfoMedia;
        closeInfoPage();
        if (media) openMedia(media.id, media.type, { _forcePlayer: true });
        return;
      }
      if (document.getElementById('modal-overlay')?.classList.contains('open') && state.currentMedia) {
        const { id, type } = state.currentMedia;
        closeModal();
        setTimeout(() => openInfoPage(id, type), 50);
        return;
      }
    }

    // N works when modal is open
    if ((e.key === 'n' || e.key === 'N') && state.currentMedia) {
      const { useId, id, type } = state.currentMedia;
      const sel = document.getElementById('season-sel');
      const s = sel ? +sel.value : 1;
      const ep = document.querySelector('.ep-card.on');
      const next = nextProvider(useId || id, type, s, ep ? +ep.dataset.ep : 1);
      toast(`Switched to ${next.label}`, 'swap_horiz');
      return;
    }

    // Block non-modal shortcuts when modal/info overlay is open
    const anyOverlayOpen =
      document.getElementById('modal-overlay')?.classList.contains('open') ||
      document.getElementById('info-overlay')?.classList.contains('open');
    if (anyOverlayOpen) return;

    // ── Clips page keyboard shortcuts (override global nav keys) ─────
    if (state.currentPage === 'clips') {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === ' ') {
        e.preventDefault(); _clipsNavSlide(1); return;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); _clipsNavSlide(-1); return;
      }
      if (e.key === 'p' || e.key === 'P') {
        _getActiveClipSlide()?.querySelector('[data-action="watch"]')?.click(); return;
      }
      if (e.key === 'i' || e.key === 'I') {
        _getActiveClipSlide()?.querySelector('[data-action="info"]')?.click(); return;
      }
      if (e.key === 'm' || e.key === 'M') {
        _getActiveClipSlide()?.querySelector('[data-action="mute"]')?.click(); return;
      }
      if (e.key === 'l' || e.key === 'L') {
        _getActiveClipSlide()?.querySelector('[data-action="like"]')?.click(); return;
      }
      if (e.key === 'b' || e.key === 'B') {
        _getActiveClipSlide()?.querySelector('[data-action="wl"]')?.click(); return;
      }
      if (e.key === 'x' || e.key === 'X') {
        _getActiveClipSlide()?.querySelector('[data-action="dislike"]')?.click(); return;
      }
    }

    // Number keys 1-7 navigate pages; 0 = cycle theme
    const pageKeys = { '1': 'home', '2': 'movies', '3': 'tv', '4': 'anime', '5': 'library', '6': 'prefs' };
    if (pageKeys[e.key]) { goPage(pageKeys[e.key]); return; }
    if (e.key === '7') { goPage('search'); setTimeout(() => document.getElementById('search-input')?.focus(), 100); return; }
    if (e.key === '0') { cycleTheme(); return; }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (_lastHoveredRow) {
        // Scroll the hovered row
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        _lastHoveredRow.scrollBy({ left: dir * (_lastHoveredRow.clientWidth * 0.7), behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        jumpHero((state.heroIdx - 1 + state.heroItems.length) % state.heroItems.length);
      } else {
        jumpHero((state.heroIdx + 1) % state.heroItems.length);
      }
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      jumpHero((state.heroIdx - 1 + state.heroItems.length) % state.heroItems.length);
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      jumpHero((state.heroIdx + 1) % state.heroItems.length);
    } else if (e.key === 't' || e.key === 'T') {
      cycleTheme();
    } else if (e.key === 'h' || e.key === 'H') {
      goPage('home');
    } else if (e.key === 'm' || e.key === 'M') {
      goPage('movies');
    } else if (e.key === 'v' || e.key === 'V') {
      goPage('tv');
    } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
      goPage('prefs'); // bare C = Customize Feed; Ctrl+C = normal copy
    } else if (e.key === 'l' || e.key === 'L') {
      goPage('library');
    } else if (e.key === 's' || e.key === 'S') {
      window.scrollBy({ top: window.innerHeight * 0.6, behavior: 'smooth' });
    } else if (e.key === 'w' || e.key === 'W') {
      window.scrollBy({ top: -window.innerHeight * 0.6, behavior: 'smooth' });
    } else if (e.key === 'f' || e.key === 'F') {
      goPage('search');
      setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    } else if (e.key === 'r' || e.key === 'R') {
      const page = state.currentPage;
      if (page === 'home') {
        animatedRefreshFeed();
      } else if (['movies', 'tv', 'anime'].includes(page)) {
        state._randomPage = Math.floor(Math.random() * 6) + 2;
        const loaderFn = PAGE_LOADERS[page];
        if (loaderFn) {
          document.querySelectorAll(`#page-${page} .card-row`).forEach(r => { r.innerHTML = skelCards(6); });
          setTimeout(() => loaderFn(), 50);
        }
        toast('Refreshing…', 'refresh');
      }
    }
  });

  // YouTube postMessage watch-time tracking — reward completed watches
  window.addEventListener('message', e => {
    if (e.origin !== 'https://www.youtube.com') return;
    try {
      const d = JSON.parse(e.data);
      // playerState 0 = ended — user watched it (or most of it)
      if (d.event === 'infoDelivery' && d.info?.playerState === 0 && state.currentMedia) {
        const { id } = state.currentMedia;
        if (id) {
          // Reward watching: reduce impression count so content can surface again
          const imp = state.impressions[id];
          if (imp && typeof imp === 'object') {
            state.impressions[id] = { ...imp, count: Math.max(0, imp.count - 10) };
          } else if (typeof state.impressions[id] === 'number') {
            state.impressions[id] = Math.max(0, (state.impressions[id] || 0) - 10);
          }
          persist('impressions');
        }
      }
    } catch {}
  });

  // VidSrc.ru postMessage watch-progress tracking (MEDIA_DATA events)
  window.addEventListener('message', e => {
    if (!e.origin.includes('vidsrc.ru')) return;
    try {
      const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (d?.type !== 'MEDIA_DATA' || !d.payload) return;
      const { mediaType, tmdbId, currentTime, duration, season, episode } = d.payload;
      if (!tmdbId || !currentTime || !duration) return;

      // Don't save if less than 5% or more than 95% watched (too early or already finished)
      const pct = currentTime / duration;
      if (pct < 0.05 || pct > 0.95) return;

      const type = mediaType === 'tv' ? 'tv' : 'movie';
      const key = String(tmdbId);

      // Get existing continue-watching entry or build a stub from currentMedia
      const existing = state.continueWatching[key] || state.continueWatching[tmdbId] || {};
      const cm = state.currentMedia || {};

      const entry = {
        ...existing,
        id:        tmdbId,
        type,
        title:     existing.title || cm.title || cm.name || '',
        poster_path: existing.poster_path || cm.poster_path || null,
        progress:  Math.round((currentTime / duration) * 100),
        currentTime: Math.round(currentTime),
        duration:  Math.round(duration),
        updatedAt: Date.now(),
      };
      if (type === 'tv' && season)  entry.season  = season;
      if (type === 'tv' && episode) entry.episode = episode;

      state.continueWatching[key] = entry;
      persist('continueWatching');
    } catch {}
  });
}
