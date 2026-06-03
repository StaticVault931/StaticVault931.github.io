import { state, isLiked, isInWatchlist, getContinue } from './state.js';
import { imgUrl } from './api.js';

/* ── ESCAPE ──────────────────────────────────────────────────────── */
export const esc = s =>
  String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── TOAST ───────────────────────────────────────────────────────── */
let _toastTimer;
export function toast(msg, icon = 'info') {
  clearTimeout(_toastTimer);
  const t = document.getElementById('toast');
  if (!t) return;
  t.querySelector('#ti').textContent = icon;
  t.querySelector('#tm').textContent = msg;
  t.classList.add('on');
  _toastTimer = setTimeout(() => t.classList.remove('on'), 2800);
}

/* ── SKELETON ────────────────────────────────────────────────────── */
export function skelCards(n = 8) {
  return Array(n).fill(`
    <div class="card-sk" aria-hidden="true">
      <div class="csk-poster sk"></div>
      <div class="csk-body">
        <div class="csk-line sk" style="width:78%"></div>
        <div class="csk-line sk" style="width:44%;margin-top:5px"></div>
      </div>
    </div>`).join('');
}

/* ── CARD ────────────────────────────────────────────────────────── */
export function makeCard(m, type, opts = {}) {
  const { numbered, showProgress = true } = opts;

  const title = m.title || m.name || m.romaji || '';
  const id = m.id;
  const year = String(m.release_date || m.first_air_date || m.startDate_year || '').slice(0, 4);
  const rating = m.vote_average
    ? m.vote_average.toFixed(1)
    : m.averageScore
    ? (m.averageScore / 10).toFixed(1)
    : '';

  // Image: prefer backdrop for 16:9 cards, fall back to poster/coverImage
  const backdrop = imgUrl(m.backdrop_path, 'w780');
  const poster = imgUrl(m.poster_path || m.coverImage_large, 'w342');
  const imgSrc = backdrop || poster;

  const likedNow = isLiked(id);
  const wlNow = isInWatchlist(id);
  const contData = showProgress ? getContinue(id) : null;

  const typeLabel = type === 'anime' ? 'Anime' : type === 'tv' ? 'TV' : 'Film';
  const typeClass = type === 'anime' ? 'tp-a' : type === 'tv' ? 'tp-t' : 'tp-m';

  // Badges
  const badges = [];
  if (contData) badges.push(`<span class="card-badge badge-continue">Continue</span>`);
  if (wlNow) badges.push(`<span class="card-badge badge-wl">Saved</span>`);
  if (likedNow) badges.push(`<span class="card-badge badge-liked">Liked</span>`);

  // Progress bar (only if continue watching)
  const progressBar = (contData && contData.progress)
    ? `<div class="card-progress"><div class="card-progress-fill" style="width:${Math.min(100, Math.round(contData.progress * 100))}%"></div></div>`
    : '';

  const numEl = numbered != null
    ? `<div class="card-num">${numbered}</div>`
    : '';

  return `<div class="card"
    data-id="${id}"
    data-type="${type}"
    data-title="${esc(title)}"
    data-poster="${esc(poster || '')}"
    data-backdrop="${esc(m.backdrop_path || '')}"
    role="button"
    tabindex="0"
    aria-label="${esc(title)} (${typeLabel})">
    <div class="card-poster">
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${esc(title)}" loading="lazy">`
        : `<div class="card-poster-ph">
             <span class="material-icons-round">${type === 'anime' ? 'auto_awesome' : type === 'tv' ? 'tv' : 'movie'}</span>
             <span class="card-ph-title">${esc(title)}</span>
           </div>`}
      <div class="type-pill ${typeClass}">${typeLabel}</div>
      ${badges.length ? `<div class="card-badges">${badges.join('')}</div>` : ''}
      ${rating ? `<div class="card-rating"><span class="material-icons-round">star</span>${rating}</div>` : ''}
      <div class="card-ov">
        <div class="card-ov-actions">
          <button class="card-like-btn${likedNow ? ' liked' : ''}" data-action="like" data-id="${id}" data-type="${type}" aria-label="${likedNow ? 'Unlike' : 'Like'}">
            <span class="material-icons-round">${likedNow ? 'favorite' : 'favorite_border'}</span>
          </button>
          <button class="card-wl-btn${wlNow ? ' saved' : ''}" data-action="watchlist" data-id="${id}" data-type="${type}" aria-label="${wlNow ? 'Remove from watchlist' : 'Add to watchlist'}">
            <span class="material-icons-round">${wlNow ? 'bookmark' : 'bookmark_add'}</span>
          </button>
        </div>
      </div>
      ${progressBar}
    </div>
    <div class="card-body">
      <div class="card-title" title="${esc(title)}">${esc(title)}</div>
      <div class="card-sub">
        ${year ? `<span>${year}</span>` : ''}
        ${numEl}
      </div>
    </div>
  </div>`;
}

/* ── ROW RENDER ──────────────────────────────────────────────────── */
export function renderRow(rowId, items, typeOverride, numbered = false) {
  const el = document.getElementById(rowId);
  if (!el) return;
  if (!items || !items.length) { el.innerHTML = ''; return; }

  el.innerHTML = items.map((m, i) => {
    const t = typeOverride || (m.media_type === 'tv' ? 'tv' : m._anime ? 'anime' : 'movie');
    return makeCard(m, t, { numbered: numbered ? i + 1 : undefined });
  }).join('');

  syncRowArrows(el);
  if (!el.dataset.arrowInit) {
    el.dataset.arrowInit = '1';
    el.addEventListener('scroll', () => syncRowArrows(el), { passive: true });
  }
}

function syncRowArrows(row) {
  const id = row.id;
  const lBtn = document.querySelector(`[data-scroll-row="${id}"][data-scroll-dir="-1"]`);
  const rBtn = document.querySelector(`[data-scroll-row="${id}"][data-scroll-dir="1"]`);
  const lArrow = lBtn?.closest('.row-arrow');
  const rArrow = rBtn?.closest('.row-arrow');
  const atStart = row.scrollLeft <= 4;
  const atEnd = row.scrollLeft >= row.scrollWidth - row.clientWidth - 4;
  if (lArrow) lArrow.classList.toggle('hidden', atStart);
  if (rArrow) rArrow.classList.toggle('hidden', atEnd);
}

/* ── SECTION VISIBILITY ──────────────────────────────────────────── */
export function hideSection(secId) {
  const sec = document.getElementById(secId);
  if (sec) sec.style.display = 'none';
}
export function showSection(secId) {
  const sec = document.getElementById(secId);
  if (sec) sec.style.display = '';
}

/* ── HERO ────────────────────────────────────────────────────────── */
export function showHero(idx) {
  const items = state.heroItems;
  if (!items.length) return;
  state.heroIdx = idx;
  const m = items[idx];
  if (!m) return;

  const bg = document.getElementById('hero-bg');
  if (bg) bg.style.backgroundImage = `url(${imgUrl(m.backdrop_path, 'w1280')})`;

  const title = document.getElementById('hero-title');
  if (title) title.textContent = m.title || m.name || '';

  const score = document.getElementById('h-score');
  if (score) {
    if (m.vote_average) {
      score.innerHTML = `<span class="material-icons-round" style="font-size:.68rem">star</span>${m.vote_average.toFixed(1)}`;
      score.style.display = '';
    } else {
      score.style.display = 'none';
    }
  }

  const typePill = document.getElementById('h-type');
  if (typePill) {
    typePill.textContent = m.media_type === 'tv' ? 'TV Show' : 'Movie';
  }

  const desc = document.getElementById('hero-desc');
  if (desc) desc.textContent = m.overview || '';

  document.querySelectorAll('.hdot').forEach((d, j) => d.classList.toggle('on', j === idx));
}

export function buildHeroDots() {
  const dots = document.getElementById('hero-dots');
  if (!dots) return;
  dots.innerHTML = state.heroItems
    .map((_, i) => `<div class="hdot${i === 0 ? ' on' : ''}" data-hero-dot="${i}" role="button" tabindex="0" aria-label="Slide ${i + 1}"></div>`)
    .join('');
}

export function jumpHero(i) {
  clearInterval(state.heroTimer);
  showHero(i);
  state.heroTimer = setInterval(() => {
    showHero((state.heroIdx + 1) % state.heroItems.length);
  }, 10000);
}

/* ── MODAL SKELETON ──────────────────────────────────────────────── */
export function resetModal() {
  const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
  const castSkeletons = Array(8).fill(`<div class="cast-card"><div class="cast-ph sk" style="background:var(--s4)"></div><div class="sk" style="height:8px;margin:.3rem auto 0;width:60%;border-radius:4px;"></div></div>`).join('');
  setHTML('modal-poster', '<div class="modal-ph sk" style="aspect-ratio:2/3;width:100%;border-radius:6px;"></div>');
  setHTML('modal-title', '<div class="sk" style="height:2rem;width:65%;border-radius:5px;"></div>');
  setHTML('modal-tags', '');
  setHTML('modal-actions', '');
  setHTML('modal-ratings', '');
  setHTML('modal-plot', '<div class="sk" style="height:3rem;border-radius:6px;"></div>');
  setHTML('modal-cast-row', castSkeletons);
  setHTML('modal-ep-sidebar', '');
  setHTML('modal-related-section', '');

  const pf = document.getElementById('player-frame');
  if (pf) pf.removeAttribute('src');
  const pl = document.getElementById('player-loading');
  if (pl) { pl.classList.remove('hidden'); pl.innerHTML = `<div class="spin"></div><p>Loading player…</p>`; }
  const aw = document.getElementById('age-warn');
  if (aw) aw.style.display = 'none';
}

/* ── MODAL INFO RENDER ───────────────────────────────────────────── */
export function renderModalInfo(details, type) {
  const title = details.title || details.name || details.romaji || 'Unknown';
  const year = String(details.release_date || details.first_air_date || '').slice(0, 4);
  const rating = details.vote_average;
  const runtime = details.runtime
    ? `${details.runtime}m`
    : details.episode_run_time?.[0]
    ? `~${details.episode_run_time[0]}m/ep`
    : details.number_of_episodes
    ? `${details.number_of_episodes} eps`
    : null;
  const genres = (details.genres || []).slice(0, 4).map(g => g.name || g);

  // Poster
  const posterSrc = imgUrl(details.poster_path, 'w300') || details.coverImage_large;
  const posterEl = document.getElementById('modal-poster');
  if (posterEl) {
    posterEl.innerHTML = posterSrc
      ? `<img src="${posterSrc}" alt="${esc(title)}" style="width:100%;border-radius:8px;">`
      : `<div class="modal-ph"><span class="material-icons-round" style="font-size:2.5rem">${type === 'anime' ? 'auto_awesome' : type === 'tv' ? 'tv' : 'movie'}</span></div>`;
  }

  // Title — clear skeleton, set text
  const titleEl = document.getElementById('modal-title');
  if (titleEl) {
    titleEl.innerHTML = '';
    titleEl.classList.remove('sk');
    titleEl.style.cssText = '';
    titleEl.textContent = title;
  }

  // Tags
  const typeClass = type === 'anime' ? 'a' : type === 'tv' ? 'v' : 's';
  const typeLabel = type === 'anime' ? 'Anime' : type === 'tv' ? 'TV Show' : 'Movie';
  const tags = [
    year ? `<span class="m-tag">${year}</span>` : '',
    rating ? `<span class="m-tag gold"><span class="material-icons-round" style="font-size:.72rem;vertical-align:middle">star</span> ${rating.toFixed(1)}</span>` : '',
    runtime ? `<span class="m-tag">${runtime}</span>` : '',
    `<span class="m-tag ${typeClass}">${typeLabel}</span>`,
    ...genres.map(g => `<span class="m-tag">${esc(g)}</span>`),
    details.status ? `<span class="m-tag muted">${esc(details.status)}</span>` : '',
  ].filter(Boolean).join('');
  const tagsEl = document.getElementById('modal-tags');
  if (tagsEl) tagsEl.innerHTML = tags;

  // Ratings chips
  const rats = [
    rating ? `<div class="r-chip"><div class="rv">${rating.toFixed(1)}</div><div class="rs">${type === 'anime' ? 'AniList' : 'TMDB'}</div></div>` : '',
    details.vote_count ? `<div class="r-chip"><div class="rv">${(details.vote_count / 1000).toFixed(1)}K</div><div class="rs">Votes</div></div>` : '',
    details.number_of_seasons ? `<div class="r-chip"><div class="rv">${details.number_of_seasons}</div><div class="rs">Seasons</div></div>` : '',
    details.popularity ? `<div class="r-chip"><div class="rv">${Math.round(details.popularity).toLocaleString()}</div><div class="rs">Popularity</div></div>` : '',
  ].filter(Boolean).join('');
  const ratsEl = document.getElementById('modal-ratings');
  if (ratsEl) ratsEl.innerHTML = rats;

  // Plot
  const plotEl = document.getElementById('modal-plot');
  if (plotEl) {
    plotEl.textContent = details.overview || '';
    plotEl.classList.remove('exp');
  }
}

/* ── MODAL ACTIONS ───────────────────────────────────────────────── */
export function renderModalActions(media) {
  const { id, type, details } = media;
  const likedNow = isLiked(id);
  const wlNow = isInWatchlist(id);
  const el = document.getElementById('modal-actions');
  if (!el) return;

  const trailerKey = details?.videos?.results?.find(
    v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  )?.key;

  el.innerHTML = `
    <button class="ma primary" data-action="modal-play" aria-label="Play now">
      <span class="material-icons-round">play_arrow</span>Play
    </button>
    ${trailerKey ? `<button class="ma" data-action="modal-trailer" data-key="${trailerKey}" aria-label="Watch trailer">
      <span class="material-icons-round">theaters</span>Trailer
    </button>` : ''}
    <button class="ma${wlNow ? ' saved' : ''}" data-action="modal-watchlist" aria-label="${wlNow ? 'Remove from watchlist' : 'Add to watchlist'}">
      <span class="material-icons-round">${wlNow ? 'bookmark' : 'bookmark_add'}</span>${wlNow ? 'Saved' : 'Save'}
    </button>
    <button class="ma${likedNow ? ' liked' : ''}" data-action="modal-like" aria-label="${likedNow ? 'Unlike' : 'Like'}">
      <span class="material-icons-round">${likedNow ? 'favorite' : 'favorite_border'}</span>${likedNow ? 'Liked' : 'Like'}
    </button>
    <button class="ma" data-action="modal-dislike" aria-label="Dislike">
      <span class="material-icons-round">thumb_down_off_alt</span>Dislike
    </button>
    <button class="ma" data-action="modal-share" aria-label="Share">
      <span class="material-icons-round">share</span>Share
    </button>`;
}

/* ── CAST RENDER ─────────────────────────────────────────────────── */
export function renderCast(credits) {
  const cast = (credits?.cast?.length ? credits.cast : credits?._cast || []).slice(0, 20);
  const el = document.getElementById('modal-cast-row');
  if (!el) return;

  if (!cast.length) {
    el.innerHTML = '<p class="muted-note">No cast data available.</p>';
    return;
  }

  el.innerHTML = cast.map(p => {
    const ph = imgUrl(p.profile_path, 'w185');
    return `<div class="cast-card">
      ${ph
        ? `<img class="cast-img" src="${ph}" alt="${esc(p.name || '')}" loading="lazy">`
        : `<div class="cast-ph"><span class="material-icons-round">person</span></div>`}
      <div class="cast-name" title="${esc(p.name || '')}">${esc(p.name || '')}</div>
      <div class="cast-char" title="${esc(p.character || '')}">${esc(p.character || '')}</div>
    </div>`;
  }).join('');
}

/* ── RELATED RENDER ──────────────────────────────────────────────── */
export function renderRelated(items, type) {
  const el = document.getElementById('modal-related-section');
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<p class="muted-note" style="padding:.5rem">No recommendations available.</p>';
    return;
  }
  const label = type === 'tv' ? 'Similar Shows' : type === 'anime' ? 'Similar Anime' : 'More Like This';
  el.innerHTML = `
    <div class="section-label" style="margin-bottom:.6rem">${label}</div>
    <div class="related-grid">${items.slice(0, 12).map(m => makeCard(m, type, {})).join('')}</div>`;
}

/* ── ROW SCROLL ARROWS ───────────────────────────────────────────── */
export function scrollRow(rowId, dir) {
  const row = document.getElementById('row-' + rowId);
  if (!row) return;
  row.scrollBy({ left: dir * (row.clientWidth * 0.85), behavior: 'smooth' });
}

/* ── GENRE CHIPS ─────────────────────────────────────────────────── */
export function buildGenreChips(containerId, genres, onClick, selectedIds = []) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = genres.map(g =>
    `<div class="genre-chip${selectedIds.includes(g.id) ? ' on' : ''}"
      data-genre-id="${g.id}"
      data-genre-name="${esc(g.name)}"
      role="button"
      tabindex="0">
      <span class="material-icons-round">${g.icon}</span>${g.name}
    </div>`
  ).join('');

  el.querySelectorAll('.genre-chip').forEach(chip => {
    chip.addEventListener('click', () => onClick(+chip.dataset.genreId, chip.dataset.genreName, chip));
    chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(+chip.dataset.genreId, chip.dataset.genreName, chip); } });
  });
}

/* ── CONFIRM DIALOG ──────────────────────────────────────────────── */
export function showConfirm(title, msg) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-msg');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!overlay) { resolve(false); return; }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    overlay.classList.add('open');

    function cleanup(result) {
      overlay.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay(e) { if (e.target === overlay) cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}

/* ── EMPTY STATE ─────────────────────────────────────────────────── */
export function emptyState(icon, message, actions = []) {
  return `<div class="empty-state">
    <span class="material-icons-round">${icon}</span>
    <p>${message}</p>
    ${actions.map(a => `<button class="empty-action" data-action="${a.action}">${a.label}</button>`).join('')}
  </div>`;
}
