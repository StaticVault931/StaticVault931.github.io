import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parse, serialize } from 'parse5';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const ORIGIN = 'https://staticvault931.github.io';
const CHUNK = 10000;
const EXCLUDE_DIRS = new Set([
  '.git', '.github', '.claude', '.codex', '.agents', '.vscode', '.idea',
  'node_modules', 'tests', 'test-results', 'playwright-report', 'scripts',
  'dist', 'build', 'coverage', 'backups', 'exports', 'private', 'credentials',
]);
const EXCLUDE_FILES = new Set([
  '.gitignore', '.editorconfig', 'eslint.config.js', 'package.json', 'package-lock.json',
  'playwright.config.js', 'serve.js', 'README.md',
]);
const PRIVATE_FILE = /^(?:\.env(?:\..*)?|.*\.(?:log|pem|key|p12|pfx|jks|keystore|sqlite3?|db)|staticvault-(?:backup|export).*\.json)$/i;
const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const decodeXml = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const slug = value => String(value || 'title').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'title';

const PROVIDERS = [
  [8, 'Netflix'], [337, 'Disney Plus'], [9, 'Amazon Prime Video'], [1899, 'Max'],
  [15, 'Hulu'], [350, 'Apple TV Plus'], [531, 'Paramount Plus'], [386, 'Peacock'],
  [283, 'Crunchyroll'], [37, 'Showtime'], [43, 'Starz'], [123, 'Shudder'],
  [100, 'Tubi TV'], [73, 'Pluto TV'], [11, 'MUBI'], [526, 'AMC Plus'],
  [151, 'BritBox'], [520, 'Discovery Plus'], [188, 'YouTube Premium'],
  [175, 'Netflix Kids'],
];

async function copyPublicTree(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name) || path.resolve(source, entry.name) === OUT) continue;
    if (entry.isFile() && (EXCLUDE_FILES.has(entry.name) || PRIVATE_FILE.test(entry.name))) continue;
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
      const imageStart = line.indexOf('<image:loc>');
      const imageEnd = line.indexOf('</image:loc>');
      const titleStart = line.indexOf('<image:title>');
      const titleEnd = line.indexOf('</image:title>');
      if (imageStart >= 0 && imageEnd > imageStart) current.image = decodeXml(line.slice(imageStart + 11, imageEnd));
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
    const imageName = record.imageTitle?.replace(/\s+-\s+Watch.*$/i, '').trim();
    const rawRouteName = String(url.searchParams.get('name') || '');
    const routeName = rawRouteName.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    const name = imageName || routeName || `${type} ${id}`;
    const releaseYear = rawRouteName.match(/(?:^|-)((?:19|20)\d{2})$/)?.[1] || '';
    const key = `${type}:${id}`;
    if (!found.has(key) || url.searchParams.get('mode') === 'info') {
      found.set(key, { type, id, name, year: releaseYear, slug: slug(`${name}${releaseYear ? ` ${releaseYear}` : ''}`), image: record.image || '' });
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
    // An ID-only shell is thin, confusing, and indistinguishable from the
    // other unnamed people to a crawler. Keep the runtime route available but
    // only advertise people whose catalog record has a real display name.
    if (!rawName) continue;
    const name = rawName;
    if (!found.has(id)) found.set(id, { id, name, slug: slug(name), image: record.image || '' });
  }
  return [...found.values()];
}

