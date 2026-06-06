import { state, persist } from './state.js';

/* ── PROVIDERS ───────────────────────────────────────────────────── */
// Ordered by: reliability > quality > coverage
// prio: high = default / most reliable, med = good backup, low = last resort
// 4K: VidLink, Cineby have 4K for select titles
export const PROVIDERS = [
  {
    // #1 — VidSrc CC (vidsrc.to replacement, widest library, reliable HD)
    id: 'vidsrc',
    label: 'VidSrc',
    prio: 'high',
    note: 'HD · Wide library',
    domain: 'https://vidsrc.cc',
    types: ['movie', 'tv', 'anime'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.cc/v2/embed/movie/${id}`
      : `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #2 — Embed.su: very reliable, clean UI, no ads
    id: 'embedsu',
    label: 'Embed.su',
    prio: 'high',
    note: 'Clean · Fast',
    domain: 'https://embed.su',
    types: ['movie', 'tv', 'anime'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://embed.su/embed/movie/${id}`
      : `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #3 — 4K on some titles, anime support, good reliability
    id: 'vidlink',
    label: 'VidLink',
    prio: 'high',
    note: '4K · Anime',
    domain: 'https://vidlink.pro',
    types: ['movie', 'tv', 'anime'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidlink.pro/movie/${id}?primaryColor=e50914`
      : `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e50914`,
  },
  {
    // #4 — Cineby: 4K available on select titles
    id: 'cineby',
    label: 'Cineby',
    prio: 'high',
    note: '4K available',
    domain: 'https://www.cineby.app',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://www.cineby.app/movie/${id}`
      : `https://www.cineby.app/tv/${id}/${s}/${e}`,
  },
  {
    // #5 — VidSrc Me: alternate vidsrc backend
    id: 'vidsrcme',
    label: 'VidSrc.me',
    prio: 'med',
    note: 'Alt backend',
    domain: 'https://vidsrc.me',
    types: ['movie', 'tv', 'anime'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.me/embed/movie?tmdb=${id}`
      : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    // #6 — Good for movies, multi-source fallback internally
    id: 'superembed',
    label: 'MultiEmbed',
    prio: 'med',
    note: 'Multi-source',
    domain: 'https://multiembed.mov',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
      : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    // #7 — VidSrc Pro: separate library
    id: 'vidsrcpro',
    label: 'VidSrc Pro',
    prio: 'med',
    note: 'Pro library',
    domain: 'https://vidsrc.pro',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.pro/embed/movie/${id}`
      : `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #8 — 2Embed: good coverage
    id: 'embed2',
    label: '2Embed',
    prio: 'med',
    note: 'Wide coverage',
    domain: 'https://www.2embed.cc',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://www.2embed.cc/embed/${id}`
      : `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    // #9 — AutoEmbed: good for recent content
    id: 'autoembed',
    label: 'AutoEmbed',
    prio: 'med',
    note: 'Recent content',
    domain: 'https://player.autoembed.cc',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.autoembed.cc/embed/movie/${id}`
      : `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #10 — Smashy Stream: solid fallback
    id: 'smashy',
    label: 'SmashyStream',
    prio: 'low',
    note: 'Fallback',
    domain: 'https://player.smashy.stream',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.smashy.stream/movie/${id}`
      : `https://player.smashy.stream/tv/${id}?s=${s}&e=${e}`,
  },
  {
    // #11 — Videasy: last resort fallback
    id: 'videasy',
    label: 'Videasy',
    prio: 'low',
    note: 'Last resort',
    domain: 'https://player.videasy.net',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.videasy.net/movie/${id}`
      : `https://player.videasy.net/tv/${id}/${s}/${e}`,
  },
];

// Detect Firefox — vidsrc.cc blocks iframe embedding in Firefox (X-Frame-Options)
const _isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

// IDs of providers known to block Firefox iframes
const FIREFOX_BLOCKED_PROVIDERS = new Set(['vidsrc']);

export function providersFor(type, opts = {}) {
  let list = PROVIDERS.filter(p => p.types.includes(type === 'anime' ? 'tv' : type));
  // Firefox: skip providers known to block iframe embedding
  if (_isFirefox) list = list.filter(p => !FIREFOX_BLOCKED_PROVIDERS.has(p.id));
  // Respect user-disabled providers
  const disabled = JSON.parse(localStorage.getItem('sv_provider_disabled') || '[]');
  return list.filter(p => !disabled.includes(p.id));
}

/* ── ACTIVE PROVIDER ─────────────────────────────────────────────── */
let _activeProvider = null;

export function getActiveProvider() {
  if (_activeProvider) return _activeProvider;
  const saved = state.lastProvider;
  const preferred = PROVIDERS.find(p => p.id === saved);
  // Firefox: if saved provider is blocked, fall back to first compatible one
  if (preferred && !(_isFirefox && FIREFOX_BLOCKED_PROVIDERS.has(preferred.id))) {
    _activeProvider = preferred;
  } else {
    _activeProvider = PROVIDERS.find(p => !(_isFirefox && FIREFOX_BLOCKED_PROVIDERS.has(p.id))) || PROVIDERS[0];
  }
  return _activeProvider;
}

export function setActiveProvider(id) {
  _activeProvider = PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
  state.lastProvider = _activeProvider.id;
  persist('lastProvider');
  return _activeProvider;
}

/* ── PROVIDER BAR ────────────────────────────────────────────────── */
export function buildProviderBar(mediaId, type, season, episode) {
  const bar = document.getElementById('provider-bar');
  if (!bar) return;
  const list = providersFor(type);
  const active = getActiveProvider();

  bar.innerHTML =
    `<span class="prov-label">Source</span>` +
    `<button class="prov-btn prov-next" id="prov-next-btn" title="Try next source">
       <span class="material-icons-round" style="font-size:.9rem">skip_next</span> Next
     </button>` +
    list.map(p =>
      `<button class="prov-btn${active.id === p.id ? ' on' : ''}${p.prio === 'high' ? ' prio-high' : p.prio === 'low' ? ' prio-low' : ''}"
        data-provider="${p.id}"
        title="${p.label}${p.note ? ' · ' + p.note : ''}">${p.label}${p.note && p.note.includes('4K') ? `<span class="prov-note">4K</span>` : ''}</button>`
    ).join('');

  // delegate in player.js via data-provider attr — handled in app.js
}

/* ── PLAYER LOAD ─────────────────────────────────────────────────── */
let _providerTimer = null;

export function loadPlayer(mediaId, type, season = 1, episode = 1) {
  const loading = document.getElementById('player-loading');
  const iframe = document.getElementById('player-frame');
  if (!loading || !iframe) return;

  clearTimeout(_providerTimer);
  loading.classList.remove('hidden');
  loading.innerHTML = `<div class="spin"></div><p>Loading player…</p>`;

  const provider = getActiveProvider();
  const src = provider.url(mediaId, type === 'anime' ? 'tv' : type, season, episode);

  iframe.removeAttribute('src');

  iframe.onload = null;
  iframe.onload = () => {
    clearTimeout(_providerTimer);
    loading.classList.add('hidden');
  };

  iframe.onerror = () => showProviderError();

  _providerTimer = setTimeout(() => {
    showProviderError();
    document.dispatchEvent(new CustomEvent('sv:provider-timeout'));
  }, 10000);
  setTimeout(() => { iframe.src = src; }, 80);
}

export function showProviderError() {
  const loading = document.getElementById('player-loading');
  if (!loading || loading.classList.contains('hidden')) return;
  clearTimeout(_providerTimer);
  loading.classList.remove('hidden');
  loading.innerHTML = `
    <div class="spin" style="border-top-color:var(--red)"></div>
    <p class="player-err-msg">This source timed out or was blocked.</p>
    <p class="player-err-sub">Certificate and privacy errors come from the external embed host, not this page.</p>
    <button class="btn-next-source" id="player-next-btn">
      <span class="material-icons-round">skip_next</span> Try Next Source
    </button>`;
}

export function cancelProviderTimer() { clearTimeout(_providerTimer); _providerTimer = null; }

export function nextProvider(mediaId, type, season, episode) {
  const list = providersFor(type);
  const cur = getActiveProvider();
  const idx = list.findIndex(p => p.id === cur.id);
  const next = list[(idx + 1) % list.length];
  setActiveProvider(next.id);
  buildProviderBar(mediaId, type, season, episode);
  loadPlayer(mediaId, type, season, episode);
  return next;
}
