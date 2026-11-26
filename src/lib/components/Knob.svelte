<script>
  // Rotary knob: a hidden range input is the single source of truth. Pointer
  // drags and arrow keys move it; input/change are emitted to the parent with
  // the numeric value as `event.detail`.
  import { createEventDispatcher } from 'svelte';

  export let id = 'knob';
  export let value = 0;
  export let max = 127;
  export let label = '';
  export let display = '';
  export let stepLabels = null;
  export let labels = null;
  export let stepLabel = null;

  const dispatch = createEventDispatcher();
  let drag = null;

  $: ceiling = Math.max(1, Number(max) || 1);
  $: current = Math.max(0, Math.min(ceiling, Number(value) || 0));
  $: detents = Array.isArray(stepLabels) ? stepLabels
    : Array.isArray(labels) ? labels
      : typeof stepLabel === 'string' && stepLabel ? stepLabel.split('|') : null;
  $: angle = -135 + (current / ceiling) * 270;
  $: ringLength = 2 * Math.PI * 29;
  $: trackArc = ringLength * 0.75;
  $: valueArc = trackArc * (current / ceiling);
  $: shown = detents && detents.length
    ? (detents[Math.round(current)] ?? String(Math.round(current)))
    : display;

  function emit(kind, next) {
    const clamped = Math.max(0, Math.min(ceiling, Math.round(Number(next) || 0)));
    value = clamped;
    dispatch(kind, clamped);
  }

  function onInput(event) { emit('input', event.currentTarget.value); }
  function onChange(event) { emit('change', event.currentTarget.value); }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, y: event.clientY, start: current };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (error) { /* synthetic pointer */ }
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    // Stepped knobs need a slower drag so each detent is easy to hit.
    const divisor = ceiling <= 10 ? 14 : 4;
    emit('input', drag.start + (drag.y - event.clientY) / divisor);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    emit('change', current);
    drag = null;
  }

  function onKeyDown(event) {
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1;
    emit('input', current + direction);
  }
</script>

<div class="relative inline-flex flex-col items-center">
  <div class="relative inline-flex">
    <svg class="pointer-events-none absolute -inset-[5px] z-0 h-[64px] w-[64px] -rotate-[225deg]" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="oklch(var(--b3))" stroke-width="3" stroke-linecap="round" stroke-dasharray="{trackArc} {ringLength}" />
      <circle cx="32" cy="32" r="29" fill="none" stroke="oklch(var(--p))" stroke-width="3" stroke-linecap="round" stroke-dasharray="{valueArc} {ringLength}" />
    </svg>
    <div
      class="relative z-10 grid h-[54px] w-[54px] cursor-ns-resize touch-none place-items-center rounded-full border-2 border-line bg-[#0f1319]"
      role="slider"
      tabindex="0"
      aria-label={label}
      aria-valuemin="0"
      aria-valuemax={ceiling}
      aria-valuenow={current}
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerUp}
      on:keydown={onKeyDown}
    >
      <div class="relative h-[38px] w-[38px] rounded-full bg-panel-2 [transform:rotate(var(--angle,0deg))]" style="--angle: {angle}deg"><i class="absolute left-1/2 top-[3px] h-3 w-0.5 -translate-x-1/2 bg-accent"></i></div>
    </div>
  </div>
  <div class="flex flex-col gap-0.5 text-[11px]"><label class="text-xs text-muted" for={id}>{label}</label><span class="text-center">{shown}</span></div>
  <input
    {id}
    class="pointer-events-none absolute h-px w-px input input-bordered input-sm opacity-0"
    type="range"
    min="0"
    max={ceiling}
    value={current}
    tabindex="-1"
    aria-hidden="true"
    on:input={onInput}
    on:change={onChange}
  >
</div>


