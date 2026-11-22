import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePresetCatalog, parseStorageInfo, parseSlotInfo, parseGlobalSettings, activeSlotFor,
  COMMAND,
} from '../src/core/catalog.js';
import { buildRequestSysEx } from '../src/core/messages.js';

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const ascii = (text, length) => [...text.padEnd(length, ' ')].map((c) => c.charCodeAt(0));

test('preset catalog pages decode slot, flags and 8-character names', () => {
  const payload = [0, 2,
    0, 1, ...ascii('TightRhy', 8),
    7, 1, ...ascii('FunkCln', 8),
  ];
  assert.deepEqual(parsePresetCatalog(payload), [
    { slot: 0, flags: 1, name: 'TightRhy', display: 1 },
    { slot: 7, flags: 1, name: 'FunkCln', display: 8 },
  ]);
});

test('preset catalog rejects a page whose length does not match its count', () => {
  assert.throws(() => parsePresetCatalog([0, 1, 1, 1]));
});

test('storage info reports slot count, size limit and active slot', () => {
  const payload = [0, 0, 0, 0, 0, 0, 0, 0, ...u32(38), ...u32(12288), ...u16(12), 0, 0];
  assert.deepEqual(parseStorageInfo(payload), { slotCount: 38, sizeLimit: 12288, activeSlot: 12 });
});

test('storage info maps 0xffff to no active slot', () => {
  const payload = [...new Array(8).fill(0), ...u32(30), ...u32(4096), ...u16(0xffff), 0, 0];
  assert.equal(parseStorageInfo(payload).activeSlot, null);
  assert.throws(() => parseStorageInfo([1, 2, 3]));
});

test('asset slot info decodes name and flags from the 30-byte reply', () => {
  const payload = [12, 1, 1, ...u32(9000), ...u32(123456), ...u16(6682), 0,
    ...ascii('MesR2', 16)];
  assert.deepEqual(parseSlotInfo(payload, 12), {
    slot: 12, present: true, active: true, size: 9000, checksum: 123456,
    formatId: 6682, name: 'MesR2',
  });
});

test('asset slot info rejects a malformed reply', () => {
  assert.throws(() => parseSlotInfo(new Array(29).fill(0)));
  const payload = [12, 2, 1, ...new Array(27).fill(0)];
  assert.throws(() => parseSlotInfo(payload, 12));
});



test('slot info rejects a reply for a different slot and stops the name at 0xff', () => {
  const payload = [12, 1, 1, ...u32(9000), ...u32(123456), ...u16(6682), 0,
    ...ascii('MesR2', 5), 0xff, 0xff, ...new Array(9).fill(0xff)];
  assert.throws(() => parseSlotInfo(payload, 4));
  assert.equal(parseSlotInfo(payload, 12).name, 'MesR2');
});


test('active asset slot prefers storage info over the snapshot variant', () => {
  assert.equal(activeSlotFor(12, 0, 38), 12);
  assert.equal(activeSlotFor(null, 7, 38), 7);
  assert.equal(activeSlotFor(99, 7, 38), 7);
  assert.equal(activeSlotFor(null, null, 38), null);
});

test('global settings reply exposes its layout version in byte 0', () => {
  assert.deepEqual(parseGlobalSettings([1, 1, 0, 1, 100, 100, 0]), {
    layout: 1, bluetooth: true, loopback: false, inputGain: 1,
    usbVolume: 100, bluetoothVolume: 100, midiChannel: 0,
  });
  assert.equal(parseGlobalSettings([2, 0, 0, 0, 100, 100, 0, 10, 90]).layout, 2);
  assert.throws(() => parseGlobalSettings([]));
});

test('catalog requests use opcodes 0x40, 0x30/0x36 and 0x50/0x56', () => {
  assert.equal(buildRequestSysEx(COMMAND.PRESET_CATALOG, [0, 6])[9], 0x40);
  assert.equal(buildRequestSysEx(COMMAND.AMP_INFO, [])[9], 0x30);
  assert.equal(buildRequestSysEx(COMMAND.AMP_SLOT_INFO, [12])[9], 0x36);
  assert.equal(buildRequestSysEx(COMMAND.IR_INFO, [])[9], 0x50);
  assert.equal(buildRequestSysEx(COMMAND.IR_SLOT_INFO, [2])[9], 0x56);
});
