import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const host = 'staticvault931.github.io';
const key = '9a87d2f46c4b4d46aeb2d20e6e17734c';
const origin = `https://${host}`;
const publicPages = [`${origin}/`, `${origin}/movies/`, `${origin}/tv/`, `${origin}/anime/`, `${origin}/clips/`, `${origin}/mix/`];
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
for (let start = 0; start < list.length; start += 10000) {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: list.slice(start, start + 10000) }),
  });
  if (!response.ok && response.status !== 202) throw new Error(`IndexNow ${response.status}`);
}
console.log(`IndexNow submitted ${list.length} canonical URLs`);
