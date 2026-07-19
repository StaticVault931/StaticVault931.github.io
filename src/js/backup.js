const MEDIA_FIELDS = ['watchlist', 'liked', 'loved', 'disliked', 'watched', 'recentlyViewed', 'prefLikes', 'prefDislikes'];
const ARRAY_FIELDS = [...MEDIA_FIELDS, 'prefGenres', 'prefGenreDislikes', 'prefTagLikes', 'prefTagDislikes', 'recentSearches'];

function cleanMediaList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5000).filter(item => item && Number.isFinite(+item.id) && +item.id > 0).map(item => ({ ...item, id: +item.id }));
}

export function parseBackupText(text) {
  if (typeof text !== 'string' || text.length > 25 * 1024 * 1024) throw new Error('Backup is too large');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid backup file');
  if (![2, 3].includes(parsed.version) && !Array.isArray(parsed.watchlist)) throw new Error('Unsupported backup version');
  const data = { ...parsed };
  MEDIA_FIELDS.forEach(field => { if (field in data) data[field] = cleanMediaList(data[field]); });
  ARRAY_FIELDS.filter(field => !MEDIA_FIELDS.includes(field)).forEach(field => {
    if (field in data) data[field] = Array.isArray(data[field]) ? data[field].slice(0, 5000) : [];
  });
  if (data.continueWatching && (typeof data.continueWatching !== 'object' || Array.isArray(data.continueWatching))) data.continueWatching = {};
  if (data.tasteSkips && (typeof data.tasteSkips !== 'object' || Array.isArray(data.tasteSkips))) data.tasteSkips = {};
  if (data.kidsTaste && typeof data.kidsTaste === 'object' && !Array.isArray(data.kidsTaste)) {
    const kids = data.kidsTaste;
    data.kidsTaste = {
      liked: cleanMediaList(kids.liked), loved: cleanMediaList(kids.loved), disliked: cleanMediaList(kids.disliked),
      watched: cleanMediaList(kids.watched), watchlist: cleanMediaList(kids.watchlist),
      prefLikes: cleanMediaList(kids.prefLikes), prefDislikes: cleanMediaList(kids.prefDislikes),
      tasteSkips: kids.tasteSkips && typeof kids.tasteSkips === 'object' && !Array.isArray(kids.tasteSkips) ? kids.tasteSkips : {},
    };
  }
  return data;
}
