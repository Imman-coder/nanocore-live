import test from 'node:test';
import assert from 'node:assert/strict';
import { createMidiScheduler, midiKey } from '../src/core/scheduler.js';

function fakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimer(fn, ms) {
      const id = ++nextId;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers.entries()]) {
        if (timer.at > now) continue;
        timers.delete(id);
        timer.fn();
      }
    },
  };
}

function setup(options = {}) {
  const clock = fakeClock();
  const writes = [];
  const scheduler = createMidiScheduler({
    writer: (bytes) => writes.push([...bytes]),
    gapMs: 25,
    coalesceMs: 25,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...options,
  });
  return { scheduler, writes, clock };
}

test('midiKey groups CC messages by channel and number, not value', () => {
  assert.equal(midiKey([0xb0, 20, 10]), midiKey([0xb0, 20, 90]));
  assert.notEqual(midiKey([0xb0, 20, 10]), midiKey([0xb1, 20, 10]));
  assert.notEqual(midiKey([0xb0, 20, 10]), midiKey([0xb0, 21, 10]));
});

test('a rapid CC sweep writes only the last value, once', async () => {
  const { scheduler, writes, clock } = setup();
  for (const value of [10, 20, 40, 80, 120]) scheduler.send([0xb0, 20, value]);
  clock.advance(24);
  assert.equal(writes.length, 0);
  clock.advance(1);
  assert.deepEqual(writes, [[0xb0, 20, 120]]);
});

test('distinct messages are spaced by the cooldown instead of bursting', async () => {
  const { scheduler, writes, clock } = setup();
  scheduler.send([0xb0, 20, 100]);
  scheduler.send([0xb0, 21, 100]);
  scheduler.send([0xb0, 22, 100]);
  clock.advance(25);
  assert.deepEqual(writes, [[0xb0, 20, 100]]);
  clock.advance(0);
  assert.equal(writes.length, 1, 'queued messages must not burst after the first write');
  clock.advance(25);
  assert.deepEqual(writes[1], [0xb0, 21, 100]);
  clock.advance(25);
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[2], [0xb0, 22, 100]);
});

test('coalescing keeps the last value without pushing delivery later', () => {
  const { scheduler, writes, clock } = setup();
  scheduler.send([0xb0, 20, 10]);
  clock.advance(10);
  scheduler.send([0xb0, 20, 50]);
  clock.advance(10);
  scheduler.send([0xb0, 20, 90]);
  clock.advance(5);
  assert.deepEqual(writes, [[0xb0, 20, 90]]);
});

test('SysEx requests keep distinct keys so replies still match', () => {
  const a = [0xf0, 0x7d, 0x4e, 0x43, 0x70, 0x00, 0x01, 0x00, 0x6d, 0x00, 0x01];
  const b = [...a.slice(0, 7), 0x02, ...a.slice(8)];
  assert.notEqual(midiKey(a), midiKey(b));
  const { scheduler, writes, clock } = setup();
  scheduler.send(a);
  scheduler.send(b);
  clock.advance(25);
  assert.equal(writes.length, 1);
  clock.advance(25);
  assert.equal(writes.length, 2);
});

test('SysEx writes get a longer cooldown than CC writes', () => {
  const { scheduler, writes, clock } = setup({ sysexGapMs: 100 });
  scheduler.send([0xf0, 0x01]);
  scheduler.send([0xf0, 0x02]);
  clock.advance(25);
  assert.deepEqual(writes, [[0xf0, 0x01]]);
  clock.advance(99);
  assert.equal(writes.length, 1, 'the second SysEx must wait the longer gap');
  clock.advance(1);
  assert.deepEqual(writes[1], [0xf0, 0x02]);
});

test('a CC queued behind SysEx inherits the longer cooldown', () => {
  const { scheduler, writes, clock } = setup({ sysexGapMs: 100 });
  scheduler.send([0xf0, 0x01]);
  scheduler.send([0xb0, 20, 100]);
  clock.advance(25);
  assert.equal(writes.length, 1);
  clock.advance(99);
  assert.equal(writes.length, 1);
  clock.advance(1);
  assert.deepEqual(writes[1], [0xb0, 20, 100]);
});

test('a long mixed burst keeps strict FIFO order', () => {
  const { scheduler, writes, clock } = setup({ sysexGapMs: 100 });
  const expected = [];
  for (let i = 0; i < 12; i++) {
    const bytes = i % 2 ? [0xb0, 20 + i, 1] : [0xf0, i];
    expected.push(bytes);
    scheduler.send(bytes);
  }
  for (let i = 0; i < 12; i++) clock.advance(125);
  assert.deepEqual(writes, expected);
});

test('a custom key coalesces SyEx frames that differ only by sequence', () => {
  const { scheduler, writes, clock } = setup({ sysexGapMs: 25 });
  const a = [0xf0, 0x01, 0x00];
  const b = [0xf0, 0x02, 0x7f];
  scheduler.send(a, 'sysex-param:mod:0');
  scheduler.send(b, 'sysex-param:mod:0');
  clock.advance(25);
  assert.deepEqual(writes, [b]);
});

test('every queued caller resolves when its message is written', async () => {
  const { scheduler, clock } = setup();
  let resolved = 0;
  scheduler.send([0xb0, 20, 10]).then(() => { resolved++; });
  scheduler.send([0xb0, 20, 20]).then(() => { resolved++; });
  clock.advance(25);
  await Promise.resolve();
  assert.equal(resolved, 2);
});
