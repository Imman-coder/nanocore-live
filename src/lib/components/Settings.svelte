<script>
  import { stateView, uiView, ctx } from '../engine.js';
  import GlobalsTab from './GlobalsTab.svelte';
  import DevicesTab from './DevicesTab.svelte';

  export let open = false;
  export let tab = 'connection';
  export let onClose = () => {};
  export let onTab = () => {};

  const TABS = [
    { id: 'connection', label: 'Connection', note: 'Pedal & display' },
    { id: 'devices', label: 'MIDI devices', note: 'Port routing' },
    { id: 'globals', label: 'Globals', note: 'Triggers & data' },
  ];

  let devicesTab;
  let globalsTab;
  let devicesScanned = false;

  $: if (open && tab === 'devices' && !devicesScanned && !$uiView.connected
      && ($stateView.globals.transportKind ?? 'webmidi') !== 'webbluetooth' && ctx.scanPorts) {
    devicesScanned = true;
    Promise.resolve(ctx.scanPorts()).catch(() => { devicesScanned = false; });
  }

  function handleKeydown(event) {
    if (open && event.key === 'Escape') onClose();
  }

  function demoMode() {
    onClose();
    if ($uiView.demo) ctx.exitDemo();
    else ctx.connect('demo');
  }

  function editLiveLayout() {
    onClose();
    ctx.startLiveEdit();
  }

  function saveFooter() {
    if (tab === 'devices') devicesTab?.save();
    else if (tab === 'globals') globalsTab?.save();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="modal modal-open z-50" role="presentation">
    <div class="modal-box relative z-10 flex h-[min(780px,92vh)] w-[min(1000px,96vw)] max-w-none flex-col overflow-hidden rounded-2xl bg-base-200 p-0 shadow-2xl"
      role="dialog" aria-modal="true" aria-label="Settings">
      <header class="flex flex-none items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-5 py-3">
        <div class="min-w-0">
          <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-base-content/50">NANOCORE Live · setup</div>
          <h2 class="m-0 text-xl font-semibold leading-tight">Settings</h2>
        </div>
        <div class="flex flex-none items-center gap-2">
          <span id="status" class="badge badge-outline badge-sm {$uiView.connected ? 'badge-success' : 'badge-error'}">{$uiView.status}</span>
          <button class="btn btn-ghost btn-sm btn-square" aria-label="Close settings" on:click={onClose}>✕</button>
        </div>
      </header>

      <div class="tabs tabs-bordered flex-none gap-1 border-b border-base-300 bg-base-100 px-4 pt-2" role="tablist">
        {#each TABS as item, index (item.id)}
          <button role="tab" aria-selected={tab === item.id}
            class="tab gap-2 pb-2 h-fit {tab === item.id ? 'tab-active font-semibold text-primary' : ''}"
            on:click={() => onTab(item.id)}>
            <span class="badge badge-outline badge-sm">{String(index + 1).padStart(2, '0')}</span>
            <span class="flex flex-col items-start leading-none">
              <span class="text-sm">{item.label}</span>
              <span class="mt-0.5 text-[10px] font-normal text-base-content/50">{item.note}</span>
            </span>
          </button>
        {/each}
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-base-200 px-5 py-5">
        {#if tab === 'devices'}
          <DevicesTab bind:this={devicesTab} />
        {:else if tab === 'globals'}
          <GlobalsTab bind:this={globalsTab} />
        {:else}
          <div class="grid gap-4 lg:grid-cols-2">
            <section class="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
              <div class="card-body gap-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 class="card-title text-base">Pedal connection</h3>
                    <p class="text-sm text-base-content/60">Connect the hardware, or use the built-in simulator to explore the editor and live view.</p>
                  </div>
                  <span class="badge badge-success badge-outline badge-sm">{$uiView.transportKind ?? 'webmidi'}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button id="connect" class="btn btn-primary" on:click={() => ($uiView.connected ? ctx.disconnect() : ctx.connect())}>
                    {$uiView.connected ? 'Disconnect' : 'Connect to NANOCORE'}
                  </button>
                  <button data-action="demo-mode" class="btn btn-outline" on:click={demoMode}>
                    {$uiView.demo ? 'Exit demo mode' : 'Start demo mode'}
                  </button>
                </div>
                <p class="text-xs text-base-content/60">{$uiView.demo ? 'A simulated pedal is running locally. No MIDI messages leave this browser.' : 'Demo mode loads example presets and names so every control can be tried without hardware.'}</p>
                {#if $uiView.demo}
                  <div class="alert alert-warning py-1.5 text-xs">
                    <span>
                      <label class="flex flex-wrap items-center gap-2 text-sm">
                        <input class="checkbox checkbox-sm checkbox-primary" type="checkbox" data-setting="demo-use-real-data" checked={$uiView.demoUseRealData} on:change={(event) => ctx.setDemoUseRealData(event.currentTarget.checked)} />
                        Use my saved browser data in demo
                      </label>
                      <span class="mt-1 block text-xs opacity-70">{$uiView.demoUseRealData ? 'Demo edits will persist in this browser.' : 'Demo edits are sandboxed and discarded on exit.'}</span>
                    </span>
                  </div>
                {/if}
              </div>
            </section>

            <section class="card border border-base-300 bg-base-100 shadow-sm">
              <div class="card-body gap-3">
                <h3 class="card-title text-base">Transport</h3>
                <label class="flex flex-col gap-1 text-xs font-medium text-base-content/60" for="transport-kind">
                  MIDI transport
                  <select id="transport-kind" aria-label="Transport" value={$uiView.transportKind ?? 'webmidi'} class="select select-bordered select-sm w-full" on:change={(event) => ctx.setTransportKind(event.currentTarget.value)}>
                    <option value="webmidi">USB MIDI / paired Bluetooth MIDI</option>
                    <option value="webbluetooth">Direct Bluetooth (Web Bluetooth)</option>
                    <option value="demo">Demo mode (no pedal)</option>
                  </select>
                </label>
                <p class="text-xs text-base-content/60" id="capability-hint">{ctx.connectionHint()}</p>
                <div class="divider my-0 text-xs text-base-content/40">diagnostics</div>
                <p class="text-xs text-base-content/60">Last device reply: {$uiView.lastReply ?? 'none'}</p>
              </div>
            </section>

            <section class="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
              <div class="card-body gap-3">
                <div>
                  <h3 class="card-title text-base">Live display</h3>
                  <p class="text-sm text-base-content/60">Choose what the performance view shows.</p>
                </div>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label class="flex min-w-0 items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
                    <span class="min-w-0">Show MIDI message bar</span>
                    <input class="toggle toggle-sm toggle-primary flex-none" type="checkbox" checked={$stateView.globals.showLogBar !== false} on:change={(event) => ctx.setGlobalSetting('showLogBar', event.currentTarget.checked)} />
                  </label>
                  <label class="flex min-w-0 items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
                    <span class="min-w-0">Fit Live board to screen</span>
                    <input class="toggle toggle-sm toggle-primary flex-none" type="checkbox" checked={Boolean($stateView.globals.liveLayout?.fitScreen)} on:change={(event) => ctx.setLiveLayoutOption('fitScreen', event.currentTarget.checked)} />
                  </label>
                  <label class="flex min-w-0 items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
                    <span class="min-w-0">Hide assignments button</span>
                    <input class="toggle toggle-sm toggle-primary flex-none" type="checkbox" checked={Boolean($stateView.globals.hideAssignmentsButton)} on:change={(event) => ctx.setGlobalSetting('hideAssignmentsButton', event.currentTarget.checked)} />
                  </label>
                  <label class="flex min-w-0 items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
                    <span class="min-w-0">Hide Live preset label</span>
                    <input class="toggle toggle-sm toggle-primary flex-none" type="checkbox" checked={Boolean($stateView.globals.hideLivePresetLabel)} on:change={(event) => ctx.setGlobalSetting('hideLivePresetLabel', event.currentTarget.checked)} />
                  </label>
                  <label class="flex min-w-0 items-center justify-between gap-3 rounded-box bg-base-200 px-3 py-2 text-sm">
                    <span class="min-w-0">Hide preset selector in Live</span>
                    <input class="toggle toggle-sm toggle-primary flex-none" type="checkbox" checked={Boolean($stateView.globals.hideLivePresetSelector)} on:change={(event) => ctx.setGlobalSetting('hideLivePresetSelector', event.currentTarget.checked)} />
                  </label>
                </div>
                <button data-action="edit-live-layout" class="btn btn-primary btn-sm justify-self-start" on:click={editLiveLayout}>Edit Live layout</button>
              </div>
            </section>
          </div>
        {/if}
      </div>

      <footer class="flex flex-none items-center justify-between gap-2 border-t border-base-300 bg-base-100 px-5 py-3">
        <span class="badge badge-ghost badge-sm">Settings are stored in this browser</span>
        <div class="join">
          {#if tab === 'devices'}<button class="btn btn-primary join-item" on:click={saveFooter}>Save ports</button>{/if}
          {#if tab === 'globals'}<button class="btn btn-primary join-item" on:click={saveFooter}>Save globals</button>{/if}
          <button class="btn join-item" on:click={onClose}>Close</button>
        </div>
      </footer>
    </div>
    <button type="button" class="modal-backdrop z-0 cursor-default" aria-label="Close settings" on:click={onClose}></button>
  </div>
{/if}
