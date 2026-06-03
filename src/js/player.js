import { state, persist } from './state.js';

/* ── PROVIDERS ───────────────────────────────────────────────────── */
export const PROVIDERS = [
  {
    id: 'vidsrc',
    label: 'VidSrc',
    prio: 'high',
    types: ['movie', 'tv', 'anime'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.to/embed/movie/${id}`
      : `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'embed2',
    label: '2Embed',
    prio: 'high',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://www.2embed.cc/embed/${id}`
      : `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id: 'superembed',
    label: 'SuperEmbed',
    prio: 'high',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
      : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    id: 'autoembed',
    label: 'AutoEmbed',
    prio: 'med',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.autoembed.cc/embed/movie/${id}`
      : `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidlink',
    label: 'VidLink',
    prio: 'med',
    types: ['movie', 'tv', 'anime'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidlink.pro/movie/${id}`
      : `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrcpro',
    label: 'VidSrc Pro',
    prio: 'med',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.pro/embed/movie/${id}`
      : `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  },
  {
    // Based on observed URL pattern: cineby.sc/movie/{tmdb_id}
    // TV path inferred: cineby.sc/tv/{id}/{season}/{episode} — unverified, may fail gracefully
    id: 'cineby',
    label: 'Cineby',
    prio: 'med',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://www.cineby.sc/movie/${id}`
      : `https://www.cineby.sc/tv/${id}/${s}/${e}`,
  },
  {
    id: 'videasy',
    label: 'Videasy',
    prio: 'low',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.videasy.net/movie/${id}`
      : `https://player.videasy.net/tv/${id}/${s}/${e}`,
  },
];

export function providersFor(type) {
  return PROVIDERS.filter(p => p.types.includes(type === 'anime' ? 'tv' : type));
}

/* ── ACTIVE PROVIDER ─────────────────────────────────────────────── */
let _activeProvider = null;

export function getActiveProvider() {
  if (_activeProvider) return _activeProvider;
  const saved = state.lastProvider;
  _activeProvider = PROVIDERS.find(p => p.id === saved) || PROVIDERS[0];
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
    list.map(p =>
      `<button class="prov-btn${active.id === p.id ? ' on' : ''}${p.prio === 'high' ? ' prio-high' : p.prio === 'low' ? ' prio-low' : ''}"
        data-provider="${p.id}"
        title="${p.label}">${p.label}</button>`
    ).join('') +
    `<button class="prov-btn prov-next" id="prov-next-btn" title="Try next source">
       <span class="material-icons-round" style="font-size:.9rem">skip_next</span> Next
     </button>`;

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
