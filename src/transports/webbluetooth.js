// Direct Web Bluetooth BLE-MIDI transport (no OS pairing step).
import { splitBleMidi } from '../core/messages.js';

export const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
export const BLE_MIDI_CHARACTERISTIC = '7772e5db-3868-4112-a1a9-f2669d106bf3';

export class BleMidiStreamDecoder {
  constructor() {
    this.buffer = [];
  }

  push(packet) {
    const data = [...packet].slice(2); // strip the two timestamp bytes
    if (this.buffer.length === 0 && data[0] !== 0xf0) return [data];
    this.buffer.push(...data);
    const end = this.buffer.indexOf(0xf7);
    if (end === -1) return [];
    const message = this.buffer.slice(0, end + 1);
    this.buffer = [];
    return [message];
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
        for (const bytes of decoder.push(value)) {
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
