import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDevice, demoRequest } from '../src/core/demoDevice.js';
import { createDemoTransport } from '../src/transports/demo.js';
import { COMMAND, FIELD, buildCc, buildPc, buildRequestSysEx, parseSysEx } from '../src/core/messages.js';
import { parseSnapshot } from '../src/core/snapshot.js';
import { COMMAND as CAT, parsePresetCatalog, parseStorageInfo, parseSlotInfo, parseGlobalSettings } from '../src/core/catalog.js';
import { BLOCK_BY_ID } from '../src/core/spec.js';
import { extraCommonParams, typesFor } from '../src/core/versions.js';

const DEMO_FIRMWARE = '1.2';
const snapshotOf = (device, sequence = 1) => parseSnapshot(demoRequest(device, COMMAND.GET_SNAPSHOT, [], sequence)[0].payload);

test('demo device answers a full snapshot with editor-compatible parameter counts', () => {
  const device = createDemoDevice();
  const snapshot = snapshotOf(device);
  assert.equal(snapshot.blocks.length, 8);
  assert.equal(snapshot.activePreset, 0);
  assert.equal(snapshot.volume, 68);
  assert.deepEqual(snapshot.chainOrder, [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const block of snapshot.blocks) {
    const definition = BLOCK_BY_ID[block.id];
    const type = typesFor(block.id, DEMO_FIRMWARE).find((t) => t.variant === block.variant);
    const expected = definition.commonParams.length + extraCommonParams(block.id, DEMO_FIRMWARE).length
      + (type?.params.length ?? 0);
    assert.equal(block.params.length, expected, `${block.id} param count`);
    assert.ok(block.params.every((value) => value >= 0 && value <= 1));
  }
});

test('demo preset, amp and IR names parse through the real catalog readers', () => {
  const device = createDemoDevice();
  const presets = parsePresetCatalog(demoRequest(device, CAT.PRESET_CATALOG, [0, 6], 7)[0].payload);
  assert.equal(presets.length, 6);
  assert.equal(presets[0].slot, 0);
  assert.match(presets[0].name, /Clean/);

  const ampInfo = parseStorageInfo(demoRequest(device, CAT.AMP_INFO, [], 8)[0].payload);
  const irInfo = parseStorageInfo(demoRequest(device, CAT.IR_INFO, [], 9)[0].payload);
  assert.equal(ampInfo.slotCount, 30);
  assert.equal(irInfo.slotCount, 30);
  assert.equal(ampInfo.activeSlot, 7);
  assert.equal(irInfo.activeSlot, 9);
  assert.match(parseSlotInfo(demoRequest(device, CAT.AMP_SLOT_INFO, [7], 10)[0].payload, 7).name, /MarDSL1/);
  assert.match(parseSlotInfo(demoRequest(device, CAT.IR_SLOT_INFO, [9], 11)[0].payload, 9).name, /Mar96412A/i);

  const globals = parseGlobalSettings(demoRequest(device, COMMAND.GET_GLOBALS, [], 12)[0].payload);
  assert.equal(globals.layout, 2);
  assert.equal(globals.midiChannel, 1);
});

test('CC and SysEx writes change the demo snapshot just like the pedal', () => {
  const device = createDemoDevice();
  assert.equal(snapshotOf(device).blocks.find((b) => b.id === 'fx1').enabled, false);
  device.handle(buildCc(1, 20, 127)); // FX1 on/off
  device.handle(buildCc(1, 60, 127)); // amp Gain, range 0..1
  device.handle(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.RECALL, 4]));
  assert.equal(snapshotOf(device).blocks.find((b) => b.id === 'fx1').enabled, true);
  assert.equal(snapshotOf(device).blocks.find((b) => b.id === 'amp').params[0], 1);
  assert.equal(snapshotOf(device).activePreset, 4);

  device.handle(buildPc(1, 9));
  assert.equal(snapshotOf(device).activePreset, 9);
  device.handle(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.VOLUME, 42]));
  assert.equal(snapshotOf(device).volume, 42);
  device.handle(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.AMP_MODEL, 3]));
  assert.equal(snapshotOf(device).blocks.find((b) => b.id === 'amp').variant, 3);
});

test('demo transport delivers replies and refreshed snapshots on the normal device path', async () => {
  const device = createDemoDevice();
  const transport = createDemoTransport({ device, latencyMs: 0 });
  await transport.connect();
  assert.equal(transport.kind, 'demo');
  assert.equal(transport.connected, true);
  const received = [];
  transport.onDeviceMessage((message) => received.push(parseSysEx(message.bytes)));

  transport.send(buildRequestSysEx(COMMAND.GET_SNAPSHOT, [], 42));
  transport.send(buildCc(1, 20, 127));
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.ok(received.some((frame) => frame.command === COMMAND.GET_SNAPSHOT && frame.sequence === 42 && frame.direction === 0x71));
  assert.ok(received.some((frame) => frame.command === COMMAND.GET_SNAPSHOT && frame.sequence === 0 && frame.direction === 0x71));
  transport.disconnect();
  assert.equal(transport.connected, false);
});
