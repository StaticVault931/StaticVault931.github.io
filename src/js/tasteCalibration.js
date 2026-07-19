import { tmdb, imgUrl, getContentRating } from './api.js';
import { state, persist, mediaKey, setReaction, addDislike, recordTasteSkip, AGE_LEVELS, getActiveTasteState } from './state.js';
import { esc, toast } from './ui.js';
import { recordCalibrationAction } from './stats.js';
import { filterSafeItems, isAnimeContent } from './contentSafety.js';
import { undoManager } from './undoManager.js';

let _openInfo = () => {};
let _pool = [];
let _index = 0;
let _loading = false;
let _sessionSkipped = new Set();
const _shownKeys = new Set();
const _kidsMode = () => {
  try { return !!JSON.parse(localStorage.getItem('sv_settings') || '{}').kidsMode; }
  catch { return false; }
};
const _animePreference = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    return settings.animePreference || (settings.hideAnime ? 'no' : 'neutral');
  } catch { return 'neutral'; }
};

// Deliberately broad starters teach more than another popularity page. The
// first session spans tone, format, era, language, animation, and intensity;
// later sessions become adaptive from the profile's real signals.
const CALIBRATION_STARTERS = [
  ['movie', 862], ['movie', 120], ['movie', 27205], ['movie', 419430],
  ['movie', 496243], ['movie', 313369], ['movie', 546554], ['movie', 129],
  ['tv', 1396], ['tv', 2316], ['tv', 82728], ['tv', 76331],
  ['tv', 94605], ['tv', 67070], ['tv', 66732], ['tv', 1429],
];
const KIDS_STARTERS = [
  ['movie', 862], ['movie', 129], ['movie', 346648], ['movie', 508442],
  ['movie', 10193], ['movie', 354912], ['tv', 82728], ['tv', 60572],
  ['tv', 33765], ['tv', 387], ['tv', 502], ['tv', 15260], ['tv', 246],
];

async function loadCurated(maxLevel, known) {
  const source = maxLevel <= 3 ? KIDS_STARTERS : CALIBRATION_STARTERS;
  const results = await Promise.allSettled(source.map(async ([type, id]) => {
    const item = await tmdb(`/${type}/${id}`, { append_to_response: type === 'tv' ? 'content_ratings' : 'release_dates' });
    const normalized = { ...item, type, media_type: type };
    const rating = getContentRating(item, type);
    const level = AGE_LEVELS[rating];
    if (maxLevel < 5 && (level == null || level > maxLevel)) return null;
    if (known.has(mediaKey(normalized)) || _sessionSkipped.has(mediaKey(normalized))) return null;
    if (!_kidsMode() && window._svSafeItem && !window._svSafeItem(normalized)) return null;
    return normalized;
  }));
  let items = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
  if (_animePreference() === 'no') items = items.filter(item => !isAnimeContent(item));
  if (_kidsMode()) items = await filterSafeItems(items, { kidsMode: true, maxLevel });
  return items;
}

function typeOf(item) {
  return item.media_type === 'tv' ? 'tv' : 'movie';
}

function signaledKeys() {
  const taste = getActiveTasteState();
  return new Set([
    ...(taste.liked || []), ...(taste.disliked || []), ...(_kidsMode() ? [] : state.watched),
    ...(taste.prefLikes || []), ...(taste.prefDislikes || []),
  ].map(mediaKey));
}

