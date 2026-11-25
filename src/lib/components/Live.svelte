<script>
  // Live performance view: preset navigation, the editable grid board and the
  // optional raw assignments table. Fit-to-screen scales the board, never clips.
  import { afterUpdate, onDestroy, onMount } from 'svelte';
  import { app, ctx as engineCtx } from '../engine.js';
  import Assignments from './Assignments.svelte';
  import LiveGrid from './LiveGrid.svelte';

  export let ctx = engineCtx;

  let wrapEl;
  let boardEl;

  $: state = $app.state ?? {};
  $: globals = state.globals ?? {};
  $: layout = globals.liveLayout ?? {};
  $: preset = state.activePreset ?? 1;
  $: editing = Boolean(state.liveEditing);
  $: presets = ($app.state, Array.from({ length: 64 }, (_, index) => index + 1)
    .map((number) => ({ number, label: ctx.presetLabel(number) })));
  $: edited = Object.keys(state.presets ?? {}).map(Number).sort((a, b) => a - b)
    .filter((number) => ctx.isPresetEdited(number));
  $: advanced = Boolean(state.showAdvanced);

  function fitBoard() {
    if (!wrapEl || !boardEl) return;
    boardEl.style.width = '';
    boardEl.style.height = '';
    boardEl.style.transform = 'none';
    boardEl.style.transformOrigin = 'center center';
    if (!layout.fitScreen) return;
    const availableWidth = wrapEl.clientWidth;
    const availableHeight = wrapEl.clientHeight;
    const naturalWidth = boardEl.scrollWidth || boardEl.getBoundingClientRect().width;
    const naturalHeight = boardEl.scrollHeight || boardEl.getBoundingClientRect().height;
    if (!availableWidth || !availableHeight || !naturalWidth || !naturalHeight) return;
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    // Keep the wrapper full-size; only the board gets a fixed natural box.
    boardEl.style.width = `${naturalWidth}px`;
    boardEl.style.height = `${naturalHeight}px`;
    boardEl.style.transform = `scale(${scale})`;
  }

  onMount(() => window.addEventListener('resize', fitBoard));
  onDestroy(() => window.removeEventListener('resize', fitBoard));
  afterUpdate(() => requestAnimationFrame(fitBoard));
  $: if (layout.fitScreen && wrapEl && boardEl) requestAnimationFrame(fitBoard);

  function step(delta) {
    ctx.recallPreset(Math.max(1, Math.min(64, preset + delta)));
  }
</script>

<div class="content">
{#if !globals.hideLivePresetLabel}
  <h2>Live <span class="muted small">— NANOCORE preset {preset}</span></h2>
{/if}

{#if editing}
  <div class="field grid-controls">
    <label for="live-columns">Columns
      <input id="live-columns" type="number" min="1" max="64" value={layout.grid?.columns ?? 4}
        on:change={(event) => ctx.setLiveGrid({ columns: Math.max(1, Math.min(64, Number(event.currentTarget.value) || 1)) })}>
    </label>
    <label for="live-rows">Rows
      <input id="live-rows" type="number" min="1" max="64" value={layout.grid?.rows ?? 3}
        on:change={(event) => ctx.setLiveGrid({ rows: Math.max(1, Math.min(64, Number(event.currentTarget.value) || 1)) })}>
    </label>
    <button class="primary" on:click={() => ctx.toggleLiveEdit()}>Done editing</button>
    <span class="muted small">Pick items in empty cells; drag the right/bottom edge of a tile to span more cells.</span>
  </div>
{/if}

<div class="live-preset-bar card">
  <label class="muted small" for="live-preset-select">Current NANOCORE preset</label>
  <select id="live-preset-select" value={preset} on:change={(event) => ctx.recallPreset(Number(event.currentTarget.value))}>
    {#each presets as entry (entry.number)}
      <option value={entry.number} selected={entry.number === preset}>{entry.number} · {entry.label}</option>
    {/each}
  </select>
  <div class="row-actions">
    <button on:click={() => step(-1)} aria-label="Previous preset">◀</button>
    <button on:click={() => ctx.recallPreset(preset)}>Recall</button>
    <button on:click={() => step(1)} aria-label="Next preset">▶</button>
  </div>
  {#if edited.length}
    <div class="edited-list">
      {#each edited as number (number)}
        <button class="pill" on:click={() => ctx.recallPreset(number)}>{ctx.presetLabel(number)} · {number}</button>
      {/each}
    </div>
  {/if}
</div>

<div class="live-board-wrap" class:fit-screen={Boolean(layout.fitScreen)} bind:this={wrapEl}>
  <div class="live-board" bind:this={boardEl}>
    <LiveGrid {ctx} />
  </div>
</div>

{#if !globals.hideAssignmentsButton}
  <p class="assignments-toggle">
    <button class="ghost" on:click={() => ctx.update({ showAdvanced: !advanced })}>
      {advanced ? 'Hide' : 'Show'} parameter assignments
    </button>
  </p>
{/if}
{#if advanced}
  <div class="card">
    <h3>Advanced — raw assignments</h3>
    <Assignments {ctx} tableOnly={true} />
    <p class="muted small">Controller ports: {(ctx.ports?.inputs ?? []).filter((port) => port.role === 'controller').map((port) => port.name).join(', ') || 'none'}</p>
  </div>
{/if}
</div>

<style>
  .content { display: flex; flex-direction: column; min-width: 0; min-height: 0; flex: 1 1 auto; }
  .live-board-wrap { display: flex; flex: 0 0 auto; min-height: auto; align-items: flex-start; justify-content: center; }
  .live-board-wrap.fit-screen { flex: 1 1 auto; width: 100%; height: 100%; min-height: 0; overflow: hidden; align-items: center; }
  .live-board { display: flex; flex-direction: column; width: 100%; min-height: 0; }
  .live-preset-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .edited-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .grid-controls { flex-wrap: wrap; }
</style>
