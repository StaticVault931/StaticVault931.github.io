import { tmdb, imgUrl, getContentRating } from './api.js';
import { state, persist, mediaKey, toggleLike, addDislike, AGE_LEVELS } from './state.js';
import { esc, toast } from './ui.js';

let _openInfo = () => {};
let _pool = [];
let _index = 0;
let _loading = false;
let _sessionSkipped = new Set();

function typeOf(item) {
  return item.media_type === 'tv' ? 'tv' : 'movie';
}

function signaledKeys() {
  return new Set([
    ...state.liked, ...state.disliked, ...state.watched,
    ...state.prefLikes, ...state.prefDislikes,
  ].map(mediaKey));
}

async function loadPool(force = false) {
  if (_loading || (_pool.length - _index > 6 && !force)) return;
  _loading = true;
  const host = document.getElementById('taste-calibration-deck');
  if (host && !_pool.length) host.innerHTML = '<div class="taste-cal-loading"><span class="spin"></span><p>Building a varied set of titles...</p></div>';
  try {
    const page = 1 + Math.floor(Math.random() * 8);
    const genres = state.prefGenres.slice(0, 3).join('|');
    const maxLevel = AGE_LEVELS[state.ageRating] ?? AGE_LEVELS.PG;
    const maxMovieCert = maxLevel <= 2 ? 'G' : maxLevel === 3 ? 'PG' : maxLevel === 4 ? 'PG-13' : maxLevel === 5 ? 'R' : null;
    const [movies, shows, trending] = await Promise.allSettled([
      tmdb('/discover/movie', { sort_by: 'popularity.desc', page, 'vote_count.gte': 250,
        ...(maxMovieCert ? { certification_country: 'US', 'certification.lte': maxMovieCert } : {}),
        ...(genres ? { with_genres: genres } : {}) }),
      tmdb('/discover/tv', { sort_by: 'popularity.desc', page, 'vote_count.gte': 100, ...(genres ? { with_genres: genres } : {}) }),
      maxLevel >= 5 ? tmdb('/trending/all/week') : Promise.resolve({ results: [] }),
    ]);
    const known = signaledKeys();
    const candidates = [];
    const add = (result, fallbackType) => {
      if (result.status !== 'fulfilled') return;
      (result.value.results || []).forEach(item => {
        const media_type = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
        const normalized = { ...item, media_type, type: media_type };
        const key = mediaKey(normalized);
        if (!item.id || item.adult || !item.backdrop_path || known.has(key) || _sessionSkipped.has(key)) return;
        if (window._svSafeItem && !window._svSafeItem(normalized)) return;
        if (!candidates.some(candidate => mediaKey(candidate) === key)) candidates.push(normalized);
      });
    };
    add(movies, 'movie');
    add(shows, 'tv');
    add(trending, 'movie');
    candidates.sort(() => Math.random() - 0.5);

    // Movie discover supports certification filters. TV discover does not,
    // so verify TV ratings before a restrictive profile can see them.
    let safeCandidates = candidates;
    if (maxLevel < 5) {
      const checked = [];
      for (let start = 0; start < candidates.length && checked.length < 18; start += 5) {
        const batch = candidates.slice(start, start + 5);
        const ratings = await Promise.allSettled(batch.map(async item => {
          if (typeOf(item) === 'movie') return item;
          const details = await tmdb(`/tv/${item.id}`, { append_to_response: 'content_ratings' });
          const rating = getContentRating(details, 'tv');
          const level = AGE_LEVELS[rating];
          return level != null && level <= maxLevel ? { ...item, ...details, media_type: 'tv', type: 'tv' } : null;
        }));
        ratings.forEach(result => { if (result.status === 'fulfilled' && result.value) checked.push(result.value); });
      }
      safeCandidates = checked;
    }
    _pool = force ? safeCandidates : [..._pool.slice(_index), ...safeCandidates];
    _index = 0;
  } catch (error) {
    console.warn('[SV Taste] calibration load failed', error?.message || error);
  } finally {
    _loading = false;
    renderCard();
  }
}

function current() {
  return _pool[_index] || null;
}

