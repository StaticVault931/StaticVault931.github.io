import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse, serialize } from 'parse5';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const ORIGIN = 'https://staticvault931.github.io';
const CHUNK = 10000;
const EXCLUDE = new Set(['.git', '.github', '.claude', 'node_modules', 'tests', 'test-results', 'playwright-report', 'scripts', 'dist']);
const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const decodeXml = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const slug = value => String(value || 'title').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'title';

async function copyPublicTree(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name) || path.resolve(source, entry.name) === OUT) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyPublicTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

function parseLegacySitemap(xml) {
  const records = [];
  let current = null;
  for (const raw of xml.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '<url>') current = {};
    else if (line === '</url>') { if (current?.loc) records.push(current); current = null; }
    else if (current && line.startsWith('<loc>')) current.loc = decodeXml(line.slice(5, line.indexOf('</loc>')));
    else if (current && line.startsWith('<image:image>')) {
      const imageLocStart = line.indexOf('<image:loc>');
      const imageLocEnd = line.indexOf('</image:loc>');
      const titleStart = line.indexOf('<image:title>');
      const titleEnd = line.indexOf('</image:title>');
      if (imageLocStart >= 0 && imageLocEnd > imageLocStart) current.image = decodeXml(line.slice(imageLocStart + 11, imageLocEnd));
      if (titleStart >= 0 && titleEnd > titleStart) current.imageTitle = decodeXml(line.slice(titleStart + 13, titleEnd));
    }
  }
  return records;
}

function titleRecords(records) {
  const found = new Map();
  for (const record of records) {
    let url;
    try { url = new URL(record.loc); } catch { continue; }
    const type = url.searchParams.get('watch');
    const id = Number(url.searchParams.get('id'));
    if (!['movie', 'tv', 'anime'].includes(type) || !id) continue;
    const name = url.searchParams.get('name') || record.imageTitle?.replace(/\s+-\s+Watch.*$/i, '') || `${type}-${id}`;
    const key = `${type}:${id}`;
    if (!found.has(key) || url.searchParams.get('mode') === 'info') {
      found.set(key, { type, id, name, slug: slug(name), image: record.image || '', legacy: `/?watch=${type}&name=${encodeURIComponent(name)}&id=${id}&mode=info` });
    }
  }
  return [...found.values()];
}

function personRecords(records) {
  const found = new Map();
  for (const record of records) {
    let url;
    try { url = new URL(record.loc); } catch { continue; }
    const id = Number(url.searchParams.get('person'));
    if (!id) continue;
    const rawName = decodeXml(record.imageTitle || '').replace(/\s+-\s+Films.*$/i, '').trim();
    const name = rawName || `Person ${id}`;
    if (!found.has(id)) found.set(id, { id, name, slug: slug(name), image: record.image || '', legacy: `/?person=${id}` });
  }
  return [...found.values()];
}

function shell({ title, description, canonical, legacy, type = 'WebPage', image = '' }) {
  const ld = { '@context': 'https://schema.org', '@type': type, name: title, description, url: canonical, ...(image ? { image } : {}) };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${image ? `<meta property="og:image" content="${esc(image)}">` : ''}<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script><meta http-equiv="refresh" content="0;url=${esc(legacy)}"><style>body{margin:0;background:#0b0b0d;color:#fff;font:16px system-ui;padding:8vw}main{max-width:760px;margin:auto}img{max-width:320px;width:100%;border-radius:6px}a{color:#ff5a63}</style></head><body><main><h1>${esc(title)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(title)}">` : ''}<p>${esc(description)}</p><p><a href="${esc(legacy)}">Open in StaticVault931</a></p></main><script>location.replace(${JSON.stringify(legacy)})</script></body></html>`;
  return serialize(parse(html));
}

async function writeRoute(route, html) {
  const dir = path.join(OUT, route.replace(/^\/+|\/+$/g, ''));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
}

function sitemapXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${esc(item.loc)}</loc><lastmod>${item.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await copyPublicTree(ROOT, OUT);
const legacyXml = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
const legacyRecords = parseLegacySitemap(legacyXml);
const titles = titleRecords(legacyRecords);
const people = personRecords(legacyRecords);
let lastmod;
try { lastmod = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'sitemap.xml'], { cwd: ROOT, encoding: 'utf8' }).trim(); }
catch { lastmod = new Date().toISOString().slice(0, 10); }

const publicPages = [
  ['movies', 'Movies', 'Browse popular, acclaimed, and new movies.', 'CollectionPage'],
  ['tv', 'TV Shows', 'Browse popular, acclaimed, and new television shows.', 'CollectionPage'],
  ['anime', 'Anime', 'Browse anime series and movies.', 'CollectionPage'],
  ['clips', 'Clips', 'Discover movies and shows through trailers and clips.', 'CollectionPage'],
  ['mix', 'Mix & Match', 'Blend several titles to discover recommendations they have in common.', 'WebApplication'],
];
for (const [route, title, description, type] of publicPages) {
  await writeRoute(route, shell({ title: `${title} | StaticVault931`, description, canonical: `${ORIGIN}/${route}/`, legacy: `/?page=${route}`, type }));
}

const urls = [{ loc: `${ORIGIN}/`, lastmod }, ...publicPages.map(([route]) => ({ loc: `${ORIGIN}/${route}/`, lastmod }))];
for (const item of titles) {
  const route = `title/${item.type}/${item.id}-${item.slug}`;
  const canonical = `${ORIGIN}/${route}/`;
  const description = `View details, related titles, and playback options for ${item.name} on StaticVault931.`;
  await writeRoute(route, shell({ title: `${item.name} | StaticVault931`, description, canonical, legacy: item.legacy, type: item.type === 'movie' ? 'Movie' : 'TVSeries', image: item.image }));
  urls.push({ loc: canonical, lastmod });
}
for (const person of people) {
  const route = `person/${person.id}-${person.slug}`;
  const canonical = `${ORIGIN}/${route}/`;
  const description = `Explore ${person.name}'s movies, television credits, collaborators, and related titles on StaticVault931.`;
  await writeRoute(route, shell({ title: `${person.name} | StaticVault931`, description, canonical, legacy: person.legacy, type: 'Person', image: person.image }));
  urls.push({ loc: canonical, lastmod });
}

const sitemapDir = path.join(OUT, 'sitemaps');
await mkdir(sitemapDir, { recursive: true });
const parts = [];
for (let start = 0; start < urls.length; start += CHUNK) {
  const name = `public-${String(parts.length + 1).padStart(2, '0')}.xml`;
  await writeFile(path.join(sitemapDir, name), sitemapXml(urls.slice(start, start + CHUNK)));
  parts.push(name);
}
const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.map(name => `  <sitemap><loc>${ORIGIN}/sitemaps/${name}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`;
await writeFile(path.join(OUT, 'sitemap.xml'), index);
await writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /?page=library\nDisallow: /?page=prefs\nDisallow: /?page=search\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await writeFile(path.join(OUT, 'seo-build.json'), JSON.stringify({ generatedAt: new Date().toISOString(), lastmod, publicUrls: urls.length, sitemapParts: parts.length }, null, 2));
console.log(`SEO build: ${urls.length} public URLs in ${parts.length} sitemap files`);
