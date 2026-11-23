import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const startSource = readFileSync(new URL('../src/ui/start.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/ui/settings.js', import.meta.url), 'utf8');

test('the top bar has a settings popup and mode buttons', () => {
  assert.match(html, /id="settings-toggle"/);
  assert.match(html, /aria-controls="topbar-menu"/);
  assert.match(html, /id="topbar-menu" class="settings-modal"/);
  assert.match(html, /id="settings-close"/);
  assert.match(html, /data-mode="editor"/);
  assert.match(html, /id="settings-toggle"/);
  assert.match(html, /id="connect"/);
  assert.match(html, /id="top-status"/);
  assert.match(html, /id="fullscreen-toggle"/);
  assert.match(css, /#fullscreen-toggle \{ margin-left: auto; \}/);
  assert.match(css, /\.menu-toggle \{ display: inline-flex/);
  assert.match(css, /\.settings-modal \.modal-box \{ width: min\(920px, 94vw\); height: min\(720px, 88vh\);/);
  assert.match(css, /\.settings-panel \{[^}]*flex: 1; overflow-y: auto; min-height: 0;/);
  assert.match(css, /body\.start-mode \.tempo \{ display: none; \}/);
  assert.match(css, /\.settings-footer \{ flex: none;/);
  assert.match(css, /body\.start-mode #sidebar \{ display: none; \}/);
  assert.match(css, /body\.start-mode:not\(\.connected\) #mode-switch \{ display: none; \}/);
});

test('settings has connection, devices and globals tabs', () => {
  assert.match(settingsSource, /id: 'connection'/);
  assert.match(settingsSource, /id: 'devices'/);
  assert.match(settingsSource, /id: 'globals'/);
});

test('start port rows constrain long device names', () => {
  assert.match(startSource, /class="port-row"/);
  assert.match(css, /\.port-id b \{[^}]*text-overflow: ellipsis/);
});
