// Browser-persisted state. Assignments are keyed by the real NANOCORE preset
// number; the pedal owns preset data, the browser owns MIDI bindings only.
export const STORAGE_KEY = 'nanocore-live:v1';
export const STATE_VERSION = 1;

let counter = 0;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const USER_SCENE_KEYS = ['scene1', 'scene2', 'scene3', 'scene4', 'scene5', 'scene6'];
const defaultSceneSwitches = (count) => Array.from({ length: count }, (_, i) => ({
  id: `S${i + 1}`,
  name: i === 0 ? 'Base' : `Scene ${i}`,
  scene: i === 0 ? 'base' : `scene${i}`,
  trigger: { type: 'cc', channel: 1, number: 84 + i },
}));

const defaultPedals = () => [7, 11, 1, 4].map((number, i) => ({
  id: `E${i + 1}`, name: `Expression ${i + 1}`, trigger: { type: 'cc', channel: 1, number }, fullTouch: false,
}));

function flattenLiveLayout(node, out, globals) {
  if (!node) return;
  if (node.items) { node.items.forEach((child) => flattenLiveLayout(child, out, globals)); return; }
  if (node.type !== 'item') return;
  const groups = {
    scenes: { kind: 'scene', ids: ['base', ...USER_SCENE_KEYS.slice(0, Math.max(0, (globals.sceneCount ?? 3) - 1))] },
    stomps: { kind: 'stomp', ids: (globals.footswitches ?? []).map((f) => f.id) },
    expressions: { kind: 'expression', ids: (globals.expressionPedals ?? []).map((p) => p.id) },
  };
  const group = groups[node.kind];
  if (group) group.ids.forEach((ref) => out.push({ kind: group.kind, ref }));
  else if (node.kind === 'tap') out.push({ kind: 'tap' });
}

function liveGridLayout(layout, globals) {
  if (isObject(layout?.grid)) {
    return {
      ...layout,
      grid: {
        ...layout.grid,
        items: (layout.grid.items ?? []).map((item, i) => ({
          id: item.id ?? `g${i + 1}`, colSpan: 1, rowSpan: 1, ...item,
        })),
      },
    };
  }
  const flat = [];
  flattenLiveLayout(layout?.root, flat, globals);
  const columns = Math.max(1, Math.min(8, flat.length || 4));
  const rows = Math.max(1, Math.ceil(flat.length / columns));
  return {
    ...layout,
    grid: {
      columns,
      rows,
      items: flat.map((item, i) => ({
        id: `g${i + 1}`, ...item,
        col: (i % columns) + 1, row: Math.floor(i / columns) + 1, colSpan: 1, rowSpan: 1,
      })),
    },
  };
}

export function normalizePreset(preset = {}) {
  return {
    name: preset.name ?? `Preset ${preset.preset ?? 1}`,
    edited: preset.edited === true,
    stomps: Array.isArray(preset.stomps) ? preset.stomps : [],
    expressions: Array.isArray(preset.expressions) ? preset.expressions : [],
    blockStomps: isObject(preset.blockStomps) ? preset.blockStomps : {},
    paramPedals: isObject(preset.paramPedals) ? preset.paramPedals : {},
    sceneNames: Object.fromEntries(USER_SCENE_KEYS.map((key, i) =>
      [key, preset.sceneNames?.[key] || `Scene ${i + 1}`])),
    sceneBlocks: isObject(preset.sceneBlocks) ? { ...preset.sceneBlocks } : {},
    tempoSync: isObject(preset.tempoSync) ? { ...preset.tempoSync } : {},
    base: {
      values: isObject(preset.base?.values) ? { ...preset.base.values } : {},
      enabled: isObject(preset.base?.enabled) ? { ...preset.base.enabled } : {},
    },
    scenes: Object.fromEntries(USER_SCENE_KEYS.map((key) =>
      [key, isObject(preset.scenes?.[key]) ? preset.scenes[key] : {}])),
    sceneEnabled: Object.fromEntries(USER_SCENE_KEYS.map((key) =>
      [key, isObject(preset.sceneEnabled?.[key]) ? preset.sceneEnabled[key] : {}])),
  };
}

