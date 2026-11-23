import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebMidiTransport } from '../src/transports/webmidi.js';

function port(id, name, type) {
  return { id, name, type, onmidimessage: null };
}

function fakeNavigator() {
  const access = {
    inputs: new Map([['i1', port('i1', 'GT-10', 'input')], ['i2', port('i2', 'Nanocore MIDI 1', 'input')]]),
    outputs: new Map([['o1', port('o1', 'Nanocore MIDI 1', 'output')]]),
    onstatechange: null,
  };
  const sent = [];
  access.outputs.get('o1').send = (bytes) => sent.push([...bytes]);
  const nav = {
    requestMIDIAccess: async (opts) => {
      nav.requestOpts = opts;
      return access;
    },
  };
  return { nav, access, sent };
}

test('Web MIDI asks for SysEx permission and selects the NANOCORE output', async () => {
  const { nav, sent } = fakeNavigator();
  const transport = createWebMidiTransport({ navigator: nav });
  await transport.connect();
  assert.deepEqual(nav.requestOpts, { sysex: true });
  assert.equal(transport.output.id, 'o1');
  transport.send([0xb0, 20, 127]);
  assert.deepEqual(sent, [[0xb0, 20, 127]]);
});

test('scan lists ports before connecting and connect reuses that access', async () => {
  const { nav } = fakeNavigator();
  const transport = createWebMidiTransport({ navigator: nav });
  let calls = 0;
  const original = nav.requestMIDIAccess;
  nav.requestMIDIAccess = async (opts) => { calls++; return original(opts); };
  const ports = await transport.scan();
  assert.equal(ports.inputs.length, 2);
  assert.equal(calls, 1);
  assert.equal(transport.connected, false);
  await transport.connect();
  assert.equal(calls, 1, 'connect must not ask for MIDI access a second time');
});

test('controller messages and device replies are separated', async () => {
  const { nav, access } = fakeNavigator();
  const transport = createWebMidiTransport({ navigator: nav });
  const controllers = [];
  const replies = [];
  transport.onControllerMessage((m) => controllers.push(m));
  transport.onDeviceMessage((m) => replies.push(m));
  await transport.connect();
  access.inputs.get('i1').onmidimessage({ data: new Uint8Array([0xb0, 6, 0]), timeStamp: 1 });
  access.inputs.get('i2').onmidimessage({ data: new Uint8Array([0xf0, 0x7d, 0x43, 0xf7]), timeStamp: 2 });
  assert.equal(controllers.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].port, 'Nanocore MIDI 1');
});

test('hot-plugged inputs are wired up on state change', async () => {
  const { nav, access } = fakeNavigator();
  const transport = createWebMidiTransport({ navigator: nav });
  const controllers = [];
  transport.onControllerMessage((m) => controllers.push(m));
  await transport.connect();
  const newPort = port('i3', 'Expression Pedal', 'input');
  access.inputs.set('i3', newPort);
  access.onstatechange();
  newPort.onmidimessage({ data: new Uint8Array([0xb0, 7, 64]), timeStamp: 3 });
  assert.equal(controllers.length, 1);
});


test('the user can override which port is the NANOCORE and which are controllers', async () => {
  const { nav, access } = fakeNavigator();
  const transport = createWebMidiTransport({ navigator: nav });
  const controllers = [];
  const replies = [];
  transport.onControllerMessage((m) => controllers.push(m));
  transport.onDeviceMessage((m) => replies.push(m));
  await transport.connect();
  transport.setSelection({ deviceInputId: 'i1', deviceOutputId: 'o1', enabledInputIds: ['i2'] });
  access.inputs.get('i1').onmidimessage({ data: new Uint8Array([0xf0, 0x7d, 0xf7]), timeStamp: 1 });
  access.inputs.get('i2').onmidimessage({ data: new Uint8Array([0xb0, 6, 0]), timeStamp: 2 });
  assert.equal(replies.length, 1);
  assert.equal(replies[0].port, 'GT-10');
  assert.equal(controllers.length, 1);
  assert.equal(controllers[0].port, 'Nanocore MIDI 1');
  assert.deepEqual(transport.listPorts().inputs.map((p) => p.role), ['device', 'controller']);
});

test('controller inputs can be disabled individually', async () => {
  const { nav, access } = fakeNavigator();
  const transport = createWebMidiTransport({ navigator: nav });
  const controllers = [];
  transport.onControllerMessage((m) => controllers.push(m));
  await transport.connect();
  transport.setInputEnabled('i1', false);
  assert.equal(transport.listPorts().inputs[0].enabled, false);
  assert.equal(access.inputs.get('i1').onmidimessage, null);
});

test('a missing Web MIDI API produces a clear error', async () => {
  const transport = createWebMidiTransport({ navigator: {} });
  await assert.rejects(transport.connect(), /Web MIDI is not available/);
});
