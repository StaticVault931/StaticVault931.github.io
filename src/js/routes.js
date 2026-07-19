export const SITE_ORIGIN = 'https://staticvault931.github.io';

export const PAGE_PATHS = Object.freeze({
  home: '/',
  movies: '/movies/',
  tv: '/tv/',
  anime: '/anime/',
  clips: '/clips/',
  mix: '/mix/',
  search: '/search/',
  library: '/library/',
  prefs: '/customize/',
});

export function slugifyRoute(value = '') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'title';
}

export function pagePath(page) {
  return PAGE_PATHS[page] || `/?page=${encodeURIComponent(page)}`;
}

export function searchPath(query = '') {
  const value = String(query || '').trim();
  return value ? `/search/?q=${encodeURIComponent(value)}` : PAGE_PATHS.search;
}

export function providerPath(id, name = '') {
  return `/provider/${Number(id)}-${slugifyRoute(name || 'streaming-service')}/`;
}

export function browsePath(key, title = '') {
  const safeKey = slugifyRoute(key || 'all');
  return `/browse/${safeKey}/${slugifyRoute(title || safeKey)}/`;
}

export function canonicalPageUrl(page) {
  return SITE_ORIGIN + pagePath(page);
}

export function titlePath(type, id, title = '', year = '') {
  const safeType = type === 'tv' || type === 'anime' ? type : 'movie';
  const slug = slugifyRoute(`${title}${year ? ` ${year}` : ''}`);
  return `/title/${safeType}/${Number(id)}-${slug}/`;
}

export function personPath(id, name = '') {
  return `/person/${Number(id)}-${slugifyRoute(name || 'person')}/`;
}

export function collectionPath(id, name = '') {
  return `/collection/${Number(id)}-${slugifyRoute(name || 'collection')}/`;
}

export function parseCleanRoute(pathname = '/') {
  const path = pathname.replace(/\/{2,}/g, '/');
  const page = Object.entries(PAGE_PATHS).find(([, value]) => value === path)?.[0];
  if (page) return { kind: 'page', page };
  let match = path.match(/^\/title\/(movie|tv|anime)\/(\d+)(?:-[^/]*)?\/?$/i);
  if (match) return { kind: 'title', type: match[1].toLowerCase(), id: Number(match[2]) };
  match = path.match(/^\/person\/(\d+)(?:-[^/]*)?\/?$/i);
  if (match) return { kind: 'person', id: Number(match[1]) };
  match = path.match(/^\/collection\/(\d+)(?:-[^/]*)?\/?$/i);
  if (match) return { kind: 'collection', id: Number(match[1]) };
  match = path.match(/^\/provider\/(\d+)(?:-([^/]*))?\/?$/i);
  if (match) return { kind: 'provider', id: Number(match[1]), slug: match[2] || '' };
  match = path.match(/^\/browse\/([^/]+)(?:\/([^/]+))?\/?$/i);
  if (match) return { kind: 'browse', key: decodeURIComponent(match[1]), slug: match[2] || '' };
  return null;
}

export function routeLabel(slug = '', fallback = '') {
  const label = decodeURIComponent(String(slug || '')).replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()).trim();
  return label || fallback;
}
