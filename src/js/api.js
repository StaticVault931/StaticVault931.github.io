/* ── CONFIG ──────────────────────────────────────────────────────── */
const TMDB_RAT = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkYTczNjY3NzU0NmZjNjc4MjgwYzQ0NmQ4YjU0YjdlYSIsIm5iZiI6MTc4MDE4MzY2NC4xOCwic3ViIjoiNmExYjcyNzAxMDQ5YTMwZjhkN2Y2ZDFlIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.yE8EJHCvta69K2M9ETHG_KvREifHmBV9X4E9vh2-CaE';
export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p/';
export const ANILIST = 'https://graphql.anilist.co';

// ── THIRD-PARTY API KEYS ─────────────────────────────────────────
export const OMDB_KEY      = '9f3c997';
export const FANART_KEY    = 'd665499067a0fb155b3b03c071cfbcba';
export const WATCHMODE_KEY = '8y2t5vgtSGi058Rk1JcI80mOgfANIpQic8zKB1zq';

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
export async function fetchFanart(tmdbId, type = 'movies') {
  if (!FANART_KEY) return null;
  const endpoint = type === 'movies'
    ? `https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${FANART_KEY}`
    : `https://webservice.fanart.tv/v3/tv/${tmdbId}?api_key=${FANART_KEY}`;
  const key = cacheKey('fanart_' + type + '_' + tmdbId, {});
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const r = await fetch(endpoint);
    if (!r.ok) return null;
    const data = await r.json();
    cacheSet(key, data);
    return data;
  } catch { return null; }
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

  return results;
}
