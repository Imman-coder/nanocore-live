// Globals modal: controller triggers, MIDI channel, persistence import/export.
import { createDefaultState, exportState, importState } from '../core/store.js';
import { describeTrigger } from '../core/router.js';
import { FIRMWARE_OPTIONS } from '../core/versions.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let modalCtx = null;
let modalRender = null;

export function openGlobals(ctx, rerender) {
  modalCtx = ctx;
  modalRender = rerender;
  const modal = document.querySelector('#modal');
  modal.hidden = false;
  modal.innerHTML = `<div class="modal-box">
    <div class="modal-head"><h2>Globals</h2><button class="small" data-global="close">Close</button></div>
    ${body(ctx)}
  </div>`;
}

function body(ctx) {
  const g = ctx.state.globals;
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
  for (const input of document.querySelectorAll('[data-global]')) {
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
  globals.firmware = document.querySelector('[data-global="firmware"]').value;
  globals.midiChannel = Number(document.querySelector('[data-global="midi-channel"]').value);
  globals.recallMethod = document.querySelector('[data-global="recall-method"]').value;
  return globals;
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-global]');
  if (!button || !modalCtx) return;
  switch (button.dataset.global) {
    case 'close':
      document.querySelector('#modal').hidden = true;
      break;
    case 'save':
      modalCtx.update({ globals: collect() });
      document.querySelector('#modal').hidden = true;
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
          ?? globals.expressionPedals?.find((p) => p.id === id);
        if (target) target.trigger = learned;
        modalCtx.update({ globals });
        openGlobals(modalCtx, modalRender);
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
        openGlobals(modalCtx, modalRender);
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
