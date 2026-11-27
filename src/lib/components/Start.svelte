<script>
  import { createEventDispatcher } from 'svelte';
  import { stateView, snapshotView, feedbackView, uiView, ctx } from '../engine.js';
  import { FIRMWARE_OPTIONS } from '../../core/versions.js';

  export let onOpenGlobals = null;

  const dispatch = createEventDispatcher();

  $: selection = $stateView?.globals?.portSelection ?? {};
  $: ports = $uiView.ports ?? { inputs: [], outputs: [] };
  $: devicePorts = $uiView.devicePorts ?? { inputs: [], outputs: [] };
  $: catalog = $uiView.catalog ?? { busy: false, message: '', presets: 0, amp: 0, ir: 0 };
  $: isWebMidi = devicePorts.outputs.some((port) => port.type === 'output');

  let deviceInputId = '';
  let deviceOutputId = '';
  let enabledInputIds = [];
  $: {
    deviceInputId = selection.deviceInputId ?? ports.inputs.find((port) => port.role === 'device')?.id ?? '';
    deviceOutputId = selection.deviceOutputId ?? ports.outputId ?? '';
    enabledInputIds = selection.enabledInputIds ?? ports.inputs.filter((port) => port.role === 'controller').map((port) => port.id);
  }

  function toggleController(id, on) {
    enabledInputIds = on
      ? [...new Set([...enabledInputIds, id])]
      : enabledInputIds.filter((entry) => entry !== id);
  }

  function savePorts() {
    ctx.setPortSelection({
      deviceInputId: deviceInputId || null,
      deviceOutputId: deviceOutputId || ports.outputId || null,
      enabledInputIds: enabledInputIds.filter((id) => id !== deviceInputId),
    });
    ctx.notify('MIDI port selection saved in this browser');
  }

  function openGlobals() {
    if (onOpenGlobals) onOpenGlobals();
    else dispatch('openGlobals');
  }
</script>

<h2 class="m-0 mb-3 text-lg">Start <span class="text-xs text-muted">{$uiView.demo ? '— demo pedal is running' : '— set up the pedal before editing'}</span></h2>

