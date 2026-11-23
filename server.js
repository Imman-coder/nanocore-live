// Tiny static server. localhost is a secure context, so Web MIDI works here.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
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
    let file = path.join(root, requestPath === '/' ? 'index.html' : requestPath);
    if (!file.startsWith(root)) throw new Error('Forbidden');
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
