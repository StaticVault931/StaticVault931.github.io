const histories = new Map();

let getProfileId = () => 'default';
let announce = () => {};
let sequence = 0;
let dialog = null;
let restoreFocus = null;

function profileKey() {
  return String(getProfileId?.() || 'default');
}

function historyFor(key = profileKey()) {
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  }).format(timestamp);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function ensureDialog() {
  if (dialog?.isConnected) return dialog;
  dialog = document.createElement('div');
  dialog.id = 'undo-history-dialog';
  dialog.className = 'undo-history-overlay';
  dialog.hidden = true;
  dialog.innerHTML = `
    <section class="undo-history-panel" role="dialog" aria-modal="true" aria-labelledby="undo-history-title">
      <header class="undo-history-head">
        <div>
          <p class="undo-history-kicker">Current profile</p>
          <h2 id="undo-history-title">Undo history</h2>
        </div>
        <button type="button" class="icon-btn" data-undo-close aria-label="Close undo history" title="Close">
          <span class="material-icons-round" aria-hidden="true">close</span>
        </button>
      </header>
      <div class="undo-history-list" data-undo-list></div>
      <footer class="undo-history-foot">
        <p>Actions are cleared when this tab reloads or the profile changes.</p>
        <button type="button" class="btn-primary" data-undo-latest>Undo latest</button>
      </footer>
    </section>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.closest('[data-undo-close]')) closeUndoHistory();
    const button = event.target.closest('[data-undo-id]');
    if (button) undoManager.undo(Number(button.dataset.undoId));
    if (event.target.closest('[data-undo-latest]')) undoManager.undo();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeUndoHistory();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  return dialog;
}

function render() {
  const host = ensureDialog();
  const entries = historyFor().slice(-10).reverse();
  const list = host.querySelector('[data-undo-list]');
  const latest = host.querySelector('[data-undo-latest]');
  latest.disabled = entries.length === 0;
  list.innerHTML = entries.length ? entries.map(entry => `
    <article class="undo-history-item">
      <span class="material-icons-round" aria-hidden="true">${escapeHtml(entry.icon)}</span>
      <div>
        <strong>${escapeHtml(entry.label)}</strong>
        ${entry.title ? `<span>${escapeHtml(entry.title)}</span>` : ''}
        <time datetime="${new Date(entry.timestamp).toISOString()}">${formatTime(entry.timestamp)}</time>
      </div>
      <button type="button" data-undo-id="${entry.id}" aria-label="${escapeHtml(`Undo ${entry.label}${entry.title ? ` for ${entry.title}` : ''}`)}">Undo</button>
    </article>`).join('') : `
    <div class="undo-history-empty">
      <span class="material-icons-round" aria-hidden="true">history</span>
      <p>Nothing to undo yet.</p>
    </div>`;
}

export function openUndoHistory() {
  const host = ensureDialog();
  restoreFocus = document.activeElement;
  render();
  host.hidden = false;
  document.body.classList.add('modal-open');
  host.querySelector('[data-undo-close]')?.focus();
}

export function closeUndoHistory() {
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  document.body.classList.remove('modal-open');
  restoreFocus?.focus?.();
}

export const undoManager = {
  init(options = {}) {
    if (options.getProfileId) getProfileId = options.getProfileId;
    if (options.announce) announce = options.announce;
    ensureDialog();
    document.addEventListener('keydown', event => {
      if (event.key.toLowerCase() !== 'z' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      openUndoHistory();
    });
  },

  record({ label, title = '', icon = 'undo', undo }) {
    if (typeof undo !== 'function') return null;
    const entry = { id: ++sequence, label, title, icon, undo, timestamp: Date.now() };
    const history = historyFor();
    history.push(entry);
    if (history.length > 50) history.shift();
    if (dialog && !dialog.hidden) render();
    return entry.id;
  },

  undo(id = null) {
    const history = historyFor();
    const index = id == null ? history.length - 1 : history.findIndex(entry => entry.id === id);
    if (index < 0) return false;
    const [entry] = history.splice(index, 1);
    entry.undo();
    announce(`Undid ${entry.label}`, 'undo');
    if (dialog && !dialog.hidden) render();
    return true;
  },

  list(limit = 10) {
    return historyFor().slice(-Math.max(0, limit)).reverse().map(({ undo: _undo, ...entry }) => entry);
  },

  clearForProfile(profileId = profileKey()) {
    histories.delete(String(profileId));
    if (dialog && !dialog.hidden) render();
  },
};
