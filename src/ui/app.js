// App shell: state, transports, routing glue and view switching.
import { BLOCK_BY_ID, SNAPSHOT_BLOCKS } from '../core/spec.js';
import {
  loadState, saveState, createDefaultState, setActivePreset, updatePreset,
  upsertStomp, assignmentsFor, effectiveStompLabel,
  setBlockStomp, setParamPedal, pedalOwner, setExpressionTrigger,
} from '../core/store.js';
import { createRouter, describeTrigger } from '../core/router.js';
import { buildRequestSysEx, parseSysEx, ResponseAssembler, COMMAND, FIELD } from '../core/messages.js';
import { parseSnapshot } from '../core/snapshot.js';
import { COMMAND as CAT, parsePresetCatalog, parseStorageInfo, parseSlotInfo, parseGlobalSettings, activeSlotFor } from '../core/catalog.js';
import { resolveFirmware } from '../core/versions.js';
import { createWebMidiTransport } from '../transports/webmidi.js';
import { createWebBluetoothTransport } from '../transports/webbluetooth.js';
import { renderEditor } from './editor.js';
import { renderLive, renderLiveSidebar } from './live.js';
import { openGlobals } from './globals.js';
import { openDevices } from './devices.js';
import './ui-events.js';

const $ = (sel) => document.querySelector(sel);
let state = loadState(window.localStorage);
let snapshot = null;
let transport = null;
let controllerTransport = null;
let sequence = 1;
const pending = new Map();
const pendingKey = (sequence, command) => `${sequence}:${command}`;
const assembler = new ResponseAssembler();
let lastReply = null;
let lastSnapshotPreset = null;
const names = { presets: new Map(), amp: null, ir: null };
const logLines = [];

const currentAssignments = () => assignmentsFor(state, state.activePreset);

function log(message) {
  logLines.push(message);
  if (logLines.length > 200) logLines.shift();
  const el = $('#log');
  el.textContent = logLines.slice(-6).join('  |  ');
  el.title = logLines.join('\n');
}

function notify(message) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

function setStatus(text, online = false) {
  const el = $('#status');
  el.textContent = text;
  el.classList.toggle('online', online);
  el.classList.toggle('offline', !online);
}

function send(bytes) {
  if (!transport) throw new Error('Connect to the NANOCORE first');
  transport.send(bytes);
  log('→ ' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '));
}

function sendRequest(command, payload = [], timeout = 1600) {
  const seq = sequence++ & 0xff;
  const bytes = buildRequestSysEx(command, payload, seq);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(pendingKey(seq, command));
      reject(new Error(`No reply to opcode 0x${command.toString(16)} (last device reply: ${lastReply ?? 'none'})`));
    }, timeout);
    pending.set(pendingKey(seq, command), { resolve, reject, timer });
    try { send(bytes);    } catch (error) { clearTimeout(timer); pending.delete(pendingKey(seq, command)); reject(error); }
  });
}

function settle(sequence, command, frame, error) {
  const key = pendingKey(sequence, command);
  const waiter = pending.get(key);
  if (!waiter) return;
  pending.delete(key);
  clearTimeout(waiter.timer);
  if (error) waiter.reject(error); else waiter.resolve(frame);
}

function syncPresetFromDevice() {
  if (!snapshot) return;
  const visible = snapshot.activePreset + 1;
  if (state.activePreset !== visible) {
    state = setActivePreset(state, visible);
    saveState(window.localStorage, state);
  }
}

function applySnapshot(parsed) {
  const presetChanged = lastSnapshotPreset !== null && lastSnapshotPreset !== parsed.activePreset;
  lastSnapshotPreset = parsed.activePreset;
  snapshot = parsed;
  syncPresetFromDevice();
  for (const block of snapshot.blocks) router.setBlockState(block.id, block.enabled);
  render();
  if (presetChanged) refreshActiveAssets();
}

async function refreshActiveAssets() {
  for (const kind of ['amp', 'ir']) {
    const blockId = kind === 'amp' ? 'amp' : 'cab';
    let active = null;
    try {
      const command = kind === 'amp' ? CAT.AMP_INFO : CAT.IR_INFO;
      active = parseStorageInfo((await sendRequest(command, [], 3000)).payload).activeSlot;
    } catch (error) {
      log(`${kind} active slot: ${error.message}`);
      active = snapshot?.blocks.find((b) => b.id === blockId)?.variant ?? null;
    }
    if (Array.isArray(names[kind]) && Number.isInteger(active) && active >= 0 && active < names[kind].length) {
      names[`${kind}Active`] = active;
    }
  }
  render();
}

