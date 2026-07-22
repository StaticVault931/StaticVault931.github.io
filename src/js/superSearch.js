const esc = value => String(value || '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const goToPage = page => import('./router.js').then(({ goPage }) => goPage(page));
const goToCatalogSearch = query => import('./routes.js').then(({ searchPath }) => {
  location.href = searchPath(query);
});

let _enabled = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    return settings.superSearch !== false;
  } catch {
    return true;
  }
};
let _listenerReady = false;
let _previousFocus = null;
let _entries = [];
let _active = 0;

const ACTIONS = [
  { text: 'Search the full catalog', terms: 'find movie show anime actor title global catalog', kind: 'Page', icon: 'search', action: goToCatalogSearch },
  { text: 'Open Settings', terms: 'preferences options captions subtitles language accessibility playback account', kind: 'Tool', icon: 'settings', action: () => goToPage('prefs') },
  { text: 'Open My Library', terms: 'watchlist saved liked loved watched recent history taste profile', kind: 'Page', icon: 'video_library', action: () => goToPage('library') },
  { text: 'Open Clips', terms: 'trailers short feed discover video', kind: 'Page', icon: 'smart_display', action: () => goToPage('clips') },
  { text: 'Open Mix & Match', terms: 'blend combine mix movies shows titles together recommendations discovery mixer', kind: 'Tool', icon: 'blender', action: () => goToPage('mix') },
  { text: 'Show feature guide and shortcuts', terms: 'help guide keyboard shortcuts features tips reference', kind: 'Help', icon: 'help_outline', action: () => document.getElementById('feature-guide-btn')?.click() },
  { text: 'Open undo history', terms: 'undo reverse restore mistake actions history z', kind: 'Tool', icon: 'history', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true })) },
  { text: 'Manage profiles', terms: 'profile account kids kid guided export avatar switch', kind: 'Tool', icon: 'manage_accounts', action: () => document.getElementById('profile-header-btn')?.click() },
  { text: 'Replay onboarding', terms: 'onboarding setup choose genres actors preferences start over', kind: 'Help', icon: 'explore', action: () => window._svOpenOnboarding?.() },
];

