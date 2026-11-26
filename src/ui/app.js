// App shell: state, transports, routing glue and view switching.
import { BLOCK_BY_ID, BLOCKS, FX2_SPECIAL_TYPES, SNAPSHOT_BLOCKS } from '../core/spec.js';
import {
  loadState, saveState, createDefaultState, setActivePreset, updatePreset,
  upsertStomp, assignmentsFor, effectiveStompLabel, setScene, setSceneEnabled,
  setBlockStomp, setParamPedal, pedalOwner, setExpressionTrigger, USER_SCENE_KEYS, renameScene, setSceneBlock, setBase, setTempoSync, setLiveLayout, setLiveGrid, setPresetNames, isPresetEdited, markPresetEdited,
} from '../core/store.js';
import { createRouter, describeTrigger } from '../core/router.js';
import { createMidiScheduler } from '../core/scheduler.js';
import { buildCc, buildRequestSysEx, parseSysEx, ResponseAssembler, COMMAND, FIELD, cleanPresetName } from '../core/messages.js';
import { parseSnapshot } from '../core/snapshot.js';
import { COMMAND as CAT, parsePresetCatalog, parseStorageInfo, parseSlotInfo, parseGlobalSettings, activeSlotFor } from '../core/catalog.js';
import { resolveFirmware, typesFor } from '../core/versions.js';
import { stompActive, toggleCc, sceneStored, sceneBlockParticipates, expressionBytes, expressionRawForNormalized } from '../core/live.js';
import { captureBase } from '../core/base.js';
import { connectionHint } from '../core/capabilities.js';
import { tapBpm, delayMs, normalizedForMs, SUBDIVISIONS } from '../core/tempo.js';
import { buildParameterWrite } from '../core/parameterWrite.js';
import { sandboxState, uiStateOf, withUiState, createMemoryStorage } from '../core/demoData.js';
import { renderStart } from './start.js';
import { refreshLiveOrientation, fitLiveBoard } from './live.js';
import { renderSettings, openSettingsTab } from './settings.js';
import { createWebMidiTransport } from '../transports/webmidi.js';
import { createWebBluetoothTransport } from '../transports/webbluetooth.js';
import { createDemoTransport } from '../transports/demo.js';
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
const mainStorage = window.localStorage;
const demoStorage = createMemoryStorage();
let state = loadState(mainStorage);
// Every page open begins with setup; Editor/Live are chosen after that.
state.mode = 'start';
let demoState = null;
let demoUseRealData = false;
let demoRequested = false;
let snapshot = null;
let transport = null;
let controllerTransport = null;
let sequence = 1;
const pending = new Map();
const pendingKey = (sequence, command) => `${sequence}:${command}`;
const assembler = new ResponseAssembler();
let lastReply = null;
let lastSnapshotPreset = null;
const localEnabled = new Map();
const liveToggles = new Map();
const MIDI_GAP_MS = 0; // CCs are sent immediately; the pedal handles them best that way.
// SysEx frames are longer, so keep a short settle window rather than a long queue.
const SYSEX_GAP_MS = 25;
const names = { amp: null, ir: null };
const logLines = [];
const catalogState = { busy: false, message: '', presets: 0, amp: 0, ir: 0 };
let transportBeforeDemo = null;
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
  if (!snapshot || !state.globals.tempoSync || !tempo?.bpm) return 0;
  const sync = assignmentsFor(state, state.activePreset).tempoSync ?? {};
  let changes = 0;
  for (const block of snapshot.blocks) {
    const config = sync[block.id];
    if (!config?.enabled) continue;
    const ms = delayMs(tempo.bpm, tempo.signature, config.subdivision ?? '1/8');
    const type = typesFor(block.id, resolveFirmware(state)).find((t) => (t.variant ?? t.id) === block.variant);
    const offset = BLOCK_BY_ID[block.id]?.commonParams?.length ?? 0;
    for (const [index, param] of (type?.params ?? []).entries()) {
      if (param.label !== 'Time' && param.label !== 'Delay') continue;
      ctx.setParameter(block.id, offset + index, normalizedForMs(ms, param.min, param.max));
      changes++;
    }
  }
  if (changes) notify(`${changes} delay time(s) synced · ${tempo.bpm} BPM · ${tempo.signature}`);
  return changes;
}

