// Right-click parameter popup: assign one of four virtual expression pedals.
import { BLOCK_BY_ID } from '../core/spec.js';
import { expressionRawToPercent, expressionPercentToRaw } from '../core/live.js';

let state = null;

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keyOf = (s) => `${s.block}:${s.paramIndex}`;

function ownerLabel(key) {
  const [block, index] = key.split(':');
  return `${BLOCK_BY_ID[block]?.name ?? block} parameter ${Number(index) + 1}`;
}

export function openPedalPopup(ctx, target) {
  const preset = ctx.state.activePreset;
  const mapping = ctx.assignments.paramPedals[keyOf(target)];
  state = {
    ctx,
    target,
    pedal: mapping?.pedal ?? null,
    trigger: null,
    minPercent: expressionRawToPercent(mapping?.inputMin ?? 0),
    maxPercent: expressionRawToPercent(mapping?.inputMax ?? 127),
    outMinPercent: expressionRawToPercent(mapping?.outputMin ?? 0),
    outMaxPercent: expressionRawToPercent(mapping?.outputMax ?? 127),
    invert: Boolean(mapping?.invert),
  };
  render();
}

function render() {
  const { ctx, target, pedal, trigger, minPercent, maxPercent, outMinPercent, outMaxPercent, invert } = state;
  const pedals = ctx.state.globals.expressionPedals;
  const chosen = pedals.find((p) => p.id === pedal);
  const globalVolumeId = ctx.state.globals.volumePedal;
  const mapping = ctx.assignments.paramPedals[keyOf(target)];
  const message = trigger ?? chosen?.trigger ?? { type: 'cc', channel: 1, number: 7 };
  const key = keyOf(target);
  document.querySelector('#modal').hidden = false;
  document.querySelector('#modal').innerHTML = `<div class="modal-box">
    <div class="modal-head">
      <h2>Expression pedal → ${escapeHtml(BLOCK_BY_ID[target.block]?.name ?? target.block)} / ${escapeHtml(target.label)}</h2>
      <button class="small" data-popup="close">Close</button>
    </div>
    <p class="muted small">One pedal can drive only one parameter in this preset. Right-click another parameter to reassign it.</p>
    ${target.cc === null ? '<p class="small" style="color:#e6b980">⚠ This parameter has no documented CC — it uses SysEx. Live sweeps may be less stable and are throttled.</p>' : ''}
    <h3>Pedal</h3>
    <div class="radio-row">
      ${pedals.map((p) => {
        const globalVolume = globalVolumeId === p.id;
        return `<button class="radio-card ${p.id === pedal ? 'active' : ''}" data-popup="pedal" data-id="${p.id}"
          ${globalVolume ? 'disabled title="Used globally for preset volume — clear it in Globals first"' : ''}>
          <b>${escapeHtml(p.name)}</b><span class="muted small">${globalVolume ? 'Global · Preset volume' : ctx.describeTrigger(p.trigger)}</span></button>`;
      }).join('')}
    </div>
    <h3>Incoming MIDI message</h3>
    <div class="field">
      <label>Type</label>
      <select data-popup-message="type">
        ${['cc', 'note', 'pc'].map((t) => `<option value="${t}" ${message.type === t ? 'selected' : ''}>${t.toUpperCase()}</option>`).join('')}
      </select>
      <label>Channel</label><input data-popup-message="channel" type="number" min="1" max="16" value="${message.channel ?? 1}">
      <label>Number</label><input data-popup-message="number" type="number" min="0" max="127" value="${message.number ?? 0}">
      <button class="small" data-popup="learn">Learn from pedal</button>
    </div>
    <h3>Value range mapping</h3>
    <div class="field">
      <label>Pedal min (%)</label><input data-popup="min" type="number" min="0" max="100" step="1" value="${minPercent}">
      <label>Pedal max (%)</label><input data-popup="max" type="number" min="0" max="100" step="1" value="${maxPercent}">
      <label>Parameter min (%)</label><input data-popup="out-min" type="number" min="0" max="100" step="1" value="${outMinPercent}">
      <label>Parameter max (%)</label><input data-popup="out-max" type="number" min="0" max="100" step="1" value="${outMaxPercent}">
      <label><input data-popup="invert" type="checkbox" ${invert ? 'checked' : ''}> Invert</label>
    </div>
    <p class="small muted">The pedal window and the parameter window are independent. For example, 5–95% of pedal travel can map to only 30–80% of the parameter knob; values outside the pedal window are clamped.</p>
    <p id="popup-error" class="warning" hidden></p>
    <div class="field" style="margin-top:16px">
      <button class="primary" data-popup="save">${mapping ? 'Update assignment' : 'Assign pedal'}</button>
      ${mapping ? '<button class="danger" data-popup="remove">Remove assignment</button>' : ''}
      <button data-popup="close">Cancel</button>
    </div>
  </div>`;
}

