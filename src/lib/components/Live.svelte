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

<div class="flex min-h-0 min-w-0 flex-1 flex-col [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-line">
{#if !globals.hideLivePresetLabel}
  <h2 class="m-0 mb-3 text-lg">Live <span class="text-muted text-xs">— NANOCORE preset {preset}</span></h2>
{/if}

{#if editing}
  <div class="mb-2.5 flex flex-wrap items-center gap-2">
    <label class="text-xs text-muted" for="live-columns">Columns
      <input id="live-columns" type="number" min="1" max="64" value={layout.grid?.columns ?? 4}
        class="input input-bordered input-sm"
        on:change={(event) => ctx.setLiveGrid({ columns: Math.max(1, Math.min(64, Number(event.currentTarget.value) || 1)) })}>
    </label>
    <label class="text-xs text-muted" for="live-rows">Rows
      <input id="live-rows" type="number" min="1" max="64" value={layout.grid?.rows ?? 3}
        class="input input-bordered input-sm"
        on:change={(event) => ctx.setLiveGrid({ rows: Math.max(1, Math.min(64, Number(event.currentTarget.value) || 1)) })}>
    </label>
    <button class="btn btn-primary" on:click={() => ctx.toggleLiveEdit()}>Done editing</button>
    <span class="text-muted text-xs">Pick items in empty cells; drag the right/bottom edge of a tile to span more cells.</span>
  </div>
{/if}

<div class="mb-3 flex flex-wrap items-center gap-2 card border border-base-300 bg-base-200 p-3.5">
  <label class="text-xs text-muted" for="live-preset-select">Current NANOCORE preset</label>
  <select id="live-preset-select" class="select select-bordered select-sm" value={preset} on:change={(event) => ctx.recallPreset(Number(event.currentTarget.value))}>
    {#each presets as entry (entry.number)}
      <option value={entry.number} selected={entry.number === preset}>{entry.number} · {entry.label}</option>
    {/each}
  </select>
  <div class="mb-2.5 flex flex-wrap items-center gap-2">
    <button class="btn" on:click={() => step(-1)} aria-label="Previous preset">◀</button>
    <button class="btn" on:click={() => ctx.recallPreset(preset)}>Recall</button>
    <button class="btn" on:click={() => step(1)} aria-label="Next preset">▶</button>
  </div>
  {#if edited.length}
    <div class="flex flex-wrap gap-1">
      {#each edited as number (number)}
        <button class="btn btn-sm rounded-full" on:click={() => ctx.recallPreset(number)}>{ctx.presetLabel(number)} · {number}</button>
      {/each}
    </div>
  {/if}
</div>

<div
  class="flex justify-center {layout.fitScreen ? 'h-full w-full min-h-0 flex-1 items-center overflow-hidden' : 'flex-none items-start'}"
  bind:this={wrapEl}
>
  <div class="flex min-h-0 w-full flex-col" bind:this={boardEl}>
    <LiveGrid {ctx} />
  </div>
</div>

{#if !globals.hideAssignmentsButton}
  <p class="my-2 text-center">
    <button class="btn btn-ghost" on:click={() => ctx.update({ showAdvanced: !advanced })}>
      {advanced ? 'Hide' : 'Show'} parameter assignments
    </button>
  </p>
{/if}
{#if advanced}
  <div class="card mb-3 border border-base-300 bg-base-200 p-3.5">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Advanced — raw assignments</h3>
    <Assignments {ctx} tableOnly={true} />
    <p class="text-muted text-xs">Controller ports: {(ctx.ports?.inputs ?? []).filter((port) => port.role === 'controller').map((port) => port.name).join(', ') || 'none'}</p>
  </div>
{/if}
</div>