function shell({ title, description, canonical, type = 'WebPage', image = '', noindex = false, items = [], parent = null }) {
  const entityType = ['Movie', 'TVSeries', 'Person'].includes(type);
  const entityId = `${canonical}#entity`;
  const imageId = `${canonical}#primaryimage`;
  const entity = { '@type': type, '@id': entityId, name: title, description, url: canonical, ...(image ? { image: { '@id': imageId } } : {}) };
  const graph = entityType ? [{
    '@type': 'WebPage', '@id': `${canonical}#webpage`, name: title, description, url: canonical,
    mainEntity: { '@id': entityId }, ...(image ? { primaryImageOfPage: { '@id': imageId } } : {}),
    isPartOf: { '@type': 'WebSite', name: 'StaticVault931', url: `${ORIGIN}/` },
  }, entity] : [entity];
  if (image) graph.push({ '@type': 'ImageObject', '@id': imageId, url: image, contentUrl: image, caption: title, representativeOfPage: true });
  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      ...(parent ? [{ '@type': 'ListItem', position: 2, name: parent.name, item: parent.url }] : []),
      { '@type': 'ListItem', position: parent ? 3 : 2, name: title.replace(/\s+\|\s+StaticVault931$/, ''), item: canonical },
    ],
  });
  if (items.length) {
    graph.push({
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.name, url: item.url,
        item: { '@type': item.type === 'movie' ? 'Movie' : 'TVSeries', name: item.name, url: item.url, ...(item.image ? { image: item.image } : {}) },
      })),
    });
  }
  const list = items.length ? `<section><h2>Featured titles</h2><ul>${items.map(item => `<li><a href="${esc(item.url)}">${esc(item.name)}</a></li>`).join('')}</ul></section>` : '';
  const boot = `fetch('/index.html').then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(h=>{document.open();document.write(h.replace('<head>','<head><base href="/">'));document.close()}).catch(()=>{})`;
  const socialImage = image || `${ORIGIN}/assets/icons/favicon.png`;
  const parentCrumb = parent ? ` / <a href="${esc(parent.url)}">${esc(parent.name)}</a>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="StaticVault931"><meta property="og:locale" content="en_US"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(socialImage)}"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@StaticQuasar931"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(socialImage)}"><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script><style>body{margin:0;background:#0b0b0d;color:#fff;font:16px system-ui;padding:8vw}main{max-width:780px;margin:auto}img{max-width:320px;width:100%;border-radius:6px}a{color:#ff737b}nav{margin-bottom:2rem}li{margin:.5rem 0}</style></head><body><main><nav aria-label="Breadcrumb"><a href="/">Home</a>${parentCrumb} / <span>${esc(title.replace(/\s+\|\s+StaticVault931$/, ''))}</span></nav><h1>${esc(title)}</h1>${image ? `<img src="${esc(image)}" alt="${esc(title)}">` : ''}<p>${esc(description)}</p>${list}<p><a href="${esc(canonical)}">Open in StaticVault931</a></p></main><script>${boot}</script></body></html>`;
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

function lastModified(paths) {
  try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return new Date().toISOString().slice(0, 10); }
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await copyPublicTree(ROOT, OUT);
const legacyXml = await readFile(path.join(ROOT, 'scripts', 'data', 'catalog-source.xml'), 'utf8');
const legacyRecords = parseLegacySitemap(legacyXml);
const titles = titleRecords(legacyRecords);
const people = personRecords(legacyRecords);
const collections = JSON.parse(await readFile(path.join(ROOT, 'scripts', 'data', 'collections.json'), 'utf8'));
const lastmod = lastModified(['scripts/data/catalog-source.xml', 'scripts/generate-seo.mjs', 'src/js/routes.js']);

const publicPages = [
  ['movies', 'Movies', 'Browse popular, acclaimed, and new movies.', 'CollectionPage', titles.filter(item => item.type === 'movie').slice(0, 12)],
  ['tv', 'TV Shows', 'Browse popular, acclaimed, and new television shows.', 'CollectionPage', titles.filter(item => item.type === 'tv').slice(0, 12)],
  ['anime', 'Anime', 'Browse anime series and movies.', 'CollectionPage', titles.filter(item => item.type === 'anime').slice(0, 12)],
  ['clips', 'Clips', 'Discover movies and shows through trailers and clips.', 'CollectionPage', []],
  ['mix', 'Mix & Match', 'Blend several titles to discover recommendations they have in common.', 'WebApplication', []],
];
const itemLink = item => ({ ...item, url: `${ORIGIN}/title/${item.type}/${item.id}-${item.slug}/` });
for (const [route, title, description, type, items] of publicPages) {
  await writeRoute(route, shell({ title: `${title} | StaticVault931`, description, canonical: `${ORIGIN}/${route}/`, type, items: items.map(itemLink) }));
}

const privatePages = [
  ['search', 'Search', 'Search movies, shows, anime, people, and topics.'],
  ['library', 'My Library', 'Your private watchlist, reactions, and viewing activity.'],
  ['library/watchlist', 'Watchlist', 'Your private saved titles.'],
  ['library/liked', 'Liked Titles', 'Titles liked by this private profile.'],
  ['library/recent', 'Recently Viewed', 'Titles recently viewed by this private profile.'],
  ['library/taste-profile', 'Taste Profile', 'A private summary of this profile\'s discovery preferences.'],
  ['customize', 'Customize Your Feed', 'Adjust your private discovery and accessibility preferences.'],
  ['developer', 'Developer Lab', 'Private local diagnostics and product experiments.'],
];
for (const [route, title, description] of privatePages) {
  await writeRoute(route, shell({ title: `${title} | StaticVault931`, description, canonical: `${ORIGIN}/${route}/`, noindex: true }));
}