async function loadPool(force = false) {
  if (_loading || (_pool.length - _index > 6 && !force)) return;
  _loading = true;
  const host = document.getElementById('taste-calibration-deck');
  if (host && !_pool.length) host.innerHTML = '<div class="taste-cal-loading"><span class="spin"></span><p>Building a varied set of titles...</p></div>';
  try {
    const page = 1 + Math.floor(Math.random() * 8);
    const taste = getActiveTasteState();
    const genres = _kidsMode() ? '10751|16|10762|35|12' : state.prefGenres.slice(0, 3).join('|');
    const maxLevel = _kidsMode()
      ? Math.min(3, AGE_LEVELS[state.ageRating] ?? AGE_LEVELS.PG)
      : (AGE_LEVELS[state.ageRating] ?? AGE_LEVELS.PG);
    const known = signaledKeys();
    const interactionCount = (taste.prefLikes || []).length + (taste.prefDislikes || []).length + Object.keys(taste.tasteSkips || {}).length;
    const maxMovieCert = maxLevel <= 2 ? 'G' : maxLevel === 3 ? 'PG' : maxLevel === 4 ? 'PG-13' : maxLevel === 5 ? 'R' : null;
    const [movies, shows, trending, curated] = await Promise.allSettled([
      tmdb('/discover/movie', { sort_by: 'popularity.desc', page, 'vote_count.gte': 250,
        ...(maxMovieCert ? { certification_country: 'US', 'certification.lte': maxMovieCert } : {}),
        ...(genres ? { with_genres: genres } : {}) }),
      tmdb('/discover/tv', { sort_by: 'popularity.desc', page, 'vote_count.gte': 100, ...(genres ? { with_genres: genres } : {}) }),
      maxLevel >= 5 ? tmdb('/trending/all/week') : Promise.resolve({ results: [] }),
      interactionCount < 12 ? loadCurated(maxLevel, known) : Promise.resolve([]),
    ]);
    const candidates = [];
    const add = (result, fallbackType) => {
      if (result.status !== 'fulfilled') return;
      (result.value.results || []).forEach(item => {
        const media_type = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
        const normalized = { ...item, media_type, type: media_type };
        const key = mediaKey(normalized);
        if (!item.id || item.adult || !item.backdrop_path || known.has(key) || _sessionSkipped.has(key)) return;
        if (!_kidsMode() && window._svSafeItem && !window._svSafeItem(normalized)) return;
        if (!candidates.some(candidate => mediaKey(candidate) === key)) candidates.push(normalized);
      });
    };
    add(movies, 'movie');
    add(shows, 'tv');
    add(trending, 'movie');
    const curatedItems = curated.status === 'fulfilled' ? curated.value : [];
    candidates.sort(() => Math.random() - 0.5);

    // Movie discover supports certification filters. TV discover does not,
    // so verify TV ratings before a restrictive profile can see them.
    let safeCandidates = _animePreference() === 'no'
      ? candidates.filter(item => !isAnimeContent(item))
      : candidates;
    if (_kidsMode()) {
      safeCandidates = await filterSafeItems(safeCandidates, { kidsMode: true, maxLevel });
    } else if (maxLevel < 5) {
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
    const ordered = [...curatedItems, ...safeCandidates].filter((item, index, all) =>
      all.findIndex(other => mediaKey(other) === mediaKey(item)) === index);
    _pool = force ? ordered : [..._pool.slice(_index), ...ordered];
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
    setReaction(compact, action);
  } else if (action === 'dislike') {
    setReaction(compact, 'none');
    const taste = getActiveTasteState();
    taste.prefDislikes.unshift(compact);
    addDislike(compact);
  } else {
    _sessionSkipped.add(key);
    recordTasteSkip(compact);
  }
  _kidsMode() ? persist('kidsTaste') : (persist('prefLikes'), persist('prefDislikes'));
  recordCalibrationAction(action, compact);
}

/* Undo: every rating is reversible — from the toast, the ⌫/Z keys, or the
   on-card control. Undo unwinds the stored signal AND steps the deck back
   so the title is on screen again, ready to be re-rated. (The pool only
   serves unrated titles, so pre-calibration state is always "none".) */
const _history = [];

function undoEntry(last) {
  if (!last) return;
  const historyIndex = _history.indexOf(last);
  if (historyIndex >= 0) _history.splice(historyIndex, 1);
  const key = mediaKey(last.item);
  if (last.action === 'skip') {
    _sessionSkipped.delete(key);
    const taste = getActiveTasteState();
    if (taste.tasteSkips[key]) {
      delete taste.tasteSkips[key];
      _kidsMode() ? persist('kidsTaste') : persist('tasteSkips');
    }
  } else {
    // love/like/dislike all unwind to a clean slate
    setReaction(last.item, 'none');
    persist('prefLikes');
    persist('prefDislikes');
  }
  recordCalibrationAction('undo', last.item);
  _index = Math.max(0, _index - 1);
  renderCard('undo');
  toast('Undone — rate it again', 'undo');
}

function undoLast() {
  const last = _history.at(-1);
  if (!last) return;
  if (last.undoId) undoManager.undo(last.undoId);
  else undoEntry(last);
}

function react(action) {
  const item = current();
  if (!item) return;
  storePreference(item, action);
  const entry = { item, action, undoId: null };
  _history.push(entry);
  if (_history.length > 50) _history.shift();
  const labels = { love: 'Loved', like: 'Liked', dislike: 'Hidden from recommendations', skip: 'Skipped for now' };
  entry.undoId = undoManager.record({
    label: labels[action],
    title: item.title || item.name || '',
    icon: action === 'love' ? 'favorite' : action === 'like' ? 'thumb_up' : action === 'dislike' ? 'thumb_down' : 'skip_next',
    undo: () => undoEntry(entry),
  });
  toast(labels[action], action === 'love' ? 'favorite' : action === 'like' ? 'thumb_up' : action === 'dislike' ? 'thumb_down' : 'skip_next',
    { actionLabel: 'Undo', onAction: () => undoManager.undo(entry.undoId) });
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
  const itemKey = mediaKey(item);
  if (!_shownKeys.has(itemKey)) {
    _shownKeys.add(itemKey);
    recordCalibrationAction('shown', item);
  }
  // Stage layout: the title sits center screen; each compass direction is
  // a live control that doubles as the legend for its key/arrow/swipe.
  host.innerHTML = `
    <article class="taste-cal-card taste-cal-stage ${direction ? `taste-cal-${direction}` : ''}" style="--taste-bg:url('${imgUrl(item.backdrop_path, 'w1280')}')">
      <button type="button" class="taste-cal-info" data-cal-action="info" aria-label="Open details for ${esc(title)}">
        <span class="material-icons-round">info</span><span>Details</span>
      </button>
      ${_history.length ? `<button type="button" class="taste-cal-info taste-cal-undo" data-cal-action="undo" aria-label="Undo last rating (Z or Backspace)">
        <span class="material-icons-round">undo</span><span>Undo</span>
      </button>` : ''}
      <button type="button" class="taste-cal-dir taste-cal-dir-up" data-cal-action="love" aria-label="Love (W or up arrow)">
        <span class="material-icons-round">keyboard_arrow_up</span>
        <span class="taste-cal-dir-face"><span class="material-icons-round">favorite</span><strong>Love</strong></span>
        <kbd>W / ↑</kbd>
      </button>
      <div class="taste-cal-mid">
        <button type="button" class="taste-cal-dir taste-cal-dir-left" data-cal-action="dislike" aria-label="Dislike (A or left arrow)">
          <span class="material-icons-round">keyboard_arrow_left</span>
          <span class="taste-cal-dir-face"><span class="material-icons-round">thumb_down</span><strong>Dislike</strong></span>
          <kbd>A / ←</kbd>
        </button>
        <div class="taste-cal-poster" data-cal-swipe>
          ${item.poster_path ? `<img src="${imgUrl(item.poster_path, 'w500')}" alt="${esc(title)} poster">` : `<span class="material-icons-round">movie</span>`}
        </div>
        <button type="button" class="taste-cal-dir taste-cal-dir-right" data-cal-action="like" aria-label="Like (D or right arrow)">
          <span class="material-icons-round">keyboard_arrow_right</span>
          <span class="taste-cal-dir-face"><span class="material-icons-round">thumb_up</span><strong>Like</strong></span>
          <kbd>D / →</kbd>
        </button>
      </div>
      <button type="button" class="taste-cal-dir taste-cal-dir-down" data-cal-action="skip" aria-label="Skip (S or down arrow)">
        <span class="taste-cal-dir-face"><span class="material-icons-round">skip_next</span><strong>Skip</strong></span>
        <span class="material-icons-round">keyboard_arrow_down</span>
        <kbd>S / ↓</kbd>
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

let _shellAnchor = null;
export function openTasteCalibration() {
  const shell = document.getElementById('taste-calibration-shell');
  if (!shell) return;
  shell.hidden = false;
  // Calibration is a full-screen focus mode, not a strip inside the
  // Library — the shell lifts into a fixed stage until closed. It must
  // ALSO leave its home tab: a display:none ancestor hides fixed elements.
  if (shell.parentElement !== document.body) {
    _shellAnchor = document.createComment('taste-cal-anchor');
    shell.parentElement.insertBefore(_shellAnchor, shell);
    document.body.appendChild(shell);
  }
  shell.classList.add('cal-fullscreen');
  document.body.classList.add('cal-open');
  if (!shell.querySelector('.taste-cal-exit')) {
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'taste-cal-exit';
    exit.setAttribute('aria-label', 'Close taste calibration');
    exit.innerHTML = '<span class="material-icons-round">close</span>';
    exit.addEventListener('click', closeTasteCalibration);
    shell.prepend(exit);
  }
  if (!_pool.length) loadPool(); else renderCard();
}

export function closeTasteCalibration() {
  const shell = document.getElementById('taste-calibration-shell');
  if (!shell) return;
  shell.classList.remove('cal-fullscreen');
  document.body.classList.remove('cal-open');
  shell.hidden = true;
  // Return the shell to its home spot inside the Library tab
  if (_shellAnchor?.parentElement) {
    _shellAnchor.parentElement.insertBefore(shell, _shellAnchor);
    _shellAnchor.remove();
    _shellAnchor = null;
  }
}

export function initTasteCalibration({ openInfo }) {
  _openInfo = openInfo || _openInfo;
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-calibration]')) { openTasteCalibration(); return; }
    const action = event.target.closest('[data-cal-action]')?.dataset.calAction;
    if (!action) return;
    if (action === 'refresh') { _pool = []; _index = 0; loadPool(true); return; }
    if (action === 'info') {
      const item = current();
      if (item) {
        recordCalibrationAction('info', item);
        closeTasteCalibration();
        _openInfo(item.id, typeOf(item));
      }
      return;
    }
    if (action === 'undo') { undoLast(); return; }
    react(action);
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    const shell = document.getElementById('taste-calibration-shell');
    if (!shell || shell.hidden || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'Escape' && shell.classList.contains('cal-fullscreen')) {
      event.preventDefault();
      closeTasteCalibration();
      return;
    }
    if (event.key === ' ' || event.code === 'Space') {
      const item = current();
      if (item) {
        event.preventDefault();
        recordCalibrationAction('info', item);
        closeTasteCalibration();
        _openInfo(item.id, typeOf(item));
      }
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      undoLast();
      return;
    }
    const map = { w: 'love', ArrowUp: 'love', d: 'like', ArrowRight: 'like', a: 'dislike', ArrowLeft: 'dislike', s: 'skip', ArrowDown: 'skip' };
    const action = map[event.key] || map[event.key.toLowerCase?.()];
    if (!action) return;
    event.preventDefault();
    react(action);
  });

  // Touch swipe on the poster — supplementary; buttons and keys stay primary
  let _swipe = null;
  document.addEventListener('pointerdown', event => {
    const zone = event.target.closest('[data-cal-swipe]');
    if (!zone) return;
    _swipe = { x: event.clientX, y: event.clientY };
  });
  document.addEventListener('pointerup', event => {
    if (!_swipe) return;
    const dx = event.clientX - _swipe.x;
    const dy = event.clientY - _swipe.y;
    _swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 60) return;
    const action = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'like' : 'dislike')
      : (dy < 0 ? 'love' : 'skip');
    react(action);
  });
}
