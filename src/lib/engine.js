// App shell: state, transports, routing glue and view switching.
import { BLOCK_BY_ID, SNAPSHOT_BLOCKS } from '../core/spec.js';
import {
  loadState, saveState, setActivePreset, updatePreset,
  upsertStomp, assignmentsFor, effectiveStompLabel,
  setBlockStomp, setParamPedal, pedalOwner, setExpressionTrigger, USER_SCENE_KEYS, renameScene, setSceneBlock, setTempoSync, setLiveLayout, setLiveGrid, isPresetEdited, markPresetEdited,
} from '../core/store.js';
import { createRouter, describeTrigger } from '../core/router.js';
import { createMidiScheduler } from '../core/scheduler.js';
import { buildCc, buildRequestSysEx, ResponseAssembler, COMMAND, FIELD, cleanPresetName } from '../core/messages.js';
import { resolveFirmware, typesFor } from '../core/versions.js';
import { stompActive, toggleCc, sceneStored, sceneBlockParticipates } from '../core/live.js';
import { tapBpm, delayMs, normalizedForMs } from '../core/tempo.js';
import { connectionHint } from '../core/capabilities.js';
import { createDispatcher, selectExpressionValue, selectTempoSync } from '../engine/index.js';

import {
  publishState, publishSnapshot, publishFeedback, publishUi, publishLog, publishToast, publishAll,
} from './gateway/viewmodel.js';
import { createDeviceGateway } from './gateway/device.js';
import { createConnectionGateway } from './gateway/connection.js';
export { app, stateView, snapshotView, feedbackView, uiView } from './gateway/viewmodel.js';
import { createMemoryStorage } from '../core/demoData.js';

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
let dispatcher = null;
let device = null;
let connection = null;

// Shared runtime for the gateway modules. Getters keep the existing local
// variables authoritative while those modules stay independent of each other.
const rt = {
  get state() { return state; }, set state(value) { state = value; },
  get snapshot() { return snapshot; }, set snapshot(value) { snapshot = value; },
  get names() { return names; },
  get catalog() { return catalogState; },
  get transport() { return transport; }, set transport(value) { transport = value; },
  get controllerTransport() { return controllerTransport; }, set controllerTransport(value) { controllerTransport = value; },
  get sequence() { return sequence; }, set sequence(value) { sequence = value; },
  pending,
  assembler,
  get lastReply() { return lastReply; }, set lastReply(value) { lastReply = value; },
  get lastSnapshotPreset() { return lastSnapshotPreset; }, set lastSnapshotPreset(value) { lastSnapshotPreset = value; },
  localEnabled,
  get demoState() { return demoState; }, set demoState(value) { demoState = value; },
  get demoUseRealData() { return demoUseRealData; }, set demoUseRealData(value) { demoUseRealData = value; },
  get demoRequested() { return demoRequested; }, set demoRequested(value) { demoRequested = value; },
  get transportBeforeDemo() { return transportBeforeDemo; }, set transportBeforeDemo(value) { transportBeforeDemo = value; },
  mainStorage, demoStorage, capabilities,
  get router() { return router; },
  get ctx() { return ctx; },
  get scheduler() { return scheduler; },
  get routerGlobals() { return routerGlobals; },
  get device() { return device; },
  loadState, saveState,
  finishSetup: () => finishSetup(),
  saveWorkingState: () => saveWorkingState(),
  persist: () => persist(),
  update: (patch) => update(patch),
  render: () => render(),
  setStatus: (text, online = false) => setStatus(text, online),
  log: (message) => log(message),
  notify: (message) => notify(message),
  isDemo: () => isDemo(),
  currentAssignments: () => currentAssignments(),
};

const currentAssignments = () => assignmentsFor(state, state.activePreset);

// Svelte-facing view model. All protocol/state logic below is unchanged from
// the previous app shell; only DOM rendering was replaced by this store.
let statusTextValue = 'Disconnected';
let toastMessage = null;
let toastTimer = null;