const normalize = value => String(value || '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function visible(el) {
  if (!el || el.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
}

function activeSurface() {
  return document.querySelector('.overlay.open, .page.active') || document.querySelector('.page:not([style*="display: none"])');
}

function buildIndex() {
  const root = activeSurface();
  if (!root) return [];
  const seen = new Set();
  const entries = [];
  root.querySelectorAll('.card, h1, h2, h3, .sec-title, p, button, label, [role="tab"], .setting-row, [data-super-search]').forEach(el => {
    if (!visible(el) || el.closest('#super-search-overlay, nav, footer, .card-ov')) return;
    const card = el.closest('.card');
    const target = card || el;
    if (target.closest('.sv-setting-wrap')) return;
    if (seen.has(target)) return;
    // Icon fonts render as glyphs but read as ligature names in
    // textContent ("nights_stay…") — strip them from the label
    let text = card?.dataset.title;
    if (!text) {
      const clone = target.cloneNode(true);
      clone.querySelectorAll('.material-icons-round, .material-icons').forEach(icon => icon.remove());
      text = clone.textContent || '';
    }
    text = text.replace(/\s+/g, ' ').trim().slice(0, 180);
    if (text.length < 2) return;
    seen.add(target);
    entries.push({
      target,
      text,
      search: normalize(`${text} ${card?.dataset.year || ''} ${card?.dataset.type || ''} ${target.getAttribute('aria-label') || ''}`),
      kind: card ? (card.dataset.type === 'tv' ? 'TV show' : card.dataset.type === 'anime' ? 'Anime' : 'Movie')
        : target.matches('button,[role="tab"]') ? 'Control' : 'On this page',
      image: card?.querySelector('img')?.currentSrc || card?.querySelector('img')?.src || '',
      detail: card ? [card.dataset.year, card.dataset.type].filter(Boolean).join(' · ') : '',
    });
  });
  const settings = window._svSuperSearchSettings?.() || [];
  const settingLabels = new Set(settings.map(setting => normalize(setting.label)));
  for (let index = entries.length - 1; index >= 0; index--) {
    if (settingLabels.has(normalize(entries[index].text)) && !['Movie', 'TV show', 'Anime'].includes(entries[index].kind)) {
      entries.splice(index, 1);
    }
  }
  entries.push(...settings.map(setting => ({
    text: setting.label,
    search: normalize(`${setting.label} ${setting.description} ${setting.group} ${setting.keywords}`),
    kind: 'Setting',
    icon: setting.icon || 'settings',
    detail: `${setting.group} · ${setting.type === 'boolean' ? (setting.value ? 'On' : 'Off') : setting.optionLabels[setting.options.indexOf(setting.value)] || setting.value}`,
    setting,
  })));
  entries.push(...ACTIONS.map(action => ({ ...action, search: normalize(`${action.text} ${action.terms}`) })));
  return entries;
}

function ensureOverlay() {
  let overlay = document.getElementById('super-search-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'super-search-overlay';
  overlay.className = 'super-search-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'super-search-title');
  overlay.innerHTML = `
    <div class="super-search-panel">
      <div class="super-search-head">
        <span class="material-icons-round" aria-hidden="true">pageview</span>
        <div><div id="super-search-title">Super Search</div><small>Find content, controls, pages, and tools</small></div>
        <button type="button" class="super-search-close" aria-label="Close Super Search"><span class="material-icons-round">close</span></button>
      </div>
      <label class="super-search-input-wrap">
        <span class="material-icons-round">search</span>
        <input id="super-search-input" type="search" autocomplete="off" placeholder="Search this screen, settings, pages, and tools" aria-controls="super-search-results">
        <kbd>Esc</kbd>
      </label>
      <div id="super-search-status" class="super-search-status" aria-live="polite"></div>
      <div id="super-search-results" class="super-search-results" role="listbox"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('.super-search-close')) closeSuperSearch();
    const row = event.target.closest('[data-super-result]');
    if (row) activate(+row.dataset.superResult);
  });
  overlay.querySelector('input').addEventListener('input', render);
  return overlay;
}

function matches(query) {
  const normalizedQuery = normalize(query);
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!words.length) return _entries.slice(0, 12);
  return _entries
    .filter(entry => words.every(word => entry.search.includes(word)))
    .map(entry => {
      let score = words.reduce((total, word) => total + (entry.search.startsWith(word) ? 8 : entry.search.includes(` ${word}`) ? 4 : 1), 0);
      if (entry.search === normalizedQuery) score += 20;
      if (entry.kind !== 'On this page') score += 2;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score || a.entry.text.length - b.entry.text.length)
    .slice(0, 30)
    .map(result => result.entry);
}

function render() {
  const overlay = ensureOverlay();
  const input = overlay.querySelector('input');
  const query = input.value.trim();
  const results = matches(query);
  if (query && !results.length) {
    const catalog = ACTIONS[0];
    results.push({ ...catalog, text: `Search the full catalog for “${query}”` });
  }
  _active = Math.min(_active, Math.max(0, results.length - 1));
  overlay._results = results;
  overlay.querySelector('.super-search-status').textContent = results.length
    ? `${results.length} result${results.length === 1 ? '' : 's'}`
    : 'No matching content, controls, pages, or tools';
  overlay.querySelector('.super-search-results').innerHTML = results.map((entry, index) => `
    <button type="button" role="option" aria-selected="${index === _active}" class="super-search-result${index === _active ? ' active' : ''}" data-super-result="${index}">
      ${entry.image
        ? `<img class="super-search-result-art" src="${esc(entry.image)}" alt="">`
        : `<span class="material-icons-round super-search-result-icon">${entry.icon || (entry.kind === 'On this page' ? 'subject' : 'movie')}</span>`}
      <span><strong>${esc(entry.text)}</strong><small>${esc(entry.detail ? `${entry.kind} · ${entry.detail}` : entry.kind)}</small></span>
      ${entry.setting?.type === 'boolean'
        ? `<span class="super-search-inline-state ${entry.setting.value ? 'on' : ''}">${entry.setting.value ? 'On' : 'Off'}</span>`
        : `<span class="material-icons-round super-search-result-go">${entry.setting ? 'tune' : 'north_east'}</span>`}
    </button>`).join('');
}

function activate(index) {
  const entry = ensureOverlay()._results?.[index];
  if (!entry) return;
  if (entry.setting) {
    if (entry.setting.type === 'boolean') {
      entry.setting.setValue(!entry.setting.value);
      _entries = buildIndex();
      render();
      return;
    }
    closeSuperSearch();
    goToPage('prefs').then(() => setTimeout(() => {
      const input = document.getElementById('sv-settings-search-input');
      if (!input) return;
      input.value = entry.setting.label;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }, 0));
    return;
  }
  closeSuperSearch();
  if (entry.action) {
    entry.action(ensureOverlay().querySelector('input').value.trim());
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Teleport: center the target both vertically AND inside its scroll row,
  // then spotlight it — the page dims for a beat so the eye lands on it
  entry.target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
  entry.target.classList.add('super-search-target');
  setTimeout(() => entry.target.classList.remove('super-search-target'), 1100);
  if (entry.target.matches('a,button,input,select,textarea,[tabindex]')) entry.target.focus({ preventScroll: true });
}

export function openSuperSearch() {
  const overlay = ensureOverlay();
  _previousFocus = document.activeElement;
  _entries = buildIndex();
  _active = 0;
  overlay.classList.add('open');
  const input = overlay.querySelector('input');
  input.value = '';
  render();
  requestAnimationFrame(() => input.focus());
}

export function closeSuperSearch() {
  const overlay = document.getElementById('super-search-overlay');
  if (!overlay?.classList.contains('open')) return false;
  overlay.classList.remove('open');
  _previousFocus?.focus?.();
  return true;
}

export function initSuperSearch({ isEnabled } = {}) {
  _enabled = isEnabled || _enabled;
  if (_listenerReady) return;
  _listenerReady = true;
  document.addEventListener('keydown', event => {
    const open = document.getElementById('super-search-overlay')?.classList.contains('open');
    if (open) {
      if (event.key === 'Escape') { event.preventDefault(); closeSuperSearch(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const count = ensureOverlay()._results?.length || 0;
        if (count) _active = (_active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
        render();
        ensureOverlay().querySelector(`[data-super-result="${_active}"]`)?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (event.key === 'Enter') { event.preventDefault(); activate(_active); return; }
      if (event.key === 'Tab') {
        const focusable = [...ensureOverlay().querySelectorAll('input,button')];
        const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
        if (document.activeElement === edge) {
          event.preventDefault();
          (event.shiftKey ? focusable.at(-1) : focusable[0]).focus();
        }
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && _enabled()) {
      event.preventDefault();
      openSuperSearch();
    }
  }, true);
}

// Register during module evaluation so Ctrl+F works even while the rest of the
// application is still completing asynchronous startup.
initSuperSearch();
