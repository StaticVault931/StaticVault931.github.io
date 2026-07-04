/* ── FUZZY MATCHING — RapidFuzz-inspired scorers ─────────────────────
   JS implementations of the scoring ideas from RapidFuzz
   (github.com/rapidfuzz/RapidFuzz, MIT). The C++/Python library can't
   run in the browser, so the useful scorers are reimplemented here:

   ratio        — normalized indel similarity of two whole strings
   partialRatio — best-matching window (substring-ish matching)
   tokenSetRatio— order- and duplicate-insensitive token comparison
   titleScore   — the combined 0–100 score search ranking uses */

import { fold, foldTight, tokens, stripArticle } from './normalize.js';
import { damerau } from './spellcheck.js';

/* Indel similarity 0–100 (like RapidFuzz ratio). */
export function ratio(a, b) {
  a = fold(a); b = fold(b);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  const d = damerau(a, b, maxLen);
  return Math.max(0, Math.round((1 - d / maxLen) * 100));
}

/* Best-window similarity: how well does the shorter string match some
   substring of the longer one (like RapidFuzz partial_ratio). */
export function partialRatio(a, b) {
  a = fold(a); b = fold(b);
  if (!a || !b) return 0;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.includes(short)) return 100;
  let best = 0;
  const step = Math.max(1, Math.floor(short.length / 4));
  for (let i = 0; i + short.length <= long.length + step; i += step) {
    const window = long.slice(i, i + short.length + 2);
    const r = ratio(short, window);
    if (r > best) best = r;
    if (best >= 95) break;
  }
  return best;
}

/* Token-set similarity: ignores word order and duplicates
   (like RapidFuzz token_set_ratio). */
export function tokenSetRatio(a, b) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter(t => tb.has(t));
  if (inter.length === ta.size && inter.length === tb.size) return 100;
  // Score = intersection coverage weighted toward the query (a)
  const coverage = inter.length / ta.size;
  const balance = inter.length / Math.max(ta.size, tb.size);
  return Math.round((coverage * 0.7 + balance * 0.3) * 100);
}

/* Word-prefix bonus: every query word is a prefix of some title word
   ("stranger thing" → "stranger things"). */
export function prefixCoverage(query, title) {
  const qw = tokens(query);
  const tw = tokens(title);
  if (!qw.length || !tw.length) return 0;
  const hits = qw.filter(q => tw.some(t => t.startsWith(q))).length;
  return Math.round((hits / qw.length) * 100);
}

/* Combined title score 0–100 — the one number ranking uses. */
export function titleScore(query, title) {
  const q = fold(query), t = fold(title);
  if (!q || !t) return 0;
  if (t === q || foldTight(t) === foldTight(q)) return 100;
  const tNoArt = fold(stripArticle(title));
  if (tNoArt === q) return 99;
  if (t.startsWith(q) || tNoArt.startsWith(q)) return 95;
  if (t.includes(q)) return 88;

  const scores = [
    ratio(q, t),
    partialRatio(q, t) * 0.9,           // substring matches slightly discounted
    tokenSetRatio(q, t) * 0.95,
    prefixCoverage(q, t) * 0.9,
  ];
  return Math.round(Math.max(...scores));
}
