<script>
  // Right-click expression assignment popup. One pedal drives one parameter
  // per preset; pedals occupied by global preset volume are unavailable.
  import { onDestroy } from 'svelte';
  import { app, ctx as engineCtx } from '../engine.js';
  import { BLOCK_BY_ID } from '../../core/spec.js';
  import { expressionRawToPercent, expressionPercentToRaw } from '../../core/live.js';

  export let target;
  export let onClose = () => {};
  export let ctx = engineCtx;

  let pedal = null;
  let trigger = null;
  let minPercent = 0;
  let maxPercent = 100;
  let outMinPercent = 0;
  let outMaxPercent = 100;
  let invert = false;
  let error = '';
  let learnTimer = null;
  let lastTarget = null;

  $: preset = $app.state?.activePreset ?? 1;
  $: assignments = ($app.state, ctx.assignments);
  $: mapping = assignments?.paramPedals?.[`${target?.block}:${target?.paramIndex}`] ?? null;
  $: pedals = $app.state?.globals?.expressionPedals ?? [];
  $: globalVolumeId = $app.state?.globals?.volumePedal ?? null;
  $: chosen = pedals.find((entry) => entry.id === pedal);
  $: message = trigger ?? chosen?.trigger ?? { type: 'cc', channel: 1, number: 7 };
  $: ownerKey = `${target?.block}:${target?.paramIndex}`;

  function reset() {
    const current = ctx.assignments?.paramPedals?.[`${target?.block}:${target?.paramIndex}`];
    pedal = current?.pedal ?? null;
    trigger = null;
    minPercent = expressionRawToPercent(current?.inputMin ?? 0);
    maxPercent = expressionRawToPercent(current?.inputMax ?? 127);
    outMinPercent = expressionRawToPercent(current?.outputMin ?? 0);
    outMaxPercent = expressionRawToPercent(current?.outputMax ?? 127);
    invert = Boolean(current?.invert);
    error = '';
  }

  $: if (target && target !== lastTarget) {
    lastTarget = target;
    reset();
  }

  function fail(text) { error = text; }

  function choosePedal(id) {
    if (globalVolumeId === id) return;
    pedal = id;
    trigger = null;
    error = '';
  }

  function setMessage(part, value) {
    trigger = { ...message, [part]: value };
  }

  function learn() {
    if (!pedal) return fail('Choose a pedal first.');
    ctx.router.armLearn(`pedal:${pedal}`);
    ctx.notify('Move the expression pedal now');
    clearInterval(learnTimer);
    learnTimer = setInterval(() => {
      const found = ctx.router.consumeLearnedTrigger();
      if (!found) return;
      clearInterval(learnTimer);
      learnTimer = null;
      trigger = found;
      ctx.setExpressionTrigger(pedal, found);
      ctx.notify(`Learned ${ctx.describeTrigger(found)} for ${pedal}`);
    }, 120);
  }

  function save() {
    if (!pedal) return fail('Choose a pedal first.');
    if (globalVolumeId === pedal) {
      return fail(`${pedal} controls preset volume globally. Clear it in Globals first.`);
    }
    const owner = ctx.pedalOwner(preset, pedal);
    if (owner && owner !== ownerKey) {
      const [block, index] = owner.split(':');
      const label = `${BLOCK_BY_ID[block]?.name ?? block} parameter ${Number(index) + 1}`;
      return fail(`${pedal} is already assigned to ${label} in this preset. Unassign it there first.`);
    }
    if (Number(minPercent) >= Number(maxPercent)) return fail('Pedal min % must be lower than max %.');
    if (Number(outMinPercent) >= Number(outMaxPercent)) return fail('Parameter min % must be lower than max %.');
    ctx.setExpressionTrigger(pedal, message);
    ctx.setParamPedal(preset, target.block, target.paramIndex, {
      pedal,
      inputMin: expressionPercentToRaw(minPercent),
      inputMax: expressionPercentToRaw(maxPercent),
      outputMin: expressionPercentToRaw(outMinPercent),
      outputMax: expressionPercentToRaw(outMaxPercent),
      invert: Boolean(invert),
    });
    ctx.notify(`${pedal} assigned to ${target.label}`);
    onClose();
  }

  function remove() {
    ctx.setParamPedal(preset, target.block, target.paramIndex, null);
    ctx.notify('Pedal assignment removed');
    onClose();
  }

  onDestroy(() => clearInterval(learnTimer));
</script>

<svelte:window on:keydown={(event) => { if (event.key === 'Escape') onClose(); }} />