function setStatus(text, online = false) {
  document.body.classList.toggle('connected', online);
  for (const el of [$('#status'), $('#top-status')]) {
    if (!el) continue;
    el.textContent = text;
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
  }
}

function isDemo() { return transport?.kind === 'demo'; }

// Sandboxed demo data lives in memory; only the explicit opt-in writes to the
// browser's real storage. Every save in the app funnels through here.
function workingStorage() { return isDemo() && !demoUseRealData ? demoStorage : mainStorage; }
function saveWorkingState() { saveState(workingStorage(), state); }

function enterDemoData() {
  demoState = sandboxState(state);
  state = demoState;
  demoUseRealData = false;
  demoRequested = false;
  Object.assign(routerGlobals, state.globals);
}

function adoptMainState() {
  const ui = uiStateOf(state);
  const real = loadState(mainStorage);
  // If the opt-in wrote a demo transport choice, undo it on the way out.
  if (real.globals?.transportKind === 'demo' && transportBeforeDemo) {
    real.globals.transportKind = transportBeforeDemo;
    saveState(mainStorage, real);
  }
  state = withUiState(real, ui);
  Object.assign(routerGlobals, state.globals);
  demoState = null;
  demoUseRealData = false;
  demoRequested = false;
  transportBeforeDemo = null;
}

