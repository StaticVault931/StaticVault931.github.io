/* ── CONFIG ──────────────────────────────────────────────────────── */
const TMDB_RAT = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkYTczNjY3NzU0NmZjNjc4MjgwYzQ0NmQ4YjU0YjdlYSIsIm5iZiI6MTc4MDE4MzY2NC4xOCwic3ViIjoiNmExYjcyNzAxMDQ5YTMwZjhkN2Y2ZDFlIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.yE8EJHCvta69K2M9ETHG_KvREifHmBV9X4E9vh2-CaE';
export const TMDB_BASE = 'https://api.themoviedb.org/3';
export const IMG = 'https://image.tmdb.org/t/p/';
export const ANILIST = 'https://graphql.anilist.co';

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
  return null; // unknown
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
    genres
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
