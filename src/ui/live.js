// Live view: a focused performance surface for the CURRENT NANOCORE preset.
// Editing belongs in the Editor; this view only presents and triggers.
import { BLOCK_BY_ID } from '../core/spec.js';
import { effectiveStompLabel } from '../core/store.js';
import { sceneStored } from '../core/live.js';
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

function renderLiveNode(node, parts) {
  if (!node || node.type === 'empty') return '<div class="live-slot empty"></div>';
  if (node.type === 'item') {
    const key = node.kind === 'tap' ? 'tap' : `${node.kind}:${node.id}`;
    return parts[key] ?? '<div class="live-slot empty"></div>';
  }
  if (node.type === 'row' || node.type === 'column') {
    return `<div class="live-${node.type}">${(node.items ?? []).map((child) => renderLiveNode(child, parts)).join('')}</div>`;
  }
  return '<div class="live-slot empty"></div>';
}

export function renderLive(ctx) {
  const preset = ctx.state.activePreset;
  const assignments = ctx.assignments;
  const stomps = Object.fromEntries(ctx.state.globals.footswitches.map((fs) => {
    const binding = assignments.stomps.find((s) => s.fsId === fs.id);
    const targets = binding?.targets ?? [];
    const summary = targets.length
      ? targets.map((t) => `${BLOCK_BY_ID[t.block]?.name ?? t.block}${typeof t.value === 'number' ? `=${t.value}` : ''}`).join(', ')
      : 'unassigned';
    const html = `<button class="stomp ${ctx.stompActive(fs.id) ? 'on' : ''}" data-action="stomp" data-fs="${fs.id}" aria-pressed="${ctx.stompActive(fs.id)}" title="Click to toggle the assigned FX on or off">
      <span class="stomp-label">${escapeHtml(effectiveStompLabel(ctx.state, assignments, fs.id))}</span>
      <span class="stomp-cc">${escapeHtml(fs.name)} · ${ctx.describeTrigger(fs.trigger)}</span>
      <span class="stomp-cc">${escapeHtml(summary)}</span>
    </button>`;
    return [fs.id, html];
  }));
  const tempo = ctx.state.globals.tempo ?? { bpm: null };
  const tapTempo = `<button class="stomp scene-stomp" data-action="tap-tempo">
      <span class="stomp-label">Tap tempo</span>
      <span class="stomp-cc">${tempo.bpm ? `${tempo.bpm} BPM · tap to retap` : 'tap to set BPM'}</span>
    </button>`;

  const expressions = Object.fromEntries((ctx.state.globals.expressionPedals ?? []).map((pedal) => {
    const expr = assignments.expressions.find((e) => e.id === pedal.id);
    const target = expr
      ? `${BLOCK_BY_ID[expr.target]?.name ?? expr.target} param ${expr.paramIndex ?? 0}`
      : 'unassigned';
    const html = `<div class="stomp expression-stomp ${expr ? '' : 'muted'}">
      <div class="stomp-label">${escapeHtml(pedal.name)}</div>
      <div class="stomp-cc">${ctx.describeTrigger(pedal.trigger)} → ${escapeHtml(target)}</div>
      <div class="meter expression-meter ${expr && ctx.state.globals.interactiveLive ? 'interactive' : ''}"
        data-expression-meter="${pedal.id}" role="slider" tabindex="0" aria-label="${escapeHtml(pedal.name)} level"
        aria-valuemin="0" aria-valuemax="127" aria-valuenow="0">
        <i id="expr-meter-${pedal.id}" style="width:0%"></i>
      </div>
      <div class="stomp-cc" id="expr-value-${pedal.id}">0%</div>
    </div>`;
    return [pedal.id, html];
  }));

  const scenes = Object.fromEntries(ctx.sceneKeys().map((name) => {
    const active = ctx.state.activeScene === name;
    const stored = sceneStored(assignments, name);
    const detail = !stored ? 'empty' : name === 'base'
      ? (ctx.baseOverridden() ? 'saved values' : 'pedal values')
      : `${Object.keys(assignments.scenes?.[name] ?? {}).length} values · ${Object.keys(assignments.sceneEnabled?.[name] ?? {}).length} fx`;
    const html = `<button class="stomp scene-stomp ${active ? 'on' : ''} ${stored ? '' : 'empty'}" data-action="scene" data-scene="${name}" aria-pressed="${active}" ${stored ? '' : 'disabled aria-disabled="true"'}>
      <span class="stomp-label">${escapeHtml(ctx.sceneName(name))}</span>
      <span class="stomp-cc">${active ? 'Active · ' : ''}${escapeHtml(detail)}</span>
    </button>`;
    return [name, html];
  }));

  const advanced = ctx.state.showAdvanced ? `<div class="card">
    <h3>Advanced — raw assignments</h3>
    ${renderAssignmentTable(ctx, assignments)}
    <p class="muted small">Controller ports: ${(ctx.ports.inputs ?? []).filter((p) => p.role === 'controller').map((p) => escapeHtml(p.name)).join(', ') || 'none'}</p>
  </div>` : '';

  const parts = {
    tap: `<div class="stomp-grid">${tapTempo}</div>`,
    ...Object.fromEntries(Object.entries(scenes).map(([id, html]) => [`scene:${id}`, html])),
    ...Object.fromEntries(Object.entries(stomps).map(([id, html]) => [`stomp:${id}`, html])),
    ...Object.fromEntries(Object.entries(expressions).map(([id, html]) => [`expression:${id}`, html])),
  };
  const layout = ctx.state.globals.liveLayout;
  return `<h2>Live <span class="muted small">— NANOCORE preset ${preset}</span></h2>
    <div class="live-board">${renderLiveNode(layout?.root, parts)}</div>
    <p style="margin-top:18px">
      <button class="ghost" data-action="edit-live-layout">Arrange live board</button>
      <button class="ghost" data-action="toggle-advanced">${ctx.state.showAdvanced ? 'Hide' : 'Show'} parameter assignments</button>
    </p>
    ${advanced}`;
}

let draggedExpression = null;

function setExpressionFromPointer(meter, clientX) {
  const rect = meter.getBoundingClientRect();
  if (!rect.width) return;
  const value = Math.max(0, Math.min(127, Math.round(((clientX - rect.left) / rect.width) * 127)));
  meter.setAttribute('aria-valuenow', String(value));
  window.__nanocoreCtx?.sendExpression(meter.dataset.expressionMeter, value);
}

document.addEventListener('pointerdown', (event) => {
  const meter = event.target.closest?.('[data-expression-meter].interactive');
  if (!meter) return;
  event.preventDefault();
  draggedExpression = meter;
  try { meter.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer */ }
  setExpressionFromPointer(meter, event.clientX);
});

document.addEventListener('pointermove', (event) => {
  if (!draggedExpression) return;
  setExpressionFromPointer(draggedExpression, event.clientX);
});

document.addEventListener('pointerup', () => { draggedExpression = null; });

document.addEventListener('keydown', (event) => {
  const meter = event.target.closest?.('[data-expression-meter].interactive');
  if (!meter || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -5 : 5;
  const value = Math.max(0, Math.min(127, Number(meter.getAttribute('aria-valuenow')) + step));
  meter.setAttribute('aria-valuenow', String(value));
  window.__nanocoreCtx?.sendExpression(meter.dataset.expressionMeter, value);
});
