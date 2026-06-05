import { state, AGE_LEVELS, getImpressionPenalty } from './state.js';
import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, renderRow, skelCards, hideSection, showSection } from './ui.js';

// Map TMDB vote_average to approximate age threshold (rough heuristic)
// This supplements the full certification check done in openMedia
function passesAgeFilter(m) {
  const maxLevel = AGE_LEVELS[state.ageRating] ?? 2;
  // If user is set to G (level 0), be strict: only very family-friendly
  // For PG (1) or PG-13 (2), allow most content
  // This is a soft filter — full cert check happens at play time
  if (maxLevel <= 0 && (m.adult || (m.vote_average && m.vote_average < 5))) return false;
  if (m.adult && maxLevel < 4) return false;
  return true;
}

/* ── MAIN FOR YOU ROW ────────────────────────────────────────────── */
export async function loadForYou() {
  const rowEl = document.getElementById('row-foryou');
  if (!rowEl) return;
  rowEl.innerHTML = skelCards(8);

  try {
    const dislikedIds = new Set(state.disliked.map(x => x.id));
    const likedIds = new Set([...state.liked, ...state.prefLikes].map(x => x.id));

    const genreIds = state.prefGenres.length
      ? state.prefGenres.slice(0, 4).join('|')
      : '28|35|18|878|12';

    // Fetch liked-item recommendations + genre discover + trending in parallel
    const candidates = [
      ...state.prefLikes.filter(x => x.id && x.type !== 'anime').slice(0, 2),
      ...state.liked.filter(x => x.id && x.type !== 'anime').slice(0, 2),
    ];
    const dedupedCandidates = candidates.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i).slice(0, 3);

    const recRequests = dedupedCandidates.map(item =>
      tmdb(`/${item.type || 'movie'}/${item.id}/recommendations`).catch(() => ({ results: [] }))
    );

    // Use random page offset if feed randomize was requested
    const randomPage = state._randomPage || 1;

    // Build tag-based params
    const likedTagIds  = (state.prefTagLikes  || []).map(t => t.id).join('|');
    const dislikedTagIds = (state.prefTagDislikes || []).map(t => t.id).join(',');
    const tagMovieParams = { sort_by: 'popularity.desc', page: randomPage,
      ...(likedTagIds    ? { with_keywords: likedTagIds }    : { with_genres: genreIds }),
      ...(dislikedTagIds ? { without_keywords: dislikedTagIds } : {}),
    };
    const tagTvParams = { ...tagMovieParams };

    const [discoverRes, discoverTvRes, tagMovieRes, tagTvRes, ...recResults] = await Promise.allSettled([
      tmdb('/discover/movie', { sort_by: 'popularity.desc', with_genres: genreIds, page: randomPage }),
      tmdb('/discover/tv', { sort_by: 'popularity.desc', with_genres: genreIds, page: randomPage }),
      likedTagIds ? tmdb('/discover/movie', tagMovieParams) : Promise.resolve({ results: [] }),
      likedTagIds ? tmdb('/discover/tv',    tagTvParams)   : Promise.resolve({ results: [] }),
      ...recRequests,
    ]);

    const discover   = discoverRes.status === 'fulfilled'   ? discoverRes.value.results || [] : [];
    const discoverTv = discoverTvRes.status === 'fulfilled'
      ? (discoverTvRes.value.results || []).map(x => ({ ...x, media_type: 'tv' }))
      : [];
    const tagMovies = tagMovieRes.status === 'fulfilled'
      ? (tagMovieRes.value.results || []).map(x => ({ ...x, _tagMatch: true }))
      : [];
    const tagShows = tagTvRes.status === 'fulfilled'
      ? (tagTvRes.value.results || []).map(x => ({ ...x, media_type: 'tv', _tagMatch: true }))
      : [];
    const recItems = recResults.flatMap(r => r.status === 'fulfilled' ? r.value.results || [] : []);
    const dislikedTagIdSet = new Set((state.prefTagDislikes || []).map(t => t.id));

    // IDs currently shown in Trending row — exclude to avoid repeats
    const trendingRowIds = new Set(
      Array.from(document.querySelectorAll('#row-trending [data-id]')).map(el => +el.dataset.id)
    );
    const recentIds = new Set(state.recentlyViewed.map(x => x.id));

    // Score: recommendation hit = 3pts, genre match = 1pt each
    const recIdCounts = {};
    recItems.forEach(m => { recIdCounts[m.id] = (recIdCounts[m.id] || 0) + 3; });

    const watchedIds = new Set(state.watched.map(x => x.id));
    const seen = new Set();
    const tolerance = state._repeatTolerance || 'medium';
    const pool = [...tagMovies, ...tagShows, ...recItems, ...discover, ...discoverTv].filter(m => {
      if (!m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      if (!passesAgeFilter(m)) return false;
      if (dislikedIds.has(m.id) || likedIds.has(m.id) || trendingRowIds.has(m.id) || recentIds.has(m.id) || watchedIds.has(m.id)) return false;
      // Apply impression filter to For You row too
      const imp = state.impressions?.[m.id];
      if (imp?.count) {
        const hoursSince = (Date.now() - imp.lastSeen) / 3600000;
        if (tolerance === 'maximum' && imp.count >= 2 && hoursSince < 96) return false;
        if (tolerance === 'medium' && imp.count >= 4 && hoursSince < 24) return false;
      }
      return true;
    });

    pool.sort((a, b) => {
      const score = m => {
        let s = recIdCounts[m.id] || 0;
        if (state.prefGenres.length)
          s += (m.genre_ids || []).filter(g => state.prefGenres.includes(g)).length;
        s += ((m.vote_average || 0) / 20);
        if (m._tagMatch) s += 4; // big boost for items from liked-tag discover
        s -= getImpressionPenalty(m.id); // subtract penalty for over-shown content
        return s;
      };
      return score(b) - score(a);
    });

    // Inject 20-25% outside-preference content for discovery
    const inPref = pool.filter(m => (m.genre_ids || []).some(g => state.prefGenres.includes(g)));
    const outPref = pool.filter(m => !inPref.includes(m));
    const totalWanted = 18;
    const mixCount = Math.floor(totalWanted * 0.25);
    const inPrefItems = inPref.slice(0, totalWanted - mixCount);
    const outPrefItems = outPref.slice(0, mixCount);
    // Slight shuffle to intersperse discovery content
    const mixed = [...inPrefItems, ...outPrefItems].sort(() => Math.random() - 0.3);
    const items = mixed.slice(0, totalWanted);

    if (!items.length) {
      // Hard fallback: if pool was empty, just show highly-rated popular content
      // This ensures For You is never blank
      const fallback = await tmdb('/movie/top_rated', { page: Math.floor(Math.random() * 3) + 1 });
      const fallbackItems = (fallback.results || []).slice(0, 18);
      if (fallbackItems.length) {
        renderRow('row-foryou', fallbackItems, null);
        return;
      }
      rowEl.innerHTML = '<p class="muted-note" style="padding:1rem">Check back soon — we\'re building your recommendations.</p>';
      return;
    }

    // If pool is smaller than desired, pad with trending content
    if (items.length < 8) {
      try {
        const extra = await tmdb('/trending/movie/week');
        const extraItems = (extra.results || [])
          .filter(m => !items.some(x => x.id === m.id))
          .slice(0, 18 - items.length);
        items.push(...extraItems);
      } catch {}
    }

    renderRow('row-foryou', items, null);
  } catch {
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
          <div class="row-arrow row-arrow-l hidden" data-row="${rowId}">
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

      // Scatter "Because You Liked" rows throughout the page (not all next to each other)
      // Target anchor sections to insert after (spaced out through the page)
      const anchors = ['sec-new', 'sec-action', 'sec-drama', 'sec-scifi'];
      const anchorIdx = picks.indexOf(item);
      const anchorId = anchors[anchorIdx % anchors.length];
      const anchor = document.getElementById(anchorId);
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      } else {
        const forYou = document.getElementById('sec-foryou');
        if (forYou && forYou.parentNode) {
          forYou.parentNode.insertBefore(sec, forYou.nextSibling);
        } else {
          const home = document.getElementById('page-home');
          if (home) home.appendChild(sec);
        }
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