function handleDeviceMessage(message) {
  const raw = parseSysEx(message.bytes);
  if (!raw || raw.direction !== 0x71) {
    log(`← ignored: ${[...message.bytes].slice(0, 8).map((b) => b.toString(16)).join(' ')}`);
    return;
  }
  log('← ' + [...message.bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '));
  lastReply = `opcode 0x${raw.command.toString(16)} status 0x${raw.status.toString(16)} seq ${raw.sequence}`;
  let frame;
  try {
    frame = assembler.feed(raw);
  } catch (error) {
    log(`streamed reply: ${error.message}`);
    settle(raw.sequence, raw.command, null, error);
    return;
  }
  if (!frame) return;
  if (frame.status !== 0) {
    log(`device error: opcode 0x${frame.command.toString(16)} status 0x${frame.status.toString(16)}`);
    settle(frame.sequence, frame.command, null, new Error(`Device returned status 0x${frame.status.toString(16)}`));
    return;
  }
  settle(frame.sequence, frame.command, frame);
  if (frame.command === COMMAND.GET_SNAPSHOT) {
    try { applySnapshot(parseSnapshot(frame.payload)); }
    catch (error) { log(`snapshot: ${error.message}`); }
  }
}

const router = createRouter({
  globals: state.globals,
  getActiveRow: currentAssignments,
  send,
  isDevicePort: (port) => /nanocore/i.test(port),
  getVariant: (blockId) => snapshot?.blocks.find((b) => b.id === blockId)?.variant ?? 0,
  onEvent: (event) => {
    log(`${event.type}: ${JSON.stringify(event).slice(0, 140)}`);
    if (event.type === 'expression') {
      const index = currentAssignments().expressions.findIndex((e) => e.id === event.expression);
      const meter = document.getElementById(`expr-meter-${index}`);
      if (meter) meter.style.width = `${Math.round((event.value / 127) * 100)}%`;
    }
    if (event.type === 'stomp') setTimeout(render, 0);
  },
});

const routerGlobals = state.globals;
function persist() {
  // Mutate in place so the router sees the latest globals without being rebuilt.
  Object.assign(routerGlobals, state.globals);
  saveState(window.localStorage, state);
}
function update(patch) {
  state = { ...state, ...patch };
  persist();
  render();
}

async function readSnapshot() {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const reply = await sendRequest(COMMAND.GET_SNAPSHOT, []);
      applySnapshot(parseSnapshot(reply.payload));
      notify(attempt > 1 ? `Snapshot read on attempt ${attempt}` : `Snapshot read: preset ${snapshot.activePreset + 1}`);
      return snapshot;
    } catch (error) {
      lastError = error;
      log(`snapshot attempt ${attempt}: ${error.message}`);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  notify(`Could not read parameters: ${lastError?.message ?? 'unknown error'}`);
  return null;
}

function presetLabel(number) {
  const stored = names.presets.get(Number(number) - 1);
  return stored || assignmentsFor(state, number).name || `Preset ${number}`;
}

async function loadPresetNames() {
  const found = new Map();
  for (let start = 0; start < 128; start += 6) {
    try {
      const reply = await sendRequest(CAT.PRESET_CATALOG, [start, 6]);
      const entries = parsePresetCatalog(reply.payload);
      entries.forEach((entry) => found.set(entry.slot, entry.name));
      if (entries.length < 6) break;
    } catch (error) {
      log(`preset catalog at ${start}: ${error.message}`);
      break;
    }
  }
  names.presets = found;
  render();
}

async function loadAssetNames(kind) {
  if (names[kind]) return names[kind];
  const infoCommand = kind === 'amp' ? CAT.AMP_INFO : CAT.IR_INFO;
  const slotCommand = kind === 'amp' ? CAT.AMP_SLOT_INFO : CAT.IR_SLOT_INFO;
  const blockId = kind === 'amp' ? 'amp' : 'cab';
  let slotCount = kind === 'amp' ? 38 : 30;
  let storageActive = null;
  const snapshotVariant = snapshot?.blocks.find((b) => b.id === blockId)?.variant ?? null;

  try {
    const info = parseStorageInfo((await sendRequest(infoCommand, [], 3000)).payload);
    slotCount = info.slotCount;
    storageActive = info.activeSlot;
  } catch (error) {
    log(`${kind} info: ${error.message} (using defaults)`);
  }

  // Storage info is authoritative; the snapshot variant is only a fallback.
  const activeSlot = activeSlotFor(storageActive, snapshotVariant, slotCount);
  names[`${kind}Active`] = activeSlot;

  // Publish the array immediately so the active slot's real name can appear
  // even if the remaining slot reads are still in flight.
  const list = new Array(slotCount).fill(null);
  names[kind] = list;

  async function readSlot(slot) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const reply = await sendRequest(slotCommand, [slot], 1500);
        return parseSlotInfo(reply.payload, slot).name || null;
      } catch (error) {
        if (attempt === 1 && slot === activeSlot) log(`${kind} slot ${slot}: ${error.message}`);
      }
    }
    return null;
  }

  const first = activeSlot ?? 0;
  list[first] = (await readSlot(first)) ?? `Slot ${first}`;
  render();

  for (let slot = 0; slot < slotCount; slot++) {
    if (slot === first) continue;
    list[slot] = (await readSlot(slot)) ?? `Slot ${slot}`;
  }
  render();
  return list;
}

