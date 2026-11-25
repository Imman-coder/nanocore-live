import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/lib/components/${name}.svelte`, import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/lib/engine.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
const start = read('Start');
const settings = read('Settings');
const globals = read('GlobalsTab');
const editor = read('Editor');
const live = read('Live');
const grid = read('LiveGrid');
const fader = read('ExpressionFader');

test('the Svelte shell owns mode switching, settings, log and toast', () => {
  assert.match(app, /class:start-mode/);
  assert.match(app, /class:demo-mode/);
  assert.match(app, /<Settings open=/);
  assert.match(app, /class="logbar"/);
  assert.match(app, /class="toast"/);
  assert.match(engine, /export const app = writable/);
  assert.match(engine, /export const ctx = \{/);
});

test('Start offers direct demo entry and full transport setup', () => {
  assert.match(start, /ctx\.connect\('demo'\)/);
  assert.match(start, /value="webmidi"/);
  assert.match(start, /value="webbluetooth"/);
  assert.match(start, /value="demo"/);
  assert.match(start, /data-port-output|data-port-controller/);
  assert.match(start, /fetch|Fetch/);
  assert.match(start, /onOpenGlobals/);
});

test('Settings tab includes the demo-only real-data opt-in', () => {
  assert.match(settings, /data-setting="demo-use-real-data"/);
  assert.match(settings, /ctx\.setDemoUseRealData/);
  assert.match(settings, /\$app\.demo \?/);
  assert.match(settings, /id: 'connection'/);
  assert.match(settings, /id: 'devices'/);
  assert.match(settings, /id: 'globals'/);
  assert.match(settings, /Escape/);
  assert.match(css, /\.settings-panel \{[^}]*overflow-y: auto/);
  assert.match(css, /\.settings-footer \{[^}]*flex: none/);
});

test('Globals carries every global switch including absolute faders', () => {
  assert.match(globals, /data-global="absolute-expression"/);
  assert.match(globals, /data-global="volume-pedal"/);
  assert.match(globals, /data-global="interactive-live"/);
  assert.match(globals, /data-global="firmware"/);
  assert.match(globals, /data-global="midi-channel"/);
  assert.match(globals, /data-global="recall-method"/);
  assert.match(globals, /data-global="tempo-sync"/);
});

test('Editor renders a reorderable chain for mouse, touch and pen', () => {
  assert.match(editor, /chainRowAt/);
  assert.match(editor, /setChainOrder/);
  assert.match(editor, /event\.pointerType === 'mouse'/);
  assert.doesNotMatch(editor, /addEventListener\('lostpointercapture'/);
  assert.match(editor, /dragstart|dragover/);
  assert.match(editor, /PedalPopup/);
  assert.match(css, /touch-action: pan-y/);
});

test('Editor keeps scenes, stomps, knobs and preset actions', () => {
  assert.match(editor, /selectScene/);
  assert.match(editor, /storeScene/);
  assert.match(editor, /setBlockStomp/);
  assert.match(editor, /<Knob/);
  assert.match(editor, /renamePresetOnDevice/);
  assert.match(editor, /savePreset/);
  assert.doesNotMatch(editor, /assignments-details|Per-preset MIDI assignments|<Assignments/);
});

test('Live keeps the editable grid and all display item kinds', () => {
  assert.match(live, /toggleLiveEdit/);
  assert.match(grid, /expression/);
  assert.match(grid, /scene/);
  assert.match(grid, /stomp/);
  assert.match(grid, /preset/);
  assert.match(grid, /data-grid|grid-template/);
  assert.match(grid, /event\.pointerType === 'mouse'/);
  assert.match(css, /touch-action: none/);
});

test('expression faders recall values and slide relatively by default', () => {
  assert.match(fader, /expressionInitialValue/);
  assert.match(fader, /expressionRawFromRelative/);
  assert.match(fader, /absoluteExpression/);
  assert.match(fader, /aria-valuenow/);
  assert.match(fader, /ArrowRight|ArrowLeft/);
  assert.match(fader, /pointercancel/);
  assert.doesNotMatch(fader, /lostpointercapture/);
  const popup = read('PedalPopup');
  assert.match(popup, /z-index: 0/);
  assert.match(popup, /z-index: 1/);
  assert.match(popup, /overflow-y: auto/);
});

test('demo data stays sandboxed in the Svelte engine', () => {
  assert.match(engine, /sandboxState/);
  assert.match(engine, /workingStorage/);
  assert.match(engine, /demoUseRealData/);
  assert.match(engine, /setDemoUseRealData/);
});
