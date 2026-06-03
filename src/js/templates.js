/**
 * templates.js — All large overlay / dialog HTML injected at runtime.
 * Keeps index.html lean; these elements are not needed for initial paint or SEO.
 */

export function injectTestPanel() {
  if (document.getElementById('test-mode-panel')) return;
  const el = document.createElement('div');
  el.id = 'test-mode-panel';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
  <div class="test-panel-inner">
    <div class="test-panel-hdr">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--red)" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5 2.5h-5L8 9H3l7 13 2-7h4l2 7 7-13h-5L14.5 2.5z" stroke="none"/>
      </svg>
      <span>Testing Mode</span>
      <button class="test-close" id="test-close-btn">×</button>
    </div>
    <div class="test-panel-body">
      <div class="test-col">
        <div class="test-group-label">Themes</div>
        <div class="test-btn-row">
          <button class="test-btn" onclick="document.documentElement.dataset.theme='dark'">Dark</button>
          <button class="test-btn" onclick="document.documentElement.dataset.theme='light'">Light</button>
          <button class="test-btn" onclick="document.documentElement.dataset.theme='midnight'">Midnight</button>
          <button class="test-btn" onclick="document.documentElement.dataset.theme='warm'">Warm</button>
        </div>
        <div class="test-group-label" style="margin-top:.6rem">Ratings</div>
        <div class="test-btn-row">
          <span class="card-rating rating-great"><span class="material-icons-round">star</span>9.5</span>
          <span class="card-rating rating-good"><span class="material-icons-round">star</span>7.8</span>
          <span class="card-rating rating-ok"><span class="material-icons-round">star</span>5.4</span>
          <span class="card-rating rating-bad"><span class="material-icons-round">star</span>3.1</span>
        </div>
        <div class="test-group-label" style="margin-top:.6rem">Features</div>
        <div class="test-btn-row">
          <button class="test-btn" id="test-no-images-btn">Hide Images</button>
          <button class="test-btn" id="test-adblock-btn">AdBlock: ON</button>
          <button class="test-btn" id="test-clear-cache-btn">Clear Cache</button>
        </div>
      </div>
      <div class="test-col test-providers-col">
        <div class="test-group-label">Provider Status <button class="test-btn test-btn-small" id="test-all-providers-btn">Test All</button></div>
        <div id="test-providers-list" class="test-providers-list"></div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(el);
}