function refreshAssetNames(kind) {
  names[kind] = null;
  return loadAssetNames(kind);
}

function applyPortSelection() {
  const selection = state.globals.portSelection;
  if (selection && typeof controllerTransport?.setSelection === 'function') {
    controllerTransport.setSelection(selection);
  }
}

async function connect() {
  const kind = $('#transport-kind').value;
  try {
    transport?.disconnect();
    controllerTransport?.disconnect();
    names.presets = new Map();
    names.amp = null;
    names.ir = null;
    if (kind === 'webbluetooth') {
      transport = createWebBluetoothTransport();
      controllerTransport = createWebMidiTransport();
      try { await controllerTransport.connect(); } catch (error) { log(`controllers: ${error.message}`); }
    } else {
      transport = createWebMidiTransport();
      controllerTransport = transport;
    }
    await transport.connect();
    transport.onDeviceMessage(handleDeviceMessage);
    controllerTransport.onControllerMessage((m) => router.handleMidi(m));
    transport.onStateChange(() => render());
    if (controllerTransport !== transport) controllerTransport.onStateChange(() => render());
    applyPortSelection();
    setStatus(`Connected (${transport.kind})`, true);
    log(`connected via ${transport.kind}`);
    render();
    await readSnapshot();
    (async () => {
      try {
        const settings = parseGlobalSettings((await sendRequest(COMMAND.GET_GLOBALS, [])).payload);
        if (state.globals.settingsLayout !== settings.layout) {
          state = { ...state, globals: { ...state.globals, settingsLayout: settings.layout } };
          persist();
        }
        log(`device settings layout ${settings.layout}`);
      } catch (error) { log(`global settings: ${error.message}`); }
      await loadPresetNames();
      await loadAssetNames('amp');
      await loadAssetNames('ir');
    })().catch((error) => log(`names: ${error.message}`));
  } catch (error) {
    setStatus('Connection failed', false);
    notify(error.message);
    log(`connect: ${error.message}`);
  }
}

