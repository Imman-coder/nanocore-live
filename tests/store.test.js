import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultState, loadState, saveState, exportState, importState,
  setActivePreset, updatePreset, upsertStomp, upsertExpression,
  setBlockStomp, setParamPedal, pedalOwner, setScene, setSceneEnabled, setSceneBlock, setBase, setTempoSync, setLiveLayout, setLiveGrid, setPresetName, setPresetNames, markPresetEdited, isPresetEdited,
  effectiveStompLabel, assignmentsFor, normalizeState, renameScene,
} from '../src/core/store.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('the app opens on the Start page', () => {
  assert.equal(createDefaultState().mode, 'start');
});

test('the transport choice is persisted', () => {
  assert.equal(createDefaultState().globals.transportKind, 'webmidi');
});

test('default state has four footswitches and preset 1 selected', () => {
  const state = createDefaultState();
  assert.deepEqual(state.globals.footswitches.map((fs) => fs.id), ['FS1', 'FS2', 'FS3', 'FS4']);
  assert.equal(state.activePreset, 1);
  assert.equal(assignmentsFor(state, 1).stomps.length, 0);
});

test('state round-trips through storage', () => {
  const storage = memoryStorage();
  let state = createDefaultState();
  state = updatePreset(state, 9, { name: 'TightRhy' });
  saveState(storage, setActivePreset(state, 9));
  const loaded = loadState(storage);
  assert.equal(loaded.activePreset, 9);
  assert.equal(assignmentsFor(loaded, 9).name, 'TightRhy');
});

test('legacy live-set rows migrate into preset-number-keyed assignments', () => {
  const legacy = {
    version: 1,
    globals: { footswitches: [{ id: 'FS1', name: 'Stomp 1', trigger: { type: 'cc', channel: 1, number: 5 } }] },
    liveSet: { name: 'My live set', rows: [
      { id: 'r1', preset: 7, name: 'Seven', stomps: [{ fsId: 'FS1', targets: [{ block: 'fx2' }] }], expressions: [] },
    ] },
  };
  const state = importState(JSON.stringify(legacy));
  assert.equal(state.activePreset, 7);
  assert.deepEqual(assignmentsFor(state, 7).stomps[0].targets, [{ block: 'fx2' }]);
  assert.equal(assignmentsFor(state, 7).name, 'Seven');
});

test('assignments are independent per NANOCORE preset', () => {
  let state = createDefaultState();
  state = setBlockStomp(state, 1, 'fx2', 'FS2');
  state = setBlockStomp(state, 9, 'del', 'FS2');
  assert.deepEqual(state.presets['1'].blockStomps, { fx2: 'FS2' });
  assert.deepEqual(state.presets['9'].blockStomps, { del: 'FS2' });
});

test('upserting a stomp updates instead of duplicating it', () => {
  let state = createDefaultState();
  state = setBlockStomp(state, 4, 'fx1', 'FS1');
  state = setBlockStomp(state, 4, 'rev', 'FS1');
  assert.deepEqual(assignmentsFor(state, 4).stomps, [
    { fsId: 'FS1', mode: 'value', targets: [{ block: 'fx1' }, { block: 'rev' }] },
  ]);
});

test('expression bindings are stored per preset', () => {
  const state = upsertExpression(createDefaultState(), 3, {
    id: 'E1', trigger: { type: 'cc', channel: 1, number: 7 }, target: 'fx1', paramIndex: 1,
  });
  assert.equal(assignmentsFor(state, 3).expressions.length, 1);
  assert.equal(assignmentsFor(state, 3).expressions[0].paramIndex, 1);
  assert.equal(assignmentsFor(state, 4).expressions.length, 0);
});

test('expression value windows reach the router-facing assignment shape', () => {
  const state = setParamPedal(createDefaultState(), 3, 'fx1', 0, {
    pedal: 'E4', inputMin: 6, inputMax: 121, outputMin: 38, outputMax: 102, invert: true,
  });
  const entry = assignmentsFor(state, 3).expressions[0];
  assert.equal(entry.inputMin, 6);
  assert.equal(entry.inputMax, 121);
  assert.equal(entry.outputMin, 38);
  assert.equal(entry.outputMax, 102);
  assert.equal(entry.invert, true);
});

