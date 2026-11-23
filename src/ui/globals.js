// Globals modal: controller triggers, MIDI channel, persistence import/export.
import { createDefaultState, exportState, importState, normalizeState, USER_SCENE_KEYS } from '../core/store.js';
import { describeTrigger } from '../core/router.js';
import { FIRMWARE_OPTIONS } from '../core/versions.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let modalCtx = null;
let modalRender = null;

const globalsRoot = () => document.querySelector('[data-globals-root]');
export function initGlobals(ctx, rerender) { modalCtx = ctx; if (rerender) modalRender = rerender; }
export const globalsBody = (ctx) => body(ctx);

function refreshGlobals() {
  const root = globalsRoot();
  if (root && modalCtx) root.innerHTML = body(modalCtx);
  else openGlobals(modalCtx, modalRender);
}

export function openGlobals(ctx, rerender) {
  modalCtx = ctx;
  modalRender = rerender;
  const modal = document.querySelector('#modal');
  modal.hidden = false;
  modal.innerHTML = `<div class="modal-box" data-globals-root>
    <div class="modal-head"><h2>Globals</h2><button class="small" data-global="close">Close</button></div>
    ${body(ctx)}
  </div>`;
}

function body(ctx) {
  const g = ctx.state.globals;
  const tap = g.tapTempoSwitch ?? createDefaultState().globals.tapTempoSwitch;
  const rows = g.footswitches.map((fs) => `
    <div class="binding">
      <div class="field">
        <label>Name</label><input data-global="fs-name" data-fs="${fs.id}" value="${escapeHtml(fs.name)}">
        <label>Trigger</label>
        <select data-global="fs-type" data-fs="${fs.id}">
          ${['cc', 'pc', 'note'].map((t) => `<option value="${t}" ${fs.trigger?.type === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
        </select>
        <label>Channel</label><input data-global="fs-channel" data-fs="${fs.id}" type="number" min="1" max="16" value="${fs.trigger?.channel ?? 1}">
        <label>Number</label><input data-global="fs-number" data-fs="${fs.id}" type="number" min="0" max="127" value="${fs.trigger?.number ?? 0}">
        <button class="small" data-global="learn" data-fs="${fs.id}">Learn</button>
        <span class="muted small">${escapeHtml(describeTrigger(fs.trigger))}</span>
      </div>
    </div>`).join('');
  return `<h3>Virtual footswitch triggers</h3>
    <p class="muted small">The incoming message is configured here. Per-preset block targets are set in the Editor.</p>
    ${rows}
    <h3>Expression pedals</h3>
    <p class="muted small">These four virtual pedals can be assigned to a parameter by right-clicking it in the Editor.</p>
    ${(g.expressionPedals ?? []).map((pedal) => `
      <div class="binding">
        <div class="field">
          <label>Name</label><input data-global="fs-name" data-fs="${pedal.id}" value="${escapeHtml(pedal.name)}">
          <label>Trigger</label>
          <select data-global="fs-type" data-fs="${pedal.id}">
            ${['cc', 'pc', 'note'].map((t) => `<option value="${t}" ${pedal.trigger?.type === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
          </select>
          <label>Channel</label><input data-global="fs-channel" data-fs="${pedal.id}" type="number" min="1" max="16" value="${pedal.trigger?.channel ?? 1}">
          <label>Number</label><input data-global="fs-number" data-fs="${pedal.id}" type="number" min="0" max="127" value="${pedal.trigger?.number ?? 0}">
          <button class="small" data-global="learn" data-fs="${pedal.id}">Learn</button>
        </div>
      </div>`).join('')}
    <div class="field"><label><input type="checkbox" data-global="interactive-live" ${g.interactiveLive ? 'checked' : ''}> Interactive Live mode</label>
      <span class="muted small">Let the Live expression meters be dragged or arrow-keyed to control assigned parameters.</span></div>
    <h3>Tempo</h3>
    <div class="field"><label><input type="checkbox" data-global="tempo-sync" ${g.tempoSync !== false ? 'checked' : ''}> Sync delay time to tap tempo</label></div>
    <div class="field"><label>Delay subdivision</label><select data-global="tempo-subdivision">
      ${['1/4','1/8','1/8d','1/16'].map((id) => `<option value="${id}" ${(g.tempo?.subdivision ?? '1/8') === id ? 'selected' : ''}>${({ '1/4': 'Quarter', '1/8': 'Eighth', '1/8d': 'Dotted eighth', '1/16': 'Sixteenth' })[id]}</option>`).join('')}
    </select></div>
    <div class="field">
      <label>Tap tempo trigger</label>
      <select data-tap="type">
        ${['cc', 'pc', 'note'].map((t) => `<option value="${t}" ${tap.trigger?.type === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
      </select>
      <label>Channel</label><input data-tap="channel" type="number" min="1" max="16" value="${tap.trigger?.channel ?? 1}">
      <label>Number</label><input data-tap="number" type="number" min="0" max="127" value="${tap.trigger?.number ?? 87}">
      <button class="small" data-global="learn" data-fs="${tap.id}">Learn</button>
      <span class="muted small">${escapeHtml(describeTrigger(tap.trigger))}</span>
    </div>
    <h3>Scenes</h3>
    <p class="muted small">Base is always available. Choose up to six total scenes and name each one.</p>
    <div class="field">
      <label>Number of scenes</label>
      <select data-global="scene-count">
        ${[3, 4, 5, 6].map((n) => `<option value="${n}" ${(g.sceneCount ?? 3) === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
    </div>
    <h3>Scene switches</h3>
    <p class="muted small">Each switch recalls the scene you assign it to. Use Learn to capture a MIDI message from your controller.</p>
    ${(g.sceneSwitches ?? []).map((sw) => `
      <div class="binding"><div class="field">
        <label>Name</label><input data-global="scene-name" data-scene-id="${sw.id}" value="${escapeHtml(sw.name)}">
        <label>Recalls</label><select data-global="scene-target" data-scene-id="${sw.id}">
          ${['base', ...USER_SCENE_KEYS.slice(0, Math.max(0, (g.sceneCount ?? 3) - 1))]
            .map((v) => `<option value="${v}" ${sw.scene === v ? 'selected' : ''}>${escapeHtml(ctx.sceneName(v))}</option>`).join('')}
        </select>
        <label>Trigger</label><select data-global="scene-type" data-scene-id="${sw.id}">
          ${['cc', 'pc', 'note'].map((t) => `<option value="${t}" ${sw.trigger?.type === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
        </select>
        <label>Channel</label><input data-global="scene-channel" data-scene-id="${sw.id}" type="number" min="1" max="16" value="${sw.trigger?.channel ?? 1}">
        <label>Number</label><input data-global="scene-number" data-scene-id="${sw.id}" type="number" min="0" max="127" value="${sw.trigger?.number ?? 0}">
        <button class="small" data-global="learn" data-fs="${sw.id}">Learn</button>
        <span class="muted small">${escapeHtml(describeTrigger(sw.trigger))}</span>
      </div></div>`).join('')}
    <h3>Device</h3>
    <div class="field">
      <label>Firmware (FX type lists)</label>
      <select data-global="firmware">
        ${FIRMWARE_OPTIONS.map((v) => `<option value="${v}" ${(g.firmware ?? 'auto') === v ? 'selected' : ''}>${v === 'auto' ? `Auto (layout ${g.settingsLayout ?? 1})` : v}</option>`).join('')}
      </select>
      <span class="muted small">Auto follows the 0x65 settings-layout hint. Newer firmware adds MOD/FX2 types; pick explicitly if Auto is wrong.</span>
    </div>
    <div class="field">
      <label>MIDI channel</label>
      <input data-global="midi-channel" type="number" min="1" max="16" value="${g.midiChannel ?? 1}">
      <label>Preset recall</label>
      <select data-global="recall-method">
        <option value="sysex" ${g.recallMethod !== 'pc' ? 'selected' : ''}>Device preset recall</option>
        <option value="pc" ${g.recallMethod === 'pc' ? 'selected' : ''}>Program Change</option>
      </select>
    </div>
    <h3>Persistence</h3>
    <p class="muted small">Bindings are stored in this browser only, never on the pedal.</p>
    <button class="small" data-global="export">Export JSON</button>
    <button class="small" data-global="import">Import JSON</button>
    <input id="import-file" type="file" accept="application/json" hidden>
    <button class="small danger" data-global="reset">Reset everything</button>
    <div style="margin-top:18px"><button class="primary" data-global="save">Save globals</button></div>`;
}

function collect() {
  const ctx = modalCtx;
  const globals = structuredClone(ctx.state.globals);
  const root = globalsRoot() ?? document;
  for (const input of root.querySelectorAll('[data-global]')) {
    const fs = input.dataset.fs;
    if (!fs) continue;
    const target = globals.footswitches.find((f) => f.id === fs)
      ?? globals.expressionPedals?.find((p) => p.id === fs);
    if (!target) continue;
    if (input.dataset.global === 'fs-name') target.name = input.value;
    if (input.dataset.global === 'fs-type') target.trigger = { ...target.trigger, type: input.value };
    if (input.dataset.global === 'fs-channel') target.trigger = { ...target.trigger, channel: Number(input.value) };
    if (input.dataset.global === 'fs-number') target.trigger = { ...target.trigger, number: Number(input.value) };
  }
  for (const input of root.querySelectorAll('[data-scene-id]')) {
    const sw = globals.sceneSwitches?.find((s) => s.id === input.dataset.sceneId);
    if (!sw) continue;
    if (input.dataset.global === 'scene-name') sw.name = input.value;
    if (input.dataset.global === 'scene-target') sw.scene = input.value;
    if (input.dataset.global === 'scene-type') sw.trigger = { ...sw.trigger, type: input.value };
    if (input.dataset.global === 'scene-channel') sw.trigger = { ...sw.trigger, channel: Number(input.value) };
    if (input.dataset.global === 'scene-number') sw.trigger = { ...sw.trigger, number: Number(input.value) };
  }
  const tapInputs = [...root.querySelectorAll('[data-tap]')];
  if (tapInputs.length && globals.tapTempoSwitch) {
    for (const input of tapInputs) {
      if (input.dataset.tap === 'type') globals.tapTempoSwitch.trigger = { ...globals.tapTempoSwitch.trigger, type: input.value };
      if (input.dataset.tap === 'channel') globals.tapTempoSwitch.trigger = { ...globals.tapTempoSwitch.trigger, channel: Number(input.value) };
      if (input.dataset.tap === 'number') globals.tapTempoSwitch.trigger = { ...globals.tapTempoSwitch.trigger, number: Number(input.value) };
    }
  }
  globals.interactiveLive = Boolean(root.querySelector('[data-global="interactive-live"]')?.checked);
  globals.tempoSync = Boolean(root.querySelector('[data-global="tempo-sync"]')?.checked);
  globals.tempo = { ...(globals.tempo ?? {}), subdivision: root.querySelector('[data-global="tempo-subdivision"]')?.value ?? globals.tempo?.subdivision };
  globals.sceneCount = Number(root.querySelector('[data-global="scene-count"]')?.value ?? globals.sceneCount);
  globals.firmware = root.querySelector('[data-global="firmware"]')?.value ?? globals.firmware;
  globals.midiChannel = Number(root.querySelector('[data-global="midi-channel"]')?.value ?? globals.midiChannel);
  globals.recallMethod = root.querySelector('[data-global="recall-method"]')?.value ?? globals.recallMethod;
  return globals;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-global]');
  if (!button || !modalCtx) return;
  switch (button.dataset.global) {
    case 'close':
      document.querySelector('#modal').hidden = true;
      const settings = document.querySelector('#topbar-menu');
      if (settings) settings.hidden = true;
      break;
    case 'save':
      modalCtx.update({ globals: normalizeState({ ...modalCtx.state, globals: collect() }).globals });
      document.querySelector('#modal').hidden = true;
      document.querySelector('#topbar-menu').hidden = true;
      modalRender?.();
      break;
    case 'learn': {
      const id = button.dataset.fs;
      modalCtx.router.armLearn(id);
      button.classList.add('learn');
      button.textContent = 'Press now…';
      const timer = setInterval(() => {
        const learned = modalCtx.router.consumeLearnedTrigger();
        if (!learned) return;
        clearInterval(timer);
        const globals = collect();
        const target = globals.footswitches.find((f) => f.id === id)
          ?? globals.expressionPedals?.find((p) => p.id === id)
          ?? globals.sceneSwitches?.find((s) => s.id === id)
          ?? (globals.tapTempoSwitch?.id === id ? globals.tapTempoSwitch : null);
        if (target) target.trigger = learned;
        modalCtx.update({ globals: normalizeState({ ...modalCtx.state, globals }).globals });
        refreshGlobals();
        modalCtx.notify(`Learned ${describeTrigger(learned)} for ${id}`);
      }, 120);
      break;
    }
    case 'export': {
      const blob = new Blob([exportState(modalCtx.state)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nanocore-live.json';
      a.click();
      URL.revokeObjectURL(a.href);
      break;
    }
    case 'import':
      document.querySelector('#import-file').click();
      break;
    case 'reset':
      if (window.confirm('Reset all bindings stored in this browser?')) {
        modalCtx.update(createDefaultState());
        refreshGlobals();
      }
      break;
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.id !== 'import-file' || !modalCtx) return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    modalCtx.update(importState(await file.text()));
    openGlobals(modalCtx, modalRender);
    modalCtx.notify('Live set imported');
  } catch (error) {
    modalCtx.notify(`Import failed: ${error.message}`);
  }
});
