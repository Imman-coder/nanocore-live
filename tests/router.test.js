import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, describeTrigger } from '../src/core/router.js';
import { buildCc } from '../src/core/messages.js';

const globals = {
  midiChannel: 1,
  footswitches: [
    { id: 'FS1', name: 'Stomp 1', trigger: { type: 'cc', channel: 1, number: 5 } },
    { id: 'FS2', name: 'Stomp 2', trigger: { type: 'cc', channel: 1, number: 6 } },
  ],
};

function setup(overrides = {}) {
  const sent = [];
  const events = [];
  const row = overrides.row ?? {
    preset: 9,
    name: 'Song 1',
    stomps: [{
      fsId: 'FS2',
      label: 'Rhythm',
      mode: 'value',
      targets: [{ block: 'fx2' }, { block: 'mod' }],
    }],
    expressions: [],
  };
  const router = createRouter({
    globals: overrides.globals ?? globals,
    getActiveRow: () => row,
    send: (bytes) => sent.push(bytes),
    onEvent: (e) => events.push(e),
    isDevicePort: (port) => port === 'Nanocore MIDI 1',
  });
  return { router, sent, events, row };
}

test('a configured MIDI trigger taps tempo on a nonzero value', () => {
  const tapGlobals = { ...globals, tapTempoSwitch: { id: 'TAP', trigger: { type: 'cc', channel: 1, number: 87 } } };
  let taps = 0;
  const router = createRouter({
    globals: tapGlobals,
    getActiveRow: () => ({ expressions: [] }),
    send: () => {},
    onTapTempo: () => { taps++; },
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 87, 127] });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 87, 0] });
  assert.equal(taps, 1);
});

test('the global volume expression pedal emits volume changes', () => {
  const events = [];
  const router = createRouter({
    globals: {
      ...globals,
      volumePedal: 'E1',
      expressionPedals: [{ id: 'E1', trigger: { type: 'cc', channel: 1, number: 11 } }],
    },
    getActiveRow: () => ({ expressions: [] }),
    send: () => {},
    onEvent: (event) => events.push(event),
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 11, 63] });
  const event = events.find((entry) => entry.type === 'expression');
  assert.equal(event.expression, 'E1');
  assert.equal(event.binding.volume, true);
  assert.equal(event.raw, 63);
});

test('a tempo subdivision expression never writes to the delay parameter', () => {
  const sent = [];
  const events = [];
  const router = createRouter({
    globals,
    getActiveRow: () => ({ expressions: [
      { id: 'E1', trigger: { type: 'cc', channel: 1, number: 7 }, target: 'del', tempo: true, paramIndex: 0 },
    ] }),
    send: (bytes) => sent.push(bytes),
    onEvent: (event) => events.push(event),
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 7, 64] });
  assert.equal(sent.length, 0);
  const event = events.find((entry) => entry.type === 'expression');
  assert.equal(event.tempo, true);
  assert.equal(event.value, 64);
  assert.equal(event.raw, 64);
  assert.equal(event.binding.target, 'del');
});

test('a footswitch value of 0 turns off every block assigned to it', () => {
  const { router, sent } = setup();
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 6, 0] });
  assert.deepEqual(sent, [buildCc(1, 21, 0), buildCc(1, 25, 0)]);
});

test('a footswitch value of 127 turns on every block assigned to it', () => {
  const { router, sent } = setup();
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 6, 127] });
  assert.deepEqual(sent, [buildCc(1, 21, 127), buildCc(1, 25, 127)]);
});

test('messages on unrelated CCs are ignored', () => {
  const { router, sent } = setup();
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 80, 0] });
  assert.equal(sent.length, 0);
});

test('messages coming from the device port are ignored to prevent a feedback loop', () => {
  const { router, sent } = setup();
  router.handleMidi({ port: 'Nanocore MIDI 1', bytes: [0xb0, 6, 0] });
  assert.equal(sent.length, 0);
});

test('a fixed target value overrides the incoming footswitch value', () => {
  const { router, sent } = setup({
    row: {
      preset: 1, name: 'Fixed',
      stomps: [{ fsId: 'FS2', mode: 'value', targets: [{ block: 'fx1', value: 127 }] }],
      expressions: [],
    },
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 6, 0] });
  assert.deepEqual(sent, [buildCc(1, 20, 127)]);
});

