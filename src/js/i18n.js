/* ── I18N FOUNDATION ─────────────────────────────────────────────────
   Lightweight UI localization. English is the primary audience — this is
   the foundation, not a full translation system:

   • Interface language  — chrome strings (nav, footer, common buttons)
   • Metadata language   — what TMDB returns (titles, overviews)
   • Trailer language    — preferred audio language for trailers, when the
                           title actually has one (never implied otherwise)

   Choices are stored locally (sv_settings). "auto" follows the browser
   language when supported, otherwise English. Only app UI text is
   translated — movie/TV content itself is whatever the provider has. */

export const UI_LANGS = [
  { code: 'auto', label: 'Auto (browser)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português (Brasil)' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
];

const TMDB_CODES = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-BR', ja: 'ja-JP', ko: 'ko-KR', hi: 'hi-IN', zh: 'zh-CN' };

/* Starter dictionary — app chrome only. Extend by adding keys; missing
   keys always fall back to English. */
export const STRINGS = {
  en: {
    'nav.home': 'Home', 'nav.movies': 'Movies', 'nav.tv': 'TV Shows', 'nav.anime': 'Anime',
    'nav.clips': 'Clips', 'nav.library': 'Library', 'nav.customize': 'Customize Feed',
    'nav.search': 'Search',
    'footer.browse': 'Browse', 'footer.myspace': 'My Space', 'footer.community': 'Community', 'footer.legal': 'Legal',
    'common.play': 'Play', 'common.moreinfo': 'More Info', 'common.seeall': 'See All',
    'common.skip': 'Skip', 'common.next': 'Next', 'common.back': 'Back', 'common.save': 'Save', 'common.cancel': 'Cancel',
    'search.placeholder': 'Search movies, shows, anime…',
  },
  es: {
    'nav.home': 'Inicio', 'nav.movies': 'Películas', 'nav.tv': 'Series', 'nav.anime': 'Anime',
    'nav.clips': 'Clips', 'nav.library': 'Biblioteca', 'nav.customize': 'Personalizar',
    'nav.search': 'Buscar',
    'footer.browse': 'Explorar', 'footer.myspace': 'Mi Espacio', 'footer.community': 'Comunidad', 'footer.legal': 'Legal',
    'common.play': 'Reproducir', 'common.moreinfo': 'Más Info', 'common.seeall': 'Ver Todo',
    'common.skip': 'Omitir', 'common.next': 'Siguiente', 'common.back': 'Atrás', 'common.save': 'Guardar', 'common.cancel': 'Cancelar',
    'search.placeholder': 'Busca películas, series, anime…',
  },
  pt: {
    'nav.home': 'Início', 'nav.movies': 'Filmes', 'nav.tv': 'Séries', 'nav.anime': 'Anime',
    'nav.clips': 'Clips', 'nav.library': 'Biblioteca', 'nav.customize': 'Personalizar',
    'nav.search': 'Buscar',
    'footer.browse': 'Explorar', 'footer.myspace': 'Meu Espaço', 'footer.community': 'Comunidade', 'footer.legal': 'Legal',
    'common.play': 'Assistir', 'common.moreinfo': 'Mais Info', 'common.seeall': 'Ver Tudo',
    'common.skip': 'Pular', 'common.next': 'Próximo', 'common.back': 'Voltar', 'common.save': 'Salvar', 'common.cancel': 'Cancelar',
    'search.placeholder': 'Busque filmes, séries, anime…',
  },
  fr: {
    'nav.home': 'Accueil', 'nav.movies': 'Films', 'nav.tv': 'Séries', 'nav.anime': 'Animé',
    'nav.clips': 'Clips', 'nav.library': 'Bibliothèque', 'nav.customize': 'Personnaliser',
    'nav.search': 'Rechercher',
    'footer.browse': 'Parcourir', 'footer.myspace': 'Mon Espace', 'footer.community': 'Communauté', 'footer.legal': 'Mentions légales',
    'common.play': 'Lecture', 'common.moreinfo': "Plus d'infos", 'common.seeall': 'Voir tout',
    'common.skip': 'Passer', 'common.next': 'Suivant', 'common.back': 'Retour', 'common.save': 'Enregistrer', 'common.cancel': 'Annuler',
    'search.placeholder': 'Films, séries, animé…',
  },
  ja: {
    'nav.home': 'ホーム', 'nav.movies': '映画', 'nav.tv': 'テレビ番組', 'nav.anime': 'アニメ',
    'nav.clips': 'クリップ', 'nav.library': 'ライブラリ', 'nav.customize': 'カスタマイズ',
    'nav.search': '検索',
    'footer.browse': 'ブラウズ', 'footer.myspace': 'マイスペース', 'footer.community': 'コミュニティ', 'footer.legal': '法的情報',
    'common.play': '再生', 'common.moreinfo': '詳細', 'common.seeall': 'すべて見る',
    'common.skip': 'スキップ', 'common.next': '次へ', 'common.back': '戻る', 'common.save': '保存', 'common.cancel': 'キャンセル',
    'search.placeholder': '映画・番組・アニメを検索…',
  },
};

function _setting(id) {
  try { return JSON.parse(localStorage.getItem('sv_settings') || '{}')[id]; } catch { return undefined; }
}

function _browserLang() {
  const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return STRINGS[l] ? l : 'en';
}

/* Effective interface language code (en/es/pt/fr/ja) */
export function uiLang() {
  const set = _setting('uiLanguage');
  if (set && set !== 'auto' && STRINGS[set]) return set;
  return _browserLang();
}

/* TMDB `language` param for metadata (titles, overviews) */
export function tmdbLang() {
  const set = _setting('metaLanguage');
  const code = (set && set !== 'auto') ? set : uiLang();
  return TMDB_CODES[code] || 'en-US';
}

/* Preferred trailer audio language (ISO 639-1) or null for no preference.
   Used only to PREFER a matching trailer when one exists. */
export function trailerLang() {
  const set = _setting('trailerLanguage');
  const code = (set && set !== 'auto') ? set : uiLang();
  return code === 'en' ? null : code; // English is TMDB's default ordering
}

/* Translate a key; falls back to English, then to the key itself */
export function t(key) {
  const lang = uiLang();
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

/* Apply chrome translations to the static DOM. Safe to call repeatedly. */
export function applyUITranslations() {
  const set = (sel, key, attr = null) => {
    document.querySelectorAll(sel).forEach(el => {
      if (attr) el.setAttribute(attr, t(key));
      else el.textContent = t(key);
    });
  };
  set('.nav-tab[data-page="home"]', 'nav.home');
  set('.nav-tab[data-page="movies"]', 'nav.movies');
  set('.nav-tab[data-page="tv"]', 'nav.tv');
  set('.nav-tab[data-page="anime"]', 'nav.anime');
  set('.nav-tab[data-page="clips"]', 'nav.clips');
  set('.nav-tab[data-page="library"]', 'nav.library');
  set('.nav-tab[data-page="prefs"]', 'nav.customize');
  document.querySelectorAll('.bottom-nav-btn[data-page]').forEach(el => {
    const key = { home: 'nav.home', clips: 'nav.clips', search: 'nav.search', library: 'nav.library', prefs: 'nav.customize' }[el.dataset.page];
    const label = el.querySelector('.bn-label') || [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (key && label) label.textContent = t(key);
  });
  document.querySelectorAll('.footer-col h4').forEach(h => {
    const map = { 'Browse': 'footer.browse', 'My Space': 'footer.myspace', 'Community': 'footer.community', 'Legal': 'footer.legal' };
    const key = map[h.dataset.svEn || h.textContent.trim()];
    if (key) { h.dataset.svEn = h.dataset.svEn || h.textContent.trim(); h.textContent = t(key); }
  });
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = t('search.placeholder');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  document.documentElement.lang = uiLang();
}