function migratePreset(preset) {
  const result = normalizePreset(preset);
  if (!Object.keys(result.blockStomps).length) {
    for (const stomp of result.stomps) {
      for (const target of stomp.targets ?? []) {
        if (!target?.block || result.blockStomps[target.block]) continue;
        result.blockStomps[target.block] = stomp.mode && stomp.mode !== 'value'
          ? { fs: stomp.fsId, mode: stomp.mode, value: target.value }
          : stomp.fsId;
      }
    }
  }
  if (!Object.keys(result.paramPedals).length) {
    for (const expression of result.expressions) {
      if (!expression?.target) continue;
      result.paramPedals[`${expression.target}:${expression.paramIndex ?? 0}`] = {
        pedal: expression.id,
        inputMin: expression.inputMin ?? 0,
        inputMax: expression.inputMax ?? 127,
        outputMin: expression.outputMin ?? 0,
        outputMax: expression.outputMax ?? 127,
        invert: Boolean(expression.invert),
      };
    }
  }
  return result;
}

function presetsFromLegacy(state) {
  const rows = state?.liveSet?.rows;
  if (!Array.isArray(rows) || !rows.length) return null;
  return Object.fromEntries(rows.map((row) => [String(row.preset ?? 1), migratePreset(row)]));
}

export function createDefaultState() {
  return {
    version: STATE_VERSION,
    globals: {
      midiChannel: 1,
      firmware: 'auto',
      settingsLayout: 1,
      recallMethod: 'sysex',
      footswitches: [1, 2, 3, 4].map((n) => ({
        id: `FS${n}`, name: `Stomp ${n}`, trigger: { type: 'cc', channel: 1, number: n + 4 },
      })),
      expressionPedals: defaultPedals(),
      baseOverride: false,
      transportKind: 'webmidi',
      showLogBar: true,
      hideLivePresetLabel: false,
      hideAssignmentsButton: false,
      interactiveLive: false,
      absoluteExpression: false,
      volumePedal: null,
      tempoSync: true,
      tempo: { bpm: null, signature: '4/4', subdivision: '1/8' },
      liveLayout: {
        grid: {
          columns: 4,
          rows: 3,
          items: [
            ...['base', 'scene1', 'scene2'].map((id, i) => ({
              id: `scene-${id}`, kind: 'scene', ref: id, col: i + 1, row: 1, colSpan: 1, rowSpan: 1,
            })),
            { id: 'tap', kind: 'tap', col: 4, row: 1, colSpan: 1, rowSpan: 1 },
            ...[1, 2, 3, 4].map((n) => ({
              id: `stomp-FS${n}`, kind: 'stomp', ref: `FS${n}`, col: n, row: 2, colSpan: 1, rowSpan: 1,
            })),
            ...[1, 2, 3, 4].map((n) => ({
              id: `expr-E${n}`, kind: 'expression', ref: `E${n}`, col: n, row: 3, colSpan: 1, rowSpan: 1,
            })),
          ],
        },
        hideSidebar: false,
        fitScreen: false,
      },
      sceneCount: 3,
      sceneSwitches: defaultSceneSwitches(3),
      tapTempoSwitch: { id: 'TAP', name: 'Tap tempo', trigger: { type: 'cc', channel: 1, number: 87 } },
    },
    presets: { '1': normalizePreset({ preset: 1 }) },
    activePreset: 1,
    selectedBlock: null,
    activeScene: 'base',
    expandedBlocks: [],
    mode: 'start',
    liveEditing: false,
    showAdvanced: false,
  };
}

