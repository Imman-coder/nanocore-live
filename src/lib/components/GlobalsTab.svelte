<script>
  import { app, ctx } from '../engine.js';
  import { createDefaultState, exportState, importState, normalizeState, USER_SCENE_KEYS } from '../../core/store.js';
  import { FIRMWARE_OPTIONS, FIRMWARE_LABELS } from '../../core/versions.js';

  const defaults = createDefaultState().globals;
  let globals = structuredClone($app.state?.globals ?? defaults);
  if (!globals.footswitches?.length) globals.footswitches = structuredClone(defaults.footswitches);
  if (!globals.expressionPedals?.length) globals.expressionPedals = structuredClone(defaults.expressionPedals);
  if (!globals.sceneSwitches?.length) globals.sceneSwitches = structuredClone(defaults.sceneSwitches);
  if (!globals.tapTempoSwitch) globals.tapTempoSwitch = structuredClone(defaults.tapTempoSwitch);

  let fileInput;

  $: sceneTargets = ['base', ...USER_SCENE_KEYS.slice(0, Math.max(0, (Number(globals.sceneCount) || 3) - 1))];

  function syncFromState() {
    globals = structuredClone(ctx.state.globals);
    if (!globals.footswitches?.length) globals.footswitches = structuredClone(defaults.footswitches);
    if (!globals.expressionPedals?.length) globals.expressionPedals = structuredClone(defaults.expressionPedals);
    if (!globals.sceneSwitches?.length) globals.sceneSwitches = structuredClone(defaults.sceneSwitches);
    if (!globals.tapTempoSwitch) globals.tapTempoSwitch = structuredClone(defaults.tapTempoSwitch);
  }

  function collect() {
    const next = structuredClone(globals);
    next.volumePedal = next.volumePedal || null;
    next.sceneCount = Number(next.sceneCount) || 3;
    next.midiChannel = Number(next.midiChannel) || 1;
    return next;
  }

  export function save() {
    ctx.update({ globals: normalizeState({ ...ctx.state, globals: collect() }).globals });
    syncFromState();
  }

  function learn(id, button) {
    ctx.router.armLearn(id);
    button.classList.add('learn');
    button.textContent = 'Press now…';
    const timer = setInterval(() => {
      const learned = ctx.router.consumeLearnedTrigger();
      if (!learned) return;
      clearInterval(timer);
      const next = collect();
      const target = next.footswitches.find((f) => f.id === id)
        ?? next.expressionPedals?.find((p) => p.id === id)
        ?? next.sceneSwitches?.find((s) => s.id === id)
        ?? (next.tapTempoSwitch?.id === id ? next.tapTempoSwitch : null);
      if (target) target.trigger = learned;
      ctx.update({ globals: normalizeState({ ...ctx.state, globals: next }).globals });
      syncFromState();
      ctx.notify(`Learned ${ctx.describeTrigger(learned)} for ${id}`);
    }, 120);
  }

  function exportJson() {
    const blob = new Blob([exportState(ctx.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nanocore-live.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      ctx.update(importState(await file.text()));
      syncFromState();
      ctx.notify('Live set imported');
    } catch (error) {
      ctx.notify(`Import failed: ${error.message}`);
    }
    input.value = '';
  }

  function reset() {
    if (window.confirm('Reset all bindings stored in this browser?')) {
      ctx.update(createDefaultState());
      syncFromState();
    }
  }
</script>

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Virtual footswitch triggers</h3>
<p class="text-xs text-muted">The incoming message is configured here. Per-preset block targets are set in the Editor.</p>
{#each globals.footswitches as fs (fs.id)}
  <div class="mb-2 rounded-[10px] border border-line bg-panel-2 p-2.5">
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label class="text-xs text-muted min-w-[90px]">Name <input data-global="fs-name" data-fs={fs.id} type="text" bind:value={fs.name} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <label class="text-xs text-muted min-w-[90px]">Trigger <select data-global="fs-type" data-fs={fs.id} bind:value={fs.trigger.type} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
        <option value="cc">CC</option>
        <option value="pc">PC</option>
        <option value="note">NOTE</option>
      </select></label>
      <label class="text-xs text-muted min-w-[90px]">Channel <input data-global="fs-channel" data-fs={fs.id} type="number" min="1" max="16" bind:value={fs.trigger.channel} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <label class="text-xs text-muted min-w-[90px]">Number <input data-global="fs-number" data-fs={fs.id} type="number" min="0" max="127" bind:value={fs.trigger.number} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="learn" data-fs={fs.id} on:click={(event) => learn(fs.id, event.currentTarget)}>Learn</button>
      <span class="text-xs text-muted">{ctx.describeTrigger(fs.trigger)}</span>
    </div>
  </div>
{/each}

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Expression pedals</h3>
<p class="text-xs text-muted">These four virtual pedals can be assigned to a parameter by right-clicking it in the Editor.</p>
{#each globals.expressionPedals as pedal (pedal.id)}
  <div class="mb-2 rounded-[10px] border border-line bg-panel-2 p-2.5">
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label class="text-xs text-muted min-w-[90px]">Name <input data-global="fs-name" data-fs={pedal.id} type="text" bind:value={pedal.name} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <label class="text-xs text-muted min-w-[90px]">Trigger <select data-global="fs-type" data-fs={pedal.id} bind:value={pedal.trigger.type} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
        <option value="cc">CC</option>
        <option value="pc">PC</option>
        <option value="note">NOTE</option>
      </select></label>
      <label class="text-xs text-muted min-w-[90px]">Channel <input data-global="fs-channel" data-fs={pedal.id} type="number" min="1" max="16" bind:value={pedal.trigger.channel} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <label class="text-xs text-muted min-w-[90px]">Number <input data-global="fs-number" data-fs={pedal.id} type="number" min="0" max="127" bind:value={pedal.trigger.number} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="learn" data-fs={pedal.id} on:click={(event) => learn(pedal.id, event.currentTarget)}>Learn</button>
      <label class="text-xs text-muted min-w-[90px]"><input type="checkbox" data-global="fs-full-touch" data-fs={pedal.id} bind:checked={pedal.fullTouch} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /> Full touch control in Live</label>
    </div>
  </div>
{/each}

<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]">Preset volume pedal <select data-global="volume-pedal" bind:value={globals.volumePedal} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
    <option value="">None</option>
    {#each globals.expressionPedals as pedal (pedal.id)}
      <option value={pedal.id}>{pedal.name}</option>
    {/each}
  </select></label>
  <span class="text-xs text-muted">This pedal controls preset volume globally, in every preset.</span>
</div>

<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]"><input type="checkbox" data-global="interactive-live" bind:checked={globals.interactiveLive} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /> Interactive Live mode</label>
  <span class="text-xs text-muted">Let the Live expression meters be dragged or arrow-keyed to control assigned parameters.</span>
</div>
<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]"><input type="checkbox" data-global="absolute-expression" bind:checked={globals.absoluteExpression} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /> Absolute expression faders</label>
  <span class="text-xs text-muted">Off (default): dragging slides the value relatively from where you pressed. On: the touch position sets the value directly.</span>
</div>

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Tempo</h3>
<div class="mb-2.5 flex flex-wrap items-center gap-2"><label class="text-xs text-muted min-w-[90px]"><input type="checkbox" data-global="tempo-sync" checked={globals.tempoSync !== false} on:change={(event) => (globals.tempoSync = event.currentTarget.checked)} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /> Sync delay time to tap tempo</label></div>
<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]">Tap tempo trigger <select data-tap="type" bind:value={globals.tapTempoSwitch.trigger.type} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
    <option value="cc">CC</option>
    <option value="pc">PC</option>
    <option value="note">NOTE</option>
  </select></label>
  <label class="text-xs text-muted min-w-[90px]">Channel <input data-tap="channel" type="number" min="1" max="16" bind:value={globals.tapTempoSwitch.trigger.channel} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
  <label class="text-xs text-muted min-w-[90px]">Number <input data-tap="number" type="number" min="0" max="127" bind:value={globals.tapTempoSwitch.trigger.number} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
  <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="learn" data-fs={globals.tapTempoSwitch.id} on:click={(event) => learn(globals.tapTempoSwitch.id, event.currentTarget)}>Learn</button>
  <span class="text-xs text-muted">{ctx.describeTrigger(globals.tapTempoSwitch.trigger)}</span>
</div>

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Scenes</h3>
<p class="text-xs text-muted">Base is always available. Choose up to six total scenes and name each one.</p>
<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]">Number of scenes <select data-global="scene-count" bind:value={globals.sceneCount} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
    {#each [3, 4, 5, 6] as count}
      <option value={count}>{count}</option>
    {/each}
  </select></label>
</div>

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Scene switches</h3>
<p class="text-xs text-muted">Each switch recalls the scene you assign it to. Use Learn to capture a MIDI message from your controller.</p>
{#each globals.sceneSwitches as sw (sw.id)}
  <div class="mb-2 rounded-[10px] border border-line bg-panel-2 p-2.5">
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label class="text-xs text-muted min-w-[90px]">Name <input data-global="scene-name" data-scene-id={sw.id} type="text" bind:value={sw.name} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <label class="text-xs text-muted min-w-[90px]">Recalls <select data-global="scene-target" data-scene-id={sw.id} bind:value={sw.scene} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
        {#each sceneTargets as value}
          <option value={value}>{ctx.sceneName(value)}</option>
        {/each}
      </select></label>
      <label class="text-xs text-muted min-w-[90px]">Trigger <select data-global="scene-type" data-scene-id={sw.id} bind:value={sw.trigger.type} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
        <option value="cc">CC</option>
        <option value="pc">PC</option>
        <option value="note">NOTE</option>
      </select></label>
      <label class="text-xs text-muted min-w-[90px]">Channel <input data-global="scene-channel" data-scene-id={sw.id} type="number" min="1" max="16" bind:value={sw.trigger.channel} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <label class="text-xs text-muted min-w-[90px]">Number <input data-global="scene-number" data-scene-id={sw.id} type="number" min="0" max="127" bind:value={sw.trigger.number} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
      <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="learn" data-fs={sw.id} on:click={(event) => learn(sw.id, event.currentTarget)}>Learn</button>
      <span class="text-xs text-muted">{ctx.describeTrigger(sw.trigger)}</span>
    </div>
  </div>
{/each}

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Device</h3>
<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]">Firmware (FX type lists) <select data-global="firmware" bind:value={globals.firmware} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
    {#each FIRMWARE_OPTIONS as version}
      <option value={version}>{FIRMWARE_LABELS[version] ?? version}</option>
    {/each}
  </select></label>
  <span class="text-xs text-muted">Auto follows the 0x65 settings-layout hint. Newer firmware adds MOD/FX2 types; pick explicitly if Auto is wrong.</span>
</div>
<div class="mb-2.5 flex flex-wrap items-center gap-2">
  <label class="text-xs text-muted min-w-[90px]">MIDI channel <input data-global="midi-channel" type="number" min="1" max="16" bind:value={globals.midiChannel} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" /></label>
  <label class="text-xs text-muted min-w-[90px]">Preset recall <select data-global="recall-method" bind:value={globals.recallMethod} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit">
    <option value="sysex">Device preset recall</option>
    <option value="pc">Program Change</option>
  </select></label>
</div>

<h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Persistence</h3>
<p class="text-xs text-muted">Bindings are stored in this browser only, never on the pedal.</p>
<button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="export" on:click={exportJson}>Export JSON</button>
<button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="import" on:click={() => fileInput?.click()}>Import JSON</button>
<input bind:this={fileInput} id="import-file" type="file" accept="application/json" on:change={importJson} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" hidden />
<button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-danger hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="reset" on:click={reset}>Reset everything</button>
<div style="margin-top:18px"><button class="cursor-pointer rounded-lg border border-accent bg-accent px-3 py-1.5 font-[inherit] font-bold text-[#1a1206] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-global="save" on:click={save}>Save globals</button></div>
