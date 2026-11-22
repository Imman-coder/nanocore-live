// Right-click parameter popup: assign one of four virtual expression pedals.
import { BLOCK_BY_ID } from '../core/spec.js';

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
    inputMin: mapping?.inputMin ?? 0,
    inputMax: mapping?.inputMax ?? 127,
    invert: Boolean(mapping?.invert),
  };
  render();
}

function render() {
  const { ctx, target, pedal, trigger, inputMin, inputMax, invert } = state;
  const pedals = ctx.state.globals.expressionPedals;
  const chosen = pedals.find((p) => p.id === pedal);
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
    <h3>Pedal</h3>
    <div class="radio-row">
      ${pedals.map((p) => `<button class="radio-card ${p.id === pedal ? 'active' : ''}" data-popup="pedal" data-id="${p.id}">
        <b>${escapeHtml(p.name)}</b><span class="muted small">${ctx.describeTrigger(p.trigger)}</span></button>`).join('')}
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
      <label>Pedal min</label><input data-popup="min" type="number" min="0" max="127" value="${inputMin}">
      <label>Pedal max</label><input data-popup="max" type="number" min="0" max="127" value="${inputMax}">
      <label><input data-popup="invert" type="checkbox" ${invert ? 'checked' : ''}> Invert</label>
    </div>
    <p class="small muted">The pedal's min/max are mapped onto the whole range of this parameter. Values outside the window are clamped.</p>
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
  if (el.dataset.popup === 'min') state.inputMin = Number(el.value);
  if (el.dataset.popup === 'max') state.inputMax = Number(el.value);
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
      const owner = ctx.pedalOwner(preset, pedalId);
      if (owner && owner !== key) {
        return fail(`${pedalId} is already assigned to ${ownerLabel(owner)} in this preset. Unassign it there first.`);
      }
      const modal = document.querySelector('#modal');
      const message = state.trigger ?? collectMessage();
      const inputMin = Number(modal.querySelector('[data-popup="min"]').value);
      const inputMax = Number(modal.querySelector('[data-popup="max"]').value);
      const invert = modal.querySelector('[data-popup="invert"]').checked;
      ctx.setExpressionTrigger(pedalId, message);
      ctx.setParamPedal(preset, target.block, target.paramIndex, {
        pedal: pedalId, inputMin, inputMax, invert,
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
