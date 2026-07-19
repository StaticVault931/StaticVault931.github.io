const ITERATIONS = 210000;
const attempts = new Map();

function storageKey(profileId) {
  return `sv_kids_pin_v1_${String(profileId || 'default')}`;
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function derive(secret, salt) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, 256,
  );
  return new Uint8Array(bits);
}

function recoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,5}/g).join('-');
}

function read(profileId) {
  try { return JSON.parse(localStorage.getItem(storageKey(profileId)) || 'null'); }
  catch { return null; }
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export function hasKidsPin(profileId) {
  return !!read(profileId)?.pinHash;
}

export async function setKidsPin(profileId, pin) {
  const normalized = String(pin || '').trim();
  if (!/^\d{4,8}$/.test(normalized)) throw new Error('PIN must contain 4 to 8 digits');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
  const recovery = recoveryCode();
  const [pinHash, recoveryHash] = await Promise.all([
    derive(normalized, salt),
    derive(recovery.replace(/-/g, ''), recoverySalt),
  ]);
  localStorage.setItem(storageKey(profileId), JSON.stringify({
    version: 1,
    salt: bytesToBase64(salt),
    pinHash: bytesToBase64(pinHash),
    recoverySalt: bytesToBase64(recoverySalt),
    recoveryHash: bytesToBase64(recoveryHash),
    createdAt: Date.now(),
  }));
  attempts.delete(String(profileId || 'default'));
  return recovery;
}

export async function verifyKidsPin(profileId, secret) {
  const key = String(profileId || 'default');
  const record = read(profileId);
  if (!record) return { ok: true, method: 'none' };
  const attempt = attempts.get(key) || { failures: 0, cooldownUntil: 0 };
  if (attempt.cooldownUntil > Date.now()) {
    return { ok: false, reason: 'cooldown', retryAfter: attempt.cooldownUntil - Date.now() };
  }
  const normalized = String(secret || '').trim();
  const isRecovery = normalized.includes('-') || normalized.length > 8;
  const salt = base64ToBytes(isRecovery ? record.recoverySalt : record.salt);
  const expected = base64ToBytes(isRecovery ? record.recoveryHash : record.pinHash);
  const actual = await derive(isRecovery ? normalized.replace(/-/g, '').toUpperCase() : normalized, salt);
  const ok = constantTimeEqual(actual, expected);
  if (ok) {
    attempts.delete(key);
    return { ok: true, method: isRecovery ? 'recovery' : 'pin' };
  }
  attempt.failures++;
  if (attempt.failures >= 5) {
    attempt.failures = 0;
    attempt.cooldownUntil = Date.now() + 30000;
  }
  attempts.set(key, attempt);
  return { ok: false, reason: attempt.cooldownUntil > Date.now() ? 'cooldown' : 'invalid', retryAfter: Math.max(0, attempt.cooldownUntil - Date.now()) };
}

export function removeKidsPin(profileId) {
  localStorage.removeItem(storageKey(profileId));
  attempts.delete(String(profileId || 'default'));
}