<div class="modal modal-open z-[80]">
  <button class="modal-backdrop z-0" aria-label="Close assignment popup" on:click={onClose}></button>
  <div class="modal-box relative z-10 flex max-h-[86vh] w-[min(640px,94vw)] max-w-none flex-col overflow-y-auto bg-base-200 p-[18px]" role="dialog" aria-modal="true" aria-label="Assign expression pedal">
    <div class="mb-2.5 flex flex-none items-center justify-between">
      <h2 class="m-0 mb-3 text-lg">Expression pedal → {BLOCK_BY_ID[target?.block]?.name ?? target?.block} / {target?.label}</h2>
      <button class="btn btn-sm" on:click={onClose}>Close</button>
    </div>
    <p class="text-muted text-xs">One pedal can drive only one parameter in this preset. Right-click another parameter to reassign it.</p>
    {#if target?.cc === null}
      <p class="alert alert-warning text-xs">⚠ This parameter has no documented CC — it uses SysEx. Live sweeps may be less stable and are throttled.</p>
    {/if}

    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Pedal</h3>
    <div class="my-2 flex flex-wrap gap-2">
      {#each pedals as item (item.id)}
        {@const usedGlobally = globalVolumeId === item.id}
        <button class="flex min-w-[120px] flex-col gap-1 rounded-[10px] border border-line bg-panel-2 p-2.5 cursor-pointer font-[inherit] text-inherit text-left hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {pedal === item.id ? 'border-accent bg-[#30281b]' : ''}"
          disabled={usedGlobally}
          title={usedGlobally ? 'Used globally for preset volume — clear it in Globals first' : undefined}
          on:click={() => choosePedal(item.id)}
        >
          <b>{item.name}</b>
          <span class="text-muted text-xs">{usedGlobally ? 'Global · Preset volume' : ctx.describeTrigger(item.trigger)}</span>
        </button>
      {/each}
    </div>

    <!-- <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Incoming MIDI message</h3>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label for="popup-type" class="text-xs text-muted min-w-[90px]">Type</label>
      <select id="popup-type" class="select select-bordered select-sm" value={message.type} on:change={(event) => setMessage('type', event.currentTarget.value)}>
        {#each ['cc', 'note', 'pc'] as type}
          <option value={type} selected={message.type === type}>{type.toUpperCase()}</option>
        {/each}
      </select>
      <label for="popup-channel" class="text-xs text-muted min-w-[90px]">Channel</label>
      <input id="popup-channel" class="input input-bordered input-sm" type="number" min="1" max="16" value={message.channel ?? 1}
        on:input={(event) => setMessage('channel', Number(event.currentTarget.value))}>
      <label for="popup-number" class="text-xs text-muted min-w-[90px]">Number</label>
      <input id="popup-number" class="input input-bordered input-sm" type="number" min="0" max="127" value={message.number ?? 0}
        on:input={(event) => setMessage('number', Number(event.currentTarget.value))}>
      <button class="btn btn-sm" on:click={learn}>Learn from pedal</button>
    </div> -->

    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Value range mapping</h3>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label for="popup-min" class="text-xs text-muted min-w-[90px]">Pedal min (%)</label>
      <input id="popup-min" class="input input-bordered input-sm" type="number" min="0" max="100" step="1" bind:value={minPercent}>
      <label for="popup-max" class="text-xs text-muted min-w-[90px]">Pedal max (%)</label>
      <input id="popup-max" class="input input-bordered input-sm" type="number" min="0" max="100" step="1" bind:value={maxPercent}>
      <label for="popup-out-min" class="text-xs text-muted min-w-[90px]">Parameter min (%)</label>
      <input id="popup-out-min" class="input input-bordered input-sm" type="number" min="0" max="100" step="1" bind:value={outMinPercent}>
      <label for="popup-out-max" class="text-xs text-muted min-w-[90px]">Parameter max (%)</label>
      <input id="popup-out-max" class="input input-bordered input-sm" type="number" min="0" max="100" step="1" bind:value={outMaxPercent}>
      <label for="popup-invert" class="text-xs text-muted min-w-[90px]"><input id="popup-invert" class="checkbox checkbox-sm checkbox-primary" type="checkbox" bind:checked={invert}> Invert</label>
    </div>
    <p class="text-xs text-muted">The pedal window and the parameter window are independent. Values outside the pedal window are clamped.</p>
    {#if error}<p class="border-accent text-accent" role="alert">{error}</p>{/if}
    <div class="mb-1 mt-4 flex flex-wrap items-center gap-2">
      <button class="btn btn-primary" on:click={save}>{mapping ? 'Update assignment' : 'Assign pedal'}</button>
      {#if mapping}<button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-danger hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={remove}>Remove assignment</button>{/if}
      <button class="btn" on:click={onClose}>Cancel</button>
    </div>
  </div>
</div>


