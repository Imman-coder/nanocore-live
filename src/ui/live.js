// Live view: a focused performance surface for the CURRENT NANOCORE preset.
// Editing belongs in the Editor; this view only presents and triggers.
import { BLOCK_BY_ID } from '../core/spec.js';
import { effectiveStompLabel } from '../core/store.js';
import { sceneStored, expressionRawToPercent, expressionRawFromRelative } from '../core/live.js';
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

const trackTemplate = (items) => (items ?? []).map((item) => `minmax(0, ${Math.max(1, Number(item?.grow) || 1)}fr)`).join(' ');

export function fitLiveBoard() {
  const wrap = document.querySelector('.live-board-wrap');
  const board = wrap?.querySelector('.live-board');
  if (!wrap || !board) return;
  board.style.width = '';
  board.style.height = '';
  board.style.transform = 'none';
  board.style.transformOrigin = 'center center';
  if (!document.body.classList.contains('live-fit-screen')) return;
  const availableWidth = wrap.clientWidth;
  const availableHeight = wrap.clientHeight;
  const naturalWidth = board.scrollWidth;
  const naturalHeight = board.scrollHeight;
  if (!availableWidth || !availableHeight || !naturalWidth || !naturalHeight) return;
  const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
  board.style.width = `${naturalWidth}px`;
  board.style.height = `${naturalHeight}px`;
  board.style.transformOrigin = 'center center';
  board.style.transform = `scale(${scale})`;
}

const cellTemplate = (el) => [...el.children]
  .map((cell) => `minmax(0, ${Math.max(1, Number(cell.dataset.grow) || 1)}fr)`).join(' ');

export function refreshLiveOrientation() {
  for (const cell of document.querySelectorAll('.live-grid-cell.placed')) {
    const meter = cell.querySelector?.('[data-expression-meter]');
    if (!meter) continue;
    const rect = cell.getBoundingClientRect();
    const vertical = rect.height > rect.width + 8;
    cell.classList.toggle('vertical-expression', vertical);
    meter.dataset.orientation = vertical ? 'vertical' : 'horizontal';
    if (vertical) {
      meter.classList.add('interactive');
      paintExpressionVisual(meter, Number(meter.getAttribute('aria-valuenow')) || 0);
    } else {
      paintExpressionVisual(meter, Number(meter.getAttribute('aria-valuenow')) || 0);
    }
  }
  for (const el of document.querySelectorAll('.live-board .live-row')) {
    const rect = el.getBoundingClientRect();
    const vertical = rect.height > rect.width + 8;
    el.classList.toggle('is-vertical', vertical);
    if (vertical) {
      el.style.gridTemplateRows = cellTemplate(el);
      el.style.gridTemplateColumns = '';
    } else {
      el.style.gridTemplateColumns = cellTemplate(el);
      el.style.gridTemplateRows = '';
    }
  }
  fitLiveBoard();
}

