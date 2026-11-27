<script>
  import { stateView, snapshotView, feedbackView, uiView, ctx } from '../engine.js';
  import { createDefaultState, exportState, importState, normalizeState, USER_SCENE_KEYS } from '../../core/store.js';
  import { FIRMWARE_OPTIONS, FIRMWARE_LABELS } from '../../core/versions.js';

  const defaults = createDefaultState().globals;
  let globals = structuredClone($stateView?.globals ?? defaults);
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

<div class="grid gap-4 lg:grid-cols-2">
  <section class="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
    <div class="card-body gap-3">
      <div>
        <h3 class="card-title text-base">Virtual footswitches</h3>
        <p class="text-sm text-base-content/60">Incoming messages are configured here. Per-preset block targets are set in the Editor.</p>
      </div>
      {#each globals.footswitches as fs (fs.id)}
        <div class="rounded-box border border-base-300 bg-base-200 p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span class="badge badge-outline badge-sm">{fs.id}</span>
            <span class="text-xs text-base-content/50">{ctx.describeTrigger(fs.trigger)}</span>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Name
              <input data-global="fs-name" data-fs={fs.id} type="text" bind:value={fs.name} class="input input-bordered input-sm" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Mode
              <select data-global="fs-mode" data-fs={fs.id} bind:value={fs.mode} class="select select-bordered select-sm">
                <option value="value">Momentary</option>
                <option value="toggle">Toggle</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Trigger
              <select data-global="fs-type" data-fs={fs.id} bind:value={fs.trigger.type} class="select select-bordered select-sm">
                <option value="cc">CC</option>
                <option value="pc">PC</option>
                <option value="note">NOTE</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Channel
              <input data-global="fs-channel" data-fs={fs.id} type="number" min="1" max="16" bind:value={fs.trigger.channel} class="input input-bordered input-sm" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Number
              <input data-global="fs-number" data-fs={fs.id} type="number" min="0" max="127" bind:value={fs.trigger.number} class="input input-bordered input-sm" />
            </label>
            <button class="btn btn-outline btn-sm" data-global="learn" data-fs={fs.id} on:click={(event) => learn(fs.id, event.currentTarget)}>Learn</button>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
    <div class="card-body gap-3">
      <div>
        <h3 class="card-title text-base">Expression pedals</h3>
        <p class="text-sm text-base-content/60">Four virtual pedals, assignable to any parameter from the Editor.</p>
      </div>
      {#each globals.expressionPedals as pedal (pedal.id)}
        <div class="rounded-box border border-base-300 bg-base-200 p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span class="badge badge-outline badge-sm">{pedal.id}</span>
            <span class="text-xs text-base-content/50">{ctx.describeTrigger(pedal.trigger)}</span>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Name
              <input data-global="fs-name" data-fs={pedal.id} type="text" bind:value={pedal.name} class="input input-bordered input-sm" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Trigger
              <select data-global="fs-type" data-fs={pedal.id} bind:value={pedal.trigger.type} class="select select-bordered select-sm">
                <option value="cc">CC</option>
                <option value="pc">PC</option>
                <option value="note">NOTE</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Channel
              <input data-global="fs-channel" data-fs={pedal.id} type="number" min="1" max="16" bind:value={pedal.trigger.channel} class="input input-bordered input-sm" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Number
              <input data-global="fs-number" data-fs={pedal.id} type="number" min="0" max="127" bind:value={pedal.trigger.number} class="input input-bordered input-sm" />
            </label>
            <button class="btn btn-outline btn-sm" data-global="learn" data-fs={pedal.id} on:click={(event) => learn(pedal.id, event.currentTarget)}>Learn</button>
          </div>
        </div>
      {/each}
      <label class="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 px-3 py-2">
        <span class="text-sm">Preset volume pedal <span class="block text-xs text-base-content/50">Controls volume in every preset.</span></span>
        <select data-global="volume-pedal" bind:value={globals.volumePedal} class="select select-bordered select-sm">
          <option value="">None</option>
          {#each globals.expressionPedals as pedal (pedal.id)}
            <option value={pedal.id}>{pedal.name}</option>
          {/each}
        </select>
      </label>
      <label class="flex items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
        <span>Interactive Live mode <span class="block text-xs text-base-content/50">Live expression meters can be dragged or arrow-keyed.</span></span>
        <input type="checkbox" data-global="interactive-live" bind:checked={globals.interactiveLive} class="toggle toggle-sm toggle-primary" />
      </label>
      <label class="flex items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
        <span>Absolute expression faders <span class="block text-xs text-base-content/50">Off slides from the pressed value; on maps touch position directly.</span></span>
        <input type="checkbox" data-global="absolute-expression" bind:checked={globals.absoluteExpression} class="toggle toggle-sm toggle-primary" />
      </label>
    </div>
  </section>

  <section class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body gap-3">
      <div>
        <h3 class="card-title text-base">Tempo</h3>
        <p class="text-sm text-base-content/60">Tap tempo is computed in the browser and written to synced delay blocks.</p>
      </div>
      <label class="flex items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
        Sync delay time to tap tempo
        <input type="checkbox" data-global="tempo-sync" checked={globals.tempoSync !== false} on:change={(event) => (globals.tempoSync = event.currentTarget.checked)} class="toggle toggle-sm toggle-primary" />
      </label>
      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1 text-xs text-base-content/60">Trigger type
          <select data-tap="type" bind:value={globals.tapTempoSwitch.trigger.type} class="select select-bordered select-sm">
            <option value="cc">CC</option>
            <option value="pc">PC</option>
            <option value="note">NOTE</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-base-content/60">Channel
          <input data-tap="channel" type="number" min="1" max="16" bind:value={globals.tapTempoSwitch.trigger.channel} class="input input-bordered input-sm" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-base-content/60">Number
          <input data-tap="number" type="number" min="0" max="127" bind:value={globals.tapTempoSwitch.trigger.number} class="input input-bordered input-sm" />
        </label>
        <button class="btn btn-outline btn-sm" data-global="learn" data-fs={globals.tapTempoSwitch.id} on:click={(event) => learn(globals.tapTempoSwitch.id, event.currentTarget)}>Learn</button>
      </div>
      <p class="text-xs text-base-content/50">{ctx.describeTrigger(globals.tapTempoSwitch.trigger)}</p>
    </div>
  </section>

  <section class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body gap-3">
      <h3 class="card-title text-base">Scenes</h3>
      <label class="flex items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
        Number of scenes
        <select data-global="scene-count" bind:value={globals.sceneCount} class="select select-bordered select-sm">
          {#each [3, 4, 5, 6] as count}
            <option value={count}>{count}</option>
          {/each}
        </select>
      </label>
      <p class="text-xs text-base-content/60">Base is always available. Choose up to six total scenes.</p>
    </div>
  </section>

  <section class="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
    <div class="card-body gap-3">
      <div>
        <h3 class="card-title text-base">Scene switches</h3>
        <p class="text-sm text-base-content/60">Each switch recalls the scene assigned to it.</p>
      </div>
      {#each globals.sceneSwitches as sw (sw.id)}
        <div class="rounded-box border border-base-300 bg-base-200 p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span class="badge badge-outline badge-sm">{sw.id}</span>
            <span class="text-xs text-base-content/50">{ctx.describeTrigger(sw.trigger)}</span>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Name
              <input data-global="scene-name" data-scene-id={sw.id} type="text" bind:value={sw.name} class="input input-bordered input-sm" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Recalls
              <select data-global="scene-target" data-scene-id={sw.id} bind:value={sw.scene} class="select select-bordered select-sm">
                {#each sceneTargets as value}
                  <option value={value}>{ctx.sceneName(value)}</option>
                {/each}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Trigger
              <select data-global="scene-type" data-scene-id={sw.id} bind:value={sw.trigger.type} class="select select-bordered select-sm">
                <option value="cc">CC</option>
                <option value="pc">PC</option>
                <option value="note">NOTE</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Channel
              <input data-global="scene-channel" data-scene-id={sw.id} type="number" min="1" max="16" bind:value={sw.trigger.channel} class="input input-bordered input-sm" />
            </label>
            <label class="flex flex-col gap-1 text-xs text-base-content/60">Number
              <input data-global="scene-number" data-scene-id={sw.id} type="number" min="0" max="127" bind:value={sw.trigger.number} class="input input-bordered input-sm" />
            </label>
            <button class="btn btn-outline btn-sm" data-global="learn" data-fs={sw.id} on:click={(event) => learn(sw.id, event.currentTarget)}>Learn</button>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body gap-3">
      <h3 class="card-title text-base">Device</h3>
      <label class="flex flex-col gap-1 text-xs text-base-content/60">Firmware (FX type lists)
        <select data-global="firmware" bind:value={globals.firmware} class="select select-bordered select-sm w-full">
          {#each FIRMWARE_OPTIONS as version}
            <option value={version}>{FIRMWARE_LABELS[version] ?? version}</option>
          {/each}
        </select>
      </label>
      <p class="text-xs text-base-content/50">Auto follows the 0x65 layout hint. Pick explicitly if Auto is wrong.</p>
      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1 text-xs text-base-content/60">MIDI channel
          <input data-global="midi-channel" type="number" min="1" max="16" bind:value={globals.midiChannel} class="input input-bordered input-sm" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-base-content/60">Preset recall
          <select data-global="recall-method" bind:value={globals.recallMethod} class="select select-bordered select-sm">
            <option value="sysex">Device preset recall</option>
            <option value="pc">Program Change</option>
          </select>
        </label>
      </div>
    </div>
  </section>

  <section class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body gap-3">
      <div>
        <h3 class="card-title text-base">Persistence</h3>
        <p class="text-sm text-base-content/60">Bindings stay in this browser, never on the pedal.</p>
      </div>
      <div class="join">
        <button class="btn btn-sm join-item" data-global="export" on:click={exportJson}>Export JSON</button>
        <button class="btn btn-sm join-item" data-global="import" on:click={() => fileInput?.click()}>Import JSON</button>
        <button class="btn btn-sm join-item text-error" data-global="reset" on:click={reset}>Reset everything</button>
      </div>
      <input bind:this={fileInput} id="import-file" type="file" accept="application/json" on:change={importJson} class="hidden" />
      <button class="btn btn-primary btn-sm justify-self-start" data-global="save" on:click={save}>Save globals</button>
    </div>
  </section>
</div>
