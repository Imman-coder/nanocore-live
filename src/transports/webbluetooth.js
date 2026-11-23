// Direct Web Bluetooth BLE-MIDI transport (no OS pairing step).
import { splitBleMidi } from '../core/messages.js';

export const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
export const BLE_MIDI_CHARACTERISTIC = '7772e5db-3868-4112-a1a9-f2669d106bf3';

export class BleMidiStreamDecoder {
  constructor() {
    this.sysex = null;
  }

  consume(packet, index, out) {
    while (index < packet.length) {
      const byte = packet[index++];
      this.sysex.push(byte);
      if (byte === 0xf7) {
        out.push(this.sysex);
        this.sysex = null;
        break;
      }
    }
    return index;
  }

  push(packet) {
    const out = [];
    const bytes = [...packet];
    if (bytes.length < 2 || (this.sysex === null && !(bytes[0] & 0x80))) return out;
    let i = 0;
    while (i < bytes.length) {
      const byte = bytes[i];
      if (this.sysex !== null && byte < 0x80) {
        i = this.consume(bytes, i, out);
        continue;
      }
      if (!(byte & 0x80)) { i++; continue; }
      // Some devices send a split-SysEx continuation with only the high header
      // byte followed directly by data. A normal message has two header bytes.
      if (this.sysex !== null && i + 1 < bytes.length && bytes[i + 1] < 0x80) {
        i = this.consume(bytes, i + 1, out);
        continue;
      }
      i += 2; // high + low timestamp
      if (i >= bytes.length) break;
      const first = bytes[i];
      if (this.sysex !== null && first < 0x80) {
        i = this.consume(bytes, i, out);
        continue;
      }
      if (first === 0xf0) {
        this.sysex = [0xf0];
        i = this.consume(bytes, i + 1, out);
        continue;
      }
      if (first >= 0x80 && first <= 0xef) {
        const size = (first & 0xe0) === 0xc0 || (first & 0xe0) === 0xd0 ? 2 : 3;
        const message = bytes.slice(i, i + size);
        if (message.length === size) out.push(message);
        i += size;
        continue;
      }
      if (first & 0x80) { i += 1; continue; }
      i += 1;
    }
    return out;
  }
}

export function createWebBluetoothTransport({ navigator: nav = globalThis.navigator, mtu = 20 } = {}) {
  let device = null;
  let characteristic = null;
  const decoder = new BleMidiStreamDecoder();
  const listeners = new Set();

  return {
    kind: 'webbluetooth',
    async connect() {
      if (typeof nav?.bluetooth?.requestDevice !== 'function') {
        throw new Error('Web Bluetooth is not available in this browser');
      }
      device = await nav.bluetooth.requestDevice({
        filters: [{ services: [BLE_MIDI_SERVICE] }],
        optionalServices: [BLE_MIDI_SERVICE],
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_MIDI_SERVICE);
      characteristic = await service.getCharacteristic(BLE_MIDI_CHARACTERISTIC);
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target?.value;
        if (!value) return;
        // Web Bluetooth exposes a DataView; Node-style Uint8Arrays are iterable but DataView is not.
        const packet = value instanceof Uint8Array
          ? value
          : new Uint8Array(value.buffer ?? value, value.byteOffset ?? 0, value.byteLength ?? undefined);
        for (const bytes of decoder.push(packet)) {
          const message = { port: device?.name ?? 'BLE NANOCORE', bytes, timestamp: Date.now() };
          for (const cb of listeners) cb(message);
        }
      });
      return this.listPorts();
    },
    disconnect() {
      try { device?.gatt?.disconnect(); } catch { /* already gone */ }
      device = null;
      characteristic = null;
    },
    async send(bytes) {
      if (!characteristic) throw new Error('Not connected to the NANOCORE over Bluetooth');
      for (const packet of splitBleMidi(bytes, mtu)) {
        const data = new Uint8Array(packet);
        if (typeof characteristic.writeValueWithoutResponse === 'function') {
          await characteristic.writeValueWithoutResponse(data);
        } else {
          await characteristic.writeValue(data);
        }
      }
    },
    listPorts() {
      return {
        inputs: [],
        outputs: device ? [{ id: 'ble', name: device.name ?? 'NANOCORE', type: 'bluetooth', isDevice: true }] : [],
        outputId: device ? 'ble' : null,
      };
    },
    onDeviceMessage(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    onControllerMessage() { return () => {}; },
    onStateChange() { return () => {}; },
  };
}
