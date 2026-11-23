import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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

test('the page links the manifest and registers the service worker', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /theme-color/);
  assert.match(html, /serviceWorker\.register/);
});
