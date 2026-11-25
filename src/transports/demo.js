// Demo transport: same shape as the Web MIDI / Bluetooth transports, but the
// "device" is an in-memory simulator. Replies arrive through the normal
// onDeviceMessage path so request timeouts, assembly and rendering are real.
import { createDemoDevice } from '../core/demoDevice.js';

export function createDemoTransport({ device = createDemoDevice(), latencyMs = 0 } = {}) {
  const deviceListeners = new Set();
  const controllerListeners = new Set();
  const stateListeners = new Set();
  let connected = false;

  const listPorts = () => ({
    inputs: [{ id: 'demo-in', name: 'NANOCORE (demo)', type: 'input', role: 'device', enabled: false }],
    outputs: [{ id: 'demo-out', name: 'NANOCORE (demo)', type: 'output', isDevice: true }],
    outputId: 'demo-out',
    deviceInputId: 'demo-in',
  });

  function emit(frame) {
    if (!connected) return;
    const deliver = () => {
      if (!connected) return;
      const message = { port: 'NANOCORE (demo)', portId: 'demo-in', bytes: frame, timestamp: Date.now() };
      for (const cb of deviceListeners) cb(message);
    };
    // A microtask avoids setTimeout throttling when the tab is not focused;
    // an explicit latency is still available for testing delayed replies.
    if (latencyMs > 0) setTimeout(deliver, latencyMs);
    else queueMicrotask(deliver);
  }

  return {
    kind: 'demo',
    device,
    get connected() { return connected; },
    get output() { return { id: 'demo-out', name: 'NANOCORE (demo)', send: (bytes) => this.send(bytes) }; },
    async scan() { return listPorts(); },
    async connect() {
      connected = true;
      for (const cb of stateListeners) cb(listPorts());
      return listPorts();
    },
    disconnect() {
      connected = false;
      for (const cb of stateListeners) cb(listPorts());
    },
    send(bytes) {
      if (!connected) return;
      const { replies, changed } = device.handle(bytes);
      for (const frame of replies) emit(frame);
      // Writes push an updated snapshot so knobs and stomps show the new state
      // exactly as they do after a real device read.
      if (changed) emit(device.snapshotFrame());
    },
    listPorts,
    onControllerMessage(cb) { controllerListeners.add(cb); return () => controllerListeners.delete(cb); },
    onDeviceMessage(cb) { deviceListeners.add(cb); return () => deviceListeners.delete(cb); },
    onStateChange(cb) { stateListeners.add(cb); return () => stateListeners.delete(cb); },
  };
}
