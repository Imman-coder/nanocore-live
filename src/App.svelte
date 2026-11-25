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
  class="flex h-screen flex-col"
  data-mode={mode}
  data-demo={$app.demo}
  data-fit={mode === 'live' && Boolean($app.state.globals.liveLayout?.fitScreen)}
>
  <header class="flex flex-none items-center gap-3 border-b border-line bg-panel px-4 py-2.5 max-[900px]:flex-wrap">
    <div class="mr-auto text-base tracking-[0.12em]">NANOCORE <b class="text-accent">LIVE</b>{#if $app.demo}<span class="ml-2 rounded-full border border-accent-2 px-1.5 py-0.5 text-[10px] text-accent-2">DEMO</span>{/if}</div>
    {#if mode !== 'start'}
      <button class="cursor-pointer rounded-lg border border-accent bg-accent px-3 py-1.5 font-[inherit] font-bold text-[#1a1206] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={switchMode} title="Long-press in Live to arrange the board">
        {mode === 'live' ? 'Editor' : 'Live'}
      </button>
    {/if}
    {#if mode !== 'start'}
      <div class="flex items-center gap-1.5">
        <button class="cursor-pointer rounded-lg border px-3 py-1.5 font-[inherit] hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 {tempo.bpm ? 'border-accent bg-accent font-bold text-[#1a1206]' : 'border-line bg-panel-2 text-inherit'}"
          on:click={() => ctx.tapTempo()} title="Tap to set BPM">TAP</button>
        <span class="min-w-7 text-center font-bold text-accent">{tempo.bpm ?? '—'}</span>
        <select aria-label="Time signature" value={tempo.signature}
          class="w-[68px] rounded-md border border-line bg-[#0f1319] px-2 py-1.5 font-[inherit] text-inherit"
          on:change={(event) => ctx.setTempo({ signature: event.currentTarget.value })}>
          {#each ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '3/8'] as signature}
            <option value={signature}>{signature}</option>
          {/each}
        </select>
      </div>
    {/if}
    <span class="rounded-full border px-2.5 py-1 text-xs {$app.connected ? 'border-accent-2 text-accent-2' : 'border-danger text-danger'}">{$app.status}</span>
    <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={toggleFullscreen} aria-label="Toggle fullscreen">⛶</button>
    <button class="cursor-pointer rounded-lg border border-line bg-panel-2 px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={openSettings} aria-label="Open settings">⚙</button>
  </header>

  <main class="flex min-h-0 flex-1 gap-3.5 overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-line max-[900px]:flex-col max-[900px]:p-2.5 {mode === 'live' && Boolean($app.state.globals.liveLayout?.fitScreen) ? 'overflow-hidden' : 'overflow-auto'} {mode === 'start' ? '!px-6 !py-6' : 'px-[18px] py-3.5'}">
    {#if mode === 'start'}
      <Start onOpenGlobals={() => { settingsTab = 'globals'; settingsOpen = true; }} />
    {:else if mode === 'live'}
      <Live />
    {:else}
      <Editor />
    {/if}
  </main>

  {#if $app.state.globals.showLogBar !== false}
    <footer class="flex flex-none items-center gap-2.5 border-t border-line bg-panel px-3.5 py-1.5 text-[11px] text-muted">
      <span class="font-bold text-text">MIDI</span>
      <div class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{$app.logLines.slice(-6).join('  |  ')}</div>
      <button class="cursor-pointer rounded-lg border border-line bg-transparent px-2 py-1 font-[inherit] text-xs text-inherit hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" on:click={() => window.__nanocoreClearLog?.()}>Clear</button>
    </footer>
  {/if}

  {#if $app.toast}
    <div class="fixed right-[18px] top-16 z-[70] max-w-[min(420px,80vw)] rounded-lg border border-accent bg-[#2b2418] px-3.5 py-2 text-[13px] text-text">{$app.toast}</div>
  {/if}

  <Settings open={settingsOpen} tab={settingsTab} onClose={closeSettings}
    onTab={(tab) => { settingsTab = tab; settingsOpen = true; }} />
</div>