function setDemoUseRealData(enabled) {
  if (!isDemo() || Boolean(enabled) === demoUseRealData) return;
  const ui = uiStateOf(state);
  const real = loadState(mainStorage);
  state = withUiState(real, ui);
  demoUseRealData = Boolean(enabled);
  persist();
  notify(demoUseRealData
    ? 'Demo now uses your saved data — edits will persist in this browser'
    : 'Demo is sandboxed again — saved settings are untouched');
  render();
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

function send(bytes, key) {
  // The simulator does not need hardware pacing: skipping the output queue
  // keeps catalog reads instant even when the browser throttles background tabs.
  if (isDemo()) {
    try {
      if (!transport) throw new Error('Demo pedal is not running');
      transport.send(bytes);
      return Promise.resolve(1);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return scheduler.send(bytes, key);
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
    saveWorkingState();
  }
}

function applySnapshot(parsed) {
  const presetChanged = lastSnapshotPreset !== null && lastSnapshotPreset !== parsed.activePreset;
  lastSnapshotPreset = parsed.activePreset;
  snapshot = parsed;
  // Base is saved in browser storage like the other scenes. On the first sync
  // of a preset, capture the pedal values as its initial Base.
  const basePreset = parsed.activePreset + 1;
  if (!Object.keys(assignmentsFor(state, basePreset).base?.values ?? {}).length) {
    const captured = captureBase(parsed.blocks);
    state = setBase(state, basePreset, captured.values, captured.enabled);
    persist();
  }
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

function paintExpressionFeedback(pedalId, value) {
  const meter = document.querySelector(`[data-expression-meter="${pedalId}"]`);
  const label = document.getElementById(`expr-value-${pedalId}`);
  const percent = Math.round((value / 127) * 100);
  const vertical = meter?.dataset.orientation === 'vertical';
  const axis = vertical ? 'height' : 'width';
  const fill = document.getElementById(`expr-meter-${pedalId}`);
  if (fill) {
    fill.style.width = vertical ? '100%' : `${percent}%`;
    fill.style.height = vertical ? `${percent}%` : '';
    fill.style[axis] = `${percent}%`;
  }
  if (label) label.textContent = `${percent}%`;
  if (meter) meter.setAttribute('aria-valuenow', String(Math.round(value)));
}

function applyVolumeFromExpression(raw) {
  const volume = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
  if (snapshot) snapshot.volume = volume;
  const slider = $('#preset-volume');
  if (slider) slider.value = String(volume);
  const readout = slider?.closest('.preset-volume')?.querySelectorAll('.muted.small')[1];
  if (readout) readout.textContent = `${volume} / 100`;
  send(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.VOLUME, volume]), `expression-volume:${state.globals.volumePedal ?? 'none'}`);
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
      paintExpressionFeedback(event.expression, event.value);
    }
    if (event.type === 'expression-volume') {
      paintExpressionFeedback(event.expression, Math.round((event.volume / 100) * 127));
      applyVolumeFromExpression(event.volume);
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
  saveWorkingState();
}
function update(patch) {
  state = { ...state, ...patch };
  persist();
  render();
}

function markEditedNoRender(preset = state.activePreset) {
  const next = markPresetEdited(state, preset);
  if (next === state) return;
  state = next;
  saveWorkingState();
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
  return assignmentsFor(state, number).name || `Preset ${number}`;
}

async function loadPresetNames() {
  const found = new Map();
  for (let start = 0; start < 64; start += 6) {
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
  state = setPresetNames(state, found);
  saveWorkingState();
  catalogState.presets = found.size;
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
  catalogState[kind] = list.filter(Boolean).length;
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

function finishSetup() {
  if (state.mode !== 'start' || !transport) return;
  update({ mode: 'editor' });
  notify('Setup complete — Editor is ready');
}

function autoFetchCatalog() {
  catalogState.busy = true;
  catalogState.message = 'Fetching names from the pedal…';
  render();
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
    catalogState.message = `Fetched ${catalogState.presets} presets, ${catalogState.amp} amps, ${catalogState.ir} IRs`;
    finishSetup();
  })().catch((error) => {
    catalogState.message = `Fetch failed: ${error.message}`;
    log(`names: ${error.message}`);
  }).finally(() => {
    catalogState.busy = false;
    render();
  });
}

function setTransportKind(kind) {
  if (!['webmidi', 'webbluetooth', 'demo'].includes(kind)) return;
  for (const id of ['#transport-kind', '#start-transport']) {
    const select = $(id);
    if (select) select.value = kind;
  }
  // Selecting demo but not connecting yet must not touch saved data.
  if (kind === 'demo' && !isDemo()) {
    if (!transportBeforeDemo) {
      transportBeforeDemo = state.globals.transportKind && state.globals.transportKind !== 'demo'
        ? state.globals.transportKind : 'webmidi';
    }
    demoRequested = true;
    updateCapabilityHint();
    notify('Demo mode selected — press Connect or Try demo mode');
    render();
    return;
  }
  if (kind !== 'demo' && !isDemo()) {
    demoRequested = false;
    transportBeforeDemo = null;
  }
  update({ globals: { ...state.globals, transportKind: kind } });
  updateCapabilityHint();
  if (kind !== 'demo') notify(`Transport set to ${kind === 'webbluetooth' ? 'direct Bluetooth' : 'Web MIDI'}`);
}

function disconnect() {
  const wasDemo = isDemo();
  transport?.disconnect();
  controllerTransport?.disconnect();
  transport = null;
  controllerTransport = null;
  // Leaving demo always returns to the browser's saved data. With the opt-in
  // off, none of the sandbox edits ever reached it.
  if (wasDemo) adoptMainState();
  setStatus('Disconnected', false);
  names.amp = null;
  names.ir = null;
  names.ampActive = null;
  names.irActive = null;
  catalogState.presets = 0;
  catalogState.amp = 0;
  catalogState.ir = 0;
  catalogState.message = wasDemo
    ? 'Demo mode closed — no pedal was written to.'
    : 'Disconnected — nothing fetched in this session.';
  render();
  notify(wasDemo ? 'Demo mode closed' : 'Disconnected from the NANOCORE');
}

function exitDemo() {
  if (!isDemo()) return;
  disconnect();
  update({ mode: 'start' });
  notify('Back at Start — connect a pedal whenever you are ready');
}

async function refreshCatalog(which = 'all') {
  if (catalogState.busy) return notify('A name fetch is already running');
  if (!transport) throw new Error('Connect to the NANOCORE first');
  catalogState.busy = true;
  catalogState.message = `Fetching ${which === 'all' ? 'all names' : which}…`;
  render();
  try {
    if (which === 'all' || which === 'presets') await loadPresetNames();
    if (which === 'all' || which === 'amp') await refreshAssetNames('amp');
    if (which === 'all' || which === 'ir') await refreshAssetNames('ir');
    catalogState.message = `Fetched ${catalogState.presets} presets, ${catalogState.amp} amps, ${catalogState.ir} IRs`;
    notify(catalogState.message);
    finishSetup();
  } catch (error) {
    catalogState.message = `Fetch failed: ${error.message}`;
    notify(catalogState.message);
  } finally {
    catalogState.busy = false;
    render();
  }
}

async function scanPorts() {
  if ((state.globals.transportKind ?? 'webmidi') === 'webbluetooth') {
    notify('Direct Bluetooth ports appear only after connecting');
    return;
  }
  if (controllerTransport?.kind !== 'webmidi') controllerTransport = createWebMidiTransport();
  await controllerTransport.scan();
  applyPortSelection();
  render();
  notify('MIDI devices listed — choose ports, then Connect');
}

async function connect(forcedKind) {
  const kind = forcedKind ?? (demoRequested ? 'demo' : state.globals.transportKind ?? $('#transport-kind')?.value ?? 'webmidi');
  if (isDemo() && kind !== 'demo') adoptMainState();
  if (kind === 'demo' && !isDemo()) {
    if (!transportBeforeDemo) {
      transportBeforeDemo = state.globals.transportKind && state.globals.transportKind !== 'demo'
        ? state.globals.transportKind : 'webmidi';
    }
    // Copy the saved data first: sandbox edits must never reach mainStorage.
    enterDemoData();
  } else if (kind !== 'demo') {
    transportBeforeDemo = null;
  }
  const reuseScannedWebMidi = kind === 'webmidi' && controllerTransport?.kind === 'webmidi' && !controllerTransport.connected;
  try {
    transport?.disconnect();
    if (!reuseScannedWebMidi) controllerTransport?.disconnect();
    names.amp = null;
    names.ir = null;
    names.ampActive = null;
    names.irActive = null;
    if (kind === 'demo') {
      transport = createDemoTransport();
      controllerTransport = transport;
    } else if (kind === 'webbluetooth') {
      transport = createWebBluetoothTransport();
      controllerTransport = createWebMidiTransport();
      try { await controllerTransport.connect(); } catch (error) { log(`controllers: ${error.message}`); }
    } else {
      transport = controllerTransport?.kind === 'webmidi' ? controllerTransport : createWebMidiTransport();
      controllerTransport = transport;
    }
    await transport.connect();
    transport.onDeviceMessage(handleDeviceMessage);
    controllerTransport.onControllerMessage((m) => router.handleMidi(m));
    transport.onStateChange(() => render());
    if (controllerTransport !== transport) controllerTransport.onStateChange(() => render());
    applyPortSelection();
    setStatus(kind === 'demo' ? 'Demo mode (no pedal)' : `Connected (${transport.kind})`, true);
    setTransportKind(kind);
    log(kind === 'demo' ? 'demo pedal started (no hardware involved)' : `connected via ${transport.kind}`);
    if (kind === 'demo') notify('Demo mode — a simulated NANOCORE is ready');
    render();
    await readSnapshot();
    autoFetchCatalog();
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
    update(markPresetEdited(renameScene(state, state.activePreset, key, label), state.activePreset));
  },
  assetNames(kind) { return loadAssetNames(kind); },
  refreshAssetNames,
  catalogStatus() {
    return {
      ...catalogState,
      presets: catalogState.presets || Object.keys(state.presets ?? {}).filter((key) => state.presets[key]?.name).length || 0,
      amp: catalogState.amp || names.amp?.filter(Boolean).length || 0,
      ir: catalogState.ir || names.ir?.filter(Boolean).length || 0,
    };
  },
  connectionHint() { return connectionHint(capabilities); },
  statusText() { return $('#status')?.textContent ?? ''; },
  connect,
  scanPorts,
  setTransportKind,
  disconnect,
  refreshCatalog,
  setGlobalSetting(key, value) {
    const numeric = ['midiChannel'];
    update({ globals: { ...state.globals, [key]: numeric.includes(key) ? Number(value) : value } });
    notify(`${key} updated`);
  },
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
  // Live faders open at the current device value of whatever they control.
  // The inverse of normalizedExpression keeps custom pedal/parameter windows
  // and inversion consistent with the MIDI that movement actually sends.
  expressionInitialValue(pedalId) {
    if (state.globals.volumePedal === pedalId) {
      return Math.round(Math.max(0, Math.min(100, snapshot?.volume ?? 0)) / 100 * 127);
    }
    const mapping = currentAssignments().expressions.find((entry) => entry.id === pedalId);
    if (!mapping) return 0;
    const value = snapshot?.blocks.find((block) => block.id === mapping.target)?.params[mapping.paramIndex];
    return Number.isFinite(value) ? expressionRawForNormalized(mapping, value) : 0;
  },
  sendExpression(pedalId, value) {
    if (state.globals.volumePedal === pedalId) {
      paintExpressionFeedback(pedalId, value);
      applyVolumeFromExpression(Math.round((value / 127) * 100));
      return;
    }
    const mapping = currentAssignments().expressions.find((e) => e.id === pedalId);
    if (!mapping) return notify(`${pedalId} has no parameter assigned in this preset`);
    const variant = snapshot?.blocks.find((b) => b.id === mapping.target)?.variant ?? 0;
    const bytes = expressionBytes(mapping, state.globals.midiChannel ?? 1, variant, value);
    send(bytes, `expression:${pedalId}`);
    paintExpressionFeedback(pedalId, value);
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
    return Boolean(Object.keys(currentAssignments().base?.values ?? {}).length);
  },
  storeScene(name) {
    if (!snapshot) return notify('Connect and read the preset first');
    const current = currentAssignments();
    const stored = name === 'base' ? (current.base ?? {}) : current;
    const values = { ...(stored.values ?? current.scenes?.[name] ?? {}) };
    const enabled = { ...(stored.enabled ?? current.sceneEnabled?.[name] ?? {}) };
    let skipped = 0;
    for (const block of snapshot.blocks) {
      if (!sceneBlockParticipates(current, block.id)) { skipped++; continue; }
      block.params.forEach((value, index) => { values[`${block.id}:${index}`] = value; });
      enabled[block.id] = Boolean(block.enabled);
    }
    if (name === 'base') {
      update({ ...markPresetEdited(setBase(state, state.activePreset, values, enabled), state.activePreset), activeScene: 'base' });
      return notify(`Base stored in this browser · ${Object.keys(enabled).length} fx states`);
    }
    let next = markPresetEdited(setScene(state, state.activePreset, name, values), state.activePreset);
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
    const assignments = currentAssignments();
    const base = assignments.base ?? { values: {}, enabled: {} };
    const values = name === 'base' ? base.values : assignments.scenes?.[name];
    if (!values || !Object.keys(values).length) return notify('Nothing stored in that scene yet');
    let changes = 0;
    const onOff = name === 'base' ? base.enabled : assignments.sceneEnabled?.[name];
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
  tempoSyncFor(blockId) {
    return currentAssignments().tempoSync?.[blockId] ?? { enabled: false, subdivision: '1/8' };
  },
  tempoSubdivisionMs(blockId) {
    const config = ctx.tempoSyncFor(blockId);
    const tempo = state.globals.tempo ?? { bpm: 120, signature: '4/4' };
    return delayMs(tempo.bpm ?? 120, tempo.signature ?? '4/4', config.subdivision ?? '1/8');
  },
  setTempoSync(blockId, patch) {
    update(markPresetEdited(setTempoSync(state, state.activePreset, blockId, patch), state.activePreset));
    syncDelays();
  },
  setLiveLayout(layout) { update(setLiveLayout(state, layout)); },
  setLiveLayoutOption(key, value) {
    const layout = state.globals.liveLayout;
    update(setLiveLayout(state, { ...layout, [key]: value }));
  },
  setLiveGrid(patch) { update(setLiveGrid(state, patch)); },
  liveGridItem(id) { return state.globals.liveLayout?.grid?.items?.find((item) => item.id === id); },
  setLiveGridItem(id, patch) {
    const grid = state.globals.liveLayout.grid;
    if (patch.kind === 'empty') {
      update(setLiveGrid(state, { items: (grid.items ?? []).filter((item) => item.id !== id) }));
      return;
    }
    const items = (grid.items ?? []).map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      next.col = Math.max(1, Math.min(grid.columns, Number(next.col) || 1));
      next.row = Math.max(1, Math.min(grid.rows, Number(next.row) || 1));
      next.colSpan = Math.max(1, Math.min(grid.columns - next.col + 1, Number(next.colSpan) || 1));
      next.rowSpan = Math.max(1, Math.min(grid.rows - next.row + 1, Number(next.rowSpan) || 1));
      return next;
    });
    update(setLiveGrid(state, { items }));
  },
  moveLiveGridItem(id, row, col) {
    const grid = state.globals.liveLayout.grid;
    const item = (grid.items ?? []).find((entry) => entry.id === id);
    if (!item) return;
    const targetRow = Math.max(1, Math.min(grid.rows, Number(row) || 1));
    const targetCol = Math.max(1, Math.min(grid.columns, Number(col) || 1));
    const oldRow = item.row;
    const oldCol = item.col;
    const covers = (entry, r, c) => {
      const er = Number(entry.row) || 1;
      const ec = Number(entry.col) || 1;
      return r >= er && r < er + (Number(entry.rowSpan) || 1)
        && c >= ec && c < ec + (Number(entry.colSpan) || 1);
    };
    const occupying = (grid.items ?? []).find((entry) => entry.id !== id && covers(entry, targetRow, targetCol));
    const items = (grid.items ?? []).map((entry) => {
      if (entry.id === id) {
        const colSpan = Math.min(Number(entry.colSpan) || 1, grid.columns - targetCol + 1);
        const rowSpan = Math.min(Number(entry.rowSpan) || 1, grid.rows - targetRow + 1);
        return { ...entry, row: targetRow, col: targetCol, colSpan, rowSpan };
      }
      if (occupying && entry.id === occupying.id) {
        return { ...entry, row: oldRow, col: oldCol };
      }
      return entry;
    });
    update(setLiveGrid(state, { items }));
    notify(`Moved ${item.kind} tile to row ${targetRow}, column ${targetCol}`);
  },
  setLiveGridCell(cell, value) {
    const [row, col] = cell.split(':').map(Number);
    const grid = state.globals.liveLayout.grid;
    const covers = (item) => {
      const r = Number(item.row) || 1;
      const c = Number(item.col) || 1;
      return row >= r && row < r + (Number(item.rowSpan) || 1)
        && col >= c && col < c + (Number(item.colSpan) || 1);
    };
    const items = (grid.items ?? []).filter((item) => !covers(item));
    if (value !== 'empty') {
      const [kind, ref] = value.includes(':') ? value.split(':') : [value, undefined];
      items.push({
        id: `cell-${Date.now().toString(36)}`, kind, ...(ref !== undefined ? { ref } : {}),
        col, row, colSpan: 1, rowSpan: 1,
      });
    }
    update(setLiveGrid(state, { items }));
  },
  toggleLiveEdit() { update({ liveEditing: !state.liveEditing }); },
  startLiveEdit() { update({ mode: 'live', liveEditing: true }); },
  openLiveLayout() { ctx.startLiveEdit(); },
  setSceneBlock(blockId, participates) {
    update(markPresetEdited(setSceneBlock(state, state.activePreset, blockId, participates), state.activePreset));
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
        [FIELD.PARAMETER, effectIndex, paramIndex, ...new Uint8Array(view.buffer)]),
      `sysex-param:${blockId}:${paramIndex}`);
    }
    ctx.noteParameter(blockId, paramIndex, value);
    markEditedNoRender(state.activePreset);
  },
  setAssetName(kind, slot, name) {
    if (Array.isArray(names[kind]) && names[kind][slot] !== undefined) {
      names[kind][slot] = name;
      names[`${kind}Active`] = slot;
      render();
    }
  },
  get connected() { return Boolean(transport); },
  get demo() { return isDemo(); },
  get demoUseRealData() { return demoUseRealData; },
  get transportKind() {
    return isDemo() || demoRequested ? 'demo' : (state.globals.transportKind ?? 'webmidi');
  },
  setDemoUseRealData,
  exitDemo,
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
  isPresetEdited(preset) { return isPresetEdited(state, preset); },
  markEdited(preset = state.activePreset) { markEditedNoRender(preset); render(); },
  updatePreset(preset, patch) { update(markPresetEdited(updatePreset(state, preset, patch), preset)); },
  upsertStomp(preset, fsId, patch) { update(markPresetEdited(upsertStomp(state, preset, fsId, patch), preset)); },
  setExpressions(preset, expressions) { update(markPresetEdited(updatePreset(state, preset, { expressions }), preset)); },
  selectBlock(blockId) { update({ selectedBlock: blockId }); },
  setBlockStomp(preset, block, fsId) { update(markPresetEdited(setBlockStomp(state, preset, block, fsId), preset)); },
  setParamPedal(preset, block, paramIndex, config) { update(markPresetEdited(setParamPedal(state, preset, block, paramIndex, config), preset)); },
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
    saveWorkingState();
    router.recallPreset(preset);
    setTimeout(readSnapshot, 260);
  },
  async renamePresetOnDevice(name) {
    if (!transport && !isDemo()) return notify('Connect to the NANOCORE first');
    const clean = cleanPresetName(name);
    if (!clean) return notify('Enter a preset name using printable characters');
    if (isDemo()) {
      ctx.updatePreset(state.activePreset, { name: clean });
      return notify('Demo mode — name saved in this browser, no pedal was written');
    }
    const ok = window.confirm(
      `Rename NANOCORE preset ${state.activePreset} to "${clean}" and save it permanently?\n\n` +
      'The name is limited to 8 printable ASCII characters by the pedal.',
    );
    if (!ok) return;
    try {
      await sendRequest(COMMAND.SET_FIELD, [FIELD.RENAME, clean.length, ...[...clean].map((c) => c.charCodeAt(0))]);
      await sendRequest(COMMAND.SAVE_PRESET, [Math.max(0, state.activePreset - 1)]);
      ctx.updatePreset(state.activePreset, { name: clean });
      render();
      notify(`Preset ${state.activePreset} renamed to "${clean}" on the pedal`);
    } catch (error) { notify(error.message); }
  },
  async savePreset() {
    if (isDemo()) return notify('Demo mode — nothing is written to a pedal');
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
window.__nanocoreSettingsTab = (tab) => openSettingsTab(ctx, tab);
window.__nanocoreOpenDevices = () => openDevices(ctx);
window.__nanocoreOpenGlobals = () => openGlobals(ctx, render);
window.__nanocoreClearLog = () => { logLines.length = 0; $('#log').textContent = ''; };

function updateCapabilityHint() {
  const el = $('#capability-hint');
  if (el) el.textContent = connectionHint(capabilities);
}
updateCapabilityHint();
updateTempoUI();

function fitTopbar() {
  document.body.classList.remove('hide-tap', 'hide-brand');
  requestAnimationFrame(() => {
    const bar = $('#topbar');
    if (!bar) return;
    const visible = [...bar.children].filter((el) => getComputedStyle(el).display !== 'none');
    const tops = visible.map((el) => el.getBoundingClientRect().top);
    const wrapped = () => {
      const now = visible.filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.getBoundingClientRect().top);
      return now.length > 1 && Math.max(...now) - Math.min(...now) > 4;
    };
    if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 4) {
      document.body.classList.add('hide-tap');
      if (wrapped()) document.body.classList.add('hide-brand');
    }
  });
}
window.addEventListener('resize', () => { fitTopbar(); refreshLiveOrientation(); fitLiveBoard(); });

