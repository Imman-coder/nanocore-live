// Live view: a focused performance surface for the CURRENT NANOCORE preset.
// Editing belongs in the Editor; this view only presents and triggers.
import { BLOCK_BY_ID } from '../core/spec.js';
import { effectiveStompLabel } from '../core/store.js';
import { renderAssignmentTable } from './assignments.js';
import { presetOptions } from './editor.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderLiveSidebar(ctx) {
  const preset = ctx.state.activePreset;
  const assigned = Object.keys(ctx.state.presets)
    .map(Number)
    .sort((a, b) => a - b)
    .filter((n) => {
      const a = ctx.state.presets[String(n)];
      return a?.stomps?.length || a?.expressions?.length;
    });
  return `<h2>NANOCORE</h2>
    <div class="card" style="text-align:center">
      <div class="muted small">Current NANOCORE preset</div>
      <select id="preset-select" style="width:100%">${presetOptions(ctx, preset)}</select>
      <div class="small">${escapeHtml(ctx.assignments.name)}</div>
      <div class="row-actions" style="justify-content:center">
        <button data-action="step-preset" data-delta="-1">◀</button>
        <button data-action="recall-preset" data-preset="${preset}">Recall</button>
        <button data-action="step-preset" data-delta="1">▶</button>
      </div>
    </div>
    <h3>Presets with assignments</h3>
    ${assigned.map((n) => `<div class="row-card" data-action="recall-preset" data-preset="${n}">
      <div class="row-title"><b>${escapeHtml(ctx.state.presets[String(n)].name ?? `Preset ${n}`)}</b><span class="pill">${n}</span></div>
    </div>`).join('') || '<p class="muted small">Add assignments in the Editor.</p>'}
    <p class="muted small">Live is a focused view. Button labels and MIDI assignments are edited per NANOCORE preset in the Editor.</p>`;
}

export function renderLive(ctx) {
  const preset = ctx.state.activePreset;
  const assignments = ctx.assignments;
  const stomps = ctx.state.globals.footswitches.map((fs) => {
    const binding = assignments.stomps.find((s) => s.fsId === fs.id);
    const targets = binding?.targets ?? [];
    const summary = targets.length
      ? targets.map((t) => `${BLOCK_BY_ID[t.block]?.name ?? t.block}${typeof t.value === 'number' ? `=${t.value}` : ''}`).join(', ')
      : 'unassigned';
    return `<button class="stomp" data-action="stomp" data-fs="${fs.id}" title="Click to trigger the same action as the footswitch">
      <span class="stomp-label">${escapeHtml(effectiveStompLabel(ctx.state, assignments, fs.id))}</span>
      <span class="stomp-cc">${escapeHtml(fs.name)} · ${ctx.describeTrigger(fs.trigger)}</span>
      <span class="stomp-cc">${escapeHtml(summary)}</span>
    </button>`;
  }).join('');

  const expressions = assignments.expressions.map((expr, index) => `
    <div class="binding">
      <div class="field"><b>Expression ${index + 1}</b><span class="muted small">${ctx.describeTrigger(expr.trigger)} → ${BLOCK_BY_ID[expr.target]?.name ?? expr.target} param ${expr.paramIndex ?? 0}</span></div>
      <div class="meter"><i id="expr-meter-${index}" style="width:${Math.round(expr.lastValue ?? 0)}%"></i></div>
    </div>`).join('') || '<p class="muted small">No expression pedals assigned to this preset.</p>';

  const advanced = ctx.state.showAdvanced ? `<div class="card">
    <h3>Advanced — raw assignments</h3>
    ${renderAssignmentTable(ctx, assignments)}
    <p class="muted small">Controller ports: ${(ctx.ports.inputs ?? []).filter((p) => p.role === 'controller').map((p) => escapeHtml(p.name)).join(', ') || 'none'}</p>
  </div>` : '';

  return `<h2>Live <span class="muted small">— NANOCORE preset ${preset}</span></h2>
    <h3>Virtual footswitches</h3>
    <div class="stomp-grid">${stomps}</div>
    <h3>Expression pedals</h3>
    ${expressions}
    <p style="margin-top:18px">
      <button class="ghost" data-action="toggle-advanced">${ctx.state.showAdvanced ? 'Hide' : 'Show'} parameter assignments</button>
      <button class="ghost" data-mode="editor">Open editor / assignments</button>
    </p>
    ${advanced}`;
}
