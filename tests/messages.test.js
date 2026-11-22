import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCc,
  buildPc,
  pack7bit,
  unpack7bit,
  buildRequestSysEx,
  parseSysEx,
  splitBleMidi,
  reassembleBleMidi,
  FIELD,
  COMMAND,
} from '../src/core/messages.js';

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

test('CC and Program Change use the documented status bytes', () => {
  assert.deepEqual(buildCc(1, 20, 127), [0xb0, 20, 127]);
  assert.deepEqual(buildCc(3, 68, 64), [0xb2, 68, 64]);
  assert.deepEqual(buildPc(1, 8), [0xc0, 8]);
  assert.throws(() => buildCc(0, 20, 0));
  assert.throws(() => buildCc(1, 128, 0));
  assert.throws(() => buildPc(1, 128));
});

test('7-bit packing round-trips bytes with high bits set', () => {
  const body = [0x02, 0xff, 0x80, 0x7f, 0x01, 0x92, 0x00, 0xaa, 0xbb, 0xcc];
  assert.deepEqual(unpack7bit(pack7bit(body)), body);
});

test('an amp-model set-field SysEx matches the captured hardware frame', () => {
  const frame = buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.AMP_MODEL, 0x0f], 0x5b);
  assert.equal(
    hex(frame),
    'f0 7d 4e 43 70 00 02 5b 00 6d 00 02 00 00 06 0f f7',
  );
});

test('a chain-order set-field SysEx matches the captured hardware frame', () => {
  const order = [0, 1, 7, 2, 3, 4, 5, 6];
  const frame = buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.CHAIN_ORDER, 8, ...order], 0x73);
  assert.equal(
    hex(frame),
    'f0 7d 4e 43 70 00 02 73 00 6d 00 0a 00 00 05 08 00 01 07 02 03 00 04 05 06 f7',
  );
});

test('a permanent save uses opcode 0x46 with a zero-based slot', () => {
  const frame = buildRequestSysEx(COMMAND.SAVE_PRESET, [8], 1);
  assert.equal(hex(frame), 'f0 7d 4e 43 70 00 02 01 00 46 00 01 00 00 08 f7');
});


test('set-field 0x01 writes one normalized parameter with a float32', () => {
  const frame = buildRequestSysEx(COMMAND.SET_FIELD, [0x01, 0, 2, 0, 0, 0x80, 0x3f], 3);
  assert.equal(
    hex(frame),
    'f0 7d 4e 43 70 00 02 03 00 6d 00 07 00 20 01 00 02 00 00 00 3f f7',
  );
});

test('device replies carry status and echo sequence and command', () => {
  const reply = [
    0xf0, 0x7d, 0x4e, 0x43, 0x71,
    0x00, 0x02, 0x5b, 0x00, 0x6d, 0x00, 0x00, 0x02, 0x00, 0x00, 0x06, 0x0f,
    0xf7,
  ];
  assert.deepEqual(parseSysEx(reply), {
    direction: 0x71,
    sequence: 0x5b,
    command: 0x6d,
    status: 0,
    payload: [0x06, 0x0f],
  });
});

test('a long SysEx survives BLE-MIDI packet splitting and reassembly', () => {
  const sysex = buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.CHAIN_ORDER, 8, 7, 6, 5, 4, 3, 2, 1, 0], 0x12);
  const packets = splitBleMidi(sysex, 20);
  assert.ok(packets.length > 1);
  assert.ok(packets.every((p) => p.length <= 20));
  assert.deepEqual(reassembleBleMidi(packets), sysex);
});

test('short channel-voice messages are not split by the BLE packetiser', () => {
  assert.deepEqual(splitBleMidi([0xb0, 20, 127], 20), [[0x80, 0x80, 0xb0, 20, 127]]);
});