function displayOptions(ctx, selected) {
  const choices = [{ id: 'empty', label: 'Empty cell' }, { id: 'tap', label: 'Tap tempo' }];
  for (const key of ctx.sceneKeys()) choices.push({ id: `scene:${key}`, label: `Scene · ${ctx.sceneName(key)}` });
  for (const fs of ctx.state.globals.footswitches ?? []) choices.push({ id: `stomp:${fs.id}`, label: `Stomp · ${fs.name}` });
  for (const pedal of ctx.state.globals.expressionPedals ?? []) choices.push({ id: `expression:${pedal.id}`, label: `Expression · ${pedal.name}` });
  choices.push({ id: 'preset:dropdown', label: 'Preset · Dropdown' });
  for (let number = 1; number <= 64; number++) {
    choices.push({ id: `preset:${number}`, label: `Preset ${number} · ${ctx.presetLabel(number)}` });
  }
  return choices.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.label}</option>`).join('');
}

function renderLiveGrid(ctx, parts) {
  const grid = ctx.state.globals.liveLayout?.grid ?? { columns: 4, rows: 3, items: [] };
  const editing = Boolean(ctx.state.liveEditing);
  const occupied = new Set();
  const placed = (grid.items ?? []).map((item) => {
    const col = Math.max(1, Math.min(grid.columns, Number(item.col) || 1));
    const row = Math.max(1, Math.min(grid.rows, Number(item.row) || 1));
    const colSpan = Math.max(1, Math.min(grid.columns - col + 1, Number(item.colSpan) || 1));
    const rowSpan = Math.max(1, Math.min(grid.rows - row + 1, Number(item.rowSpan) || 1));
    for (let r = row; r < row + rowSpan; r++) for (let c = col; c < col + colSpan; c++) occupied.add(`${r}:${c}`);
    const key = item.kind === 'tap' ? 'tap' : `${item.kind}:${item.ref}`;
    const selected = item.kind === 'tap' ? 'tap' : `${item.kind}:${item.ref}`;
    return `<div class="live-grid-cell placed ${editing ? 'editing' : ''}" data-grid-item="${item.id}"
      data-grid-pos="${row}:${col}" ${editing ? 'draggable="true" title="Drag to move this tile"' : ''}
      style="grid-area:${row} / ${col} / span ${rowSpan} / span ${colSpan}">
      ${parts[key] ?? ''}
      ${editing ? `<select data-grid-cell-item="${item.id}">${displayOptions(ctx, selected)}</select>
        <span class="grid-resize col" data-resize="${item.id}" data-axis="col" title="Drag to change column span"></span>
        <span class="grid-resize row" data-resize="${item.id}" data-axis="row" title="Drag to change row span"></span>` : ''}
    </div>`;
  }).join('');
  const empty = [];
  for (let row = 1; row <= grid.rows; row++) {
    for (let col = 1; col <= grid.columns; col++) {
      if (occupied.has(`${row}:${col}`)) continue;
      empty.push(`<div class="live-grid-cell empty" data-grid-pos="${row}:${col}" style="grid-area:${row} / ${col}">
        ${editing ? `<select data-grid-cell="${row}:${col}">${displayOptions(ctx, 'empty')}</select>` : ''}
      </div>`);
    }
  }
  return `<div class="live-grid ${editing ? 'editing' : ''}"
    style="grid-template-columns:repeat(${grid.columns}, minmax(0, 1fr)); grid-template-rows:repeat(${grid.rows}, minmax(72px, 1fr))">
    ${empty.join('')}${placed}
  </div>`;
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
      : (ctx.state.globals.volumePedal === pedal.id
        ? 'Preset volume'
        : 'unassigned');
    const interactive = true;
    const initialRaw = ctx.expressionInitialValue(pedal.id);
    const initialPercent = expressionRawToPercent(initialRaw);
    const control = `<div class="meter expression-meter interactive"
        data-expression-meter="${pedal.id}" role="slider" tabindex="0" aria-label="${escapeHtml(pedal.name)} level"
        aria-valuemin="0" aria-valuemax="127" aria-valuenow="${initialRaw}">
        <i id="expr-meter-${pedal.id}" style="width:${initialPercent}%"></i>
      </div>
      <div class="stomp-cc" id="expr-value-${pedal.id}">${initialPercent}%</div>`;
    const html = `<div class="stomp expression-stomp ${expr || ctx.state.globals.volumePedal === pedal.id ? '' : 'muted'}">
      <div class="stomp-label">${escapeHtml(pedal.name)}</div>
      <div class="stomp-cc">${ctx.describeTrigger(pedal.trigger)} → ${escapeHtml(target)}</div>
      ${control}
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

  const presetDropdown = `<div class="stomp preset-stomp">
      <div class="stomp-label">Preset</div>
      <select data-preset-select="1" aria-label="Select preset">${presetOptions(ctx, preset)}</select>
    </div>`;
  const presetButtons = Object.fromEntries(Array.from({ length: 64 }, (_, index) => index + 1)
    .map((number) => [number, `<button class="stomp scene-stomp" data-action="recall-preset" data-preset="${number}">
      <span class="stomp-label">${escapeHtml(ctx.presetLabel(number))}</span>
      <span class="stomp-cc">#${number}</span>
    </button>`]));
  const parts = {
    tap: `<div class="stomp-grid">${tapTempo}</div>`,
    'preset:dropdown': presetDropdown,
    ...Object.fromEntries(Object.entries(presetButtons).map(([key, html]) => [`preset:${key}`, html])),
    ...Object.fromEntries(Object.entries(scenes).map(([id, html]) => [`scene:${id}`, html])),
    ...Object.fromEntries(Object.entries(stomps).map(([id, html]) => [`stomp:${id}`, html])),
    ...Object.fromEntries(Object.entries(expressions).map(([id, html]) => [`expression:${id}`, html])),
  };
  const grid = ctx.state.globals.liveLayout?.grid ?? { columns: 4, rows: 3, items: [] };
  const editing = Boolean(ctx.state.liveEditing);
  const controls = editing
    ? `<div class="field">
        <label>Columns <input data-grid-size="columns" type="number" min="1" max="64" value="${grid.columns}"></label>
        <label>Rows <input data-grid-size="rows" type="number" min="1" max="64" value="${grid.rows}"></label>
        <button class="primary" data-action="toggle-live-edit">Done editing</button>
        <span class="muted small">Pick items in empty cells; drag the right/bottom edge of a tile to span more cells.</span>
      </div>`
    : '';
  const header = ctx.state.globals.hideLivePresetLabel
    ? ''
    : `<h2>Live <span class="muted small">— NANOCORE preset ${preset}</span></h2>`;
  const assignmentsButton = ctx.state.globals.hideAssignmentsButton
    ? ''
    : `<p style="margin-top:18px">
        <button class="ghost" data-action="toggle-advanced">${ctx.state.showAdvanced ? 'Hide' : 'Show'} parameter assignments</button>
      </p>`;
  return `${header}
    ${controls}
    <div class="live-board-wrap"><div class="live-board">${renderLiveGrid(ctx, parts)}</div></div>
    ${assignmentsButton}
    ${advanced}`;
}

