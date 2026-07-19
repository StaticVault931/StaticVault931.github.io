import { state, AGE_LEVELS, getImpressionPenalty, getTasteScore, mediaKey, getActiveTasteState } from './state.js';
import { tmdb, aniQuery, normalizeAnime } from './api.js';
import { makeCard, renderRow, skelCards, hideSection, showSection, esc } from './ui.js';
import { filterSafeItems, isAnimeContent } from './contentSafety.js';

/* Shared between the title-referencing rows ("Because you liked X",
   "Because you watched X", "More Like X") so the SAME title never anchors
   two rows — each row must reference a different title. */
const _usedTitleIds = new Set();

/* Reset per home rebuild — otherwise anchors from the previous feed load
   stay "used" forever and rows come up empty until a full page reload. */
export function resetTitleRowAnchors() { _usedTitleIds.clear(); }

/* Claim items against the global home-page registry (app.js) so no title
   repeats across rows. Falls back to a plain slice if app.js isn't ready. */
const _claim = (items, cap = 14) =>
  window._svClaimHomeItems ? window._svClaimHomeItems(items, cap) : (items || []).slice(0, cap);

/* Day seed for occasional rows — title-referencing rows shouldn't ALL show
   every day. Each family takes turns so the home page feels different. */
const _daySeed = Math.floor(Date.now() / 86400000);
const _kidsMode = () => {
  try { return !!JSON.parse(localStorage.getItem('sv_settings') || '{}').kidsMode; }
  catch { return false; }
};
const _kidsMaxLevel = () => Math.min(3, AGE_LEVELS[state.ageRating] ?? 3);
const _animePreference = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    return settings.animePreference || (settings.hideAnime ? 'no' : 'neutral');
  } catch { return 'neutral'; }
};
const _verified = async items => {
  let filtered = items || [];
  if (_animePreference() === 'no') filtered = filtered.filter(item => !isAnimeContent(item));
  return _kidsMode() ? filterSafeItems(filtered, { kidsMode: true, maxLevel: _kidsMaxLevel() }) : filtered;
};