test('absolute expression faders default off and survive normalization', () => {
  assert.equal(createDefaultState().globals.absoluteExpression, false);
  assert.equal(normalizeState({ globals: { absoluteExpression: true } }).globals.absoluteExpression, true);
  assert.equal(normalizeState({ globals: { absoluteExpression: 'yes' } }).globals.absoluteExpression, false);
});

test('export/import preserves assignments', () => {
  let state = createDefaultState();
  state = setBlockStomp(state, 12, 'mod', 'FS3');
  state = setParamPedal(state, 12, 'fx1', 0, { pedal: 'E4', inputMin: 0, inputMax: 127, invert: false });
  const restored = importState(exportState(state));
  assert.deepEqual(restored.presets['12'].blockStomps, { mod: 'FS3' });
  assert.equal(restored.presets['12'].paramPedals['fx1:0'].pedal, 'E4');
});

test('import rejects a document from an incompatible version', () => {
  assert.throws(() => importState('{"version":99}'));
  assert.throws(() => importState('not json'));
});



test('sceneBlocks is a per-preset map defaulting to all blocks participating', () => {
  let state = createDefaultState();
  assert.deepEqual(state.presets['1'].sceneBlocks, {});
  state = setSceneBlock(state, 1, 'mod', false);
  assert.equal(state.presets['1'].sceneBlocks.mod, false);
  assert.equal(state.presets['2']?.sceneBlocks?.mod, undefined);
});

test('scenes are stored per preset and normalised', () => {
  let state = createDefaultState();
  state = setScene(state, 7, 'scene1', { 'del:0': 0.5, 'mod:1': 0.25 });
  assert.deepEqual(state.presets['7'].scenes.scene1, { 'del:0': 0.5, 'mod:1': 0.25 });
  assert.deepEqual(createDefaultState().presets['1'].scenes.scene2, {});
  state = setScene(state, 7, 'scene2', { 'del:0': 0.2 });
  assert.equal(assignmentsFor(state, 7).scenes.scene1['del:0'], 0.5);
  assert.deepEqual(assignmentsFor(state, 9).scenes.scene1, {});
});


test('globals have three assignable scene switches', () => {
  const g = createDefaultState().globals;
  assert.deepEqual(g.sceneSwitches.map((s) => s.id), ['S1', 'S2', 'S3']);
  assert.deepEqual(g.sceneSwitches.map((s) => s.scene), ['base', 'scene1', 'scene2']);
  assert.equal(g.sceneSwitches[1].trigger.number, 85);
});

test('fx on/off states are stored per scene', () => {
  let state = createDefaultState();
  state = setSceneEnabled(state, 3, 'scene1', { fx1: false, mod: true });
  assert.deepEqual(assignmentsFor(state, 3).sceneEnabled.scene1, { fx1: false, mod: true });
  assert.deepEqual(assignmentsFor(createDefaultState(), 3).sceneEnabled.scene2, {});
});


test('tap tempo has a default MIDI trigger', () => {
  const g = createDefaultState().globals;
  assert.equal(g.tapTempoSwitch.id, 'TAP');
  assert.equal(g.tapTempoSwitch.trigger.number, 87);
});

test('tempo settings default to a 4/4 eighth-note sync', () => {
  const g = createDefaultState().globals;
  assert.equal(g.tempoSync, true);
  assert.equal(g.tempo.bpm, null);
  assert.equal(g.tempo.signature, '4/4');
  assert.equal(g.tempo.subdivision, '1/8');
});

test('interactive live mode is an opt-in global', () => {
  assert.equal(createDefaultState().globals.interactiveLive, false);
  assert.equal(normalizeState({ globals: { interactiveLive: true } }).globals.interactiveLive, true);
});

test('legacy tree layout migrates to individual grid cells', () => {
  const legacy = {
    root: { type: 'row', items: [
      { type: 'item', kind: 'scenes' },
      { type: 'item', kind: 'stomps' },
      { type: 'item', kind: 'tap' },
      { type: 'item', kind: 'expressions' },
    ] },
    hideSidebar: false,
  };
  const grid = normalizeState({ globals: { liveLayout: legacy } }).globals.liveLayout.grid;
  const kinds = grid.items.map((item) => item.kind);
  assert.ok(kinds.includes('scene'));
  assert.ok(kinds.includes('stomp'));
  assert.ok(kinds.includes('expression'));
  assert.ok(kinds.includes('tap'));
  assert.ok(grid.items.every((item) => item.colSpan >= 1 && item.rowSpan >= 1));
});

