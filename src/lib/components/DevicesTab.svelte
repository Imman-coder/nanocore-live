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

<p class="text-xs text-muted">Select the NANOCORE ports before connecting — the choice is saved in this browser.</p>
<button data-devices-scan class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={() => ctx.scanPorts()}>Scan MIDI devices</button>

{#if !(ports.inputs.length || $app.connected)}
  <p class="text-muted">Scan MIDI devices or connect first to see the available ports.</p>
{:else}
  <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Send to NANOCORE</h3>
  {#if isWebMidi}
    {#each devicePorts.outputs as port (port.id)}
      <label class="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="radio" name="dev-output" value={port.id} bind:group={deviceOutputId} />
        {port.name} <span class="text-xs text-muted">{port.id}</span>
      </label>
    {/each}
  {:else}
    <p class="text-xs text-muted">Direct Bluetooth output ({devicePorts.outputs[0]?.name ?? 'BLE NANOCORE'}) — fixed.</p>
  {/if}

  <h3 class="mb-2 mt-3.5 text-xs uppercase tracking-[0.08em] text-muted">Receive from</h3>
  <p class="text-xs text-muted">Exactly one input should be the NANOCORE's reply port. Every other port you enable is treated as a footswitch / expression controller.</p>
  {#if ports.inputs.length}
    {#each ports.inputs as port (port.id)}
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-xs text-muted" title={`${port.name} · ${port.id}`}>
          <b>{port.name}</b><span class="text-xs text-muted">{port.id}</span>
        </div>
        <div class="text-xs text-muted">
          <label class="text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="radio" name="dev-input" value={port.id} bind:group={deviceInputId} /> NANOCORE replies</label>
          <label class="text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" data-dev-role={port.id} checked={enabledInputIds.includes(port.id) && port.id !== deviceInputId} on:change={(event) => toggleController(port.id, event.currentTarget.checked)} /> Controller input</label>
        </div>
      </div>
    {/each}
  {:else}
    <p class="text-xs text-muted">No MIDI inputs found.</p>
  {/if}

  <div class="mb-2.5 flex flex-wrap items-center gap-2" style="margin-top:14px">
    <button class="cursor-pointer rounded-lg border border-accent bg-accent px-3 py-1.5 font-[inherit] font-bold text-[#1a1206] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-dev="save" on:click={save}>Save device selection</button>
    <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-dev="refresh" on:click={() => ctx.render()}>Refresh ports</button>
    <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" data-dev="read" on:click={() => ctx.readSnapshot()}>Read snapshot now</button>
  </div>
{/if}

<p class="text-xs text-muted">Last device reply: {$app.lastReply ?? 'none'}</p>
<p class="text-xs text-muted">If the editor is blank after a recall, check that the NANOCORE input is set to "NANOCORE replies" and press Read snapshot now.</p>
