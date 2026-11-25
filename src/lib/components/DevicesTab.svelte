<script>
  import { app, ctx } from '../engine.js';

  $: ports = $app.ports ?? { inputs: [], outputs: [] };
  $: devicePorts = $app.devicePorts ?? { inputs: [], outputs: [] };
  $: selection = $app.state?.globals?.portSelection ?? {};
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

  export function save() {
    ctx.setPortSelection({
      deviceInputId: deviceInputId || null,
      deviceOutputId: deviceOutputId || ports.outputId || null,
      enabledInputIds: enabledInputIds.filter((id) => id !== deviceInputId),
    });
    ctx.notify('Device selection saved in this browser');
  }
</script>

<p class="muted small">Select the NANOCORE ports before connecting — the choice is saved in this browser.</p>
<button data-devices-scan on:click={() => ctx.scanPorts()}>Scan MIDI devices</button>

{#if !(ports.inputs.length || $app.connected)}
  <p class="muted">Scan MIDI devices or connect first to see the available ports.</p>
{:else}
  <h3>Send to NANOCORE</h3>
  {#if isWebMidi}
    {#each devicePorts.outputs as port (port.id)}
      <label class="field">
        <input type="radio" name="dev-output" value={port.id} bind:group={deviceOutputId} />
        {port.name} <span class="muted small">{port.id}</span>
      </label>
    {/each}
  {:else}
    <p class="muted small">Direct Bluetooth output ({devicePorts.outputs[0]?.name ?? 'BLE NANOCORE'}) — fixed.</p>
  {/if}

  <h3>Receive from</h3>
  <p class="muted small">Exactly one input should be the NANOCORE's reply port. Every other port you enable is treated as a footswitch / expression controller.</p>
  {#if ports.inputs.length}
    {#each ports.inputs as port (port.id)}
      <div class="port-row">
        <div class="port-id" title={`${port.name} · ${port.id}`}>
          <b>{port.name}</b><span class="muted small">{port.id}</span>
        </div>
        <div class="port-roles">
          <label><input type="radio" name="dev-input" value={port.id} bind:group={deviceInputId} /> NANOCORE replies</label>
          <label><input type="checkbox" data-dev-role={port.id} checked={enabledInputIds.includes(port.id) && port.id !== deviceInputId} on:change={(event) => toggleController(port.id, event.currentTarget.checked)} /> Controller input</label>
        </div>
      </div>
    {/each}
  {:else}
    <p class="muted small">No MIDI inputs found.</p>
  {/if}

  <div class="field" style="margin-top:14px">
    <button class="primary" data-dev="save" on:click={save}>Save device selection</button>
    <button data-dev="refresh" on:click={() => ctx.render()}>Refresh ports</button>
    <button data-dev="read" on:click={() => ctx.readSnapshot()}>Read snapshot now</button>
  </div>
{/if}

<p class="muted small">Last device reply: {$app.lastReply ?? 'none'}</p>
<p class="muted small">If the editor is blank after a recall, check that the NANOCORE input is set to "NANOCORE replies" and press Read snapshot now.</p>