const urlGroups = new Map([
  ['pages', [{ loc: `${ORIGIN}/`, lastmod }, ...publicPages.map(([route]) => ({ loc: `${ORIGIN}/${route}/`, lastmod }))]],
  ['movies', []],
  ['tv', []],
  ['anime', []],
  ['people', []],
  ['providers', []],
  ['collections', []],
]);
for (const item of titles) {
  const route = `title/${item.type}/${item.id}-${item.slug}`;
  const canonical = `${ORIGIN}/${route}/`;
  const description = `View details, related titles, and viewing options for ${item.name} on StaticVault931.`;
  const schemaType = item.type === 'movie' ? 'Movie' : 'TVSeries';
  const parent = item.type === 'movie'
    ? { name: 'Movies', url: `${ORIGIN}/movies/` }
    : item.type === 'anime'
      ? { name: 'Anime', url: `${ORIGIN}/anime/` }
      : { name: 'TV Shows', url: `${ORIGIN}/tv/` };
  await writeRoute(route, shell({ title: `${item.name} | StaticVault931`, description, canonical, type: schemaType, image: item.image, parent }));
  urlGroups.get(item.type === 'movie' ? 'movies' : item.type).push({ loc: canonical, lastmod });
}
for (const person of people) {
  const route = `person/${person.id}-${person.slug}`;
  const canonical = `${ORIGIN}/${route}/`;
  const description = `Explore ${person.name}'s movies, television credits, collaborators, and related titles on StaticVault931.`;
  await writeRoute(route, shell({ title: `${person.name} | StaticVault931`, description, canonical, type: 'Person', image: person.image }));
  urlGroups.get('people').push({ loc: canonical, lastmod });
}
const movieById = new Map(titles.filter(item => item.type === 'movie').map(item => [item.id, item]));
for (const collection of collections) {
  const route = `collection/${collection.id}-${slug(collection.name)}`;
  const canonical = `${ORIGIN}/${route}/`;
  const members = collection.partIds.map(id => movieById.get(id)).filter(Boolean).map(itemLink);
  const description = `Explore ${collection.name} in release order, with movie details and related recommendations.`;
  await writeRoute(route, shell({
    title: `${collection.name} | StaticVault931`, description, canonical,
    type: 'CollectionPage', items: members,
  }));
  urlGroups.get('collections').push({ loc: canonical, lastmod });
}
for (const [id, name] of PROVIDERS) {
  const route = `provider/${id}-${slug(name)}`;
  const canonical = `${ORIGIN}/${route}/`;
  const description = `Browse movies and television shows available through ${name} in the United States.`;
  await writeRoute(route, shell({ title: `${name} | StaticVault931`, description, canonical, type: 'CollectionPage' }));
  urlGroups.get('providers').push({ loc: canonical, lastmod });
}

const sitemapDir = path.join(OUT, 'sitemaps');
await mkdir(sitemapDir, { recursive: true });
const parts = [];
for (const [group, groupUrls] of urlGroups) {
  for (let start = 0; start < groupUrls.length; start += CHUNK) {
    const suffix = groupUrls.length > CHUNK ? `-${String(Math.floor(start / CHUNK) + 1).padStart(2, '0')}` : '';
    const name = `${group}${suffix}.xml`;
    await writeFile(path.join(sitemapDir, name), sitemapXml(groupUrls.slice(start, start + CHUNK)));
    parts.push(name);
  }
}
const urls = [...urlGroups.values()].flat();
const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.map(name => `  <sitemap><loc>${ORIGIN}/sitemaps/${name}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`;
await writeFile(path.join(OUT, 'sitemap.xml'), index);
await writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
await writeFile(path.join(OUT, 'seo-build.json'), JSON.stringify({ generatedAt: new Date().toISOString(), lastmod, publicUrls: urls.length, sitemapParts: parts.length }, null, 2));
console.log(`SEO build: ${urls.length} public URLs in ${parts.length} sitemap files`);
