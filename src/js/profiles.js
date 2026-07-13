/**
 * profiles.js — Multi-profile support for StaticVault931.
 * Up to 10 profiles per browser, each with independent preferences and history.
 */

import { state, persist } from './state.js';

const PROFILES_KEY = 'sv_profiles';
const ACTIVE_KEY   = 'sv_active_profile';
const MAX_PROFILES = 10;

// Keys that belong to a profile (saved/loaded on switch)
const PROFILE_STATE_KEYS = [
  'watchlist', 'liked', 'disliked', 'watched', 'recentlyViewed',
  'continueWatching', 'prefLikes', 'prefDislikes', 'prefGenres',
  'prefGenreDislikes', 'prefLangs',
  'ageRating', 'lastProvider', 'impressions', 'recentSearches',
  'disabledShortcuts', // per-profile shortcut overrides
];

const PERSIST_MAP_KEYS = {
  watchlist:        'sv_watchlist',
  liked:            'sv_liked',
  disliked:         'sv_disliked',
  watched:          'sv_watched',
  recentlyViewed:   'sv_recent',
  continueWatching: 'sv_continue',
  prefLikes:        'sv_pref_likes',
  prefDislikes:     'sv_pref_dislikes',
  prefGenres:       'sv_pref_genres',
  prefGenreDislikes:'sv_pref_genre_dislikes',
  prefLangs:        'sv_pref_langs',
  ageRating:        'sv_age',
  lastProvider:     'sv_last_provider',
  impressions:      'sv_impressions',
  recentSearches:   'sv_recent_searches',
};

/* ── PROFILE STORAGE ──────────────────────────────────────────────── */
export function getProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]'); }
  catch { return []; }
}

export function saveProfiles(profiles) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); }
  catch {}
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function setActiveProfileId(id) {
  localStorage.setItem(ACTIVE_KEY, String(id));
}

/* ── CREATE / EDIT PROFILE ────────────────────────────────────────── */
export function createProfile(name, avatar = null, color = '#e50914') {
  const profiles = getProfiles();
  if (profiles.length >= MAX_PROFILES) return null;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const profile = { id, name: name.trim() || 'Profile', avatar, color, createdAt: Date.now() };
  profiles.push(profile);
  saveProfiles(profiles);
  return profile;
}

export function updateProfile(id, changes) {
  const profiles = getProfiles();
  const idx = profiles.findIndex(p => p.id === id);
  if (idx >= 0) { profiles[idx] = { ...profiles[idx], ...changes }; saveProfiles(profiles); }
}

export function deleteProfile(id) {
  const profiles = getProfiles().filter(p => p.id !== id);
  saveProfiles(profiles);
  // Clean up profile data
  try { localStorage.removeItem(`sv_pd_${id}`); } catch {}
}

/* ── SAVE / LOAD PROFILE DATA ─────────────────────────────────────── */
function saveProfileData(profileId) {
  const data = {};
  PROFILE_STATE_KEYS.forEach(k => { data[k] = state[k]; });
  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    data.profileSettings = { kidsMode: !!settings.kidsMode };
  } catch { data.profileSettings = { kidsMode: false }; }
  try { localStorage.setItem(`sv_pd_${profileId}`, JSON.stringify(data)); }
  catch {}
}

function loadProfileData(profileId) {
  try {
    const raw = localStorage.getItem(`sv_pd_${profileId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/* ── SWITCH PROFILE ───────────────────────────────────────────────── */
export function switchProfile(toId) {
  const profiles = getProfiles();
  if (!profiles.some(p => p.id === toId)) return false;
  const currentId = getActiveProfileId();

  // Save current state to current profile's bucket
  if (currentId && profiles.some(p => p.id === currentId)) saveProfileData(currentId);

  // Load new profile's data
  setActiveProfileId(toId);
  const data = loadProfileData(toId);

  try {
    const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
    settings.kidsMode = !!data?.profileSettings?.kidsMode;
    localStorage.setItem('sv_settings', JSON.stringify(settings));
  } catch {}

  PROFILE_STATE_KEYS.forEach(k => {
    if (data && data[k] !== undefined) {
      state[k] = data[k];
    } else {
      // Default values for fresh profile
      const defaults = {
        watchlist: [], liked: [], disliked: [], watched: [],
        recentlyViewed: [], continueWatching: {},
        prefLikes: [], prefDislikes: [], prefGenres: [],
        prefGenreDislikes: [], prefLangs: [],
        ageRating: 'PG-13', lastProvider: 'vidsrc',
        impressions: {}, recentSearches: [],
      };
      state[k] = defaults[k] ?? state[k];
    }
    // Persist to the standard keys so the rest of the app reads them
    if (PERSIST_MAP_KEYS[k]) {
      try { localStorage.setItem(PERSIST_MAP_KEYS[k], JSON.stringify(state[k])); }
      catch {}
    }
  });
  return true;
}

/* ── INIT: ensure at least one profile exists ─────────────────────── */
export function initProfiles() {
  let profiles = getProfiles();
  if (!profiles.length) {
    const defaultProfile = createProfile('Me');
    setActiveProfileId(defaultProfile.id);
    // Mark existing data as belonging to this profile
    saveProfileData(defaultProfile.id);
    return;
  }
  // Recover stale/deleted active IDs without discarding the browser's data.
  let activeId = getActiveProfileId();
  const orphanData = activeId && !profiles.some(p => p.id === activeId)
    ? loadProfileData(activeId)
    : null;
  if (!profiles.some(p => p.id === activeId)) {
    activeId = profiles[0].id;
    setActiveProfileId(activeId);
  }
  if (orphanData && !loadProfileData(activeId)) {
    try { localStorage.setItem(`sv_pd_${activeId}`, JSON.stringify(orphanData)); } catch {}
    PROFILE_STATE_KEYS.forEach(k => {
      if (orphanData[k] === undefined) return;
      state[k] = orphanData[k];
      if (PERSIST_MAP_KEYS[k]) {
        try { localStorage.setItem(PERSIST_MAP_KEYS[k], JSON.stringify(state[k])); } catch {}
      }
    });
    try {
      const settings = JSON.parse(localStorage.getItem('sv_settings') || '{}');
      settings.kidsMode = !!orphanData.profileSettings?.kidsMode;
      localStorage.setItem('sv_settings', JSON.stringify(settings));
    } catch {}
  }
  // Migrate profiles created before per-profile buckets existed. The
  // standard storage keys are still the only copy, so preserve them now.
  if (!loadProfileData(activeId)) saveProfileData(activeId);
}

export { MAX_PROFILES, PROFILE_STATE_KEYS };
