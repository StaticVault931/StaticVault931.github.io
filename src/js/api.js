/* ── CONFIG ──────────────────────────────────────────────────────── */
const TMDB_RAT = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkYTczNjY3NzU0NmZjNjc4MjgwYzQ0NmQ4YjU0YjdlYSIsIm5iZiI6MTc4MDE4MzY2NC4xOCwic3ViIjoiNmExYjcyNzAxMDQ5YTMwZjhkN2Y2ZDFlIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.yE8EJHCvta69K2M9ETHG_KvREifHmBV9X4E9vh2-CaE';
export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p/';
export const ANILIST = 'https://graphql.anilist.co';

// ── THIRD-PARTY API KEYS ─────────────────────────────────────────
export const OMDB_KEY        = '9f3c997';
export const FANART_KEY      = '61816a03253da18b920d1a3e991a8abb'; // fanart.tv
export const WATCHMODE_KEY   = '8y2t5vgtSGi058Rk1JcI80mOgfANIpQic8zKB1zq';
export const TVAPI_KEY       = 'k_ukuha965';   // tv-api.com primary
export const TVAPI_KEY2      = 'pk_tbfqvjjbljz611let'; // tv-api.com secondary
export const LOGO_DEV_TOKEN  = 'pk_Ls472ChRSLSBvfBYgW6R7Q'; // logo.dev
export const TASTEDIVE_KEY   = '1073636-StaticQ-DF044F0C'; // TasteDive recommendations

// Logo.dev: domain-to-logo mapping for streaming providers
export const PROVIDER_LOGO_DOMAINS = {
  'Netflix':              'netflix.com',
  'Hulu':                 'hulu.com',
  'Amazon Prime Video':   'primevideo.com',
  'Prime Video':          'primevideo.com',
  'Disney Plus':          'disneyplus.com',
  'Disney+':              'disneyplus.com',
  'Max':                  'max.com',
  'HBO Max':              'max.com',
  'Apple TV Plus':        'tv.apple.com',
  'Apple TV+':            'tv.apple.com',
  'Paramount Plus':       'paramountplus.com',
  'Paramount+':           'paramountplus.com',
  'Peacock':              'peacocktv.com',
  'Peacock Premium':      'peacocktv.com',
  'Crunchyroll':          'crunchyroll.com',
  'YouTube':              'youtube.com',
  'YouTube Premium':      'youtube.com',
  'Tubi TV':              'tubi.tv',
  'Tubi':                 'tubi.tv',
  'Pluto TV':             'pluto.tv',
  'Starz':                'starz.com',
  'Showtime':             'showtime.com',
  'BritBox':              'britbox.com',
  'Shudder':              'shudder.com',
  'Mubi':                 'mubi.com',
  'FuboTV':               'fubo.tv',
  'AMC Plus':             'amcplus.com',
  'Discovery Plus':       'discoveryplus.com',
  'ESPN Plus':            'espnplus.com',
  'MGM Plus':             'mgm.com',
  'MGM+':                 'mgm.com',
  'Kanopy':               'kanopy.com',
  'Plex':                 'plex.tv',
  'Amazon Freevee':       'amazon.com',
  'Freevee':              'amazon.com',
  'Google Play Movies':   'play.google.com',
  'Google Play':          'play.google.com',
  'Apple TV':             'apple.com',
  'Fandango at Home':     'fandango.com',
  'Fandango':             'fandango.com',
  'Vudu':                 'vudu.com',
  'Microsoft Store':      'microsoft.com',
  'YouTube Free':         'youtube.com',
  'Tubi':                 'tubi.tv',
  'Funimation':           'funimation.com',
  'HBO':                  'hbo.com',
  'Criterion Channel':    'criterionchannel.com',
  'Mubi Go':              'mubi.com',
  'Sundance Now':         'sundancenow.com',
  'Roku Channel':         'roku.com',
  'Roku':                 'roku.com',
  'Spectrum On Demand':   'spectrum.net',
  'Spectrum':             'spectrum.net',
  'Philo':                'philo.com',
  'DirecTV':              'directv.com',
  'DirecTV Stream':       'directv.com',
  'DIRECTV':              'directv.com',
  'Sling TV':             'sling.com',
  'Sling':                'sling.com',
  'Xfinity':              'xfinity.com',
  'Comcast Xfinity':      'xfinity.com',
  'Cox':                  'cox.com',
  'EPIX':                 'mgm.com',
  'Acorn TV':             'acorn.tv',
  'Topic':                'topic.com',
  'Flix Fling':           'flixfling.com',
  'Hoopla':               'hoopladigital.com',
  'IndieFlix':            'indieflix.com',
  'Hallmark Movies Now':  'hallmarkchannel.com',
  'UP Faith & Family':    'upfaithandfamily.com',
  'Dove Channel':         'dovechannel.com',
  'Pure Flix':            'pureflix.com',
};