function emit() {
  publishAll({
    state,
    snapshot,
    names,
    catalog: catalogState,
    ui: {
      status: statusTextValue,
      connected: Boolean(transport),
      demo: isDemo(),
      demoUseRealData,
      transportKind: isDemo() || demoRequested ? 'demo' : (state.globals.transportKind ?? 'webmidi'),
      lastReply,
      ports: controllerTransport?.listPorts() ?? { inputs: [], outputs: [] },
      devicePorts: transport?.listPorts() ?? { inputs: [], outputs: [] },
      capabilities: { ...capabilities },
      firmware: resolveFirmware(state),
      logLines,
      toast: toastMessage,
    },
  });
}

function render() { emit(); }

function log(message) {
  logLines.push(message);
  if (logLines.length > 200) logLines.shift();
  publishLog(logLines);
}

function notify(message) {
  toastMessage = message;
  clearTimeout(toastTimer);
  publishToast(message);
  toastTimer = setTimeout(() => { toastMessage = null; publishToast(null); }, 2600);
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
  statusTextValue = text;
  publishUi({ status: text, connected: online });
}

function isDemo() { return connection.isDemo(); }
function workingStorage() { return connection.workingStorage(); }
function saveWorkingState() { connection.saveWorkingState(); }
function enterDemoData() { connection.enterDemoData(); }
function adoptMainState() { connection.adoptMainState(); }
function setDemoUseRealData(enabled) { connection.setDemoUseRealData(enabled); }

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

device = createDeviceGateway(rt);
connection = createConnectionGateway(rt);

function send(bytes, key) { return device.send(bytes, key); }
function sendRequest(command, payload = [], timeout = 3000) { return device.sendRequest(command, payload, timeout); }
function settle(sequence, command, frame, error) { return device.settle(sequence, command, frame, error); }

function syncPresetFromDevice() { return device.syncPresetFromDevice(); }
function applySnapshot(parsed) { return device.applySnapshot(parsed); }
function refreshActiveAssets() { return device.refreshActiveAssets(); }
function handleDeviceMessage(message) { return device.handleDeviceMessage(message); }
function readSnapshot() { return device.readSnapshot(); }
function presetLabel(number) { return device.presetLabel(number); }
function loadPresetNames() { return device.loadPresetNames(); }
function loadAssetNames(kind) { return device.loadAssetNames(kind); }
function refreshAssetNames(kind) { return device.refreshAssetNames(kind); }

function paintExpressionFeedback(pedalId, value) {
  publishFeedback(pedalId, value);
}

function dispatch(command) {
  if (!dispatcher) return;
  const scoped = command?.type === 'expression' || command?.type === 'writeParameter';
  if (command?.type === 'expression') {
    paintExpressionFeedback(command.binding?.id ?? command.expression, Number(command.raw ?? command.value ?? 0) || 0);
  }
  dispatcher.dispatch(command);
  persist();
  if (scoped) {
    publishState(state);
    publishSnapshot(snapshot);
  } else {
    render();
  }
}

