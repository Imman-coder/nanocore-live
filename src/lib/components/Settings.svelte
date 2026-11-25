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
  <div class="modal-backdrop" role="presentation" on:click={handleBackdrop}>
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Settings" on:click|stopPropagation>
      <div class="modal-head"><h2>Settings</h2><button class="small" on:click={onClose}>Close</button></div>
      <div class="settings-tabs" role="tablist">
        {#each TABS as item (item.id)}
          <button role="tab" aria-selected={tab === item.id} class:active={tab === item.id} on:click={() => onTab(item.id)}>{item.label}</button>
        {/each}
      </div>
      <div class="settings-panel">
        {#if tab === 'devices'}
          <p class="muted small">Select the NANOCORE ports before connecting — the choice is saved in this browser.</p>
          <DevicesTab bind:this={devicesTab} />
        {:else if tab === 'globals'}
          <GlobalsTab bind:this={globalsTab} />
        {:else}
          <div class="transport">
            <button id="connect" on:click={() => ($app.connected ? ctx.disconnect() : ctx.connect())}>{$app.connected ? 'Disconnect' : 'Connect'}</button>
            <span id="status" class="status {$app.connected ? 'online' : 'offline'}">{$app.status}</span>
          </div>
          <button data-action="demo-mode" class:primary={!$app.demo} on:click={demoMode}>{$app.demo ? 'Exit demo mode' : 'Start demo mode (no pedal)'}</button>
          <p class="muted small">{$app.demo ? 'A simulated pedal is running locally. No MIDI messages leave this browser.' : 'Demo mode loads example presets and names so the Editor and Live views can be explored without hardware.'}</p>
          {#if $app.demo}
            <label class="field demo-data-option"><input type="checkbox" data-setting="demo-use-real-data" checked={$app.demoUseRealData} on:change={(event) => ctx.setDemoUseRealData(event.currentTarget.checked)} /> Use my actual saved settings and data in demo (edits will change what this browser stores)</label>
            <p class="muted small">{$app.demoUseRealData ? 'Demo is using your real saved data — changes persist in this browser.' : 'Demo edits are sandboxed: settings, assignments and layouts you change here are discarded when you exit.'}</p>
          {/if}
          <div class="field">
            <label for="transport-kind">Transport</label>
            <select id="transport-kind" aria-label="Transport" value={$app.transportKind ?? 'webmidi'} on:change={(event) => ctx.setTransportKind(event.currentTarget.value)}>
              <option value="webmidi">USB MIDI / paired Bluetooth MIDI</option>
              <option value="webbluetooth">Direct Bluetooth (Web Bluetooth)</option>
              <option value="demo">Demo mode (no pedal)</option>
            </select>
          </div>
          <label class="field"><input type="checkbox" checked={$app.state.globals.showLogBar !== false} on:change={(event) => ctx.setGlobalSetting('showLogBar', event.currentTarget.checked)} /> Show bottom MIDI message bar</label>
          <label class="field"><input type="checkbox" checked={Boolean($app.state.globals.hideAssignmentsButton)} on:change={(event) => ctx.setGlobalSetting('hideAssignmentsButton', event.currentTarget.checked)} /> Hide "Show parameter assignments" button</label>
          <label class="field"><input type="checkbox" checked={Boolean($app.state.globals.hideLivePresetLabel)} on:change={(event) => ctx.setGlobalSetting('hideLivePresetLabel', event.currentTarget.checked)} /> Hide "Live — NANOCORE preset" label</label>
          <label class="field"><input type="checkbox" checked={Boolean($app.state.globals.liveLayout?.hideSidebar)} on:change={(event) => ctx.setLiveLayoutOption('hideSidebar', event.currentTarget.checked)} /> Hide Live left sidebar</label>
          <label class="field"><input type="checkbox" checked={Boolean($app.state.globals.liveLayout?.fitScreen)} on:change={(event) => ctx.setLiveLayoutOption('fitScreen', event.currentTarget.checked)} /> Fit Live board to screen (no scrolling)</label>
          <button data-action="edit-live-layout" on:click={editLiveLayout}>Edit Live layout</button>
          <p class="muted small" id="capability-hint">{ctx.connectionHint()}</p>
          <p class="muted small">Last device reply: {$app.lastReply ?? 'none'}</p>
        {/if}
      </div>
      <div class="settings-footer">
        {#if tab === 'devices'}<button class="primary" on:click={saveFooter}>Save ports</button>{/if}
        {#if tab === 'globals'}<button class="primary" on:click={saveFooter}>Save globals</button>{/if}
        <button on:click={onClose}>Close</button>
      </div>
    </div>
  </div>
{/if}
