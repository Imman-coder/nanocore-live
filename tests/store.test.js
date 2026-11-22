import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultState, loadState, saveState, exportState, importState,
  setActivePreset, updatePreset, upsertStomp, upsertExpression,
  setBlockStomp, setParamPedal, pedalOwner,
  effectiveStompLabel, assignmentsFor,
} from '../src/core/store.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

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
