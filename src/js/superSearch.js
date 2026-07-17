import { esc } from './ui.js';

let _enabled = () => false;
let _previousFocus = null;
let _entries = [];
let _active = 0;

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
  root.querySelectorAll('.card, h1, h2, h3, .sec-title, p, [data-super-search]').forEach(el => {
    if (!visible(el) || el.closest('#super-search-overlay, nav, footer, .card-ov')) return;
    const card = el.closest('.card');
    const target = card || el;
    if (seen.has(target)) return;
    // Icon fonts render as glyphs but read as ligature names in
    // textContent ("nights_stay…") — strip them from the label
    let text = card?.dataset.title;
    if (!text) {
      const clone = target.cloneNode(true);
      clone.querySelectorAll('.material-icons-round, .material-icons').forEach(icon => icon.remove());
      text = clone.textContent || '';
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 2) return;
    seen.add(target);
    entries.push({
      target,
      text,
      search: `${text} ${card?.dataset.year || ''} ${card?.dataset.type || ''}`.toLowerCase(),
      kind: card ? (card.dataset.type === 'tv' ? 'TV show' : card.dataset.type === 'anime' ? 'Anime' : 'Movie') : 'On this page',
    });
  });
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
        <div><div id="super-search-title">Super Search</div><small>Find anything on this screen</small></div>
        <button type="button" class="super-search-close" aria-label="Close Super Search"><span class="material-icons-round">close</span></button>
      </div>
      <label class="super-search-input-wrap">
        <span class="material-icons-round">search</span>
        <input id="super-search-input" type="search" autocomplete="off" placeholder="Search visible titles, descriptions, and controls" aria-controls="super-search-results">
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
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return _entries.slice(0, 12);
  return _entries.filter(entry => words.every(word => entry.search.includes(word))).slice(0, 40);
}

function render() {
  const overlay = ensureOverlay();
  const input = overlay.querySelector('input');
  const results = matches(input.value.trim());
  _active = Math.min(_active, Math.max(0, results.length - 1));
  overlay._results = results;
  overlay.querySelector('.super-search-status').textContent = results.length
    ? `${results.length} result${results.length === 1 ? '' : 's'} on this screen`
    : 'No matches on this screen';
  overlay.querySelector('.super-search-results').innerHTML = results.map((entry, index) => `
    <button type="button" role="option" aria-selected="${index === _active}" class="super-search-result${index === _active ? ' active' : ''}" data-super-result="${index}">
      <span class="material-icons-round">${entry.kind === 'On this page' ? 'subject' : 'movie'}</span>
      <span><strong>${esc(entry.text)}</strong><small>${esc(entry.kind)}</small></span>
      <span class="material-icons-round">north_east</span>
    </button>`).join('');
}

function activate(index) {
  const entry = ensureOverlay()._results?.[index];
  if (!entry) return;
  closeSuperSearch();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Teleport: center the target both vertically AND inside its scroll row,
  // then spotlight it — the page dims for a beat so the eye lands on it
  entry.target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center', inline: 'center' });
  entry.target.classList.add('super-search-target');
  if (!reduced) {
    document.body.classList.add('super-search-dim');
    setTimeout(() => document.body.classList.remove('super-search-dim'), 1200);
  }
  setTimeout(() => entry.target.classList.remove('super-search-target'), 1600);
  if (entry.target.matches('.card')) entry.target.focus({ preventScroll: true });
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

export function initSuperSearch({ isEnabled }) {
  _enabled = isEnabled || _enabled;
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
