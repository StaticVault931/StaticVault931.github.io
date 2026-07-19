import { fold } from './normalize.js';
import { getIndex } from './searchIndex.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'about', 'becomes', 'for', 'from', 'in', 'is', 'it',
  'lives', 'movie', 'near', 'of', 'on', 'show', 'the', 'to', 'tv', 'where', 'with',
]);

const CONCEPTS = [
  { match: ['dream', 'dreams'], terms: ['dream', 'subconscious', 'reality', 'surreal'] },
  { match: ['astronaut', 'astronauts'], terms: ['astronaut', 'space', 'space travel', 'space mission'] },
  { match: ['black hole'], terms: ['black hole', 'space', 'interstellar'] },
  { match: ['teacher', 'professor'], terms: ['teacher', 'school', 'professor'] },
  { match: ['chemistry'], terms: ['chemistry', 'chemist', 'methamphetamine'] },
  { match: ['criminal', 'crime'], terms: ['criminal', 'crime', 'drug dealer', 'underworld'] },
  { match: ['humanity', 'humans'], terms: ['humanity', 'survival', 'dystopia', 'post apocalyptic'] },
  { match: ['wall', 'walls', 'walled'], terms: ['wall', 'walled city', 'siege', 'survival'] },
  { match: ['time travel'], terms: ['time travel', 'time loop', 'alternate timeline'] },
  { match: ['love', 'romance'], terms: ['love', 'romance', 'relationship'] },
  { match: ['funny', 'comedy'], terms: ['funny', 'comedy', 'satire'] },
  { match: ['scary', 'horror'], terms: ['scary', 'horror', 'supernatural'] },
];

function unique(values) {
  return [...new Set(values.map(fold).filter(Boolean))];
}

export function descriptionTerms(query) {
  const normalized = fold(query);
  const original = normalized.split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(word));
  const phrases = [];
  const expanded = [];
  for (const concept of CONCEPTS) {
    if (!concept.match.some(term => normalized.includes(term))) continue;
    phrases.push(...concept.match.filter(term => term.includes(' ') && normalized.includes(term)));
    expanded.push(...concept.terms);
  }
  return { normalized, original: unique(original), phrases: unique(phrases), expanded: unique(expanded) };
}

export function descriptionKeywordTerms(query, limit = 4) {
  const { original, phrases, expanded } = descriptionTerms(query);
  const multiword = expanded.filter(term => term.includes(' '));
  const single = expanded.filter(term => !term.includes(' '));
  return unique([...phrases, ...multiword, ...original, ...single]).slice(0, limit);
}

export function scoreDescriptionEntry(entry, query) {
  const { normalized, original, phrases, expanded } = descriptionTerms(query);
  const title = fold(entry?.title || entry?.name || '');
  const overview = fold(entry?.overview || entry?.description || '');
  const haystack = `${title} ${overview}`.trim();
  if (!haystack) return 0;

  let score = 0;
  if (normalized.length > 5 && overview.includes(normalized)) score += 60;
  for (const phrase of phrases) {
    if (overview.includes(phrase)) score += 16;
  }
  for (const term of original) {
    if (title.includes(term)) score += 4;
    if (overview.includes(term)) score += 8;
  }
  for (const term of expanded) {
    if (original.includes(term)) continue;
    if (title.includes(term)) score += 2;
    if (overview.includes(term)) score += term.includes(' ') ? 6 : 3;
  }
  const matchedOriginal = original.filter(term => haystack.includes(term)).length;
  if (original.length > 1) score += (matchedOriginal / original.length) * 18;
  score += Math.min(8, Math.log10((entry?.votes || entry?.vote_count || 0) + 1) * 2);
  score += Math.min(4, (entry?.rating || entry?.vote_average || 0) / 2.5);
  return score;
}

export function localDescriptionMatch(query, limit = 24) {
  return getIndex()
    .map(entry => ({ entry, score: scoreDescriptionEntry(entry, query) }))
    .filter(result => result.score >= 12)
    .sort((a, b) => b.score - a.score || (b.entry.votes || 0) - (a.entry.votes || 0))
    .slice(0, limit)
    .map(result => ({ ...result.entry, _descriptionScore: result.score }));
}
