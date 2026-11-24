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
  assert.match(html, /id="panel-toggle"/);
  assert.match(html, /id="settings-toggle"/);
  assert.match(html, /id="connect"/);
  assert.match(html, /id="top-status"/);
  assert.match(html, /id="fullscreen-toggle"/);
  assert.match(css, /#fullscreen-toggle \{ margin-left: auto; \}/);
  assert.match(css, /\.menu-toggle \{ display: inline-flex/);
  assert.match(css, /\.settings-modal \.modal-box \{ width: min\(920px, 94vw\); height: min\(720px, 88vh\);/);
  assert.match(css, /\.settings-panel \{[^}]*flex: 1; overflow-y: auto; min-height: 0;/);
  assert.match(css, /body\.start-mode \.tempo \{ display: none; \}/);
  assert.match(css, /\.live-column \{ display: grid;/);
  assert.doesNotMatch(css, /\.live-column > \* \{ flex: 1 1 0/);
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

test('Live grid supports preset-change display items', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /Preset · Dropdown/);
  assert.match(live, /recall-preset/);
  const events = readFileSync(new URL('../src/ui/ui-events.js', import.meta.url), 'utf8');
  assert.match(events, /dataset\.presetSelect/);
});

test('Settings holds sidebar and fit-screen toggles and phone editing works', () => {
  const settings = readFileSync(new URL('../src/ui/settings.js', import.meta.url), 'utf8');
  assert.match(settings, /setLiveLayoutOption\('hideSidebar'/);
  assert.match(settings, /setLiveLayoutOption\('fitScreen'/);
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /pointerType/);
  assert.match(css, /\.live-grid\.editing \.live-grid-cell \{[^}]*touch-action: none/);
});

test('Live edit is reached via gestures or Settings', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.doesNotMatch(live, />Edit layout</);
  const settings = readFileSync(new URL('../src/ui/settings.js', import.meta.url), 'utf8');
  assert.match(settings, /data-action="edit-live-layout"/);
});

test('emptying a grid tile removes its span', () => {
  const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(app, /patch\.kind === 'empty'/);
});

test('Live grid items can be dragged between cells', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /dragstart/);
  assert.match(live, /moveLiveGridItem/);
  const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(app, /moveLiveGridItem/);
});

test('grid tiles fill their cells and row counts are uncapped', () => {
  assert.match(css, /\.live-grid-cell > \.stomp \{[^}]*width: 100%[^}]*height: 100%/);
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /minmax\(72px, 1fr\)/);
});

test('Settings can hide Live header and assignments button', () => {
  const settings = readFileSync(new URL('../src/ui/settings.js', import.meta.url), 'utf8');
  assert.match(settings, /setGlobalSetting\('hideLivePresetLabel'/);
  assert.match(settings, /setGlobalSetting\('hideAssignmentsButton'/);
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /hideLivePresetLabel/);
  assert.match(live, /hideAssignmentsButton/);
});

test('fit mode never shrinks the board wrapper', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.doesNotMatch(live, /wrap\.style\.width\s*=/);
  assert.doesNotMatch(live, /wrap\.style\.height\s*=/);
  assert.match(live, /transformOrigin = 'center center'/);
});

test('preset display items use the fetched preset names', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /Preset \$\{number\} · \$\{ctx\.presetLabel\(number\)\}/);
  assert.match(live, /escapeHtml\(ctx\.presetLabel\(number\)\)/);
});

test('presets are limited to the 64 slots on the pedal', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /number <= 64/);
  const editor = readFileSync(new URL('../src/ui/editor.js', import.meta.url), 'utf8');
  assert.match(editor, /63, 64/);
  assert.match(editor, /\$\{n\} · \$\{escapeHtml\(ctx\.presetLabel\(n\)\)\}/);
});

test('Globals can assign an expression pedal to preset volume', () => {
  const globals = readFileSync(new URL('../src/ui/globals.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(globals, /data-global="volume-pedal"/);
  assert.match(app, /expression-volume/);
});

test('Editor sidebar lists only edited presets', () => {
  const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(app, /isPresetEdited\(state, number\)/);
  assert.match(app, /Edited presets/);
});

test('vertical expression fill is anchored to the bottom', () => {
  assert.match(css, /\.vertical-expression \.expression-meter \{[^}]*position: relative/);
  assert.match(css, /\.vertical-expression \.expression-meter i \{[^}]*position: absolute; bottom: 0/);
});

test('expression faders hold touch drags and show vertical fill', () => {
  assert.match(css, /\.expression-meter\.interactive \{[^}]*touch-action: none/);
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /lostpointercapture/);
  assert.match(live, /fill\.style\.width = '100%'/);
});

test('expression faders are always interactive and update both axes', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(live, /expression-meter interactive/);
  assert.doesNotMatch(app, /interactiveLive && !fullTouch/);
  assert.match(app, /vertical \? 'height' : 'width'/);
});

test('tall expression cells become vertical faders', () => {
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /vertical-expression/);
  assert.match(css, /\.vertical-expression \.expression-touch/);
  assert.match(live, /rect\.bottom - clientY/);
});

test('full-touch expression control is rendered as a large pad', () => {
  assert.match(css, /\.expression-touch \{/);
  assert.match(css, /touch-action: none/);
});

test('the log bar can be hidden and fit mode reserves its space', () => {
  assert.match(css, /body\.hide-logbar #logbar \{ display: none; \}/);
  assert.match(css, /body\.live-fit-screen #content \{[^}]*display: flex/);
  assert.match(css, /body\.live-fit-screen \.live-board-wrap \{ flex: 1/);
  const live = readFileSync(new URL('../src/ui/live.js', import.meta.url), 'utf8');
  assert.match(live, /export function fitLiveBoard/);
  assert.match(live, /gridTemplateRows/);
});

test('fit-to-screen Live mode has no scrollable content', () => {
  assert.match(css, /body\.live-fit-screen #content \{[^}]*overflow: hidden/);
});

test('live slots have stretch weights and tall containers stack vertically', () => {
  const layout = readFileSync(new URL('../src/ui/live-layout.js', import.meta.url), 'utf8');
  assert.match(layout, /data-layout-grow/);
  assert.match(css, /\.live-row\.is-vertical/);
  assert.match(css, /\.layout-slots\.row\.is-vertical/);
});

test('the live layout editor is large and mirrors row/column structure', () => {
  assert.match(css, /\.modal-box\.layout-modal-box \{ width: 94vw;/);
  assert.match(css, /\.layout-slots\.column \{/);
});