let draggedExpressionId = null;
let expressionDragStart = null;

function currentExpressionMeter() {
  if (!draggedExpressionId) return null;
  const escaped = CSS.escape ? CSS.escape(draggedExpressionId) : draggedExpressionId;
  return document.querySelector(`[data-expression-meter="${escaped}"]`);
}

function paintExpressionVisual(meter, value) {
  meter.setAttribute('aria-valuenow', String(value));
  const percent = Math.round((value / 127) * 100);
  const id = meter.dataset.expressionMeter;
  const label = document.getElementById(`expr-value-${id}`);
  const fill = document.getElementById(`expr-meter-${id}`);
  if (label) label.textContent = `${percent}%`;
  if (!fill) return;
  if (meter.dataset.orientation === 'vertical') {
    fill.style.width = '100%';
    fill.style.height = `${percent}%`;
  } else {
    fill.style.height = '';
    fill.style.width = `${percent}%`;
  }
}

function paintExpression(meter, value) {
  paintExpressionVisual(meter, value);
  window.__nanocoreCtx?.sendExpression(meter.dataset.expressionMeter, value);
}

function setExpressionFromPointer(meter, clientX, clientY) {
  const rect = meter.getBoundingClientRect();
  const vertical = meter.dataset.orientation === 'vertical';
  if (!vertical && !rect.width) return;
  if (vertical && !rect.height) return;
  const value = vertical
    ? Math.max(0, Math.min(127, Math.round(((rect.bottom - clientY) / rect.height) * 127)))
    : Math.max(0, Math.min(127, Math.round(((clientX - rect.left) / rect.width) * 127)));
  paintExpression(meter, value);
}

document.addEventListener('pointerdown', (event) => {
  const meter = event.target.closest?.('[data-expression-meter].interactive');
  if (!meter?.dataset.expressionMeter) return;
  event.preventDefault();
  draggedExpressionId = meter.dataset.expressionMeter;
  expressionDragStart = {
    x: event.clientX,
    y: event.clientY,
    value: Number(meter.getAttribute('aria-valuenow')) || 0,
    vertical: meter.dataset.orientation === 'vertical',
  };
  try { meter.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer */ }
  if (window.__nanocoreCtx?.state.globals.absoluteExpression) {
    setExpressionFromPointer(meter, event.clientX, event.clientY);
  }
});

document.addEventListener('pointermove', (event) => {
  // A device write can re-render Live mid-drag; find the current meter rather
  // than holding a detached node whose rect is zero.
  const meter = currentExpressionMeter();
  if (!meter) return;
  const ctx = window.__nanocoreCtx;
  if (ctx?.state.globals.absoluteExpression) {
    setExpressionFromPointer(meter, event.clientX, event.clientY);
    return;
  }
  if (!expressionDragStart) return;
  const start = expressionDragStart;
  const vertical = start.vertical || meter.dataset.orientation === 'vertical';
  const rect = meter.getBoundingClientRect();
  const span = vertical ? rect.height : rect.width;
  const delta = vertical ? start.y - event.clientY : event.clientX - start.x;
  paintExpression(meter, expressionRawFromRelative(start.value, delta, span || 200));
});

document.addEventListener('pointerup', () => { draggedExpressionId = null; expressionDragStart = null; });
document.addEventListener('pointercancel', () => { draggedExpressionId = null; expressionDragStart = null; });

