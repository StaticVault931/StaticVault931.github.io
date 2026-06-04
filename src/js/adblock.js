/* ── ADBLOCK ─────────────────────────────────────────────────────── */
// Allow disabling for testing: set window._svAdBlockDisabled = true before loading
if (!window._svAdBlockDisabled) {

/* Block all popup/new-window attempts from embeds */
const _nativeOpen = window.open;
const ALLOWED_OPEN_DOMAINS = ['youtube.com', 'twitter.com', 'x.com', 'themoviedb.org', 'anilist.co'];
window.open = function(url, target, features) {
  if (!url) return null;
  // Allow same-origin opens
  if (url.startsWith('/') || url.startsWith(location.origin)) {
    return _nativeOpen.call(this, url, target, features);
  }
  try {
    const hostname = new URL(url).hostname;
    if (ALLOWED_OPEN_DOMAINS.some(d => hostname.endsWith(d))) {
      return _nativeOpen.call(this, url, target, features);
    }
  } catch {}
  return null;
};

/* Also intercept navigation attempts that are clearly ads */
const _nativeAssign = location.assign?.bind(location);
const _nativeReplace = location.replace?.bind(location);

/* ── AD DETECTION ────────────────────────────────────────────────── */
const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.', 'ads.yahoo.com', 'adsystem.com',
  'prebid.org', 'prebid.js', 'rubiconproject.com', 'openx.net',
  'appnexus.com', 'pubmatic.com', 'taboola.com', 'outbrain.com',
  'criteo.com', 'adroll.com', 'smartadserver.com', 'teads.tv',
  'spotxchange.com', 'springserve.com', 'sovrn.com', 'lijit.com',
  'bidswitch.net', 'adform.net', 'adnxs.com', 'adsrvr.org',
  'advertising.com', 'adbrite.com', 'admixer.net', 'adcolony.com',
  'moatads.com', 'tremorhub.com', 'smaato.net', 'yieldmo.com',
  'sharethrough.com', 'media.net', 'revcontent.com', 'mgid.com',
  'propellerads.com', 'popcash.net', 'popads.net', 'pop-under',
  'popunder', 'newadblock', 'traffic.js', 'tracking.js',
];

const AD_CLASSNAME_PATTERNS = /\b(ad[-_]?s?|advert|advertisement|ad[-_]container|ad[-_]wrap|ad[-_]slot|ad[-_]banner|ad[-_]overlay|popup[-_]?ad|popunder|promo[-_]box|sponsored|banner[-_]ad)\b/i;

const AD_ID_PATTERNS = /\b(ad[-_]?s?|advert|googletag|adsense|dfp[-_]|gpt[-_]|prebid|header[-_]bid)\b/i;

const POPUP_LIKE = /\b(popup|pop-up|modal-ad|interstitial|lightbox-ad|overlay-ad|fullscreen-ad)\b/i;

function isAdElement(el) {
  if (!el || el.nodeType !== 1) return false;

  // Never remove our own elements
  const id = String(el.id || '');
  const cls = String(el.className || '');
  if (id === 'player-frame' || id === 'hover-frame' || id === 'modal-overlay') return false;
  if (el.closest?.('#player-frame,#hover-frame,#modal-overlay,#loading-screen')) return false;

  // Check class/ID patterns
  if (AD_CLASSNAME_PATTERNS.test(cls)) return true;
  if (AD_ID_PATTERNS.test(id)) return true;
  if (POPUP_LIKE.test(cls) || POPUP_LIKE.test(id)) return true;

  // Check src for scripts and iframes
  if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') {
    const src = el.src || el.getAttribute?.('src') || '';
    if (src && AD_DOMAINS.some(d => src.includes(d))) return true;
  }

  // Check for popunder-style positioning
  if (el.tagName === 'DIV' || el.tagName === 'A') {
    try {
      const style = el.style;
      const computed = window.getComputedStyle?.(el);
      if (
        style.position === 'fixed' &&
        (style.zIndex > 9000 || parseInt(computed?.zIndex) > 9000) &&
        !el.closest?.('#hover-preview,#shortcuts-overlay,#legal-overlay,#confirm-overlay,#modal-overlay,#test-mode-panel,#toast,#bottom-nav')
      ) {
        // High z-index fixed elements that aren't ours are suspicious
        if (POPUP_LIKE.test(cls) || POPUP_LIKE.test(id)) return true;
      }
    } catch {}
  }

  return false;
}

/* ── BLOCK ADS ON DOCUMENT ───────────────────────────────────────── */
function removeAds(root) {
  if (!root) return;
  // Check root itself
  if (isAdElement(root)) {
    root.remove?.();
    return;
  }
  // Check children
  try {
    root.querySelectorAll?.('script[src],iframe[src],[id],[class]').forEach(el => {
      if (isAdElement(el)) el.remove();
    });
  } catch {}
}

/* ── MUTATION OBSERVER ───────────────────────────────────────────── */
const _adObserver = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      removeAds(node);
    }
    // Also check attribute mutations on existing elements (for lazy-loaded ad iframes)
    if (m.type === 'attributes' && m.target) {
      if (isAdElement(m.target)) m.target.remove?.();
    }
  }
});

function startAdObserver() {
  const target = document.body || document.documentElement;
  if (!target) {
    // Retry until body is available
    document.addEventListener('DOMContentLoaded', () => {
      _adObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'class', 'id', 'style'],
      });
    }, { once: true });
    return;
  }
  _adObserver.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'class', 'id', 'style'],
  });
}

startAdObserver();

/* ── BLOCK REDIRECT ATTEMPTS ─────────────────────────────────────── */
// Some embeds try to navigate the top frame via window.location
const _locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
if (!_locationDescriptor || _locationDescriptor.configurable) {
  try {
    // Throttle rapid location changes (ad redirects)
    let _lastNav = 0;
    const _handler = { get(target, key) {
      if (key === 'assign' || key === 'replace') {
        return (url) => {
          const now = Date.now();
          if (now - _lastNav < 800) return; // block rapid redirects
          _lastNav = now;
          if (url && (url.startsWith('/') || url.startsWith(location.origin))) {
            target[key](url);
          }
        };
      }
      return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
    }};
  } catch {}
}

/* ── CONSOLE CLEAN-UP ────────────────────────────────────────────── */
// Suppress ad-network error spam in console (purely cosmetic)
const _origError = console.error;
console.error = function(...args) {
  const msg = String(args[0] || '');
  if (AD_DOMAINS.some(d => msg.includes(d))) return;
  _origError.apply(console, args);
};

} // end if (!window._svAdBlockDisabled)
