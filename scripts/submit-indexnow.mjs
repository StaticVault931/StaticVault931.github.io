import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const host = 'staticvault931.github.io';
const key = '9a87d2f46c4b4d46aeb2d20e6e17734c';
const origin = `https://${host}`;
const publicPages = [`${origin}/`, `${origin}/movies/`, `${origin}/tv/`, `${origin}/anime/`, `${origin}/clips/`, `${origin}/mix/`];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let changedFiles = [];
try {
  changedFiles = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
} catch {}

const submitAll = process.env.INDEXNOW_ALL === 'true'
  || changedFiles.some(file => file === 'sitemap.xml' || file === 'scripts/generate-seo.mjs');
const publicShellChanged = changedFiles.some(file => file === 'index.html' || file.startsWith('src/') || file.startsWith('assets/'));
const urls = new Set(submitAll || publicShellChanged ? publicPages : []);

if (submitAll) {
  const xml = await readFile('dist/sitemap.xml', 'utf8');
  const sitemapNames = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  for (const sitemapUrl of sitemapNames) {
    const relative = new URL(sitemapUrl).pathname.replace(/^\//, '');
    const part = await readFile(`dist/${relative}`, 'utf8');
    for (const match of part.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.add(match[1]);
  }
}
const list = [...urls];
if (!list.length) {
  console.log('IndexNow skipped: no canonical public URLs changed');
  process.exit(0);
}

// GitHub Pages can report a successful deployment before its CDN exposes a
// newly published ownership file. Verify it first and retry briefly so a
// propagation delay does not produce a misleading 403 from IndexNow.
let keyVerified = false;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const keyResponse = await fetch(`${origin}/${key}.txt?verify=${Date.now()}`, { cache: 'no-store' });
    keyVerified = keyResponse.ok && (await keyResponse.text()).trim() === key;
  } catch {}
  if (keyVerified) break;
  if (attempt < 2) await wait((attempt + 1) * 5000);
}
if (!keyVerified) {
  console.warn('IndexNow skipped: ownership key is not available from the deployed site yet');
  process.exit(0);
}

for (let start = 0; start < list.length; start += 10000) {
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: list.slice(start, start + 10000) }),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).trim().slice(0, 200);
      console.warn(`IndexNow submission skipped: HTTP ${response.status}${detail ? ` (${detail})` : ''}`);
      process.exit(0);
    }
  } catch (error) {
    console.warn(`IndexNow submission skipped: ${error?.message || 'network error'}`);
    process.exit(0);
  }
}
console.log(`IndexNow submitted ${list.length} canonical URLs`);
