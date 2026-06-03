import { state } from './state.js';
import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, renderRow, skelCards, hideSection, showSection } from './ui.js';

/* ── MAIN FOR YOU ROW ────────────────────────────────────────────── */
export async function loadForYou() {
  const rowEl = document.getElementById('row-foryou');
  if (!rowEl) return;
  rowEl.innerHTML = skelCards(8);

  try {
    let items = [];
    const dislikedIds = new Set(state.disliked.map(x => x.id));

    // Start from preferred genres or popular genres
    const genreIds = state.prefGenres.length
      ? state.prefGenres.slice(0, 3).join('|')
      : '28|35|18|878|12';

    const [discoverRes, trendRes] = await Promise.allSettled([
      tmdb('/discover/movie', { sort_by: 'popularity.desc', with_genres: genreIds }),
      tmdb('/trending/all/week'),
    ]);

    const discover = discoverRes.status === 'fulfilled' ? discoverRes.value.results || [] : [];
    const trend = trendRes.status === 'fulfilled' ? trendRes.value.results || [] : [];

    // Merge, prefer liked items, remove disliked
    const seen = new Set();
    const merged = [...discover, ...trend].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return !dislikedIds.has(m.id);
    });

    // Boost items whose genres match preferred genres
    if (state.prefGenres.length) {
      merged.sort((a, b) => {
        const aMatch = (a.genre_ids || []).filter(g => state.prefGenres.includes(g)).length;
        const bMatch = (b.genre_ids || []).filter(g => state.prefGenres.includes(g)).length;
        return bMatch - aMatch;
      });
    }

    items = merged.slice(0, 16);

    if (!items.length) {
      rowEl.innerHTML = '<p class="muted-note" style="padding:1rem">Adjust your preferences for better recommendations.</p>';
      return;
    }
    renderRow('row-foryou', items, null);
  } catch (e) {
    rowEl.innerHTML = '<p class="muted-note" style="padding:1rem">Could not load recommendations.</p>';
  }
}

/* ── BECAUSE YOU LIKED rows ──────────────────────────────────────── */
export async function loadBecauseYouLiked() {
  // Collect candidates: prefLikes first, then top liked items
  const candidates = [
    ...state.prefLikes.filter(x => x.id && x.type !== 'anime'),
    ...state.liked.filter(x => x.id && x.type !== 'anime').slice(0, 5),
  ];

  // Dedupe by id
  const seen = new Set();
  const unique = candidates.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });

  // Use top 3
  const picks = unique.slice(0, 3);

  for (const item of picks) {
    const secId = `sec-because-${item.id}`;
    const rowId = `row-because-${item.id}`;

    // Create the section if it doesn't exist
    let sec = document.getElementById(secId);
    if (!sec) {
      sec = document.createElement('div');
      sec.className = 'section';
      sec.id = secId;
      sec.innerHTML = `
        <div class="sec-header">
          <div class="sec-title">
            <span class="material-icons-round sec-icon" style="color:var(--red)">favorite</span>
            Because you liked <em>${item.title || 'this'}</em>
          </div>
        </div>
        <div class="row-wrap">
          <div class="row-arrow row-arrow-l" data-row="${rowId}">
            <button data-scroll-row="${rowId}" data-scroll-dir="-1" aria-label="Scroll left">
              <span class="material-icons-round">chevron_left</span>
            </button>
          </div>
          <div class="card-row" id="${rowId}"></div>
          <div class="row-arrow row-arrow-r" data-row="${rowId}">
            <button data-scroll-row="${rowId}" data-scroll-dir="1" aria-label="Scroll right">
              <span class="material-icons-round">chevron_right</span>
            </button>
          </div>
        </div>`;

      // Insert after For You section
      const forYou = document.getElementById('sec-foryou');
      if (forYou && forYou.parentNode) {
        forYou.parentNode.insertBefore(sec, forYou.nextSibling);
      } else {
        const home = document.getElementById('page-home');
        if (home) home.appendChild(sec);
      }
    }

    const rowEl = document.getElementById(rowId);
    if (!rowEl) continue;
    rowEl.innerHTML = skelCards(8);

    try {
      const type = item.type || 'movie';
      const d = await tmdb(`/${type}/${item.id}/recommendations`);
      const results = (d.results || [])
        .filter(m => !state.disliked.some(d => d.id === m.id))
        .slice(0, 14);

      if (!results.length) {
        sec.style.display = 'none';
      } else {
        renderRow(rowId, results, type);
      }
    } catch {
      sec.style.display = 'none';
    }
  }
}

/* ── GENRE ROW ───────────────────────────────────────────────────── */
export async function loadGenreRow(genreId, genreName) {
  const rowEl = document.getElementById('genre-results-row');
  const sec = document.getElementById('genre-results-section');
  const titleEl = document.getElementById('genre-results-title');
  if (!rowEl || !sec) return;

  sec.style.display = '';
  if (titleEl) titleEl.textContent = genreName;
  rowEl.innerHTML = skelCards(10);
  sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const p = { with_genres: genreId, sort_by: 'popularity.desc' };
    const [mv, tv] = await Promise.allSettled([
      tmdb('/discover/movie', p),
      tmdb('/discover/tv', p),
    ]);

    const all = [
      ...(mv.status === 'fulfilled' ? (mv.value.results || []).map(x => ({ ...x, _t: 'movie' })) : []),
      ...(tv.status === 'fulfilled' ? (tv.value.results || []).map(x => ({ ...x, _t: 'tv' })) : []),
    ];
    all.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    if (!all.length) { sec.style.display = 'none'; return; }
    rowEl.innerHTML = all.slice(0, 20).map(m => makeCard(m, m._t)).join('');
  } catch {
    rowEl.innerHTML = '<p class="muted-note" style="padding:1rem">Could not load genre results.</p>';
  }
}
