import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || 5503;
const root = path.dirname(fileURLToPath(import.meta.url));
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  let p = path.resolve(root, relative || 'index.html');
  let injectBase = false;
  const fromRoot = path.relative(root, p);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) { res.writeHead(403); return res.end('Forbidden'); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) {
    const appRoute = /^\/(?:movies|tv|anime|clips|mix|search|library|customize)\/?$|^\/(?:title|person|collection|provider|browse)\//i.test(pathname);
    if (appRoute) { p = path.join(root, 'index.html'); injectBase = true; }
    else { res.writeHead(404); return res.end('Not found'); }
  }
  const ext = path.extname(p);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
  if (injectBase) {
    return res.end(fs.readFileSync(p, 'utf8').replace('<head>', '<head><base href="/">'));
  }
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log(`Serving on ${port}`));
