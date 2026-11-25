import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = new URL('../', import.meta.url);

test('the web app manifest is installable', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.name && manifest.short_name);
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(icon.src.replace(/^\//, ''), root)), `${icon.src} exists`);
  }
});

test('the service worker caches the app shell and cleans old caches', () => {
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  assert.match(sw, /install/);
  assert.match(sw, /activate/);
  assert.match(sw, /fetch/);
  assert.match(sw, /caches\.delete/);
});

test('offline requests fall back to the cache while online requests stay fresh', () => {
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  assert.match(sw, /await fetch\(request\)/);
  assert.match(sw, /caches\.match\(request/);
  assert.match(sw, /ignoreSearch: true/);
  assert.match(sw, /request\.mode === 'navigate'/);
});

test('every local module import is precached for offline startup', () => {
  const sw = readFileSync(new URL('sw.js', root), 'utf8');
  const shell = new Set([...sw.matchAll(/'(\/[^']+)'/g)].map((match) => match[1]));
  const rootPath = fileURLToPath(root);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const file = path.join(dir, entry);
      if (statSync(file).isDirectory()) walk(file);
      else if (file.endsWith('.js')) files.push(file);
    }
  };
  walk(fileURLToPath(new URL('src', root)));
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s+)'(\.[^']+)'/g)) {
      const target = '/' + path.relative(rootPath, path.resolve(path.dirname(file), match[1]));
      assert.ok(shell.has(target), `${path.relative(rootPath, file)} imports ${target}, which must be in SHELL`);
    }
  }
});

test('the page links the manifest and registers the service worker', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /theme-color/);
  assert.match(html, /serviceWorker\.register/);
});
