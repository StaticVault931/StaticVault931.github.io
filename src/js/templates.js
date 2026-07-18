/**
 * templates.js — All large overlay / dialog HTML injected at runtime.
 * Keeps index.html lean; these elements are not needed for initial paint or SEO.
 */

// injectTestPanel() removed — test panel is now built inline in populateTestPanel()
// and appended directly to the CYF page element.

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
      <button class="modal-panel-toggle" id="left-panel-toggle" title="Toggle info panel" aria-label="Toggle info panel">
        <span class="material-icons-round">view_sidebar</span>
      </button>
      <div class="provider-bar" id="provider-bar" aria-label="Video sources"></div>
      <button class="modal-panel-toggle modal-panel-toggle-r" id="right-panel-toggle" title="Toggle episodes panel" aria-label="Toggle episodes panel">
        <span class="material-icons-round">view_sidebar</span>
      </button>
    </div>
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
              allow="autoplay; fullscreen"
              referrerpolicy="no-referrer"
              title="Content player">
            </iframe>
          </div>
          <div id="age-warn" style="display:none" role="alertdialog" aria-labelledby="age-warn-title">
            <span class="age-warn-rating" id="age-warn-rating"></span>
            <h2 id="age-warn-title">Age Restricted</h2>
            <p id="age-warn-msg">This content is above your selected age rating.</p>
            <div class="warn-btns">
              <button class="warn-proceed" id="warn-proceed-btn">Watch Anyway</button>
              <button class="warn-allow-type" id="warn-allow-type-btn">Allow this rating</button>
              <button class="warn-allow-all" id="warn-allow-all-btn">Allow all content</button>
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
      allow="autoplay; fullscreen"
      title="Trailer preview">
    </iframe>
    <img class="nc-backdrop" id="nc-backdrop" alt="">
    <div class="nc-video-gradient"></div>
    <div class="nc-yt-mask"></div>
  </div>
  <div class="nc-info">
    <div class="nc-title-row">
      <div class="nc-title" id="nc-title"></div>
      <span class="nc-type-pill" id="nc-type-pill"></span>
    </div>
    <div class="nc-action-row">
      <button class="nc-btn nc-btn-play" id="nc-play" title="Play" aria-label="Play"><span class="material-icons-round">play_arrow</span></button>
      <button class="nc-btn nc-btn-wl"   id="nc-wl"   title="Save" aria-label="Save to watchlist"><span class="material-icons-round">add</span></button>
      <button class="nc-btn nc-btn-like" id="nc-like" title="Like" aria-label="Like"><span class="material-icons-round">thumb_up_off_alt</span></button>
      <button class="nc-btn nc-btn-dislike" id="nc-dislike" title="Not my taste" aria-label="Not my taste"><span class="material-icons-round">thumb_down_off_alt</span></button>
      <button class="nc-btn nc-btn-watched" id="nc-watched" title="Already watched" aria-label="Mark as already watched"><span class="material-icons-round">check_circle_outline</span></button>
      <button class="nc-btn nc-btn-mute" id="nc-mute" title="Sound on/off" aria-label="Sound on or off"><span class="material-icons-round">volume_off</span></button>
      <button class="nc-btn nc-btn-more" id="nc-more" title="More info" aria-label="More info"><span class="material-icons-round">expand_more</span></button>
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

  // ── TRAILER OVERLAY (separate iframe, no streaming sandbox) ──────
  const trailer = document.createElement('div');
  trailer.id = 'trailer-overlay';
  trailer.innerHTML = `
  <div class="trailer-overlay-card">
    <div class="trailer-ov-header">
      <span class="trailer-ov-title" id="trailer-ov-title"></span>
      <button class="trailer-ov-close" id="trailer-ov-close" aria-label="Close trailer">
        <span class="material-icons-round">close</span>
      </button>
    </div>
    <div class="trailer-ov-video">
      <iframe id="trailer-ov-frame"
        allow="autoplay; fullscreen"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        title="Trailer">
      </iframe>
      <div class="trailer-ov-fallback" id="trailer-ov-fallback" style="display:none">
        <img class="trailer-ov-bg" id="trailer-ov-bg" alt="">
        <div class="trailer-ov-fallback-msg">
          <span class="material-icons-round">videocam_off</span>
          <p>Trailer embedding disabled by video owner.</p>
          <a id="trailer-ov-yt-link" target="_blank" rel="noopener" class="btn-next-source">
            <span class="material-icons-round">open_in_new</span> Watch on YouTube
          </a>
        </div>
      </div>
    </div>
  </div>`;
  frag.appendChild(trailer);

  // ── INFO PAGE OVERLAY ─────────────────────────────────────────────
  const info = document.createElement('div');
  info.id = 'info-overlay';
  info.setAttribute('role', 'dialog');
  info.setAttribute('aria-modal', 'true');
  info.setAttribute('aria-label', 'Content information');
  info.innerHTML = `
  <div id="info-panel">
    <div class="info-toolbar">
      <button id="info-close" aria-label="Close info"><span class="material-icons-round">close</span></button>
      <div class="info-toolbar-title" id="info-toolbar-title"></div>
      <button class="info-play-btn-big" id="info-play-btn" title="Watch now">
        <span class="material-icons-round">play_circle_filled</span> Watch Now
      </button>
      <button class="info-toolbar-btn info-wt-btn" id="info-watch-together" title="Watch Together">
        <span class="material-icons-round">group</span>
      </button>
      <button class="info-toolbar-btn" id="info-share-btn" title="Share">
        <span class="material-icons-round">share</span>
      </button>
      <label class="info-default-toggle" title="Make info page your default opening mode">
        <input type="checkbox" id="info-default-cb"> Default
      </label>
    </div>
    <div class="info-body">
      <div class="info-hero" id="info-hero">
        <div class="info-hero-gradient"></div>
        <img class="info-hero-img" id="info-hero-img" alt="" loading="lazy">
        <div class="info-hero-content">
          <div class="info-poster-wrap">
            <img class="info-poster" id="info-poster" alt="" loading="lazy">
          </div>
          <div class="info-header">
            <div class="info-tags" id="info-tags"></div>
            <h1 class="info-title" id="info-title"></h1>
            <div class="info-meta-row" id="info-meta"></div>
            <div class="info-overview" id="info-overview"></div>
          </div>
        </div>
      </div>
      <div class="info-content">
        <!-- ── LEFT / MAIN COLUMN ───────────────────────────── -->
        <div class="info-col-main">
          <!-- Trailer -->
          <div class="info-trailer-wrap" id="info-trailer-wrap">
            <div class="info-section-label">Trailer</div>
            <div class="info-trailer-inner">
              <iframe id="info-trailer-frame"
                allow="autoplay; fullscreen"
                referrerpolicy="strict-origin-when-cross-origin"
                title="Trailer">
              </iframe>
              <div class="info-trailer-fallback" id="info-trailer-fallback" style="display:none">
                <span class="material-icons-round">videocam_off</span>
                <p>No trailer available</p>
              </div>
            </div>
          </div>

          <!-- OMDb: IMDb / RT / Metacritic rating pills -->
          <div class="info-multi-ratings" id="info-multi-ratings" style="display:none"></div>
          <!-- Awards banner -->
          <div class="info-awards-banner" id="info-awards-banner" style="display:none"></div>

          <!-- Where to Watch -->
          <div class="info-section" id="info-wtw-section" style="display:none">
            <div class="info-section-label">Where to Watch</div>
            <div class="info-where-to-watch" id="info-where-to-watch"></div>
          </div>

          <!-- Part of a collection / franchise — shows actual movies -->
          <div class="info-section" id="info-collection-section" style="display:none">
            <div class="info-section-label" style="display:flex;align-items:center;gap:.5rem">
              <span>Part of a Collection</span>
              <span class="info-collection-link" id="info-collection-link" style="display:none;font-size:.75rem;cursor:pointer;color:var(--gold);border-bottom:1px dotted var(--gold)"></span>
            </div>
            <div class="info-collection-grid" id="info-collection-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.5rem;margin-top:.5rem"></div>
          </div>

          <!-- Cast -->
          <div class="info-section" id="info-cast-section">
            <div class="info-section-label">Cast</div>
            <div class="info-cast-row" id="info-cast-row"></div>
          </div>

          <!-- Keywords / Anime Tags -->
          <div class="info-section" id="info-keywords-section" style="display:none">
            <div class="info-section-label">Tags</div>
            <div id="info-keywords-tags"></div>
            <div id="info-ani-tags"></div>
          </div>
        </div>

        <!-- ── RIGHT / SIDE COLUMN ────────────────────────── -->
        <div class="info-col-side">
          <!-- Score + details panel -->
          <div class="info-ratings-wrap" id="info-ratings"></div>

          <!-- Actions (Watch / Save / Like) -->
          <div class="info-actions" id="info-actions"></div>

          <!-- Episodes (TV shows) — lives in side column -->
          <div class="info-section" id="info-eps-section" style="display:none">
            <div class="info-section-label">Episodes</div>
            <div class="info-ep-controls">
              <select id="info-season-sel" class="info-season-sel" aria-label="Select season"></select>
            </div>
            <div class="info-ep-grid" id="info-ep-grid"></div>
          </div>

          <!-- More Like This — side column -->
          <div class="info-section" id="info-related-section">
            <div class="info-section-label">More Like This</div>
            <div class="info-related-grid" id="info-related-grid"></div>
          </div>

          <!-- More with this Cast -->
          <div class="info-section" id="info-cast-also-section" style="display:none">
            <div class="info-section-label">More with this Cast</div>
            <div class="info-related-grid" id="info-cast-also-grid"></div>
          </div>
        </div>
      </div>

      <!-- ── REVIEWS — full width at bottom ─────────────── -->
      <div class="info-reviews-outer" id="info-reviews-outer" style="display:none">
        <div class="info-section-label" style="padding:0 3rem .75rem">Reviews</div>
        <div class="info-reviews" id="info-reviews-list" style="padding:0 3rem 3rem;display:flex;flex-wrap:wrap;gap:.75rem"></div>
      </div>
    </div>
  </div>`;
  frag.appendChild(info);

  // ── PERSON OVERLAY ─────────────────────────────────────────────────
  const person = document.createElement('div');
  person.id = 'person-overlay';
  person.setAttribute('role', 'dialog');
  person.innerHTML = `
<div id="person-panel">
  <button id="person-close" aria-label="Close person page"><span class="material-icons-round">close</span></button>
  <div class="person-layout">
    <aside class="person-sidebar">
      <img class="person-photo" id="person-photo" alt="" loading="lazy">
      <h2 class="person-name" id="person-name">Loading…</h2>
      <div class="person-meta" id="person-meta"></div>
      <div class="person-bio" id="person-bio"></div>
    </aside>
    <div class="person-content">
      <div class="person-credits-header">
        <button class="person-tab on" data-tab="all">All</button>
        <button class="person-tab" data-tab="movie">Movies</button>
        <button class="person-tab" data-tab="tv">TV Shows</button>
      </div>
      <div class="person-network" id="person-network" aria-live="polite"></div>
      <div class="search-grid person-grid" id="person-grid"></div>
    </div>
  </div>
</div>`;
  frag.appendChild(person);

  // ── COMPANY / COLLECTION / PROVIDER PAGE OVERLAY ─────────────────
  const company = document.createElement('div');
  company.id = 'company-overlay';
  company.setAttribute('role', 'dialog');
  company.innerHTML = `
<div id="company-panel">
  <!-- Sticky toolbar -->
  <div class="company-toolbar">
    <button id="company-close" aria-label="Close">
      <span class="material-icons-round">arrow_back</span>
    </button>
    <div class="company-toolbar-info">
      <img id="company-logo" class="company-logo-sm" src="" alt="" style="display:none">
      <span class="company-name"></span>
    </div>
    <!-- View mode toggle -->
    <div class="company-view-btns">
      <button class="company-view-btn on" id="cv-btn-row" title="Row view">
        <span class="material-icons-round">view_agenda</span>
      </button>
      <button class="company-view-btn" id="cv-btn-compact" title="Compact grid">
        <span class="material-icons-round">grid_view</span>
      </button>
    </div>
  </div>
  <!-- Hero with backdrop or brand color -->
  <div class="company-hero" id="company-hero">
    <div class="company-hero-gradient"></div>
    <img id="company-hero-img" class="company-hero-img" src="" alt="" style="display:none">
    <div class="company-hero-content">
      <img id="company-logo-big" class="company-logo-big" src="" alt="" style="display:none">
      <div>
        <h1 class="company-name-big"></h1>
        <p id="company-parent" class="company-parent"></p>
        <p id="company-desc" class="company-desc"></p>
      </div>
    </div>
  </div>
  <!-- Content area: row view or grid view -->
  <div id="company-content-area">
    <!-- Row view: home-style rows (movies row + TV row) -->
    <div id="company-row-view">
      <div class="section" id="company-movies-sec" style="display:none">
        <div class="sec-header"><div class="sec-title"><span class="material-icons-round sec-icon">movie</span>Movies</div></div>
        <div class="row-wrap"><div class="row-arrow row-arrow-l hidden"><button data-scroll-row="company-movies-row" data-scroll-dir="-1"><span class="material-icons-round">chevron_left</span></button></div>
        <div class="card-row" id="company-movies-row"></div>
        <div class="row-arrow row-arrow-r"><button data-scroll-row="company-movies-row" data-scroll-dir="1"><span class="material-icons-round">chevron_right</span></button></div></div>
      </div>
      <div class="section" id="company-tv-sec" style="display:none">
        <div class="sec-header"><div class="sec-title"><span class="material-icons-round sec-icon">tv</span>TV Shows</div></div>
        <div class="row-wrap"><div class="row-arrow row-arrow-l hidden"><button data-scroll-row="company-tv-row" data-scroll-dir="-1"><span class="material-icons-round">chevron_left</span></button></div>
        <div class="card-row" id="company-tv-row"></div>
        <div class="row-arrow row-arrow-r"><button data-scroll-row="company-tv-row" data-scroll-dir="1"><span class="material-icons-round">chevron_right</span></button></div></div>
      </div>
    </div>
    <!-- Compact view: dense grid, no labels -->
    <div id="company-compact-view" style="display:none">
      <div class="company-grid" id="company-grid"></div>
    </div>
  </div>
</div>`;
  frag.appendChild(company);

  // ── PROFILES OVERLAY ──────────────────────────────────────────────
  const profiles = document.createElement('div');
  profiles.id = 'profiles-overlay';
  profiles.setAttribute('role', 'dialog');
  profiles.setAttribute('aria-label', 'Switch profile');
  profiles.innerHTML = `
  <div id="profiles-panel">
    <div class="profiles-header">
      <h2>Who's watching?</h2>
      <button id="profiles-close" aria-label="Close"><span class="material-icons-round">close</span></button>
    </div>
    <div class="profiles-grid" id="profiles-grid"></div>
    <div class="profiles-actions">
      <button class="profiles-add-btn" id="profiles-add-btn">
        <span class="material-icons-round">add_circle</span> Add Profile
      </button>
    </div>
  </div>`;
  frag.appendChild(profiles);

  // ── PROFILE EDITOR ────────────────────────────────────────────────
  const profileEditor = document.createElement('div');
  profileEditor.id = 'profile-editor-overlay';
  profileEditor.innerHTML = `
  <div class="profile-editor-panel">
    <div class="profile-editor-header">
      <h2 id="profile-editor-title">New Profile</h2>
      <button id="profile-editor-close" aria-label="Close"><span class="material-icons-round">close</span></button>
    </div>
    <div class="profile-editor-body">
      <!-- Left: avatar -->
      <div class="pe-avatar-col">
        <div class="profile-avatar-preview" id="profile-avatar-preview">
          <span class="material-icons-round">person</span>
        </div>
        <div class="profile-crop-controls" id="profile-crop-controls" hidden>
          <label>Zoom <input type="range" id="profile-crop-zoom" min="100" max="260" value="100"></label>
          <label>Horizontal <input type="range" id="profile-crop-x" min="0" max="100" value="50"></label>
          <label>Vertical <input type="range" id="profile-crop-y" min="0" max="100" value="50"></label>
        </div>
        <div class="pe-quick-avatars" id="pe-quick-avatars">
          <div class="pe-quick-avatar pe-qa-default" data-avatar="" title="Default">
            <span class="material-icons-round">person</span>
          </div>
          <div class="pe-quick-avatar" data-avatar="assets/icons/favicon.png" title="StaticVault931">
            <img src="assets/icons/favicon.png" alt="StaticVault931">
          </div>
          <div class="pe-quick-avatar" data-avatar="https://cdn.jsdelivr.net/gh/StaticQuasar931/Images@main/squarestaticquasar931logo.jpg" title="StaticQuasar931">
            <img src="https://cdn.jsdelivr.net/gh/StaticQuasar931/Images@main/squarestaticquasar931logo.jpg" alt="StaticQuasar931">
          </div>
          <button class="pe-more-avatars-btn" id="profile-change-avatar-btn" title="Search actors / more options">
            <span class="material-icons-round">search</span>
          </button>
        </div>
      </div>
      <!-- Right: fields -->
      <div class="pe-fields-col">
        <label class="profile-field-label">Profile Name
          <input class="pref-input" id="profile-name-input" placeholder="Enter a name…" maxlength="20" autocomplete="off">
        </label>
        <label class="profile-field-label">Accent Color
          <div class="profile-color-row" id="profile-color-row"></div>
        </label>
        <label class="ob-kids-row" for="profile-kids-toggle" style="margin-top:.8rem">
          <span class="material-icons-round" style="color:#fbbf24">child_care</span>
          <span class="ob-kids-text"><b>Kid-Guided Mode</b><br>
            <small>G-level rows, kid-safe trending &amp; search, no anime rows. Synced with Settings → Content. Guidance, not a lock.</small></span>
          <input type="checkbox" id="profile-kids-toggle" class="ob-kids-check">
        </label>
        <div class="profile-editor-actions">
          <button class="ma primary" id="profile-save-btn">Save</button>
          <button class="ma" id="profile-onboard-btn" title="Open the taste picker again — your current preferences stay"><span class="material-icons-round" style="font-size:1rem">tune</span> Onboarding</button>
          <button class="ma" id="profile-onboard-reset-btn" title="Clear ALL taste preferences (genres, languages, loved/hidden titles) and redo onboarding fresh"><span class="material-icons-round" style="font-size:1rem">restart_alt</span> Reset &amp; Redo</button>
          <button class="ma danger" id="profile-delete-btn" style="display:none"><span class="material-icons-round" style="font-size:1rem">delete</span> Delete</button>
        </div>
      </div>
    </div>
  </div>`;
  frag.appendChild(profileEditor);

  document.body.appendChild(frag);
}
