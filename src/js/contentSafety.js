import { tmdb, fetchOMDb, getContentRating } from './api.js';

const ALLOWED_FAMILY = new Set(['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG']);
const LEVEL = new Map([
  ['TV-Y', 0], ['TV-Y7', 1], ['G', 2], ['TV-G', 2],
  ['PG', 3], ['TV-PG', 3], ['PG-13', 4], ['TV-14', 4],
  ['R', 5], ['TV-MA', 5], ['NC-17', 6],
]);
const CACHE_KEY = 'sv_content_safety_v1';
const CACHE_TTL = 30 * 86400000;
const MAX_CACHE = 1200;
const MAX_CONCURRENCY = 4;

let active = 0;
const waiting = [];
const inFlight = new Map();

function mediaType(item, fallback = 'movie') {
  const type = item?.type || item?.media_type || (item?._anime ? 'anime' : fallback);
  return type === 'anime' ? 'tv' : (type === 'tv' ? 'tv' : 'movie');
}

function cacheRead() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function cacheGet(key) {
  const rec = cacheRead()[key];
  return rec && Date.now() - rec.checkedAt < CACHE_TTL ? rec : null;
}

function cacheSet(key, value) {
  try {
    const cache = cacheRead();
    cache[key] = value;
    const entries = Object.entries(cache).sort((a, b) => b[1].checkedAt - a[1].checkedAt).slice(0, MAX_CACHE);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

async function withSlot(fn) {
  if (active >= MAX_CONCURRENCY) await new Promise(resolve => waiting.push(resolve));
  active++;
  try { return await fn(); }
  finally {
    active--;
    waiting.shift()?.();
  }
}

export function normalizeCertification(value) {
  const rating = String(value || '').trim().toUpperCase().replace(/^RATED\s+/, '');
  if (!rating || rating === 'N/A' || rating === 'NR' || rating === 'UNRATED' || !LEVEL.has(rating)) return null;
  return rating;
}

export function isAnimeContent(item) {
  if (!item) return false;
  if (item._anime || item._type === 'anime' || item.type === 'anime' || item.media_type === 'anime') return true;
  const genres = (item.genre_ids || item.genres || []).map(genre => Number(genre?.id ?? genre));
  return item.original_language === 'ja' && genres.includes(16);
}

export function evaluateCertifications(ratings = [], { kidsMode = false, maxLevel = 3 } = {}) {
  const known = [...new Set(ratings.map(normalizeCertification).filter(Boolean))];
  if (!known.length) return { allowed: !kidsMode, verified: false, rating: null, source: null, reason: 'unknown-rating' };
  const rating = known.sort((a, b) => LEVEL.get(b) - LEVEL.get(a))[0];
  const level = LEVEL.get(rating);
  const allowed = kidsMode ? ALLOWED_FAMILY.has(rating) && level <= maxLevel : level <= maxLevel;
  return { allowed, verified: true, rating, source: null, reason: allowed ? 'verified' : 'above-limit' };
}

export async function resolveContentSafety(item, context = {}) {
  const kidsMode = !!context.kidsMode;
  const requestedLevel = Number.isFinite(context.maxLevel) ? context.maxLevel : (kidsMode ? 3 : 6);
  const maxLevel = kidsMode ? Math.min(requestedLevel, 3) : requestedLevel;
  if (!item?.id || item.adult) {
    return { allowed: false, verified: !!item?.adult, rating: null, source: item?.adult ? 'TMDB' : null, reason: item?.adult ? 'adult-flag' : 'invalid-item' };
  }
  if (!kidsMode && !context.requireRating) {
    const inline = evaluateCertifications([item.certification, item.content_rating, item.rated], { maxLevel });
    return inline.verified ? { ...inline, source: item._ratingSource || 'inline' } : { allowed: true, verified: false, rating: null, source: null, reason: 'not-required' };
  }

  const type = mediaType(item);
  const key = `${type}:${Number(item.id)}`;
  const applyContext = record => {
    const evaluated = evaluateCertifications([record?.rating], { kidsMode, maxLevel });
    return { ...evaluated, source: record?.source || null, checkedAt: record?.checkedAt || Date.now() };
  };
  const cached = cacheGet(key);
  if (cached) return applyContext(cached);
  if (inFlight.has(key)) return applyContext(await inFlight.get(key));

  const task = withSlot(async () => {
    const ratings = [];
    const sources = [];
    try {
      const details = await tmdb(`/${type}/${item.id}`, {
        append_to_response: type === 'movie' ? 'release_dates,external_ids' : 'content_ratings,external_ids',
      });
      const tmdbRating = normalizeCertification(getContentRating(details, type));
      if (tmdbRating) { ratings.push(tmdbRating); sources.push('TMDB'); }
      const imdbId = details?.external_ids?.imdb_id;
      if (imdbId) {
        const omdb = await fetchOMDb(imdbId);
        const omdbRating = normalizeCertification(omdb?.Rated);
        if (omdbRating) { ratings.push(omdbRating); sources.push('OMDb'); }
      }
    } catch {}
    const strictest = evaluateCertifications(ratings, { kidsMode: false, maxLevel: 6 });
    const evidence = { rating: strictest.rating, source: sources.join(' + ') || null, checkedAt: Date.now() };
    cacheSet(key, evidence);
    return evidence;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return applyContext(await task);
}

export async function filterSafeItems(items, context = {}) {
  if (!context.kidsMode && !context.requireRating) return (items || []).filter(item => item?.id && !item.adult);
  const checks = await Promise.all((items || []).map(async item => ({ item, result: await resolveContentSafety(item, context) })));
  return checks.filter(entry => entry.result.allowed).map(entry => ({
    ...entry.item,
    certification: entry.result.rating,
    _ratingSource: entry.result.source,
    _safetyVerified: true,
  }));
}

export function clearContentSafetyCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
  inFlight.clear();
}
