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
  let p = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('Not found'); }
  const ext = path.extname(p);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log(`Serving on ${port}`));
