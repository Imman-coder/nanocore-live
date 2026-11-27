import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState, setParamPedal, setTempoSync, assignmentsFor } from '../src/core/store.js';
import { targetFromBinding, targetKey } from '../src/engine/targets.js';
import {
  resolveExpression, initialExpressionRaw, subdivisionForRaw, rawForSubdivision,
} from '../src/engine/resolver.js';
import { createDispatcher } from '../src/engine/dispatcher.js';
import { selectAssignmentKey, selectTempoSync } from '../src/engine/index.js';

const binding = (pedal, extra = {}) => ({
  id: pedal, inputMin: 0, inputMax: 127, outputMin: 0, outputMax: 127, invert: false, ...extra,
});

test('engine targets: legacy keys normalize to explicit target objects', () => {
  assert.deepEqual(targetFromBinding({ target: 'fx1', paramIndex: 0 }), { kind: 'param', block: 'fx1', index: 0 });
  assert.deepEqual(targetFromBinding({ target: 'del', tempo: true }), { kind: 'tempo', block: 'del' });
  assert.deepEqual(targetFromBinding({ id: 'E1', volume: true }), { kind: 'volume' });
  assert.equal(targetKey({ kind: 'param', block: 'fx1', index: 0 }), 'fx1:0');
  assert.equal(targetKey({ kind: 'tempo', block: 'del' }), 'del:tempo');
});

test('engine resolver: one resolver maps param, tempo and volume bindings', () => {
  const param = resolveExpression(binding('E1', { target: 'fx1', paramIndex: 0 }), 64, { channel: 1, variant: 0 });
  assert.equal(param.type, 'writeParameter');
  assert.deepEqual(param.target, { kind: 'param', block: 'fx1', index: 0 });
  assert.ok(param.normalized > 0.49 && param.normalized < 0.51);
  assert.equal(param.bytes, undefined, 'bytes are built by the shared write builder');

  const tempo = resolveExpression(binding('E2', { target: 'del', tempo: true }), 10);
  assert.equal(tempo.type, 'setTempoDivision');
  assert.equal(tempo.block, 'del');
  assert.equal(tempo.subdivision, '1/4');

  const volume = resolveExpression(binding('E3', { volume: true }), 127);
  assert.equal(volume.type, 'setVolume');
  assert.equal(volume.value, 100);
});

test('engine resolver preserves reversed and inverted pedal windows', () => {
  const base = binding('E1', { target: 'fx1', paramIndex: 0 });
  assert.ok(Math.abs(resolveExpression(base, 64).normalized - 0.5) < 0.01);
  assert.equal(resolveExpression({ ...base, inputMin: 127, inputMax: 0 }, 127).normalized, 0);
  assert.equal(resolveExpression({ ...base, invert: true }, 0).normalized, 1);
});

test('engine resolver: initial raw values follow the assigned target', () => {
  let state = createDefaultState();
  state = setParamPedal(state, 1, 'fx1', 0, { ...binding('E1'), pedal: 'E1' });
  state = setParamPedal(state, 1, 'del', 'tempo', { ...binding('E2', { tempo: true }), pedal: 'E2' });
  state = setTempoSync(state, 1, 'del', { enabled: true, subdivision: '1/8d' });
  const assignments = assignmentsFor(state, 1);
  const snapshot = { volume: 50, blocks: [{ id: 'fx1', params: [0.5] }] };
  assert.equal(initialExpressionRaw(assignments.expressions[0], state, snapshot), 64);
  assert.equal(initialExpressionRaw(assignments.expressions[1], state, snapshot), rawForSubdivision('1/8d'));
  assert.equal(initialExpressionRaw({ volume: true }, state, snapshot), 64);
  assert.equal(subdivisionForRaw(0), '1/4');
  assert.equal(subdivisionForRaw(127), '1/16');
});

test('engine selectors derive one view of a target', () => {
  let state = createDefaultState();
  state = setTempoSync(state, 1, 'del', { enabled: true, subdivision: '1/16' });
  assert.deepEqual(selectTempoSync(state, 'del'), { enabled: true, subdivision: '1/16' });
  assert.deepEqual(selectTempoSync(state, 'fx1'), { enabled: false, subdivision: '1/8' });
  assert.equal(selectAssignmentKey({ kind: 'tempo', block: 'del' }), 'del:tempo');
});

test('engine dispatcher: one dispatch applies tempo state and emits device effects', () => {
  let state = createDefaultState();
  const effects = [];
  const core = createDispatcher({
    getState: () => state,
    setState: (next) => { state = next; },
    effects: {
      writeParameter: (effect) => effects.push(effect),
      syncDelays: (effect) => effects.push(effect),
      setVolume: (effect) => effects.push(effect),
    },
  });
  core.dispatch({
    type: 'expression',
    binding: binding('E2', { target: 'del', tempo: true }),
    raw: 10,
  });
  assert.equal(state.presets['1'].tempoSync.del.subdivision, '1/4');
  assert.deepEqual(effects, [{ type: 'syncDelays', block: 'del' }]);

  core.dispatch({
    type: 'expression',
    binding: binding('E1', { target: 'fx1', paramIndex: 0 }),
    raw: 40,
    context: { channel: 1, variant: 0 },
  });
  assert.equal(effects[1].type, 'writeParameter');
  assert.equal(effects[1].target.index, 0);
});

test('engine dispatcher: forgetting a scene block is a reducer operation', () => {
  let state = createDefaultState();
  const effects = [];
  const core = createDispatcher({
    getState: () => state,
    setState: (next) => { state = next; },
    effects: { notify: (effect) => effects.push(effect) },
  });
  core.dispatch({ type: 'storeScene', name: 'scene1', values: { 'fx1:0': 0.4, 'del:0': 0.7 } });
  core.dispatch({ type: 'forgetSceneBlock', block: 'fx1' });
  assert.deepEqual(state.presets['1'].scenes.scene1, { 'del:0': 0.7 });
  assert.equal(effects[0].message.includes('FX1'), true);
});
