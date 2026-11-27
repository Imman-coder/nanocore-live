<script>
  import { stateView, snapshotView, feedbackView, uiView, ctx } from '../engine.js';

  $: ports = $uiView.ports ?? { inputs: [], outputs: [] };
  $: devicePorts = $uiView.devicePorts ?? { inputs: [], outputs: [] };
  $: selection = $stateView?.globals?.portSelection ?? {};
  $: isWebMidi = devicePorts.outputs.some((port) => port.type === 'output');

  let deviceInputId = '';
  let deviceOutputId = '';
  let enabledInputIds = [];
  let lastPortSignature = '';
  $: {
    const signature = JSON.stringify([selection, ports.inputs.map((port) => port.id), ports.outputId]);
    if (signature !== lastPortSignature) {
      lastPortSignature = signature;
      deviceInputId = selection.deviceInputId ?? ports.inputs.find((port) => port.role === 'device')?.id ?? '';
      deviceOutputId = selection.deviceOutputId ?? ports.outputId ?? '';
      enabledInputIds = selection.enabledInputIds ?? ports.inputs.filter((port) => port.role === 'controller').map((port) => port.id);
    }
  }

  // Web MIDI names often include bus IDs, channel counts and parenthetical
  // strings. Keep a readable label; the full name stays in the row tooltip.
  function shortPortName(port) {
    const raw = String(port?.name ?? port?.id ?? 'Port');
    const label = raw
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\bMIDI\b/gi, '')
      .replace(/\b\d+\s*[-–]\s*(?:channel|DIN|port)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return label.length > 24 ? `${label.slice(0, 23)}…` : label || 'Port';
  }

  // One row per device name: its reply input, output and controller input.
  $: rows = (() => {
    const grouped = new Map();
    for (const port of ports.inputs ?? []) {
      const name = shortPortName(port);
      const row = grouped.get(name) ?? { name, input: null, output: null };
      if (!row.input) row.input = port;
      grouped.set(name, row);
    }
    for (const port of devicePorts.outputs ?? []) {
      const name = shortPortName(port);
      const row = grouped.get(name) ?? { name, input: null, output: null };
      if (!row.output) row.output = port;
      grouped.set(name, row);
    }
    return [...grouped.values()];
  })();

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

<div class="mb-3 flex flex-wrap items-end justify-between gap-2">
  <div class="min-w-0">
    <h2 class="m-0 mb-3 text-lg">MIDI devices</h2>
    <p class="text-muted text-xs">Choose the pedal's reply input, send output and any controller inputs.</p>
  </div>
  <button data-devices-scan class="btn" on:click={() => ctx.scanPorts()}>Scan devices</button>
</div>

{#if !(ports.inputs.length || $uiView.connected)}
  <div class="alert">Scan MIDI devices or connect first to see the available ports.</div>
{:else}
  <div class="card mb-3 overflow-x-auto border border-base-300 bg-base-200">
    <table class="table table-xs w-full">
      <thead>
        <tr>
          <th>Name</th>
          <th>NANOCORE receive</th>
          <th>NANOCORE send</th>
          <th>Controller receive</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.name)}
          <tr>
            <td class="font-semibold" title={row.input?.name ?? row.output?.name}>{row.name}</td>
            <td>
              {#if row.input}
                <input class="radio radio-sm radio-primary" type="radio" name="dev-input" value={row.input.id} bind:group={deviceInputId} aria-label={`${row.name} replies`} />
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>
            <td>
              {#if row.output}
                {#if isWebMidi}
                  <input class="radio radio-sm radio-primary" type="radio" name="dev-output" value={row.output.id} bind:group={deviceOutputId} aria-label={`${row.name} send`} />
                {:else}
                  <span class="badge badge-outline badge-sm">Fixed</span>
                {/if}
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>
            <td>
              {#if row.input}
                <input class="checkbox checkbox-sm checkbox-primary" type="checkbox" data-dev-role={row.input.id} checked={enabledInputIds.includes(row.input.id) && row.input.id !== deviceInputId} on:change={(event) => toggleController(row.input.id, event.currentTarget.checked)} aria-label={`${row.name} controller`} />
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- <div class="card mb-0 flex flex-row items-center gap-2 border border-base-300 bg-base-200"> -->
    <button class="btn" data-dev="refresh" on:click={() => ctx.render()}>Refresh ports</button>
    <button class="btn" data-dev="read" on:click={() => ctx.readSnapshot()}>Read snapshot now</button>
    <button class="btn btn-primary" data-dev="save" on:click={save}>Save device selection</button>
  <!-- </div> -->
{/if}

<p class="mt-3 text-xs text-muted">Last device reply: {$uiView.lastReply ?? 'none'}</p>
