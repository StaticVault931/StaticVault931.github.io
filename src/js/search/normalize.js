/* ── QUERY / TITLE NORMALIZATION ─────────────────────────────────────
   Single source of truth for turning raw queries and titles into
   comparable strings. Handles accents, punctuation, apostrophes,
   hyphens, and spacing so "Spider Man", "spider-man", and "Spidér-Man"
   all fold to the same form. */

// Full fold: lowercase, strip accents, remove punctuation, collapse spaces
export function fold(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['''`]/g, '')          // apostrophes vanish: don't → dont
    .replace(/[&]/g, ' and ')
    .replace(/[""\-_:;.,!?()[\]{}/\\|+*#@$%^~<>=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Space-free form for hyphen/spacing-insensitive comparison
export function foldTight(s) {
  return fold(s).replace(/ /g, '');
}

// Tokenize a folded string into words
export function tokens(s) {
  return fold(s).split(' ').filter(Boolean);
}

// Strip a leading article (the/a/an) — helps "Matrix" match "The Matrix"
export function stripArticle(s) {
  return String(s || '').replace(/^(the|a|an)\s+/i, '');
}

// Extract a year hint from a query ("die hard 1988" → { clean, year })
export function extractYear(q) {
  const m = String(q || '').match(/\b(19[2-9]\d|20[0-4]\d)\b/);
  if (!m) return { clean: q, year: null };
  return { clean: q.replace(m[0], '').replace(/\s+/g, ' ').trim(), year: parseInt(m[0]) };
}
