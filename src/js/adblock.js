/* ── ADBLOCK ─────────────────────────────────────────────────────── */
// Block popup windows opened by embeds
window.open = () => null;

const AD_PATTERNS = [/\bad-?s?\b/i,/advert/i,/adsense/i,/doubleclick/i,/googlesyndication/i,/prebid/i,/pop-?under/i,/pop-?up/i];
const AD_CLASSES = /\b(ad|ads|advert|advertisement|ad-container|ad-wrap|ad-slot|ad-banner|ad-overlay|popup-ad|popunder)\b/i;

function isAd(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.id === 'player-frame') return false;
  const cls = String(el.className || '');
  const id = String(el.id || '');
  if (AD_CLASSES.test(cls) || AD_CLASSES.test(id)) return true;
  if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') {
    const src = el.src || el.getAttribute?.('src') || '';
    if (AD_PATTERNS.some(p => p.test(src))) return true;
  }
  return false;
}

new MutationObserver(muts => {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (isAd(node)) { node.remove(); continue; }
      node.querySelectorAll?.('script[src],iframe[src]').forEach(c => { if (isAd(c)) c.remove(); });
    }
  }
}).observe(document.body || document.documentElement, { childList: true, subtree: true });
