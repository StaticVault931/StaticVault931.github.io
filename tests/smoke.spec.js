// Smoke tests — the site boots, core pages exist, and nothing throws on load.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Seed the "returning user" state BEFORE any page script runs — no
// evaluate/reload race, no loading screen, no onboarding curtain.
async function seedReturningUser(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sv_onboarded', '1');
      localStorage.setItem('sv_visited', '1');
    } catch {}
  });
}

test.describe('StaticVault931 smoke', () => {
  test('Kid-Guided rating rules fail closed and use the stricter certification', async ({ page }) => {
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const results = await page.evaluate(async () => {
      const safety = await import('/src/js/contentSafety.js');
      return {
        allowed: ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'].map(rating =>
          safety.evaluateCertifications([rating], { kidsMode: true })),
        blocked: ['PG-13', 'TV-14', 'R', 'TV-MA', 'NC-17'].map(rating =>
          safety.evaluateCertifications([rating], { kidsMode: true })),
        unknown: safety.evaluateCertifications(['NR'], { kidsMode: true }),
        conflict: safety.evaluateCertifications(['PG', 'R'], { kidsMode: true }),
      };
    });
    expect(results.allowed.every(result => result.allowed && result.verified)).toBe(true);
    expect(results.blocked.every(result => !result.allowed && result.verified)).toBe(true);
    expect(results.unknown).toMatchObject({ allowed: false, verified: false, reason: 'unknown-rating' });
    expect(results.conflict).toMatchObject({ allowed: false, verified: true, rating: 'R' });
  });

  test('Kid-Guided certification resolution caches verified results and blocks unknown ratings', async ({ page }) => {
    let requests = 0;
    await page.route('https://api.themoviedb.org/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/movie/901')) {
        requests++;
        await route.fulfill({ json: { id: 901, release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG' }] }] }, external_ids: {} } });
      } else if (pathname.endsWith('/movie/902')) {
        await route.fulfill({ json: { id: 902, release_dates: { results: [] }, external_ids: {} } });
      } else await route.fulfill({ status: 503, body: '{}' });
    });
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const safety = await import('/src/js/contentSafety.js');
      safety.clearContentSafetyCache();
      const first = await safety.resolveContentSafety({ id: 901, type: 'movie' }, { kidsMode: true });
      const second = await safety.resolveContentSafety({ id: 901, type: 'movie' }, { kidsMode: true });
      const unknown = await safety.resolveContentSafety({ id: 902, type: 'movie' }, { kidsMode: true });
      return { first, second, unknown };
    });
    expect(requests).toBe(1);
    expect(result.first).toMatchObject({ allowed: true, verified: true, rating: 'PG' });
    expect(result.second).toMatchObject({ allowed: true, verified: true, rating: 'PG' });
    expect(result.unknown).toMatchObject({ allowed: false, verified: false, reason: 'unknown-rating' });
  });

  test('Kid-Guided keeps adult taste signals isolated', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sv_onboarded', '1');
      localStorage.setItem('sv_visited', '1');
      localStorage.setItem('sv_liked', JSON.stringify([{ id: 9001, type: 'movie', title: 'Adult horror', genre_ids: [27] }]));
      localStorage.setItem('sv_settings', JSON.stringify({ kidsMode: true, ageRating: 'PG' }));
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      const active = store.getActiveTasteState();
      return {
        adultLikes: store.state.liked.length,
        childLikes: active.liked.length,
        isActiveLike: store.isLiked(9001, 'movie'),
        score: store.getTasteScore({ id: 9002, type: 'movie', genre_ids: [27] }),
      };
    });
    expect(result).toEqual({ adultLikes: 1, childLikes: 0, isActiveLike: false, score: 0 });
  });

  test('Kid-Guided blocks unsafe direct title URLs before opening details', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sv_onboarded', '1');
      localStorage.setItem('sv_visited', '1');
      localStorage.setItem('sv_settings', JSON.stringify({ kidsMode: true, ageRating: 'PG' }));
    });
    await page.route('https://api.themoviedb.org/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/movie/903')) {
        await route.fulfill({ json: { id: 903, title: 'Blocked title', release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'R' }] }] }, external_ids: {} } });
      } else await route.fulfill({ json: { results: [] } });
    });
    await page.goto('/?watch=movie&id=903&mode=info', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toast')).toContainText('outside the Kid-Guided family rating limit', { timeout: 5000 });
    await expect(page.locator('#info-overlay')).not.toHaveClass(/open/);
  });

  test('Kid-Guided PIN uses a salted hash, cooldown-capable verification, and recovery code', async ({ page }) => {
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const pin = await import('/src/js/kidsPin.js');
      const recovery = await pin.setKidsPin('test-profile', '2468');
      const stored = localStorage.getItem('sv_kids_pin_v1_test-profile');
      return {
        hasPin: pin.hasKidsPin('test-profile'),
        storesPlainPin: stored.includes('2468'),
        wrong: await pin.verifyKidsPin('test-profile', '1111'),
        right: await pin.verifyKidsPin('test-profile', '2468'),
        recovery: await pin.verifyKidsPin('test-profile', recovery),
      };
    });
    expect(result.hasPin).toBe(true);
    expect(result.storesPlainPin).toBe(false);
    expect(result.wrong.ok).toBe(false);
    expect(result.right).toMatchObject({ ok: true, method: 'pin' });
    expect(result.recovery).toMatchObject({ ok: true, method: 'recovery' });
  });

  test('taste scoring keeps Love stronger than Like and unrelated ratings stable', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      const target = { id: 7001, type: 'movie', title: 'Target', genre_ids: [12] };
      store.setReaction(target, 'like');
      const likeScore = store.getTasteScore(target);
      store.setReaction(target, 'love');
      const loveScore = store.getTasteScore(target);
      const candidate = { id: 7002, type: 'movie', title: 'Candidate', genre_ids: [12] };
      const before = store.getTasteScore(candidate);
      store.setReaction({ id: 7003, type: 'movie', title: 'Unrelated', genre_ids: [99] }, 'like');
      const after = store.getTasteScore(candidate);
      return { likeScore, loveScore, before, after };
    });
    expect(result.loveScore).toBeGreaterThan(result.likeScore);
    expect(result.after).toBe(result.before);
  });

  test('Kid-Guided keeps watched and watchlist data separate from adult data', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sv_settings', JSON.stringify({ kidsMode: true }));
      localStorage.setItem('sv_watchlist', JSON.stringify([{ id: 8100, type: 'movie', title: 'Adult save' }]));
      localStorage.setItem('sv_watched', JSON.stringify([{ id: 8101, type: 'movie', title: 'Adult watch' }]));
    });
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      store.toggleWatchlist({ id: 8200, type: 'movie', title: 'Child save' });
      store.toggleWatched({ id: 8201, type: 'movie', title: 'Child watch' });
      return {
        adultSaved: store.state.watchlist.map(item => item.id),
        adultWatched: store.state.watched.map(item => item.id),
        childSaved: store.state.kidsTaste.watchlist.map(item => item.id),
        childWatched: store.state.kidsTaste.watched.map(item => item.id),
      };
    });
    expect(result).toEqual({ adultSaved: [8100], adultWatched: [8101], childSaved: [8200], childWatched: [8201] });
  });

  test('content cards do not nest buttons inside links', async ({ page }) => {
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const markup = await page.evaluate(async () => {
      const ui = await import('/src/js/ui.js');
      const host = document.createElement('div');
      host.innerHTML = ui.makeCard({ id: 550, title: 'Example', backdrop_path: '/test.jpg' }, 'movie');
      return { nested: host.querySelectorAll('a button').length, link: host.querySelector('.card-main-link')?.getAttribute('href') };
    });
    expect(markup.nested).toBe(0);
    expect(markup.link).toMatch(/^\/title\/movie\/550-/);
  });

  test('bare Z opens the accessible ten-item undo history and reverses an action', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const { undoManager } = await import('/src/js/undoManager.js');
      window.__undoProbe = 1;
      undoManager.record({ label: 'Test action', title: 'Example', undo: () => { window.__undoProbe = 0; } });
    });
    await page.keyboard.press('z');
    const dialog = page.locator('#undo-history-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Test action');
    await dialog.locator('[data-undo-latest]').click();
    expect(await page.evaluate(() => window.__undoProbe)).toBe(0);
  });

  test('legacy personal data is claimed by the active profile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sv_onboarded', '1');
      localStorage.setItem('sv_visited', '1');
      localStorage.setItem('sv_profiles', JSON.stringify([{ id: 'legacy', name: 'Legacy' }]));
      localStorage.setItem('sv_active_profile', 'legacy');
      localStorage.setItem('sv_watchlist', JSON.stringify([{ id: 550, type: 'movie', title: 'Fight Club' }]));
      localStorage.removeItem('sv_pd_legacy');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('sv_pd_legacy') || 'null'));
    expect(migrated?.watchlist).toHaveLength(1);
    expect(migrated?.watchlist?.[0]?.id).toBe(550);
  });

  test('invalid profile switches do not erase active data', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const profiles = await import('/src/js/profiles.js');
      const before = localStorage.getItem('sv_active_profile');
      const switched = profiles.switchProfile('missing-profile');
      return { before, after: localStorage.getItem('sv_active_profile'), switched };
    });
    expect(result.switched).toBe(false);
    expect(result.after).toBe(result.before);
  });

  test('movie and TV items with the same TMDB id remain distinct', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const recent = await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      store.addRecentlyViewed({ id: 42, type: 'movie', title: 'Movie 42' });
      store.addRecentlyViewed({ id: 42, type: 'tv', title: 'Show 42' });
      return store.state.recentlyViewed.filter(item => item.id === 42).map(store.mediaKey);
    });
    expect(recent).toEqual(['tv:42', 'movie:42']);
  });

  test('Like and Love are distinct persisted reactions', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const reactions = await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      const item = { id: 603, type: 'movie', title: 'The Matrix', genre_ids: [28, 878] };
      const first = store.cycleReaction(item);
      const second = store.cycleReaction(item);
      const third = store.cycleReaction(item);
      return {
        sequence: [first, second, third],
        liked: store.isLiked(603, 'movie'),
        loved: store.isLoved(603, 'movie'),
        savedLoved: JSON.parse(localStorage.getItem('sv_loved') || '[]').length,
      };
    });
    expect(reactions.sequence).toEqual(['like', 'love', 'none']);
    expect(reactions.liked).toBe(false);
    expect(reactions.loved).toBe(false);
    expect(reactions.savedLoved).toBe(0);
  });

  test('Skip remains a weak signal and does not become a dislike', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      const item = { id: 424, type: 'tv', title: 'Skipped Show', genre_ids: [18] };
      store.recordTasteSkip(item);
      return {
        score: store.getTasteScore(item),
        disliked: store.isDisliked(424, 'tv'),
        skip: store.state.tasteSkips['tv:424'],
      };
    });
    expect(result.score).toBeLessThan(0);
    expect(result.disliked).toBe(false);
    expect(result.skip.count).toBe(1);
  });

  test('home page boots without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#page-home')).toBeVisible();
    await expect(page.locator('#header .logo')).toBeVisible();
    expect(errors, `Page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('home has no critical axe accessibility violations', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter(violation => violation.impact === 'critical');
    expect(critical, critical.map(violation => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
  });

  test('navigation tabs switch pages', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.nav-tab[data-page="library"]').click();
    await expect(page.locator('#page-library')).toBeVisible();
    await page.locator('.nav-tab[data-page="prefs"]').click();
    await expect(page.locator('#page-prefs')).toBeVisible();
    await expect(page).toHaveURL(/\/customize\/$/);
  });

  test('clean private and discovery routes load without legacy query URLs', async ({ page }) => {
    await seedReturningUser(page);
    for (const route of ['/library/', '/customize/', '/clips/']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${route.replace(/\//g, '\\/')}$`));
      await expect(page).not.toHaveURL(/\?page=/);
    }
  });

  test('search query is shareable on the clean search route', async ({ page }) => {
    await seedReturningUser(page);
    await page.route('https://api.themoviedb.org/**', route => route.fulfill({ json: { results: [] } }));
    await page.route('https://graphql.anilist.co/**', route => route.fulfill({ json: { data: { Page: { media: [] } } } }));
    await page.goto('/search/?q=blade%20runner', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#search-input')).toHaveValue('blade runner', { timeout: 5000 });
    await expect(page).toHaveURL(/\/search\/\?q=blade%20runner$/);
  });

  test('clean route helpers keep provider and browse URLs canonical', async ({ page }) => {
    await page.goto('/404.html', { waitUntil: 'domcontentloaded' });
    const routes = await page.evaluate(async () => {
      const route = await import('/src/js/routes.js');
      return {
        provider: route.providerPath(9, 'Amazon Prime Video'),
        parsedProvider: route.parseCleanRoute('/provider/9-amazon-prime-video/'),
        browse: route.browsePath('row-trending', 'Trending Now'),
        parsedBrowse: route.parseCleanRoute('/browse/row-trending/trending-now/'),
      };
    });
    expect(routes.provider).toBe('/provider/9-amazon-prime-video/');
    expect(routes.parsedProvider).toMatchObject({ kind: 'provider', id: 9, slug: 'amazon-prime-video' });
    expect(routes.browse).toBe('/browse/row-trending/trending-now/');
    expect(routes.parsedBrowse).toMatchObject({ kind: 'browse', key: 'row-trending', slug: 'trending-now' });
  });

  test('right-click reactions expose filled and outline state icons', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const store = await import('/src/js/state.js');
      store.setReaction({ id: 603, type: 'movie', title: 'The Matrix' }, 'love');
      const card = document.createElement('div');
      card.id = 'context-reaction-fixture';
      card.className = 'card';
      card.dataset.id = '603';
      card.dataset.type = 'movie';
      card.dataset.title = 'The Matrix';
      card.textContent = 'The Matrix';
      document.body.appendChild(card);
    });
    await page.locator('#context-reaction-fixture').click({ button: 'right' });
    const love = page.locator('#sv-ctx-menu [role="menuitemcheckbox"]', { hasText: 'Remove Love' });
    const like = page.locator('#sv-ctx-menu [role="menuitemcheckbox"]', { hasText: 'Like' });
    await expect(love).toHaveAttribute('aria-checked', 'true');
    await expect(love.locator('.material-icons-round')).toHaveText('favorite');
    await expect(like).toHaveAttribute('aria-checked', 'false');
    await expect(like.locator('.material-icons-round')).toHaveText('thumb_up_off_alt');
  });

  test('profile export snapshot includes inactive profile metadata and data', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const snapshot = await page.evaluate(async () => {
      const profiles = await import('/src/js/profiles.js');
      const first = profiles.getProfiles()[0];
      const second = profiles.createProfile('Second Profile', 'avatar-url', '#123456');
      profiles.switchProfile(second.id);
      const state = await import('/src/js/state.js');
      state.state.liked = [{ id: 77, type: 'movie', title: 'Saved on second profile' }];
      state.persist('liked');
      profiles.switchProfile(first.id);
      return profiles.exportProfilesSnapshot();
    });
    expect(snapshot.profiles.map(profile => profile.name)).toContain('Second Profile');
    const second = snapshot.profiles.find(profile => profile.name === 'Second Profile');
    expect(snapshot.profileData[second.id].liked[0].title).toBe('Saved on second profile');
  });

  test('profile snapshot restore adds profiles without overwriting existing ones', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const restored = await page.evaluate(async () => {
      const profiles = await import('/src/js/profiles.js');
      const before = profiles.getProfiles().map(profile => profile.name);
      const result = profiles.restoreProfilesSnapshot({
        activeProfileId: 'backup-profile',
        profiles: [{ id: 'backup-profile', name: 'Backup Profile', avatar: null, color: '#456789', createdAt: 1 }],
        profileData: { 'backup-profile': { liked: [{ id: 88, type: 'movie', title: 'Restored title' }] } },
      });
      const store = await import('/src/js/state.js');
      return { before, after: profiles.getProfiles().map(profile => profile.name), result, liked: store.state.liked };
    });
    expect(restored.after).toEqual(expect.arrayContaining(restored.before));
    expect(restored.after).toContain('Backup Profile');
    expect(restored.result.imported).toBe(1);
    expect(restored.liked[0].title).toBe('Restored title');
  });

  test('Super Search only replaces browser Find when enabled', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sv_onboarded', '1');
      localStorage.setItem('sv_visited', '1');
      localStorage.setItem('sv_settings', JSON.stringify({ superSearch: true }));
    });
    await page.goto('/?page=library', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#page-library')).toBeVisible();
    await page.keyboard.press('Control+f');
    await expect(page.locator('#super-search-overlay')).toBeVisible();
    await page.locator('#super-search-input').fill('Library');
    await expect(page.locator('#super-search-results')).toContainText('My Library');
    await page.keyboard.press('Escape');
    await expect(page.locator('#super-search-overlay')).toBeHidden();
  });

  test('clips deep link does not 404', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/?page=clips', { waitUntil: 'domcontentloaded' });
    // Must stay on the app, not redirect to /404.html
    await expect(page).not.toHaveURL(/404/);
  });

  test('onboarding appears on first visit', async ({ page }) => {
    // Fresh user: no seeded storage at all
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#onboard-screen')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#ob-skip')).toBeVisible();
  });

  test('onboarding poster wall keeps complete rows after candidate deduplication', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route('https://api.themoviedb.org/**', route => {
      const url = new URL(route.request().url());
      const genre = url.searchParams.get('with_genres') || '';
      const base = url.pathname.includes('/trending/') ? 600
        : url.pathname.includes('/tv') && genre === '16' ? 500
        : genre.includes('27') ? 400
        : genre === '35' ? 300
        : url.pathname.includes('/tv') ? 200
        : genre === '10751' ? 0 : 100;
      const letters = value => {
        let result = '';
        for (let n = value; n >= 0; n = Math.floor(n / 26) - 1) result = String.fromCharCode(97 + (n % 26)) + result;
        return result;
      };
      const results = Array.from({ length: 20 }, (_, index) => ({
        id: base + index + 1,
        title: `Calibration ${letters(base + index)}`,
        name: `Calibration ${letters(base + index)}`,
        poster_path: `/poster-${base + index + 1}.jpg`,
        release_date: '2020-01-01',
        first_air_date: '2020-01-01',
        vote_count: 10000 - index,
        vote_average: 7,
        genre_ids: [18],
        media_type: url.pathname.includes('/tv') ? 'tv' : 'movie',
      }));
      return route.fulfill({ json: { results } });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#onboard-screen')).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('#ob-grid .ob-tile[data-oid]').length >= 50);
    const rows = await page.locator('#ob-grid').evaluate(grid => {
      const counts = new Map();
      [...grid.querySelectorAll('.ob-tile:not(.ob-tile-overflow)')].forEach(tile => {
        if (getComputedStyle(tile).display === 'none') return;
        const y = tile.offsetTop;
        counts.set(y, (counts.get(y) || 0) + 1);
      });
      return [...counts.values()];
    });
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(new Set(rows).size).toBe(1);
  });

  test('idle info trailer is not replaced before the user presses play', async ({ page }) => {
    await seedReturningUser(page);
    await page.route('https://api.themoviedb.org/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/movie/550')) {
        await route.fulfill({ json: {
          id: 550,
          title: 'Fight Club',
          release_date: '1999-10-15',
          backdrop_path: '/test.jpg',
          poster_path: '/poster.jpg',
          genres: [],
          videos: { results: [{ site: 'YouTube', type: 'Trailer', official: true, key: 'SUXWAEX2jlg' }] },
        }});
        return;
      }
      if (url.pathname.endsWith('/movie/550/credits')) {
        await route.fulfill({ json: { cast: [], crew: [] } });
        return;
      }
      await route.fulfill({ json: { results: [] } });
    });
    await page.route('https://www.youtube.com/embed/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Mock YouTube player</title>',
    }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const app = await import('/src/js/app.js');
      await app.openInfoPage(550, 'movie');
    });
    await expect(page.locator('#info-trailer-frame')).toBeVisible();
    await page.waitForTimeout(9500);
    await expect(page.locator('#info-trailer-frame')).toBeVisible();
    await expect(page.locator('#info-trailer-fallback')).toBeHidden();
  });

  test('text search applies the selected streaming provider', async ({ page }) => {
    await seedReturningUser(page);
    await page.route('https://api.themoviedb.org/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/search/movie')) {
        await route.fulfill({ json: { results: [
          { id: 1, title: 'Netflix Match', media_type: 'movie', poster_path: '/one.jpg', vote_average: 8, vote_count: 100 },
          { id: 2, title: 'Other Match', media_type: 'movie', poster_path: '/two.jpg', vote_average: 7, vote_count: 100 },
        ] }});
        return;
      }
      if (url.pathname.endsWith('/movie/1/watch/providers')) {
        await route.fulfill({ json: { results: { US: { flatrate: [{ provider_id: 8 }] } } } });
        return;
      }
      if (url.pathname.endsWith('/movie/2/watch/providers')) {
        await route.fulfill({ json: { results: { US: { flatrate: [{ provider_id: 15 }] } } } });
        return;
      }
      await route.fulfill({ json: { results: [] } });
    });
    await page.route('https://graphql.anilist.co/**', route => route.fulfill({
      json: { data: { Page: { media: [] } } },
    }));
    await page.goto('/?page=search', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const search = await import('/src/js/search.js');
      search.setProviderFilter({ id: 8, name: 'Netflix' });
      await search.doSearch('match');
    });
    await expect(page.locator('#search-results-area')).toContainText('Netflix Match');
    await expect(page.locator('#search-results-area')).not.toContainText('Other Match');
  });

  test('home row selector respects its cap and quarantines failed feeds', async ({ page }) => {
    await seedReturningUser(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const selected = await page.evaluate(async () => {
      const rows = await import('/src/js/rows/rowSelector.js');
      return rows.selectRowsForToday({ profile: 'regression-test' }).map(row => row.id);
    });
    expect(selected.length).toBeLessThanOrEqual(40);
    expect(selected).not.toContain('row-boxoffice');
    expect(selected).not.toContain('row-recently-added');
    expect(selected).not.toContain('row-new-episodes');
  });
});
