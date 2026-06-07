import { state, persist } from './state.js';

/* ── PROVIDERS ───────────────────────────────────────────────────── */
// Ordered by: user-verified reliability (tested 2026-06)
// prio: high = shown by default, med/low = hidden under "More Sources" dropdown
// noSandbox: true = disable iframe sandbox automatically (player needs it to work)
// group: 'more' = collapsed under "More Sources" by default
export const PROVIDERS = [
  {
    // #1 — VidSrc.ru: verified working, no popups, auto-next episode
    id: 'vidsrcru',
    label: 'VidSrc.ru',
    prio: 'high',
    note: 'Auto-next · HD',
    domain: 'https://vidsrc.ru',
    types: ['movie', 'tv', 'anime'],
    noSandbox: true,
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.ru/movie/${id}?autoplay=true&colour=e50914&pausescreen=true`
      : `https://vidsrc.ru/tv/${id}/${s}/${e}?autoplay=true&colour=e50914&autonextepisode=true&pausescreen=true`,
  },
  {
    // #2 — 2Embed: verified working, wide coverage
    id: 'embed2',
    label: '2Embed',
    prio: 'high',
    note: 'Wide coverage',
    domain: 'https://www.2embed.cc',
    types: ['movie', 'tv'],
    noSandbox: true,
    url: (id, t, s, e) => t === 'movie'
      ? `https://www.2embed.cc/embed/${id}`
      : `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    // #3 — Videasy: verified working
    id: 'videasy',
    label: 'Videasy',
    prio: 'high',
    note: 'Reliable',
    domain: 'https://player.videasy.net',
    types: ['movie', 'tv'],
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.videasy.net/movie/${id}`
      : `https://player.videasy.net/tv/${id}/${s}/${e}`,
  },
  {
    // #4 — VidLink: 4K on some titles, needs sandbox off, some popups on click
    id: 'vidlink',
    label: 'VidLink',
    prio: 'high',
    note: '4K · Fast',
    domain: 'https://vidlink.pro',
    types: ['movie', 'tv', 'anime'],
    noSandbox: true,
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidlink.pro/movie/${id}?primaryColor=e50914`
      : `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e50914`,
  },
  {
    // #5 — VidSrc.to: the original VidSrc — large library, may have X-Frame-Options in Firefox
    id: 'vidsrcto',
    label: 'VidSrc',
    prio: 'high',
    note: 'Original · HD',
    domain: 'https://vidsrc.to',
    types: ['movie', 'tv', 'anime'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.to/embed/movie/${id}`
      : `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #6 — Embed.su: clean UI, consistent library
    id: 'embedsu',
    label: 'Embed.su',
    prio: 'high',
    note: 'Clean · Fast',
    domain: 'https://embed.su',
    types: ['movie', 'tv', 'anime'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://embed.su/embed/movie/${id}`
      : `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #7 — Vidfun: fresh provider with postMessage API support
    id: 'vidfun',
    label: 'VidFun',
    prio: 'med',
    note: 'API player',
    domain: 'https://vidfun.xyz',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidfun.xyz/movie/${id}`
      : `https://vidfun.xyz/tv/${id}/${s}/${e}`,
  },
  {
    // #8 — VidSrc CC: wide library, reliable HD
    id: 'vidsrc',
    label: 'VidSrc.cc',
    prio: 'med',
    note: 'HD · Wide',
    domain: 'https://vidsrc.cc',
    types: ['movie', 'tv', 'anime'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.cc/v2/embed/movie/${id}`
      : `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #9 — VidSrc Embed: original vidsrc embed backend
    id: 'vidsrcembed',
    label: 'VidSrc (Embed)',
    prio: 'med',
    note: 'Original backend',
    domain: 'https://vidsrc-embed.ru',
    types: ['movie', 'tv', 'anime'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc-embed.ru/embed/movie?tmdb=${id}`
      : `https://vidsrc-embed.ru/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    // #10 — Rive Stream: multi-source aggregator
    id: 'rive',
    label: 'Rive',
    prio: 'med',
    note: 'Multi-source',
    domain: 'https://rive.stream',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://rive.stream/embed/movie?id=${id}&yt=1`
      : `https://rive.stream/embed/tv?id=${id}&s=${s}&e=${e}&yt=1`,
  },
  {
    // #11 — Cineby: 4K available on select titles
    id: 'cineby',
    label: 'Cineby',
    prio: 'med',
    note: '4K available',
    domain: 'https://www.cineby.app',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://www.cineby.app/movie/${id}`
      : `https://www.cineby.app/tv/${id}/${s}/${e}`,
  },
  {
    // #12 — VidBinge: solid coverage, clean player
    id: 'vidbinge',
    label: 'VidBinge',
    prio: 'med',
    note: 'Clean player',
    domain: 'https://vidbinge.dev',
    types: ['movie', 'tv', 'anime'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidbinge.dev/embed/movie/${id}`
      : `https://vidbinge.dev/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #13 — VidSrc Me: alternate vidsrc backend
    id: 'vidsrcme',
    label: 'VidSrc.me',
    prio: 'med',
    note: 'Alt backend',
    domain: 'https://vidsrc.me',
    types: ['movie', 'tv', 'anime'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.me/embed/movie?tmdb=${id}`
      : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    // #14 — MoviesAPI: good coverage, minimal ads
    id: 'moviesapi',
    label: 'MoviesAPI',
    prio: 'med',
    note: 'Low ads',
    domain: 'https://moviesapi.club',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://moviesapi.club/movie/${id}`
      : `https://moviesapi.club/tv/${id}-${s}-${e}`,
  },
  {
    // #15 — AutoEmbed: good for recent content
    id: 'autoembed',
    label: 'AutoEmbed',
    prio: 'med',
    note: 'Recent content',
    domain: 'https://player.autoembed.cc',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.autoembed.cc/embed/movie/${id}`
      : `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #16 — MultiEmbed: multi-source, needs sandbox disabled
    id: 'superembed',
    label: 'MultiEmbed',
    prio: 'med',
    note: 'Multi-source',
    domain: 'https://multiembed.mov',
    types: ['movie', 'tv'],
    noSandbox: true,
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
      : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    // #17 — VidSrc Pro: separate pro library
    id: 'vidsrcpro',
    label: 'VidSrc Pro',
    prio: 'low',
    note: 'Pro library',
    domain: 'https://vidsrc.pro',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://vidsrc.pro/embed/movie/${id}`
      : `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  },
  {
    // #18 — Smashy Stream: fallback
    id: 'smashy',
    label: 'SmashyStream',
    prio: 'low',
    note: 'Fallback',
    domain: 'https://player.smashy.stream',
    types: ['movie', 'tv'],
    group: 'more',
    url: (id, t, s, e) => t === 'movie'
      ? `https://player.smashy.stream/movie/${id}`
      : `https://player.smashy.stream/tv/${id}?s=${s}&e=${e}`,
  },
];

// Detect Firefox — vidsrc.cc blocks iframe embedding in Firefox (X-Frame-Options)
const _isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

// IDs of providers known to block Firefox iframes
const FIREFOX_BLOCKED_PROVIDERS = new Set(['vidsrc', 'vidsrcto']);

export function providersFor(type, opts = {}) {
  let list = PROVIDERS.filter(p => p.types.includes(type === 'anime' ? 'tv' : type));
  // Firefox: skip providers known to block iframe embedding
  if (_isFirefox) list = list.filter(p => !FIREFOX_BLOCKED_PROVIDERS.has(p.id));
  // Respect user-disabled providers
  const disabled = JSON.parse(localStorage.getItem('sv_provider_disabled') || '[]');
  return list.filter(p => !disabled.includes(p.id));
}

/* ── SANDBOX FORCE OVERRIDE ──────────────────────────────────────── */
// null = auto per-provider, false = always off, true = always on
let _sandboxForce = null;

export function getSandboxForce() { return _sandboxForce; }

export function setSandboxForce(val) {
  _sandboxForce = val;
  const iframe = document.getElementById('player-frame');
  if (!iframe) return;
  if (val === false) {
    iframe.removeAttribute('sandbox');
  } else if (val === true && _iframeSandboxDefault) {
    iframe.setAttribute('sandbox', _iframeSandboxDefault);
  }
  // val === null → will be applied on next loadPlayer call
}

export function cycleSandboxForce() {
  // Cycle: auto → force off → force on → auto
  if (_sandboxForce === null)  setSandboxForce(false);
  else if (_sandboxForce === false) setSandboxForce(true);
  else setSandboxForce(null);
  return _sandboxForce;
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
  let provider = PROVIDERS.find(p => p.id === id) || PROVIDERS[0];
  // Firefox: silently redirect away from blocked providers
  if (_isFirefox && FIREFOX_BLOCKED_PROVIDERS.has(provider.id)) {
    provider = PROVIDERS.find(p => !FIREFOX_BLOCKED_PROVIDERS.has(p.id)) || PROVIDERS[0];
  }
  _activeProvider = provider;
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

  // Sandbox button label reflects current state
  const sf = _sandboxForce;
  const sbLabel = sf === false ? 'Sandbox: Off' : sf === true ? 'Sandbox: On' : 'Sandbox: Auto';
  const sbClass = sf === false ? ' prov-sandbox-off' : sf === true ? ' prov-sandbox-on' : ' prov-sandbox-auto';
  // Active provider sandbox state (for auto mode)
  const activeSandbox = sf !== null ? sf : !active.noSandbox;
  const sbIcon = activeSandbox
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;

  // Compute whether sandbox is effectively off for the active provider
  const activeSandboxOff = sf === false || (sf === null && active.noSandbox);

  // Split providers: main (shown by default) vs more (hidden under dropdown)
  // Active provider is always shown in main even if it's in 'more' group
  const mainList = list.filter(p => !p.group || p.group !== 'more' || p.id === active.id);
  const moreList = list.filter(p => p.group === 'more' && p.id !== active.id);

  const _provBtn = (p) => {
    const isActive = active.id === p.id;
    const sandboxActive = sf !== null ? sf !== false : !p.noSandbox;
    const noSandboxBadge = !sandboxActive ? `<span class="prov-nosandbox-dot" title="Sandbox off">●</span>` : '';
    return `<button class="prov-btn${isActive ? ' on' : ''}${p.prio === 'high' ? ' prio-high' : p.prio === 'low' ? ' prio-low' : ''}"
      data-provider="${p.id}"
      title="${p.label}${p.note ? ' · ' + p.note : ''}${p.noSandbox ? ' (no sandbox)' : ''}">${p.label}${p.note && p.note.includes('4K') ? `<span class="prov-note">4K</span>` : ''}${noSandboxBadge}</button>`;
  };

  const moreToggleHtml = moreList.length
    ? `<button class="prov-btn prov-more-toggle" id="prov-more-toggle" title="Show ${moreList.length} more sources">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        More (${moreList.length})
       </button>`
    : '';

  bar.innerHTML =
    `<span class="prov-label">Source</span>` +
    `<button class="prov-btn prov-next" id="prov-next-btn" title="Try next source">
       <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg> Next
     </button>` +
    `<button class="prov-btn prov-sandbox${sbClass}" id="prov-sandbox-btn" title="Cycle sandbox mode: Auto → Off → On\nAuto: off for VidLink/MultiEmbed/2Embed/VidSrc.ru, on for others\nOff: removes sandbox for all providers\nOn: forces sandbox on for all providers">${sbIcon} ${sbLabel}</button>` +
    mainList.map(_provBtn).join('') +
    moreToggleHtml;

  // Render "More Sources" panel as a sibling to modal-top-bar (avoids overflow-x clipping)
  // Remove any stale panel first
  document.getElementById('prov-more-panel')?.remove();
  if (moreList.length) {
    const panel = document.createElement('div');
    panel.id = 'prov-more-panel';
    panel.className = 'prov-more-panel';
    panel.style.display = 'none';
    panel.innerHTML = moreList.map(_provBtn).join('');
    const topBar = document.querySelector('.modal-top-bar');
    if (topBar) topBar.after(panel);

    // Wire toggle
    setTimeout(() => {
      const toggle = document.getElementById('prov-more-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : '';
        toggle.classList.toggle('on', !open);
      });
    }, 0);
  }

  // ── Sandbox-off warning banner — rendered as a sibling BELOW the top bar ──
  const modal = document.getElementById('modal');
  let warnEl = document.getElementById('prov-sandbox-warn');
  if (activeSandboxOff) {
    if (!warnEl) {
      warnEl = document.createElement('div');
      warnEl.id = 'prov-sandbox-warn';
      warnEl.className = 'prov-sandbox-warn';
      // Insert right after the modal-top-bar (before modal-body)
      const topBar = modal?.querySelector('.modal-top-bar');
      if (topBar && topBar.nextSibling) {
        modal.insertBefore(warnEl, topBar.nextSibling);
      } else if (modal) {
        modal.appendChild(warnEl);
      }
    }
    warnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
      <span>Sandbox disabled — this source runs without restrictions. Malicious pop-ups and redirect links may appear. <strong>Close any unexpected windows immediately.</strong></span>`;
    warnEl.style.display = 'flex';
  } else if (warnEl) {
    warnEl.style.display = 'none';
  }
}

/* ── PLAYER LOAD ─────────────────────────────────────────────────── */
let _providerTimer = null;

// Saved sandbox attribute value so we can restore it when switching away
let _iframeSandboxDefault = null;

export function loadPlayer(mediaId, type, season = 1, episode = 1) {
  const loading = document.getElementById('player-loading');
  const iframe = document.getElementById('player-frame');
  if (!loading || !iframe) return;

  // Save original sandbox value on first call
  if (_iframeSandboxDefault === null) {
    _iframeSandboxDefault = iframe.getAttribute('sandbox') || '';
  }

  clearTimeout(_providerTimer);
  loading.classList.remove('hidden');
  loading.innerHTML = `<div class="spin"></div><p>Loading player…</p>`;

  let provider = getActiveProvider();
  // Safety: if Firefox ended up with a blocked provider anyway, swap it out
  if (_isFirefox && FIREFOX_BLOCKED_PROVIDERS.has(provider.id)) {
    const safe = PROVIDERS.find(p => !FIREFOX_BLOCKED_PROVIDERS.has(p.id));
    if (safe) { _activeProvider = safe; state.lastProvider = safe.id; provider = safe; }
  }

  // Sandbox: force override wins; otherwise auto per-provider
  if (_sandboxForce === false) {
    iframe.removeAttribute('sandbox');
  } else if (_sandboxForce === true) {
    if (_iframeSandboxDefault) iframe.setAttribute('sandbox', _iframeSandboxDefault);
  } else {
    // Auto: disable for noSandbox providers, restore for others
    if (provider.noSandbox) {
      iframe.removeAttribute('sandbox');
    } else if (_iframeSandboxDefault) {
      iframe.setAttribute('sandbox', _iframeSandboxDefault);
    }
  }

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
