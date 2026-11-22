import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebBluetoothTransport, BleMidiStreamDecoder } from '../src/transports/webbluetooth.js';
import { buildRequestSysEx, COMMAND, FIELD } from '../src/core/messages.js';

test('BLE-MIDI decoder returns channel messages immediately', () => {
  const decoder = new BleMidiStreamDecoder();
  assert.deepEqual(decoder.push([0x80, 0x80, 0xb0, 20, 127]), [[0xb0, 20, 127]]);
});

test('BLE-MIDI decoder waits for the end of a split SysEx', () => {
  const sysex = buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.CHAIN_ORDER, 8, 7, 6, 5, 4, 3, 2, 1, 0], 0x31);
  const packets = [];
  for (let i = 0; i < sysex.length; i += 18) packets.push([0x80, 0x80, ...sysex.slice(i, i + 18)]);
  const decoder = new BleMidiStreamDecoder();
  assert.deepEqual(decoder.push(packets[0]), []);
  assert.deepEqual(decoder.push(packets[1]), [sysex]);
});

function fakeBluetooth() {
  const written = [];
  const listeners = new Set();
  const characteristic = {
    startNotifications: async () => {},
    addEventListener: (type, cb) => { if (type === 'characteristicvaluechanged') listeners.add(cb); },
    writeValueWithoutResponse: async (v) => written.push([...v]),
    emit: (bytes) => {
      const value = new Uint8Array(bytes);
      for (const cb of listeners) cb({ target: { value } });
    },
  };
  const device = {
    name: 'Nanocore Midi',
    gatt: {
      connect: async () => ({
        getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }),
      }),
    },
  };
  const nav = {
    bluetooth: {
      requestDevice: async (opts) => {
        nav.opts = opts;
        return device;
      },
    },
  };
  return { nav, written, characteristic };
}

test('Web Bluetooth requests the BLE-MIDI service', async () => {
  const { nav } = fakeBluetooth();
  const transport = createWebBluetoothTransport({ navigator: nav });
  await transport.connect();
  assert.deepEqual(nav.opts.filters[0].services, ['03b80e5a-ede8-4b33-a751-6ce34ec4c700']);
});

test('sending a long SysEx writes only <=20 byte BLE packets', async () => {
  const { nav, written } = fakeBluetooth();
  const transport = createWebBluetoothTransport({ navigator: nav });
  await transport.connect();
  const sysex = buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.CHAIN_ORDER, 8, 7, 6, 5, 4, 3, 2, 1, 0], 2);
  await transport.send(sysex);
  assert.ok(written.length > 1);
  assert.ok(written.every((p) => p.length <= 20));
});

test('notifications are delivered through onDeviceMessage', async () => {
  const { nav, characteristic } = fakeBluetooth();
  const transport = createWebBluetoothTransport({ navigator: nav });
  const received = [];
  transport.onDeviceMessage((m) => received.push(m));
  await transport.connect();
  characteristic.emit([0x80, 0x80, 0xb0, 20, 127]);
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].bytes, [0xb0, 20, 127]);
});