function storePreference(item, action) {
  const key = mediaKey(item);
  const remove = list => list.filter(entry => mediaKey(entry) !== key);
  state.prefLikes = remove(state.prefLikes);
  state.prefDislikes = remove(state.prefDislikes);
  state.disliked = remove(state.disliked);

  const compact = {
    id: item.id,
    type: typeOf(item),
    media_type: typeOf(item),
    title: item.title || item.name || '',
    poster_path: item.poster_path || null,
    backdrop_path: item.backdrop_path || null,
    genre_ids: item.genre_ids || [],
    original_language: item.original_language || '',
    score: action === 'love' ? 2 : 1,
  };
  if (action === 'love' || action === 'like') {
    state.prefLikes.unshift(compact);
    if (!state.liked.some(entry => mediaKey(entry) === key)) toggleLike(compact);
  } else if (action === 'dislike') {
    state.liked = remove(state.liked);
    persist('liked');
    state.prefDislikes.unshift(compact);
    addDislike(compact);
  } else {
    _sessionSkipped.add(key);
  }
  persist('prefLikes');
  persist('prefDislikes');
}

function react(action) {
  const item = current();
  if (!item) return;
  storePreference(item, action);
  const labels = { love: 'Loved', like: 'Liked', dislike: 'Hidden from recommendations', skip: 'Skipped for now' };
  toast(labels[action], action === 'love' ? 'favorite' : action === 'like' ? 'thumb_up' : action === 'dislike' ? 'thumb_down' : 'skip_next');
  _index++;
  renderCard(action);
  if (_pool.length - _index < 5) loadPool();
}

function renderCard(direction = '') {
  const host = document.getElementById('taste-calibration-deck');
  if (!host) return;
  const item = current();
  if (!item) {
    host.innerHTML = `<div class="taste-cal-empty"><span class="material-icons-round">auto_awesome</span><h3>Your taste profile is caught up</h3><p>Refresh for another varied set when you want to tune it further.</p><button type="button" data-cal-action="refresh">Load more titles</button></div>`;
    return;
  }
  const title = item.title || item.name || 'Untitled';
  const year = String(item.release_date || item.first_air_date || '').slice(0, 4);
  const overview = (item.overview || 'Open the title for more information.').trim();
  host.innerHTML = `
    <article class="taste-cal-card ${direction ? `taste-cal-${direction}` : ''}" style="--taste-bg:url('${imgUrl(item.backdrop_path, 'w1280')}')">
      <button type="button" class="taste-cal-info" data-cal-action="info" aria-label="Open details for ${esc(title)}">
        <span class="material-icons-round">info</span><span>Details</span>
      </button>
      <div class="taste-cal-copy">
        <div class="taste-cal-kicker">${typeOf(item) === 'tv' ? 'TV show' : 'Movie'}${year ? ` | ${year}` : ''}${item.vote_average ? ` | ${item.vote_average.toFixed(1)} rating` : ''}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(overview)}</p>
      </div>
      <div class="taste-cal-actions" aria-label="Rate this title">
        <button type="button" data-cal-action="dislike"><kbd>A</kbd><span class="material-icons-round">thumb_down</span><strong>Dislike</strong></button>
        <button type="button" data-cal-action="skip"><kbd>S</kbd><span class="material-icons-round">skip_next</span><strong>Skip</strong></button>
        <button type="button" data-cal-action="like"><kbd>D</kbd><span class="material-icons-round">thumb_up</span><strong>Like</strong></button>
        <button type="button" data-cal-action="love" class="primary"><kbd>W</kbd><span class="material-icons-round">favorite</span><strong>Love</strong></button>
      </div>
    </article>`;
}

export function openTasteCalibration() {
  const shell = document.getElementById('taste-calibration-shell');
  if (!shell) return;
  shell.hidden = false;
  shell.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (!_pool.length) loadPool(); else renderCard();
}

export function initTasteCalibration({ openInfo }) {
  _openInfo = openInfo || _openInfo;
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-calibration]')) { openTasteCalibration(); return; }
    const action = event.target.closest('[data-cal-action]')?.dataset.calAction;
    if (!action) return;
    if (action === 'refresh') { _pool = []; _index = 0; loadPool(true); return; }
    if (action === 'info') { const item = current(); if (item) _openInfo(item.id, typeOf(item)); return; }
    react(action);
  });
  document.addEventListener('keydown', event => {
    const shell = document.getElementById('taste-calibration-shell');
    if (!shell || shell.hidden || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    const map = { w: 'love', ArrowUp: 'love', d: 'like', ArrowRight: 'like', a: 'dislike', ArrowLeft: 'dislike', s: 'skip', ArrowDown: 'skip' };
    const action = map[event.key] || map[event.key.toLowerCase?.()];
    if (!action) return;
    event.preventDefault();
    react(action);
  });
}
