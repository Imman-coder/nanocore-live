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

<div class="modal-overlay">
  <button class="modal-backdrop" aria-label="Close assignment popup" on:click={onClose}></button>
  <div class="modal-box" role="dialog" aria-modal="true" aria-label="Assign expression pedal">
    <div class="modal-head">
      <h2>Expression pedal → {BLOCK_BY_ID[target?.block]?.name ?? target?.block} / {target?.label}</h2>
      <button class="small" on:click={onClose}>Close</button>
    </div>
    <p class="muted small">One pedal can drive only one parameter in this preset. Right-click another parameter to reassign it.</p>
    {#if target?.cc === null}
      <p class="small warning">⚠ This parameter has no documented CC — it uses SysEx. Live sweeps may be less stable and are throttled.</p>
    {/if}

    <h3>Pedal</h3>
    <div class="radio-row">
      {#each pedals as item (item.id)}
        {@const usedGlobally = globalVolumeId === item.id}
        <button
          class="radio-card"
          class:active={pedal === item.id}
          disabled={usedGlobally}
          title={usedGlobally ? 'Used globally for preset volume — clear it in Globals first' : undefined}
          on:click={() => choosePedal(item.id)}
        >
          <b>{item.name}</b>
          <span class="muted small">{usedGlobally ? 'Global · Preset volume' : ctx.describeTrigger(item.trigger)}</span>
        </button>
      {/each}
    </div>

    <h3>Incoming MIDI message</h3>
    <div class="field">
      <label for="popup-type">Type</label>
      <select id="popup-type" value={message.type} on:change={(event) => setMessage('type', event.currentTarget.value)}>
        {#each ['cc', 'note', 'pc'] as type}
          <option value={type} selected={message.type === type}>{type.toUpperCase()}</option>
        {/each}
      </select>
      <label for="popup-channel">Channel</label>
      <input id="popup-channel" type="number" min="1" max="16" value={message.channel ?? 1}
        on:input={(event) => setMessage('channel', Number(event.currentTarget.value))}>
      <label for="popup-number">Number</label>
      <input id="popup-number" type="number" min="0" max="127" value={message.number ?? 0}
        on:input={(event) => setMessage('number', Number(event.currentTarget.value))}>
      <button class="small" on:click={learn}>Learn from pedal</button>
    </div>

    <h3>Value range mapping</h3>
    <div class="field">
      <label for="popup-min">Pedal min (%)</label>
      <input id="popup-min" type="number" min="0" max="100" step="1" bind:value={minPercent}>
      <label for="popup-max">Pedal max (%)</label>
      <input id="popup-max" type="number" min="0" max="100" step="1" bind:value={maxPercent}>
      <label for="popup-out-min">Parameter min (%)</label>
      <input id="popup-out-min" type="number" min="0" max="100" step="1" bind:value={outMinPercent}>
      <label for="popup-out-max">Parameter max (%)</label>
      <input id="popup-out-max" type="number" min="0" max="100" step="1" bind:value={outMaxPercent}>
      <label for="popup-invert"><input id="popup-invert" type="checkbox" bind:checked={invert}> Invert</label>
    </div>
    <p class="small muted">The pedal window and the parameter window are independent. Values outside the pedal window are clamped.</p>
    {#if error}<p class="warning" role="alert">{error}</p>{/if}
    <div class="field buttons">
      <button class="primary" on:click={save}>{mapping ? 'Update assignment' : 'Assign pedal'}</button>
      {#if mapping}<button class="danger" on:click={remove}>Remove assignment</button>{/if}
      <button on:click={onClose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 80; }
  .modal-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; background: rgba(0, 0, 0, .6); border: 0; cursor: default; }
  .modal-box { position: relative; z-index: 1; width: min(640px, 94vw); height: min(600px, 86vh); max-height: 86vh; overflow-y: auto; padding: 18px; }
  .buttons { margin-top: 16px; padding-bottom: 4px; }
</style>