function collectMessage() {
  const modal = document.querySelector('#modal');
  return {
    type: modal.querySelector('[data-popup-message="type"]').value,
    channel: Number(modal.querySelector('[data-popup-message="channel"]').value),
    number: Number(modal.querySelector('[data-popup-message="number"]').value),
  };
}

function fail(message) {
  const el = document.querySelector('#popup-error');
  el.textContent = message;
  el.hidden = false;
}

document.addEventListener('input', (event) => {
  if (!state) return;
  const el = event.target;
  if (el.dataset.popup === 'min') state.minPercent = Number(el.value);
  if (el.dataset.popup === 'max') state.maxPercent = Number(el.value);
  if (el.dataset.popup === 'out-min') state.outMinPercent = Number(el.value);
  if (el.dataset.popup === 'out-max') state.outMaxPercent = Number(el.value);
  if (el.dataset.popup === 'invert') state.invert = el.checked;
  if (el.dataset.popupMessage) state.trigger = collectMessage();
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-popup]');
  if (!button || !state) return;
  const { ctx, target } = state;
  const preset = ctx.state.activePreset;
  const key = keyOf(target);
  switch (button.dataset.popup) {
    case 'close':
      state = null;
      document.querySelector('#modal').hidden = true;
      break;
    case 'pedal':
      state.pedal = button.dataset.id;
      state.trigger = null;
      render();
      break;
    case 'learn': {
      const pedalId = state.pedal;
      if (!pedalId) return fail('Choose a pedal first.');
      ctx.router.armLearn(`pedal:${pedalId}`);
      button.textContent = 'Press now…';
      const timer = setInterval(() => {
        const learned = ctx.router.consumeLearnedTrigger();
        if (!learned || !state) return;
        clearInterval(timer);
        state.trigger = learned;
        ctx.setExpressionTrigger(pedalId, learned);
        render();
        ctx.notify(`Learned ${ctx.describeTrigger(learned)} for ${pedalId}`);
      }, 120);
      break;
    }
    case 'save': {
      const pedalId = state.pedal;
      if (!pedalId) return fail('Choose a pedal first.');
      if (ctx.state.globals.volumePedal === pedalId) {
        return fail(`${pedalId} controls preset volume globally. Clear it in Globals first.`);
      }
      const owner = ctx.pedalOwner(preset, pedalId);
      if (owner && owner !== key) {
        return fail(`${pedalId} is already assigned to ${ownerLabel(owner)} in this preset. Unassign it there first.`);
      }
      const modal = document.querySelector('#modal');
      const message = state.trigger ?? collectMessage();
      const minPercent = Number(modal.querySelector('[data-popup="min"]').value);
      const maxPercent = Number(modal.querySelector('[data-popup="max"]').value);
      const outMinPercent = Number(modal.querySelector('[data-popup="out-min"]').value);
      const outMaxPercent = Number(modal.querySelector('[data-popup="out-max"]').value);
      if (minPercent >= maxPercent) return fail('Pedal min % must be lower than max %.');
      if (outMinPercent >= outMaxPercent) return fail('Parameter min % must be lower than max %.');
      const inputMin = expressionPercentToRaw(minPercent);
      const inputMax = expressionPercentToRaw(maxPercent);
      const outputMin = expressionPercentToRaw(outMinPercent);
      const outputMax = expressionPercentToRaw(outMaxPercent);
      const invert = modal.querySelector('[data-popup="invert"]').checked;
      ctx.setExpressionTrigger(pedalId, message);
      ctx.setParamPedal(preset, target.block, target.paramIndex, {
        pedal: pedalId, inputMin, inputMax, outputMin, outputMax, invert,
      });
      ctx.notify(`${pedalId} assigned to ${target.label}`);
      state = null;
      document.querySelector('#modal').hidden = true;
      break;
    }
    case 'remove':
      ctx.setParamPedal(preset, target.block, target.paramIndex, null);
      ctx.notify('Pedal assignment removed');
      state = null;
      document.querySelector('#modal').hidden = true;
      break;
  }
});