test('the bottom MIDI message bar can be hidden', () => {
  assert.equal(createDefaultState().globals.showLogBar, true);
  assert.equal(normalizeState({ globals: { showLogBar: false } }).globals.showLogBar, false);
  assert.equal(createDefaultState().globals.hideLivePresetLabel, false);
  assert.equal(createDefaultState().globals.hideAssignmentsButton, false);
});

test('expression pedals can opt into a full touch control', () => {
  const g = createDefaultState().globals;
  assert.equal(g.expressionPedals[0].fullTouch, false);
  assert.equal(normalizeState({ globals: { expressionPedals: [{ id: 'E1', name: 'E1', trigger: { type: 'cc', channel: 1, number: 7 } }] } }).globals.expressionPedals[0].fullTouch, false);
});

test('live layout is a grid with span-aware items', () => {
  const g = createDefaultState().globals;
  assert.equal(g.liveLayout.grid.columns, 4);
  assert.equal(g.liveLayout.grid.rows, 3);
  assert.equal(g.liveLayout.hideSidebar, false);
  assert.equal(g.liveLayout.fitScreen, false);
  const state = setLiveGrid(createDefaultState(), { columns: 6, rows: 4 });
  assert.equal(state.globals.liveLayout.grid.columns, 6);
  assert.equal(state.globals.liveLayout.grid.rows, 4);
});

test('tempo sync is an opt-in per-block per-preset setting', () => {
  let state = createDefaultState();
  assert.deepEqual(assignmentsFor(state, 1).tempoSync, {});
  state = setTempoSync(state, 1, 'del', { enabled: true, subdivision: '1/16' });
  assert.deepEqual(assignmentsFor(state, 1).tempoSync.del, { enabled: true, subdivision: '1/16' });
  assert.equal(assignmentsFor(state, 2).tempoSync.del, undefined);
});

test('Base scene values are persisted per preset and preset changes return to Base', () => {
  let state = createDefaultState();
  assert.deepEqual(state.presets['1'].base, { values: {}, enabled: {} });
  state = setBase(state, 1, { 'mod:0': 0.5 }, { mod: true });
  assert.deepEqual(state.presets['1'].base.values, { 'mod:0': 0.5 });
  state = setActivePreset(state, 2);
  assert.equal(state.activeScene, 'base');
  assert.deepEqual(assignmentsFor(state, 2).base, { values: {}, enabled: {} });
});

test('base override is an opt-in global defaulting to off', () => {
  assert.equal(createDefaultState().globals.baseOverride, false);
  assert.equal(normalizeState({ globals: { baseOverride: true } }).globals.baseOverride, true);
});

test('globals default to three scene choices and grow to at most six', () => {
  const base = createDefaultState();
  assert.equal(base.globals.sceneCount, 3);
  assert.equal(base.globals.sceneNames, undefined);
  const grown = normalizeState({ globals: { sceneCount: 6 } });
  assert.equal(grown.globals.sceneCount, 6);
  assert.equal(grown.globals.sceneSwitches.length, 6);
  assert.deepEqual(grown.globals.sceneSwitches.map((s) => s.scene),
    ['base', 'scene1', 'scene2', 'scene3', 'scene4', 'scene5']);
  const clamped = normalizeState({ globals: { sceneCount: 99 } });
  assert.equal(clamped.globals.sceneCount, 6);
});

test('scene names are stored per preset, not globally', () => {
  let state = createDefaultState();
  assert.equal(assignmentsFor(state, 1).sceneNames.scene1, 'Scene 1');
  state = renameScene(state, 1, 'scene1', 'Rhythm');
  assert.equal(assignmentsFor(state, 1).sceneNames.scene1, 'Rhythm');
  assert.equal(assignmentsFor(state, 2).sceneNames.scene1, 'Scene 1');
  state = setScene(state, 2, 'scene4', { 'fx1:0': 0.4 });
  assert.equal(state.presets['2'].scenes.scene4['fx1:0'], 0.4);
  const restored = importState(exportState(state));
  assert.equal(assignmentsFor(restored, 1).sceneNames.scene1, 'Rhythm');
});

test('default state has four virtual expression pedals', () => {
  const state = createDefaultState();
  assert.deepEqual(state.globals.expressionPedals.map((p) => p.id), ['E1', 'E2', 'E3', 'E4']);
});

