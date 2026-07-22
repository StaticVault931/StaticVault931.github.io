const STORAGE_KEY = 'sv_product_analytics_v1';
const SESSION_KEY = 'sv_product_session_v1';
const MAX_EVENTS = 80;
const ALLOWED_GA_EVENTS = new Set([
  'share', 'title_open', 'collection_open', 'person_open', 'provider_open',
  'qualified_trailer_preview', 'undo_trailer_preview', 'collection_order',
]);

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function clean(value, max = 64) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').slice(0, max);
}

function referrerSource() {
  if (!document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    if (!host || host === location.hostname) return 'internal';
    if (/google\.|bing\.|duckduckgo\.|yahoo\.|brave\./.test(host)) return 'organic-search';
    if (/facebook\.|instagram\.|tiktok\.|twitter\.|x\.com$|reddit\.|discord\./.test(host)) return 'social';
    return clean(host, 80) || 'referral';
  } catch { return 'referral'; }
}

function landingAttribution() {
  const params = new URLSearchParams(location.search);
  const source = clean(params.get('utm_source')) || clean(params.get('ref')) || referrerSource();
  return {
    source,
    medium: clean(params.get('utm_medium')) || (source === 'direct' ? 'none' : 'referral'),
    campaign: clean(params.get('utm_campaign')),
    content: clean(params.get('utm_content')),
    landedAt: Date.now(),
  };
}

function profileId() {
  try { return localStorage.getItem('sv_active_profile') || 'default'; }
  catch { return 'default'; }
}

function blank() {
  return { firstTouch: null, lastTouch: null, sources: {}, counters: {}, events: [] };
}

function load() {
  const value = read(`${STORAGE_KEY}_${profileId()}`, blank());
  return { ...blank(), ...value, sources: value.sources || {}, counters: value.counters || {}, events: value.events || [] };
}

function save(value) { write(`${STORAGE_KEY}_${profileId()}`, value); }

export function initProductAnalytics() {
  const current = landingAttribution();
  const data = load();
  data.firstTouch ||= current;
  data.lastTouch = current;
  data.sources[current.source] = (data.sources[current.source] || 0) + 1;
  save(data);
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, crypto.randomUUID?.() || String(Date.now()));
  } catch {}
  return current;
}

function gaAllowed() {
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  return !dnt && typeof window.gtag === 'function';
}

export function recordProductEvent(name, detail = {}, { ga = true } = {}) {
  const safeName = clean(name, 48);
  if (!safeName) return;
  const data = load();
  data.counters[safeName] = (data.counters[safeName] || 0) + 1;
  const event = {
    name: safeName,
    at: Date.now(),
    surface: clean(detail.surface, 32),
    type: clean(detail.type, 16),
    id: Number.isFinite(+detail.id) ? +detail.id : undefined,
    value: Number.isFinite(+detail.value) ? +detail.value : undefined,
  };
  data.events.push(event);
  if (data.events.length > MAX_EVENTS) data.events.splice(0, data.events.length - MAX_EVENTS);
  save(data);
  if (ga && ALLOWED_GA_EVENTS.has(safeName) && gaAllowed()) {
    window.gtag('event', safeName, {
      content_type: event.type || undefined,
      content_id: event.id || undefined,
      source_surface: event.surface || undefined,
      value: event.value || undefined,
    });
  }
}

export function attributedShareUrl(rawUrl, content = 'title') {
  const url = new URL(rawUrl, location.origin);
  url.searchParams.set('utm_source', 'staticvault-share');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'user-share');
  url.searchParams.set('utm_content', clean(content, 32) || 'title');
  return url.toString();
}

export function getProductAnalytics() {
  const data = load();
  return { firstTouch: data.firstTouch, lastTouch: data.lastTouch, sources: { ...data.sources }, counters: { ...data.counters }, recentEvents: data.events.slice(-20) };
}

export function clearProductAnalytics() {
  try { localStorage.removeItem(`${STORAGE_KEY}_${profileId()}`); } catch {}
}
