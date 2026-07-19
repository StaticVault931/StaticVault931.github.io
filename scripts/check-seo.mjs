import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, process.argv[2] || 'dist');
const ORIGIN = 'https://staticvault931.github.io';
const errors = [];
const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&'));

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

const indexXml = await readFile(path.join(OUT, 'sitemap.xml'), 'utf8');
const sitemapUrls = locs(indexXml);
if (!sitemapUrls.length) errors.push('sitemap.xml contains no sitemap files');

const publicUrls = [];
for (const sitemapUrl of sitemapUrls) {
  const parsed = new URL(sitemapUrl);
  if (parsed.origin !== ORIGIN) errors.push(`Foreign sitemap origin: ${sitemapUrl}`);
  const file = path.join(OUT, parsed.pathname.replace(/^\/+/, ''));
  if (!await exists(file)) { errors.push(`Missing sitemap file: ${parsed.pathname}`); continue; }
  const urls = locs(await readFile(file, 'utf8'));
  if (urls.length > 10000) errors.push(`${parsed.pathname} contains ${urls.length} URLs`);
  publicUrls.push(...urls);
}

const uniqueUrls = new Set(publicUrls);
if (uniqueUrls.size !== publicUrls.length) errors.push(`Sitemaps contain ${publicUrls.length - uniqueUrls.size} duplicate URLs`);
for (const raw of uniqueUrls) {
  let url;
  try { url = new URL(raw); } catch { errors.push(`Invalid URL: ${raw}`); continue; }
  if (url.origin !== ORIGIN) errors.push(`Foreign public URL: ${raw}`);
  if (url.search || url.hash) errors.push(`Non-canonical query or fragment URL: ${raw}`);
  if (/^\/(?:search|library|customize)(?:\/|$)/.test(url.pathname)) errors.push(`Private route in sitemap: ${raw}`);
  if (url.pathname !== '/' && !url.pathname.endsWith('/')) errors.push(`Canonical lacks trailing slash: ${raw}`);
}

const required = ['/', '/movies/', '/tv/', '/anime/', '/clips/', '/mix/', '/provider/9-amazon-prime-video/', '/provider/100-tubi-tv/'];
for (const route of required) {
  if (!uniqueUrls.has(`${ORIGIN}${route}`)) errors.push(`Required public route missing from sitemap: ${route}`);
}

const titleRegressions = [
  '/title/movie/1083381-backrooms-2026/',
  '/title/movie/986056-thunderbolts-2025/',
];
for (const route of titleRegressions) {
  if (!uniqueUrls.has(`${ORIGIN}${route}`)) errors.push(`Year-bearing title route missing from sitemap: ${route}`);
}

const routes = [...uniqueUrls].map(raw => new URL(raw));
for (let start = 0; start < routes.length; start += 250) {
  await Promise.all(routes.slice(start, start + 250).map(async url => {
    const file = url.pathname === '/' ? path.join(OUT, 'index.html') : path.join(OUT, url.pathname.replace(/^\/+|\/+$/g, ''), 'index.html');
    if (!await exists(file)) { errors.push(`Missing route shell: ${url.pathname}`); return; }
    const html = await readFile(file, 'utf8');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
    if (canonical !== url.href) errors.push(`Canonical mismatch for ${url.pathname}: ${canonical || 'missing'}`);
  }));
}

const privateRoutes = ['/search/', '/library/', '/library/watchlist/', '/library/liked/', '/library/recent/', '/library/taste-profile/', '/customize/'];
for (const route of privateRoutes) {
  const html = await readFile(path.join(OUT, route.slice(1, -1), 'index.html'), 'utf8');
  if (!/name="robots" content="noindex, follow"/i.test(html)) errors.push(`Private route is not noindex: ${route}`);
}

const forbidden = [
  'package.json', 'package-lock.json', 'playwright.config.js', 'eslint.config.js', 'serve.js',
  '.gitignore', '.editorconfig', 'scripts', 'tests', '.github', 'node_modules',
];
for (const relative of forbidden) {
  if (await exists(path.join(OUT, relative))) errors.push(`Development-only path leaked into deployment: ${relative}`);
}

if (errors.length) {
  console.error(`SEO validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 100)) console.error(`- ${error}`);
  if (errors.length > 100) console.error(`- ...and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(`SEO validation passed: ${publicUrls.length} canonical public URLs across ${sitemapUrls.length} sitemap files`);
