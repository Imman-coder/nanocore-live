<script>
  // Live board: explicit CSS grid of individually placed performance items.
  // Editing supports HTML5 drag for mouse and a pointer fallback for touch/pen.
  import { onDestroy } from 'svelte';
  import { stateView, snapshotView, feedbackView, uiView, ctx as engineCtx } from '../engine.js';
  import ExpressionFader from './ExpressionFader.svelte';
  import { sceneStored } from '../../core/live.js';
  import { effectiveStompLabel } from '../../core/store.js';

  export let ctx = engineCtx;

  let gridEl;
  let dragId = null;
  let gridTouch = null;
  let resizing = null;
  let dropTarget = null;

  $: state = $stateView ?? {};
  $: globals = state.globals ?? {};
  $: layout = globals.liveLayout?.grid ?? { columns: 4, rows: 3, items: [] };
  $: columns = Math.max(1, Math.min(64, Number(layout.columns) || 4));
  $: rows = Math.max(1, Math.min(64, Number(layout.rows) || 3));
  $: editing = Boolean(state.liveEditing);
  $: assignments = ($stateView, ctx.assignments);
  $: scenes = ctx.sceneKeys().map((key) => ({
    key, name: ctx.sceneName(key), stored: sceneStored(assignments, key),
  }));
  $: stomps = (globals.footswitches ?? []).map((fs) => ({
    ...fs, label: effectiveStompLabel($stateView, assignments, fs.id), active: ctx.stompActive(fs.id),
  }));
  $: pedals = globals.expressionPedals ?? [];
  $: presets = ($stateView, Array.from({ length: 64 }, (_, index) => index + 1)
    .map((number) => ({ number, label: ctx.presetLabel(number) })));
  $: placed = (layout.items ?? []).map((item) => {
    const col = Math.max(1, Math.min(columns, Number(item.col) || 1));
    const row = Math.max(1, Math.min(rows, Number(item.row) || 1));
    return {
      ...item,
      col, row,
      colSpan: Math.max(1, Math.min(columns - col + 1, Number(item.colSpan) || 1)),
      rowSpan: Math.max(1, Math.min(rows - row + 1, Number(item.rowSpan) || 1)),
    };
  });
  $: occupied = new Set(placed.flatMap((item) => {
    const cells = [];
    for (let r = item.row; r < item.row + item.rowSpan; r++) {
      for (let c = item.col; c < item.col + item.colSpan; c++) cells.push(`${r}:${c}`);
    }
    return cells;
  }));
  $: empties = (() => {
    const result = [];
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= columns; col++) {
        if (!occupied.has(`${row}:${col}`)) result.push({ row, col });
      }
    }
    return result;
  })();
  $: choices = [
    { id: 'empty', label: 'Empty cell' },
    { id: 'tap', label: 'Tap tempo' },
    ...scenes.map((scene) => ({ id: `scene:${scene.key}`, label: `Scene · ${scene.name}` })),
    ...stomps.map((fs) => ({ id: `stomp:${fs.id}`, label: `Stomp · ${fs.name}` })),
    ...pedals.map((pedal) => ({ id: `expression:${pedal.id}`, label: `Expression · ${pedal.name}` })),
    { id: 'preset:dropdown', label: 'Preset · Dropdown' },
    ...presets.map((preset) => ({ id: `preset:${preset.number}`, label: `Preset ${preset.number} · ${preset.label}` })),
  ];

  function clearHighlight() { dropTarget = null; }

  function cellAt(x, y) {
    const cell = document.elementFromPoint(x, y)?.closest?.('[data-grid-pos]');
    const parts = (cell?.dataset.gridPos ?? '').split(':').map(Number);
    return parts.length === 2 && parts[0] && parts[1] ? { row: parts[0], col: parts[1] } : null;
  }

  function onCellSelect(item, event) {
    const value = event.currentTarget.value;
    if (value === 'empty') return ctx.setLiveGridItem(item.id, { kind: 'empty' });
    const [kind, ref] = value.includes(':') ? value.split(':') : [value, undefined];
    ctx.setLiveGridItem(item.id, { kind, ...(ref !== undefined ? { ref } : {}) });
  }

  function onEmptySelect(cell, event) {
    ctx.setLiveGridCell(`${cell.row}:${cell.col}`, event.currentTarget.value);
  }

  function onDragStart(event, item) {
    if (!editing) return;
    event.dataTransfer?.setData('text/plain', item.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    dragId = item.id;
  }

  function onDragOver(event) {
    if (!editing || !dragId) return;
    const cell = event.target.closest?.('[data-grid-pos]');
    if (!cell) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropTarget = cell.dataset.gridPos ?? null;
  }

  function onDrop(event) {
    if (!editing) return;
    event.preventDefault();
    const cell = event.target.closest?.('[data-grid-pos]');
    const id = event.dataTransfer?.getData('text/plain') || dragId;
    const parts = (cell?.dataset.gridPos ?? '').split(':').map(Number);
    if (id && parts[0] && parts[1]) ctx.moveLiveGridItem(id, parts[0], parts[1]);
    dragId = null;
    clearHighlight();
  }

  function onCellPointerDown(event, item) {
    if (!editing || event.pointerType === 'mouse') return;
    if (event.target.closest?.('[data-resize], select, input, button')) return;
    gridTouch = { id: item.id, x: event.clientX, y: event.clientY, moved: false };
    window.addEventListener('pointermove', onTouchMove);
    window.addEventListener('pointerup', onTouchUp);
    window.addEventListener('pointercancel', onTouchCancel);
  }

  function onTouchMove(event) {
    if (!gridTouch) return;
    if (!gridTouch.moved && Math.hypot(event.clientX - gridTouch.x, event.clientY - gridTouch.y) < 10) return;
    gridTouch.moved = true;
    const target = cellAt(event.clientX, event.clientY);
    dropTarget = target ? `${target.row}:${target.col}` : null;
  }

  function detachTouch() {
    window.removeEventListener('pointermove', onTouchMove);
    window.removeEventListener('pointerup', onTouchUp);
    window.removeEventListener('pointercancel', onTouchCancel);
  }

  function onTouchUp(event) {
    if (!gridTouch) return;
    const move = gridTouch;
    gridTouch = null;
    detachTouch();
    clearHighlight();
    if (!move.moved) return;
    const target = cellAt(event.clientX, event.clientY);
    if (target) ctx.moveLiveGridItem(move.id, target.row, target.col);
  }

  function onTouchCancel() {
    gridTouch = null;
    detachTouch();
    clearHighlight();
  }

  function onResizeDown(event, item, axis) {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = gridEl?.getBoundingClientRect();
    if (!rect) return;
    resizing = {
      id: item.id, axis, x: event.clientX, y: event.clientY,
      span: axis === 'col' ? item.colSpan : item.rowSpan,
      cellW: rect.width / columns, cellH: rect.height / rows,
      columns, rows, col: item.col, row: item.row,
    };
    window.addEventListener('pointerup', onResizeUp);
    window.addEventListener('pointercancel', onResizeUp);
  }

  function onResizeUp(event) {
    if (!resizing) return;
    const current = resizing;
    resizing = null;
    window.removeEventListener('pointerup', onResizeUp);
    window.removeEventListener('pointercancel', onResizeUp);
    const delta = current.axis === 'col'
      ? Math.round((event.clientX - current.x) / current.cellW)
      : Math.round((event.clientY - current.y) / current.cellH);
    const limit = current.axis === 'col' ? current.columns - current.col + 1 : current.rows - current.row + 1;
    const span = Math.max(1, Math.min(limit, current.span + delta));
    ctx.setLiveGridItem(current.id, { [current.axis === 'col' ? 'colSpan' : 'rowSpan']: span });
  }

  onDestroy(() => {
    detachTouch();
    clearHighlight();
    window.removeEventListener('pointerup', onResizeUp);
    window.removeEventListener('pointercancel', onResizeUp);
  });
</script>

<div
  class="grid h-full w-full min-h-[240px] gap-1 {editing ? 'touch-none' : ''}"
  bind:this={gridEl}
  style="grid-template-columns: repeat({columns}, minmax(0, 1fr)); grid-template-rows: repeat({rows}, minmax(72px, 1fr))"
  on:dragover={onDragOver}
  on:drop={onDrop}
  role="list"
  aria-label="Live performance grid"
>
  {#each empties as cell (`${cell.row}:${cell.col}`)}
    <div
      class="relative min-h-0 min-w-0 rounded-box border border-dashed border-base-300 p-1 {dropTarget === `${cell.row}:${cell.col}` ? 'outline outline-2 outline-[#6bf]' : ''} {editing ? 'touch-none' : ''}"
      role="listitem"
      data-grid-pos={`${cell.row}:${cell.col}`}
      style:grid-area={`${cell.row} / ${cell.col}`}
    >
      {#if editing}
        <select data-grid-cell={`${cell.row}:${cell.col}`} class="w-full text-base select select-bordered select-sm" value="empty" aria-label={`Item at row ${cell.row}, column ${cell.col}`}
          on:change={(event) => onEmptySelect(cell, event)}>
          {#each choices as choice (choice.id)}
            <option value={choice.id}>{choice.label}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/each}

  {#each placed as item (item.id)}
    <div
      class="relative min-h-0 min-w-0 rounded-box border border-solid border-base-300 p-1 {dropTarget === `${item.row}:${item.col}` ? 'outline outline-2 outline-[#6bf]' : ''} {editing ? 'touch-none' : ''}"
      role="listitem"
      data-grid-item={item.id}
      data-grid-pos={`${item.row}:${item.col}`}
      draggable={editing}
      style:grid-area={`${item.row} / ${item.col} / span ${item.rowSpan} / span ${item.colSpan}`}
      on:dragstart={(event) => onDragStart(event, item)}
      on:dragend={() => { dragId = null; }}
      on:pointerdown={(event) => onCellPointerDown(event, item)}
    >
      {#if item.kind === 'tap'}
        <button class="flex h-full min-h-0 w-full flex-col gap-1 rounded-box border border-base-300 bg-base-200 p-2.5 text-left font-[inherit] text-inherit cursor-pointer hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" disabled={editing} on:click={() => ctx.tapTempo()}>
          <span class="font-bold">Tap tempo</span>
          <span class="overflow-hidden text-ellipsis text-[11px] text-base-content/60">{globals.tempo?.bpm ? `${globals.tempo.bpm} BPM · tap to retap` : 'tap to set BPM'}</span>
        </button>
      {:else if item.kind === 'scene'}
        {@const scene = scenes.find((entry) => entry.key === item.ref)}
        <button class="flex h-full min-h-0 w-full flex-col gap-1 rounded-box border border-base-300 bg-base-200 p-2.5 text-left font-[inherit] text-inherit cursor-pointer hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {state.activeScene === item.ref ? '!border-secondary' : ''}" aria-pressed={state.activeScene === item.ref}
          disabled={editing || !scene?.stored} on:click={() => ctx.recallScene(item.ref)}>
          <span class="font-bold">{scene?.name ?? item.ref}</span>
          <span class="overflow-hidden text-ellipsis text-[11px] text-base-content/60">{state.activeScene === item.ref ? 'Active · ' : ''}{!scene?.stored ? 'empty' : item.ref === 'base' ? (ctx.baseOverridden() ? 'saved values' : 'pedal values') : 'stored scene'}</span>
        </button>
      {:else if item.kind === 'stomp'}
        {@const fs = stomps.find((entry) => entry.id === item.ref)}
        <button class="flex h-full min-h-0 w-full flex-col gap-1 rounded-box border border-base-300 bg-base-200 p-2.5 text-left font-[inherit] text-inherit cursor-pointer hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {fs?.active ? '!border-secondary' : ''}" aria-pressed={Boolean(fs?.active)} disabled={editing} on:click={() => ctx.toggleStomp(item.ref)}>
          <span class="font-bold">{fs?.label ?? item.ref}</span>
          <span class="overflow-hidden text-ellipsis text-[11px] text-base-content/60">{fs?.name ?? item.ref} · {fs ? ctx.describeTrigger(fs.trigger) : ''}</span>
        </button>
      {:else if item.kind === 'expression'}
        {@const pedal = pedals.find((entry) => entry.id === item.ref)}
        {#if pedal}
          <ExpressionFader {pedal} {ctx} {editing} />
        {:else}
          <div class="flex h-full min-h-0 w-full flex-col gap-1 rounded-box bg-base-200 p-2.5 text-left text-base-content/60 opacity-55"><div class="font-bold">{item.ref}</div><div class="overflow-hidden text-ellipsis text-[11px] text-base-content/60">no such pedal</div></div>
        {/if}
      {:else if item.kind === 'preset' && item.ref === 'dropdown'}
        <div class="flex h-full min-h-0 w-full flex-col gap-1 rounded-box bg-base-200 p-2.5 text-left">
          <div class="font-bold">Preset</div>
          <select data-preset-select="1" class="w-full text-base select select-bordered select-sm" aria-label="Select preset" value={state.activePreset} disabled={editing}
            on:change={(event) => ctx.recallPreset(Number(event.currentTarget.value))}>
            {#each presets as preset (preset.number)}
              <option value={preset.number} selected={preset.number === state.activePreset}>{preset.number} · {preset.label}</option>
            {/each}
          </select>
        </div>
      {:else if item.kind === 'preset'}
        {@const preset = presets.find((entry) => entry.number === Number(item.ref))}
        <button class="flex h-full min-h-0 w-full flex-col gap-1 rounded-box border border-base-300 bg-base-200 p-2.5 text-left font-[inherit] text-inherit cursor-pointer hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" disabled={editing} on:click={() => ctx.recallPreset(Number(item.ref))}>
          <span class="font-bold">{preset?.label ?? `Preset ${item.ref}`}</span>
          <span class="overflow-hidden text-ellipsis text-[11px] text-base-content/60">#{item.ref}</span>
        </button>
      {/if}

      {#if editing}
        <select data-grid-cell-item={item.id} class="absolute left-0.5 right-0.5 top-0.5 z-[3] w-full text-base select select-bordered select-sm" aria-label="Change this tile"
          value={item.kind === 'tap' ? 'tap' : `${item.kind}:${item.ref ?? ''}`}
          on:change={(event) => onCellSelect(item, event)}>
          {#each choices as choice (choice.id)}
            <option value={choice.id}>{choice.label}</option>
          {/each}
        </select>
        <span class="absolute z-[4] touch-none right-0 top-0 h-full w-3.5 cursor-ew-resize" data-resize={item.id} data-axis="col" title="Drag to change column span"
          on:pointerdown={(event) => onResizeDown(event, item, 'col')}></span>
        <span class="absolute z-[4] touch-none bottom-0 left-0 h-3.5 w-full cursor-ns-resize" data-resize={item.id} data-axis="row" title="Drag to change row span"
          on:pointerdown={(event) => onResizeDown(event, item, 'row')}></span>
      {/if}
    </div>
  {/each}
</div>
