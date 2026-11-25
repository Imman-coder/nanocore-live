<script>
  import { app, ctx } from '../engine.js';
  import GlobalsTab from './GlobalsTab.svelte';
  import DevicesTab from './DevicesTab.svelte';

  export let open = false;
  export let tab = 'connection';
  export let onClose = () => {};
  export let onTab = () => {};

  const TABS = [
    { id: 'connection', label: 'Connection' },
    { id: 'devices', label: 'MIDI devices' },
    { id: 'globals', label: 'Globals' },
  ];

  let devicesTab;
  let globalsTab;
  let devicesScanned = false;

  $: if (open && tab === 'devices' && !devicesScanned && !$app.connected
      && ($app.state.globals.transportKind ?? 'webmidi') !== 'webbluetooth' && ctx.scanPorts) {
    devicesScanned = true;
    Promise.resolve(ctx.scanPorts()).catch(() => { devicesScanned = false; });
  }

  function handleKeydown(event) {
    if (open && event.key === 'Escape') onClose();
  }

  function handleBackdrop(event) {
    if (event.target === event.currentTarget) onClose();
  }

  function demoMode() {
    onClose();
    if ($app.demo) ctx.exitDemo();
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
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60" role="presentation" on:click={handleBackdrop}>
    <div class="flex h-[min(720px,88vh)] w-[min(920px,94vw)] flex-col overflow-hidden rounded-[14px] border border-line bg-panel p-4" role="dialog" aria-modal="true" aria-label="Settings" on:click|stopPropagation>
      <div class="mb-2.5 flex flex-none items-center justify-between"><h2 class="m-0 mb-3 text-lg">Settings</h2><button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={onClose}>Close</button></div>
      <div class="flex flex-none gap-1.5 border-b border-line pb-2" role="tablist">
        {#each TABS as item (item.id)}
          <button role="tab" aria-selected={tab === item.id}
            class="cursor-pointer rounded-lg border px-3 py-1.5 font-[inherit] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {tab === item.id ? 'border-accent bg-accent font-bold text-[#1a1206]' : 'border-line bg-panel-2 text-inherit'}"
            on:click={() => onTab(item.id)}>{item.label}</button>
        {/each}
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2.5">
        {#if tab === 'devices'}
          <p class="text-xs text-muted">Select the NANOCORE ports before connecting — the choice is saved in this browser.</p>
          <DevicesTab bind:this={devicesTab} />
        {:else if tab === 'globals'}
          <GlobalsTab bind:this={globalsTab} />
        {:else}
          <div class="flex flex-wrap items-center gap-2">
            <button id="connect" class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={() => ($app.connected ? ctx.disconnect() : ctx.connect())}>{$app.connected ? 'Disconnect' : 'Connect'}</button>
            <span id="status" class="rounded-full border px-2.5 py-1 text-xs {$app.connected ? 'border-accent-2 text-accent-2' : 'border-danger text-danger'}">{$app.status}</span>
          </div>
          <button data-action="demo-mode"
            class="cursor-pointer rounded-lg border px-3 py-1.5 font-[inherit] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {!$app.demo ? 'border-accent bg-accent font-bold text-[#1a1206]' : 'border-line bg-panel-2 text-inherit'}"
            on:click={demoMode}>{$app.demo ? 'Exit demo mode' : 'Start demo mode (no pedal)'}</button>
          <p class="text-xs text-muted">{$app.demo ? 'A simulated pedal is running locally. No MIDI messages leave this browser.' : 'Demo mode loads example presets and names so the Editor and Live views can be explored without hardware.'}</p>
          {#if $app.demo}
            <label class="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-accent-2 px-2.5 py-2 text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" data-setting="demo-use-real-data" checked={$app.demoUseRealData} on:change={(event) => ctx.setDemoUseRealData(event.currentTarget.checked)} /> Use my actual saved settings and data in demo (edits will change what this browser stores)</label>
            <p class="text-xs text-muted">{$app.demoUseRealData ? 'Demo is using your real saved data — changes persist in this browser.' : 'Demo edits are sandboxed: settings, assignments and layouts you change here are discarded when you exit.'}</p>
          {/if}
          <div class="mb-2.5 flex flex-wrap items-center gap-2">
            <label for="transport-kind" class="text-xs text-muted min-w-[90px]">Transport</label>
            <select id="transport-kind" aria-label="Transport" value={$app.transportKind ?? 'webmidi'} class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" on:change={(event) => ctx.setTransportKind(event.currentTarget.value)}>
              <option value="webmidi">USB MIDI / paired Bluetooth MIDI</option>
              <option value="webbluetooth">Direct Bluetooth (Web Bluetooth)</option>
              <option value="demo">Demo mode (no pedal)</option>
            </select>
          </div>
          <label class="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" checked={$app.state.globals.showLogBar !== false} on:change={(event) => ctx.setGlobalSetting('showLogBar', event.currentTarget.checked)} /> Show bottom MIDI message bar</label>
          <label class="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" checked={Boolean($app.state.globals.hideAssignmentsButton)} on:change={(event) => ctx.setGlobalSetting('hideAssignmentsButton', event.currentTarget.checked)} /> Hide "Show parameter assignments" button</label>
          <label class="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" checked={Boolean($app.state.globals.hideLivePresetLabel)} on:change={(event) => ctx.setGlobalSetting('hideLivePresetLabel', event.currentTarget.checked)} /> Hide "Live — NANOCORE preset" label</label>
          <label class="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" checked={Boolean($app.state.globals.liveLayout?.hideSidebar)} on:change={(event) => ctx.setLiveLayoutOption('hideSidebar', event.currentTarget.checked)} /> Hide Live left sidebar</label>
          <label class="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted"><input class="rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit" type="checkbox" checked={Boolean($app.state.globals.liveLayout?.fitScreen)} on:change={(event) => ctx.setLiveLayoutOption('fitScreen', event.currentTarget.checked)} /> Fit Live board to screen (no scrolling)</label>
          <button data-action="edit-live-layout" class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={editLiveLayout}>Edit Live layout</button>
          <p class="text-xs text-muted" id="capability-hint">{ctx.connectionHint()}</p>
          <p class="text-xs text-muted">Last device reply: {$app.lastReply ?? 'none'}</p>
        {/if}
      </div>
      <div class="flex flex-none justify-end gap-2 border-t border-line pt-2.5">
        {#if tab === 'devices'}<button class="cursor-pointer rounded-lg border border-accent bg-accent px-3 py-1.5 font-[inherit] font-bold text-[#1a1206] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={saveFooter}>Save ports</button>{/if}
        {#if tab === 'globals'}<button class="cursor-pointer rounded-lg border border-accent bg-accent px-3 py-1.5 font-[inherit] font-bold text-[#1a1206] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={saveFooter}>Save globals</button>{/if}
        <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-[inherit] text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={onClose}>Close</button>
      </div>
    </div>
  </div>
{/if}
