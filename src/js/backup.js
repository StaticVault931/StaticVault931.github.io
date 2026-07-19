const MEDIA_FIELDS = ['watchlist', 'liked', 'loved', 'disliked', 'watched', 'recentlyViewed', 'prefLikes', 'prefDislikes'];
const ARRAY_FIELDS = [...MEDIA_FIELDS, 'prefGenres', 'prefGenreDislikes', 'prefTagLikes', 'prefTagDislikes', 'recentSearches'];

function cleanMediaList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5000).filter(item => item && Number.isFinite(+item.id) && +item.id > 0).map(item => ({ ...item, id: +item.id }));
}

function cleanProfileData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const data = { ...value };
  MEDIA_FIELDS.forEach(field => { data[field] = cleanMediaList(data[field]); });
  ARRAY_FIELDS.filter(field => !MEDIA_FIELDS.includes(field)).forEach(field => {
    data[field] = Array.isArray(data[field]) ? data[field].slice(0, 5000) : [];
  });
  if (!data.continueWatching || typeof data.continueWatching !== 'object' || Array.isArray(data.continueWatching)) data.continueWatching = {};
  if (!data.tasteSkips || typeof data.tasteSkips !== 'object' || Array.isArray(data.tasteSkips)) data.tasteSkips = {};
  if (!data.profileSettings || typeof data.profileSettings !== 'object' || Array.isArray(data.profileSettings)) data.profileSettings = {};
  return data;
}

function cleanProfilesSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const profiles = (Array.isArray(value.profiles) ? value.profiles : []).slice(0, 10).map(profile => ({
    id: String(profile?.id || '').slice(0, 80),
    name: String(profile?.name || 'Profile').slice(0, 40),
    avatar: typeof profile?.avatar === 'string' ? profile.avatar.slice(0, 1000) : null,
    color: typeof profile?.color === 'string' ? profile.color.slice(0, 32) : '#e50914',
    createdAt: Number.isFinite(+profile?.createdAt) ? +profile.createdAt : Date.now(),
    ...(profile?.avatarCrop && typeof profile.avatarCrop === 'object' ? {
      avatarCrop: {
        x: Number.isFinite(+profile.avatarCrop.x) ? +profile.avatarCrop.x : 50,
        y: Number.isFinite(+profile.avatarCrop.y) ? +profile.avatarCrop.y : 50,
        zoom: Number.isFinite(+profile.avatarCrop.zoom) ? +profile.avatarCrop.zoom : 1,
      },
    } : {}),
  })).filter(profile => profile.id);
  const allowedIds = new Set(profiles.map(profile => profile.id));
  const profileData = {};
  if (value.profileData && typeof value.profileData === 'object' && !Array.isArray(value.profileData)) {
    Object.entries(value.profileData).forEach(([id, data]) => {
      if (allowedIds.has(id)) profileData[id] = cleanProfileData(data);
    });
  }
  return {
    activeProfileId: allowedIds.has(String(value.activeProfileId || '')) ? String(value.activeProfileId) : profiles[0]?.id || null,
    profiles,
    profileData,
  };
}

export function parseBackupText(text) {
  if (typeof text !== 'string' || text.length > 25 * 1024 * 1024) throw new Error('Backup is too large');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid backup file');
  if (![2, 3, 4].includes(parsed.version) && !Array.isArray(parsed.watchlist)) throw new Error('Unsupported backup version');
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
  if (data.profilesSnapshot) data.profilesSnapshot = cleanProfilesSnapshot(data.profilesSnapshot);
  return data;
}
