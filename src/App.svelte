<script>
  import { stateView, snapshotView, feedbackView, uiView, ctx } from './lib/engine.js';
  import Start from './lib/components/Start.svelte';
  import Editor from './lib/components/Editor.svelte';
  import Live from './lib/components/Live.svelte';
  import Settings from './lib/components/Settings.svelte';

  let settingsOpen = false;
  let settingsTab = 'connection';
  $: mode = $stateView.mode;
  $: tempo = $stateView.globals.tempo ?? { bpm: null, signature: '4/4' };

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
  data-demo={$uiView.demo}
  data-fit={mode === 'live' && Boolean($stateView.globals.liveLayout?.fitScreen)}
>
  <header class="flex flex-none items-center gap-3 border-b border-base-300 bg-base-200 px-4 py-2.5 max-[900px]:flex-wrap">
    <div class="mr-auto text-base tracking-[0.12em]">NANOCORE <b class="text-accent">LIVE</b>{#if $uiView.demo}<span class="badge badge-outline badge-success badge-sm ml-2">DEMO</span>{/if}</div>
    {#if mode !== 'start'}
      <button class="btn btn-primary" on:click={switchMode} title="Long-press in Live to arrange the board">
        {mode === 'live' ? 'Editor' : 'Live'}
      </button>
    {/if}
    {#if mode !== 'start'}
      <div class="flex items-center gap-1.5">
        <button class="btn {tempo.bpm ? 'btn-primary' : ''}" disabled={mode === 'live' && Boolean($stateView.liveEditing)} on:click={() => ctx.tapTempo()} title="Tap to set BPM">TAP</button>
        <span class="min-w-7 text-center font-bold text-accent">{tempo.bpm ?? '—'}</span>
        <select aria-label="Time signature" value={tempo.signature}
          class="w-[68px] select select-bordered select-sm"
          on:change={(event) => ctx.setTempo({ signature: event.currentTarget.value })}>
          {#each ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '3/8'] as signature}
            <option value={signature}>{signature}</option>
          {/each}
        </select>
      </div>
    {/if}
    <span class="rounded-full border px-2.5 py-1 text-xs {$uiView.connected ? 'border-secondary text-secondary' : 'border-danger text-danger'}">{$uiView.status}</span>
    <button class="btn btn-sm" on:click={toggleFullscreen} aria-label="Toggle fullscreen">⛶</button>
    <button class="btn btn-sm" on:click={openSettings} aria-label="Open settings">⚙</button>
  </header>

  <main class="flex min-h-0 flex-1 gap-3.5 overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-lg [&::-webkit-scrollbar-thumb]:bg-line max-[900px]:flex-col max-[900px]:p-2.5 {mode === 'live' && Boolean($stateView.globals.liveLayout?.fitScreen) ? 'overflow-hidden' : 'overflow-auto'} {mode === 'start' ? '!px-6 !py-6' : 'px-[18px] py-3.5'}">
    {#if mode === 'start'}
      <Start onOpenGlobals={() => { settingsTab = 'globals'; settingsOpen = true; }} />
    {:else if mode === 'live'}
      <Live />
    {:else}
      <Editor />
    {/if}
  </main>

  {#if $stateView.globals.showLogBar !== false}
    <footer class="flex flex-none items-center gap-2.5 border-t border-base-300 bg-base-200 px-3.5 py-1.5 text-[11px] text-base-content/60">
      <span class="font-bold text-base-content">MIDI</span>
      <div class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{$uiView.logLines.slice(-6).join('  |  ')}</div>
      <button class="btn btn-ghost btn-sm" on:click={() => window.__nanocoreClearLog?.()}>Clear</button>
    </footer>
  {/if}

  {#if $uiView.toast}
    <div class="fixed right-[18px] top-16 z-[70] max-w-[min(420px,80vw)] rounded-lg border border-accent bg-base-300 px-3.5 py-2 text-[13px] text-base-content">{$uiView.toast}</div>
  {/if}

  <Settings open={settingsOpen} tab={settingsTab} onClose={closeSettings}
    onTab={(tab) => { settingsTab = tab; settingsOpen = true; }} />
</div>
