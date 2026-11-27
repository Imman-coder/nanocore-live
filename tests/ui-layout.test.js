import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/lib/components/${name}.svelte`, import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/lib/engine.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
const start = read('Start');
const settings = read('Settings');
const globals = read('GlobalsTab');
const editor = read('Editor');
const live = read('Live');
const grid = read('LiveGrid');
const fader = read('ExpressionFader');
const knob = read('Knob');

test('the Svelte shell owns mode switching, settings, log and toast', () => {
  assert.match(app, /data-mode=\{mode\}/);
  assert.match(app, /data-demo=\{\$uiView\.demo\}/);
  assert.match(app, /<Settings open=/);
  assert.match(app, /MIDI/);
  assert.match(app, /fixed right-\[18px\] top-16 z-\[70\]/);
  assert.match(engine, /export \{ app, stateView, snapshotView, feedbackView, uiView \}/);
  assert.match(engine, /export const ctx = \{/);
});

test('Start offers direct demo and device entry with a clear status', () => {
  assert.match(start, /ctx\.connect\('demo'\)/);
  assert.match(start, /Try demo/);
  assert.match(start, /connectDevice/);
  assert.match(start, /Connect device/);
  assert.match(start, /Unleash your/);
  assert.match(start, /capabilities\?\.bluetooth/);
  assert.match(start, /Connect via MIDI BLE/);
  assert.match(start, /ctx\.connect\('webbluetooth'\)/);
  assert.doesNotMatch(start, /<!--/);
});

test('Settings tab includes the demo-only real-data opt-in', () => {
  assert.match(settings, /data-setting="demo-use-real-data"/);
  assert.match(settings, /ctx\.setDemoUseRealData/);
  assert.match(settings, /\$uiView\.demo \?/);
  assert.match(settings, /id: 'connection'/);
  assert.match(settings, /id: 'devices'/);
  assert.match(settings, /id: 'globals'/);
  assert.match(settings, /Escape/);
  assert.match(settings, /overflow-y-auto/);
  assert.match(settings, /flex-none/);
  assert.match(settings, /hideLivePresetSelector/);
  assert.doesNotMatch(settings, /hideSidebar/);
  assert.match(settings, /modal-backdrop/);
  assert.match(settings, /class="join"/);
  assert.match(settings, /alert alert-warning/);
  assert.match(settings, /toggle toggle-sm toggle-primary/);
});

test('Globals carries every global switch including absolute faders', () => {
  assert.match(globals, /data-global="absolute-expression"/);
  assert.doesNotMatch(globals, /fullTouch|fs-full-touch/);
  assert.match(globals, /data-global="volume-pedal"/);
  assert.match(globals, /data-global="interactive-live"/);
  assert.match(globals, /data-global="firmware"/);
  assert.match(globals, /data-global="midi-channel"/);
  assert.match(globals, /data-global="recall-method"/);
  assert.match(globals, /data-global="tempo-sync"/);
  assert.match(globals, /card-title/);
  assert.match(globals, /toggle toggle-sm toggle-primary/);
  assert.match(globals, /class="join"/);
});

test('MIDI devices keep the chosen reply port and use radio controls', () => {
  const devices = read('DevicesTab');
  assert.match(devices, /radio radio-sm radio-primary/);
  assert.doesNotMatch(devices, /input input-bordered input-sm" type="radio"/);
  assert.match(devices, /lastPortSignature/);
  assert.match(devices, /shortPortName/);
  assert.match(devices, /title=\{row\.input\?\.name \?\? row\.output\?\.name\}/);
  assert.match(devices, /data-devices-scan/);
  assert.match(devices, /data-dev="save"/);
  assert.match(devices, /NANOCORE receive/);
  assert.match(devices, /NANOCORE send/);
  assert.match(devices, /Controller receive/);
  assert.match(devices, /<table/);
  assert.match(devices, /alert alert-info/);
  assert.match(devices, /class="join"/);
  assert.doesNotMatch(devices, /title=\{port\.id\}/);
});

test('Editor renders a reorderable chain for mouse, touch and pen', () => {
  assert.match(editor, /chainRowAt/);
  assert.match(editor, /setChainOrder/);
  assert.match(editor, /event\.pointerType === 'mouse'/);
  assert.doesNotMatch(editor, /addEventListener\('lostpointercapture'/);
  assert.match(editor, /dragstart|dragover/);
  assert.match(editor, /PedalPopup/);
  assert.match(editor, /touch-pan-y/);
});

test('Editor keeps scenes, stomps, knobs and preset actions', () => {
  assert.match(editor, /selectScene/);
  assert.match(editor, /storeScene/);
  assert.match(editor, /setBlockStomp/);
  assert.match(editor, /<Knob/);
  assert.match(editor, /renamePresetOnDevice/);
  assert.match(editor, /savePreset/);
  assert.doesNotMatch(editor, /assignments-details|Per-preset MIDI assignments|<Assignments/);
  assert.match(editor, /requestSceneBlock/);
  assert.match(editor, /forgetValues: true/);
  assert.match(editor, /Forget values/);
  assert.match(editor, /subdivisionIndex/);
  assert.match(editor, /entry\.synced/);
  assert.match(editor, /setSubdivision/);
  assert.doesNotMatch(editor, /\.filter\(\(\{ param \}\) => !\(tempoSynced/);
});

test('Live keeps the editable grid and all display item kinds', () => {
  assert.match(live, /toggleLiveEdit/);
  assert.match(live, /hideLivePresetSelector/);
  assert.match(grid, /expression/);
  assert.match(grid, /scene/);
  assert.match(grid, /stomp/);
  assert.match(grid, /preset/);
  assert.match(grid, /data-grid|grid-template/);
  assert.match(grid, /event\.pointerType === 'mouse'/);
  assert.match(grid, /touch-none/);
});

test('expression faders recall values and slide relatively by default', () => {
  assert.match(fader, /expressionInitialValue/);
  assert.match(fader, /expressionRawFromRelative/);
  assert.match(fader, /absoluteExpression/);
  assert.match(fader, /aria-valuenow/);
  assert.match(fader, /ArrowRight|ArrowLeft/);
  assert.match(fader, /pointercancel/);
  assert.doesNotMatch(fader, /fullTouch/);
  assert.doesNotMatch(fader, /lostpointercapture/);
  assert.doesNotMatch(fader, /bg-\[#0f1319\] bg-gradient-to-r/);
  assert.match(fader, /h-full bg-gradient-to-r from-accent-2 to-accent/);
  assert.match(fader, /w-full bg-gradient-to-t from-accent-2 to-accent/);
  const popup = read('PedalPopup');
  assert.match(popup, /z-0/);
  assert.match(popup, /z-10/);
  assert.match(popup, /overflow-y-auto/);
  assert.match(popup, /createDaisyDualRange/);
  assert.match(popup, /pedalRangeEl/);
  assert.match(popup, /paramRangeEl/);
  assert.match(main, /daisy-dual-range\/style\.css/);
  assert.match(popup, /btn-outline/);
  assert.match(popup, /btn-primary/);
  assert.match(popup, /Selected:/);
  assert.doesNotMatch(popup, /bg-\[#30281b\]/);
});

test('Editor knobs draw an outer value preview ring', () => {
  assert.match(knob, /stroke-dasharray/);
  assert.match(knob, /-rotate-\[225deg\]/);
  assert.match(knob, /valueArc/);
});

test('Live editing suppresses performance triggers', () => {
  assert.match(grid, /disabled=\{editing\}/);
  assert.match(fader, /export let editing/);
  assert.match(fader, /if \(editing\) return/);
  assert.match(live, /disabled=\{editing\}/);
});

test('controller and on-screen expressions share one engine dispatcher', () => {
  const resolverSource = readFileSync(new URL('../src/engine/resolver.js', import.meta.url), 'utf8');
  const dispatcherSource = readFileSync(new URL('../src/engine/dispatcher.js', import.meta.url), 'utf8');
  assert.match(resolverSource, /export function resolveExpression/);
  assert.match(dispatcherSource, /command\.type === 'expression'/);
  assert.match(engine, /createDispatcher/);
  assert.match(engine, /dispatcher\.dispatch\(command\)/);
  assert.match(editor, /openPopup\(entry\.index, entry\.param, entry\.synced\)/);
  assert.match(read('PedalPopup'), /target\.tempo/);
});

test('demo data stays sandboxed in the connection gateway', () => {
  const gateway = readFileSync(new URL('../src/lib/gateway/connection.js', import.meta.url), 'utf8');
  assert.match(gateway, /sandboxState/);
  assert.match(gateway, /workingStorage/);
  assert.match(gateway, /demoUseRealData/);
  assert.match(gateway, /setDemoUseRealData/);
});