export function getProviderLogoUrl(name, size = 32) {
  const domain = PROVIDER_LOGO_DOMAINS[name];
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=${size}&format=png`;
}

export const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

/* ── CACHE ───────────────────────────────────────────────────────── */
function cacheKey(path, params) {
  try { return 'svc_' + btoa(path + JSON.stringify(params)).replace(/[=+/]/g, c => ({ '=': '', '+': '-', '/': '_' }[c])); }
  catch { return 'svc_' + path.replace(/\W/g, '_'); }
}

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

/* ── TMDB ────────────────────────────────────────────────────────── */
export async function tmdb(path, params = {}) {
  const key = cacheKey(path, params);
  const cached = cacheGet(key);
  if (cached) return cached;

  const u = new URL(TMDB_BASE + path);
  u.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));

  const r = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${TMDB_RAT}` },
  });
  if (!r.ok) throw new Error(`TMDB ${r.status}: ${path}`);
  const data = await r.json();
  cacheSet(key, data);
  return data;
}

/* ── TMDB: Best English backdrop (title-card image with text) ──────── */
// Prefers iso_639_1='en' backdrops (have title text), sorted by vote_average
// Falls back to null-language backdrops if no English ones exist
export async function fetchBestBackdrop(id, type) {
  const mediaType = type === 'anime' ? 'tv' : type;
  const key = cacheKey(`best_backdrop_${mediaType}_${id}`, {});
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  try {
    // Fetch without language filter to get all language variants
    const u = new URL(`${TMDB_BASE}/${mediaType}/${id}/images`);
    const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${TMDB_RAT}` } });
    if (!r.ok) { cacheSet(key, null); return null; }
    const data = await r.json();
    const bds = data.backdrops || [];
    const rank = (b) => (b.vote_average || 0) * 100 + (b.vote_count || 0) * 0.01;
    const enBds = bds.filter(b => b.iso_639_1 === 'en').sort((a, b) => rank(b) - rank(a));
    const nullBds = bds.filter(b => !b.iso_639_1).sort((a, b) => rank(b) - rank(a));
    const best = enBds[0] || nullBds[0] || null;
    const result = best ? { file_path: best.file_path, hasText: !!enBds[0] } : null;
    cacheSet(key, result);
    return result;
  } catch { cacheSet(key, null); return null; }
}

/* ── ANILIST ─────────────────────────────────────────────────────── */
export async function aniQuery(query, variables = {}) {
  const key = cacheKey('ani_' + query.slice(0, 40), variables);
  const cached = cacheGet(key);
  if (cached) return cached;

  const r = await fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await r.json();
  cacheSet(key, data);
  return data;
}

/* ── OMDB (Ratings: IMDb, Rotten Tomatoes, Metacritic) ───────────── */
// Pass imdbId like "tt1375666" — get from TMDB external_ids
export async function fetchOMDb(imdbId) {
  if (!OMDB_KEY || !imdbId) return null;
  const key = cacheKey('omdb_' + imdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}&tomatoes=true`);
    if (!r.ok) return null;
    const data = await r.json();
    if (data.Response === 'False') return null;
    cacheSet(key, data);
    return data;
  } catch { return null; }
}