export function normalizeState(state) {
  const base = createDefaultState();
  const rawPresets = state?.presets && Object.keys(state.presets).length
    ? state.presets
    : presetsFromLegacy(state) ?? base.presets;
  const presets = Object.fromEntries(
    Object.entries(rawPresets).map(([key, value]) => [String(key), migratePreset(value)]),
  );
  const active = Number(state?.activePreset) || Number(Object.keys(presets)[0]) || 1;
  const globals = { ...base.globals, ...(state?.globals ?? {}) };
  if (!Array.isArray(globals.footswitches) || !globals.footswitches.length) globals.footswitches = base.globals.footswitches;
  if (!Array.isArray(globals.expressionPedals) || !globals.expressionPedals.length) globals.expressionPedals = base.globals.expressionPedals;
  globals.expressionPedals = globals.expressionPedals.map((p) => ({ fullTouch: false, ...p }));
  const sceneCount = Math.max(3, Math.min(6, Number(globals.sceneCount) || 3));
  globals.tapTempoSwitch = globals.tapTempoSwitch ?? base.globals.tapTempoSwitch;
  globals.showLogBar = typeof globals.showLogBar === 'boolean' ? globals.showLogBar : true;
  globals.absoluteExpression = typeof globals.absoluteExpression === 'boolean' ? globals.absoluteExpression : false;
  globals.volumePedal = globals.volumePedal ?? null;
  globals.hideLivePresetLabel = typeof globals.hideLivePresetLabel === 'boolean' ? globals.hideLivePresetLabel : false;
  globals.hideAssignmentsButton = typeof globals.hideAssignmentsButton === 'boolean' ? globals.hideAssignmentsButton : false;
  if (!isObject(globals.liveLayout?.grid) && !isObject(globals.liveLayout?.root)) globals.liveLayout = base.globals.liveLayout;
  globals.liveLayout = liveGridLayout(globals.liveLayout, globals);
  globals.liveLayout.fitScreen = typeof globals.liveLayout.fitScreen === 'boolean' ? globals.liveLayout.fitScreen : false;
  globals.sceneCount = sceneCount;
  const switches = defaultSceneSwitches(sceneCount);
  const existingSwitches = Array.isArray(globals.sceneSwitches) ? globals.sceneSwitches : [];
  globals.sceneSwitches = switches.map((sw, i) => {
    const old = existingSwitches.find((s) => s?.id === sw.id);
    return old ? { ...sw, ...old, id: sw.id, scene: old.scene ?? sw.scene } : sw;
  });
  return {
    ...base,
    ...state,
    version: STATE_VERSION,
    globals,
    presets,
    activePreset: active,
    expandedBlocks: Array.isArray(state?.expandedBlocks) ? state.expandedBlocks : [],
  };
}

export function loadState(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return importState(raw);
  } catch {
    return createDefaultState();
  }
}

export function saveState(storage, state) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  return JSON.stringify({ ...state, version: STATE_VERSION, exportedAt: new Date().toISOString() }, null, 2);
}

export function importState(text) {
  const parsed = typeof text === 'string' ? JSON.parse(text) : text;
  if (!parsed || parsed.version !== STATE_VERSION) throw new Error('Unsupported state version');
  if (!parsed.presets && !Array.isArray(parsed.liveSet?.rows)) throw new Error('State has no preset assignments');
  return normalizeState(parsed);
}

function presetRecord(state, preset) {
  return normalizePreset(state.presets[String(preset)] ?? { preset });
}

