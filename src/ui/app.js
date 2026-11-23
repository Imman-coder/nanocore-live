// App shell: state, transports, routing glue and view switching.
import { BLOCK_BY_ID, BLOCKS, FX2_SPECIAL_TYPES, SNAPSHOT_BLOCKS } from '../core/spec.js';
import {
  loadState, saveState, createDefaultState, setActivePreset, updatePreset,
  upsertStomp, assignmentsFor, effectiveStompLabel, setScene, setSceneEnabled,
  setBlockStomp, setParamPedal, pedalOwner, setExpressionTrigger, USER_SCENE_KEYS, renameScene, setSceneBlock,
} from '../core/store.js';
import { createRouter, describeTrigger } from '../core/router.js';
import { createMidiScheduler } from '../core/scheduler.js';
import { buildCc, buildRequestSysEx, parseSysEx, ResponseAssembler, COMMAND, FIELD } from '../core/messages.js';
import { parseSnapshot } from '../core/snapshot.js';
import { COMMAND as CAT, parsePresetCatalog, parseStorageInfo, parseSlotInfo, parseGlobalSettings, activeSlotFor } from '../core/catalog.js';
import { resolveFirmware, typesFor } from '../core/versions.js';
import { stompActive, toggleCc, sceneStored, sceneBlockParticipates, expressionBytes } from '../core/live.js';
import { captureBase, baseForPreset, overrideBase } from '../core/base.js';
import { connectionHint } from '../core/capabilities.js';
import { tapBpm, delayMs, normalizedForMs, SUBDIVISIONS } from '../core/tempo.js';
import { buildParameterWrite } from '../core/parameterWrite.js';
import { createWebMidiTransport } from '../transports/webmidi.js';
import { createWebBluetoothTransport } from '../transports/webbluetooth.js';
import { renderEditor } from './editor.js';
import { renderLive, renderLiveSidebar } from './live.js';
import { openGlobals } from './globals.js';
import { openDevices } from './devices.js';
import './ui-events.js';

const $ = (sel) => document.querySelector(sel);
const capabilities = {
  secure: Boolean(window.isSecureContext),
  midi: typeof navigator.requestMIDIAccess === 'function',
  bluetooth: typeof navigator.bluetooth?.requestDevice === 'function',
};
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
const baseByPreset = new Map();
const localEnabled = new Map();
const liveToggles = new Map();
const MIDI_GAP_MS = 25;
// The NANOCORE reorders long SysEx bursts; give each frame a longer settle window.
const SYSEX_GAP_MS = 120;
const names = { presets: new Map(), amp: null, ir: null };
const logLines = [];
let tempoTaps = [];

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

function updateTempoUI() {
  const tempo = state.globals.tempo ?? { bpm: null, signature: '4/4', subdivision: '1/8' };
  const button = $('#tap-tempo');
  const count = $('#bpm-count');
  const signature = $('#time-signature');
  if (button) button.classList.toggle('active', Boolean(tempo.bpm));
  if (count) count.textContent = tempo.bpm ? `${tempo.bpm}` : '—';
  if (signature && signature.value !== tempo.signature) signature.value = tempo.signature;
  const liveTap = document.querySelector('[data-action="tap-tempo"] .stomp-cc');
  if (liveTap) liveTap.textContent = tempo.bpm ? `${tempo.bpm} BPM · tap to retap` : 'tap to set BPM';
}

function syncDelays() {
  const tempo = state.globals.tempo;
  if (!snapshot || !state.globals.tempoSync || !tempo?.bpm) return;
  const ms = delayMs(tempo.bpm, tempo.signature, tempo.subdivision);
  const block = snapshot.blocks.find((b) => b.id === 'del');
  if (!block) return;
  const type = typesFor('del', resolveFirmware(state)).find((t) => t.id === block.variant);
  const offset = BLOCK_BY_ID.del.commonParams?.length ?? 0;
  let changes = 0;
  for (const [index, param] of (type?.params ?? []).entries()) {
    if (param.label !== 'Time' && param.label !== 'Delay') continue;
    ctx.setParameter('del', offset + index, normalizedForMs(ms, param.min, param.max));
    changes++;
  }
  notify(changes ? `Delay synced to ${ms} ms · ${tempo.bpm} BPM` : 'No writable delay time on this effect');
}