/* ── FANART.TV (Transparent logos, HD backgrounds, studio logos) ─── */
// NOTE: fanart.tv API sends invalid CORS headers (*, *) which Firefox rejects.
// This function uses a CORS proxy workaround. If blocked, it returns null gracefully.
export async function fetchFanart(tmdbId, type = 'movies') {
  if (!FANART_KEY) return null;
  const path = type === 'movies' ? `movies/${tmdbId}` : `tv/${tmdbId}`;
  const key = cacheKey('fanart_' + type + '_' + tmdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    // Try direct endpoint — silently fails if CORS blocked (Firefox)
    const endpoint = `https://webservice.fanart.tv/v3/${path}?api_key=${FANART_KEY}`;
    const r = await fetch(endpoint, { mode: 'cors' });
    if (!r.ok) return null;
    const data = await r.json();
    cacheSet(key, data);
    return data;
  } catch {
    // CORS blocked — return null silently (no console error spam)
    return null;
  }
}

// Extract best logo URL from Fanart response
export function getFanartLogo(fanartData) {
  if (!fanartData) return null;
  const logos = fanartData.hdmovielogo || fanartData.movielogo ||
                fanartData.hdtvlogo   || fanartData.tvlogo || [];
  const enLogo = logos.find(l => l.lang === 'en') || logos[0];
  return enLogo?.url || null;
}

/* ── WATCHMODE (Where to watch / streaming availability) ─────────── */
// Pass imdbId like "tt1375666" to get streaming sources
export async function fetchWatchmode(imdbId) {
  if (!WATCHMODE_KEY || !imdbId) return null;
  const key = cacheKey('watchmode_' + imdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    // First: resolve Watchmode title ID from IMDB ID
    const searchRes = await fetch(
      `https://api.watchmode.com/v1/search/?apiKey=${WATCHMODE_KEY}&search_field=imdb_id&search_value=${imdbId}`
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const titleId = searchData.title_results?.[0]?.id;
    if (!titleId) return null;

    // Then: get streaming sources for that title
    const sourcesRes = await fetch(
      `https://api.watchmode.com/v1/title/${titleId}/sources/?apiKey=${WATCHMODE_KEY}&regions=US`
    );
    if (!sourcesRes.ok) return null;
    const sources = await sourcesRes.json();
    cacheSet(key, sources);
    return sources;
  } catch { return null; }
}

// Well-known streaming service info (for display even without Watchmode key)
export const STREAMING_SERVICES = {
  203: { name: 'Netflix',      color: '#e50914', icon: 'N' },
  157: { name: 'Hulu',         color: '#1ce783', icon: 'H' },
  26:  { name: 'Prime Video',  color: '#00a8e1', icon: 'P' },
  372: { name: 'Disney+',      color: '#113ccf', icon: 'D' },
  387: { name: 'Max',          color: '#002be7', icon: 'M' },
  371: { name: 'Apple TV+',    color: '#000',    icon: 'A' },
  444: { name: 'Peacock',      color: '#ffd700', icon: 'Pc'},
  300: { name: 'Paramount+',   color: '#0064ff', icon: 'P+'},
  389: { name: 'Crunchyroll',  color: '#f47521', icon: 'CR'},
};

/* ── WIKIDATA (Actor extra info: awards, spouse, education) ──────── */
// Pass wikidata ID like "Q148" or search by name
export async function fetchWikidata(wikidataId) {
  if (!wikidataId) return null;
  const key = cacheKey('wikidata_' + wikidataId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const r = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`
    );
    if (!r.ok) return null;
    const data = await r.json();
    cacheSet(key, data);
    return data;
  } catch { return null; }
}

// Find Wikidata QID for a person by TMDB person ID via TMDB external_ids
export async function getWikidataId(tmdbPersonId) {
  try {
    const extIds = await tmdb(`/person/${tmdbPersonId}/external_ids`);
    return extIds?.wikidata_id || null;
  } catch { return null; }
}

/* ── WIKIPEDIA (Rich biographies, company history) ───────────────── */
export async function fetchWikipediaSummary(title) {
  if (!title) return null;
  const key = cacheKey('wiki_' + title, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    );
    if (!r.ok) return null;
    const data = await r.json();
    cacheSet(key, data);
    return data;
  } catch { return null; }
}

/* ── JIKAN / MyAnimeList (Rich anime metadata) ───────────────────── */
export async function fetchJikan(malId) {
  if (!malId) return null;
  const key = cacheKey('jikan_' + malId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const r = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`);
    if (!r.ok) return null;
    const data = await r.json();
    cacheSet(key, data);
    return data;
  } catch { return null; }
}

