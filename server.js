// Tiny static server. localhost is a secure context, so Web MIDI works here.
import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
// Production serves the Vite build when present; `npm run dev` uses Vite itself.
const servedRoot = existsSync(path.join(root, 'dist')) ? path.join(root, 'dist') : root;
const port = Number(process.env.PORT ?? 8123);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http.createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.join(servedRoot, requestPath === '/' ? 'index.html' : requestPath);
    if (!file.startsWith(servedRoot)) throw new Error('Forbidden');
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[path.extname(file)] ?? 'application/octet-stream',
      ...(path.basename(file) === 'sw.js' ? { 'service-worker-allowed': '/' } : {}),
    });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found: ' + error.message);
  }
}).listen(port, () => console.log(`NANOCORE Live running at http://localhost:${port}`));