document.addEventListener('dragstart', (event) => {
  const cell = event.target.closest?.('.live-grid-cell.placed.editing');
  if (!cell) return;
  event.dataTransfer?.setData('text/plain', cell.dataset.gridItem);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  cell.classList.add('dragging');
});
document.addEventListener('dragend', (event) => {
  event.target.closest?.('.live-grid-cell')?.classList.remove('dragging');
});
document.addEventListener('dragover', (event) => {
  if (!window.__nanocoreCtx?.state.liveEditing) return;
  if (!event.target.closest?.('.live-grid-cell')) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
});
document.addEventListener('drop', (event) => {
  const cell = event.target.closest?.('.live-grid-cell');
  if (!cell || !window.__nanocoreCtx?.state.liveEditing) return;
  event.preventDefault();
  const id = event.dataTransfer?.getData('text/plain');
  const [row, col] = (cell.dataset.gridPos ?? '').split(':').map(Number);
  if (id && row && col) window.__nanocoreCtx.moveLiveGridItem(id, row, col);
});

let gridTouchMove = null;
document.addEventListener('pointerdown', (event) => {
  if (!window.__nanocoreCtx?.state.liveEditing) return;
  if (event.pointerType === 'mouse') return;
  if (event.target.closest?.('[data-resize], select, input')) return;
  const cell = event.target.closest?.('.live-grid-cell.placed.editing');
  if (!cell) return;
  gridTouchMove = { id: cell.dataset.gridItem, x: event.clientX, y: event.clientY, moved: false };
});
document.addEventListener('pointermove', (event) => {
  if (!gridTouchMove) return;
  if (Math.hypot(event.clientX - gridTouchMove.x, event.clientY - gridTouchMove.y) < 10) return;
  gridTouchMove.moved = true;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.live-grid-cell');
  for (const el of document.querySelectorAll('.live-grid-cell.drop-target')) el.classList.remove('drop-target');
  if (target) target.classList.add('drop-target');
});
document.addEventListener('pointerup', (event) => {
  if (!gridTouchMove) return;
  const move = gridTouchMove;
  gridTouchMove = null;
  for (const el of document.querySelectorAll('.live-grid-cell.drop-target')) el.classList.remove('drop-target');
  if (!move.moved) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.live-grid-cell');
  const [row, col] = (target?.dataset.gridPos ?? '').split(':').map(Number);
  if (row && col) window.__nanocoreCtx.moveLiveGridItem(move.id, row, col);
});

let gridResizing = null;
document.addEventListener('pointerdown', (event) => {
  const handle = event.target.closest?.('[data-resize]');
  if (!handle) return;
  event.preventDefault();
  event.stopPropagation();
  const ctx = window.__nanocoreCtx;
  const item = ctx?.liveGridItem?.(handle.dataset.resize);
  if (!item) return;
  const gridEl = document.querySelector('.live-grid');
  const cols = ctx.state.globals.liveLayout.grid.columns;
  const rows = ctx.state.globals.liveLayout.grid.rows;
  const rect = gridEl.getBoundingClientRect();
  gridResizing = {
    id: item.id, axis: handle.dataset.axis, x: event.clientX, y: event.clientY,
    span: handle.dataset.axis === 'col' ? (item.colSpan || 1) : (item.rowSpan || 1),
    cellW: rect.width / cols, cellH: rect.height / rows,
    cols, rows, col: item.col, row: item.row,
  };
});
document.addEventListener('pointerup', (event) => {
  if (!gridResizing) return;
  const ctx = window.__nanocoreCtx;
  const r = gridResizing;
  const delta = r.axis === 'col'
    ? Math.round((event.clientX - r.x) / r.cellW)
    : Math.round((event.clientY - r.y) / r.cellH);
  const limit = r.axis === 'col' ? r.cols - r.col + 1 : r.rows - r.row + 1;
  ctx?.setLiveGridItem?.(r.id, { [r.axis === 'col' ? 'colSpan' : 'rowSpan']: Math.max(1, Math.min(limit, r.span + delta)) });
  gridResizing = null;
});

document.addEventListener('keydown', (event) => {
  const meter = event.target.closest?.('[data-expression-meter].interactive');
  if (!meter || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -5 : 5;
  const value = Math.max(0, Math.min(127, Number(meter.getAttribute('aria-valuenow')) + step));
  paintExpression(meter, value);
});
