import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the top bar has a hamburger and a collapsible menu', () => {
  assert.match(html, /id="menu-toggle"/);
  assert.match(html, /aria-controls="topbar-menu"/);
  assert.match(html, /id="topbar-menu"/);
  assert.match(html, /id="connect"/);
  assert.match(html, /id="fullscreen-toggle"/);
});
