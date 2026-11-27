import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceGateway } from '../src/lib/gateway/device.js';
import { DIR_DEVICE_PUSH } from '../src/core/messages.js';
import { readFileSync } from 'node:fs';

test('unsolicited hardware pushes are captured without being treated as replies', () => {
  const pushes = [];
  const logs = [];
  const rt = {
    log: (message) => logs.push(message),
    pending: new Map(),
    assembler: { feed: () => { throw new Error('assembler should not see a push'); } },
    onHardwarePush: (frame) => pushes.push(frame),
  };
  const device = createDeviceGateway(rt);
  const frame = [0xf0, 0x7d, 0x4e, 0x43, DIR_DEVICE_PUSH, 0x00, 0x01, 0xf7];
  device.handleDeviceMessage({ bytes: frame, port: 'NANOCORE (test)' });
  assert.deepEqual(pushes, [frame]);
  assert.equal(logs.some((line) => line.includes('ignored')), false);
});

test('the engine turns hardware pushes into a snapshot refresh', () => {
  const engine = readFileSync(new URL('../src/lib/engine.js', import.meta.url), 'utf8');
  assert.match(engine, /onHardwarePush/);
  assert.match(engine, /hardwareRefreshTimer/);
  assert.match(engine, /readSnapshot\(\)/);
});
