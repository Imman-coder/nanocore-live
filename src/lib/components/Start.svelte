<script>
  import { createEventDispatcher } from 'svelte';
  import { app, ctx } from '../engine.js';
  import { FIRMWARE_OPTIONS } from '../../core/versions.js';

  export let onOpenGlobals = null;

  const dispatch = createEventDispatcher();

  $: selection = $app.state?.globals?.portSelection ?? {};
  $: ports = $app.ports ?? { inputs: [], outputs: [] };
  $: devicePorts = $app.devicePorts ?? { inputs: [], outputs: [] };
  $: catalog = $app.catalog ?? { busy: false, message: '', presets: 0, amp: 0, ir: 0 };
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

<h2>Start <span class="muted small">{$app.demo ? '— demo pedal is running' : '— set up the pedal before editing'}</span></h2>

{#if $app.demo}
  <div class="card demo-card active">
    <h3>Demo mode is running</h3>
    <p class="muted small">A simulated NANOCORE is loaded with example presets, amp and cab names. Every control works locally; nothing is sent to hardware. Demo edits stay in this session unless you opt in to your saved data in Settings.</p>
    <div class="row-actions">
      <button class="primary" on:click={() => ctx.setMode('editor')}>Continue to Editor</button>
      <button on:click={() => ctx.setMode('live')}>Open Live view</button>
      <button on:click={() => ctx.exitDemo()}>Exit demo mode</button>
    </div>
  </div>
{:else}
  <div class="card demo-card">
    <h3>No pedal connected? Try the demo</h3>
    <p class="muted small">Explore the Editor and Live views with a simulated pedal and example names. One click, no hardware or permissions needed.</p>
    <button class="primary" on:click={() => ctx.connect('demo')}>Try demo mode</button>
  </div>
{/if}

<div class="start-grid">
  <section class="card start-step">
    <h3>1. Connection</h3>
    <div class="field">
      <label for="start-transport">Transport</label>
      <select id="start-transport" value={$app.transportKind ?? 'webmidi'} on:change={(event) => ctx.setTransportKind(event.currentTarget.value)}>
        <option value="webmidi">USB MIDI / paired Bluetooth MIDI</option>
        <option value="webbluetooth">Direct Bluetooth (Web Bluetooth)</option>
        <option value="demo">Demo mode (no pedal)</option>
      </select>
    </div>
    <p class="muted small">{$app.demo ? 'Demo mode uses a simulated pedal in this browser — no MIDI permissions or hardware are used.' : ctx.connectionHint()}</p>
    <div class="row-actions">
      <button class="primary" on:click={() => ($app.connected ? ctx.disconnect() : ctx.connect())}>{$app.connected ? 'Disconnect' : 'Connect'}</button>
      <button on:click={() => ctx.scanPorts()}>Scan MIDI devices</button>
      <button on:click={() => ctx.readSnapshot()}>Read snapshot</button>
    </div>
    <p class="muted small">Status: <b>{$app.connected ? 'connected' : 'disconnected'}</b> · {$app.status}</p>
  </section>

  <section class="card start-step">
    <h3>2. MIDI ports</h3>
    {#if ports.inputs.length || $app.connected}
      <div class="field">
        <label>Send to NANOCORE</label>
        {#if isWebMidi}
          <select data-port-output bind:value={deviceOutputId}>
            {#each devicePorts.outputs as port (port.id)}
              <option value={port.id}>{port.name}</option>
            {/each}
          </select>
        {:else}
          <span class="muted small">Direct Bluetooth: {devicePorts.outputs[0]?.name ?? 'NANOCORE'}</span>
        {/if}
      </div>
      <p class="muted small">Mark one input as the NANOCORE reply port; every other enabled input is a controller.</p>
      {#if ports.inputs.length}
        {#each ports.inputs as port (port.id)}
          <div class="port-row">
            <div class="port-id" title={`${port.name} · ${port.id}`}>
              <b>{port.name}</b><span class="muted small">{port.id}</span>
            </div>
            <div class="port-roles">
              <label><input type="radio" name="start-device-input" value={port.id} bind:group={deviceInputId} /> NANOCORE replies</label>
              <label><input type="checkbox" data-port-controller={port.id} checked={enabledInputIds.includes(port.id) && port.id !== deviceInputId} on:change={(event) => toggleController(port.id, event.currentTarget.checked)} /> Controller</label>
            </div>
          </div>
        {/each}
      {:else}
        <p class="muted small">No MIDI inputs found.</p>
      {/if}
      <div class="row-actions">
        <button class="primary" on:click={savePorts}>Save ports</button>
        <button on:click={() => ctx.render()}>Refresh ports</button>
      </div>
    {:else}
      <p class="muted small">Scan MIDI devices (or connect) to see the available ports.</p>
    {/if}
    <p class="muted small">Last device reply: {$app.lastReply ?? 'none'}</p>
  </section>

  <section class="card start-step">
    <h3>3. MIDI settings</h3>
    <div class="field">
      <label for="start-midi-channel">MIDI channel</label>
      <input id="start-midi-channel" data-setting="midiChannel" type="number" min="1" max="16" value={$app.state.globals.midiChannel ?? 1} on:change={(event) => ctx.setGlobalSetting('midiChannel', event.currentTarget.value)} />
    </div>
    <div class="field">
      <label for="start-recall">Preset recall</label>
      <select id="start-recall" data-setting="recallMethod" value={($app.state.globals.recallMethod ?? 'sysex') === 'sysEx' ? 'sysEx' : 'cc'} on:change={(event) => ctx.setGlobalSetting('recallMethod', event.currentTarget.value)}>
        <option value="cc">CC 0 / CC 32 / Program Change</option>
        <option value="sysEx">SysEx field 09</option>
      </select>
    </div>
    <div class="field">
      <label for="start-firmware">Firmware</label>
      <select id="start-firmware" data-setting="firmware" value={$app.state.globals.firmware ?? 'auto'} on:change={(event) => ctx.setGlobalSetting('firmware', event.currentTarget.value)}>
        {#each FIRMWARE_OPTIONS as version}
          <option value={version}>{version}</option>
        {/each}
      </select>
    </div>
    <p class="muted small">Footswitch, scene, expression and tap-tempo triggers are configured in Globals.</p>
    <button on:click={openGlobals}>Open Globals</button>
  </section>

  <section class="card start-step">
    <h3>4. Names from the pedal</h3>
    <p class="muted small">Fetched once on connect so the pedal is not flooded. When the names are in, the Editor opens automatically.</p>
    <div class="row-actions">
      <button class="primary" disabled={!$app.connected || catalog.busy} on:click={() => ctx.refreshCatalog('all')}>{catalog.busy ? 'Fetching…' : 'Fetch all'}</button>
      <button disabled={!$app.connected || catalog.busy} on:click={() => ctx.refreshCatalog('presets')}>Preset names</button>
      <button disabled={!$app.connected || catalog.busy} on:click={() => ctx.refreshCatalog('amp')}>Amp names</button>
      <button disabled={!$app.connected || catalog.busy} on:click={() => ctx.refreshCatalog('ir')}>Cab names</button>
    </div>
    <p class="muted small">Presets: <b>{catalog.presets}</b> · Amp models: <b>{catalog.amp}</b> · IR models: <b>{catalog.ir}</b></p>
    <p class="muted small">{catalog.message || 'No fetch has been run yet in this session.'}</p>
  </section>
</div>

{#if $app.connected}
  <div class="row-actions" style="margin-top:14px">
    <button class="primary" on:click={() => ctx.setMode('editor')}>Continue to Editor</button>
    <button on:click={() => ctx.setMode('live')}>Open Live view</button>
    {#if $app.demo}<button on:click={() => ctx.exitDemo()}>Exit demo mode</button>{/if}
  </div>
{/if}
