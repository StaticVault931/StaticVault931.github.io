export const COLLECTION_CATALOG = [
  { id: 10, name: 'Star Wars Collection', tags: ['space', 'science-fiction', 'lucasfilm'], timeline: [1893,1894,1895,348350,330459,11,1891,1892,140607,181808,181812] },
  { id: 1241, name: 'Harry Potter Collection', tags: ['fantasy', 'magic', 'young-adult'] },
  { id: 119, name: 'The Lord of the Rings Collection', tags: ['fantasy', 'middle-earth'], related: [121938] },
  { id: 121938, name: 'The Hobbit Collection', tags: ['fantasy', 'middle-earth'], related: [119] },
  { id: 645, name: 'James Bond Collection', tags: ['spy', 'action'] },
  { id: 9485, name: 'The Fast and the Furious Collection', tags: ['action', 'cars'] },
  { id: 328, name: 'Jurassic Park Collection', tags: ['science-fiction', 'adventure', 'dinosaurs'] },
  { id: 263, name: 'The Dark Knight Collection', tags: ['superhero', 'dc', 'crime'] },
  { id: 556, name: 'Spider-Man Collection', tags: ['superhero', 'marvel'], related: [131292] },
  { id: 10194, name: 'Toy Story Collection', tags: ['animation', 'family', 'pixar'], related: [2150,86066] },
  { id: 2150, name: 'Shrek Collection', tags: ['animation', 'family', 'comedy'], related: [10194,86066] },
  { id: 86066, name: 'Despicable Me Collection', tags: ['animation', 'family', 'comedy'], related: [10194,2150] },
  { id: 87359, name: 'Mission: Impossible Collection', tags: ['spy', 'action'], related: [645] },
  { id: 404609, name: 'John Wick Collection', tags: ['action', 'crime'] },
  { id: 131635, name: 'The Hunger Games Collection', tags: ['young-adult', 'dystopia', 'action'] },
  { id: 2344, name: 'The Matrix Collection', tags: ['science-fiction', 'action', 'dystopia'] },
  { id: 8091, name: 'Alien Collection', tags: ['science-fiction', 'horror', 'space'], related: [399] },
  { id: 399, name: 'Predator Collection', tags: ['science-fiction', 'horror', 'action'], related: [8091] },
  { id: 295, name: 'Pirates of the Caribbean Collection', tags: ['fantasy', 'adventure'] },
  { id: 131292, name: 'Iron Man Collection', tags: ['superhero', 'marvel'], related: [556,86311,131295,131296] },
  { id: 86311, name: 'The Avengers Collection', tags: ['superhero', 'marvel'], related: [131292,131295,131296,284433] },
  { id: 131295, name: 'Captain America Collection', tags: ['superhero', 'marvel'], related: [86311,131292,131296] },
  { id: 131296, name: 'Thor Collection', tags: ['superhero', 'marvel', 'fantasy'], related: [86311,131292,284433] },
  { id: 284433, name: 'Guardians of the Galaxy Collection', tags: ['superhero', 'marvel', 'space', 'science-fiction'], related: [86311,131296] },
  { id: 264, name: 'Back to the Future Collection', tags: ['science-fiction', 'adventure', 'time-travel'], related: [2344,528] },
  { id: 84, name: 'Indiana Jones Collection', tags: ['adventure', 'history'], related: [295] },
  { id: 528, name: 'The Terminator Collection', tags: ['science-fiction', 'action', 'dystopia'], related: [2344,264] },
];

export function collectionOrder(collectionId, items, mode = 'release') {
  const source = [...(items || [])];
  if (mode === 'recommended') {
    return source.sort((a, b) => ((b.vote_average || 0) * Math.log10((b.vote_count || 0) + 10)) - ((a.vote_average || 0) * Math.log10((a.vote_count || 0) + 10)));
  }
  if (mode === 'timeline') {
    const timeline = COLLECTION_CATALOG.find(entry => entry.id === +collectionId)?.timeline;
    if (timeline?.length) {
      const rank = new Map(timeline.map((id, index) => [+id, index]));
      return source.sort((a, b) => (rank.get(+a.id) ?? 999) - (rank.get(+b.id) ?? 999));
    }
  }
  return source.sort((a, b) => String(a.release_date || '9999').localeCompare(String(b.release_date || '9999')));
}

export function hasTimelineOrder(collectionId) {
  return !!COLLECTION_CATALOG.find(entry => entry.id === +collectionId)?.timeline?.length;
}

export function relatedCollections(collectionId, limit = 6) {
  const current = COLLECTION_CATALOG.find(entry => entry.id === +collectionId);
  if (!current) return [];
  const explicit = new Set(current.related || []);
  return COLLECTION_CATALOG.filter(entry => entry.id !== current.id).map(entry => ({
    ...entry,
    overlap: entry.tags.filter(tag => current.tags.includes(tag)).length,
    score: (explicit.has(entry.id) ? 10 : 0) + entry.tags.filter(tag => current.tags.includes(tag)).length,
  })).filter(entry => explicit.has(entry.id) || entry.overlap >= 2)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}