test('toggle mode flips each assigned block from its own cached state', () => {
  const { router, sent } = setup({
    row: {
      preset: 1, name: 'Toggle',
      stomps: [{ fsId: 'FS2', mode: 'toggle', targets: [{ block: 'fx1' }, { block: 'fx2' }] }],
      expressions: [],
    },
  });
  router.setBlockState('fx1', true);
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 6, 127] });
  assert.deepEqual(sent, [buildCc(1, 20, 0), buildCc(1, 21, 127)]);
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 6, 0] });
  assert.deepEqual(sent[2], buildCc(1, 20, 127));
  assert.deepEqual(sent[3], buildCc(1, 21, 0));
});

test('an expression pedal hands its raw value to the engine resolver', () => {
  const { router, sent, events } = setup({
    row: {
      preset: 1, name: 'Expr', stomps: [],
      expressions: [{ id: 'E1', trigger: { type: 'cc', channel: 1, number: 7 }, target: 'fx1', paramIndex: 1 }],
    },
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 7, 64] });
  assert.deepEqual(sent, []);
  const event = events.find((entry) => entry.type === 'expression');
  assert.equal(event.raw, 64);
  assert.equal(event.binding.paramIndex, 1);
});

test('an expression can be inverted by the resolver', () => {
  const { router, events } = setup({
    row: {
      preset: 1, name: 'Expr', stomps: [],
      expressions: [{ id: 'E1', trigger: { type: 'cc', channel: 1, number: 7 }, target: 'fx1', paramIndex: 1, invert: true }],
    },
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 7, 0] });
  assert.equal(events.find((entry) => entry.type === 'expression').binding.invert, true);
});

test('an expression input window is preserved for the resolver', () => {
  const { router, events } = setup({
    row: {
      preset: 1, name: 'Expr', stomps: [],
      expressions: [{ id: 'E1', trigger: { type: 'cc', channel: 1, number: 7 }, target: 'fx1', paramIndex: 0, inputMin: 20, inputMax: 100 }],
    },
  });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 7, 20] });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 7, 100] });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 7, 10] });
  assert.deepEqual(events.filter((entry) => entry.type === 'expression').map((e) => e.raw), [20, 100, 10]);
});

test('learn mode captures the next controller message and stops listening', () => {
  const { router } = setup();
  router.armLearn('FS1');
  router.handleMidi({ port: 'GT-10', bytes: [0xb1, 42, 117] });
  assert.deepEqual(router.consumeLearnedTrigger(), { type: 'cc', channel: 2, number: 42 });
  assert.equal(router.learn, null);
});

test('a Note-on trigger can be used for a footswitch', () => {
  const { router, sent } = setup({
    globals: { midiChannel: 1, footswitches: [{ id: 'FS3', trigger: { type: 'note', channel: 1, number: 60 } }] },
    row: {
      preset: 1, name: 'Note', stomps: [{ fsId: 'FS3', mode: 'value', targets: [{ block: 'rev' }] }],
      expressions: [],
    },
  });
  router.handleMidi({ port: 'GT-10', bytes: [0x90, 60, 100] });
  assert.deepEqual(sent, [buildCc(1, 27, 100)]);
});

test('preset recall uses the zero-based slot in field 09 of opcode 0x6d', () => {
  const { router, sent } = setup();
  router.recallPreset(9);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][4], 0x70);
  assert.equal(sent[0][9], 0x6d);
  assert.deepEqual(sent[0].slice(-3, -1), [0x09, 0x08]);
});

test('program-change recall can be selected instead of SysEx', () => {
  const { router, sent } = setup({
    globals: { midiChannel: 1, recallMethod: 'pc', footswitches: [] },
  });
  router.recallPreset(9);
  assert.deepEqual(sent, [[0xb0, 0, 0], [0xb0, 32, 0], [0xc0, 8]]);
});


test('a scene switch recalls its assigned scene', () => {
  const g = { ...globals, sceneSwitches: [
    { id: 'S2', name: 'Scene 1', trigger: { type: 'cc', channel: 1, number: 85 }, scene: 'scene1' },
  ] };
  const recalled = [];
  const router = createRouter({ globals: g, getActiveRow: () => ({ preset: 1, stomps: [], expressions: [] }),
    send: () => {}, onScene: (scene) => recalled.push(scene) });
  router.handleMidi({ port: 'GT-10', bytes: [0xb0, 85, 127] });
  assert.deepEqual(recalled, ['scene1']);
});

test('describeTrigger renders a readable label', () => {
  assert.equal(describeTrigger({ type: 'cc', channel: 1, number: 6 }), 'CC 6');
  assert.equal(describeTrigger({ type: 'pc', channel: 2 }), 'PC (ch 2)');
  assert.equal(describeTrigger({ type: 'note', channel: 1, number: 60 }), 'Note 60');
});