/* ── TV-API.COM (IMDB-API) — trailers, awards, ratings ──────────── */
// imdbId like "tt1375666". Free: 100 calls/day. Use conservatively.
const TVAPI_BASE = 'https://tv-api.com/API';

// Build TV-API URL: /API/{action}/{key}/{id?}
// Docs format: GET /API/Trailer/{apiKey}/{imdbId}
function _tvApiUrl(action, idOrNull) {
  // Try primary key first, builds URL with key inserted
  return idOrNull
    ? `${TVAPI_BASE}/${action}/${TVAPI_KEY}/${idOrNull}`
    : `${TVAPI_BASE}/${action}/${TVAPI_KEY}`;
}

async function _tvApiGet(action, id) {
  const keys = [TVAPI_KEY, TVAPI_KEY2].filter(Boolean);
  for (const apiKey of keys) {
    const url = id ? `${TVAPI_BASE}/${action}/${apiKey}/${id}` : `${TVAPI_BASE}/${action}/${apiKey}`;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      if (!data.errorMessage) return data;
      // If daily limit exceeded, try next key
      if (data.errorMessage?.toLowerCase().includes('limit') || data.errorMessage?.toLowerCase().includes('maximum')) continue;
    } catch {}
  }
  return null;
}

export async function fetchTvApiTrailer(imdbId) {
  if (!imdbId) return null;
  const key = cacheKey('tvapi_trailer_' + imdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _tvApiGet('Trailer', imdbId);
  if (data) cacheSet(key, data);
  return data;
}

export async function fetchTvApiYouTubeTrailer(imdbId) {
  if (!imdbId) return null;
  const key = cacheKey('tvapi_yt_' + imdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _tvApiGet('YouTubeTrailer', imdbId);
  if (data?.videoId) { cacheSet(key, data); return data; }
  return null;
}

export async function fetchTvApiAwards(imdbId) {
  if (!imdbId) return null;
  const key = cacheKey('tvapi_awards_' + imdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _tvApiGet('Awards', imdbId);
  if (data) cacheSet(key, data);
  return data;
}

export async function fetchTvApiTop250Movies() {
  const key = cacheKey('tvapi_top250movies', {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _tvApiGet('Top250Movies', null);
  if (data) cacheSet(key, data);
  return data;
}

export async function fetchTvApiBoxOffice() {
  const key = cacheKey('tvapi_boxoffice', {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _tvApiGet('BoxOffice', null);
  if (data) cacheSet(key, data);
  return data;
}

/* ── DAILYMOTION REMOVED ────────────────────────────────────────── */

/* ── VIDSRC.RU — latest feeds (Recently Added rows) ───────── */
const VIDSRC_BASE = 'https://vidsrc.ru';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

async function _vidsrcFetch(url) {
  try {
    // VidSrc dropped CORS headers, so we use a public proxy for the JSON feeds
    const r = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) ? data : data?.result || data?.items || null;
  } catch {
    return null;
  }
}

export async function fetchVidsrcLatestMovies(page = 1) {
  const key = cacheKey('vidsrc_latest_movies_' + page, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _vidsrcFetch(`${VIDSRC_BASE}/movies/latest/page-${page}.json`);
  if (data) cacheSet(key, data);
  return data;
}

export async function fetchVidsrcLatestShows(page = 1) {
  const key = cacheKey('vidsrc_latest_shows_' + page, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _vidsrcFetch(`${VIDSRC_BASE}/tvshows/latest/page-${page}.json`);
  if (data) cacheSet(key, data);
  return data;
}

export async function fetchVidsrcLatestEpisodes(page = 1) {
  const key = cacheKey('vidsrc_latest_eps_' + page, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  const data = await _vidsrcFetch(`${VIDSRC_BASE}/episodes/latest/page-${page}.json`);
  if (data) cacheSet(key, data);
  return data;
}

// Build vidsrc-embed URL for a movie or TV episode
export function getVidsrcEmbedUrl(type, id, { season, episode, imdbId, dsLang, autonext = 0 } = {}) {
  if (type === 'movie') {
    const base = imdbId
      ? `${VIDSRC_BASE}/embed/movie?imdb=${imdbId}`
      : `${VIDSRC_BASE}/embed/movie?tmdb=${id}`;
    return dsLang ? `${base}&ds_lang=${dsLang}` : base;
  }
  if (type === 'tv' || type === 'anime') {
    if (season && episode) {
      const base = imdbId
        ? `${VIDSRC_BASE}/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
        : `${VIDSRC_BASE}/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
      return `${base}&autonext=${autonext}${dsLang ? `&ds_lang=${dsLang}` : ''}`;
    }
    return imdbId
      ? `${VIDSRC_BASE}/embed/tv?imdb=${imdbId}`
      : `${VIDSRC_BASE}/embed/tv?tmdb=${id}`;
  }
  return null;
}

/* ── TASTEDIVE — "More Like This" recommendations ────────────────── */
export async function fetchTasteDive(title, type = 'movie') {
  if (!TASTEDIVE_KEY) return null;
  const typeMap = { movie: 'movies', tv: 'shows', anime: 'shows' };
  const q = encodeURIComponent(title);
  const t = typeMap[type] || 'movies';
  const key = cacheKey('tastedive_' + title + '_' + t, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    // TasteDive uses JSONP or direct API — try with verbose=1 for descriptions
    const url = `https://tastedive.com/api/similar?q=${q}&type=${t}&limit=10&info=1&verbose=1&apikey=${TASTEDIVE_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    if (data?.Similar) cacheSet(key, data);
    return data?.Similar ? data : null;
  } catch { return null; }
}

/* ── WIKIDATA SPARQL (franchise chains, studio ownership, awards) ── */
export async function wikidataSPARQL(query) {
  const key = cacheKey('sparql_' + query.slice(0, 60), {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
    const r = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
    if (!r.ok) return null;
    const data = await r.json();
    cacheSet(key, data);
    return data;
  } catch { return null; }
}

// Get Oscar/Emmy/BAFTA wins for a film by IMDb ID via Wikidata
export async function getFilmAwards(imdbId) {
  if (!imdbId) return null;
  const q = `
    SELECT ?awardLabel WHERE {
      ?film wdt:P345 "${imdbId}" .
      ?film p:P166 ?awardStatement .
      ?awardStatement ps:P166 ?award .
      ?award rdfs:label ?awardLabel .
      FILTER(LANG(?awardLabel) = "en")
    } LIMIT 8`;
  try {
    const data = await wikidataSPARQL(q);
    return (data?.results?.bindings || []).map(b => b.awardLabel?.value).filter(Boolean);
  } catch { return []; }
}

/* ── CACHE PATTERN CLEAR ─────────────────────────────────────────── */
export function clearCachePattern(pattern) {
  const prefix = 'svc_';
  const lower = pattern.toLowerCase();
  Object.keys(sessionStorage).forEach(k => {
    if (k.startsWith(prefix) && k.toLowerCase().includes(lower)) {
      sessionStorage.removeItem(k);
    }
  });
}

/* ── IMAGE HELPERS ───────────────────────────────────────────────── */
export function imgUrl(path, size = 'w300') {
  if (!path) return null;
  const v = String(path);
  return /^https?:\/\//i.test(v) ? v : IMG + size + v;
}

/* ── CONTENT RATING ──────────────────────────────────────────────── */
export function getContentRating(details, type) {
  try {
    if (type === 'movie') {
      const us = details.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
      const cert = us?.release_dates?.map(x => x.certification).find(Boolean);
      if (cert) return cert;
    } else if (type === 'tv') {
      const us = details.content_ratings?.results?.find(r => r.iso_3166_1 === 'US');
      if (us?.rating) return us.rating;
    }
  } catch {}
  return null;
}

/* ── ANIME HELPERS ───────────────────────────────────────────────── */
export function normalizeAnime(m) {
  return {
    id: m.id,
    title: m.title?.english || m.title?.romaji || 'Unknown',
    poster_path: null,
    coverImage_large: m.coverImage?.large || null,
    backdrop_path: m.bannerImage || null,
    vote_average: (m.averageScore || 0) / 10,
    averageScore: m.averageScore || 0,
    overview: (m.description || '').replace(/<[^>]+>/g, ''),
    release_date: m.startDate?.year || null,
    first_air_date: m.startDate?.year || null,
    popularity: m.popularity || 0,
    media_type: 'anime',
    _anime: true,
  };
}

export async function fetchAnimeDetails(id) {
  const Q = `query($id:Int){Media(id:$id,type:ANIME){
    id title{romaji english}
    description(asHtml:false)
    coverImage{large}bannerImage
    averageScore popularity episodes status
    startDate{year}
    genres tags{name rank category isGeneralSpoiler}
    studios{nodes{name}}
    characters{edges{
      node{name{full}image{medium}}
      voiceActors(language:JAPANESE){name{full}image{medium}}
    }}
    recommendations(sort:[RATING_DESC],perPage:12){
      nodes{mediaRecommendation{
        id title{english romaji}coverImage{large}averageScore popularity startDate{year}
      }}
    }
  }}`;
  const d = await aniQuery(Q, { id: +id });
  const m = d?.data?.Media;
  if (!m) throw new Error('Anime not found');

  // Filter out spoiler tags, sort by rank
  const tags = (m.tags || [])
    .filter(t => !t.isGeneralSpoiler && t.rank >= 60)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 12);

  return {
    id: m.id,
    title: m.title?.english || m.title?.romaji,
    romaji: m.title?.romaji,
    overview: (m.description || '').replace(/<[^>]+>/g, ''),
    poster_path: null,
    coverImage_large: m.coverImage?.large,
    backdrop_path: m.bannerImage || null,
    vote_average: (m.averageScore || 0) / 10,
    number_of_episodes: m.episodes,
    status: m.status,
    genres: (m.genres || []).map(g => ({ name: g })),
    _aniTags: tags,
    release_date: m.startDate?.year,
    _anime: true,
    _cast: (m.characters?.edges || []).map(e => ({
      name: e.node?.name?.full,
      character: e.voiceActors?.[0]?.name?.full || '',
      profile_path: e.node?.image?.medium || null,
    })),
    _recommendations: (m.recommendations?.nodes || [])
      .map(n => n.mediaRecommendation)
      .filter(Boolean)
      .map(normalizeAnime),
  };
}

/* ── API HEALTH CHECK (for CYF Test APIs button) ─────────────────── */
export async function testAllAPIs() {
  const results = [];

  // TMDB — always required
  try {
    await tmdb('/movie/550'); // Fight Club — reliable test
    results.push({ name: 'TMDB', status: 'ok', note: 'Core API — working' });
  } catch (e) {
    results.push({ name: 'TMDB', status: 'error', note: e.message });
  }

  // AniList
  try {
    await aniQuery(`query{Media(id:1){id}}`, {});
    results.push({ name: 'AniList', status: 'ok', note: 'Anime data — working' });
  } catch {
    results.push({ name: 'AniList', status: 'error', note: 'Failed' });
  }

  // OMDb
  if (!OMDB_KEY) {
    results.push({ name: 'OMDb', status: 'missing', note: 'No API key set' });
  } else {
    try {
      const d = await fetchOMDb('tt0137523'); // Fight Club IMDB
      results.push({ name: 'OMDb', status: d ? 'ok' : 'error', note: d ? 'Ratings (IMDb/RT/Metacritic) — working' : 'Key invalid' });
    } catch {
      results.push({ name: 'OMDb', status: 'error', note: 'Request failed' });
    }
  }

  // Fanart.tv
  if (!FANART_KEY) {
    results.push({ name: 'Fanart.tv', status: 'missing', note: 'No API key set' });
  } else {
    try {
      const d = await fetchFanart('550', 'movies');
      results.push({ name: 'Fanart.tv', status: d ? 'ok' : 'error', note: d ? 'Logos & artwork — working' : 'Key invalid' });
    } catch {
      results.push({ name: 'Fanart.tv', status: 'error', note: 'Request failed' });
    }
  }

  // Watchmode
  if (!WATCHMODE_KEY) {
    results.push({ name: 'Watchmode', status: 'missing', note: 'No API key set' });
  } else {
    try {
      const r = await fetch(`https://api.watchmode.com/v1/status/?apiKey=${WATCHMODE_KEY}`);
      results.push({ name: 'Watchmode', status: r.ok ? 'ok' : 'error', note: r.ok ? '"Where to Watch" — working' : 'Key invalid' });
    } catch {
      results.push({ name: 'Watchmode', status: 'error', note: 'Request failed' });
    }
  }

  // Wikidata
  try {
    const r = await fetch('https://www.wikidata.org/wiki/Special:EntityData/Q148.json');
    results.push({ name: 'Wikidata', status: r.ok ? 'ok' : 'error', note: r.ok ? 'Actor extra info — working' : 'Failed' });
  } catch {
    results.push({ name: 'Wikidata', status: 'error', note: 'Request failed' });
  }

  // Wikipedia
  try {
    const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Christopher_Nolan');
    results.push({ name: 'Wikipedia', status: r.ok ? 'ok' : 'error', note: r.ok ? 'Biographies & history — working' : 'Failed' });
  } catch {
    results.push({ name: 'Wikipedia', status: 'error', note: 'Request failed' });
  }

  // Jikan
  try {
    const r = await fetch('https://api.jikan.moe/v4/anime/1/full');
    results.push({ name: 'Jikan (MAL)', status: r.ok ? 'ok' : 'error', note: r.ok ? 'Anime rich data — working' : 'Failed' });
  } catch {
    results.push({ name: 'Jikan (MAL)', status: 'error', note: 'Request failed' });
  }

  // TV-API.com (IMDB-API)
  try {
    const r = await fetch(`${TVAPI_BASE}/Trailer/${TVAPI_KEY}/tt0137523`);
    const d = r.ok ? await r.json() : null;
    results.push({ name: 'TV-API (IMDB)', status: (r.ok && !d?.errorMessage) ? 'ok' : 'error', note: (r.ok && !d?.errorMessage) ? 'Trailers + Awards — working' : (d?.errorMessage || 'Failed') });
  } catch {
    results.push({ name: 'TV-API (IMDB)', status: 'error', note: 'Request failed' });
  }

  // Dailymotion Removed

  // Logo.dev
  try {
    const r = await fetch(`https://img.logo.dev/netflix.com?token=${LOGO_DEV_TOKEN}&size=32&format=png`);
    results.push({ name: 'Logo.dev', status: r.ok ? 'ok' : 'error', note: r.ok ? 'Provider logos — working' : 'Token invalid' });
  } catch {
    results.push({ name: 'Logo.dev', status: 'error', note: 'Request failed' });
  }

  // Wikidata SPARQL
  try {
    const r = await fetch('https://query.wikidata.org/sparql?format=json&query=SELECT%20?x%20WHERE%20{%20?x%20a%20wd:Q5%20}%20LIMIT%201',
      { headers: { Accept: 'application/sparql-results+json' } });
    results.push({ name: 'Wikidata SPARQL', status: r.ok ? 'ok' : 'error', note: r.ok ? 'Awards + franchise chains — working' : 'Failed' });
  } catch {
    results.push({ name: 'Wikidata SPARQL', status: 'error', note: 'Request failed' });
  }

  // Vidsrc-embed feeds
  try {
    const r = await fetch(`${VIDSRC_BASE}/movies/latest/page-1.json`);
    results.push({ name: 'Vidsrc-embed', status: r.ok ? 'ok' : 'error', note: r.ok ? 'Latest movies/shows feed — working' : 'Failed' });
  } catch {
    results.push({ name: 'Vidsrc-embed', status: 'error', note: 'Request failed' });
  }

  // TasteDive
  if (!TASTEDIVE_KEY) {
    results.push({ name: 'TasteDive', status: 'missing', note: 'No key set' });
  } else {
    try {
      const r = await fetch(`https://tastedive.com/api/similar?q=Inception&type=movies&limit=1&k=${TASTEDIVE_KEY}`);
      results.push({ name: 'TasteDive', status: r.ok ? 'ok' : 'error', note: r.ok ? '"More Like This" recs — working' : 'Key invalid' });
    } catch {
      results.push({ name: 'TasteDive', status: 'error', note: 'Request failed' });
    }
  }

  return results;
}
