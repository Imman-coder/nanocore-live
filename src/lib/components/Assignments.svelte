<script>
  // Per-preset MIDI assignment editor plus the raw IN → OUT table used by Live.
  import { app, ctx as engineCtx } from '../engine.js';
  import { BLOCKS, BLOCK_BY_ID, paramCcFor } from '../../core/spec.js';
  import { effectiveStompLabel } from '../../core/store.js';

  export let ctx = engineCtx;
  export let assignments = null;
  export let tableOnly = false;

  $: preset = $app.state?.activePreset ?? 1;
  $: current = assignments ?? ($app.state, ctx.assignments);
  $: footswitches = $app.state?.globals?.footswitches ?? [];
  $: expressions = current?.expressions ?? [];
  $: stomps = current?.stomps ?? [];

  function stomp(fsId) {
    return stomps.find((entry) => entry.fsId === fsId) ?? { fsId, mode: 'value', targets: [] };
  }

  function putStomp(fsId, patch) {
    ctx.upsertStomp(preset, fsId, { ...stomp(fsId), ...patch });
  }

  function onStompLabel(event, fsId) {
    putStomp(fsId, { label: event.currentTarget.value });
  }

  function onStompMode(event, fsId) {
    const existing = stomp(fsId);
    const strip = (target) => { const copy = { ...target }; delete copy.value; return copy; };
    const mode = event.currentTarget.value;
    if (mode === 'value' || mode === 'toggle') {
      putStomp(fsId, { mode, targets: existing.targets.map(strip) });
    } else {
      const value = mode === 'on' ? 127 : 0;
      putStomp(fsId, { mode: 'value', targets: existing.targets.map((target) => ({ ...target, value })) });
    }
  }

  function onStompTarget(event, fsId) {
    const chosen = [...event.currentTarget.closest('[data-binding]').querySelectorAll('[data-asg="stomp-target"]:checked')]
      .map((box) => box.dataset.block);
    const fixed = stomp(fsId).targets.find((target) => typeof target.value === 'number');
    putStomp(fsId, { targets: chosen.map((block) => ({ block, ...(fixed ? { value: fixed.value } : {}) })) });
  }

  function summary(fs, binding) {
    const targets = binding.targets ?? [];
    if (!targets.length) return `${fs.name}: unassigned`;
    return `${fs.name}: ${targets.map((target) =>
      `${BLOCK_BY_ID[target.block]?.name ?? target.block} → CC${BLOCK_BY_ID[target.block]?.onOffCc}${typeof target.value === 'number' ? ` = ${target.value}` : ''}`,
    ).join(', ')}`;
  }

  function patchExpression(index, patch) {
    ctx.setExpressions(preset, expressions.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function addExpression() {
    ctx.setExpressions(preset, [...expressions, {
      id: `E${expressions.length + 1}`,
      trigger: { type: 'cc', channel: 1, number: 7 },
      target: 'fx1', paramIndex: 0, mode: 'value',
    }]);
  }

  function removeExpression(index) {
    ctx.setExpressions(preset, expressions.filter((_, i) => i !== index));
  }
</script>

{#if tableOnly}
  <table class="table table-xs">
    <thead><tr><th class="border-b border-line px-1.5 py-1.5 text-left">Virtual pedal</th><th class="border-b border-line px-1.5 py-1.5 text-left">IN (controller)</th><th class="border-b border-line px-1.5 py-1.5 text-left">OUT (NANOCORE)</th></tr></thead>
    <tbody>
      {#each footswitches as fs (fs.id)}
        <tr>
          <td class="border-b border-line px-1.5 py-1.5 text-left">{effectiveStompLabel($app.state, current, fs.id)}</td>
          <td class="border-b border-line px-1.5 py-1.5 text-left">{ctx.describeTrigger(fs.trigger)}</td>
          <td class="border-b border-line px-1.5 py-1.5 text-left">
            {(stomp(fs.id).targets ?? []).map((target) =>
              `${BLOCK_BY_ID[target.block]?.name}:CC${BLOCK_BY_ID[target.block]?.onOffCc}=${target.value ?? 'incoming'}`,
            ).join(', ') || '—'}
          </td>
        </tr>
      {/each}
      {#each expressions as entry, index (entry.id ?? index)}
        <tr>
          <td class="border-b border-line px-1.5 py-1.5 text-left">{entry.id}</td>
          <td class="border-b border-line px-1.5 py-1.5 text-left">CC {entry.trigger?.number}</td>
          <td class="border-b border-line px-1.5 py-1.5 text-left">CC {paramCcFor(entry.target, entry.paramIndex ?? 0)} ({entry.invert || entry.mode === 'invert' ? 'inverted' : 'normal'})</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Virtual footswitches → FX blocks</h3>
  <p class="text-muted text-xs">Incoming messages are configured in Globals. Each preset chooses its own button names and which blocks each button drives.</p>
  {#each footswitches as fs (fs.id)}
    {@const binding = stomp(fs.id)}
    {@const mode = binding.mode ?? 'value'}
    {@const fixed = binding.targets.find((target) => typeof target.value === 'number')?.value}
    <div data-binding class="mb-2 rounded-[10px] border border-line bg-panel-2 p-2.5">
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <label for={`asg-label-${fs.id}`} class="text-xs text-muted min-w-[90px]">{fs.name} · {ctx.describeTrigger(fs.trigger)}</label>
        <input id={`asg-label-${fs.id}`} class="input input-bordered input-sm" data-asg="stomp-label" placeholder="Button label" value={binding.label ?? ''}
          on:change={(event) => onStompLabel(event, fs.id)}>
        <select data-asg="stomp-mode" class="select select-bordered select-sm" value={fixed === 127 ? 'on' : fixed === 0 ? 'off' : mode}
          on:change={(event) => onStompMode(event, fs.id)}>
          <option value="value" selected={mode === 'value' && fixed === undefined}>Incoming value</option>
          <option value="toggle" selected={mode === 'toggle'}>Toggle</option>
          <option value="on" selected={fixed === 127}>Always ON</option>
          <option value="off" selected={fixed === 0}>Always OFF</option>
        </select>
      </div>
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        {#each BLOCKS as block (block.id)}
          <label class="text-xs text-muted min-w-[90px]">
            <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" data-asg="stomp-target" data-fs={fs.id} data-block={block.id}
              checked={binding.targets.some((target) => target.block === block.id)}
              on:change={(event) => onStompTarget(event, fs.id)}>
            {block.name}
          </label>
        {/each}
      </div>
      <div class="text-muted text-xs">{summary(fs, binding)}</div>
    </div>
  {/each}

  <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Expression pedals → parameters</h3>
  <p class="text-muted text-xs">Each expression maps an incoming CC to one parameter CC on the NANOCORE.</p>
  {#each expressions as entry, index (entry.id ?? index)}
    <div data-binding class="mb-2 rounded-[10px] border border-line bg-panel-2 p-2.5">
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <label for={`asg-expr-cc-${index}`} class="text-xs text-muted min-w-[90px]">Expression {index + 1}</label>
        <input id={`asg-expr-cc-${index}`} class="input input-bordered input-sm" data-asg="expr-cc" type="number" min="0" max="127"
          value={entry.trigger?.number ?? 7}
          on:change={(event) => patchExpression(index, { trigger: { ...entry.trigger, number: Number(event.currentTarget.value) } })}>
        <span class="text-muted text-xs">{ctx.describeTrigger(entry.trigger)}</span>
        <button class="btn btn-sm text-error" on:click={() => removeExpression(index)}>Remove</button>
      </div>
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <label for={`asg-expr-block-${index}`} class="text-xs text-muted min-w-[90px]">Target</label>
        <select id={`asg-expr-block-${index}`} class="select select-bordered select-sm" value={entry.target}
          on:change={(event) => patchExpression(index, { target: event.currentTarget.value })}>
          {#each BLOCKS as block (block.id)}
            <option value={block.id} selected={entry.target === block.id}>{block.name}</option>
          {/each}
        </select>
        <label for={`asg-expr-param-${index}`} class="text-xs text-muted min-w-[90px]">Param #</label>
        <input id={`asg-expr-param-${index}`} class="input input-bordered input-sm" data-asg="expr-param" type="number" min="0" max="11"
          value={entry.paramIndex ?? 0}
          on:change={(event) => patchExpression(index, { paramIndex: Number(event.currentTarget.value) })}>
        <label for={`asg-expr-mode-${index}`} class="text-xs text-muted min-w-[90px]">Mode</label>
        <select id={`asg-expr-mode-${index}`} class="select select-bordered select-sm" value={entry.invert || entry.mode === 'invert' ? 'invert' : 'value'}
          on:change={(event) => patchExpression(index, { invert: event.currentTarget.value === 'invert', mode: event.currentTarget.value })}>
          <option value="value">Normal</option>
          <option value="invert">Inverted</option>
        </select>
      </div>
      <div class="text-muted text-xs">Sends CC {paramCcFor(entry.target ?? 'fx1', entry.paramIndex ?? 0)}</div>
    </div>
  {:else}
    <p class="text-muted text-xs">No expression pedals assigned to this preset.</p>
  {/each}
  <button class="btn" on:click={addExpression}>+ Add expression pedal</button>

  <details>
    <summary>Raw assignments</summary>
    <table class="table table-xs">
      <thead><tr><th class="border-b border-line px-1.5 py-1.5 text-left">Virtual pedal</th><th class="border-b border-line px-1.5 py-1.5 text-left">IN (controller)</th><th class="border-b border-line px-1.5 py-1.5 text-left">OUT (NANOCORE)</th></tr></thead>
      <tbody>
        {#each footswitches as fs (fs.id)}
          <tr>
            <td class="border-b border-line px-1.5 py-1.5 text-left">{effectiveStompLabel($app.state, current, fs.id)}</td>
            <td class="border-b border-line px-1.5 py-1.5 text-left">{ctx.describeTrigger(fs.trigger)}</td>
            <td class="border-b border-line px-1.5 py-1.5 text-left">{(stomp(fs.id).targets ?? []).map((target) => `${BLOCK_BY_ID[target.block]?.name}:CC${BLOCK_BY_ID[target.block]?.onOffCc}=${target.value ?? 'incoming'}`).join(', ') || '—'}</td>
          </tr>
        {/each}
        {#each expressions as entry, index (entry.id ?? index)}
          <tr>
            <td class="border-b border-line px-1.5 py-1.5 text-left">{entry.id}</td><td class="border-b border-line px-1.5 py-1.5 text-left">CC {entry.trigger?.number}</td>
            <td class="border-b border-line px-1.5 py-1.5 text-left">CC {paramCcFor(entry.target, entry.paramIndex ?? 0)} ({entry.invert || entry.mode === 'invert' ? 'inverted' : 'normal'})</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
{/if}
