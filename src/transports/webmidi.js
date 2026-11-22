// Web MIDI transport: covers both USB MIDI and OS-paired Bluetooth MIDI.
// Every port is exposed so the user can decide which one is the NANOCORE and
// which ones are controllers. Several controllers can be listened to at once.
export function createWebMidiTransport({ navigator: nav = globalThis.navigator, deviceNamePattern = /nanocore/i, sysex = true } = {}) {
  let access = null;
  let output = null;
  let selection = { deviceInputId: null, deviceOutputId: null, enabledInputIds: null };
  const controllerListeners = new Set();
  const deviceListeners = new Set();
  const stateListeners = new Set();

  const isDevicePort = (p) => {
    if (p.type === 'input' && selection.deviceInputId) return p.id === selection.deviceInputId;
    if (p.type === 'output' && selection.deviceOutputId) return p.id === selection.deviceOutputId;
    return deviceNamePattern.test(p.name ?? '');
  };
  const isEnabled = (id) => selection.enabledInputIds === null || selection.enabledInputIds.includes(id);

  function wireInputs() {
    if (!access) return;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
      const message = (event) => ({
        port: input.name ?? input.id,
        portId: input.id,
        bytes: [...event.data],
        timestamp: event.timeStamp ?? Date.now(),
      });
      if (isDevicePort(input)) {
        input.onmidimessage = (event) => {
          const m = message(event);
          for (const cb of deviceListeners) cb(m);
        };
      } else if (isEnabled(input.id)) {
        input.onmidimessage = (event) => {
          const m = message(event);
          for (const cb of controllerListeners) cb(m);
        };
      }
    }
    for (const cb of stateListeners) cb(listPorts());
  }

  function selectOutput() {
    if (!access) return;
    const outputs = [...access.outputs.values()];
    const chosen = outputs.find((o) => o.id === selection.deviceOutputId)
      ?? outputs.find((o) => o.id === output?.id)
      ?? outputs.find((o) => isDevicePort(o))
      ?? outputs[0];
    output = chosen ?? null;
  }

  function listPorts() {
    if (!access) return { inputs: [], outputs: [], outputId: null };
    return {
      inputs: [...access.inputs.values()].map((p) => {
        const role = isDevicePort(p) ? 'device' : isEnabled(p.id) ? 'controller' : 'ignored';
        return { id: p.id, name: p.name, type: p.type, role, enabled: role === 'controller' };
      }),
      outputs: [...access.outputs.values()].map((p) => ({ id: p.id, name: p.name, type: p.type, isDevice: isDevicePort(p) })),
      outputId: output?.id ?? null,
      deviceInputId: [...access.inputs.values()].find(isDevicePort)?.id ?? null,
    };
  }

  return {
    kind: 'webmidi',
    get output() { return output; },
    get access() { return access; },
    get selection() { return { ...selection }; },
    async connect() {
      if (typeof nav?.requestMIDIAccess !== 'function') throw new Error('Web MIDI is not available in this browser');
      access = await nav.requestMIDIAccess({ sysex });
      access.onstatechange = () => { selectOutput(); wireInputs(); };
      selectOutput();
      wireInputs();
      return listPorts();
    },
    disconnect() {
      if (access) access.onstatechange = null;
      for (const input of access?.inputs?.values() ?? []) input.onmidimessage = null;
      access = null;
      output = null;
    },
    send(bytes) {
      if (!output) throw new Error('No NANOCORE MIDI output selected');
      output.send(new Uint8Array(bytes));
    },
    setOutput(id) { this.setSelection({ deviceOutputId: id }); },
    setSelection(partial) {
      selection = { ...selection, ...partial };
      selectOutput();
      wireInputs();
    },
    setInputEnabled(id, enabled) {
      if (selection.enabledInputIds === null) {
        selection.enabledInputIds = [...(access?.inputs.values() ?? [])]
          .filter((p) => !isDevicePort(p))
          .map((p) => p.id);
      }
      const ids = new Set(selection.enabledInputIds);
      if (enabled) ids.add(id); else ids.delete(id);
      selection.enabledInputIds = [...ids];
      wireInputs();
    },
    listPorts,
    onControllerMessage(cb) { controllerListeners.add(cb); return () => controllerListeners.delete(cb); },
    onDeviceMessage(cb) { deviceListeners.add(cb); return () => deviceListeners.delete(cb); },
    onStateChange(cb) { stateListeners.add(cb); return () => stateListeners.delete(cb); },
  };
}
