import { readFile } from 'node:fs/promises';
import { STRINGS } from '../src/js/i18n.js';

const english = new Set(Object.keys(STRINGS.en || {}));
const missing = [];
for (const [language, dictionary] of Object.entries(STRINGS)) {
  if (language === 'en') continue;
  for (const key of english) if (!(key in dictionary)) missing.push(`${language}: ${key}`);
}

const sources = await Promise.all(['index.html', 'src/js/app.js', 'src/js/pages.js', 'src/js/templates.js']
  .map(file => readFile(file, 'utf8').catch(() => '')));
const usedKeys = new Set(sources.flatMap(source => [...source.matchAll(/data-i18n(?:-placeholder|-label)?=["']([^"']+)/g)].map(match => match[1])));
for (const key of usedKeys) if (!english.has(key)) missing.push(`en: ${key}`);

if (missing.length) {
  console.error(`Missing i18n keys:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`${english.size} interface keys complete across ${Object.keys(STRINGS).length} dictionaries`);