// Exposes the new assignment model in the shape the MIDI router consumes.
export function assignmentsFor(state, preset) {
  const record = presetRecord(state, preset);
  const byStomp = new Map();
  for (const [block, assignment] of Object.entries(record.blockStomps)) {
    const fsId = typeof assignment === 'string' ? assignment : assignment?.fs;
    if (!fsId) continue;
    const mode = typeof assignment === 'string' ? 'value' : (assignment?.mode ?? 'value');
    const value = typeof assignment === 'object' ? assignment?.value : undefined;
    const list = byStomp.get(fsId) ?? { fsId, mode, targets: [] };
    list.targets.push({ block, ...(typeof value === 'number' ? { value } : {}) });
    byStomp.set(fsId, list);
  }
  const expressions = Object.entries(record.paramPedals).flatMap(([key, mapping]) => {
    const [target, index] = key.split(':');
    const pedal = (state.globals.expressionPedals ?? []).find((p) => p.id === mapping?.pedal);
    if (!target || !pedal) return [];
    return [{
      id: pedal.id,
      trigger: pedal.trigger,
      target,
      paramIndex: Number(index) || 0,
      inputMin: mapping.inputMin ?? 0,
      inputMax: mapping.inputMax ?? 127,
      outputMin: mapping.outputMin ?? 0,
      outputMax: mapping.outputMax ?? 127,
      invert: Boolean(mapping.invert),
    }];
  });
  return {
    name: record.name,
    sceneNames: record.sceneNames,
    stomps: [...byStomp.values()],
    expressions,
    blockStomps: record.blockStomps,
    paramPedals: record.paramPedals,
    scenes: record.scenes,
    sceneEnabled: record.sceneEnabled,
    sceneBlocks: record.sceneBlocks,
    base: record.base,
    tempoSync: record.tempoSync,
  };
}

export function setActivePreset(state, preset) {
  const number = Math.max(1, Math.min(64, Number(preset) || 1));
  return { ...state, activePreset: number, selectedBlock: null, activeScene: 'base' };
}

export function isPresetEdited(state, preset) {
  return Boolean(state.presets?.[String(preset)]?.edited);
}

export function markPresetEdited(state, preset) {
  if (isPresetEdited(state, preset)) return state;
  return updatePreset(state, preset, { edited: true });
}

export function setPresetName(state, preset, name) {
  return updatePreset(state, preset, { name: String(name ?? '').trim() });
}

export function setPresetNames(state, entries) {
  let next = state;
  const list = entries instanceof Map ? [...entries.entries()] : Object.entries(entries ?? {});
  for (const [slot, name] of list) {
    const preset = Number(slot) + 1;
    if (preset >= 1 && preset <= 64 && name) next = setPresetName(next, preset, name);
  }
  return next;
}

export function updatePreset(state, preset, patch) {
  const key = String(preset);
  return { ...state, presets: { ...state.presets, [key]: normalizePreset({ ...presetRecord(state, preset), ...patch }) } };
}

export function setBlockStomp(state, preset, block, fsId) {
  const record = presetRecord(state, preset);
  const blockStomps = { ...record.blockStomps };
  if (fsId) blockStomps[block] = fsId; else delete blockStomps[block];
  return updatePreset(state, preset, { blockStomps });
}

export function setParamPedal(state, preset, block, paramIndex, config) {
  const record = presetRecord(state, preset);
  const paramPedals = { ...record.paramPedals };
  const key = `${block}:${paramIndex}`;
  if (config) paramPedals[key] = config; else delete paramPedals[key];
  return updatePreset(state, preset, { paramPedals });
}

export function renameScene(state, preset, name, label) {
  if (!USER_SCENE_KEYS.includes(name)) return state;
  const record = presetRecord(state, preset);
  return updatePreset(state, preset, {
    sceneNames: { ...record.sceneNames, [name]: String(label ?? '').trim() || `Scene ${Number(name.slice(-1)) || 1}` },
  });
}

export function setScene(state, preset, name, values) {
  if (!USER_SCENE_KEYS.includes(name)) return state;
  const record = presetRecord(state, preset);
  return updatePreset(state, preset, {
    scenes: { ...record.scenes, [name]: { ...(values ?? {}) } },
  });
}

export function setSceneEnabled(state, preset, name, enabled) {
  if (!USER_SCENE_KEYS.includes(name)) return state;
  const record = presetRecord(state, preset);
  return updatePreset(state, preset, {
    sceneEnabled: { ...record.sceneEnabled, [name]: { ...(enabled ?? {}) } },
  });
}

