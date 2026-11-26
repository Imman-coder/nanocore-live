import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultState, setParamPedal, assignmentsFor, setScene, setSceneBlock, setTempoSync,
} from '../src/core/store.js';
import { createRouter } from '../src/core/router.js';
import { delayMs } from '../src/core/tempo.js';

const binding = (pedal) => ({
  pedal,
  inputMin: 0,
  inputMax: 127,
  outputMin: 0,
  outputMax: 127,
  invert: false,
});

test('characterization: expression targets stay distinct across param, tempo and volume', () => {
  let state = createDefaultState();
  state = setParamPedal(state, 1, 'fx1', 0, binding('E1'));
  state = setParamPedal(state, 1, 'del', 'tempo', { ...binding('E2'), tempo: true });
  state = { ...state, globals: { ...state.globals, volumePedal: 'E3' } };

  const expressions = assignmentsFor(state, 1).expressions;
  assert.deepEqual(expressions.map((entry) => ({
    id: entry.id, target: entry.target, tempo: Boolean(entry.tempo), paramIndex: entry.paramIndex,
  })), [
    { id: 'E1', target: 'fx1', tempo: false, paramIndex: 0 },
    { id: 'E2', target: 'del', tempo: true, paramIndex: 0 },
  ]);
});

test('characterization: controller CC emits one binding event and tempo routes send no CC', () => {
  let state = createDefaultState();
  state = setParamPedal(state, 1, 'fx1', 0, binding('E1'));
  state = setParamPedal(state, 1, 'del', 'tempo', { ...binding('E2'), tempo: true });
  const row = assignmentsFor(state, 1);
  const sent = [];
  const events = [];
  const router = createRouter({
    globals: state.globals,
    getActiveRow: () => row,
    send: (bytes) => sent.push(bytes),
    onEvent: (event) => events.push(event),
  });

  router.handleMidi({ port: 'controller', bytes: [0xb0, 7, 100] });
  assert.equal(sent.length, 0, 'the router emits intents; the engine dispatcher sends bytes');
  assert.equal(events.filter((event) => event.type === 'expression').length, 1);

  router.handleMidi({ port: 'controller', bytes: [0xb0, 11, 10] });
  assert.equal(sent.length, 0, 'tempo route must not write a parameter CC');
  const tempoEvent = events.find((event) => event.type === 'expression' && event.tempo);
  assert.equal(tempoEvent.target, 'del');
  assert.equal(tempoEvent.value, 10);
  assert.equal(tempoEvent.raw, 10);
});

test('characterization: excluding a block from a scene forgets only its values', () => {
  let state = createDefaultState();
  state = setScene(state, 1, 'scene1', { 'fx1:0': 0.2, 'del:0': 0.7, 'mod:1': 0.4 });
  state = setSceneBlock(state, 1, 'fx1', false, { forgetValues: true });
  assert.equal(state.presets['1'].sceneBlocks.fx1, false);
  assert.deepEqual(state.presets['1'].scenes.scene1, { 'del:0': 0.7, 'mod:1': 0.4 });
});

test('characterization: tempo sync is per preset and its divisions are computed in one place', () => {
  let state = createDefaultState();
  state = setTempoSync(state, 1, 'del', { enabled: true, subdivision: '1/8d' });
  assert.deepEqual(state.presets['1'].tempoSync.del, { enabled: true, subdivision: '1/8d' });
  assert.deepEqual(state.presets['2']?.tempoSync ?? {}, {});
  assert.equal(delayMs(120, '4/4', '1/8d'), 375);
  assert.equal(delayMs(120, '6/8', '1/4'), 750);
});