export function injectOverlays() {
  const frag = document.createDocumentFragment();

  // ── MODAL ──────────────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.id = 'modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Content details');
  modal.innerHTML = `
  <div id="modal">
    <div class="modal-top-bar">
      <button id="modal-close" aria-label="Close">
        <span class="material-icons-round">close</span>
      </button>
      <div class="modal-top-spacer"></div>
      <button class="modal-panel-toggle" id="left-panel-toggle" title="Toggle info panel" aria-label="Toggle info panel">
        <span class="material-icons-round">view_sidebar</span>
      </button>
      <button class="modal-panel-toggle" id="right-panel-toggle" title="Toggle episodes panel" aria-label="Toggle episodes panel">
        <span class="material-icons-round">view_sidebar</span>
      </button>
    </div>
    <div class="provider-bar" id="provider-bar" aria-label="Video sources"></div>
    <div class="modal-body">
      <div class="modal-left-panel" id="modal-left-panel">
        <div class="modal-poster-wrap" id="modal-poster">
          <div class="modal-ph sk" style="aspect-ratio:2/3;width:100%;border-radius:6px;"></div>
        </div>
        <div class="modal-meta">
          <div id="modal-title"></div>
          <div class="modal-tags" id="modal-tags"></div>
          <div class="modal-actions" id="modal-actions"></div>
          <div class="modal-ratings" id="modal-ratings"></div>
          <div id="modal-plot"></div>
        </div>
        <div class="modal-cast-section">
          <div class="cast-section-label">Cast</div>
          <div class="cast-row" id="modal-cast-row"></div>
        </div>
      </div>
      <div class="modal-center-col">
        <div class="player-area">
          <div class="player-wrap">
            <div class="player-loading" id="player-loading">
              <div class="spin"></div>
              <p>Loading player…</p>
            </div>
            <iframe id="player-frame"
              sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation"
              allowfullscreen
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerpolicy="no-referrer"
              title="Content player">
            </iframe>
          </div>
          <div id="age-warn" style="display:none" role="alertdialog" aria-labelledby="age-warn-title">
            <h2 id="age-warn-title">Age Restricted</h2>
            <p id="age-warn-msg">This content may be above your selected age rating.</p>
            <div class="warn-btns">
              <button class="warn-proceed" id="warn-proceed-btn">Watch Anyway</button>
              <button class="warn-back" id="warn-back-btn">Go Back</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-right-panel" id="modal-right-panel">
        <div id="modal-ep-sidebar"></div>
        <div id="modal-related-section"></div>
      </div>
    </div>
  </div>`;
  frag.appendChild(modal);

  // ── TOAST ──────────────────────────────────────────────────────────
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `<span class="material-icons-round" id="ti">info</span><span id="tm"></span>`;
  frag.appendChild(toast);

  // ── NETFLIX HOVER CARD ─────────────────────────────────────────────
  const nc = document.createElement('div');
  nc.id = 'netflix-card';
  nc.setAttribute('aria-hidden', 'true');
  nc.innerHTML = `
  <div class="nc-video">
    <iframe id="nc-frame"
      sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerpolicy="no-referrer"
      title="Trailer preview">
    </iframe>
    <img class="nc-backdrop" id="nc-backdrop" alt="">
    <div class="nc-video-gradient"></div>
  </div>
  <div class="nc-info">
    <div class="nc-title-row">
      <div class="nc-title" id="nc-title"></div>
      <span class="nc-type-pill" id="nc-type-pill"></span>
    </div>
    <div class="nc-action-row">
      <button class="nc-btn nc-btn-play" id="nc-play" title="Play"><span class="material-icons-round">play_arrow</span></button>
      <button class="nc-btn nc-btn-wl"   id="nc-wl"   title="Save"><span class="material-icons-round">add</span></button>
      <button class="nc-btn nc-btn-like" id="nc-like" title="Like"><span class="material-icons-round">thumb_up_off_alt</span></button>
      <button class="nc-btn nc-btn-more" id="nc-more" title="More info"><span class="material-icons-round">expand_more</span></button>
    </div>
    <div class="nc-meta-row" id="nc-meta"></div>
    <div class="nc-genres-row" id="nc-genres"></div>
  </div>`;
  frag.appendChild(nc);

  // ── SHORTCUTS MODAL ────────────────────────────────────────────────
  const shortcuts = document.createElement('div');
  shortcuts.id = 'shortcuts-overlay';
  shortcuts.setAttribute('role', 'dialog');
  shortcuts.setAttribute('aria-label', 'Keyboard shortcuts');
  shortcuts.innerHTML = `
  <div id="shortcuts-modal">
    <div class="shortcuts-header">
      <h2><span class="material-icons-round">keyboard</span> Keyboard Shortcuts</h2>
      <button id="shortcuts-close" aria-label="Close"><span class="material-icons-round">close</span></button>
    </div>
    <div id="shortcuts-grid" class="shortcuts-grid"></div>
    <p class="shortcuts-tip">Press <kbd>?</kbd> anytime · <kbd>Shift+click</kbd> Apply = no redirect</p>
  </div>`;
  frag.appendChild(shortcuts);

  // ── LEGAL OVERLAY ─────────────────────────────────────────────────
  const legal = document.createElement('div');
  legal.id = 'legal-overlay';
  legal.innerHTML = `
  <div id="legal-modal">
    <button id="legal-close" aria-label="Close"><span class="material-icons-round">close</span></button>
    <div id="legal-content"></div>
  </div>`;
  frag.appendChild(legal);

  // ── CONFIRM DIALOG ─────────────────────────────────────────────────
  const confirm = document.createElement('div');
  confirm.id = 'confirm-overlay';
  confirm.setAttribute('role', 'alertdialog');
  confirm.setAttribute('aria-modal', 'true');
  confirm.setAttribute('aria-labelledby', 'confirm-title');
  confirm.innerHTML = `
  <div id="confirm-dialog">
    <div class="confirm-icon"><span class="material-icons-round">warning_amber</span></div>
    <div id="confirm-title">Are you sure?</div>
    <div id="confirm-msg"></div>
    <div class="confirm-btns">
      <button class="confirm-btn-ok" id="confirm-ok">Confirm</button>
      <button class="confirm-btn-cancel" id="confirm-cancel">Cancel</button>
    </div>
  </div>`;
  frag.appendChild(confirm);

  // ── SHARE MENU ─────────────────────────────────────────────────────
  const share = document.createElement('div');
  share.id = 'share-overlay';
  share.setAttribute('role', 'dialog');
  share.setAttribute('aria-label', 'Share options');
  share.innerHTML = `
  <div id="share-menu">
    <div class="share-header">
      <h3><span class="material-icons-round">share</span> Share</h3>
      <button id="share-close" aria-label="Close"><span class="material-icons-round">close</span></button>
    </div>
    <div id="share-title-preview" class="share-title-preview"></div>
    <div class="share-options">
      <button class="share-opt" id="share-copy"><span class="material-icons-round">content_copy</span>Copy Link</button>
      <button class="share-opt" id="share-twitter"><span class="material-icons-round">open_in_new</span>Share on X/Twitter</button>
      <button class="share-opt" id="share-info-page"><span class="material-icons-round">info</span>Copy Info Page Link</button>
      <button class="share-opt" id="share-native" style="display:none"><span class="material-icons-round">ios_share</span>Share via…</button>
    </div>
  </div>`;
  frag.appendChild(share);

  document.body.appendChild(frag);
}