export function setLiveGrid(state, patch) {
  const layout = state.globals.liveLayout;
  return setLiveLayout(state, { ...layout, grid: { ...layout.grid, ...patch } });
}

export function setLiveLayout(state, layout) {
  return { ...state, globals: { ...state.globals, liveLayout: layout } };
}

export function setTempoSync(state, preset, blockId, patch) {
  const record = presetRecord(state, preset);
  const current = record.tempoSync[blockId] ?? { enabled: false, subdivision: '1/8' };
  return updatePreset(state, preset, {
    tempoSync: { ...record.tempoSync, [blockId]: { ...current, ...patch } },
  });
}

export function setBase(state, preset, values, enabled) {
  const record = presetRecord(state, preset);
  return updatePreset(state, preset, {
    base: { values: { ...(values ?? {}) }, enabled: { ...(enabled ?? {}) } },
  });
}

export function setSceneBlock(state, preset, blockId, participates, options = {}) {
  const record = presetRecord(state, preset);
  let next = updatePreset(state, preset, {
    sceneBlocks: { ...record.sceneBlocks, [blockId]: Boolean(participates) },
  });
  if (participates || !options.forgetValues) return next;

  // Excluding a block is destructive: drop every value it had stored in this
  // preset's scenes, scene FX states and base snapshot.
  const prefix = `${blockId}:`;
  const withoutValues = (map) => Object.fromEntries(
    Object.entries(map ?? {}).filter(([key]) => !key.startsWith(prefix)),
  );
  const updated = presetRecord(next, preset);
  next = updatePreset(next, preset, {
    scenes: Object.fromEntries(USER_SCENE_KEYS.map((key) =>
      [key, withoutValues(updated.scenes?.[key])])),
    sceneEnabled: Object.fromEntries(USER_SCENE_KEYS.map((key) =>
      [key, Object.fromEntries(Object.entries(updated.sceneEnabled?.[key] ?? {})
        .filter(([key2]) => key2 !== blockId))])),
    base: {
      values: withoutValues(updated.base?.values),
      enabled: Object.fromEntries(Object.entries(updated.base?.enabled ?? {})
        .filter(([key]) => key !== blockId)),
    },
  });
  return next;
}

export function pedalOwner(state, preset, pedalId) {
  const record = presetRecord(state, preset);
  return Object.entries(record.paramPedals).find(([, mapping]) => mapping?.pedal === pedalId)?.[0] ?? null;
}

export function setExpressionTrigger(state, pedalId, trigger) {
  const expressionPedals = (state.globals.expressionPedals ?? []).map((p) =>
    p.id === pedalId ? { ...p, trigger } : p);
  return { ...state, globals: { ...state.globals, expressionPedals } };
}

export function upsertStomp(state, preset, fsId, patch) {
  const current = assignmentsFor(state, preset).stomps.find((s) => s.fsId === fsId) ?? { fsId, mode: 'value', targets: [] };
  const next = { ...current, ...patch, fsId };
  const blockStomps = { ...presetRecord(state, preset).blockStomps };
  for (const target of next.targets ?? []) {
    blockStomps[target.block] = next.mode === 'value' ? fsId : { fs: fsId, mode: next.mode, value: target.value };
  }
  return updatePreset(state, preset, { blockStomps });
}

export function upsertExpression(state, preset, expression) {
  return setParamPedal(state, preset, expression.target, expression.paramIndex ?? 0, {
    pedal: expression.id,
    inputMin: expression.inputMin ?? 0,
    inputMax: expression.inputMax ?? 127,
    outputMin: expression.outputMin ?? 0,
    outputMax: expression.outputMax ?? 127,
    invert: Boolean(expression.invert),
  });
}

export function effectiveStompLabel(state, assignments, fsId) {
  const binding = assignments.stomps.find((s) => s.fsId === fsId);
  if (binding?.label) return binding.label;
  const fs = state.globals.footswitches.find((f) => f.id === fsId);
  return fs?.name ?? fsId;
}

export { uid };
