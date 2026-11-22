// Per-preset MIDI assignment editor. Shared by the Editor's assignment section.
import { BLOCKS, BLOCK_BY_ID, paramCcFor } from '../core/spec.js';
import { describeTrigger } from '../core/router.js';
import { effectiveStompLabel } from '../core/store.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderAssignments(ctx, assignments) {
  const footswitches = ctx.state.globals.footswitches;
  return `<h3>Virtual footswitches → FX blocks</h3>
    <p class="muted small">Incoming messages are configured in Globals. Each preset chooses its own button names and which blocks each button drives.</p>
    ${footswitches.map((fs) => {
      const binding = assignments.stomps.find((s) => s.fsId === fs.id) ?? { fsId: fs.id, mode: 'value', targets: [] };
      const mode = binding.mode ?? 'value';
      const fixed = binding.targets.find((t) => typeof t.value === 'number')?.value;
      return `<div class="binding">
        <div class="field">
          <label>${escapeHtml(fs.name)} · ${ctx.describeTrigger(fs.trigger)}</label>
          <input data-asg="stomp-label" data-fs="${fs.id}" placeholder="Button label" value="${escapeHtml(binding.label ?? '')}">
          <select data-asg="stomp-mode" data-fs="${fs.id}">
            <option value="value" ${mode === 'value' && fixed === undefined ? 'selected' : ''}>Incoming value</option>
            <option value="toggle" ${mode === 'toggle' ? 'selected' : ''}>Toggle</option>
            <option value="on" ${fixed === 127 ? 'selected' : ''}>Always ON</option>
            <option value="off" ${fixed === 0 ? 'selected' : ''}>Always OFF</option>
          </select>
        </div>
        <div class="field">
          ${BLOCKS.map((b) => `<label><input type="checkbox" data-asg="stomp-target" data-fs="${fs.id}" data-block="${b.id}" ${binding.targets.some((t) => t.block === b.id) ? 'checked' : ''}> ${b.name}</label>`).join('')}
        </div>
        <div class="muted small">${escapeHtml(assignmentSummary(fs, binding))}</div>
      </div>`;
    }).join('')}
    <h3>Expression pedals → parameters</h3>
    <p class="muted small">Each expression maps an incoming CC to one parameter CC on the NANOCORE.</p>
    ${assignments.expressions.map((expr, index) => `
      <div class="binding">
        <div class="field">
          <label>Expression ${index + 1}</label>
          <input data-asg="expr-cc" data-index="${index}" type="number" min="0" max="127" value="${expr.trigger?.number ?? 7}">
          <span class="muted small">${ctx.describeTrigger(expr.trigger)}</span>
          <button class="small danger" data-asg="remove-expr" data-index="${index}">Remove</button>
        </div>
        <div class="field">
          <label>Target</label>
          <select data-asg="expr-block" data-index="${index}">
            ${BLOCKS.map((b) => `<option value="${b.id}" ${expr.target === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
          <label>Param #</label>
          <input data-asg="expr-param" data-index="${index}" type="number" min="0" max="11" value="${expr.paramIndex ?? 0}">
          <label>Mode</label>
          <select data-asg="expr-mode" data-index="${index}">
            <option value="value" ${!(expr.invert || expr.mode === 'invert') ? 'selected' : ''}>Normal</option>
            <option value="invert" ${expr.invert || expr.mode === 'invert' ? 'selected' : ''}>Inverted</option>
          </select>
        </div>
        <div class="muted small">Sends CC ${paramCcFor(expr.target ?? 'fx1', expr.paramIndex ?? 0)}</div>
      </div>`).join('') || '<p class="muted small">No expression pedals assigned to this preset.</p>'}
    <button data-asg="add-expr">+ Add expression pedal</button>`;
}

function assignmentSummary(fs, binding) {
  const targets = binding.targets ?? [];
  if (!targets.length) return `${fs.name}: unassigned`;
  return `${fs.name}: ${targets.map((t) => `${BLOCK_BY_ID[t.block]?.name ?? t.block} → CC${BLOCK_BY_ID[t.block]?.onOffCc}${typeof t.value === 'number' ? ` = ${t.value}` : ''}`).join(', ')}`;
}

export function renderAssignmentTable(ctx, assignments) {
  return `<table><thead><tr><th>Virtual pedal</th><th>IN (controller)</th><th>OUT (NANOCORE)</th></tr></thead><tbody>
    ${ctx.state.globals.footswitches.map((fs) => {
      const binding = assignments.stomps.find((s) => s.fsId === fs.id);
      return `<tr><td>${escapeHtml(effectiveStompLabel(ctx.state, assignments, fs.id))}</td><td>${ctx.describeTrigger(fs.trigger)}</td><td>${
        (binding?.targets ?? []).map((t) => `${BLOCK_BY_ID[t.block]?.name}:CC${BLOCK_BY_ID[t.block]?.onOffCc}=${t.value ?? 'incoming'}`).join(', ') || '—'
      }</td></tr>`;
    }).join('')}
    ${assignments.expressions.map((e) => `<tr><td>${escapeHtml(e.id)}</td><td>CC ${e.trigger?.number}</td><td>CC ${paramCcFor(e.target, e.paramIndex ?? 0)} (${e.invert || e.mode === 'invert' ? 'inverted' : 'normal'})</td></tr>`).join('')}
  </tbody></table>`;
}

document.addEventListener('change', (event) => {
  const el = event.target;
  const ctx = window.__nanocoreCtx;
  if (!ctx || !el.dataset?.asg) return;
  const preset = ctx.state.activePreset;
  const assignments = ctx.assignments;
  const fs = el.dataset.fs;

  if (el.dataset.asg === 'stomp-label' || el.dataset.asg === 'stomp-mode' || el.dataset.asg === 'stomp-target') {
    const existing = assignments.stomps.find((s) => s.fsId === fs) ?? { fsId: fs, mode: 'value', targets: [] };
    let next = existing;
    if (el.dataset.asg === 'stomp-label') next = { ...existing, label: el.value };
    if (el.dataset.asg === 'stomp-mode') {
      const strip = (t) => { const copy = { ...t }; delete copy.value; return copy; };
      if (el.value === 'value') next = { ...existing, mode: 'value', targets: existing.targets.map(strip) };
      else if (el.value === 'toggle') next = { ...existing, mode: 'toggle', targets: existing.targets.map(strip) };
      else next = { ...existing, mode: 'value', targets: existing.targets.map((t) => ({ ...t, value: el.value === 'on' ? 127 : 0 })) };
    }
    if (el.dataset.asg === 'stomp-target') {
      const chosen = [...document.querySelectorAll(`[data-asg="stomp-target"][data-fs="${fs}"]:checked`)].map((box) => box.dataset.block);
      const fixed = existing.targets.find((t) => typeof t.value === 'number');
      next = { ...existing, targets: chosen.map((block) => ({ block, ...(fixed ? { value: fixed.value } : {}) })) };
    }
    ctx.upsertStomp(preset, fs, next);
    return;
  }

  const index = Number(el.dataset.index);
  const expressions = assignments.expressions.map((expr, i) => {
    if (i !== index) return expr;
    switch (el.dataset.asg) {
      case 'expr-cc': return { ...expr, trigger: { ...expr.trigger, number: Number(el.value) } };
      case 'expr-block': return { ...expr, target: el.value };
      case 'expr-param': return { ...expr, paramIndex: Number(el.value) };
      case 'expr-mode': return { ...expr, invert: el.value === 'invert', mode: el.value };
      default: return expr;
    }
  });
  ctx.setExpressions(preset, expressions);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-asg]');
  const ctx = window.__nanocoreCtx;
  if (!button || !ctx || !['add-expr', 'remove-expr'].includes(button.dataset.asg)) return;
  const preset = ctx.state.activePreset;
  const assignments = ctx.assignments;
  if (button.dataset.asg === 'add-expr') {
    ctx.setExpressions(preset, [...assignments.expressions, {
      id: `E${assignments.expressions.length + 1}`,
      trigger: { type: 'cc', channel: 1, number: 7 },
      target: 'fx1', paramIndex: 0, mode: 'value',
    }]);
  } else {
    ctx.setExpressions(preset, assignments.expressions.filter((_, i) => i !== Number(button.dataset.index)));
  }
});