const ctx = {
  get state() { return state; },
  get snapshot() { return snapshot; },
  get assignments() { return currentAssignments(); },
  get ports() { return controllerTransport?.listPorts() ?? { inputs: [], outputs: [] }; },
  get devicePorts() { return transport?.listPorts() ?? { inputs: [], outputs: [] }; },
  get lastReply() { return lastReply; },
  get names() { return names; },
  get firmware() { return resolveFirmware(state); },
  presetLabel,
  assetNames(kind) { return loadAssetNames(kind); },
  refreshAssetNames,
  setParameter(blockId, paramIndex, normalized) {
    const effectIndex = SNAPSHOT_BLOCKS.indexOf(blockId);
    if (effectIndex === -1) return;
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, Math.max(0, Math.min(1, normalized)), true);
    send(buildRequestSysEx(COMMAND.SET_FIELD,
      [FIELD.PARAMETER, effectIndex, paramIndex, ...new Uint8Array(view.buffer)]));
  },
  setAssetName(kind, slot, name) {
    if (Array.isArray(names[kind]) && names[kind][slot] !== undefined) {
      names[kind][slot] = name;
      names[`${kind}Active`] = slot;
      render();
    }
  },
  get connected() { return Boolean(transport); },
  applyPortSelection,
  setPortSelection(selection) {
    state = { ...state, globals: { ...state.globals, portSelection: selection } };
    persist();
    applyPortSelection();
    render();
  },
  send, sendRequest, readSnapshot, log, notify, render,
  describeTrigger, BLOCK_BY_ID, effectiveStompLabel, router,
  update,
  updatePreset(preset, patch) { update(updatePreset(state, preset, patch)); },
  upsertStomp(preset, fsId, patch) { update(upsertStomp(state, preset, fsId, patch)); },
  setExpressions(preset, expressions) { update(updatePreset(state, preset, { expressions })); },
  selectBlock(blockId) { update({ selectedBlock: blockId }); },
  setBlockStomp(preset, block, fsId) { update(setBlockStomp(state, preset, block, fsId)); },
  setParamPedal(preset, block, paramIndex, config) { update(setParamPedal(state, preset, block, paramIndex, config)); },
  pedalOwner(preset, pedalId) { return pedalOwner(state, preset, pedalId); },
  setExpressionTrigger(pedalId, trigger) { update(setExpressionTrigger(state, pedalId, trigger)); },
  toggleBlock(blockId) {
    const open = new Set(state.expandedBlocks ?? []);
    if (open.has(blockId)) open.delete(blockId); else open.add(blockId);
    update({ expandedBlocks: [...open] });
  },
  setMode(mode) { update({ mode }); },
  recallPreset(preset) {
    state = setActivePreset(state, preset);
    saveState(window.localStorage, state);
    router.recallPreset(preset);
    setTimeout(readSnapshot, 260);
  },
  async savePreset() {
    const preset = state.activePreset;
    const ok = window.confirm(
      `Save the pedal's current live state permanently into NANOCORE preset ${preset}?\n\n` +
      'Take a backup in the upstream editor first if this preset matters. ' +
      'Empty presets can inherit the previous preset\'s amp/IR.',
    );
    if (!ok) return;
    try {
      await sendRequest(COMMAND.SAVE_PRESET, [Math.max(0, preset - 1)]);
      notify('Preset saved on the pedal');
    } catch (error) { notify(error.message); }
  },
};

window.__nanocoreCtx = ctx;
window.__nanocoreConnect = connect;
window.__nanocoreOpenDevices = () => openDevices(ctx);
window.__nanocoreOpenGlobals = () => openGlobals(ctx, render);
window.__nanocoreClearLog = () => { logLines.length = 0; $('#log').textContent = ''; };

function render() {
  for (const button of document.querySelectorAll('#mode-switch button')) {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  }
  if (state.mode === 'live') {
    $('#sidebar').innerHTML = renderLiveSidebar(ctx);
    $('#content').innerHTML = renderLive(ctx);
    return;
  }
  $('#sidebar').innerHTML = `<h2>Editor</h2>
    <p class="muted small">Live RAM edits are immediate. <b>Save to pedal</b> makes them permanent.</p>
    <div class="card"><h3>Chain order</h3>
      <div class="chain">${(snapshot?.chainOrder ?? [0, 1, 2, 3, 4, 5, 6, 7])
        .map((index, position) => `<span class="chip">${position + 1}. ${BLOCK_BY_ID[['fx1', 'fx2', 'amp', 'cab', 'del', 'mod', 'rev', 'eq'][index]]?.name ?? index}</span>`).join('')}</div>
      <p class="muted small">Chain order is read here; reorder on the device or in the upstream editor.</p>
    </div>
    <div class="card"><h3>NANOCORE assignments</h3>
      <p class="muted small">Button names and MIDI targets belong to preset ${state.activePreset} and are edited in the main panel.</p>
    </div>`;
  $('#content').innerHTML = renderEditor(ctx);
}

render();