function setStatus(text, online = false) {
  const el = $('#status');
  el.textContent = text;
  el.classList.toggle('online', online);
  el.classList.toggle('offline', !online);
}

// One scheduler for every write to the pedal: 25 ms spacing plus coalescing
// of rapid sweeps of the same control to the last value in the window.
const scheduler = createMidiScheduler({
  writer: (bytes) => {
    if (!transport) throw new Error('Connect to the NANOCORE first');
    transport.send(bytes);
    log('→ ' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' '));
  },
  gapMs: MIDI_GAP_MS,
  sysexGapMs: SYSEX_GAP_MS,
  coalesceMs: MIDI_GAP_MS,
});

function send(bytes) {
  return scheduler.send(bytes);
}

function sendRequest(command, payload = [], timeout = 3000) {
  const seq = sequence++ & 0xff;
  const bytes = buildRequestSysEx(command, payload, seq);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(pendingKey(seq, command));
      reject(new Error(`No reply to opcode 0x${command.toString(16)} (last device reply: ${lastReply ?? 'none'})`));
    }, timeout);
    pending.set(pendingKey(seq, command), { resolve, reject, timer });
    Promise.resolve(send(bytes)).catch((error) => {
      clearTimeout(timer);
      pending.delete(pendingKey(seq, command));
      reject(error);
    });
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
  // Base is a stable in-memory copy of the pedal state, captured on the first
  // sync or when the device reports a different preset. Local edits, scene
  // recalls and chain reorder must not overwrite it.
  baseForPreset(baseByPreset, parsed.activePreset + 1, parsed.blocks);
  // A snapshot read right after a stomp can still report the old on/off state.
  // Keep locally confirmed changes authoritative briefly so scenes store what
  // the user actually selected.
  const now = Date.now();
  for (const block of snapshot.blocks) {
    const override = localEnabled.get(block.id);
    if (!override) continue;
    if (now - override.at < 3000) block.enabled = override.on;
    else localEnabled.delete(block.id);
  }
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
  onScene: (scene) => ctx.recallScene(scene),
  onTapTempo: () => ctx.tapTempo(),
  getVariant: (blockId) => snapshot?.blocks.find((b) => b.id === blockId)?.variant ?? 0,
  onEvent: (event) => {
    log(`${event.type}: ${JSON.stringify(event).slice(0, 140)}`);
    if (event.type === 'expression') {
      const meter = document.getElementById(`expr-meter-${event.expression}`);
      if (meter) meter.style.width = `${Math.round((event.value / 127) * 100)}%`;
      const value = document.getElementById(`expr-value-${event.expression}`);
      if (value) value.textContent = `${Math.round((event.value / 127) * 100)}%`;
    }
    if (event.type === 'stomp') {
      ctx.noteEnabled(event.block, event.value === 127);
      setTimeout(render, 0);
    }
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
    // The user-facing amp selector has 30 models; higher slots are drive/fuzz
    // models and are not part of that list.
    if (kind === 'amp') slotCount = Math.min(slotCount, 30);
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
  let lastSlotError = null;
  let failuresLogged = 0;

  async function readSlot(slot) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const reply = await sendRequest(slotCommand, [slot], 1500);
        return parseSlotInfo(reply.payload, slot).name || null;
      } catch (error) {
        lastSlotError = error.message;
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
    if (list[slot].startsWith('Slot ') && failuresLogged < 3) {
      log(`${kind} slot ${slot}: ${lastSlotError ?? 'empty name'}`);
      failuresLogged++;
    }
    render();
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
    baseByPreset.clear();
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
    if (/Web MIDI is not available/.test(error.message)) {
      if (!capabilities.midi && capabilities.bluetooth && $('#transport-kind')) {
        $('#transport-kind').value = 'webbluetooth';
      }
      notify(connectionHint(capabilities));
    } else {
      notify(error.message);
    }
    updateCapabilityHint();
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
  get capabilities() { return { ...capabilities }; },
  get firmware() { return resolveFirmware(state); },
  presetLabel,
  sceneKeys() {
    return ['base', ...USER_SCENE_KEYS.slice(0, Math.max(0, (state.globals.sceneCount ?? 3) - 1))];
  },
  sceneName(key) {
    return key === 'base' ? 'Base' : (currentAssignments().sceneNames?.[key] ?? `Scene ${key.slice(-1)}`);
  },
  renameScene(key, label) {
    update(renameScene(state, state.activePreset, key, label));
  },
  assetNames(kind) { return loadAssetNames(kind); },
  refreshAssetNames,
  stompActive(fsId) {
    const key = `${state.activePreset}:${fsId}`;
    if (liveToggles.has(key)) return liveToggles.get(key);
    const binding = currentAssignments().stomps.find((s) => s.fsId === fsId);
    const blocks = Object.fromEntries((snapshot?.blocks ?? []).map((b) => [b.id, b]));
    return stompActive(binding?.targets, blocks);
  },
  tapTempo() {
    const now = Date.now();
    tempoTaps = [...tempoTaps.filter((t) => now - t <= 4000), now].slice(-5);
    const bpm = tapBpm(tempoTaps, now);
    if (!bpm) {
      notify('Keep tapping to set a tempo');
      updateTempoUI();
      return;
    }
    state = { ...state, globals: { ...state.globals, tempo: { ...state.globals.tempo, bpm } } };
    persist();
    updateTempoUI();
    syncDelays();
  },
  setTempo(patch) {
    state = { ...state, globals: { ...state.globals, tempo: { ...(state.globals.tempo ?? {}), ...patch } } };
    persist();
    updateTempoUI();
    syncDelays();
  },
  syncDelays,
  sendExpression(pedalId, value) {
    if (!state.globals.interactiveLive) return;
    const mapping = currentAssignments().expressions.find((e) => e.id === pedalId);
    if (!mapping) return notify(`${pedalId} has no parameter assigned in this preset`);
    const variant = snapshot?.blocks.find((b) => b.id === mapping.target)?.variant ?? 0;
    const bytes = expressionBytes(mapping, state.globals.midiChannel ?? 1, variant, value);
    send(bytes);
    const meter = document.getElementById(`expr-meter-${pedalId}`);
    const label = document.getElementById(`expr-value-${pedalId}`);
    const percent = Math.round((value / 127) * 100);
    if (meter) meter.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}%`;
  },
  toggleStomp(fsId) {
    if (!snapshot) return notify('Connect and read the preset first');
    const active = ctx.stompActive(fsId);
    const value = toggleCc(active);
    const key = `${state.activePreset}:${fsId}`;
    liveToggles.set(key, value === 127);
    const binding = currentAssignments().stomps.find((s) => s.fsId === fsId);
    const targets = binding?.targets ?? [];
    for (const target of targets) {
      const block = typeof target === 'string' ? target : target.block;
      const cc = BLOCK_BY_ID[block]?.onOffCc;
      if (!cc) continue;
      send(buildCc(state.globals.midiChannel ?? 1, cc, value));
      ctx.noteEnabled(block, value === 127);
    }
    render();
    notify(`${fsId} ${value === 127 ? 'on' : 'off'}${targets.length ? '' : ' — no FX assigned'}`);
  },
  baseOverridden() {
    return Boolean(baseByPreset.get(state.activePreset)?.overridden);
  },
  storeScene(name) {
    if (!snapshot) return notify('Connect and read the preset first');
    if (name === 'base' && !state.globals.baseOverride) {
      return notify('Enable Base override in Globals to store Base values');
    }
    const current = currentAssignments();
    const stored = name === 'base' ? (baseByPreset.get(state.activePreset) ?? {}) : current;
    const values = { ...(stored.values ?? current.scenes?.[name] ?? {}) };
    const enabled = { ...(stored.enabled ?? current.sceneEnabled?.[name] ?? {}) };
    let skipped = 0;
    for (const block of snapshot.blocks) {
      if (!sceneBlockParticipates(current, block.id)) { skipped++; continue; }
      block.params.forEach((value, index) => { values[`${block.id}:${index}`] = value; });
      enabled[block.id] = Boolean(block.enabled);
    }
    if (name === 'base') {
      overrideBase(baseByPreset, state.activePreset, values, enabled);
      update({ activeScene: 'base' });
      return notify('Base stored in memory for this preset');
    }
    let next = setScene(state, state.activePreset, name, values);
    next = setSceneEnabled(next, state.activePreset, name, enabled);
    update(next);
    notify(`${name === 'base' ? 'Base' : `Scene ${name.slice(-1)}`} stored · ${Object.keys(enabled).length} fx states${skipped ? ` · ${skipped} block(s) skipped` : ''}`);
  },
  selectScene(name) {
    if (!sceneStored(currentAssignments(), name)) {
      update({ activeScene: name });
      notify(`${ctx.sceneName(name)} is empty — press Store to save it here`);
      return;
    }
    ctx.recallScene(name);
  },
  recallScene(name) {
    if (!sceneStored(currentAssignments(), name)) {
      notify(`${ctx.sceneName(name)} is empty — store something there first`);
      return;
    }
    update({ activeScene: name });
    const base = baseByPreset.get(state.activePreset) ?? { values: {}, enabled: {} };
    const values = name === 'base' ? base.values : currentAssignments().scenes?.[name];
    if (!values || !Object.keys(values).length) return notify('Nothing stored in that scene yet');
    let changes = 0;
    const onOff = name === 'base' ? base.enabled : currentAssignments().sceneEnabled?.[name];
    const assignments = currentAssignments();
    for (const [block, on] of Object.entries(onOff ?? {})) {
      if (!sceneBlockParticipates(assignments, block)) continue;
      const currentBlock = snapshot?.blocks.find((b) => b.id === block);
      if (!currentBlock || !BLOCK_BY_ID[block]?.onOffCc || currentBlock.enabled === Boolean(on)) continue;
      send(buildCc(state.globals.midiChannel ?? 1, BLOCK_BY_ID[block].onOffCc, on ? 127 : 0));
      ctx.noteEnabled(block, Boolean(on));
      changes++;
    }
    for (const [key, value] of Object.entries(values)) {
      const [block, index] = key.split(':');
      if (!sceneBlockParticipates(assignments, block)) continue;
      const current = snapshot?.blocks.find((b) => b.id === block)?.params[Number(index)];
      if (current === undefined || Math.abs(current - value) < 0.005) continue;
      ctx.setParameter(block, Number(index), value);
      changes++;
    }
    render();
    notify(`${name === 'base' ? 'Base' : `Scene ${name.slice(-1)}`} recalled · ${changes} parameters changed`);
  },
  sceneBlockEnabled(blockId) { return sceneBlockParticipates(currentAssignments(), blockId); },
  setSceneBlock(blockId, participates) {
    update(setSceneBlock(state, state.activePreset, blockId, participates));
    notify(`${BLOCK_BY_ID[blockId]?.name ?? blockId} ${participates ? 'now participates in scenes' : 'excluded from scenes — saved values kept'}`);
  },
  setVolume(value) {
    if (!snapshot) return;
    const volume = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    send(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.VOLUME, volume]));
    snapshot.volume = volume;
    render();
    setTimeout(readSnapshot, 250);
  },
  setChainOrder(order) {
    const indices = order.map((id) => SNAPSHOT_BLOCKS.indexOf(id));
    if (indices.length !== 8 || indices.some((i) => i < 0)) return;
    send(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.CHAIN_ORDER, 8, ...indices]));
    setTimeout(readSnapshot, 300);
  },
  noteEnabled(blockId, on) {
    const block = snapshot?.blocks.find((b) => b.id === blockId);
    if (block) block.enabled = Boolean(on);
    localEnabled.set(blockId, { on: Boolean(on), at: Date.now() });
  },
  noteParameter(blockId, paramIndex, normalized) {
    const block = snapshot?.blocks.find((b) => b.id === blockId);
    if (block && Number.isInteger(paramIndex) && block.params[paramIndex] !== undefined) {
      block.params[paramIndex] = Math.max(0, Math.min(1, normalized));
    }
  },
  setParameter(blockId, paramIndex, normalized) {
    const effectIndex = SNAPSHOT_BLOCKS.indexOf(blockId);
    if (effectIndex === -1) return;
    const value = Math.max(0, Math.min(1, normalized));
    const current = snapshot?.blocks.find((b) => b.id === blockId);
    const types = typesFor(blockId, resolveFirmware(state));
    const type = types.find((t) => (t.variant ?? t.id) === current?.variant);
    const offset = BLOCK_BY_ID[blockId].commonParams?.length ?? 0;
    const param = type?.params[paramIndex - offset];
    const fx2 = snapshot?.blocks.find((b) => b.id === 'fx2');
    const sharedCcConflict = blockId === 'mod' && fx2 && (
      resolveFirmware(state) === '1.3.5' || FX2_SPECIAL_TYPES.includes(fx2.variant)
    );
    const ccBytes = sharedCcConflict ? null
      : buildParameterWrite({ param, normalized: value, channel: Number(state.globals.midiChannel) || 1 });
    if (ccBytes) {
      send(ccBytes);
    } else {
      const view = new DataView(new ArrayBuffer(4));
      view.setFloat32(0, value, true);
      send(buildRequestSysEx(COMMAND.SET_FIELD,
        [FIELD.PARAMETER, effectIndex, paramIndex, ...new Uint8Array(view.buffer)]));
    }
    ctx.noteParameter(blockId, paramIndex, value);
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

function updateCapabilityHint() {
  const el = $('#capability-hint');
  if (el) el.textContent = connectionHint(capabilities);
}
updateCapabilityHint();
updateTempoUI();

function render() {
  updateTempoUI();
  for (const button of document.querySelectorAll('#mode-switch button')) {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  }
  if (state.mode === 'live') {
    $('#sidebar').innerHTML = renderLiveSidebar(ctx);
    $('#content').innerHTML = renderLive(ctx);
    return;
  }
  const presets = Object.keys(state.presets).map(Number).sort((a, b) => a - b)
    .map((number) => `<div class="row-card ${number === state.activePreset ? 'selected' : ''}"
        data-action="recall-preset" data-preset="${number}">
        <div class="row-title"><b>${escapeHtml(ctx.presetLabel(number))}</b><span class="pill">${number}</span></div>
      </div>`).join('');
  $('#sidebar').innerHTML = `<h2>NANOCORE</h2>
    <div class="card preset-volume">
      <div class="muted small">Preset volume</div>
      <input id="preset-volume" type="range" min="0" max="100" value="${snapshot?.volume ?? 60}" aria-label="Preset volume">
      <div class="muted small">${snapshot?.volume ?? '—'} / 100</div>
    </div>
    <div class="field">
      <div class="row-actions">
        <button data-action="step-preset" data-delta="-1" aria-label="Previous preset">◀</button>
        <button data-action="recall-preset" data-preset="${state.activePreset}">Recall preset</button>
        <button data-action="step-preset" data-delta="1" aria-label="Next preset">▶</button>
      </div>
    </div>
    <h3>Presets</h3>
    ${presets || '<p class="muted small">No preset bindings yet.</p>'}
    <p class="muted small">Names come from the pedal. MIDI bindings stay in this browser.</p>`;
  $('#content').innerHTML = renderEditor(ctx);
}

render();
