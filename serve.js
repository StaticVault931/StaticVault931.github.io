const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 5503;
const root = __dirname;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
http.createServer((req, res) => {
  let p = path.join(root, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('Not found'); }
  const ext = path.extname(p);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log(`Serving on ${port}`));
