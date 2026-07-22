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

const EXTRA_STRINGS = {
  en: { 'search.filters':'Filters','search.all':'All','search.top':'Top Rated','search.new':'New Releases','search.everything':'Everything','search.mix':'Mix','library.title':'My Library','library.subtitle':'Your watchlist, liked titles, and viewing history','library.mix':'Mix & Match','library.taste':'Taste Profile','library.service':'Browse by service','library.continue':'Continue Watching','library.watchlist':'Watchlist','library.liked':'Liked','library.recent':'Recently Viewed','prefs.title':'Customize Your Feed','prefs.subtitle':'Tell us what you love. Changes apply automatically when you leave.','prefs.autosaved':'Auto-saved','prefs.taste':'Your Taste' },
  es: { 'search.filters':'Filtros','search.all':'Todo','search.top':'Mejor valorado','search.new':'Estrenos','search.everything':'Todo el catalogo','search.mix':'Mezclar','library.title':'Mi biblioteca','library.subtitle':'Tu lista, titulos favoritos e historial','library.mix':'Mezclar y combinar','library.taste':'Perfil de gustos','library.service':'Explorar por servicio','library.continue':'Seguir viendo','library.watchlist':'Mi lista','library.liked':'Me gusta','library.recent':'Visto recientemente','prefs.title':'Personaliza tu contenido','prefs.subtitle':'Cuentanos que te gusta. Los cambios se aplican automaticamente al salir.','prefs.autosaved':'Guardado automatico','prefs.taste':'Tus gustos' },
  pt: { 'search.filters':'Filtros','search.all':'Tudo','search.top':'Mais bem avaliados','search.new':'Lancamentos','search.everything':'Catalogo completo','search.mix':'Misturar','library.title':'Minha biblioteca','library.subtitle':'Sua lista, titulos curtidos e historico','library.mix':'Misturar e combinar','library.taste':'Perfil de gosto','library.service':'Explorar por servico','library.continue':'Continuar assistindo','library.watchlist':'Minha lista','library.liked':'Curtidos','library.recent':'Vistos recentemente','prefs.title':'Personalize seu conteudo','prefs.subtitle':'Conte o que voce gosta. As alteracoes sao aplicadas ao sair.','prefs.autosaved':'Salvo automaticamente','prefs.taste':'Seu gosto' },
  fr: { 'search.filters':'Filtres','search.all':'Tout','search.top':'Les mieux notes','search.new':'Nouveautes','search.everything':'Tout le catalogue','search.mix':'Melanger','library.title':'Ma bibliotheque','library.subtitle':'Votre liste, vos favoris et votre historique','library.mix':'Melanger','library.taste':'Profil de gouts','library.service':'Parcourir par service','library.continue':'Continuer a regarder','library.watchlist':'Ma liste','library.liked':'Aimes','library.recent':'Vus recemment','prefs.title':'Personnaliser votre selection','prefs.subtitle':'Dites-nous ce que vous aimez. Les changements s appliquent en quittant.','prefs.autosaved':'Enregistre automatiquement','prefs.taste':'Vos gouts' },
  ja: { 'search.filters':'フィルター','search.all':'すべて','search.top':'高評価','search.new':'新着','search.everything':'全カタログ','search.mix':'ミックス','library.title':'マイライブラリ','library.subtitle':'ウォッチリスト、お気に入り、視聴履歴','library.mix':'ミックス＆マッチ','library.taste':'好みのプロフィール','library.service':'サービス別に探す','library.continue':'視聴を続ける','library.watchlist':'ウォッチリスト','library.liked':'お気に入り','library.recent':'最近見た作品','prefs.title':'フィードをカスタマイズ','prefs.subtitle':'好みを教えてください。移動時に自動適用されます。','prefs.autosaved':'自動保存','prefs.taste':'あなたの好み' },
};
Object.entries(EXTRA_STRINGS).forEach(([language, values]) => Object.assign(STRINGS[language], values));

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
  const setTail = (sel, key) => {
    document.querySelectorAll(sel).forEach(el => {
      const text = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (text) text.textContent = t(key);
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
  setTail('#sf-advanced-toggle', 'search.filters');
  setTail('.sf-chip[data-f="all"]', 'search.all');
  setTail('.sf-chip[data-f="top"]', 'search.top');
  setTail('.sf-chip[data-f="recent"]', 'search.new');
  setTail('.sf-chip[data-f="everything"]', 'search.everything');
  setTail('#sf-shuffle-btn', 'search.mix');
  set('#page-library .lib-header h2', 'library.title');
  set('#page-library .lib-header p', 'library.subtitle');
  setTail('.lib-tab[data-lib-tab="library"]', 'library.title');
  setTail('.lib-tab[data-lib-tab="mix"]', 'library.mix');
  setTail('.lib-tab[data-lib-tab="prefs"]', 'library.taste');
  set('.lib-qp-label', 'library.service');
  setTail('#lib-continue', 'library.continue');
  setTail('#lib-watchlist', 'library.watchlist');
  setTail('#lib-liked', 'library.liked');
  setTail('#lib-recent', 'library.recent');
  set('#page-prefs .cyf-header h2', 'prefs.title');
  set('#page-prefs .cyf-header-left > p', 'prefs.subtitle');
  setTail('.pref-autosave-note', 'prefs.autosaved');
  setTail('#page-prefs .cyf-section-label', 'prefs.taste');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  document.documentElement.lang = uiLang();
}