function applyVolumeFromExpression(raw) {
  const volume = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
  if (snapshot) snapshot.volume = volume;
  send(buildRequestSysEx(COMMAND.SET_FIELD, [FIELD.VOLUME, volume]), `expression-volume:${state.globals.volumePedal ?? 'none'}`);
  publishSnapshot(snapshot);
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
      log(`expression: ${JSON.stringify({ id: event.expression, raw: event.raw, tempo: Boolean(event.tempo) })}`);
      if (event.binding) {
        dispatch({
          type: 'expression',
          binding: event.binding,
          raw: Number(event.raw ?? event.value ?? 0) || 0,
          variant: event.variant ?? 0,
        });
      }
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

function applyPortSelection() { return connection.applyPortSelection(); }
function finishSetup() { return connection.finishSetup(); }
function autoFetchCatalog() { return connection.autoFetchCatalog(); }
function setTransportKind(kind) { return connection.setTransportKind(kind); }
function disconnect() { return connection.disconnect(); }
function exitDemo() { return connection.exitDemo(); }
function refreshCatalog(which = 'all') { return connection.refreshCatalog(which); }
function scanPorts() { return connection.scanPorts(); }
function connect(forcedKind) { return connection.connect(forcedKind); }

export const ctx = {
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
  statusText() { return statusTextValue; },
  connect,
  scanPorts,
  setTransportKind,
  disconnect,
  refreshCatalog,
  setGlobalSetting(key, value) {
    dispatch({ type: 'setGlobalSetting', key, value });
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
      return;
    }
    state = { ...state, globals: { ...state.globals, tempo: { ...state.globals.tempo, bpm } } };
    persist();
    syncDelays();
  },
  setTempo(patch) {
    state = { ...state, globals: { ...state.globals, tempo: { ...(state.globals.tempo ?? {}), ...patch } } };
    persist();
    syncDelays();
  },
  syncDelays,
  // One resolver supplies every fader's starting position from its assigned
  // target: parameter value, tempo subdivision or global preset volume.
  expressionInitialValue(pedalId) {
    if (state.globals.volumePedal === pedalId) {
      return selectExpressionValue({ volume: true }, state, snapshot);
    }
    const binding = currentAssignments().expressions.find((entry) => entry.id === pedalId);
    return selectExpressionValue(binding, state, snapshot);
  },
  sendExpression(pedalId, value) {
    const binding = state.globals.volumePedal === pedalId
      ? { id: pedalId, volume: true }
      : currentAssignments().expressions.find((e) => e.id === pedalId);
    if (!binding) return notify(`${pedalId} has no parameter assigned in this preset`);
    const variant = snapshot?.blocks.find((b) => b.id === binding.target)?.variant ?? 0;
    dispatch({ type: 'expression', binding, raw: value, variant });
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
      dispatch({ type: 'storeScene', base: true, values, enabled });
      return notify(`Base stored in this browser · ${Object.keys(enabled).length} fx states`);
    }
    dispatch({ type: 'storeScene', name, values, enabled });
    notify(`${name === 'base' ? 'Base' : `Scene ${name.slice(-1)}`} stored · ${Object.keys(enabled).length} fx states${skipped ? ` · ${skipped} block(s) skipped` : ''}`);
  },
  selectScene(name) {
    if (!sceneStored(currentAssignments(), name)) {
      dispatch({ type: 'selectScene', name });
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
    dispatch({ type: 'recallScene', name });
  },
  applySceneRecall(name) {
    dispatch({ type: 'selectScene', name });
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
    return selectTempoSync(state, blockId);
  },
  tempoSubdivisionMs(blockId) {
    const config = ctx.tempoSyncFor(blockId);
    const tempo = state.globals.tempo ?? { bpm: 120, signature: '4/4' };
    return delayMs(tempo.bpm ?? 120, tempo.signature ?? '4/4', config.subdivision ?? '1/8');
  },
  setTempoSync(blockId, patch) {
    dispatch({ type: 'setTempoSync', block: blockId, patch });
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
  setSceneBlock(blockId, participates, options = {}) {
    dispatch({ type: 'setSceneBlock', block: blockId, participates, options });
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
    dispatch({
      type: 'writeParameter',
      target: { kind: 'param', block: blockId, index: paramIndex },
      normalized: Math.max(0, Math.min(1, normalized)),
      source: 'editor',
    });
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
  setParamPedal(preset, block, paramIndex, config) { dispatch({ type: 'setParamPedal', preset, block, paramIndex, config }); },
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

dispatcher = createDispatcher({
  getState: () => state,
  setState: (next) => { state = next; },
  getSnapshot: () => snapshot,
  effects: {
    writeParameter: ({ target, normalized, bytes, pedalId }) => {
      ctx.noteParameter(target.block, target.index, normalized);
      send(bytes, pedalId ? `expression:${pedalId}` : `parameter:${target.block}:${target.index}`);
      markEditedNoRender(state.activePreset);
    },
    syncDelays: () => syncDelays(),
    setVolume: ({ value }) => applyVolumeFromExpression(value),
    recallScene: ({ name }) => ctx.applySceneRecall(name),
    notify: ({ message }) => notify(message),
  },
});

window.__nanocoreCtx = ctx;
window.__nanocoreConnect = connect;
window.__nanocoreClearLog = () => { logLines.length = 0; publishLog(logLines); };

emit();
