<script>
  import { app, ctx } from './lib/engine.js';
  import Start from './lib/components/Start.svelte';
  import Editor from './lib/components/Editor.svelte';
  import Live from './lib/components/Live.svelte';
  import Settings from './lib/components/Settings.svelte';

  let settingsOpen = false;
  let settingsTab = 'connection';
  $: mode = $app.state.mode;
  $: tempo = $app.state.globals.tempo ?? { bpm: null, signature: '4/4' };

  function openSettings() { settingsOpen = true; }
  function closeSettings() { settingsOpen = false; }
  function switchMode() { ctx.setMode(mode === 'live' ? 'editor' : 'live'); }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
</script>

<div
  class="shell"
  class:start-mode={mode === 'start'}
  class:demo-mode={$app.demo}
  class:hide-logbar={$app.state.globals.showLogBar === false}
  class:live-fit-screen={mode === 'live' && Boolean($app.state.globals.liveLayout?.fitScreen)}
>
  <header class="topbar">
    <div class="brand">NANOCORE <b>LIVE</b></div>
    {#if mode !== 'start'}
      <button class="primary" on:click={switchMode} title="Long-press in Live to arrange the board">
        {mode === 'live' ? 'Editor' : 'Live'}
      </button>
    {/if}
    {#if mode !== 'start'}
      <div class="tempo">
        <button class:active={Boolean(tempo.bpm)} on:click={() => ctx.tapTempo()} title="Tap to set BPM">TAP</button>
        <span class="bpm-count">{tempo.bpm ?? '—'}</span>
        <select aria-label="Time signature" value={tempo.signature}
          on:change={(event) => ctx.setTempo({ signature: event.currentTarget.value })}>
          {#each ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '3/8'] as signature}
            <option value={signature}>{signature}</option>
          {/each}
        </select>
      </div>
    {/if}
    <span class="status" class:online={$app.connected} class:offline={!$app.connected}>{$app.status}</span>
    <button class="icon" on:click={toggleFullscreen} aria-label="Toggle fullscreen">⛶</button>
    <button class="icon" on:click={openSettings} aria-label="Open settings">⚙</button>
  </header>

  <main class="workspace">
    {#if mode === 'start'}
      <Start onOpenGlobals={() => { settingsTab = 'globals'; settingsOpen = true; }} />
    {:else if mode === 'live'}
      <Live />
    {:else}
      <Editor />
    {/if}
  </main>

  {#if $app.state.globals.showLogBar !== false}
    <footer class="logbar">
      <span class="log-title">MIDI</span>
      <div class="log-lines">{$app.logLines.slice(-6).join('  |  ')}</div>
      <button class="ghost small" on:click={() => window.__nanocoreClearLog?.()}>Clear</button>
    </footer>
  {/if}

  {#if $app.toast}
    <div class="toast">{$app.toast}</div>
  {/if}

  <Settings open={settingsOpen} tab={settingsTab} onClose={closeSettings}
    onTab={(tab) => { settingsTab = tab; settingsOpen = true; }} />
</div>