{#if $uiView.demo}
  <div class="mb-3 rounded-xl border border-accent-2 bg-panel p-3.5 bg-[linear-gradient(120deg,#161a21,#162821)]">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Demo mode is running</h3>
    <p class="text-xs text-muted">A simulated NANOCORE is loaded with example presets, amp and cab names. Every control works locally; nothing is sent to hardware. Demo edits stay in this session unless you opt in to your saved data in Settings.</p>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <button class="btn btn-primary" on:click={() => ctx.setMode('editor')}>Continue to Editor</button>
      <button class="btn" on:click={() => ctx.setMode('live')}>Open Live view</button>
      <button class="btn" on:click={() => ctx.exitDemo()}>Exit demo mode</button>
    </div>
  </div>
{:else}
  <div class="mb-3 rounded-xl border border-accent-2 bg-panel p-3.5">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">No pedal connected? Try the demo</h3>
    <p class="text-xs text-muted">Explore the Editor and Live views with a simulated pedal and example names. One click, no hardware or permissions needed.</p>
    <button class="btn btn-primary" on:click={() => ctx.connect('demo')}>Try demo mode</button>
  </div>
{/if}

<div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-3">
  <section class="mb-3 min-w-0 card border border-base-300 bg-base-200 p-3.5">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">1. Connection</h3>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label for="start-transport" class="text-xs text-muted min-w-[90px]">Transport</label>
      <select id="start-transport" value={$uiView.transportKind ?? 'webmidi'} class="select select-bordered select-sm" on:change={(event) => ctx.setTransportKind(event.currentTarget.value)}>
        <option value="webmidi">USB MIDI / paired Bluetooth MIDI</option>
        <option value="webbluetooth">Direct Bluetooth (Web Bluetooth)</option>
        <option value="demo">Demo mode (no pedal)</option>
      </select>
    </div>
    <p class="text-xs text-muted">{$uiView.demo ? 'Demo mode uses a simulated pedal in this browser — no MIDI permissions or hardware are used.' : ctx.connectionHint()}</p>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <button class="btn btn-primary" on:click={() => ($uiView.connected ? ctx.disconnect() : ctx.connect())}>{$uiView.connected ? 'Disconnect' : 'Connect'}</button>
      <button class="btn" on:click={() => ctx.scanPorts()}>Scan MIDI devices</button>
      <button class="btn" on:click={() => ctx.readSnapshot()}>Read snapshot</button>
    </div>
    <p class="text-xs text-muted">Status: <b>{$uiView.connected ? 'connected' : 'disconnected'}</b> · {$uiView.status}</p>
  </section>

  <section class="mb-3 min-w-0 card border border-base-300 bg-base-200 p-3.5">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">2. MIDI ports</h3>
    {#if ports.inputs.length || $uiView.connected}
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted min-w-[90px]">Send to NANOCORE</label>
        {#if isWebMidi}
          <select data-port-output bind:value={deviceOutputId} class="select select-bordered select-sm">
            {#each devicePorts.outputs as port (port.id)}
              <option value={port.id}>{port.name}</option>
            {/each}
          </select>
        {:else}
          <span class="text-xs text-muted">Direct Bluetooth: {devicePorts.outputs[0]?.name ?? 'NANOCORE'}</span>
        {/if}
      </div>
      <p class="text-xs text-muted">Mark one input as the NANOCORE reply port; every other enabled input is a controller.</p>
      {#if ports.inputs.length}
        {#each ports.inputs as port (port.id)}
          <div class="flex flex-wrap items-center gap-2">
            <div class="text-xs text-muted" title={`${port.name} · ${port.id}`}>
              <b>{port.name}</b><span class="text-xs text-muted">{port.id}</span>
            </div>
            <div class="text-xs text-muted">
              <label class="text-xs text-muted"><input class="input input-bordered input-sm" type="radio" name="start-device-input" value={port.id} bind:group={deviceInputId} /> NANOCORE replies</label>
              <label class="text-xs text-muted"><input class="checkbox checkbox-sm checkbox-primary" type="checkbox" data-port-controller={port.id} checked={enabledInputIds.includes(port.id) && port.id !== deviceInputId} on:change={(event) => toggleController(port.id, event.currentTarget.checked)} /> Controller</label>
            </div>
          </div>
        {/each}
      {:else}
        <p class="text-xs text-muted">No MIDI inputs found.</p>
      {/if}
      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <button class="btn btn-primary" on:click={savePorts}>Save ports</button>
        <button class="btn" on:click={() => ctx.render()}>Refresh ports</button>
      </div>
    {:else}
      <p class="text-xs text-muted">Scan MIDI devices (or connect) to see the available ports.</p>
    {/if}
    <p class="text-xs text-muted">Last device reply: {$uiView.lastReply ?? 'none'}</p>
  </section>

  <section class="mb-3 min-w-0 card border border-base-300 bg-base-200 p-3.5">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">3. MIDI settings</h3>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label for="start-midi-channel" class="text-xs text-muted min-w-[90px]">MIDI channel</label>
      <input id="start-midi-channel" data-setting="midiChannel" type="number" min="1" max="16" value={$stateView.globals.midiChannel ?? 1} class="input input-bordered input-sm" on:change={(event) => ctx.setGlobalSetting('midiChannel', event.currentTarget.value)} />
    </div>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label for="start-recall" class="text-xs text-muted min-w-[90px]">Preset recall</label>
      <select id="start-recall" data-setting="recallMethod" value={($stateView.globals.recallMethod ?? 'sysex') === 'sysEx' ? 'sysEx' : 'cc'} class="select select-bordered select-sm" on:change={(event) => ctx.setGlobalSetting('recallMethod', event.currentTarget.value)}>
        <option value="cc">CC 0 / CC 32 / Program Change</option>
        <option value="sysEx">SysEx field 09</option>
      </select>
    </div>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <label for="start-firmware" class="text-xs text-muted min-w-[90px]">Firmware</label>
      <select id="start-firmware" data-setting="firmware" value={$stateView.globals.firmware ?? 'auto'} class="select select-bordered select-sm" on:change={(event) => ctx.setGlobalSetting('firmware', event.currentTarget.value)}>
        {#each FIRMWARE_OPTIONS as version}
          <option value={version}>{version}</option>
        {/each}
      </select>
    </div>
    <p class="text-xs text-muted">Footswitch, scene, expression and tap-tempo triggers are configured in Globals.</p>
    <button class="btn" on:click={openGlobals}>Open Globals</button>
  </section>

  <section class="mb-3 min-w-0 card border border-base-300 bg-base-200 p-3.5">
    <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">4. Names from the pedal</h3>
    <p class="text-xs text-muted">Fetched once on connect so the pedal is not flooded. When the names are in, the Editor opens automatically.</p>
    <div class="mb-2.5 flex flex-wrap items-center gap-2">
      <button class="btn btn-primary" disabled={!$uiView.connected || catalog.busy} on:click={() => ctx.refreshCatalog('all')}>{catalog.busy ? 'Fetching…' : 'Fetch all'}</button>
      <button class="btn" disabled={!$uiView.connected || catalog.busy} on:click={() => ctx.refreshCatalog('presets')}>Preset names</button>
      <button class="btn" disabled={!$uiView.connected || catalog.busy} on:click={() => ctx.refreshCatalog('amp')}>Amp names</button>
      <button class="btn" disabled={!$uiView.connected || catalog.busy} on:click={() => ctx.refreshCatalog('ir')}>Cab names</button>
    </div>
    <p class="text-xs text-muted">Presets: <b>{catalog.presets}</b> · Amp models: <b>{catalog.amp}</b> · IR models: <b>{catalog.ir}</b></p>
    <p class="text-xs text-muted">{catalog.message || 'No fetch has been run yet in this session.'}</p>
  </section>
</div>

{#if $uiView.connected}
  <div class="mb-2.5 flex flex-wrap items-center gap-2" style="margin-top:14px">
    <button class="btn btn-primary" on:click={() => ctx.setMode('editor')}>Continue to Editor</button>
    <button class="btn" on:click={() => ctx.setMode('live')}>Open Live view</button>
    {#if $uiView.demo}<button class="btn" on:click={() => ctx.exitDemo()}>Exit demo mode</button>{/if}
  </div>
{/if}