test('a block can be assigned to only one stomp, and moving it clears the old one', () => {
  let state = createDefaultState();
  state = setBlockStomp(state, 7, 'fx2', 'FS1');
  state = setBlockStomp(state, 7, 'fx2', 'FS3');
  assert.deepEqual(state.presets['7'].blockStomps, { fx2: 'FS3' });
  state = setBlockStomp(state, 7, 'fx2', null);
  assert.deepEqual(state.presets['7'].blockStomps, {});
});

test('parameter-to-pedal mappings are stored with their input range', () => {
  let state = createDefaultState();
  state = setParamPedal(state, 7, 'fx1', 0, { pedal: 'E2', inputMin: 20, inputMax: 100, invert: true });
  assert.deepEqual(state.presets['7'].paramPedals['fx1:0'], { pedal: 'E2', inputMin: 20, inputMax: 100, invert: true });
  assert.equal(pedalOwner(state, 7, 'E2'), 'fx1:0');
  assert.equal(pedalOwner(state, 7, 'E3'), null);
  state = setParamPedal(state, 7, 'fx1', 0, null);
  assert.equal(pedalOwner(state, 7, 'E2'), null);
});

test('assignments are exposed in the shape the router consumes', () => {
  let state = createDefaultState();
  state = setBlockStomp(state, 9, 'rev', 'FS2');
  state = setParamPedal(state, 9, 'fx1', 1, { pedal: 'E1', inputMin: 0, inputMax: 127, invert: false });
  const a = assignmentsFor(state, 9);
  assert.deepEqual(a.stomps, [{ fsId: 'FS2', mode: 'value', targets: [{ block: 'rev' }] }]);
  assert.equal(a.expressions.length, 1);
  assert.equal(a.expressions[0].target, 'fx1');
  assert.equal(a.expressions[0].paramIndex, 1);
  assert.equal(a.expressions[0].trigger.number, state.globals.expressionPedals[0].trigger.number);
});

test('legacy expressions migrate into parameter-pedal mappings', () => {
  const legacy = {
    version: 1,
    globals: { footswitches: [{ id: 'FS1', name: 'Stomp 1', trigger: { type: 'cc', channel: 1, number: 5 } }] },
    liveSet: { rows: [{ preset: 4, name: 'Four', stomps: [{ fsId: 'FS1', targets: [{ block: 'mod' }] }],
      expressions: [{ id: 'E1', trigger: { type: 'cc', channel: 1, number: 11 }, target: 'amp', paramIndex: 2, invert: true }] }] },
  };
  const state = importState(JSON.stringify(legacy));
  assert.deepEqual(state.presets['4'].blockStomps, { mod: 'FS1' });
  assert.equal(state.presets['4'].paramPedals['amp:2'].pedal, 'E1');
  assert.equal(state.presets['4'].paramPedals['amp:2'].invert, true);
});

test('an unassigned stomp label falls back to the global footswitch name', () => {
  const state = createDefaultState();
  assert.equal(effectiveStompLabel(state, assignmentsFor(state, 1), 'FS3'), 'Stomp 3');
  const withLabel = { ...assignmentsFor(state, 1), stomps: [{ fsId: 'FS3', label: 'Solo' }] };
  assert.equal(effectiveStompLabel(state, withLabel, 'FS3'), 'Solo');
});

test('preset volume expression pedal is a global setting', () => {
  const base = createDefaultState();
  assert.equal(base.globals.volumePedal, null);
  assert.equal(normalizeState({ globals: { volumePedal: 'E2' } }).globals.volumePedal, 'E2');
});

test('preset edited flag is set only by editor changes', () => {
  const base = createDefaultState();
  assert.equal(isPresetEdited(base, 1), false);
  const edited = markPresetEdited(base, 1);
  assert.equal(isPresetEdited(edited, 1), true);
  assert.equal(isPresetEdited(edited, 2), false);
  const named = setPresetNames(base, new Map([[0, 'Clean']]));
  assert.equal(isPresetEdited(named, 1), false);
});

test('pedal preset names are stored as the single browser preset name', () => {
  const base = createDefaultState();
  const named = setPresetName(base, 2, 'Lead');
  assert.equal(assignmentsFor(named, 2).name, 'Lead');
  const fetched = setPresetNames(base, new Map([[0, 'Clean'], [4, 'Crunch']]));
  assert.equal(assignmentsFor(fetched, 1).name, 'Clean');
  assert.equal(assignmentsFor(fetched, 5).name, 'Crunch');
});
