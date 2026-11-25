import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = new URL('../', import.meta.url);

test('the web app manifest is installable', () => {
  const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.name && manifest.short_name);
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(new URL(`public${icon.src}`, root)), `${icon.src} exists`);
  }
});

test('the generated service worker caches the build and cleans old caches', () => {
  const source = readFileSync(new URL('scripts/generate-sw.js', root), 'utf8');
  assert.match(source, /install/);
  assert.match(source, /activate/);
  assert.match(source, /fetch/);
  assert.match(source, /caches\.delete/);
  assert.match(source, /walk\(dist\)/);
  assert.match(source, /writeFileSync\(path\.join\(dist, 'sw\.js'\)/);
});

test('offline requests fall back to the cache while online requests stay fresh', () => {
  const source = readFileSync(new URL('scripts/generate-sw.js', root), 'utf8');
  assert.match(source, /await fetch\(request\)/);
  assert.match(source, /caches\.match\(request/);
  assert.match(source, /ignoreSearch: true/);
  assert.match(source, /request\.mode === 'navigate'/);
});

test('every local module import resolves to a real source file', () => {
  const rootPath = fileURLToPath(root);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const file = path.join(dir, entry);
      if (statSync(file).isDirectory()) walk(file);
      else if (file.endsWith('.js') || file.endsWith('.svelte')) files.push(file);
    }
  };
  walk(fileURLToPath(new URL('src', root)));
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s+)'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(existsSync(target), `${path.relative(rootPath, file)} imports ${match[1]}`);
    }
  }
});

test('the Svelte entry links the manifest and registers the service worker', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /theme-color/);
  assert.match(html, /src="\/src\/main\.js"/);
  assert.match(html, /serviceWorker\.register/);
});
