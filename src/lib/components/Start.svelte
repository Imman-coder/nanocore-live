<script>
  import { uiView, ctx } from '../engine.js';

  function connectDevice() {
    const useBle = !$uiView.capabilities?.midi && $uiView.capabilities?.bluetooth;
    ctx.connect(useBle ? 'webbluetooth' : undefined);
  }

  function connectBle() {
    ctx.connect('webbluetooth');
  }
</script>

<div class="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
  <div class="flex w-full max-w-2xl flex-col items-center gap-7 text-center">

    <div class="flex flex-col items-center gap-1">
      <p class="m-0 text-sm font-semibold uppercase tracking-[0.35em] text-base-content/50">Unleash your</p>
      <h1 class="m-0 text-6xl font-black leading-none tracking-tight text-base-content sm:text-8xl">GEAR</h1>
      <p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-base-content/60">
        Seamlessly connect, configure and control your NANOCORE for live.
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3">
      <button class="btn btn-outline btn-lg" on:click={() => ctx.connect('demo')}>Try demo</button>
      <button class="btn btn-primary btn-lg" on:click={connectDevice}>Connect device</button>
    </div>

    {#if $uiView.capabilities?.bluetooth}
      <button class="btn btn-ghost btn-sm -mt-4 text-xs text-base-content/50 hover:text-base-content"
        aria-label="Connect via MIDI BLE" on:click={connectBle}>Connect via MIDI BLE instead</button>
    {/if}

    <div class="flex flex-wrap items-center justify-center gap-2 text-xs text-base-content/50">
      <span>{$uiView.demo ? 'Demo pedal is running in this browser — no hardware needed.' : ctx.connectionHint()}</span>
    </div>
  </div>
</div>
