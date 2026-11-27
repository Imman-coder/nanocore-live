import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../src/core/store.js';
import { COMMAND, FIELD, buildCc, buildRequestSysEx } from '../src/core/messages.js';
import { buildParameterWriteForTarget } from '../src/engine/writes.js';
import { createDispatcher } from '../src/engine/dispatcher.js';

function context(variant = 0, firmware = '1.2') {
  const state = createDefaultState();
  state.globals.firmware = firmware;
  state.globals.midiChannel = 1;
  const snapshot = { blocks: [{ id: 'fx1', variant, params: [0, 0] }] };
  return { state, snapshot, channel: 1 };
}

function sysexFor(value, effectIndex, paramIndex) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return buildRequestSysEx(COMMAND.SET_FIELD,
    [FIELD.PARAMETER, effectIndex, paramIndex, ...new Uint8Array(view.buffer)]);
}

test('parameter writes use the documented CC when the parameter has one', () => {
  const bytes = buildParameterWriteForTarget({
    target: { kind: 'param', block: 'fx1', index: 0 }, normalized: 0.5, ...context(),
  });
  assert.deepEqual(bytes, buildCc(1, 50, 64));
});

test('dispatcher builds the same SysEx frame for expression writes', () => {
  const { state, snapshot } = context();
  const effects = [];
  const core = createDispatcher({
    getState: () => state,
    setState: () => {},
    getSnapshot: () => snapshot,
    effects: { writeParameter: (effect) => effects.push(effect) },
  });
  core.dispatch({
    type: 'writeParameter',
    target: { kind: 'param', block: 'fx1', index: 1 },
    normalized: 0.5,
    pedalId: 'E1',
    source: 'expression',
  });
  assert.equal(effects.length, 1);
  assert.deepEqual(effects[0].bytes, sysexFor(0.5, 0, 1));
});

test('expression writes use SysEx for a cc-null parameter, not a guessed CC', () => {
  const bytes = buildParameterWriteForTarget({
    target: { kind: 'param', block: 'fx1', index: 1 }, normalized: 0.5, ...context(),
  });
  assert.deepEqual(bytes, sysexFor(0.5, 0, 1));
  assert.notDeepEqual(bytes, buildCc(1, 51, 64));
});
