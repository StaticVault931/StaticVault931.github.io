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
  { match: ['detective', 'investigator'], terms: ['detective', 'investigation', 'mystery', 'police'] },
  { match: ['lawyer', 'attorney', 'courtroom'], terms: ['lawyer', 'attorney', 'courtroom', 'legal'] },
  { match: ['doctor', 'hospital'], terms: ['doctor', 'hospital', 'medical'] },
  { match: ['assassin', 'hitman'], terms: ['assassin', 'hitman', 'contract killer'] },
  { match: ['journalist', 'reporter'], terms: ['journalist', 'reporter', 'newspaper'] },
  { match: ['prison', 'jail'], terms: ['prison', 'jail', 'inmate', 'escape'] },
  { match: ['island', 'stranded'], terms: ['island', 'stranded', 'survival'] },
  { match: ['spaceship', 'space ship'], terms: ['spaceship', 'spacecraft', 'space mission'] },
  { match: ['small town'], terms: ['small town', 'community', 'mystery'] },
  { match: ['time loop', 'repeating day'], terms: ['time loop', 'repeating', 'same day'] },
  { match: ['mockumentary'], terms: ['mockumentary', 'documentary style', 'workplace comedy'] },
  { match: ['anthology'], terms: ['anthology', 'standalone stories', 'episodic'] },
  { match: ['unreliable narrator'], terms: ['unreliable narrator', 'psychological', 'identity'] },
  { match: ['found family'], terms: ['found family', 'friendship', 'unlikely family'] },
  { match: ['enemies to lovers'], terms: ['enemies to lovers', 'romance', 'rivals'] },
  { match: ['missing child', 'missing kid'], terms: ['missing child', 'disappearance', 'search'] },
  { match: ['heist', 'robbery'], terms: ['heist', 'robbery', 'crew', 'thief'] },
  { match: ['survival contest', 'death game'], terms: ['survival game', 'competition', 'death game'] },
  { match: ['identity swap', 'body swap'], terms: ['identity swap', 'body swap', 'switched'] },
  { match: ['vampire', 'vampires'], terms: ['vampire', 'undead', 'blood'] },
  { match: ['zombie', 'zombies'], terms: ['zombie', 'undead', 'outbreak'] },
  { match: ['dragon', 'dragons'], terms: ['dragon', 'fantasy', 'creature'] },
  { match: ['alien', 'aliens'], terms: ['alien', 'extraterrestrial', 'space'] },
  { match: ['giant monster', 'kaiju'], terms: ['giant monster', 'kaiju', 'creature'] },
  { match: ['cozy', 'comforting'], terms: ['cozy', 'heartwarming', 'gentle'] },
  { match: ['bleak', 'grim'], terms: ['bleak', 'grim', 'dark'] },
  { match: ['absurd', 'weird'], terms: ['absurd', 'surreal', 'offbeat'] },
  { match: ['simulation'], terms: ['simulation', 'virtual reality', 'artificial world'] },
  { match: ['multiverse', 'parallel universe'], terms: ['multiverse', 'parallel universe', 'alternate reality'] },
  { match: ['clone', 'cloning'], terms: ['clone', 'cloning', 'genetic experiment'] },
  { match: ['memory loss', 'amnesia'], terms: ['memory loss', 'amnesia', 'forgotten identity'] },
  { match: ['magical school'], terms: ['magical school', 'magic', 'academy'] },
  { match: ['cursed object'], terms: ['cursed object', 'curse', 'supernatural'] },
  { match: ['serial killer'], terms: ['serial killer', 'murder', 'investigation'] },
  { match: ['cartel'], terms: ['cartel', 'drug trade', 'organized crime'] },
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