function render() {
  document.body.classList.toggle('demo-mode', isDemo());
  document.body.classList.toggle('start-mode', state.mode === 'start');
  document.body.classList.toggle('hide-logbar', state.globals.showLogBar === false);
  document.body.classList.toggle('live-fit-screen', state.mode === 'live' && Boolean(state.globals.liveLayout?.fitScreen));
  const panelToggle = $('#panel-toggle');
  if (panelToggle) panelToggle.textContent = state.mode === 'live' ? 'Editor' : 'Live';
  updateTempoUI();
  fitTopbar();
  for (const button of document.querySelectorAll('#mode-switch button')) {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  }
  if (state.mode === 'start') {
    $('#content').innerHTML = renderStart(ctx);
    return;
  }
  if (state.mode === 'live') {
    $('#sidebar').innerHTML = renderLiveSidebar(ctx);
    $('#content').innerHTML = renderLive(ctx);
    requestAnimationFrame(refreshLiveOrientation);
    return;
  }
  const presets = Object.keys(state.presets).map(Number).sort((a, b) => a - b)
    .filter((number) => isPresetEdited(state, number))
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
    <h3>Edited presets</h3>
    ${presets || '<p class="muted small">No presets edited in this editor yet.</p>'}
    <p class="muted small">Names come from the pedal. MIDI bindings stay in this browser.</p>`;
  $('#content').innerHTML = renderEditor(ctx);
  fitTopbar();
}

render();