const _franchiseStem = item => String(item?.title || item?.name || '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\b(the|a|an|part|chapter|season|volume|vol)\b/g, ' ')
  .replace(/\b\d+\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .slice(0, 3)
  .join(' ');

/**
 * Keeps the scorer's order intact while spacing exploration, primary genres,
 * and obvious sequels. This is deterministic so the same profile does not see
 * a different For You order every time the page re-renders.
 */
export function blendRecommendationCandidates(primary = [], exploration = [], limit = 18) {
  const queues = [primary.slice(), exploration.slice()];
  const output = [];

  const takeBest = queue => {
    if (!queue.length) return null;
    const recent = output.slice(-2);
    const recentGenres = new Set(recent.map(item => item.genre_ids?.[0]).filter(Boolean));
    const previousStem = _franchiseStem(output.at(-1));
    const preferredIndex = queue.findIndex(item => {
      const genre = item.genre_ids?.[0];
      const stem = _franchiseStem(item);
      return (!genre || !recentGenres.has(genre)) && (!stem || stem !== previousStem);
    });
    return queue.splice(preferredIndex >= 0 ? preferredIndex : 0, 1)[0];
  };

  while (output.length < limit && (queues[0].length || queues[1].length)) {
    // Reserve roughly every fourth position for discovery without moving a
    // weak exploration result ahead of the first few high-confidence matches.
    const wantsExploration = output.length >= 3 && (output.length + 1) % 4 === 0;
    const preferredQueue = wantsExploration ? 1 : 0;
    const item = takeBest(queues[preferredQueue]) || takeBest(queues[1 - preferredQueue]);
    if (!item) break;
    output.push(item);
  }

  return output;
}

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
  // Onboarding open → their picks are still coming in. Wait so the very
  // first For You row is built FROM those picks, not from empty prefs.
  if (document.getElementById('onboard-screen')) {
    setTimeout(loadForYou, 3500);
    return;
  }
  rowEl.innerHTML = skelCards(8);

  try {
    const taste = getActiveTasteState();
    const dislikedIds = new Set((taste.disliked || []).map(mediaKey));
    const likedIds = new Set([...(taste.liked || []), ...(taste.prefLikes || [])].map(mediaKey));

    const genreIds = !_kidsMode() && state.prefGenres.length
      ? state.prefGenres.slice(0, 4).join('|')
      : _kidsMode() ? '10751|16|10762|35|12' : '28|35|18|878|12';

    // Fetch liked-item recommendations + genre discover + trending in parallel
    const candidates = [
      ...(taste.loved || []).filter(x => x.id && x.type !== 'anime').slice(0, 2),
      ...(taste.prefLikes || []).filter(x => x.id && x.type !== 'anime').slice(0, 2),
      ...(taste.liked || []).filter(x => x.id && x.type !== 'anime').slice(0, 2),
    ];
    const dedupedCandidates = candidates.filter((x, i, a) => a.findIndex(y => mediaKey(y) === mediaKey(x)) === i).slice(0, 3);

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
    const recItems = recResults.flatMap((r, index) => r.status === 'fulfilled'
      ? (r.value.results || []).map(item => ({ ...item, media_type: dedupedCandidates[index]?.type || dedupedCandidates[index]?.media_type || 'movie' }))
      : []);
    const dislikedTagIdSet = new Set((state.prefTagDislikes || []).map(t => t.id));

    // IDs currently shown in Trending row — exclude to avoid repeats
    const trendingRowIds = new Set(
      Array.from(document.querySelectorAll('#row-trending [data-id]')).map(el => `${el.dataset.type || 'movie'}:${+el.dataset.id}`)
    );
    const recentIds = new Set(state.recentlyViewed.map(mediaKey));

    // Score: recommendation hit = 3pts, genre match = 1pt each
    const recIdCounts = {};
    recItems.forEach(m => { const key = mediaKey(m); recIdCounts[key] = (recIdCounts[key] || 0) + 3; });

    const watchedIds = new Set(state.watched.map(mediaKey));
    const seen = new Set();
    const tolerance = state._repeatTolerance || 'medium';
    const verifiedCandidates = await _verified([...tagMovies, ...tagShows, ...recItems, ...discover, ...discoverTv]);
    const pool = verifiedCandidates.filter(m => {
      const candidateKey = mediaKey(m);
      if (!m.id || seen.has(candidateKey)) return false;
      seen.add(candidateKey);
      if (!passesAgeFilter(m)) return false;
      // Central safety: age rating, kid mode, and disliked genres (app.js)
      if (!_kidsMode() && window._svSafeItem && !window._svSafeItem(m)) return false;
      const key = mediaKey(m);
      if (dislikedIds.has(key) || likedIds.has(key) || trendingRowIds.has(key) || recentIds.has(key) || watchedIds.has(key)) return false;
      // Apply impression filter to For You row too
      const imp = state.impressions?.[mediaKey(m)] ?? state.impressions?.[m.id];
      const impCount = typeof imp === 'number' ? imp : imp?.count || 0;
      if (impCount) {
        const hoursSince = (Date.now() - (imp?.lastSeen || 0)) / 3600000;
        if (tolerance === 'maximum' && impCount >= 2 && hoursSince < 96) return false;
        if (tolerance === 'medium' && impCount >= 4 && hoursSince < 24) return false;
      }
      return true;
    });

    pool.sort((a, b) => {
      const score = m => {
        let s = recIdCounts[mediaKey(m)] || 0;
        s += getTasteScore(m) * 1.4;
        if (state.prefGenres.length)
          s += (m.genre_ids || []).filter(g => state.prefGenres.includes(g)).length;
        s += ((m.vote_average || 0) / 20);
        if (m._tagMatch) s += 4; // big boost for items from liked-tag discover
        s -= getImpressionPenalty(m); // subtract penalty for over-shown content
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
    const mixed = blendRecommendationCandidates(inPrefItems, outPrefItems, totalWanted);
    // Claim against the global registry — For You loads first, so it gets
    // first pick and every later row automatically avoids these titles
    const items = _claim(mixed, totalWanted);

    if (!items.length) {
      // Hard fallback: highly-rated popular content — but it goes through
      // the SAME safety gate as everything else (age/kid mode/dislikes/
      // watched/disliked items). A fallback must never leak mature titles.
      const fallback = await tmdb('/movie/top_rated', { page: Math.floor(Math.random() * 3) + 1 });
      const verifiedFallback = await _verified((fallback.results || []).map(m => ({ ...m, media_type: 'movie' })));
      const fallbackItems = verifiedFallback
        .filter(m => m?.id &&
          (_kidsMode() || !window._svSafeItem || window._svSafeItem(m)) &&
          !dislikedIds.has(mediaKey(m)) && !watchedIds.has(mediaKey(m)))
        .slice(0, 18);
      if (fallbackItems.length) {
        renderRow('row-foryou', _claim(fallbackItems, 18), null);
        return;
      }
      rowEl.innerHTML = '<p class="muted-note" style="padding:1rem">Check back soon — we\'re building your recommendations.</p>';
      return;
    }

    // If pool is smaller than desired, pad with trending content — safety-
    // filtered like the main pool
    if (items.length < 8) {
      try {
        const extra = await tmdb('/trending/movie/week');
        const verifiedExtra = await _verified((extra.results || []).map(m => ({ ...m, media_type: 'movie' })));
        const extraItems = verifiedExtra
          .filter(m => m?.id && !items.some(x => x.id === m.id) &&
            (_kidsMode() || !window._svSafeItem || window._svSafeItem(m)) &&
            !dislikedIds.has(mediaKey(m)) && !watchedIds.has(mediaKey(m)))
          .slice(0, 18 - items.length);
        items.push(..._claim(extraItems, 18 - items.length));
      } catch {}
    }

    renderRow('row-foryou', items, null);
  } catch (err) {
    console.error('[SV ForYou] failed:', err?.message || err);
    rowEl.innerHTML = '<p class="muted-note" style="padding:1rem">Could not load recommendations.</p>';
  }
}

/* ── BECAUSE YOU LIKED rows ──────────────────────────────────────── */
export async function loadBecauseYouLiked() {
  // Occasional row: shows 2 of every 3 days (skips when daySeed % 3 === 2)
  if (_daySeed % 3 === 2) return;
  // Collect candidates: prefLikes first, then top liked items
  const taste = getActiveTasteState();
  const candidates = [
    ...(taste.loved || []).filter(x => x.id && x.type !== 'anime'),
    ...(taste.prefLikes || []).filter(x => x.id && x.type !== 'anime'),
    ...(taste.liked || []).filter(x => x.id && x.type !== 'anime').slice(0, 5),
  ];

  // Dedupe by id + skip titles already anchoring another row
  const seen = new Set();
  const unique = candidates.filter(x => {
    const key = mediaKey(x);
    if (seen.has(key) || _usedTitleIds.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Use top 3
  const picks = unique.slice(0, 3);
  picks.forEach(p => _usedTitleIds.add(mediaKey(p)));

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
            Because you liked <em>${esc(item.title || 'this')}</em>
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
      // Recommendations + similar in parallel — one endpoint alone often
      // returns too few; a row needs 10+ items to feel real
      const [recD, simD] = await Promise.allSettled([
        tmdb(`/${type}/${item.id}/recommendations`),
        tmdb(`/${type}/${item.id}/similar`),
      ]);
      const merged = [];
      const mSeen = new Set();
      [...(recD.status === 'fulfilled' ? recD.value.results || [] : []),
       ...(simD.status === 'fulfilled' ? simD.value.results || [] : [])].forEach(m => {
        if (m.id && !mSeen.has(m.id)) { mSeen.add(m.id); merged.push(m); }
      });
      const verifiedMerged = await _verified(merged.map(m => ({ ...m, media_type: type })));
      const results = _claim(verifiedMerged.filter(m =>
        mediaKey(m) !== mediaKey(item) && // never show the anchor inside its own row
        !(taste.disliked || []).some(d => mediaKey(d) === mediaKey(m))), 14);

      if (results.length < 10) {
        console.warn(`[SV BYL] "${item.title}" row too thin (${results.length} < 10) — hidden`);
        sec.style.display = 'none';
      } else {
        renderRow(rowId, results, type);
      }
    } catch (err) {
      console.warn(`[SV BYL] "${item.title || item.id}" row failed:`, err?.message || err);
      sec.style.display = 'none';
    }
  }
  window._svSpreadSections?.();
}

/* ── TRENDING IN YOUR GENRE ──────────────────────────────────────── */
export async function loadGenreTrending() {
  const sec = document.getElementById('sec-genre-trending');
  const row = document.getElementById('row-genre-trending');
  const titleEl = document.getElementById('sec-genre-trending-title');
  if (!sec || !row) return;

  // Need at least one preferred genre or watched/liked content to derive one
  const taste = getActiveTasteState();
  const prefGenres = _kidsMode() ? [] : (state.prefGenres || []);
  const likedGenres = {};
  [...(taste.liked || []), ...(_kidsMode() ? [] : (state.watched || []))].forEach(item => {
    (item.genre_ids || []).forEach(g => { likedGenres[g] = (likedGenres[g] || 0) + 1; });
  });

  // Pick the top genre by preference → then by liked count
  const topPrefGenre = prefGenres[0];
  const topLikedGenre = Object.entries(likedGenres).sort((a,b) => b[1]-a[1])[0]?.[0];
  const genreId = topPrefGenre || topLikedGenre;
  if (!genreId) return; // no data yet

  // Genre name map
  const GENRE_NAMES = { 28:'Action',35:'Comedy',18:'Drama',27:'Horror',878:'Sci-Fi',
    10749:'Romance',16:'Animation',80:'Crime',53:'Thriller',12:'Adventure',
    14:'Fantasy',99:'Documentary',10751:'Family',10402:'Music',9648:'Mystery' };
  const genreName = GENRE_NAMES[+genreId] || 'Your Genre';

  if (titleEl) titleEl.textContent = `Trending in ${genreName}`;
  sec.style.display = '';
  row.innerHTML = skelCards(8);

  try {
    const dislikedIds = new Set((taste.disliked || []).map(mediaKey));
    const watchedIds  = new Set((_kidsMode() ? (taste.watched || []) : (state.watched || [])).map(mediaKey));
    const [mv, tv] = await Promise.allSettled([
      tmdb('/discover/movie', { sort_by:'popularity.desc', with_genres: genreId, 'vote_count.gte': 50 }),
      tmdb('/discover/tv',    { sort_by:'popularity.desc', with_genres: genreId, 'vote_count.gte': 20 }),
    ]);
    const movies = mv.status==='fulfilled' ? (mv.value.results||[]).map(x=>({...x,media_type:'movie'})) : [];
    const shows  = tv.status==='fulfilled' ? (tv.value.results||[]).map(x=>({...x,media_type:'tv'})) : [];
    const mixed = []; const ml=movies.length, sl=shows.length;
    for (let i=0;i<Math.max(ml,sl);i++) { if(movies[i])mixed.push(movies[i]); if(shows[i])mixed.push(shows[i]); }
    const verifiedMixed = await _verified(mixed);
    const filtered = _claim(verifiedMixed.filter(m => !dislikedIds.has(mediaKey(m)) && !watchedIds.has(mediaKey(m))), 18);
    if (filtered.length < 10) {
      console.warn(`[SV GenreTrending] too thin (${filtered.length} < 10) — hidden`);
      sec.style.display='none'; return;
    }
    row.innerHTML = filtered.map(m => makeCard(m, m.media_type)).join('');
  } catch (err) {
    console.warn('[SV GenreTrending] failed:', err?.message || err);
    sec.style.display = 'none';
  }
}

/* ── DEEP CUTS — highly rated but unseen ─────────────────────────── */
export async function loadDeepCuts() {
  const sec = document.getElementById('sec-deep-cuts');
  const row = document.getElementById('row-deep-cuts');
  if (!sec || !row) return;

  const taste = getActiveTasteState();
  const watchedIds  = new Set((_kidsMode() ? (taste.watched || []) : (state.watched || [])).map(mediaKey));
  const likedIds    = new Set((taste.liked || []).map(mediaKey));
  const dislikedIds = new Set((taste.disliked || []).map(mediaKey));
  const recentIds   = new Set((_kidsMode() ? [] : (state.recentlyViewed || [])).map(mediaKey));

  // Need some history to determine "unseen"
  if (!watchedIds.size && !likedIds.size) return;

  sec.style.display = '';
  row.innerHTML = skelCards(8);

  try {
    const page = Math.floor(Math.random() * 5) + 1;
    const [mv, tv] = await Promise.allSettled([
      tmdb('/discover/movie', { sort_by:'vote_average.desc', 'vote_count.gte':1000, 'vote_average.gte':7.5, page }),
      tmdb('/discover/tv',    { sort_by:'vote_average.desc', 'vote_count.gte':300,  'vote_average.gte':7.8, page }),
    ]);
    const movies = mv.status==='fulfilled' ? (mv.value.results||[]).map(x=>({...x,media_type:'movie'})) : [];
    const shows  = tv.status==='fulfilled' ? (tv.value.results||[]).map(x=>({...x,media_type:'tv'})) : [];
    const verifiedAll = await _verified([...movies, ...shows]);
    const all = _claim(verifiedAll
      .filter(m => !watchedIds.has(mediaKey(m)) && !likedIds.has(mediaKey(m)) && !dislikedIds.has(mediaKey(m)) && !recentIds.has(mediaKey(m)))
      .sort((a,b) => (b.vote_average||0) - (a.vote_average||0)), 18);
    if (all.length < 10) {
      console.warn(`[SV DeepCuts] too thin (${all.length} < 10) — hidden`);
      sec.style.display='none'; return;
    }
    row.innerHTML = all.map(m => makeCard(m, m.media_type)).join('');
  } catch (err) {
    console.warn('[SV DeepCuts] failed:', err?.message || err);
    sec.style.display = 'none';
  }
}

/* ── MORE LIKE YOUR HISTORY — from recently watched ─────────────── */
export async function loadHistoryMix() {
  const sec = document.getElementById('sec-history-mix');
  const row = document.getElementById('row-history-mix');
  const titleEl = document.getElementById('sec-history-mix-title');
  if (!sec || !row) return;
  // Occasional row: shows 2 of every 3 days (different phase than BYL)
  if (_daySeed % 3 === 1) { sec.style.display = 'none'; return; }

  // Pull from recently watched (not just liked) — top 4 unique items
  if (_kidsMode()) { sec.style.display = 'none'; return; }
  const taste = getActiveTasteState();
  const history = [
    ...(state.watched || []).slice().reverse().slice(0, 4),
    ...(state.recentlyViewed || []).slice(0, 4),
  ];
  const seen = new Set();
  const candidates = history
    .filter(x => {
      const key = mediaKey(x);
      if (!x.id || _usedTitleIds.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
  if (!candidates.length) return;

  // Use first item as the "anchor" label — and claim it so no other
  // title-referencing row uses the same title
  const anchor = candidates[0];
  _usedTitleIds.add(mediaKey(anchor));
  const anchorName = anchor.title || anchor.name || '';
  if (titleEl && anchorName) {
    titleEl.textContent = `More Like "${anchorName}"`;
  }

  sec.style.display = '';
  row.innerHTML = skelCards(8);

  const dislikedIds = new Set((taste.disliked || []).map(mediaKey));
  const watchedIds  = new Set((taste.watched || []).map(mediaKey));

  try {
    const recResults = await Promise.allSettled(
      candidates.map(item => tmdb(`/${item.type || item.media_type || 'movie'}/${item.id}/recommendations`).then(d => d.results || []))
    );
    const allRecs = recResults.flatMap(r => r.status==='fulfilled' ? r.value : []);
    const uniqSeen = new Set();
    const anchorIds = new Set(candidates.map(mediaKey));
    const filtered = _claim(allRecs
      .filter(m => {
        const key = mediaKey(m);
        if (!m.id || anchorIds.has(key) || dislikedIds.has(key) || watchedIds.has(key) || uniqSeen.has(key)) return false;
        uniqSeen.add(key);
        return true;
      })
      .sort((a,b) => (b.popularity||0)-(a.popularity||0)), 18);
    if (filtered.length < 10) {
      console.warn(`[SV HistoryMix] too thin (${filtered.length} < 10) — hidden`);
      sec.style.display='none'; return;
    }
    row.innerHTML = filtered.map(m => makeCard(m, m.media_type || (m.title ? 'movie' : 'tv'))).join('');
  } catch (err) {
    console.warn('[SV HistoryMix] failed:', err?.message || err);
    sec.style.display = 'none';
  }
}

/* ── BECAUSE YOU WATCHED [Title] rows ───────────────────────────── */
export async function loadBecauseYouWatched() {
  // Occasional row: shows every other day, offset from Because-You-Liked
  if (_daySeed % 2 === 0) return;
  // Take top 2 recently-watched items — skipping any title that already
  // anchors a "Because you liked" or "More Like" row
  if (_kidsMode()) return;
  const taste = getActiveTasteState();
  const likedIds = new Set([...(taste.prefLikes || []), ...(taste.liked || [])].map(mediaKey));
  const candidates = (state.watched || [])
    .slice().reverse()
    .filter(x => x.id && !likedIds.has(mediaKey(x)) && !_usedTitleIds.has(mediaKey(x)) && x.type !== 'anime')
    .slice(0, 2);
  if (!candidates.length) return;
  candidates.forEach(c => _usedTitleIds.add(mediaKey(c)));

  for (const item of candidates) {
    const secId = `sec-watched-${item.id}`;
    const rowId = `row-watched-${item.id}`;
    let sec = document.getElementById(secId);
    if (!sec) {
      sec = document.createElement('div');
      sec.className = 'section';
      sec.id = secId;
      sec.innerHTML = `
        <div class="sec-header">
          <div class="sec-title">
            <span class="material-icons-round sec-icon" style="color:#60a5fa">history</span>
            Because you watched <em>${esc(item.title || item.name || 'this')}</em>
          </div>
        </div>
        <div class="row-wrap">
          <div class="row-arrow row-arrow-l hidden">
            <button data-scroll-row="${rowId}" data-scroll-dir="-1" aria-label="Scroll left"><span class="material-icons-round">chevron_left</span></button>
          </div>
          <div class="card-row" id="${rowId}"></div>
          <div class="row-arrow row-arrow-r">
            <button data-scroll-row="${rowId}" data-scroll-dir="1" aria-label="Scroll right"><span class="material-icons-round">chevron_right</span></button>
          </div>
        </div>`;
      // Scatter these far apart — and far from the other title-referencing
      // rows (Because you liked → sec-new/action/drama/scifi, More Like →
      // sec-history-mix). These anchor deep in the page instead.
      const anchors = ['sec-boxoffice', 'sec-hidden-gems', 'sec-classics'];
      const anchorId = anchors[candidates.indexOf(item) % anchors.length];
      const anchor = document.getElementById(anchorId) || document.getElementById('sec-toprated');
      if (anchor?.parentNode) anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      else document.getElementById('page-home')?.appendChild(sec);
    }
    const rowEl = document.getElementById(rowId);
    if (!rowEl) continue;
    rowEl.innerHTML = skelCards(8);
    try {
      const type = item.type || item.media_type || 'movie';
      // recommendations + similar merged → rows always have enough items
      const [recD, simD] = await Promise.allSettled([
        tmdb(`/${type}/${item.id}/recommendations`),
        tmdb(`/${type}/${item.id}/similar`),
      ]);
      const mSeen = new Set();
      const merged = [
        ...(recD.status === 'fulfilled' ? recD.value.results || [] : []),
        ...(simD.status === 'fulfilled' ? simD.value.results || [] : []),
      ].filter(m => m.id && !mSeen.has(m.id) && mSeen.add(m.id));
      const verifiedMerged = await _verified(merged.map(m => ({ ...m, media_type: type })));
      const results = _claim(verifiedMerged
        .filter(m => mediaKey(m) !== mediaKey(item)
          && !(taste.disliked || []).some(d => mediaKey(d) === mediaKey(m))
          && !(taste.watched || []).some(w => mediaKey(w) === mediaKey(m))), 14);
      if (results.length < 10) {
        console.warn(`[SV BYW] "${item.title || item.name}" row too thin (${results.length} < 10) — hidden`);
        sec.style.display='none'; continue;
      }
      renderRow(rowId, results, type);
    } catch (err) {
      console.warn(`[SV BYW] "${item.title || item.id}" row failed:`, err?.message || err);
      sec.style.display = 'none';
    }
  }
  window._svSpreadSections?.();
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
